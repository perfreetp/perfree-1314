import { AppDataSource } from "../config/data-source";
import { InspectionRoute } from "../entities/InspectionRoute.entity";
import { InspectionTask } from "../entities/InspectionTask.entity";
import { Pipeline } from "../entities/Pipeline.entity";
import { Facility } from "../entities/Facility.entity";
import { PipelineNode } from "../entities/PipelineNode.entity";
import { DefectReport } from "../entities/DefectReport.entity";
import {
  InspectionType,
  InspectionStatus,
  PipelineType,
  FacilityType,
  RiskLevel,
} from "../types/enums";
import { throwApiError } from "../utils/response";
import { PaginationParams, getPaginationOptions } from "../utils/pagination";
import { parseGeometry, calculateDistance, createLineString } from "../utils/spatial";

export interface GenerateInspectionRouteDto {
  name: string;
  description?: string;
  type?: InspectionType;
  departmentId: string;
  targetPipelineTypes?: PipelineType[];
  plannedDate?: Date;
  checkPoints?: Array<{
    id: string;
    name: string;
    type: string;
    geometry: any;
    pipelineId?: string;
    facilityId?: string;
    requiredChecks: string[];
  }>;
  area?: any;
  assignedInspectorId?: string;
  remarks?: string;
}

export interface CreateInspectionTaskDto {
  routeId?: string;
  name: string;
  inspectorId?: string;
  pipelineId?: string;
  facilityId?: string;
  plannedDate?: Date;
  location?: number[];
  locationDescription?: string;
  requiredChecks?: string[];
  remarks?: string;
}

export interface UpdateInspectionTaskDto extends Partial<CreateInspectionTaskDto> {
  status?: InspectionStatus;
}

