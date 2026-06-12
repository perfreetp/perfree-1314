import { AppDataSource } from "../config/data-source";
import { Pipeline } from "../entities/Pipeline.entity";
import { PipelineNode } from "../entities/PipelineNode.entity";
import { PipelineType, PipelineStatus, PipelineMaterial, RiskLevel, ChangeType } from "../types/enums";
import { throwApiError } from "../utils/response";
import { PaginationParams } from "../utils/pagination";
import { parseGeometry, nearestPointOnLine } from "../utils/spatial";
import * as changeHistoryService from "./changeHistory.service";

export interface CreatePipelineDto {
  code: string;
  name?: string;
  type: PipelineType;
  material?: PipelineMaterial;
  diameter?: number;
  length?: number;
  burialDepth?: number;
  elevationStart?: number;
  elevationEnd?: number;
  roadName?: string;
  locationDescription?: string;
  constructionDate?: Date;
  commissionDate?: Date;
  status?: PipelineStatus;
  startNodeId?: string;
  endNodeId?: string;
  departmentId: string;
  geometry: any;
  attributes?: Record<string, any>;
  sharingLevel?: any;
  remarks?: string;
}

export interface UpdatePipelineDto extends Partial<CreatePipelineDto> {}

export interface PipelineListFilters extends PaginationParams {
  type?: PipelineType;
  status?: PipelineStatus;
  material?: PipelineMaterial;
  departmentId?: string;
  code?: string;
  name?: string;
  riskScoreMin?: number;
  riskScoreMax?: number;
}

export interface SectionOccupancyParams {
  point: number[];
  radius?: number;
}

export interface SectionOccupancyResult {
  point: number[];
  radius: number;
  pipelines: Array<{
    pipeline: Pipeline;
    distance: number;
    location: number;
    nearestPoint: number[];
  }>;
  totalOccupancyArea: number;
  occupancyRate: number;
}

export interface GeometryQueryParams {
  geometry: any;
  relation?: "intersects" | "contains" | "within";
}

export interface PipelineStatistics {
  byType: Array<{
    type: PipelineType;
    count: number;
    totalLength: number;
  }>;
  byStatus: Array<{
    status: PipelineStatus;
    count: number;
    totalLength: number;
  }>;
  byMaterial: Array<{
    material: PipelineMaterial;
    count: number;
    totalLength: number;
  }>;
  byRiskLevel: Array<{
    riskLevel: RiskLevel;
    count: number;
    totalLength: number;
  }>;
  total: {
    count: number;
    totalLength: number;
  };
}

export interface RiskScoreFactors {
  age: number;
  material: PipelineMaterial;
  diameter: number;
  length: number;
  burialDepth: number;
  status: PipelineStatus;
  type: PipelineType;
  defectCount?: number;
  leakCount?: number;
}

const pipelineRepository = AppDataSource.getRepository(Pipeline);
const nodeRepository = AppDataSource.getRepository(PipelineNode);

export async function createPipeline(dto: CreatePipelineDto, userId?: string): Promise<Pipeline> {
  const existing = await pipelineRepository.findOne({ where: { code: dto.code } });
  if (existing) {
    throwApiError(`管线编号 ${dto.code} 已存在`, 409);
  }

  if (dto.startNodeId) {
    const startNode = await nodeRepository.findOne({ where: { id: dto.startNodeId } });
    if (!startNode) {
      throwApiError(`起点节点 ${dto.startNodeId} 不存在`, 404);
    }
  }

  if (dto.endNodeId) {
    const endNode = await nodeRepository.findOne({ where: { id: dto.endNodeId } });
    if (!endNode) {
      throwApiError(`终点节点 ${dto.endNodeId} 不存在`, 404);
    }
  }

  const pipeline = pipelineRepository.create({
    ...dto,
    createdBy: userId,
    updatedBy: userId,
  });

  const age = calculatePipelineAge(pipeline);
  pipeline.riskScore = calculateRiskScore({
    age,
    material: pipeline.material || PipelineMaterial.OTHER,
    diameter: pipeline.diameter || 0,
    length: pipeline.length || 0,
    burialDepth: pipeline.burialDepth || 0,
    status: pipeline.status,
    type: pipeline.type,
  });

  const saved = await pipelineRepository.save(pipeline);

  try {
    await changeHistoryService.recordChange({
      entityType: "pipeline",
      entityId: saved.id,
      changeType: ChangeType.CREATE,
      newEntity: saved,
      operatorId: userId,
      changeReason: "新建管线",
    });
  } catch {}

  return saved;
}

