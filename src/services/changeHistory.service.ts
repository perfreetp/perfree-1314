import { AppDataSource } from "../config/data-source";
import { ChangeHistory } from "../entities/ChangeHistory.entity";
import { User } from "../entities/User.entity";
import { Department } from "../entities/Department.entity";
import { Pipeline } from "../entities/Pipeline.entity";
import { Facility } from "../entities/Facility.entity";
import { HazardPoint } from "../entities/HazardPoint.entity";
import { WorkOrder } from "../entities/WorkOrder.entity";
import { Alert } from "../entities/Alert.entity";
import { ChangeType } from "../types/enums";
import { throwApiError } from "../utils/response";
import { PaginationParams, paginateQuery } from "../utils/pagination";

export interface RecordChangeDto {
  entityType: string;
  entityId: string;
  changeType: ChangeType;
  oldEntity?: Record<string, any>;
  newEntity?: Record<string, any>;
  operatorId?: string;
  operatorName?: string;
  changeReason?: string;
  remarks?: string;
}

export interface ChangeHistoryFilters extends PaginationParams {
  entityType?: string;
  entityId?: string;
  changeType?: ChangeType;
  operatorId?: string;
  fieldName?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface ChangeDiff {
  field: string;
  oldValue: any;
  newValue: any;
}

export interface ChangeStatistics {
  byChangeType: Array<{
    changeType: ChangeType;
    count: number;
  }>;
  byOperator: Array<{
    operatorId: string;
    operatorName: string;
    count: number;
  }>;
  byEntityType: Array<{
    entityType: string;
    count: number;
  }>;
  byTimeRange: Array<{
    date: string;
    count: number;
  }>;
  total: number;
}

export interface RestoreVersionDto {
  historyId: string;
  operatorId?: string;
}

const changeHistoryRepository = AppDataSource.getRepository(ChangeHistory);
const userRepository = AppDataSource.getRepository(User);

const ENTITY_REPOSITORIES: Record<string, any> = {
  pipeline: AppDataSource.getRepository(Pipeline),
  facility: AppDataSource.getRepository(Facility),
  hazard: AppDataSource.getRepository(HazardPoint),
  workOrder: AppDataSource.getRepository(WorkOrder),
  alert: AppDataSource.getRepository(Alert),
};

export function compareEntities(
  oldEntity: Record<string, any>,
  newEntity: Record<string, any>,
  excludeFields: string[] = ["id", "createdAt", "updatedAt", "createdBy", "updatedBy"]
): ChangeDiff[] {
  const diffs: ChangeDiff[] = [];
  const allFields = new Set([...Object.keys(oldEntity || {}), ...Object.keys(newEntity || {})]);

  for (const field of allFields) {
    if (excludeFields.includes(field)) continue;

    const oldValue = oldEntity?.[field];
    const newValue = newEntity?.[field];

    const oldStr = JSON.stringify(oldValue);
    const newStr = JSON.stringify(newValue);

    if (oldStr !== newStr) {
      diffs.push({
        field,
        oldValue,
        newValue,
      });
    }
  }

  return diffs;
}

export async function recordChange(dto: RecordChangeDto): Promise<ChangeHistory> {
  const { entityType, entityId, changeType, oldEntity, newEntity, operatorId, operatorName, changeReason, remarks } = dto;

  if (!entityType || !entityId) {
    throwApiError("实体类型和实体ID不能为空", 400);
  }

  let operatorNameToUse = operatorName;
  if (operatorId && !operatorNameToUse) {
    const operator = await userRepository.findOne({ where: { id: operatorId } });
    if (operator) {
      operatorNameToUse = operator.realName || operator.username;
    }
  }

  const diffs = compareEntities(oldEntity || {}, newEntity || {});
  const diffObject: Record<string, any> = {};
  for (const diff of diffs) {
    diffObject[diff.field] = {
      oldValue: diff.oldValue,
      newValue: diff.newValue,
    };
  }

  const history = changeHistoryRepository.create({
    entityType,
    entityId,
    changeType,
    operatorId,
    operatorName: operatorNameToUse,
    changeReason,
    remarks,
    oldValues: oldEntity,
    newValues: newEntity,
    diff: diffObject,
  });

  if (diffs.length === 1) {
    history.fieldName = diffs[0].field;
    history.oldValue = JSON.stringify(diffs[0].oldValue);
    history.newValue = JSON.stringify(diffs[0].newValue);
  }

  return await changeHistoryRepository.save(history);
}

export async function getChangeHistory(
  entityType: string,
  entityId: string,
  filters?: PaginationParams
) {
  if (!entityType || !entityId) {
    throwApiError("实体类型和实体ID不能为空", 400);
  }

  const qb = changeHistoryRepository
    .createQueryBuilder("history")
    .leftJoinAndSelect("history.operator", "operator")
    .where("history.entityType = :entityType", { entityType })
    .andWhere("history.entityId = :entityId", { entityId })
    .orderBy("history.createdAt", "DESC");

  return await paginateQuery(qb, filters || {});
}

export async function getChangeHistoryByEntity(
  entityType: string,
  filters?: ChangeHistoryFilters
) {
  if (!entityType) {
    throwApiError("实体类型不能为空", 400);
  }

  const qb = changeHistoryRepository
    .createQueryBuilder("history")
    .leftJoinAndSelect("history.operator", "operator")
    .where("history.entityType = :entityType", { entityType });

  if (filters?.changeType) {
    qb.andWhere("history.changeType = :changeType", { changeType: filters.changeType });
  }
  if (filters?.operatorId) {
    qb.andWhere("history.operatorId = :operatorId", { operatorId: filters.operatorId });
  }
  if (filters?.startDate && filters?.endDate) {
    qb.andWhere("history.createdAt BETWEEN :startDate AND :endDate", {
      startDate: filters.startDate,
      endDate: filters.endDate,
    });
  }

  qb.orderBy("history.createdAt", "DESC");

  return await paginateQuery(qb, filters || {});
}

export async function getChangeHistoryByOperator(
  operatorId: string,
  filters?: ChangeHistoryFilters
) {
  if (!operatorId) {
    throwApiError("操作人ID不能为空", 400);
  }

  const qb = changeHistoryRepository
    .createQueryBuilder("history")
    .leftJoinAndSelect("history.operator", "operator")
    .where("history.operatorId = :operatorId", { operatorId });

  if (filters?.entityType) {
    qb.andWhere("history.entityType = :entityType", { entityType: filters.entityType });
  }
  if (filters?.changeType) {
    qb.andWhere("history.changeType = :changeType", { changeType: filters.changeType });
  }
  if (filters?.startDate && filters?.endDate) {
    qb.andWhere("history.createdAt BETWEEN :startDate AND :endDate", {
      startDate: filters.startDate,
      endDate: filters.endDate,
    });
  }

  qb.orderBy("history.createdAt", "DESC");

  return await paginateQuery(qb, filters || {});
}

export async function getChangeStatistics(filters?: {
  entityType?: string;
  operatorId?: string;
  startDate?: Date;
  endDate?: Date;
  groupByDate?: "day" | "week" | "month";
}): Promise<ChangeStatistics> {
  const qb = changeHistoryRepository.createQueryBuilder("history");

  if (filters?.entityType) {
    qb.andWhere("history.entityType = :entityType", { entityType: filters.entityType });
  }
  if (filters?.operatorId) {
    qb.andWhere("history.operatorId = :operatorId", { operatorId: filters.operatorId });
  }
  if (filters?.startDate && filters?.endDate) {
    qb.andWhere("history.createdAt BETWEEN :startDate AND :endDate", {
      startDate: filters.startDate,
      endDate: filters.endDate,
    });
  }

  const allRecords = await qb.getMany();

  const byChangeType = Object.values(ChangeType).map((type) => ({
    changeType: type,
    count: allRecords.filter((r) => r.changeType === type).length,
  }));

  const operatorMap = new Map<string, { operatorId: string; operatorName: string; count: number }>();
  for (const record of allRecords) {
    if (record.operatorId) {
      const existing = operatorMap.get(record.operatorId);
      if (existing) {
        existing.count++;
      } else {
        operatorMap.set(record.operatorId, {
          operatorId: record.operatorId,
          operatorName: record.operatorName || "未知",
          count: 1,
        });
      }
    }
  }
  const byOperator = Array.from(operatorMap.values()).sort((a, b) => b.count - a.count);

  const entityTypeMap = new Map<string, number>();
  for (const record of allRecords) {
    entityTypeMap.set(record.entityType, (entityTypeMap.get(record.entityType) || 0) + 1);
  }
  const byEntityType = Array.from(entityTypeMap.entries())
    .map(([entityType, count]) => ({ entityType, count }))
    .sort((a, b) => b.count - a.count);

  const byTimeRange: Array<{ date: string; count: number }> = [];
  if (filters?.groupByDate && allRecords.length > 0) {
    const dateMap = new Map<string, number>();
    for (const record of allRecords) {
      let dateKey: string;
      const date = new Date(record.createdAt);
      switch (filters.groupByDate) {
        case "day":
          dateKey = date.toISOString().split("T")[0];
          break;
        case "week":
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          dateKey = weekStart.toISOString().split("T")[0];
          break;
        case "month":
          dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
          break;
        default:
          dateKey = date.toISOString().split("T")[0];
      }
      dateMap.set(dateKey, (dateMap.get(dateKey) || 0) + 1);
    }
    for (const [date, count] of dateMap.entries()) {
      byTimeRange.push({ date, count });
    }
    byTimeRange.sort((a, b) => a.date.localeCompare(b.date));
  }

  return {
    byChangeType,
    byOperator,
    byEntityType,
    byTimeRange,
    total: allRecords.length,
  };
}

export async function restoreVersion(historyId: string, operatorId?: string): Promise<any> {
  const history = await changeHistoryRepository.findOne({ where: { id: historyId } });
  if (!history) {
    throwApiError("历史记录不存在", 404);
  }

  if (!history.oldValues) {
    throwApiError("历史版本数据不完整，无法恢复", 400);
  }

  const repository = ENTITY_REPOSITORIES[history.entityType];
  if (!repository) {
    throwApiError(`不支持的实体类型: ${history.entityType}`, 400);
  }

  const entity = await repository.findOne({ where: { id: history.entityId } });
  if (!entity) {
    throwApiError("实体不存在，可能已被删除", 404);
  }

  const oldEntity = history.oldValues;
  const { id, createdAt, updatedAt, createdBy, ...restoredData } = oldEntity;

  const updated = repository.merge(entity, {
    ...restoredData,
    updatedBy: operatorId,
  });

  const savedEntity = await repository.save(updated);

  await recordChange({
    entityType: history.entityType,
    entityId: history.entityId,
    changeType: ChangeType.UPDATE,
    oldEntity: entity,
    newEntity: savedEntity,
    operatorId,
    changeReason: `恢复到历史版本 ${historyId}`,
  });

  return savedEntity;
}