export interface InspectionRouteListFilters extends PaginationParams {
  type?: InspectionType;
  status?: InspectionStatus;
  departmentId?: string;
  assignedInspectorId?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface InspectionTaskListFilters extends PaginationParams {
  routeId?: string;
  status?: InspectionStatus;
  inspectorId?: string;
  pipelineId?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface InspectionStatistics {
  totalRoutes: number;
  completedRoutes: number;
  totalTasks: number;
  completedTasks: number;
  completionRate: number;
  totalDefects: number;
  byStatus: Array<{ status: InspectionStatus; count: number }>;
  byType: Array<{ type: InspectionType; count: number }>;
  bySeverity: Array<{ severity: RiskLevel; count: number }>;
}

interface CheckPointWithCoords {
  id: string;
  name: string;
  type: string;
  geometry: any;
  pipelineId?: string;
  facilityId?: string;
  requiredChecks: string[];
  coordinates: number[];
}

const routeRepository = AppDataSource.getRepository(InspectionRoute);
const taskRepository = AppDataSource.getRepository(InspectionTask);
const pipelineRepository = AppDataSource.getRepository(Pipeline);
const facilityRepository = AppDataSource.getRepository(Facility);
const defectRepository = AppDataSource.getRepository(DefectReport);
const nodeRepository = AppDataSource.getRepository(PipelineNode);

export async function generateInspectionRoute(
  dto: GenerateInspectionRouteDto,
  userId?: string
): Promise<InspectionRoute> {
  let checkPoints: CheckPointWithCoords[] = [];

  if (dto.checkPoints && dto.checkPoints.length > 0) {
    checkPoints = dto.checkPoints.map((cp) => {
      const geom = parseGeometry(cp.geometry);
      return {
        ...cp,
        coordinates: geom?.coordinates || [0, 0],
      };
    });
  } else if (dto.area) {
    checkPoints = await generateCheckPointsFromArea(
      dto.area,
      dto.targetPipelineTypes,
      dto.departmentId
    );
  }

  if (checkPoints.length === 0) {
    throwApiError("未找到巡检点", 400);
  }

  const optimizedPoints = optimizeRouteWithTSP(checkPoints);

  const routeCoords = optimizedPoints.map((cp) => cp.coordinates);
  const routeGeometry = createLineString(routeCoords);
  const estimatedDistance = calculateTotalDistance(routeCoords);
  const estimatedDuration = estimateDuration(estimatedDistance, optimizedPoints.length);

  const code = await generateRouteCode();

  const route = routeRepository.create({
    code,
    name: dto.name,
    description: dto.description,
    type: dto.type || InspectionType.ROUTINE,
    status: InspectionStatus.PENDING,
    targetPipelineTypes: dto.targetPipelineTypes,
    departmentId: dto.departmentId,
    createdBy: userId,
    assignedInspectorId: dto.assignedInspectorId,
    plannedDate: dto.plannedDate,
    estimatedDistance,
    estimatedDuration,
    estimatedPointsCount: optimizedPoints.length,
    routeGeometry,
    area: dto.area,
    checkPoints: optimizedPoints.map((cp, index) => ({
      id: cp.id,
      name: cp.name,
      type: cp.type,
      geometry: cp.geometry,
      pipelineId: cp.pipelineId,
      facilityId: cp.facilityId,
      requiredChecks: cp.requiredChecks,
      order: index + 1,
    })),
    remarks: dto.remarks,
  });

  return await routeRepository.save(route);
}

async function generateCheckPointsFromArea(
  area: any,
  pipelineTypes?: PipelineType[],
  departmentId?: string
): Promise<CheckPointWithCoords[]> {
  const points: CheckPointWithCoords[] = [];
  const areaGeom = parseGeometry(area);

  if (areaGeom) {
    const pipelines = await getPipelinesInArea(areaGeom, pipelineTypes, departmentId);

    for (const pipeline of pipelines) {
      const geom = parseGeometry(pipeline.geometry);
      if (!geom?.coordinates) continue;

      const midIndex = Math.floor(geom.coordinates.length / 2);
      points.push({
        id: `pipeline-${pipeline.id}`,
        name: pipeline.name || pipeline.code,
        type: "pipeline",
        geometry: pipeline.geometry,
        pipelineId: pipeline.id,
        requiredChecks: ["外观检查", "泄漏检查", "腐蚀检查"],
        coordinates: geom.coordinates[midIndex],
      });
    }

    const facilities = await getFacilitiesInArea(areaGeom, departmentId);
    for (const facility of facilities) {
      const geom = parseGeometry(facility.geometry);
      points.push({
        id: `facility-${facility.id}`,
        name: facility.name || facility.code,
        type: facility.type,
        geometry: facility.geometry,
        facilityId: facility.id,
        requiredChecks: getChecksForFacilityType(facility.type),
        coordinates: geom?.coordinates || [0, 0],
      });
    }

    const nodes = await getNodesInArea(areaGeom, departmentId);
    for (const node of nodes) {
      const geom = parseGeometry(node.geometry);
      points.push({
        id: `node-${node.id}`,
        name: node.name || node.code,
        type: node.type,
        geometry: node.geometry,
        requiredChecks: ["井盖检查", "结构检查"],
        coordinates: geom?.coordinates || [0, 0],
      });
    }
  }

  return points;
}

async function getPipelinesInArea(
  areaGeom: any,
  pipelineTypes?: PipelineType[],
  departmentId?: string
): Promise<Pipeline[]> {
  const geomJson = JSON.stringify(areaGeom);
  const qb = pipelineRepository
    .createQueryBuilder("pipeline")
    .where("ST_Intersects(pipeline.geometry, ST_SetSRID(ST_GeomFromGeoJSON(:geom), 4326))", {
      geom: geomJson,
    });

  if (pipelineTypes && pipelineTypes.length > 0) {
    qb.andWhere("pipeline.type IN (:...types)", { types: pipelineTypes });
  }

  if (departmentId) {
    qb.andWhere("pipeline.departmentId = :departmentId", { departmentId });
  }

  return await qb.getMany();
}

async function getFacilitiesInArea(areaGeom: any, departmentId?: string): Promise<Facility[]> {
  const geomJson = JSON.stringify(areaGeom);
  const qb = facilityRepository
    .createQueryBuilder("facility")
    .where("ST_Intersects(facility.geometry, ST_SetSRID(ST_GeomFromGeoJSON(:geom), 4326))", {
      geom: geomJson,
    });

  if (departmentId) {
    qb.andWhere("facility.departmentId = :departmentId", { departmentId });
  }

  return await qb.getMany();
}

async function getNodesInArea(areaGeom: any, departmentId?: string): Promise<PipelineNode[]> {
  const geomJson = JSON.stringify(areaGeom);
  const qb = nodeRepository
    .createQueryBuilder("node")
    .where("ST_Intersects(node.geometry, ST_SetSRID(ST_GeomFromGeoJSON(:geom), 4326))", {
      geom: geomJson,
    });

  if (departmentId) {
    qb.andWhere("node.departmentId = :departmentId", { departmentId });
  }

  return await qb.getMany();
}

function getChecksForFacilityType(type: FacilityType): string[] {
  const checks: Record<FacilityType, string[]> = {
    [FacilityType.MANHOLE]: ["井盖检查", "井内检查", "结构检查"],
    [FacilityType.VALVE]: ["阀门状态", "泄漏检查", "操作测试"],
    [FacilityType.FIRE_HYDRANT]: ["外观检查", "水压测试", "阀门操作"],
    [FacilityType.PUMP]: ["运行状态", "噪音检查", "泄漏检查"],
    [FacilityType.METER]: ["读数检查", "运行状态", "校验检查"],
    [FacilityType.OTHER]: ["外观检查", "状态检查"],
  };
  return checks[type] || checks[FacilityType.OTHER];
}

export function optimizeRouteWithTSP(points: CheckPointWithCoords[]): CheckPointWithCoords[] {
  if (points.length <= 2) {
    return points;
  }

  const n = points.length;
  const distanceMatrix: number[][] = [];
  for (let i = 0; i < n; i++) {
    distanceMatrix[i] = [];
    for (let j = 0; j < n; j++) {
      if (i === j) {
        distanceMatrix[i][j] = 0;
      } else {
        distanceMatrix[i][j] = calculateDistance(
          points[i].coordinates,
          points[j].coordinates
        );
      }
    }
  }

  return nearestNeighborTSP(points, distanceMatrix);
}

function nearestNeighborTSP(
  points: CheckPointWithCoords[],
  distanceMatrix: number[][]
): CheckPointWithCoords[] {
  const n = points.length;
  const visited = new Set<number>();
  const result: CheckPointWithCoords[] = [];
  let current = 0;

  result.push(points[current]);
  visited.add(current);

  while (visited.size < n) {
    let nearest = -1;
    let minDist = Infinity;

    for (let i = 0; i < n; i++) {
      if (!visited.has(i) && distanceMatrix[current][i] < minDist) {
        minDist = distanceMatrix[current][i];
        nearest = i;
      }
    }

    if (nearest >= 0) {
      current = nearest;
      result.push(points[current]);
      visited.add(current);
    } else {
      break;
    }
  }

  return twoOpt(result, distanceMatrix);
}

function twoOpt(
  route: CheckPointWithCoords[],
  distanceMatrix: number[][]
): CheckPointWithCoords[] {
  const n = route.length;
  if (n < 4) return route;

  let improved = true;
  let bestDistance = calculateRouteDistance(route, distanceMatrix);

  while (improved) {
    improved = false;

    for (let i = 0; i < n - 1; i++) {
      for (let j = i + 2; j < n; j++) {
        const newRoute = twoOptSwap(route, i, j);
        const newDistance = calculateRouteDistance(newRoute, distanceMatrix);

        if (newDistance < bestDistance - 0.001) {
          route = newRoute;
          bestDistance = newDistance;
          improved = true;
        }
      }
    }
  }

  return route;
}

function twoOptSwap(
  route: CheckPointWithCoords[],
  i: number,
  j: number
): CheckPointWithCoords[] {
  const newRoute = [...route];
  const segment = newRoute.slice(i + 1, j + 1).reverse();
  newRoute.splice(i + 1, j - i, ...segment);
  return newRoute;
}

function calculateRouteDistance(
  route: CheckPointWithCoords[],
  distanceMatrix: number[][]
): number {
  let total = 0;
  for (let i = 0; i < route.length - 1; i++) {
    const idx1 = route[i] ? i : 0;
    const idx2 = route[i + 1] ? i + 1 : 0;
    total += distanceMatrix[idx1][idx2];
  }
  return total;
}

function calculateTotalDistance(coords: number[][]): number {
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    total += calculateDistance(coords[i - 1], coords[i]);
  }
  return Math.round(total * 100) / 100;
}

function estimateDuration(distance: number, pointsCount: number): number {
  const walkingSpeed = 80;
  const timePerPoint = 10;
  const walkingTime = (distance / walkingSpeed) * 60;
  const inspectionTime = pointsCount * timePerPoint;
  return Math.round((walkingTime + inspectionTime) * 100) / 100;
}

async function generateRouteCode(): Promise<string> {
  const date = new Date();
  const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;

  const latest = await routeRepository
    .createQueryBuilder("route")
    .where("route.code LIKE :prefix", { prefix: `IR-${dateStr}%` })
    .orderBy("route.code", "DESC")
    .limit(1)
    .getOne();

  let sequence = 1;
  if (latest) {
    const match = latest.code.match(/-(\d{4})$/);
    if (match) {
      sequence = parseInt(match[1]) + 1;
    }
  }

  return `IR-${dateStr}-${String(sequence).padStart(4, "0")}`;
}

export async function getInspectionRoute(id: string): Promise<InspectionRoute> {
  const route = await routeRepository.findOne({
    where: { id },
    relations: ["department", "creator", "assignedInspector", "tasks"],
  });

  if (!route) {
    throwApiError("巡检路线不存在", 404);
  }

  return route;
}

export async function updateInspectionRoute(
  id: string,
  dto: Partial<GenerateInspectionRouteDto>,
  userId?: string
): Promise<InspectionRoute> {
  const route = await getInspectionRoute(id);

  if (dto.checkPoints && dto.checkPoints.length > 0) {
    const checkPointsWithCoords = dto.checkPoints.map((cp) => {
      const geom = parseGeometry(cp.geometry);
      return {
        ...cp,
        coordinates: geom?.coordinates || [0, 0],
      };
    });

    const optimizedPoints = optimizeRouteWithTSP(checkPointsWithCoords);
    const routeCoords = optimizedPoints.map((cp) => cp.coordinates);

    route.routeGeometry = createLineString(routeCoords);
    route.estimatedDistance = calculateTotalDistance(routeCoords);
    route.estimatedDuration = estimateDuration(route.estimatedDistance, optimizedPoints.length);
    route.estimatedPointsCount = optimizedPoints.length;
    route.checkPoints = optimizedPoints.map((cp, index) => ({
      id: cp.id,
      name: cp.name,
      type: cp.type,
      geometry: cp.geometry,
      pipelineId: cp.pipelineId,
      facilityId: cp.facilityId,
      requiredChecks: cp.requiredChecks,
      order: index + 1,
    }));
  }

  const updated = routeRepository.merge(route, {
    ...dto,
    updatedBy: userId,
  });

  return await routeRepository.save(updated);
}

export async function deleteInspectionRoute(id: string): Promise<void> {
  const route = await getInspectionRoute(id);
  await routeRepository.softDelete(route.id);
}

export async function getInspectionRoutes(filters: InspectionRouteListFilters) {
  const { page, pageSize, ...queryFilters } = filters;
  const { skip, take, page: currentPage, pageSize: size } = getPaginationOptions({ page, pageSize });

  const qb = routeRepository
    .createQueryBuilder("route")
    .leftJoinAndSelect("route.department", "department")
    .leftJoinAndSelect("route.assignedInspector", "assignedInspector");

  if (queryFilters.type) {
    qb.andWhere("route.type = :type", { type: queryFilters.type });
  }
  if (queryFilters.status) {
    qb.andWhere("route.status = :status", { status: queryFilters.status });
  }
  if (queryFilters.departmentId) {
    qb.andWhere("route.departmentId = :departmentId", { departmentId: queryFilters.departmentId });
  }
  if (queryFilters.assignedInspectorId) {
    qb.andWhere("route.assignedInspectorId = :assignedInspectorId", {
      assignedInspectorId: queryFilters.assignedInspectorId,
    });
  }
  if (queryFilters.startDate) {
    qb.andWhere("route.plannedDate >= :startDate", { startDate: queryFilters.startDate });
  }
  if (queryFilters.endDate) {
    qb.andWhere("route.plannedDate <= :endDate", { endDate: queryFilters.endDate });
  }

  qb.orderBy("route.createdAt", "DESC");

  const [data, total] = await qb.skip(skip).take(take).getManyAndCount();

  return {
    data,
    total,
    page: currentPage,
    pageSize: size,
  };
}

export async function createInspectionTask(
  dto: CreateInspectionTaskDto,
  userId?: string
): Promise<InspectionTask> {
  const code = await generateTaskCode();

  const task = taskRepository.create({
    ...dto,
    code,
    status: InspectionStatus.PENDING,
    location: dto.location
      ? {
          type: "Point",
          coordinates: dto.location,
          srid: 4326,
        }
      : null,
    createdBy: userId,
  });

  return await taskRepository.save(task);
}

export async function getInspectionTask(id: string): Promise<InspectionTask> {
  const task = await taskRepository.findOne({
    where: { id },
    relations: ["route", "inspector", "pipeline", "facility", "defectReports"],
  });

  if (!task) {
    throwApiError("巡检任务不存在", 404);
  }

  return task;
}

export async function updateInspectionTask(
  id: string,
  dto: UpdateInspectionTaskDto,
  userId?: string
): Promise<InspectionTask> {
  const task = await getInspectionTask(id);

  let location = task.location;
  if (dto.location) {
    location = {
      type: "Point",
      coordinates: dto.location,
      srid: 4326,
    };
  }

  const updated = taskRepository.merge(task, {
    ...dto,
    location,
    updatedBy: userId,
  });

  return await taskRepository.save(updated);
}

export async function deleteInspectionTask(id: string): Promise<void> {
  const task = await getInspectionTask(id);
  await taskRepository.softDelete(task.id);
}

export async function getInspectionTasks(filters: InspectionTaskListFilters) {
  const { page, pageSize, ...queryFilters } = filters;
  const { skip, take, page: currentPage, pageSize: size } = getPaginationOptions({ page, pageSize });

  const qb = taskRepository
    .createQueryBuilder("task")
    .leftJoinAndSelect("task.route", "route")
    .leftJoinAndSelect("task.inspector", "inspector")
    .leftJoinAndSelect("task.pipeline", "pipeline");

  if (queryFilters.routeId) {
    qb.andWhere("task.routeId = :routeId", { routeId: queryFilters.routeId });
  }
  if (queryFilters.status) {
    qb.andWhere("task.status = :status", { status: queryFilters.status });
  }
  if (queryFilters.inspectorId) {
    qb.andWhere("task.inspectorId = :inspectorId", { inspectorId: queryFilters.inspectorId });
  }
  if (queryFilters.pipelineId) {
    qb.andWhere("task.pipelineId = :pipelineId", { pipelineId: queryFilters.pipelineId });
  }
  if (queryFilters.startDate) {
    qb.andWhere("task.plannedDate >= :startDate", { startDate: queryFilters.startDate });
  }
  if (queryFilters.endDate) {
    qb.andWhere("task.plannedDate <= :endDate", { endDate: queryFilters.endDate });
  }

  qb.orderBy("task.createdAt", "DESC");

  const [data, total] = await qb.skip(skip).take(take).getManyAndCount();

  return {
    data,
    total,
    page: currentPage,
    pageSize: size,
  };
}

export async function getInspectorTasks(
  inspectorId: string,
  filters: InspectionTaskListFilters
) {
  return getInspectionTasks({
    ...filters,
    inspectorId,
  });
}

export async function startInspectionTask(
  id: string,
  userId?: string
): Promise<InspectionTask> {
  const task = await getInspectionTask(id);

  if (task.status !== InspectionStatus.PENDING) {
    throwApiError("只有待处理的任务才能开始", 400);
  }

  task.status = InspectionStatus.IN_PROGRESS;
  task.startedAt = new Date();

  return await taskRepository.save(task);
}

export async function completeInspectionTask(
  id: string,
  dto: {
    checkResults?: Array<{
      checkItem: string;
      result: string;
      isNormal: boolean;
      remarks?: string;
    }>;
    inspectionNotes?: string;
    hasDefect?: boolean;
    defectType?: any;
    defectSeverity?: any;
    photos?: string[];
    actualLatitude?: number;
    actualLongitude?: number;
    accuracy?: number;
  },
  userId?: string
): Promise<InspectionTask> {
  const task = await getInspectionTask(id);

  if (task.status !== InspectionStatus.IN_PROGRESS) {
    throwApiError("只有进行中的任务才能完成", 400);
  }

  task.status = InspectionStatus.COMPLETED;
  task.completedAt = new Date();
  task.checkResults = dto.checkResults || task.checkResults;
  task.inspectionNotes = dto.inspectionNotes || task.inspectionNotes;
  task.hasDefect = dto.hasDefect || false;
  task.defectType = dto.defectType || task.defectType;
  task.defectSeverity = dto.defectSeverity || task.defectSeverity;
  task.photos = dto.photos || task.photos;
  task.actualLatitude = dto.actualLatitude as number;
  task.actualLongitude = dto.actualLongitude as number;
  task.accuracy = dto.accuracy as number;

  const savedTask = await taskRepository.save(task);

  if (task.routeId) {
    const route = await getInspectionRoute(task.routeId);
    const routeTasks = await taskRepository.find({ where: { routeId: task.routeId } });
    const allCompleted = routeTasks.every((t) => t.status === InspectionStatus.COMPLETED);

    if (allCompleted) {
      route.status = InspectionStatus.COMPLETED;
      route.completedAt = new Date();
      route.actualDuration =
        (route.completedAt.getTime() - (route.startedAt?.getTime() || Date.now())) / 60000;
      await routeRepository.save(route);
    }
  }

  return savedTask;
}

export async function getInspectionStatistics(
  filters?: {
    startDate?: Date;
    endDate?: Date;
    departmentId?: string;
    inspectorId?: string;
  }
): Promise<InspectionStatistics> {
  const qb = taskRepository.createQueryBuilder("task");

  if (filters?.startDate) {
    qb.where("task.createdAt >= :startDate", { startDate: filters.startDate });
  }
  if (filters?.endDate) {
    qb.andWhere("task.createdAt <= :endDate", { endDate: filters.endDate });
  }
  if (filters?.departmentId) {
    qb.innerJoin("task.route", "route").andWhere("route.departmentId = :departmentId", {
      departmentId: filters.departmentId,
    });
  }
  if (filters?.inspectorId) {
    qb.andWhere("task.inspectorId = :inspectorId", { inspectorId: filters.inspectorId });
  }

  const allTasks = await qb.getMany();

  const routesQb = routeRepository.createQueryBuilder("route");
  if (filters?.startDate) {
    routesQb.where("route.createdAt >= :startDate", { startDate: filters.startDate });
  }
  if (filters?.endDate) {
    routesQb.andWhere("route.createdAt <= :endDate", { endDate: filters.endDate });
  }
  if (filters?.departmentId) {
    routesQb.andWhere("route.departmentId = :departmentId", {
      departmentId: filters.departmentId,
    });
  }
  const allRoutes = await routesQb.getMany();

  const totalRoutes = allRoutes.length;
  const completedRoutes = allRoutes.filter((r) => r.status === InspectionStatus.COMPLETED).length;
  const totalTasks = allTasks.length;
  const completedTasks = allTasks.filter((t) => t.status === InspectionStatus.COMPLETED).length;
  const completionRate =
    totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 10000) / 100 : 0;

