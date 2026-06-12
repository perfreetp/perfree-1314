import { AppDataSource } from "../config/data-source";
import { PipelineConflict } from "../entities/PipelineConflict.entity";
import { Pipeline } from "../entities/Pipeline.entity";
import { ExcavationApplication } from "../entities/ExcavationApplication.entity";
import { ConflictType, RiskLevel, PipelineType } from "../types/enums";
import { throwApiError } from "../utils/response";
import { parseGeometry } from "../utils/spatial";

export interface ConflictDetectionParams {
  applicationId: string;
  detectSpatial?: boolean;
  detectVertical?: boolean;
  detectSafetyDistance?: boolean;
}

export interface ConflictDetectionResult {
  totalConflicts: number;
  byType: Array<{
    type: ConflictType;
    count: number;
  }>;
  bySeverity: Array<{
    severity: RiskLevel;
    count: number;
  }>;
  conflicts: PipelineConflict[];
}

export interface ConflictStatistics {
  byType: Array<{
    type: ConflictType;
    count: number;
  }>;
  bySeverity: Array<{
    severity: RiskLevel;
    count: number;
  }>;
  byPipelineType: Array<{
    pipelineType: PipelineType;
    count: number;
  }>;
  total: {
    totalConflicts: number;
    resolvedCount: number;
    unresolvedCount: number;
  };
}

export interface ResolveConflictDto {
  resolutionNotes?: string;
}

const conflictRepository = AppDataSource.getRepository(PipelineConflict);
const pipelineRepository = AppDataSource.getRepository(Pipeline);
const excavationRepository = AppDataSource.getRepository(ExcavationApplication);

const SAFETY_DISTANCE_THRESHOLDS: Record<PipelineType, number> = {
  [PipelineType.GAS]: 3.0,
  [PipelineType.ELECTRIC]: 2.0,
  [PipelineType.WATER]: 1.5,
  [PipelineType.SEWAGE]: 1.0,
  [PipelineType.HEAT]: 2.0,
  [PipelineType.TELECOM]: 1.0,
  [PipelineType.RAINWATER]: 1.0,
  [PipelineType.OTHER]: 1.0,
};

const VERTICAL_CLEARANCE_THRESHOLDS: Record<PipelineType, number> = {
  [PipelineType.GAS]: 0.5,
  [PipelineType.ELECTRIC]: 0.5,
  [PipelineType.WATER]: 0.3,
  [PipelineType.SEWAGE]: 0.3,
  [PipelineType.HEAT]: 0.3,
  [PipelineType.TELECOM]: 0.3,
  [PipelineType.RAINWATER]: 0.3,
  [PipelineType.OTHER]: 0.3,
};

function getSeverity(distance: number, threshold: number, pipelineType: PipelineType): RiskLevel {
  const ratio = distance / threshold;
  if (ratio <= 0.3) return RiskLevel.VERY_HIGH;
  if (ratio <= 0.5) return RiskLevel.HIGH;
  if (ratio <= 0.8) return RiskLevel.MEDIUM;
  return RiskLevel.LOW;
}

export async function detectConflicts(params: ConflictDetectionParams): Promise<ConflictDetectionResult> {
  const { applicationId, detectSpatial = true, detectVertical = true, detectSafetyDistance = true } = params;

  const application = await excavationRepository.findOne({ where: { id: applicationId } });
  if (!application) {
    throwApiError("开挖申请不存在", 404);
  }

  if (!application?.excavationAreaGeometry) {
    throwApiError("开挖区域几何图形不存在", 400);
  }

  await conflictRepository.delete({ applicationId });

  const allConflicts: PipelineConflict[] = [];

  if (detectSpatial) {
    const spatialConflicts = await detectSpatialConflicts(application);
    allConflicts.push(...spatialConflicts);
  }

  if (detectVertical) {
    const verticalConflicts = await detectVerticalConflicts(application);
    allConflicts.push(...verticalConflicts);
  }

  if (detectSafetyDistance) {
    const safetyConflicts = await detectSafetyDistanceConflicts(application);
    allConflicts.push(...safetyConflicts);
  }

  const hasConflict = allConflicts.length > 0;
  application.hasConflict = hasConflict;
  await excavationRepository.save(application);

  const byType = Object.values(ConflictType).map((type) => ({
    type,
    count: allConflicts.filter((c) => c.type === type).length,
  }));

  const bySeverity = Object.values(RiskLevel).map((severity) => ({
    severity,
    count: allConflicts.filter((c) => c.severity === severity).length,
  }));

  return {
    totalConflicts: allConflicts.length,
    byType,
    bySeverity,
    conflicts: allConflicts,
  };
}

