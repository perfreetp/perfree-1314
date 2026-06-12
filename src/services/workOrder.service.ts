import { AppDataSource } from "../config/data-source";
import { WorkOrder } from "../entities/WorkOrder.entity";
import { WorkOrderProgress } from "../entities/WorkOrderProgress.entity";
import { Alert } from "../entities/Alert.entity";
import { DefectReport } from "../entities/DefectReport.entity";
import { HazardPoint } from "../entities/HazardPoint.entity";
import {
  WorkOrderStatus,
  WorkOrderPriority,
  AlertSeverity,
  RiskLevel,
  ChangeType,
  SharingLevel,
} from "../types/enums";
import { throwApiError } from "../utils/response";
import { PaginationParams, paginateQuery } from "../utils/pagination";
import { Not, In, Between } from "typeorm";
import { addProgress } from "./workOrderProgress.service";
import * as changeHistoryService from "./changeHistory.service";

export interface CreateWorkOrderDto {
  title: string;
  description?: string;
  priority?: WorkOrderPriority;
  workType?: string;
  pipelineId?: string;
  facilityId?: string;
  alertId?: string;
  hazardId?: string;
  defectReportId?: string;
  inspectionTaskId?: string;
  assigneeId?: string;
  departmentId?: string;
  plannedStartDate?: Date;
  plannedEndDate?: Date;
  estimatedCost?: number;
  location?: any;
  locationDescription?: string;
  requiredMaterials?: Array<{ name: string; quantity: number; unit: string }>;
  requiredPersonnel?: string[];
  workContent?: string;
  attributes?: Record<string, any>;
  sharingLevel?: SharingLevel;
  remarks?: string;
}

export interface UpdateWorkOrderDto extends Partial<CreateWorkOrderDto> {
  photosBefore?: string[];
  photosAfter?: string[];
  workResult?: string;
  actualCost?: number;
}

export interface WorkOrderListFilters extends PaginationParams {
  status?: WorkOrderStatus;
  priority?: WorkOrderPriority;
  workType?: string;
  pipelineId?: string;
  facilityId?: string;
  assigneeId?: string;
  departmentId?: string;
  createdBy?: string;
  startTime?: Date;
  endTime?: Date;
  sharingLevel?: SharingLevel;
}

export interface WorkOrderStatistics {
  total: number;
  byStatus: Array<{ status: WorkOrderStatus; count: number }>;
  byPriority: Array<{ priority: WorkOrderPriority; count: number }>;
  byWorkType: Array<{ workType: string; count: number }>;
  byPipeline: Array<{ pipelineId: string; pipelineName?: string; count: number }>;
  overdue: number;
  todayCreated: number;
  todayCompleted: number;
}

export interface AssignWorkOrderDto {
  assigneeId: string;
  departmentId?: string;
  remarks?: string;
}

export interface CompleteWorkOrderDto {
  workResult?: string;
  actualCost?: number;
  photosAfter?: string[];
  remarks?: string;
}

export interface AcceptWorkOrderDto {
  acceptanceComments?: string;
  acceptedBy?: string;
  remarks?: string;
}

export interface SuspendWorkOrderDto {
  remarks?: string;
}

const workOrderRepository = AppDataSource.getRepository(WorkOrder);
const progressRepository = AppDataSource.getRepository(WorkOrderProgress);
const alertRepository = AppDataSource.getRepository(Alert);
const defectReportRepository = AppDataSource.getRepository(DefectReport);
const hazardRepository = AppDataSource.getRepository(HazardPoint);

const alertSeverityToPriorityMap: Record<AlertSeverity, WorkOrderPriority> = {
  [AlertSeverity.EMERGENCY]: WorkOrderPriority.URGENT,
  [AlertSeverity.CRITICAL]: WorkOrderPriority.HIGH,
  [AlertSeverity.WARNING]: WorkOrderPriority.MEDIUM,
  [AlertSeverity.INFO]: WorkOrderPriority.LOW,
};

