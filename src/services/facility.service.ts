import { AppDataSource } from "../config/data-source";
import { Facility } from "../entities/Facility.entity";
import { WorkOrder } from "../entities/WorkOrder.entity";
import { FacilityType, ValveStatus, WorkOrderStatus, PipelineType, ValveType, SharingLevel } from "../types/enums";
import { throwApiError } from "../utils/response";
import { paginateRepository, PaginationParams } from "../utils/pagination";
import { In, Between, FindOptionsWhere } from "typeorm";
import { parseGeometry, pointInPolygon, calculateDistance } from "../utils/spatial";

const facilityRepository = AppDataSource.getRepository(Facility);
const workOrderRepository = AppDataSource.getRepository(WorkOrder);

export interface FacilityCreateData {
  code: string;
  name?: string;
  type: FacilityType;
  pipelineType?: PipelineType;
  valveType?: ValveType;
  status?: ValveStatus;
  diameter?: number;
  brand?: string;
  model?: string;
  installationDate?: Date;
  groundElevation?: number;
  coverElevation?: number;
  bottomElevation?: number;
  depth?: number;
  coverSize?: string;
  coverMaterial?: string;
  roadName?: string;
  locationDescription?: string;
  pipelineId?: string;
  nodeId?: string;
  departmentId: string;
  geometry: any;
  attributes?: Record<string, any>;
  sharingLevel?: SharingLevel;
  remarks?: string;
}

export interface FacilityUpdateData extends Partial<FacilityCreateData> {}

export interface GeometryQueryParams {
  geometry: any;
  relation?: "intersects" | "contains" | "within";
}

export async function createFacility(data: FacilityCreateData): Promise<Facility> {
  try {
    const existing = await facilityRepository.findOne({ where: { code: data.code } });
    if (existing) {
      throwApiError("设施编码已存在", 400);
    }

    const facility = facilityRepository.create(data as any);
    return await facilityRepository.save(facility) as any;
  } catch (error) {
    if (error instanceof Error && error.name === "ApiError") {
      throw error;
    }
    throwApiError("创建设施失败: " + (error as Error).message, 500);
  }
}

export async function getFacilityById(id: string): Promise<Facility> {
  try {
    const facility = await facilityRepository.findOne({
      where: { id },
      relations: ["pipeline", "node", "department"],
    });
    if (!facility) {
      throwApiError("设施不存在", 404);
    }
    return facility;
  } catch (error) {
    if (error instanceof Error && error.name === "ApiError") {
      throw error;
    }
    throwApiError("获取设施失败: " + (error as Error).message, 500);
  }
}

export async function getFacilities(
  filters?: FindOptionsWhere<Facility>,
  pagination?: PaginationParams
): Promise<{ data: Facility[]; total: number; page: number; pageSize: number }> {
  try {
    const options = {
      where: filters,
      relations: ["pipeline", "node", "department"],
      order: { createdAt: "DESC" as const },
    };
    return await paginateRepository(facilityRepository, options, pagination || {});
  } catch (error) {
    throwApiError("获取设施列表失败: " + (error as Error).message, 500);
  }
}

export async function updateFacility(id: string, data: FacilityUpdateData): Promise<Facility> {
  try {
    const facility = await getFacilityById(id);

    if (data.code && data.code !== facility.code) {
      const existing = await facilityRepository.findOne({ where: { code: data.code } });
      if (existing) {
        throwApiError("设施编码已存在", 400);
      }
    }

    facilityRepository.merge(facility, data as any);
    return await facilityRepository.save(facility);
  } catch (error) {
    if (error instanceof Error && error.name === "ApiError") {
      throw error;
    }
    throwApiError("更新设施失败: " + (error as Error).message, 500);
  }
}

export async function deleteFacility(id: string): Promise<void> {
  try {
    const facility = await getFacilityById(id);
    await facilityRepository.remove(facility);
  } catch (error) {
    if (error instanceof Error && error.name === "ApiError") {
      throw error;
    }
    throwApiError("删除设施失败: " + (error as Error).message, 500);
  }
}

export async function getFacilitiesByType(
  type: FacilityType,
  pagination?: PaginationParams
): Promise<{ data: Facility[]; total: number; page: number; pageSize: number }> {
  try {
    return await getFacilities({ type }, pagination);
  } catch (error) {
    if (error instanceof Error && error.name === "ApiError") {
      throw error;
    }
    throwApiError("按类型获取设施失败: " + (error as Error).message, 500);
  }
}

export async function getFacilitiesByPipeline(
  pipelineId: string,
  pagination?: PaginationParams
): Promise<{ data: Facility[]; total: number; page: number; pageSize: number }> {
  try {
    return await getFacilities({ pipelineId }, pagination);
  } catch (error) {
    if (error instanceof Error && error.name === "ApiError") {
      throw error;
    }
    throwApiError("获取管线上的设施失败: " + (error as Error).message, 500);
  }
}

export async function getValvesForClosure(
  pipelineId?: string,
  pagination?: PaginationParams
): Promise<{ data: Facility[]; total: number; page: number; pageSize: number }> {
  try {
    const filters: FindOptionsWhere<Facility> = {
      type: FacilityType.VALVE,
      status: In([ValveStatus.OPEN, ValveStatus.PARTIAL]),
    };
    if (pipelineId) {
      filters.pipelineId = pipelineId;
    }
    return await getFacilities(filters, pagination);
  } catch (error) {
    if (error instanceof Error && error.name === "ApiError") {
      throw error;
    }
    throwApiError("获取可关闭阀门失败: " + (error as Error).message, 500);
  }
}

