import { AppDataSource } from "../config/data-source";
import { DefectReport } from "../entities/DefectReport.entity";
import { WorkOrder } from "../entities/WorkOrder.entity";
import { Pipeline } from "../entities/Pipeline.entity";
import { Facility } from "../entities/Facility.entity";
import { User } from "../entities/User.entity";
import { DefectType, RiskLevel, WorkOrderPriority, WorkOrderStatus } from "../types/enums";
import { throwApiError } from "../utils/response";
import { PaginationParams, getPaginationOptions } from "../utils/pagination";
import { parseGeometry } from "../utils/spatial";

export interface SubmitDefectReportDto {
  type: DefectType;
  severity?: RiskLevel;
  title: string;
  description?: string;
  inspectionTaskId?: string;
  pipelineId?: string;
  facilityId?: string;
  location?: number[];
  locationDescription?: string;
  pipelineOffset?: number;
  defectSize?: number;
  riskScore?: number;
  discoveryDate?: Date;
  photos?: string[];
  recommendedAction?: string;
  attributes?: Record<string, any>;
  remarks?: string;
}

export interface UpdateDefectReportDto extends Partial<SubmitDefectReportDto> {
  isRepaired?: boolean;
  repairDate?: Date;
}

export interface DefectReportListFilters extends PaginationParams {
  type?: DefectType;
  severity?: RiskLevel;
  isRepaired?: boolean;
  pipelineId?: string;
  facilityId?: string;
  reporterId?: string;
  inspectorId?: string;
  workOrderId?: string;
  inspectionTaskId?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface DefectStatistics {
  total: number;
  repaired: number;
  pending: number;
  byType: Array<{ type: DefectType; count: number; repaired: number }>;
  bySeverity: Array<{ severity: RiskLevel; count: number; repaired: number }>;
  byMonth: Array<{ month: string; count: number; repaired: number }>;
}

const defectRepository = AppDataSource.getRepository(DefectReport);
const workOrderRepository = AppDataSource.getRepository(WorkOrder);
const pipelineRepository = AppDataSource.getRepository(Pipeline);
const facilityRepository = AppDataSource.getRepository(Facility);
const userRepository = AppDataSource.getRepository(User);

export async function submitDefectReport(
  dto: SubmitDefectReportDto,
  reporterId: string
): Promise<DefectReport> {
  const code = await generateDefectCode();

  const defect = defectRepository.create({
    ...dto,
    code,
    severity: dto.severity || RiskLevel.MEDIUM,
    reporterId,
    discoveryDate: dto.discoveryDate || new Date(),
    isRepaired: false,
    location: dto.location
      ? {
          type: "Point",
          coordinates: dto.location,
          srid: 4326,
        }
      : null,
    createdBy: reporterId,
  });

  if (dto.riskScore === undefined) {
    defect.riskScore = calculateRiskScore(dto);
  }

  return await defectRepository.save(defect);
}

function calculateRiskScore(dto: SubmitDefectReportDto): number {
  let score = 0;

  const severityScores: Record<RiskLevel, number> = {
    [RiskLevel.LOW]: 20,
    [RiskLevel.MEDIUM]: 40,
    [RiskLevel.HIGH]: 70,
    [RiskLevel.VERY_HIGH]: 95,
  };
  score += severityScores[dto.severity || RiskLevel.MEDIUM];

  const typeScores: Record<DefectType, number> = {
    [DefectType.CRACK]: 15,
    [DefectType.CORROSION]: 10,
    [DefectType.LEAK]: 20,
    [DefectType.DEFORMATION]: 12,
    [DefectType.BLOCKAGE]: 8,
    [DefectType.MANHOLE_DAMAGE]: 10,
    [DefectType.VALVE_FAULT]: 15,
    [DefectType.OTHER]: 10,
  };
  score += typeScores[dto.type] || 10;

  if (dto.defectSize) {
    const sizeScore = Math.min(dto.defectSize / 10, 15);
    score += sizeScore;
  }

  return Math.min(Math.round(score), 100);
}

export async function getDefectReport(id: string): Promise<DefectReport> {
  const defect = await defectRepository.findOne({
    where: { id },
    relations: [
      "inspectionTask",
      "reporter",
      "pipeline",
      "facility",
      "workOrders",
    ],
  });

  if (!defect) {
    throwApiError("缺陷报告不存在", 404);
  }

  return defect;
}

export async function updateDefectReport(
  id: string,
  dto: UpdateDefectReportDto,
  userId?: string
): Promise<DefectReport> {
  const defect = await getDefectReport(id);

  let location = defect.location;
  if (dto.location) {
    location = {
      type: "Point",
      coordinates: dto.location,
      srid: 4326,
    };
  }

  const updated = defectRepository.merge(defect, {
    ...dto,
    location,
    updatedBy: userId,
  });

  if (dto.severity || dto.type || dto.defectSize) {
    updated.riskScore = calculateRiskScore({
      ...dto,
      type: dto.type || defect.type,
      severity: dto.severity || defect.severity,
      title: defect.title,
    });
  }

  return await defectRepository.save(updated);
}

export async function deleteDefectReport(id: string): Promise<void> {
  const defect = await getDefectReport(id);
  await defectRepository.softDelete(defect.id);
}

export async function getDefectReports(filters: DefectReportListFilters) {
  const { page, pageSize, ...queryFilters } = filters;
  const { skip, take, page: currentPage, pageSize: size } = getPaginationOptions({ page, pageSize });

  const qb = defectRepository
    .createQueryBuilder("defect")
    .leftJoinAndSelect("defect.reporter", "reporter")
    .leftJoinAndSelect("defect.pipeline", "pipeline")
    .leftJoinAndSelect("defect.facility", "facility")
    .leftJoinAndSelect("defect.inspectionTask", "inspectionTask");

  if (queryFilters.type) {
    qb.andWhere("defect.type = :type", { type: queryFilters.type });
  }
  if (queryFilters.severity) {
    qb.andWhere("defect.severity = :severity", { severity: queryFilters.severity });
  }
  if (queryFilters.isRepaired !== undefined) {
    qb.andWhere("defect.isRepaired = :isRepaired", { isRepaired: queryFilters.isRepaired });
  }
  if (queryFilters.pipelineId) {
    qb.andWhere("defect.pipelineId = :pipelineId", { pipelineId: queryFilters.pipelineId });
  }
  if (queryFilters.facilityId) {
    qb.andWhere("defect.facilityId = :facilityId", { facilityId: queryFilters.facilityId });
  }
  if (queryFilters.reporterId) {
    qb.andWhere("defect.reporterId = :reporterId", { reporterId: queryFilters.reporterId });
  }
  if (queryFilters.inspectorId) {
    qb.innerJoin("defect.inspectionTask", "task").andWhere("task.inspectorId = :inspectorId", {
      inspectorId: queryFilters.inspectorId,
    });
  }
  if (queryFilters.workOrderId) {
    qb.andWhere("defect.workOrderId = :workOrderId", { workOrderId: queryFilters.workOrderId });
  }
  if (queryFilters.inspectionTaskId) {
    qb.andWhere("defect.inspectionTaskId = :inspectionTaskId", {
      inspectionTaskId: queryFilters.inspectionTaskId,
    });
  }
  if (queryFilters.startDate) {
    qb.andWhere("defect.discoveryDate >= :startDate", { startDate: queryFilters.startDate });
  }
  if (queryFilters.endDate) {
    qb.andWhere("defect.discoveryDate <= :endDate", { endDate: queryFilters.endDate });
  }

  qb.orderBy("defect.createdAt", "DESC");

  const [data, total] = await qb.skip(skip).take(take).getManyAndCount();

  return {
    data,
    total,
    page: currentPage,
    pageSize: size,
  };
}

export async function getDefectsByPipeline(
  pipelineId: string,
  filters?: DefectReportListFilters
) {
  return getDefectReports({
    ...filters,
    pipelineId,
  });
}

export async function getDefectsByInspector(
  inspectorId: string,
  filters?: DefectReportListFilters
) {
  return getDefectReports({
    ...filters,
    inspectorId,
  });
}

export async function linkDefectToWorkOrder(
  defectId: string,
  workOrderId: string,
  userId?: string
): Promise<DefectReport> {
  const defect = await getDefectReport(defectId);
  const workOrder = await workOrderRepository.findOne({ where: { id: workOrderId } });

  if (!workOrder) {
    throwApiError("工单不存在", 404);
  }

  defect.workOrderId = workOrderId;
  defect.updatedBy = userId as string;

  return await defectRepository.save(defect);
}

export async function updateDefectRepairStatus(
  id: string,
  dto: {
    isRepaired: boolean;
    repairDate?: Date;
    remarks?: string;
  },
  userId?: string
): Promise<DefectReport> {
  const defect = await getDefectReport(id);

  defect.isRepaired = dto.isRepaired;
  defect.repairDate = (dto.repairDate || (dto.isRepaired ? new Date() : null)) as Date;
  defect.remarks = dto.remarks || defect.remarks;
  defect.updatedBy = userId as string;

  return await defectRepository.save(defect);
}

export async function getDefectStatistics(filters?: {
  startDate?: Date;
  endDate?: Date;
  pipelineId?: string;
  departmentId?: string;
}): Promise<DefectStatistics> {
  const qb = defectRepository.createQueryBuilder("defect");

  if (filters?.startDate) {
    qb.where("defect.discoveryDate >= :startDate", { startDate: filters.startDate });
  }
  if (filters?.endDate) {
    qb.andWhere("defect.discoveryDate <= :endDate", { endDate: filters.endDate });
  }
  if (filters?.pipelineId) {
    qb.andWhere("defect.pipelineId = :pipelineId", { pipelineId: filters.pipelineId });
  }
  if (filters?.departmentId) {
    qb.innerJoin("defect.pipeline", "pipeline").andWhere(
      "pipeline.departmentId = :departmentId",
      { departmentId: filters.departmentId }
    );
  }

  const allDefects = await qb.getMany();

  const total = allDefects.length;
  const repaired = allDefects.filter((d) => d.isRepaired).length;
  const pending = total - repaired;

  const byType = Object.values(DefectType).map((type) => {
    const filtered = allDefects.filter((d) => d.type === type);
    return {
      type,
      count: filtered.length,
      repaired: filtered.filter((d) => d.isRepaired).length,
    };
  });

  const bySeverity = Object.values(RiskLevel).map((severity) => {
    const filtered = allDefects.filter((d) => d.severity === severity);
    return {
      severity,
      count: filtered.length,
      repaired: filtered.filter((d) => d.isRepaired).length,
    };
  });

  const byMonth = calculateMonthlyStats(allDefects);

  return {
    total,
    repaired,
    pending,
    byType,
    bySeverity,
    byMonth,
  };
}

function calculateMonthlyStats(
  defects: DefectReport[]
): Array<{ month: string; count: number; repaired: number }> {
  const monthMap = new Map<
    string,
    { count: number; repaired: number }
  >();

  for (const defect of defects) {
    const date = defect.discoveryDate || defect.createdAt;
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

    const current = monthMap.get(monthKey) || { count: 0, repaired: 0 };
    current.count++;
    if (defect.isRepaired) {
      current.repaired++;
    }
    monthMap.set(monthKey, current);
  }

  const result: Array<{ month: string; count: number; repaired: number }> = [];
  const sortedKeys = Array.from(monthMap.keys()).sort();

  for (const key of sortedKeys) {
    const value = monthMap.get(key)!;
    result.push({
      month: key,
      count: value.count,
      repaired: value.repaired,
    });
  }

  return result;
}

async function generateDefectCode(): Promise<string> {
  const date = new Date();
  const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;

  const latest = await defectRepository
    .createQueryBuilder("defect")
    .where("defect.code LIKE :prefix", { prefix: `DR-${dateStr}%` })
    .orderBy("defect.code", "DESC")
    .limit(1)
    .getOne();

  let sequence = 1;
  if (latest) {
    const match = latest.code.match(/-(\d{4})$/);
    if (match) {
      sequence = parseInt(match[1]) + 1;
    }
  }

  return `DR-${dateStr}-${String(sequence).padStart(4, "0")}`;
}