const riskLevelToPriorityMap: Record<RiskLevel, WorkOrderPriority> = {
  [RiskLevel.LOW]: WorkOrderPriority.LOW,
  [RiskLevel.MEDIUM]: WorkOrderPriority.MEDIUM,
  [RiskLevel.HIGH]: WorkOrderPriority.HIGH,
  [RiskLevel.VERY_HIGH]: WorkOrderPriority.URGENT,
};

const statusTransitions: Record<WorkOrderStatus, WorkOrderStatus[]> = {
  [WorkOrderStatus.CREATED]: [WorkOrderStatus.ASSIGNED, WorkOrderStatus.CLOSED],
  [WorkOrderStatus.ASSIGNED]: [
    WorkOrderStatus.IN_PROGRESS,
    WorkOrderStatus.SUSPENDED,
    WorkOrderStatus.CLOSED,
  ],
  [WorkOrderStatus.IN_PROGRESS]: [
    WorkOrderStatus.SUSPENDED,
    WorkOrderStatus.COMPLETED,
    WorkOrderStatus.CLOSED,
  ],
  [WorkOrderStatus.SUSPENDED]: [
    WorkOrderStatus.IN_PROGRESS,
    WorkOrderStatus.CLOSED,
  ],
  [WorkOrderStatus.COMPLETED]: [
    WorkOrderStatus.ACCEPTED,
    WorkOrderStatus.IN_PROGRESS,
    WorkOrderStatus.CLOSED,
  ],
  [WorkOrderStatus.ACCEPTED]: [WorkOrderStatus.CLOSED, WorkOrderStatus.IN_PROGRESS],
  [WorkOrderStatus.CLOSED]: [],
};

export async function generateWorkOrderNo(): Promise<string> {
  const date = new Date();
  const dateStr =
    date.getFullYear().toString() +
    (date.getMonth() + 1).toString().padStart(2, "0") +
    date.getDate().toString().padStart(2, "0");
  const prefix = `WO${dateStr}`;

  const lastWorkOrder = await workOrderRepository.findOne({
    where: { orderNo: prefix },
    order: { orderNo: "DESC" },
  });

  let sequence = 1;
  if (lastWorkOrder) {
    const lastSequence = parseInt(lastWorkOrder.orderNo.slice(-6), 10);
    if (!isNaN(lastSequence)) {
      sequence = lastSequence + 1;
    }
  }

  const maxWorkOrder = await workOrderRepository
    .createQueryBuilder("workOrder")
    .where("workOrder.orderNo LIKE :prefix", { prefix: `${prefix}%` })
    .orderBy("workOrder.orderNo", "DESC")
    .getOne();

  if (maxWorkOrder) {
    const maxSequence = parseInt(maxWorkOrder.orderNo.slice(-6), 10);
    if (!isNaN(maxSequence) && maxSequence >= sequence) {
      sequence = maxSequence + 1;
    }
  }

  return `${prefix}${sequence.toString().padStart(6, "0")}`;
}

function validateStatusTransition(
  currentStatus: WorkOrderStatus,
  targetStatus: WorkOrderStatus
): boolean {
  const allowedTransitions = statusTransitions[currentStatus];
  return allowedTransitions.includes(targetStatus);
}

export async function createWorkOrder(
  dto: CreateWorkOrderDto,
  userId?: string
): Promise<WorkOrder> {
  if (!userId) {
    throwApiError("需要用户ID才能创建工单", 400);
  }

  const orderNo = await generateWorkOrderNo();

  const workOrder = workOrderRepository.create({
    ...dto,
    orderNo,
    status: WorkOrderStatus.CREATED,
    priority: dto.priority || WorkOrderPriority.MEDIUM,
    createdBy: userId,
    updatedBy: userId,
  });

  const savedWorkOrder = await workOrderRepository.save(workOrder);

  await addProgress(
    savedWorkOrder.id,
    {
      status: WorkOrderStatus.CREATED,
      description: "工单已创建",
      progressPercentage: 0,
    },
    userId
  );

  try {
    await changeHistoryService.recordChange({
      entityType: "workOrder",
      entityId: savedWorkOrder.id,
      changeType: ChangeType.CREATE,
      newEntity: savedWorkOrder,
      operatorId: userId,
      changeReason: "新建工单",
    });
  } catch {}

  return savedWorkOrder;
}

