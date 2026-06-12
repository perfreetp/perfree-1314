import { AppDataSource } from "../config/data-source";
import { HazardPoint } from "../entities/HazardPoint.entity";
import { WorkOrder } from "../entities/WorkOrder.entity";
import { HazardType, RiskLevel } from "../types/enums";
import { throwApiError } from "../utils/response";
import { PaginationParams, getPaginationOptions, paginateQuery } from "../utils/pagination";
import { parseGeometry } from "../utils/spatial";

export interface CreateHazardPointDto {
  code: string;
  type: HazardType;
  title: string;
  description?: string;
  riskLevel?: RiskLevel;
  riskScore?: number;
  likelihoodScore?: number;
  consequenceScore?: number;
  pipelineId?: string;
  facilityId?: string;
  pipelineOffset?: number;
  departmentId: string;
  geometry?: any;
  discoveryDate?: Date;
  discoveredBy?: string;
  discoveryMethod?: string;
  recommendedAction?: string;
  expectedRepairDate?: Date;
  isRepaired?: boolean;
  repairDate?: Date;
  repairWorkOrderId?: string;
  images?: string[];
  attributes?: Record<string, any>;
  remarks?: string;
}

export interface UpdateHazardPointDto extends Partial<CreateHazardPointDto> {}

export interface HazardListFilters extends PaginationParams {
  type?: HazardType;
  riskLevel?: RiskLevel;
  pipelineId?: string;
  facilityId?: string;
  departmentId?: string;
  isRepaired?: boolean;
  code?: string;
  title?: string;
}

export interface AnnotateHazardDto {
  description?: string;
  recommendedAction?: string;
  riskLevel?: RiskLevel;
  likelihoodScore?: number;
  consequenceScore?: number;
  images?: string[];
  remarks?: string;
}

export interface UpdateRepairStatusDto {
  isRepaired: boolean;
  repairDate?: Date;
  repairWorkOrderId?: string;
  remarks?: string;
}

export interface LinkWorkOrderDto {
  workOrderId: string;
}

export interface BatchImportResult {
  success: number;
  failed: number;
  errors: Array<{ index: number; message: string }>;
}

export interface HazardStatistics {
  byType: Array<{
    type: HazardType;
    count: number;
    repairedCount: number;
    unrepairedCount: number;
  }>;
  byRiskLevel: Array<{
    riskLevel: RiskLevel;
    count: number;
    repairedCount: number;
    unrepairedCount: number;
  }>;
  total: {
    count: number;
    repairedCount: number;
    unrepairedCount: number;
  };
}

export interface GeometryQueryParams {
  geometry: any;
  relation?: "intersects" | "contains" | "within" | "dwithin";
  distance?: number;
}

const hazardRepository = AppDataSource.getRepository(HazardPoint);
const workOrderRepository = AppDataSource.getRepository(WorkOrder);

export async function createHazardPoint(
  dto: CreateHazardPointDto,
  userId?: string
): Promise<HazardPoint> {
  const existing = await hazardRepository.findOne({ where: { code: dto.code } });
  if (existing) {
    throwApiError(`隐患编号 ${dto.code} 已存在`, 409);
  }

  if (dto.pipelineId) {
    const pipelineExists = await AppDataSource.getRepository("Pipeline").findOne({
      where: { id: dto.pipelineId },
    });
    if (!pipelineExists) {
      throwApiError(`管线 ${dto.pipelineId} 不存在`, 404);
    }
  }

  if (dto.repairWorkOrderId) {
    const workOrder = await workOrderRepository.findOne({
      where: { id: dto.repairWorkOrderId },
    });
    if (!workOrder) {
      throwApiError(`工单 ${dto.repairWorkOrderId} 不存在`, 404);
    }
  }

  const hazard = hazardRepository.create({
    ...dto,
    createdBy: userId,
    updatedBy: userId,
  });

  return await hazardRepository.save(hazard);
}

export async function getHazardPoint(id: string): Promise<HazardPoint> {
  const hazard = await hazardRepository.findOne({
    where: { id },
    relations: ["pipeline", "facility", "department", "workOrders", "riskAssessments"],
  });
  if (!hazard) {
    throwApiError("隐患不存在", 404);
  }
  return hazard;
}

