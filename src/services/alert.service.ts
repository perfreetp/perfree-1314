import { AppDataSource } from "../config/data-source";
import { Alert } from "../entities/Alert.entity";
import { Sensor } from "../entities/Sensor.entity";
import { SensorReading } from "../entities/SensorReading.entity";
import { WorkOrder } from "../entities/WorkOrder.entity";
import { AlertType, AlertSeverity, AlertStatus, SensorType, WorkOrderPriority, WorkOrderStatus, SharingLevel } from "../types/enums";
import { throwApiError } from "../utils/response";
import { PaginationParams, paginateQuery, getPaginationOptions } from "../utils/pagination";
import { ThresholdCheckResult } from "./sensor.service";
import { Not, In } from "typeorm";

export interface CreateAlertDto {
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  description?: string;
  sensorId?: string;
  pipelineId?: string;
  facilityId?: string;
  readingValue?: number;
  thresholdValue?: number;
  timestamp?: Date;
  location?: any;
  attributes?: Record<string, any>;
  sharingLevel?: SharingLevel;
}

export interface UpdateAlertDto extends Partial<CreateAlertDto> {}

export interface AlertListFilters extends PaginationParams {
  type?: AlertType;
  severity?: AlertSeverity;
  status?: AlertStatus;
  sensorId?: string;
  startTime?: Date;
  endTime?: Date;
  sharingLevel?: SharingLevel;
}

export interface AlertStatistics {
  total: number;
  active: number;
  acknowledged: number;
  resolved: number;
  byType: Array<{
    type: AlertType;
    count: number;
    active: number;
  }>;
  bySeverity: Array<{
    severity: AlertSeverity;
    count: number;
    active: number;
  }>;
  todayCount: number;
  weekCount: number;
}

export interface CreateWorkOrderFromAlertDto {
  title?: string;
  description?: string;
  priority?: WorkOrderPriority;
  assigneeId?: string;
  departmentId?: string;
  plannedStartDate?: Date;
  plannedEndDate?: Date;
}

const alertRepository = AppDataSource.getRepository(Alert);
const workOrderRepository = AppDataSource.getRepository(WorkOrder);

const sensorTypeToAlertTypeMap: Record<SensorType, { high: AlertType; low: AlertType }> = {
  [SensorType.PRESSURE]: { high: AlertType.PRESSURE_HIGH, low: AlertType.PRESSURE_LOW },
  [SensorType.LEVEL]: { high: AlertType.LEVEL_HIGH, low: AlertType.LEVEL_LOW },
  [SensorType.FLOW]: { high: AlertType.ABNORMAL_FLOW, low: AlertType.ABNORMAL_FLOW },
  [SensorType.TEMPERATURE]: { high: AlertType.TEMPERATURE_EXCEED, low: AlertType.TEMPERATURE_EXCEED },
  [SensorType.LEAK]: { high: AlertType.LEAK_DETECTED, low: AlertType.LEAK_DETECTED },
  [SensorType.GAS]: { high: AlertType.GAS_EXCEED, low: AlertType.GAS_EXCEED },
  [SensorType.VIBRATION]: { high: AlertType.OTHER, low: AlertType.OTHER },
  [SensorType.OTHER]: { high: AlertType.OTHER, low: AlertType.OTHER },
};

export async function createAlert(dto: CreateAlertDto, userId?: string): Promise<Alert> {
  const alert = alertRepository.create({
    ...dto,
    timestamp: dto.timestamp || new Date(),
    createdBy: userId,
    updatedBy: userId,
  });

  return await alertRepository.save(alert);
}

export async function getAlert(id: string): Promise<Alert> {
  const alert = await alertRepository.findOne({
    where: { id },
    relations: ["sensor", "pipeline", "facility", "workOrders"],
  });
  if (!alert) {
    throwApiError("告警不存在", 404);
  }
  return alert;
}

export async function updateAlert(
  id: string,
  dto: UpdateAlertDto,
  userId?: string
): Promise<Alert> {
  const alert = await getAlert(id);
  const updated = alertRepository.merge(alert, {
    ...dto,
    updatedBy: userId,
  });
  return await alertRepository.save(updated);
}

export async function deleteAlert(id: string): Promise<void> {
  const alert = await getAlert(id);
  await alertRepository.softDelete(alert.id);
}