export async function getPipeline(id: string): Promise<Pipeline> {
  const pipeline = await pipelineRepository.findOne({
    where: { id },
    relations: ["startNode", "endNode", "department"],
  });
  if (!pipeline) {
    throwApiError("管线不存在", 404);
  }
  return pipeline;
}

export async function updatePipeline(
  id: string,
  dto: UpdatePipelineDto,
  userId?: string
): Promise<Pipeline> {
  const pipeline = await getPipeline(id);
  const oldEntity = { ...pipeline };

  if (dto.code && dto.code !== pipeline.code) {
    const existing = await pipelineRepository.findOne({ where: { code: dto.code } });
    if (existing) {
      throwApiError(`管线编号 ${dto.code} 已存在`, 409);
    }
  }

  if (dto.startNodeId && dto.startNodeId !== pipeline.startNodeId) {
    const startNode = await nodeRepository.findOne({ where: { id: dto.startNodeId } });
    if (!startNode) {
      throwApiError(`起点节点 ${dto.startNodeId} 不存在`, 404);
    }
  }

  if (dto.endNodeId && dto.endNodeId !== pipeline.endNodeId) {
    const endNode = await nodeRepository.findOne({ where: { id: dto.endNodeId } });
    if (!endNode) {
      throwApiError(`终点节点 ${dto.endNodeId} 不存在`, 404);
    }
  }

  const updated = pipelineRepository.merge(pipeline, {
    ...dto,
    updatedBy: userId,
  });

  const age = calculatePipelineAge(updated);
  updated.riskScore = calculateRiskScore({
    age,
    material: updated.material || PipelineMaterial.OTHER,
    diameter: updated.diameter || 0,
    length: updated.length || 0,
    burialDepth: updated.burialDepth || 0,
    status: updated.status,
    type: updated.type,
  });

  const saved = await pipelineRepository.save(updated);

  try {
    await changeHistoryService.recordChange({
      entityType: "pipeline",
      entityId: saved.id,
      changeType: ChangeType.UPDATE,
      oldEntity,
      newEntity: saved,
      operatorId: userId,
      changeReason: "更新管线",
    });
  } catch {}

  return saved;
}

export async function deletePipeline(id: string, userId?: string): Promise<void> {
  const pipeline = await getPipeline(id);
  const oldEntity = { ...pipeline };
  await pipelineRepository.softDelete(pipeline.id);

  try {
    await changeHistoryService.recordChange({
      entityType: "pipeline",
      entityId: id,
      changeType: ChangeType.DELETE,
      oldEntity,
      operatorId: userId,
      changeReason: "删除管线",
    });
  } catch {}
}