export async function getWorkOrder(id: string): Promise<WorkOrder> {
  const workOrder = await workOrderRepository.findOne({
    where: { id },
    relations: [
      "createdByUser",
      "assignee",
      "pipeline",
      "facility",
      "alert",
      "hazard",
      "defectReport",
      "inspectionTask",
      "progressRecords",
      "progressRecords.operator",
    ],
  });
  if (!workOrder) {
    throwApiError("工单不存在", 404);
  }
  return workOrder;
}

export async function updateWorkOrder(
  id: string,
  dto: UpdateWorkOrderDto,
  userId?: string
): Promise<WorkOrder> {
  const workOrder = await getWorkOrder(id);
  const oldEntity = { ...workOrder };

  if (workOrder.status === WorkOrderStatus.CLOSED) {
    throwApiError("工单已关闭，无法更新", 400);
  }

  const updated = workOrderRepository.merge(workOrder, {
    ...dto,
    updatedBy: userId,
  });

  const saved = await workOrderRepository.save(updated);

  try {
    await changeHistoryService.recordChange({
      entityType: "workOrder",
      entityId: saved.id,
      changeType: ChangeType.UPDATE,
      oldEntity,
      newEntity: saved,
      operatorId: userId,
      changeReason: "更新工单",
    });
  } catch {}

  return saved;
}

export async function deleteWorkOrder(id: string, userId?: string): Promise<void> {
  const workOrder = await getWorkOrder(id);
  const oldEntity = { ...workOrder };
  await workOrderRepository.softDelete(workOrder.id);

  try {
    await changeHistoryService.recordChange({
      entityType: "workOrder",
      entityId: id,
      changeType: ChangeType.DELETE,
      oldEntity,
      operatorId: userId,
      changeReason: "删除工单",
    });
  } catch {}
}

export async function listWorkOrders(filters: WorkOrderListFilters) {
  const { page, pageSize, ...queryFilters } = filters;

  const qb = workOrderRepository
    .createQueryBuilder("workOrder")
    .leftJoinAndSelect("workOrder.assignee", "assignee")
    .leftJoinAndSelect("workOrder.pipeline", "pipeline")
    .leftJoinAndSelect("workOrder.facility", "facility")
    .leftJoinAndSelect("workOrder.alert", "alert")
    .orderBy("workOrder.createdAt", "DESC");

  if (queryFilters.status) {
    qb.andWhere("workOrder.status = :status", { status: queryFilters.status });
  }
  if (queryFilters.priority) {
    qb.andWhere("workOrder.priority = :priority", {
      priority: queryFilters.priority,
    });
  }
  if (queryFilters.workType) {
    qb.andWhere("workOrder.workType = :workType", {
      workType: queryFilters.workType,
    });
  }
  if (queryFilters.pipelineId) {
    qb.andWhere("workOrder.pipelineId = :pipelineId", {
      pipelineId: queryFilters.pipelineId,
    });
  }
  if (queryFilters.facilityId) {
    qb.andWhere("workOrder.facilityId = :facilityId", {
      facilityId: queryFilters.facilityId,
    });
  }
  if (queryFilters.assigneeId) {
    qb.andWhere("workOrder.assigneeId = :assigneeId", {
      assigneeId: queryFilters.assigneeId,
    });
  }
  if (queryFilters.departmentId) {
    qb.andWhere("workOrder.departmentId = :departmentId", {
      departmentId: queryFilters.departmentId,
    });
  }
  if (queryFilters.createdBy) {
    qb.andWhere("workOrder.createdBy = :createdBy", {
      createdBy: queryFilters.createdBy,
    });
  }
  if (queryFilters.startTime && queryFilters.endTime) {
    qb.andWhere("workOrder.createdAt BETWEEN :startTime AND :endTime", {
      startTime: queryFilters.startTime,
      endTime: queryFilters.endTime,
    });
  } else if (queryFilters.startTime) {
    qb.andWhere("workOrder.createdAt >= :startTime", {
      startTime: queryFilters.startTime,
    });
  } else if (queryFilters.endTime) {
    qb.andWhere("workOrder.createdAt <= :endTime", {
      endTime: queryFilters.endTime,
    });
  }
  if (queryFilters.sharingLevel) {
    qb.andWhere("workOrder.sharingLevel = :sharingLevel", {
      sharingLevel: queryFilters.sharingLevel,
    });
  }

  return await paginateQuery(qb, { page, pageSize });
}