export async function listAlerts(filters: AlertListFilters) {
  const { page, pageSize, ...queryFilters } = filters;

  const qb = alertRepository
    .createQueryBuilder("alert")
    .leftJoinAndSelect("alert.sensor", "sensor")
    .leftJoinAndSelect("alert.pipeline", "pipeline")
    .leftJoinAndSelect("alert.facility", "facility")
    .orderBy("alert.timestamp", "DESC");

  if (queryFilters.type) {
    qb.andWhere("alert.type = :type", { type: queryFilters.type });
  }
  if (queryFilters.severity) {
    qb.andWhere("alert.severity = :severity", { severity: queryFilters.severity });
  }
  if (queryFilters.status) {
    qb.andWhere("alert.status = :status", { status: queryFilters.status });
  }
  if (queryFilters.sensorId) {
    qb.andWhere("alert.sensorId = :sensorId", { sensorId: queryFilters.sensorId });
  }
  if (queryFilters.startTime && queryFilters.endTime) {
    qb.andWhere("alert.timestamp BETWEEN :startTime AND :endTime", {
      startTime: queryFilters.startTime,
      endTime: queryFilters.endTime,
    });
  } else if (queryFilters.startTime) {
    qb.andWhere("alert.timestamp >= :startTime", { startTime: queryFilters.startTime });
  } else if (queryFilters.endTime) {
    qb.andWhere("alert.timestamp <= :endTime", { endTime: queryFilters.endTime });
  }
  if (queryFilters.sharingLevel) {
    qb.andWhere("alert.sharingLevel = :sharingLevel", { sharingLevel: queryFilters.sharingLevel });
  }

  return await paginateQuery(qb, { page, pageSize });
}

export async function generateAlert(
  sensor: Sensor,
  reading: SensorReading,
  thresholdResult: ThresholdCheckResult
): Promise<Alert> {
  const severity = thresholdResult.severity === "critical" ? AlertSeverity.CRITICAL : AlertSeverity.WARNING;
  const typeMap = sensorTypeToAlertTypeMap[sensor.type] || sensorTypeToAlertTypeMap[SensorType.OTHER];
  const alertType = thresholdResult.thresholdType === "high" ? typeMap.high : typeMap.low;

  const direction = thresholdResult.thresholdType === "high" ? "高于" : "低于";
  const thresholdName = thresholdResult.severity === "critical" ? "临界" : "警告";
  const title = `${sensor.name || sensor.code} ${direction}${thresholdName}阈值`;
  const description = `传感器 ${sensor.name || sensor.code} (${sensor.type}) 读数为 ${reading.value}${sensor.unit || ""}，${direction}${thresholdName}阈值 ${thresholdResult.thresholdValue}${sensor.unit || ""}。`;

  const existingPendingAlert = await alertRepository.findOne({
    where: {
      sensorId: sensor.id,
      type: alertType,
      severity: severity,
      status: In([AlertStatus.PENDING, AlertStatus.ACKNOWLEDGED, AlertStatus.PROCESSING]),
    },
  });

  if (existingPendingAlert) {
    existingPendingAlert.readingValue = reading.value;
    existingPendingAlert.timestamp = new Date();
    existingPendingAlert.description = description;
    return await alertRepository.save(existingPendingAlert);
  }

  const alert = alertRepository.create({
    type: alertType,
    severity: severity,
    status: AlertStatus.PENDING,
    title,
    description,
    sensorId: sensor.id,
    pipelineId: sensor.pipelineId,
    facilityId: sensor.facilityId,
    readingValue: reading.value,
    thresholdValue: thresholdResult.thresholdValue,
    timestamp: new Date(),
    location: sensor.geometry,
    autoGenerated: true,
  });

  return await alertRepository.save(alert);
}

export async function acknowledgeAlert(id: string, userId?: string): Promise<Alert> {
  const alert = await getAlert(id);

  if (alert.status === AlertStatus.RESOLVED || alert.status === AlertStatus.CLOSED) {
    throwApiError("告警已处理，无法确认", 400);
  }

  alert.status = AlertStatus.ACKNOWLEDGED;
  alert.acknowledgedAt = new Date();
  alert.acknowledgedBy = userId;
  alert.updatedBy = userId;

  return await alertRepository.save(alert);
}

export async function resolveAlert(
  id: string,
  resolutionNotes?: string,
  userId?: string
): Promise<Alert> {
  const alert = await getAlert(id);

  if (alert.status === AlertStatus.CLOSED) {
    throwApiError("告警已关闭，无法消除", 400);
  }

  alert.status = AlertStatus.RESOLVED;
  alert.resolvedAt = new Date();
  alert.resolvedBy = userId;
  alert.resolutionNotes = resolutionNotes;
  alert.updatedBy = userId;

  return await alertRepository.save(alert);
}

