import { AppDataSource } from "../config/data-source";
import { SharingScope } from "../entities/SharingScope.entity";
import { User } from "../entities/User.entity";
import { Department } from "../entities/Department.entity";
import { Pipeline } from "../entities/Pipeline.entity";
import { Facility } from "../entities/Facility.entity";
import { HazardPoint } from "../entities/HazardPoint.entity";
import { WorkOrder } from "../entities/WorkOrder.entity";
import { Alert } from "../entities/Alert.entity";
import { SharingLevel, UserRole, PipelineType } from "../types/enums";
import { throwApiError } from "../utils/response";
import { PaginationParams, paginateQuery } from "../utils/pagination";
import { In, SelectQueryBuilder, ObjectLiteral } from "typeorm";

export interface CreateSharingScopeDto {
  pipelineId?: string;
  facilityId?: string;
  entityType?: string;
  entityId?: string;
  sharingLevel: SharingLevel;
  targetType?: string;
  targetId?: string;
  targetName?: string;
  allowedPipelineTypes?: PipelineType[];
  allowedArea?: any;
  canView?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  canExport?: boolean;
  allowedFields?: string[];
  deniedFields?: string[];
  validFrom?: Date;
  validTo?: Date;
  attributes?: Record<string, any>;
  remarks?: string;
}

export interface UpdateSharingScopeDto extends Partial<CreateSharingScopeDto> {
  isActive?: boolean;
}

export interface SharingScopeFilters extends PaginationParams {
  entityType?: string;
  entityId?: string;
  sharingLevel?: SharingLevel;
  targetType?: string;
  targetId?: string;
  isActive?: boolean;
}

export interface ShareToDepartmentDto {
  entityType: string;
  entityId: string;
  departmentId: string;
  permissions?: {
    canView?: boolean;
    canEdit?: boolean;
    canDelete?: boolean;
    canExport?: boolean;
  };
  allowedFields?: string[];
  deniedFields?: string[];
  validFrom?: Date;
  validTo?: Date;
}

export interface ShareToUserDto {
  entityType: string;
  entityId: string;
  userId: string;
  permissions?: {
    canView?: boolean;
    canEdit?: boolean;
    canDelete?: boolean;
    canExport?: boolean;
  };
  allowedFields?: string[];
  deniedFields?: string[];
  validFrom?: Date;
  validTo?: Date;
}

export interface CheckPermissionDto {
  userId: string;
  entityType: string;
  entityId: string;
  permission?: "view" | "edit" | "delete" | "export";
}

export interface PermissionResult {
  allowed: boolean;
  reason?: string;
  sharingLevel?: SharingLevel;
  allowedFields?: string[];
  deniedFields?: string[];
}

export interface GetAccessibleEntitiesDto {
  userId: string;
  entityType: string;
  permission?: "view" | "edit" | "delete" | "export";
  filters?: PaginationParams;
}

export interface UpdateSharingPermissionsDto {
  id: string;
  canView?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  canExport?: boolean;
  allowedFields?: string[];
  deniedFields?: string[];
}

export interface SharingStatistics {
  byEntityType: Array<{
    entityType: string;
    total: number;
    active: number;
  }>;
  bySharingLevel: Array<{
    sharingLevel: SharingLevel;
    count: number;
  }>;
  byTargetType: Array<{
    targetType: string;
    count: number;
  }>;
  totalShared: number;
  totalActive: number;
  totalExpired: number;
}

const sharingScopeRepository = AppDataSource.getRepository(SharingScope);
const userRepository = AppDataSource.getRepository(User);
const departmentRepository = AppDataSource.getRepository(Department);

const ENTITY_REPOSITORIES: Record<string, any> = {
  pipeline: AppDataSource.getRepository(Pipeline),
  facility: AppDataSource.getRepository(Facility),
  hazard: AppDataSource.getRepository(HazardPoint),
  workOrder: AppDataSource.getRepository(WorkOrder),
  alert: AppDataSource.getRepository(Alert),
};