export async function assignWorkOrder(
  id: string,
  dto: AssignWorkOrderDto,
  userId?: string
): Promise<WorkOrder> {
  const workOrder = await getWorkOrder(id);

  if (
    !validateStatusTransition(workOrder.status, WorkOrderStatus.ASSIGNED) &&
    workOrder.status !== WorkOrderStatus.ASSIGNED
  ) {
    throwApiError(`当前状态 ${workOrder.status} 无法派单`, 400);
  }

  workOrder.assigneeId = dto.assigneeId;
  workOrder.departmentId = dto.departmentId || workOrder.departmentId;
  workOrder.status = WorkOrderStatus.ASSIGNED;
  workOrder.updatedBy = userId;

  const savedWorkOrder = await workOrderRepository.save(workOrder);

  await addProgress(
    id,
    {
      status: WorkOrderStatus.ASSIGNED,
      description: `工单已派单给处理人`,
      remarks: dto.remarks,
    },
    userId
  );

  return savedWorkOrder;
}

export async function startWorkOrder(
  id: string,
  userId?: string
): Promise<WorkOrder> {
  const workOrder = await getWorkOrder(id);

  if (!validateStatusTransition(workOrder.status, WorkOrderStatus.IN_PROGRESS)) {
    throwApiError(`当前状态 ${workOrder.status} 无法开始处理`, 400);
  }

  workOrder.status = WorkOrderStatus.IN_PROGRESS;
  workOrder.actualStartTime = new Date();
  workOrder.updatedBy = userId;

  const savedWorkOrder = await workOrderRepository.save(workOrder);

  await addProgress(
    id,
    {
      status: WorkOrderStatus.IN_PROGRESS,
      description: "开始处理工单",
    },
    userId
  );

  return savedWorkOrder;
}

export async function completeWorkOrder(
  id: string,
  dto: CompleteWorkOrderDto,
  userId?: string
): Promise<WorkOrder> {
  const workOrder = await getWorkOrder(id);

  if (!validateStatusTransition(workOrder.status, WorkOrderStatus.COMPLETED)) {
    throwApiError(`当前状态 ${workOrder.status} 无法完成工单`, 400);
  }

  workOrder.status = WorkOrderStatus.COMPLETED;
  workOrder.actualEndTime = new Date();
  workOrder.workResult = dto.workResult || workOrder.workResult;
  workOrder.actualCost = dto.actualCost || workOrder.actualCost;
  workOrder.photosAfter = dto.photosAfter || workOrder.photosAfter;
  workOrder.updatedBy = userId;

  const savedWorkOrder = await workOrderRepository.save(workOrder);

  await addProgress(
    id,
    {
      status: WorkOrderStatus.COMPLETED,
      description: "工单已完成，等待验收",
      remarks: dto.remarks,
    },
    userId
  );

  return savedWorkOrder;
}

export async function acceptWorkOrder(
  id: string,
  dto: AcceptWorkOrderDto,
  userId?: string
): Promise<WorkOrder> {
  const workOrder = await getWorkOrder(id);

  if (!validateStatusTransition(workOrder.status, WorkOrderStatus.ACCEPTED)) {
    throwApiError(`当前状态 ${workOrder.status} 无法验收`, 400);
  }

  workOrder.status = WorkOrderStatus.ACCEPTED;
  workOrder.acceptanceComments =
    dto.acceptanceComments || workOrder.acceptanceComments;
  workOrder.acceptedBy = dto.acceptedBy || userId;
  workOrder.acceptedAt = new Date();
  workOrder.updatedBy = userId;

  const savedWorkOrder = await workOrderRepository.save(workOrder);

  await addProgress(
    id,
    {
      status: WorkOrderStatus.ACCEPTED,
      description: "工单验收通过",
      remarks: dto.remarks,
    },
    userId
  );

  return savedWorkOrder;
}