export function buildPipelineQueryBuilder(filters: PipelineListFilters) {
  const qb = pipelineRepository
    .createQueryBuilder("pipeline")
    .leftJoinAndSelect("pipeline.startNode", "startNode")
    .leftJoinAndSelect("pipeline.endNode", "endNode")
    .leftJoinAndSelect("pipeline.department", "department");

  if (filters.type) {
    qb.andWhere("pipeline.type = :type", { type: filters.type });
  }
  if (filters.status) {
    qb.andWhere("pipeline.status = :status", { status: filters.status });
  }
  if (filters.material) {
    qb.andWhere("pipeline.material = :material", { material: filters.material });
  }
  if (filters.departmentId) {
    qb.andWhere("pipeline.departmentId = :departmentId", { departmentId: filters.departmentId });
  }
  if (filters.code) {
    qb.andWhere("pipeline.code ILIKE :code", { code: `%${filters.code}%` });
  }
  if (filters.name) {
    qb.andWhere("pipeline.name ILIKE :name", { name: `%${filters.name}%` });
  }
  if (filters.riskScoreMin !== undefined) {
    qb.andWhere("pipeline.riskScore >= :riskScoreMin", {
      riskScoreMin: filters.riskScoreMin,
    });
  }
  if (filters.riskScoreMax !== undefined) {
    qb.andWhere("pipeline.riskScore <= :riskScoreMax", {
      riskScoreMax: filters.riskScoreMax,
    });
  }

  qb.orderBy("pipeline.createdAt", "DESC");
  return qb;
}

export async function listPipelines(filters: PipelineListFilters) {
  const { page, pageSize } = filters;
  const qb = buildPipelineQueryBuilder(filters);

  const { skip, take, page: currentPage, pageSize: size } = getPaginationOptions({
    page,
    pageSize,
  });

  const [data, total] = await qb.skip(skip).take(take).getManyAndCount();

  return {
    data,
    total,
    page: currentPage,
    pageSize: size,
  };
}

export async function getUpstreamPipelines(id: string, maxDepth: number = 5): Promise<Pipeline[]> {
  const pipeline = await getPipeline(id);
  const visited = new Set<string>();
  const result: Pipeline[] = [];

  async function traverse(nodeId: string | undefined, depth: number) {
    if (!nodeId || depth > maxDepth || visited.has(nodeId)) return;
    visited.add(nodeId);

    const incomingPipelines = await pipelineRepository.find({
      where: { endNodeId: nodeId },
      relations: ["startNode", "endNode"],
    });

    for (const p of incomingPipelines) {
      result.push(p);
      await traverse(p.startNodeId, depth + 1);
    }
  }

  await traverse(pipeline.startNodeId, 0);
  return result;
}

export async function getDownstreamPipelines(id: string, maxDepth: number = 5): Promise<Pipeline[]> {
  const pipeline = await getPipeline(id);
  const visited = new Set<string>();
  const result: Pipeline[] = [];

  async function traverse(nodeId: string | undefined, depth: number) {
    if (!nodeId || depth > maxDepth || visited.has(nodeId)) return;
    visited.add(nodeId);

    const outgoingPipelines = await pipelineRepository.find({
      where: { startNodeId: nodeId },
      relations: ["startNode", "endNode"],
    });

    for (const p of outgoingPipelines) {
      result.push(p);
      await traverse(p.endNodeId, depth + 1);
    }
  }

  await traverse(pipeline.endNodeId, 0);
  return result;
}

export async function getConnectedPipelines(id: string): Promise<Pipeline[]> {
  const pipeline = await getPipeline(id);
  const connected: Pipeline[] = [];

  if (pipeline.startNodeId) {
    const incoming = await pipelineRepository.find({
      where: { endNodeId: pipeline.startNodeId },
      relations: ["startNode", "endNode"],
    });
    connected.push(...incoming);
  }

  if (pipeline.endNodeId) {
    const outgoing = await pipelineRepository.find({
      where: { startNodeId: pipeline.endNodeId },
      relations: ["startNode", "endNode"],
    });
    connected.push(...outgoing);
  }

  return connected.filter((p) => p.id !== id);
}

