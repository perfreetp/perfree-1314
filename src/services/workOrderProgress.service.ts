import { AppDataSource } from "../config/data-source";
import { WorkOrderProgress } from "../entities/WorkOrderProgress.entity";
import { WorkOrder } from "../entities/WorkOrder.entity";
import { WorkOrderStatus } from "../types/enums";
import { throwApiError } from "../utils/response";

export interface AddProgressDto {
  status?: WorkOrderStatus;
  timestamp?: Date;
  operatorId?: string;
  operatorName?: string;
  description?: string;
  progressPercentage?: number;
  photos?: string[];
  attributes?: Record<string, any>;
  remarks?: string;
}

export interface UpdateProgressDto extends Partial<AddProgressDto> {}

const progressRepository = AppDataSource.getRepository(WorkOrderProgress);
const workOrderRepository = AppDataSource.getRepository(WorkOrder);

const statusProgressMap: Record<WorkOrderStatus, number> = {
  [WorkOrderStatus.CREATED]: 0,
  [WorkOrderStatus.ASSIGNED]: 10,
  [WorkOrderStatus.IN_PROGRESS]: 30,
  [WorkOrderStatus.SUSPENDED]: 30,
  [WorkOrderStatus.COMPLETED]: 90,
  [WorkOrderStatus.ACCEPTED]: 95,
  [WorkOrderStatus.CLOSED]: 100,
};

export async function addProgress(
  workOrderId: string,
  dto: AddProgressDto,
  userId?: string
): Promise<WorkOrderProgress> {
  const workOrder = await workOrderRepository.findOne({
    where: { id: workOrderId },
  });
  if (!workOrder) {
    throwApiError("工单不存在", 404);
  }

  const status = dto.status || workOrder.status;
  const progressPercentage =
    dto.progressPercentage !== undefined
      ? dto.progressPercentage
      : statusProgressMap[status];

  if (progressPercentage < 0 || progressPercentage > 100) {
    throwApiError("进度百分比必须在 0-100 之间", 400);
  }

  const progress = progressRepository.create({
    workOrderId,
    status,
    timestamp: dto.timestamp || new Date(),
    operatorId: dto.operatorId || userId,
    operatorName: dto.operatorName,
    description: dto.description,
    progressPercentage,
    photos: dto.photos,
    attributes: dto.attributes,
    remarks: dto.remarks,
    createdBy: userId,
    updatedBy: userId,
  });

  const savedProgress = await progressRepository.save(progress);

  if (dto.status && dto.status !== workOrder.status) {
    workOrder.status = dto.status;
  }

  const currentProgress = await calculateWorkOrderProgress(workOrderId);
  if (workOrder.status === WorkOrderStatus.COMPLETED) {
    workOrder.actualEndTime = new Date();
  }

  workOrder.updatedBy = userId;
  await workOrderRepository.save(workOrder);

  return savedProgress;
}

export async function calculateWorkOrderProgress(
  workOrderId: string
): Promise<number> {
  const progressRecords = await progressRepository.find({
    where: { workOrderId },
    order: { timestamp: "DESC" },
    take: 1,
  });

  if (progressRecords.length === 0) {
    return 0;
  }

  return progressRecords[0].progressPercentage || 0;
}

export async function getWorkOrderProgress(
  workOrderId: string
): Promise<WorkOrderProgress[]> {
  const workOrder = await workOrderRepository.findOne({
    where: { id: workOrderId },
  });
  if (!workOrder) {
    throwApiError("工单不存在", 404);
  }

  return await progressRepository.find({
    where: { workOrderId },
    order: { timestamp: "ASC" },
    relations: ["operator"],
  });
}

export async function getProgress(
  progressId: string
): Promise<WorkOrderProgress> {
  const progress = await progressRepository.findOne({
    where: { id: progressId },
    relations: ["operator", "workOrder"],
  });
  if (!progress) {
    throwApiError("进度记录不存在", 404);
  }
  return progress;
}

export async function updateProgress(
  workOrderId: string,
  progressId: string,
  dto: UpdateProgressDto,
  userId?: string
): Promise<WorkOrderProgress> {
  const progress = await getProgress(progressId);

  if (progress.workOrderId !== workOrderId) {
    throwApiError("进度记录不属于该工单", 400);
  }

  const updated = progressRepository.merge(progress, {
    ...dto,
    updatedBy: userId,
  });

  const savedProgress = await progressRepository.save(updated);

  const workOrder = await workOrderRepository.findOne({
    where: { id: workOrderId },
  });
  if (workOrder && dto.status && dto.status !== workOrder.status) {
    workOrder.status = dto.status;
    if (dto.status === WorkOrderStatus.COMPLETED) {
      workOrder.actualEndTime = new Date();
    }
    workOrder.updatedBy = userId;
    await workOrderRepository.save(workOrder);
  }

  return savedProgress;
}

export async function deleteProgress(
  workOrderId: string,
  progressId: string
): Promise<void> {
  const progress = await getProgress(progressId);

  if (progress.workOrderId !== workOrderId) {
    throwApiError("进度记录不属于该工单", 400);
  }

  await progressRepository.softDelete(progressId);
}