function getEntityIdField(entityType: string): keyof SharingScope {
  const fieldMap: Record<string, keyof SharingScope> = {
    pipeline: "pipelineId",
    facility: "facilityId",
    hazard: "hazardId",
    workOrder: "workOrderId",
    alert: "alertId",
  };
  return fieldMap[entityType] || "pipelineId";
}

async function getUserWithDepartment(userId: string): Promise<User | null> {
  return await userRepository.findOne({
    where: { id: userId },
    relations: ["department"],
  });
}

async function getEntity(entityType: string, entityId: string): Promise<any> {
  const repository = ENTITY_REPOSITORIES[entityType];
  if (!repository) return null;
  return await repository.findOne({ where: { id: entityId } });
}

export async function createSharingScope(dto: CreateSharingScopeDto): Promise<SharingScope> {
  const { entityType, entityId } = dto;

  if (entityType && entityId) {
    const entity = await getEntity(entityType, entityId);
    if (!entity) {
      throwApiError(`实体不存在: ${entityType} - ${entityId}`, 404);
    }
  }

  if (dto.targetId && dto.targetType === "department") {
    const dept = await departmentRepository.findOne({ where: { id: dto.targetId } });
    if (!dept) {
      throwApiError("部门不存在", 404);
    }
    if (!dto.targetName) {
      dto.targetName = dept.name;
    }
  }

  if (dto.targetId && dto.targetType === "user") {
    const user = await userRepository.findOne({ where: { id: dto.targetId } });
    if (!user) {
      throwApiError("用户不存在", 404);
    }
    if (!dto.targetName) {
      dto.targetName = user.realName || user.username;
    }
  }

  const scopeData: any = {
    sharingLevel: dto.sharingLevel,
    targetType: dto.targetType,
    targetId: dto.targetId,
    targetName: dto.targetName,
    allowedPipelineTypes: dto.allowedPipelineTypes,
    allowedArea: dto.allowedArea,
    canView: dto.canView ?? true,
    canEdit: dto.canEdit ?? false,
    canDelete: dto.canDelete ?? false,
    canExport: dto.canExport ?? false,
    allowedFields: dto.allowedFields,
    deniedFields: dto.deniedFields,
    validFrom: dto.validFrom,
    validTo: dto.validTo,
    attributes: dto.attributes,
    remarks: dto.remarks,
  };

  if (entityType && entityId) {
    const idField = getEntityIdField(entityType);
    (scopeData as any)[idField] = entityId;
  } else if (dto.pipelineId) {
    scopeData.pipelineId = dto.pipelineId;
  } else if (dto.facilityId) {
    scopeData.facilityId = dto.facilityId;
  }

  const scope = sharingScopeRepository.create(scopeData);
  const saved = await sharingScopeRepository.save(scope);
  return Array.isArray(saved) ? saved[0] : saved;
}

export async function getSharingScope(id: string): Promise<SharingScope> {
  const scope = await sharingScopeRepository.findOne({
    where: { id },
    relations: ["pipeline", "targetDepartment"],
  });
  if (!scope) {
    throwApiError("共享范围不存在", 404);
  }
  return scope;
}

export async function updateSharingScope(
  id: string,
  dto: UpdateSharingScopeDto
): Promise<SharingScope> {
  const scope = await getSharingScope(id);

  const { entityType, entityId, ...updateData } = dto;

  if (entityType && entityId) {
    const entity = await getEntity(entityType, entityId);
    if (!entity) {
      throwApiError(`实体不存在: ${entityType} - ${entityId}`, 404);
    }
    const idField = getEntityIdField(entityType);
    (updateData as any)[idField] = entityId;
  }

  const updated = sharingScopeRepository.merge(scope, updateData);
  return await sharingScopeRepository.save(updated);
}

export async function deleteSharingScope(id: string): Promise<void> {
  const scope = await getSharingScope(id);
  await sharingScopeRepository.softDelete(scope.id);
}