export async function getSectionOccupancy(
  params: SectionOccupancyParams
): Promise<SectionOccupancyResult> {
  const { point, radius = 5 } = params;
  const [lng, lat] = point;

  const qb = pipelineRepository
    .createQueryBuilder("pipeline")
    .where(
      "ST_DWithin(pipeline.geometry::geography, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography, :radius)",
      { lng, lat, radius }
    )
    .andWhere("pipeline.status != :status", { status: PipelineStatus.ABANDONED });

  const pipelines = await qb.getMany();

  const pipelineDetails = [];
  let totalOccupancyArea = 0;

  for (const pipeline of pipelines) {
    const geom = parseGeometry(pipeline.geometry);
    if (!geom || !geom.coordinates) continue;

    const nearest = nearestPointOnLine(geom.coordinates, point);
    const distance = nearest.dist;

    if (distance <= radius) {
      const diameter = pipeline.diameter || 0.5;
      const occupancyArea = Math.PI * Math.pow(diameter / 2, 2);
      totalOccupancyArea += occupancyArea;

      pipelineDetails.push({
        pipeline,
        distance: nearest.dist,
        location: nearest.location,
        nearestPoint: nearest.point,
      });
    }
  }

  const sectionArea = Math.PI * Math.pow(radius, 2);
  const occupancyRate = sectionArea > 0 ? totalOccupancyArea / sectionArea : 0;

  return {
    point,
    radius,
    pipelines: pipelineDetails,
    totalOccupancyArea,
    occupancyRate,
  };
}

export async function getPipelinesByGeometry(
  params: GeometryQueryParams,
  pagination?: PaginationParams
) {
  const { geometry, relation = "intersects" } = params;
  const geom = parseGeometry(geometry);

  if (!geom) {
    throwApiError("无效的几何对象", 400);
  }

  const qb = pipelineRepository
    .createQueryBuilder("pipeline")
    .leftJoinAndSelect("pipeline.startNode", "startNode")
    .leftJoinAndSelect("pipeline.endNode", "endNode");

  const geomJson = JSON.stringify(geom);

  switch (relation) {
    case "intersects":
      qb.where("ST_Intersects(pipeline.geometry, ST_SetSRID(ST_GeomFromGeoJSON(:geom), 4326))", {
        geom: geomJson,
      });
      break;
    case "contains":
      qb.where("ST_Contains(ST_SetSRID(ST_GeomFromGeoJSON(:geom), 4326), pipeline.geometry)", {
        geom: geomJson,
      });
      break;
    case "within":
      qb.where("ST_Within(pipeline.geometry, ST_SetSRID(ST_GeomFromGeoJSON(:geom), 4326))", {
        geom: geomJson,
      });
      break;
    default:
      throwApiError(`不支持的空间关系: ${relation}`, 400);
  }

  if (pagination) {
    const { skip, take, page, pageSize } = getPaginationOptions(pagination);
    const [data, total] = await qb.skip(skip).take(take).getManyAndCount();
    return { data, total, page, pageSize };
  }

  const data = await qb.getMany();
  return { data, total: data.length };
}

export async function getPipelineStatistics(filters?: Partial<PipelineListFilters>): Promise<PipelineStatistics> {
  const qb = buildPipelineQueryBuilder(filters || {});
  const allPipelines = await qb.getMany();

  const byType = Object.values(PipelineType).map((type) => {
    const filtered = allPipelines.filter((p: Pipeline) => p.type === type);
    return {
      type,
      count: filtered.length,
      totalLength: filtered.reduce((sum: number, p: Pipeline) => sum + (p.length || 0), 0),
    };
  });

  const byStatus = Object.values(PipelineStatus).map((status) => {
    const filtered = allPipelines.filter((p: Pipeline) => p.status === status);
    return {
      status,
      count: filtered.length,
      totalLength: filtered.reduce((sum: number, p: Pipeline) => sum + (p.length || 0), 0),
    };
  });

  const byMaterial = Object.values(PipelineMaterial).map((material) => {
    const filtered = allPipelines.filter((p: Pipeline) => p.material === material);
    return {
      material,
      count: filtered.length,
      totalLength: filtered.reduce((sum: number, p: Pipeline) => sum + (p.length || 0), 0),
    };
  });

  const byRiskLevel = Object.values(RiskLevel).map((riskLevel) => {
    const filtered = allPipelines.filter((p: Pipeline) => getRiskLevel(p.riskScore) === riskLevel);
    return {
      riskLevel,
      count: filtered.length,
      totalLength: filtered.reduce((sum: number, p: Pipeline) => sum + (p.length || 0), 0),
    };
  });

  const total = {
    count: allPipelines.length,
    totalLength: allPipelines.reduce((sum: number, p: Pipeline) => sum + (p.length || 0), 0),
  };

  return {
    byType,
    byStatus,
    byMaterial,
    byRiskLevel,
    total,
  };
}