  const byStatus = Object.values(InspectionStatus).map((status) => ({
    status,
    count: allTasks.filter((t) => t.status === status).length,
  }));

  const byType = Object.values(InspectionType).map((type) => ({
    type,
    count: allRoutes.filter((r) => r.type === type).length,
  }));

  const defectsQb = defectRepository.createQueryBuilder("defect");
  if (filters?.startDate) {
    defectsQb.where("defect.createdAt >= :startDate", { startDate: filters.startDate });
  }
  if (filters?.endDate) {
    defectsQb.andWhere("defect.createdAt <= :endDate", { endDate: filters.endDate });
  }
  const allDefects = await defectsQb.getMany();

  const totalDefects = allDefects.length;

  const bySeverity = Object.values(RiskLevel).map((severity) => ({
    severity,
    count: allDefects.filter((d) => d.severity === severity).length,
  }));

  return {
    totalRoutes,
    completedRoutes,
    totalTasks,
    completedTasks,
    completionRate,
    totalDefects,
    byStatus,
    byType,
    bySeverity,
  };
}

async function generateTaskCode(): Promise<string> {
  const date = new Date();
  const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;

  const latest = await taskRepository
    .createQueryBuilder("task")
    .where("task.code LIKE :prefix", { prefix: `IT-${dateStr}%` })
    .orderBy("task.code", "DESC")
    .limit(1)
    .getOne();

  let sequence = 1;
  if (latest) {
    const match = latest.code.match(/-(\d{4})$/);
    if (match) {
      sequence = parseInt(match[1]) + 1;
    }
  }

  return `IT-${dateStr}-${String(sequence).padStart(4, "0")}`;
}