export async function listSharingScopes(filters: SharingScopeFilters) {
  const { page, pageSize, ...queryFilters } = filters;
  const qb = sharingScopeRepository
    .createQueryBuilder("scope")
    .leftJoinAndSelect("scope.pipeline", "pipeline")
    .leftJoinAndSelect("scope.targetDepartment", "targetDepartment");

  if (queryFilters.entityType && queryFilters.entityId) {
    const idField = getEntityIdField(queryFilters.entityType);
    qb.andWhere(`scope.${idField} = :entityId`, { entityId: queryFilters.entityId });
  }
  if (queryFilters.sharingLevel) {
    qb.andWhere("scope.sharingLevel = :sharingLevel", { sharingLevel: queryFilters.sharingLevel });
  }
  if (queryFilters.targetType) {
    qb.andWhere("scope.targetType = :targetType", { targetType: queryFilters.targetType });
  }
  if (queryFilters.targetId) {
    qb.andWhere("scope.targetId = :targetId", { targetId: queryFilters.targetId });
  }
  if (queryFilters.isActive !== undefined) {
    qb.andWhere("scope.isActive = :isActive", { isActive: queryFilters.isActive });
  }

  qb.orderBy("scope.createdAt", "DESC");

  return await paginateQuery(qb, { page, pageSize });
}

export async function shareToDepartment(dto: ShareToDepartmentDto): Promise<SharingScope> {
  const { entityType, entityId, departmentId, permissions, allowedFields, deniedFields, validFrom, validTo } = dto;

  const dept = await departmentRepository.findOne({ where: { id: departmentId } });
  if (!dept) {
    throwApiError("部门不存在", 404);
  }

  const entity = await getEntity(entityType, entityId);
  if (!entity) {
    throwApiError(`实体不存在: ${entityType} - ${entityId}`, 404);
  }

  const existing = await sharingScopeRepository.findOne({
    where: {
      targetType: "department",
      targetId: departmentId,
      [getEntityIdField(entityType)]: entityId,
      isActive: true,
    },
  });

  if (existing) {
    return await updateSharingScope(existing.id, {
      ...permissions,
      allowedFields,
      deniedFields,
      validFrom,
      validTo,
    });
  }

  return await createSharingScope({
    entityType,
    entityId,
    sharingLevel: SharingLevel.DEPARTMENT,
    targetType: "department",
    targetId: departmentId,
    targetName: dept.name,
    ...permissions,
    allowedFields,
    deniedFields,
    validFrom,
    validTo,
  });
}

export async function shareToUser(dto: ShareToUserDto): Promise<SharingScope> {
  const { entityType, entityId, userId, permissions, allowedFields, deniedFields, validFrom, validTo } = dto;

  const user = await userRepository.findOne({ where: { id: userId } });
  if (!user) {
    throwApiError("用户不存在", 404);
  }

  const entity = await getEntity(entityType, entityId);
  if (!entity) {
    throwApiError(`实体不存在: ${entityType} - ${entityId}`, 404);
  }

  const existing = await sharingScopeRepository.findOne({
    where: {
      targetType: "user",
      targetId: userId,
      [getEntityIdField(entityType)]: entityId,
      isActive: true,
    },
  });

  if (existing) {
    return await updateSharingScope(existing.id, {
      ...permissions,
      allowedFields,
      deniedFields,
      validFrom,
      validTo,
    });
  }

  return await createSharingScope({
    entityType,
    entityId,
    sharingLevel: SharingLevel.PRIVATE,
    targetType: "user",
    targetId: userId,
    targetName: user.realName || user.username,
    ...permissions,
    allowedFields,
    deniedFields,
    validFrom,
    validTo,
  });
}

export async function revokeSharing(id: string): Promise<SharingScope> {
  return await updateSharingScope(id, { isActive: false });
}