export async function updateHazardPoint(
  id: string,
  dto: UpdateHazardPointDto,
  userId?: string
): Promise<HazardPoint> {
  const hazard = await getHazardPoint(id);

  if (dto.code && dto.code !== hazard.code) {
    const existing = await hazardRepository.findOne({ where: { code: dto.code } });
    if (existing) {
      throwApiError(`隐患编号 ${dto.code} 已存在`, 409);
    }
  }

  if (dto.pipelineId && dto.pipelineId !== hazard.pipelineId) {
    const pipelineExists = await AppDataSource.getRepository("Pipeline").findOne({
      where: { id: dto.pipelineId },
    });
    if (!pipelineExists) {
      throwApiError(`管线 ${dto.pipelineId} 不存在`, 404);
    }
  }

  if (dto.repairWorkOrderId && dto.repairWorkOrderId !== hazard.repairWorkOrderId) {
    const workOrder = await workOrderRepository.findOne({
      where: { id: dto.repairWorkOrderId },
    });
    if (!workOrder) {
      throwApiError(`工单 ${dto.repairWorkOrderId} 不存在`, 404);
    }
  }

  const updated = hazardRepository.merge(hazard, {
    ...dto,
    updatedBy: userId,
  });

  return await hazardRepository.save(updated);
}

export async function deleteHazardPoint(id: string): Promise<void> {
  const hazard = await getHazardPoint(id);
  await hazardRepository.softDelete(hazard.id);
}

export async function listHazardPoints(filters: HazardListFilters) {
  const { page, pageSize, ...queryFilters } = filters;

  const qb = hazardRepository
    .createQueryBuilder("hazard")
    .leftJoinAndSelect("hazard.pipeline", "pipeline")
    .leftJoinAndSelect("hazard.department", "department");

  if (queryFilters.type) qb.andWhere("hazard.type = :type", { type: queryFilters.type });
  if (queryFilters.riskLevel)
    qb.andWhere("hazard.riskLevel = :riskLevel", { riskLevel: queryFilters.riskLevel });
  if (queryFilters.pipelineId)
    qb.andWhere("hazard.pipelineId = :pipelineId", { pipelineId: queryFilters.pipelineId });
  if (queryFilters.facilityId)
    qb.andWhere("hazard.facilityId = :facilityId", { facilityId: queryFilters.facilityId });
  if (queryFilters.departmentId)
    qb.andWhere("hazard.departmentId = :departmentId", {
      departmentId: queryFilters.departmentId,
    });
  if (queryFilters.isRepaired !== undefined)
    qb.andWhere("hazard.isRepaired = :isRepaired", { isRepaired: queryFilters.isRepaired });
  if (queryFilters.code) qb.andWhere("hazard.code = :code", { code: queryFilters.code });
  if (queryFilters.title)
    qb.andWhere("hazard.title ILIKE :title", { title: `%${queryFilters.title}%` });

  return await paginateQuery(qb, { page, pageSize });
}

export async function annotateHazardPoint(
  id: string,
  dto: AnnotateHazardDto,
  userId?: string
): Promise<HazardPoint> {
  const hazard = await getHazardPoint(id);

  const updated = hazardRepository.merge(hazard, {
    ...dto,
    updatedBy: userId,
  });

  return await hazardRepository.save(updated);
}

export async function getHazardsByPipeline(
  pipelineId: string,
  filters?: PaginationParams
) {
  const pipelineExists = await AppDataSource.getRepository("Pipeline").findOne({
    where: { id: pipelineId },
  });
  if (!pipelineExists) {
    throwApiError(`管线 ${pipelineId} 不存在`, 404);
  }

  const qb = hazardRepository
    .createQueryBuilder("hazard")
    .leftJoinAndSelect("hazard.department", "department")
    .where("hazard.pipelineId = :pipelineId", { pipelineId })
    .orderBy("hazard.pipelineOffset", "ASC");

  return await paginateQuery(qb, filters || {});
}

export async function getHazardsByGeometry(
  params: GeometryQueryParams,
  pagination?: PaginationParams
) {
  const { geometry, relation = "intersects", distance = 0 } = params;
  const geom = parseGeometry(geometry);

  if (!geom) {
    throwApiError("无效的几何对象", 400);
  }

  const qb = hazardRepository
    .createQueryBuilder("hazard")
    .leftJoinAndSelect("hazard.pipeline", "pipeline")
    .leftJoinAndSelect("hazard.department", "department");

  const geomJson = JSON.stringify(geom);

  switch (relation) {
    case "intersects":
      qb.where("ST_Intersects(hazard.geometry, ST_SetSRID(ST_GeomFromGeoJSON(:geom), 4326))", {
        geom: geomJson,
      });
      break;
    case "contains":
      qb.where("ST_Contains(ST_SetSRID(ST_GeomFromGeoJSON(:geom), 4326), hazard.geometry)", {
        geom: geomJson,
      });
      break;
    case "within":
      qb.where("ST_Within(hazard.geometry, ST_SetSRID(ST_GeomFromGeoJSON(:geom), 4326))", {
        geom: geomJson,
      });
      break;
    case "dwithin":
      if (distance <= 0) {
        throwApiError("距离参数必须大于0", 400);
      }
      qb.where(
        "ST_DWithin(hazard.geometry::geography, ST_SetSRID(ST_GeomFromGeoJSON(:geom), 4326)::geography, :distance)",
        { geom: geomJson, distance }
      );
      break;
    default:
      throwApiError(`不支持的空间关系: ${relation}`, 400);
  }

  if (pagination) {
    return await paginateQuery(qb, pagination);
  }

  const data = await qb.getMany();
  return { data, total: data.length };
}