export async function suspendWorkOrder(
  id: string,
  dto: SuspendWorkOrderDto,
  userId?: string
): Promise<WorkOrder> {
  const workOrder = await getWorkOrder(id);

  if (!validateStatusTransition(workOrder.status, WorkOrderStatus.SUSPENDED)) {
    throwApiError(`当前状态 ${workOrder.status} 无法暂停`, 400);
  }

  workOrder.status = WorkOrderStatus.SUSPENDED;
  workOrder.updatedBy = userId;

  const savedWorkOrder = await workOrderRepository.save(workOrder);

  await addProgress(
    id,
    {
      status: WorkOrderStatus.SUSPENDED,
      description: "工单已暂停",
      remarks: dto.remarks,
    },
    userId
  );

  return savedWorkOrder;
}

export async function closeWorkOrder(
  id: string,
  remarks?: string,
  userId?: string
): Promise<WorkOrder> {
  const workOrder = await getWorkOrder(id);

  if (!validateStatusTransition(workOrder.status, WorkOrderStatus.CLOSED)) {
    throwApiError(`当前状态 ${workOrder.status} 无法关闭`, 400);
  }

  workOrder.status = WorkOrderStatus.CLOSED;
  workOrder.updatedBy = userId;

  const savedWorkOrder = await workOrderRepository.save(workOrder);

  await addProgress(
    id,
    {
      status: WorkOrderStatus.CLOSED,
      description: "工单已关闭",
      remarks,
    },
    userId
  );

  return savedWorkOrder;
}

export async function getWorkOrdersByAssignee(
  assigneeId: string,
  filters?: PaginationParams & { status?: WorkOrderStatus }
) {
  const { page, pageSize, status } = filters || {};

  const qb = workOrderRepository
    .createQueryBuilder("workOrder")
    .leftJoinAndSelect("workOrder.assignee", "assignee")
    .leftJoinAndSelect("workOrder.pipeline", "pipeline")
    .leftJoinAndSelect("workOrder.facility", "facility")
    .where("workOrder.assigneeId = :assigneeId", { assigneeId })
    .orderBy(
      `CASE workOrder.priority 
        WHEN '${WorkOrderPriority.URGENT}' THEN 1 
        WHEN '${WorkOrderPriority.HIGH}' THEN 2 
        WHEN '${WorkOrderPriority.MEDIUM}' THEN 3 
        ELSE 4 
      END`,
      "ASC"
    )
    .addOrderBy("workOrder.createdAt", "DESC");

  if (status) {
    qb.andWhere("workOrder.status = :status", { status });
  }

  return await paginateQuery(qb, { page, pageSize });
}

export async function getWorkOrdersByStatus(
  status: WorkOrderStatus,
  filters?: PaginationParams & { priority?: WorkOrderPriority }
) {
  const { page, pageSize, priority } = filters || {};

  const qb = workOrderRepository
    .createQueryBuilder("workOrder")
    .leftJoinAndSelect("workOrder.assignee", "assignee")
    .leftJoinAndSelect("workOrder.pipeline", "pipeline")
    .where("workOrder.status = :status", { status })
    .orderBy("workOrder.createdAt", "DESC");

  if (priority) {
    qb.andWhere("workOrder.priority = :priority", { priority });
  }

  return await paginateQuery(qb, { page, pageSize });
}

export async function getWorkOrdersByPipeline(
  pipelineId: string,
  filters?: PaginationParams & { status?: WorkOrderStatus }
) {
  const { page, pageSize, status } = filters || {};

  const qb = workOrderRepository
    .createQueryBuilder("workOrder")
    .leftJoinAndSelect("workOrder.assignee", "assignee")
    .leftJoinAndSelect("workOrder.pipeline", "pipeline")
    .where("workOrder.pipelineId = :pipelineId", { pipelineId })
    .orderBy("workOrder.createdAt", "DESC");

  if (status) {
    qb.andWhere("workOrder.status = :status", { status });
  }

  return await paginateQuery(qb, { page, pageSize });
}