export async function checkPermission(dto: CheckPermissionDto): Promise<PermissionResult> {
  const { userId, entityType, entityId, permission = "view" } = dto;

  if (!userId) {
    const publicScope = await sharingScopeRepository.findOne({
      where: {
        [getEntityIdField(entityType)]: entityId,
        sharingLevel: SharingLevel.PUBLIC,
        isActive: true,
      },
    });
    if (publicScope) {
      return {
        allowed: true,
        sharingLevel: SharingLevel.PUBLIC,
        allowedFields: publicScope.allowedFields,
        deniedFields: publicScope.deniedFields,
      };
    }
    return { allowed: false, reason: "需要认证" };
  }

  const user = await getUserWithDepartment(userId);
  if (!user) {
    return { allowed: false, reason: "用户不存在" };
  }

  if (user.role === UserRole.ADMIN) {
    return { allowed: true, reason: "管理员权限" };
  }

  const entity = await getEntity(entityType, entityId);
  if (!entity) {
    return { allowed: false, reason: "实体不存在" };
  }

  if (entity.createdBy === userId) {
    return { allowed: true, reason: "创建者权限" };
  }

  const entitySharingLevel = entity.sharingLevel || SharingLevel.DEPARTMENT;

  if (entitySharingLevel === SharingLevel.PUBLIC) {
    return { allowed: true, sharingLevel: SharingLevel.PUBLIC };
  }

  if (entitySharingLevel === SharingLevel.ORGANIZATION) {
    return { allowed: true, sharingLevel: SharingLevel.ORGANIZATION };
  }

  if (entitySharingLevel === SharingLevel.DEPARTMENT && user.departmentId === entity.departmentId) {
    return { allowed: true, sharingLevel: SharingLevel.DEPARTMENT };
  }

  const specificScopes = await sharingScopeRepository.find({
    where: {
      [getEntityIdField(entityType)]: entityId,
      isActive: true,
    },
  });

  const now = new Date();
  for (const scope of specificScopes) {
    if (scope.validFrom && new Date(scope.validFrom) > now) continue;
    if (scope.validTo && new Date(scope.validTo) < now) continue;

    let isTarget = false;
    if (scope.targetType === "user" && scope.targetId === userId) {
      isTarget = true;
    } else if (scope.targetType === "department" && scope.targetId === user.departmentId) {
      isTarget = true;
    }

    if (isTarget) {
      const permissionMap: Record<string, keyof SharingScope> = {
        view: "canView",
        edit: "canEdit",
        delete: "canDelete",
        export: "canExport",
      };
      const permField = permissionMap[permission];
      if (scope[permField]) {
        return {
          allowed: true,
          reason: "共享授权",
          sharingLevel: scope.sharingLevel,
          allowedFields: scope.allowedFields,
          deniedFields: scope.deniedFields,
        };
      }
    }
  }

  return { allowed: false, reason: "无访问权限" };
}

export async function getAccessibleEntities(dto: GetAccessibleEntitiesDto) {
  const { userId, entityType, permission = "view", filters } = dto;

  const user = await getUserWithDepartment(userId);
  if (!user) {
    throwApiError("用户不存在", 404);
  }

  const repository = ENTITY_REPOSITORIES[entityType];
  if (!repository) {
    throwApiError(`不支持的实体类型: ${entityType}`, 400);
  }

  if (user.role === UserRole.ADMIN) {
    return await paginateQuery(repository.createQueryBuilder("entity"), filters || {});
  }

  const qb = repository.createQueryBuilder("entity");

  const idField = getEntityIdField(entityType);
  const publicScopes = await sharingScopeRepository.find({
    where: { sharingLevel: SharingLevel.PUBLIC, isActive: true },
  });
  const publicEntityIds = publicScopes
    .filter((s) => s[idField])
    .map((s) => s[idField] as string);

  const orgScopes = await sharingScopeRepository.find({
    where: { sharingLevel: SharingLevel.ORGANIZATION, isActive: true },
  });
  const orgEntityIds = orgScopes
    .filter((s) => s[idField])
    .map((s) => s[idField] as string);

  const deptScopes = await sharingScopeRepository.find({
    where: {
      sharingLevel: SharingLevel.DEPARTMENT,
      targetType: "department",
      targetId: user.departmentId || "",
      isActive: true,
    },
  });
  const deptEntityIds = deptScopes
    .filter((s) => s[idField])
    .map((s) => s[idField] as string);

  const userScopes = await sharingScopeRepository.find({
    where: {
      targetType: "user",
      targetId: userId,
      isActive: true,
    },
  });
  const userEntityIds = userScopes
    .filter((s) => s[idField])
    .map((s) => s[idField] as string);

  const allAccessibleIds = new Set([
    ...publicEntityIds,
    ...orgEntityIds,
    ...deptEntityIds,
    ...userEntityIds,
  ]);

  qb.where((qb: SelectQueryBuilder<ObjectLiteral>) => {
    const subQb = qb
      .subQuery()
      .select("entity.id")
      .from(repository.target, "entity")
      .where("entity.sharingLevel IN (:...levels)", {
        levels: [SharingLevel.PUBLIC, SharingLevel.ORGANIZATION],
      })
      .orWhere("entity.createdBy = :userId", { userId })
      .orWhere("entity.departmentId = :deptId AND entity.sharingLevel = :deptLevel", {
        deptId: user.departmentId,
        deptLevel: SharingLevel.DEPARTMENT,
      });

    if (allAccessibleIds.size > 0) {
      subQb.orWhere("entity.id IN (:...ids)", { ids: Array.from(allAccessibleIds) });
    }

    return `entity.id IN ${subQb.getQuery()}`;
  });

  return await paginateQuery(qb, filters || {});
}