export async function getActiveAlerts(filters?: PaginationParams & { severity?: AlertSeverity }) {
  const { page, pageSize, severity } = filters || {};

  const qb = alertRepository
    .createQueryBuilder("alert")
    .leftJoinAndSelect("alert.sensor", "sensor")
    .leftJoinAndSelect("alert.pipeline", "pipeline")
    .leftJoinAndSelect("alert.facility", "facility")
    .where("alert.status IN (:...statuses)", {
      statuses: [AlertStatus.PENDING, AlertStatus.ACKNOWLEDGED, AlertStatus.PROCESSING],
    })
    .orderBy(
      `CASE alert.severity 
        WHEN '${AlertSeverity.EMERGENCY}' THEN 1 
        WHEN '${AlertSeverity.CRITICAL}' THEN 2 
        WHEN '${AlertSeverity.WARNING}' THEN 3 
        ELSE 4 
      END`,
      "ASC"
    )
    .addOrderBy("alert.timestamp", "DESC");

  if (severity) {
    qb.andWhere("alert.severity = :severity", { severity });
  }

  return await paginateQuery(qb, { page, pageSize });
}

export async function getAlertStatistics(): Promise<AlertStatistics> {
  const allAlerts = await alertRepository.find();

  const activeStatuses = [AlertStatus.PENDING, AlertStatus.ACKNOWLEDGED, AlertStatus.PROCESSING];
  const active = allAlerts.filter((a) => activeStatuses.includes(a.status));
  const acknowledged = allAlerts.filter((a) => a.status === AlertStatus.ACKNOWLEDGED);
  const resolved = allAlerts.filter((a) => a.status === AlertStatus.RESOLVED || a.status === AlertStatus.CLOSED);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

  const todayCount = allAlerts.filter((a) => new Date(a.timestamp) >= today).length;
  const weekCount = allAlerts.filter((a) => new Date(a.timestamp) >= weekAgo).length;

  const byType = Object.values(AlertType).map((type) => {
    const typeAlerts = allAlerts.filter((a) => a.type === type);
    const typeActive = typeAlerts.filter((a) => activeStatuses.includes(a.status));
    return {
      type,
      count: typeAlerts.length,
      active: typeActive.length,
    };
  });

  const bySeverity = Object.values(AlertSeverity).map((severity) => {
    const severityAlerts = allAlerts.filter((a) => a.severity === severity);
    const severityActive = severityAlerts.filter((a) => activeStatuses.includes(a.status));
    return {
      severity,
      count: severityAlerts.length,
      active: severityActive.length,
    };
  });

  return {
    total: allAlerts.length,
    active: active.length,
    acknowledged: acknowledged.length,
    resolved: resolved.length,
    byType,
    bySeverity,
    todayCount,
    weekCount,
  };
}

export async function createWorkOrderFromAlert(
  alertId: string,
  dto: CreateWorkOrderFromAlertDto,
  userId: string
): Promise<WorkOrder> {
  const alert = await getAlert(alertId);

  if (!userId) {
    throwApiError("需要用户ID才能创建工单", 400);
  }

  const existingWorkOrder = await workOrderRepository.findOne({
    where: {
      alertId: alert.id,
      status: Not(In([WorkOrderStatus.CLOSED, WorkOrderStatus.COMPLETED, WorkOrderStatus.ACCEPTED])),
    },
  });

  if (existingWorkOrder) {
    throwApiError("该告警已有未完成的工单", 409);
  }

  const priorityMap: Record<AlertSeverity, WorkOrderPriority> = {
    [AlertSeverity.EMERGENCY]: WorkOrderPriority.URGENT,
    [AlertSeverity.CRITICAL]: WorkOrderPriority.HIGH,
    [AlertSeverity.WARNING]: WorkOrderPriority.MEDIUM,
    [AlertSeverity.INFO]: WorkOrderPriority.LOW,
  };

  const orderNo = `WO-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

  const workOrder = workOrderRepository.create({
    orderNo,
    title: dto.title || alert.title,
    description: dto.description || alert.description,
    status: WorkOrderStatus.CREATED,
    priority: dto.priority || priorityMap[alert.severity] || WorkOrderPriority.MEDIUM,
    workType: "告警处理",
    pipelineId: alert.pipelineId,
    facilityId: alert.facilityId,
    alertId: alert.id,
    createdBy: userId,
    assigneeId: dto.assigneeId,
    departmentId: dto.departmentId || (alert.sensor?.departmentId),
    plannedStartDate: dto.plannedStartDate,
    plannedEndDate: dto.plannedEndDate,
    location: alert.location,
    locationDescription: alert.sensor?.name || alert.sensor?.code,
  });

  const savedWorkOrder = await workOrderRepository.save(workOrder);

  alert.status = AlertStatus.PROCESSING;
  alert.updatedBy = userId;
  await alertRepository.save(alert);

  return savedWorkOrder;
}