export async function getWorkOrderStatistics(): Promise<WorkOrderStatistics> {
  const allWorkOrders = await workOrderRepository.find();

  const byStatus = Object.values(WorkOrderStatus).map((status) => ({
    status,
    count: allWorkOrders.filter((w) => w.status === status).length,
  }));

  const byPriority = Object.values(WorkOrderPriority).map((priority) => ({
    priority,
    count: allWorkOrders.filter((w) => w.priority === priority).length,
  }));

  const workTypeMap = new Map<string, number>();
  allWorkOrders.forEach((w) => {
    const type = w.workType || "其他";
    workTypeMap.set(type, (workTypeMap.get(type) || 0) + 1);
  });
  const byWorkType = Array.from(workTypeMap.entries()).map(([workType, count]) => ({
    workType,
    count,
  }));

  const pipelineMap = new Map<string, number>();
  allWorkOrders.forEach((w) => {
    if (w.pipelineId) {
      pipelineMap.set(w.pipelineId, (pipelineMap.get(w.pipelineId) || 0) + 1);
    }
  });
  const byPipeline = Array.from(pipelineMap.entries()).map(([pipelineId, count]) => ({
    pipelineId,
    count,
  }));

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const todayCreated = allWorkOrders.filter(
    (w) => new Date(w.createdAt) >= today && new Date(w.createdAt) < tomorrow
  ).length;

  const todayCompleted = allWorkOrders.filter(
    (w) =>
      w.actualEndTime &&
      new Date(w.actualEndTime) >= today &&
      new Date(w.actualEndTime) < tomorrow
  ).length;

  const overdue = allWorkOrders.filter(
    (w) =>
      w.plannedEndDate &&
      new Date(w.plannedEndDate) < today &&
      w.status !== WorkOrderStatus.COMPLETED &&
      w.status !== WorkOrderStatus.ACCEPTED &&
      w.status !== WorkOrderStatus.CLOSED
  ).length;

  return {
    total: allWorkOrders.length,
    byStatus,
    byPriority,
    byWorkType,
    byPipeline,
    overdue,
    todayCreated,
    todayCompleted,
  };
}

export async function createWorkOrderFromAlert(
  alertId: string,
  dto: Partial<CreateWorkOrderDto> & { assigneeId?: string } = {},
  userId: string
): Promise<WorkOrder> {
  const alert = await alertRepository.findOne({
    where: { id: alertId },
    relations: ["sensor", "pipeline", "facility"],
  });
  if (!alert) {
    throwApiError("告警不存在", 404);
  }

  const existingWorkOrder = await workOrderRepository.findOne({
    where: {
      alertId: alert.id,
      status: Not(
        In([
          WorkOrderStatus.CLOSED,
          WorkOrderStatus.COMPLETED,
          WorkOrderStatus.ACCEPTED,
        ])
      ),
    },
  });

  if (existingWorkOrder) {
    throwApiError("该告警已有未完成的工单", 409);
  }

  const priority =
    dto.priority || alertSeverityToPriorityMap[alert.severity] || WorkOrderPriority.MEDIUM;

  const workOrderDto: CreateWorkOrderDto = {
    title: dto.title || alert.title,
    description: dto.description || alert.description,
    priority,
    workType: dto.workType || "告警处理",
    pipelineId: dto.pipelineId || alert.pipelineId,
    facilityId: dto.facilityId || alert.facilityId,
    alertId: alert.id,
    assigneeId: dto.assigneeId,
    departmentId: dto.departmentId,
    plannedStartDate: dto.plannedStartDate,
    plannedEndDate: dto.plannedEndDate,
    location: alert.location,
    locationDescription: dto.locationDescription || alert.sensor?.name,
    workContent: dto.workContent,
    attributes: dto.attributes,
    remarks: dto.remarks,
  };

  return await createWorkOrder(workOrderDto, userId);
}