export async function detectSpatialConflicts(
  application: ExcavationApplication
): Promise<PipelineConflict[]> {
  const conflicts: PipelineConflict[] = [];

  const excavationGeomJson = JSON.stringify(parseGeometry(application.excavationAreaGeometry));

  const qb = pipelineRepository
    .createQueryBuilder("pipeline")
    .where(
      "ST_Intersects(pipeline.geometry, ST_SetSRID(ST_GeomFromGeoJSON(:excavationGeom), 4326))",
      { excavationGeom: excavationGeomJson }
    )
    .andWhere("pipeline.status != :status", { status: "abandoned" });

  const intersectingPipelines = await qb.getMany();

  for (const pipeline of intersectingPipelines) {
    const conflictPoint = await pipelineRepository
      .createQueryBuilder("pipeline")
      .select("ST_Intersection(pipeline.geometry, ST_SetSRID(ST_GeomFromGeoJSON(:excavationGeom), 4326)) AS intersection")
      .where("pipeline.id = :pipelineId", { pipelineId: pipeline.id })
      .getRawOne();

    const distance = 0;
    const severity = getSeverity(distance, 0, pipeline.type);

    const conflict = conflictRepository.create({
      applicationId: application.id,
      pipelineId: pipeline.id,
      type: ConflictType.SPATIAL,
      pipelineType: pipeline.type,
      severity,
      title: `空间冲突 - ${pipeline.type}管线`,
      description: `开挖区域与 ${pipeline.name || pipeline.code} 管线存在空间相交`,
      distance,
      minimumSafeDistance: SAFETY_DISTANCE_THRESHOLDS[pipeline.type],
      conflictPoint: conflictPoint?.intersection || null,
      affectedLength: pipeline.length,
      suggestedSolution: `建议调整开挖范围或制定管线改迁方案`,
      isResolved: false,
    });

    const savedConflict = await conflictRepository.save(conflict);
    conflicts.push(savedConflict);
  }

  return conflicts;
}

export async function detectVerticalConflicts(
  application: ExcavationApplication
): Promise<PipelineConflict[]> {
  const conflicts: PipelineConflict[] = [];
  const excavationGeomJson = JSON.stringify(parseGeometry(application.excavationAreaGeometry));
  const excavationDepth = application.excavationDepth || 2;

  const qb = pipelineRepository
    .createQueryBuilder("pipeline")
    .where(
      "ST_DWithin(pipeline.geometry::geography, ST_SetSRID(ST_GeomFromGeoJSON(:excavationGeom), 4326)::geography, 5)",
      { excavationGeom: excavationGeomJson }
    )
    .andWhere("pipeline.burialDepth IS NOT NULL")
    .andWhere("pipeline.status != :status", { status: "abandoned" });

  const nearbyPipelines = await qb.getMany();

  for (const pipeline of nearbyPipelines) {
    const pipelineDepth = pipeline.burialDepth || 0;
    const verticalDistance = Math.abs(excavationDepth - pipelineDepth);
    const threshold = VERTICAL_CLEARANCE_THRESHOLDS[pipeline.type];

    if (verticalDistance < threshold) {
      const severity = getSeverity(verticalDistance, threshold, pipeline.type);

      const conflict = conflictRepository.create({
        applicationId: application.id,
        pipelineId: pipeline.id,
        type: ConflictType.VERTICAL,
        pipelineType: pipeline.type,
        severity,
        title: `垂直净距冲突 - ${pipeline.type}管线`,
        description: `开挖深度 ${excavationDepth}m 与管线埋深 ${pipelineDepth}m 的垂直净距不足`,
        distance: verticalDistance,
        minimumSafeDistance: SAFETY_DISTANCE_THRESHOLDS[pipeline.type],
        verticalDistance,
        verticalSafeDistance: threshold,
        suggestedSolution: `建议调整开挖深度或采取管线保护措施`,
        isResolved: false,
      });

      const savedConflict = await conflictRepository.save(conflict);
      conflicts.push(savedConflict);
    }
  }

  return conflicts;
}