export async function getEntitySharings(
  entityType: string,
  entityId: string,
  filters?: PaginationParams
) {
  if (!entityType || !entityId) {
    throwApiError("实体类型和实体ID不能为空", 400);
  }

  const qb = sharingScopeRepository
    .createQueryBuilder("scope")
    .leftJoinAndSelect("scope.targetDepartment", "targetDepartment")
    .where(`scope.${getEntityIdField(entityType)} = :entityId`, { entityId })
    .orderBy("scope.createdAt", "DESC");

  return await paginateQuery(qb, filters || {});
}

export async function updateSharingPermissions(
  dto: UpdateSharingPermissionsDto
): Promise<SharingScope> {
  const { id, ...permissions } = dto;
  return await updateSharingScope(id, permissions);
}

export async function getSharingStatistics(): Promise<SharingStatistics> {
  const allScopes = await sharingScopeRepository.find();

  const now = new Date();
  const activeScopes = allScopes.filter(
    (s) =>
      s.isActive &&
      (!s.validFrom || new Date(s.validFrom) <= now) &&
      (!s.validTo || new Date(s.validTo) >= now)
  );
  const expiredScopes = allScopes.filter(
    (s) => s.validTo && new Date(s.validTo) < now
  );

  const entityTypeMap = new Map<string, { total: number; active: number }>();
  for (const scope of allScopes) {
    let entityType = "other";
    if (scope.pipelineId) entityType = "pipeline";
    else if (scope.facilityId) entityType = "facility";
    else if (scope.hazardId) entityType = "hazard";
    else if (scope.workOrderId) entityType = "workOrder";
    else if (scope.alertId) entityType = "alert";
    const existing = entityTypeMap.get(entityType) || { total: 0, active: 0 };
    existing.total++;
    if (activeScopes.includes(scope)) {
      existing.active++;
    }
    entityTypeMap.set(entityType, existing);
  }
  const byEntityType = Array.from(entityTypeMap.entries()).map(([entityType, stats]) => ({
    entityType,
    ...stats,
  }));

  const bySharingLevel = Object.values(SharingLevel).map((level) => ({
    sharingLevel: level,
    count: allScopes.filter((s) => s.sharingLevel === level).length,
  }));

  const targetTypeMap = new Map<string, number>();
  for (const scope of allScopes) {
    const type = scope.targetType || "global";
    targetTypeMap.set(type, (targetTypeMap.get(type) || 0) + 1);
  }
  const byTargetType = Array.from(targetTypeMap.entries()).map(([targetType, count]) => ({
    targetType,
    count,
  }));

  return {
    byEntityType,
    bySharingLevel,
    byTargetType,
    totalShared: allScopes.length,
    totalActive: activeScopes.length,
    totalExpired: expiredScopes.length,
  };
}