export function calculatePipelineAge(pipeline: Pipeline): number {
  const baseDate = pipeline.commissionDate || pipeline.constructionDate;
  if (!baseDate) return 0;

  const now = new Date();
  const commission = new Date(baseDate);
  const diffTime = Math.abs(now.getTime() - commission.getTime());
  const diffYears = diffTime / (1000 * 60 * 60 * 24 * 365.25);

  return Math.round(diffYears * 100) / 100;
}

export function calculateRiskScore(factors: RiskScoreFactors): number {
  const { age, material, diameter, length, burialDepth, status, type, defectCount = 0, leakCount = 0 } =
    factors;

  let score = 0;

  const ageScore = Math.min(age * 2, 30);
  score += ageScore;

  const materialScores: Record<PipelineMaterial, number> = {
    [PipelineMaterial.CAST_IRON]: 15,
    [PipelineMaterial.DUCTILE_IRON]: 10,
    [PipelineMaterial.STEEL]: 8,
    [PipelineMaterial.PVC]: 5,
    [PipelineMaterial.PE]: 5,
    [PipelineMaterial.CONCRETE]: 12,
    [PipelineMaterial.BRICK]: 18,
    [PipelineMaterial.OTHER]: 10,
  };
  score += materialScores[material] || 10;

  if (diameter > 0) {
    const diameterScore = diameter > 1000 ? 10 : diameter > 500 ? 7 : diameter > 200 ? 5 : 3;
    score += diameterScore;
  }

  if (length > 0) {
    const lengthScore = Math.min(length / 100, 10);
    score += lengthScore;
  }

  if (burialDepth > 0) {
    const depthScore = burialDepth > 5 ? 8 : burialDepth > 3 ? 5 : 3;
    score += depthScore;
  }

  const statusScores: Record<PipelineStatus, number> = {
    [PipelineStatus.NORMAL]: 0,
    [PipelineStatus.MAINTENANCE]: 10,
    [PipelineStatus.FAULT]: 20,
    [PipelineStatus.ABANDONED]: 25,
    [PipelineStatus.PLANNED]: 0,
  };
  score += statusScores[status] || 0;

  const typeScores: Record<PipelineType, number> = {
    [PipelineType.GAS]: 15,
    [PipelineType.ELECTRIC]: 12,
    [PipelineType.WATER]: 8,
    [PipelineType.SEWAGE]: 6,
    [PipelineType.HEAT]: 10,
    [PipelineType.TELECOM]: 5,
    [PipelineType.RAINWATER]: 4,
    [PipelineType.OTHER]: 5,
  };
  score += typeScores[type] || 5;

  score += defectCount * 5;
  score += leakCount * 8;

  return Math.min(Math.round(score), 100);
}

function getRiskLevel(score: number): RiskLevel {
  if (score >= 80) return RiskLevel.VERY_HIGH;
  if (score >= 60) return RiskLevel.HIGH;
  if (score >= 40) return RiskLevel.MEDIUM;
  return RiskLevel.LOW;
}

function getPaginationOptions(params: PaginationParams) {
  const page = Math.max(1, params.page || 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize || 20));
  const skip = (page - 1) * pageSize;
  return { skip, take: pageSize, page, pageSize };
}