export async function detectSafetyDistanceConflicts(
  application: ExcavationApplication
): Promise<PipelineConflict[]> {
  const conflicts: PipelineConflict[] = [];
  const excavationGeomJson = JSON.stringify(parseGeometry(application.excavationAreaGeometry));

  const qb = pipelineRepository
    .createQueryBuilder("pipeline")
    .select([
      "pipeline",
      "ST_Distance(pipeline.geometry::geography, ST_SetSRID(ST_GeomFromGeoJSON(:excavationGeom), 4326)::geography) AS distance",
    ])
    .where(
      "ST_DWithin(pipeline.geometry::geography, ST_SetSRID(ST_GeomFromGeoJSON(:excavationGeom), 4326)::geography, 10)",
      { excavationGeom: excavationGeomJson }
    )
    .andWhere("pipeline.status != :status", { status: "abandoned" })
    .orderBy("distance", "ASC");

  const { raw, entities } = await qb.getRawAndEntities();

  for (let i = 0; i < entities.length; i++) {
    const pipeline = entities[i];
    const distance = parseFloat(raw[i].distance);
    const threshold = SAFETY_DISTANCE_THRESHOLDS[pipeline.type];

    if (distance < threshold) {
      const severity = getSeverity(distance, threshold, pipeline.type);

      const conflict = conflictRepository.create({
        applicationId: application.id,
        pipelineId: pipeline.id,
        type: ConflictType.SAFETY_DISTANCE,
        pipelineType: pipeline.type,
        severity,
        title: `安全距离冲突 - ${pipeline.type}管线`,
        description: `开挖区域与 ${pipeline.name || pipeline.code} 管线距离不足`,
        distance,
        minimumSafeDistance: threshold,
        suggestedSolution: `建议扩大安全距离不小于 ${threshold}m 或采取保护措施`,
        isResolved: false,
      });

      const savedConflict = await conflictRepository.save(conflict);
      conflicts.push(savedConflict);
    }
  }

  return conflicts;
}

export async function getConflictDetails(id: string): Promise<PipelineConflict> {
  const conflict = await conflictRepository.findOne({
    where: { id },
    relations: ["pipeline", "application"],
  });
  if (!conflict) {
    throwApiError("冲突记录不存在", 404);
  }
  return conflict;
}

export async function getConflictsByApplication(applicationId: string): Promise<PipelineConflict[]> {
  const application = await excavationRepository.findOne({ where: { id: applicationId } });
  if (!application) {
    throwApiError("开挖申请不存在", 404);
  }

  return await conflictRepository.find({
    where: { applicationId },
    relations: ["pipeline"],
    order: { createdAt: "DESC" },
  });
}

export async function resolveConflict(
  id: string,
  dto: ResolveConflictDto,
  userId?: string
): Promise<PipelineConflict> {
  const conflict = await getConflictDetails(id);

  conflict.isResolved = true;
  conflict.resolutionNotes = dto.resolutionNotes as string;
  conflict.resolvedAt = new Date();
  conflict.resolvedBy = userId as string;

  const saved = await conflictRepository.save(conflict);

  const application = await excavationRepository.findOne({ where: { id: conflict.applicationId } });
  if (application) {
    const remainingConflicts = await conflictRepository.count({
      where: { applicationId: conflict.applicationId, isResolved: false },
    });
    application.hasConflict = remainingConflicts > 0;
    await excavationRepository.save(application);
  }

  return saved;
}

export async function getConflictStatistics(applicationId?: string): Promise<ConflictStatistics> {
  let whereClause: any = {};
  if (applicationId) {
    whereClause.applicationId = applicationId;
  }

  const allConflicts = await conflictRepository.find({ where: whereClause });

  const byType = Object.values(ConflictType).map((type) => ({
    type,
    count: allConflicts.filter((c) => c.type === type).length,
  }));

  const bySeverity = Object.values(RiskLevel).map((severity) => ({
    severity,
    count: allConflicts.filter((c) => c.severity === severity).length,
  }));

  const byPipelineType = Object.values(PipelineType).map((pipelineType) => ({
    pipelineType,
    count: allConflicts.filter((c) => c.pipelineType === pipelineType).length,
  }));

  const total = {
    totalConflicts: allConflicts.length,
    resolvedCount: allConflicts.filter((c) => c.isResolved).length,
    unresolvedCount: allConflicts.filter((c) => !c.isResolved).length,
  };

  return {
    byType,
    bySeverity,
    byPipelineType,
    total,
  };
}