export async function updateHazardRepairStatus(
  id: string,
  dto: UpdateRepairStatusDto,
  userId?: string
): Promise<HazardPoint> {
  const hazard = await getHazardPoint(id);

  if (dto.repairWorkOrderId && dto.repairWorkOrderId !== hazard.repairWorkOrderId) {
    const workOrder = await workOrderRepository.findOne({
      where: { id: dto.repairWorkOrderId },
    });
    if (!workOrder) {
      throwApiError(`工单 ${dto.repairWorkOrderId} 不存在`, 404);
    }
  }

  const updated = hazardRepository.merge(hazard, {
    ...dto,
    updatedBy: userId,
  });

  return await hazardRepository.save(updated);
}

export async function getHazardStatistics(): Promise<HazardStatistics> {
  const allHazards = await hazardRepository.find();

  const byType = Object.values(HazardType).map((type) => {
    const filtered = allHazards.filter((h: HazardPoint) => h.type === type);
    return {
      type,
      count: filtered.length,
      repairedCount: filtered.filter((h) => h.isRepaired).length,
      unrepairedCount: filtered.filter((h) => !h.isRepaired).length,
    };
  });

  const byRiskLevel = Object.values(RiskLevel).map((riskLevel) => {
    const filtered = allHazards.filter((h: HazardPoint) => h.riskLevel === riskLevel);
    return {
      riskLevel,
      count: filtered.length,
      repairedCount: filtered.filter((h) => h.isRepaired).length,
      unrepairedCount: filtered.filter((h) => !h.isRepaired).length,
    };
  });

  const total = {
    count: allHazards.length,
    repairedCount: allHazards.filter((h) => h.isRepaired).length,
    unrepairedCount: allHazards.filter((h) => !h.isRepaired).length,
  };

  return {
    byType,
    byRiskLevel,
    total,
  };
}

export async function linkHazardToWorkOrder(
  hazardId: string,
  dto: LinkWorkOrderDto,
  userId?: string
): Promise<HazardPoint> {
  const hazard = await getHazardPoint(hazardId);
  const workOrder = await workOrderRepository.findOne({ where: { id: dto.workOrderId } });

  if (!workOrder) {
    throwApiError(`工单 ${dto.workOrderId} 不存在`, 404);
  }

  workOrder.hazardId = hazardId;
  await workOrderRepository.save(workOrder);

  hazard.repairWorkOrderId = dto.workOrderId;
  hazard.updatedBy = userId;

  return await hazardRepository.save(hazard);
}

export async function batchImportHazards(
  hazardDtos: CreateHazardPointDto[],
  userId?: string
): Promise<BatchImportResult> {
  const result: BatchImportResult = {
    success: 0,
    failed: 0,
    errors: [],
  };

  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    for (let i = 0; i < hazardDtos.length; i++) {
      try {
        const dto = hazardDtos[i];

        const existing = await queryRunner.manager.findOne(HazardPoint, {
          where: { code: dto.code },
        });
        if (existing) {
          throw new Error(`隐患编号 ${dto.code} 已存在`);
        }

        if (dto.pipelineId) {
          const pipelineExists = await queryRunner.manager.findOne("Pipeline", {
            where: { id: dto.pipelineId },
          });
          if (!pipelineExists) {
            throw new Error(`管线 ${dto.pipelineId} 不存在`);
          }
        }

        const hazard = queryRunner.manager.create(HazardPoint, {
          ...dto,
          createdBy: userId,
          updatedBy: userId,
        });

        await queryRunner.manager.save(hazard);
        result.success++;
      } catch (error: any) {
        result.failed++;
        result.errors.push({
          index: i,
          message: error.message || "未知错误",
        });
      }
    }

    await queryRunner.commitTransaction();
  } catch (error) {
    await queryRunner.rollbackTransaction();
    throw error;
  } finally {
    await queryRunner.release();
  }

  return result;
}