export async function createWorkOrderFromDefect(
  defectReportId: string,
  dto: Partial<CreateWorkOrderDto> & { assigneeId?: string } = {},
  userId: string
): Promise<WorkOrder> {
  const defectReport = await defectReportRepository.findOne({
    where: { id: defectReportId },
    relations: ["pipeline", "facility"],
  });
  if (!defectReport) {
    throwApiError("缺陷报告不存在", 404);
  }

  const existingWorkOrder = await workOrderRepository.findOne({
    where: {
      defectReportId: defectReport.id,
      status: Not(
        In([
          WorkOrderStatus.CLOSED,
          WorkOrderStatus.COMPLETED,
          WorkOrderStatus.ACCEPTED,
        ])
      ),
    },
  });

  if (existingWorkOrder) {
    throwApiError("该缺陷已有未完成的工单", 409);
  }

  const priority =
    dto.priority ||
    riskLevelToPriorityMap[defectReport.severity] ||
    WorkOrderPriority.MEDIUM;

  const workOrderDto: CreateWorkOrderDto = {
    title: dto.title || defectReport.title,
    description: dto.description || defectReport.description,
    priority,
    workType: dto.workType || "缺陷修复",
    pipelineId: dto.pipelineId || defectReport.pipelineId,
    facilityId: dto.facilityId || defectReport.facilityId,
    defectReportId: defectReport.id,
    assigneeId: dto.assigneeId,
    departmentId: dto.departmentId,
    plannedStartDate: dto.plannedStartDate,
    plannedEndDate: dto.plannedEndDate,
    estimatedCost: dto.estimatedCost,
    location: defectReport.location,
    locationDescription: dto.locationDescription || defectReport.locationDescription,
    workContent: dto.workContent || defectReport.recommendedAction,
    attributes: dto.attributes,
    remarks: dto.remarks,
  };

  const workOrder = await createWorkOrder(workOrderDto, userId);

  defectReport.workOrderId = workOrder.id;
  await defectReportRepository.save(defectReport);

  return workOrder;
}

export async function createWorkOrderFromHazard(
  hazardId: string,
  dto: Partial<CreateWorkOrderDto> & { assigneeId?: string } = {},
  userId: string
): Promise<WorkOrder> {
  const hazard = await hazardRepository.findOne({
    where: { id: hazardId },
    relations: ["pipeline", "facility"],
  });
  if (!hazard) {
    throwApiError("隐患点不存在", 404);
  }

  const existingWorkOrder = await workOrderRepository.findOne({
    where: {
      hazardId: hazard.id,
      status: Not(
        In([
          WorkOrderStatus.CLOSED,
          WorkOrderStatus.COMPLETED,
          WorkOrderStatus.ACCEPTED,
        ])
      ),
    },
  });

  if (existingWorkOrder) {
    throwApiError("该隐患已有未完成的工单", 409);
  }

  const priority =
    dto.priority || riskLevelToPriorityMap[hazard.riskLevel] || WorkOrderPriority.MEDIUM;

  const workOrderDto: CreateWorkOrderDto = {
    title: dto.title || hazard.title,
    description: dto.description || hazard.description,
    priority,
    workType: dto.workType || "隐患整改",
    pipelineId: dto.pipelineId || hazard.pipelineId,
    facilityId: dto.facilityId || hazard.facilityId,
    hazardId: hazard.id,
    assigneeId: dto.assigneeId,
    departmentId: dto.departmentId || hazard.departmentId,
    plannedStartDate: dto.plannedStartDate,
    plannedEndDate: dto.plannedEndDate || hazard.expectedRepairDate,
    estimatedCost: dto.estimatedCost,
    location: hazard.geometry,
    locationDescription: dto.locationDescription,
    workContent: dto.workContent || hazard.recommendedAction,
    attributes: dto.attributes,
    remarks: dto.remarks,
  };

  const workOrder = await createWorkOrder(workOrderDto, userId);

  hazard.repairWorkOrderId = workOrder.id;
  await hazardRepository.save(hazard);

  return workOrder;
}