export async function updateValveStatus(
  id: string,
  status: ValveStatus,
  operatorId?: string
): Promise<Facility> {
  try {
    const facility = await getFacilityById(id);
    if (facility.type !== FacilityType.VALVE) {
      throwApiError("该设施不是阀门", 400);
    }

    facility.status = status;
    if (operatorId) {
      facility.attributes = {
        ...facility.attributes,
        lastOperator: operatorId,
        lastOperationTime: new Date().toISOString(),
      };
    }
    return await facilityRepository.save(facility);
  } catch (error) {
    if (error instanceof Error && error.name === "ApiError") {
      throw error;
    }
    throwApiError("更新阀门状态失败: " + (error as Error).message, 500);
  }
}

export async function getFacilityStatistics(): Promise<{
  byType: Array<{ type: string; count: number }>;
  byStatus: Array<{ status: string; count: number }>;
  total: number;
}> {
  try {
    const total = await facilityRepository.count();

    const byTypeResult = await facilityRepository
      .createQueryBuilder("facility")
      .select("facility.type", "type")
      .addSelect("COUNT(*)", "count")
      .groupBy("facility.type")
      .getRawMany();

    const byType = byTypeResult.map((item: { type: string; count: string | number }) => ({
      type: item.type,
      count: parseInt(String(item.count)),
    }));

    const byStatusResult = await facilityRepository
      .createQueryBuilder("facility")
      .select("facility.status", "status")
      .addSelect("COUNT(*)", "count")
      .where("facility.type = :type", { type: FacilityType.VALVE })
      .groupBy("facility.status")
      .getRawMany();

    const byStatus = byStatusResult.map((item: { status: string; count: string | number }) => ({
      status: item.status,
      count: parseInt(String(item.count)),
    }));

    return { byType, byStatus, total };
  } catch (error) {
    throwApiError("获取设施统计失败: " + (error as Error).message, 500);
  }
}

export async function getFacilitiesByGeometry(
  params: GeometryQueryParams,
  filters?: FindOptionsWhere<Facility>,
  pagination?: PaginationParams
): Promise<{ data: Facility[]; total: number; page: number; pageSize: number }> {
  try {
    const queryGeom = parseGeometry(params.geometry);
    if (!queryGeom) {
      throwApiError("无效的几何数据", 400);
    }

    const allFacilities = await facilityRepository.find({
      where: filters,
      relations: ["pipeline", "node", "department"],
    });

    let filteredFacilities: Facility[] = [];

    if (queryGeom.type === "Polygon" || queryGeom.type === "MultiPolygon") {
      const polygonCoords =
        queryGeom.type === "Polygon"
          ? queryGeom.coordinates
          : queryGeom.coordinates[0];

      filteredFacilities = allFacilities.filter((facility: Facility) => {
        if (!facility.geometry) return false;
        const facilityGeom = parseGeometry(facility.geometry);
        if (!facilityGeom || facilityGeom.type !== "Point") return false;
        return pointInPolygon(facilityGeom.coordinates, polygonCoords);
      });
    } else if (queryGeom.type === "Point") {
      const center = queryGeom.coordinates;
      const radius = (queryGeom as any).radius || 1000;

      filteredFacilities = allFacilities.filter((facility: Facility) => {
        if (!facility.geometry) return false;
        const facilityGeom = parseGeometry(facility.geometry);
        if (!facilityGeom || facilityGeom.type !== "Point") return false;
        const dist = calculateDistance(center, facilityGeom.coordinates);
        return dist <= radius;
      });
    } else {
      throwApiError("不支持的几何类型", 400);
    }

    const { skip, take, page, pageSize } = pagination
      ? getPaginationOptions(pagination)
      : { skip: 0, take: filteredFacilities.length, page: 1, pageSize: filteredFacilities.length };

    const paginatedData = filteredFacilities.slice(skip, skip + take);

    return {
      data: paginatedData,
      total: filteredFacilities.length,
      page,
      pageSize,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "ApiError") {
      throw error;
    }
    throwApiError("空间查询设施失败: " + (error as Error).message, 500);
  }
}

export async function checkValveAccessibility(
  valveId: string,
  targetPoint: number[],
  maxDistance: number = 500
): Promise<{ accessible: boolean; distance: number; path?: any[] }> {
  try {
    const valve = await getFacilityById(valveId);
    if (valve.type !== FacilityType.VALVE) {
      throwApiError("该设施不是阀门", 400);
    }

    const valveGeom = parseGeometry(valve.geometry);
    if (!valveGeom || valveGeom.type !== "Point") {
      throwApiError("阀门位置数据无效", 400);
    }

    const distance = calculateDistance(valveGeom.coordinates, targetPoint);
    const accessible = distance <= maxDistance;

    return {
      accessible,
      distance,
      path: [valveGeom.coordinates, targetPoint],
    };
  } catch (error) {
    if (error instanceof Error && error.name === "ApiError") {
      throw error;
    }
    throwApiError("检查阀门可达性失败: " + (error as Error).message, 500);
  }
}

export async function getMaintenanceHistory(
  facilityId: string,
  pagination?: PaginationParams
): Promise<{ data: WorkOrder[]; total: number; page: number; pageSize: number }> {
  try {
    const facility = await getFacilityById(facilityId);

    const options = {
      where: { facilityId: facility.id },
      relations: ["assignee", "createdByUser"],
      order: { createdAt: "DESC" as const },
    };

    return await paginateRepository(workOrderRepository, options, pagination || {});
  } catch (error) {
    if (error instanceof Error && error.name === "ApiError") {
      throw error;
    }
    throwApiError("获取维护历史失败: " + (error as Error).message, 500);
  }
}

function getPaginationOptions(params: PaginationParams): {
  skip: number;
  take: number;
  page: number;
  pageSize: number;
} {
  const page = Math.max(1, params.page || 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize || 20));
  const skip = (page - 1) * pageSize;
  return { skip, take: pageSize, page, pageSize };
}
