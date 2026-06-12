import { AppDataSource } from "../config/data-source";
import { ValveClosurePlan } from "../entities/ValveClosurePlan.entity";
import { ValveClosureStep } from "../entities/ValveClosureStep.entity";
import { Pipeline } from "../entities/Pipeline.entity";
import { PipelineNode } from "../entities/PipelineNode.entity";
import { Facility } from "../entities/Facility.entity";
import { PipelineType, RiskLevel, FacilityType, ValveStatus } from "../types/enums";
import { throwApiError } from "../utils/response";
import { PaginationParams, getPaginationOptions } from "../utils/pagination";
import { parseGeometry, calculateDistance, nearestPointOnLine, bufferGeometry, calculateArea } from "../utils/spatial";

export interface GenerateValveClosurePlanDto {
  name: string;
  description?: string;
  incidentId?: string;
  alertId?: string;
  pipelineId?: string;
  pipelineType?: PipelineType;
  priority?: RiskLevel;
  incidentLocation: number[];
  incidentRadius?: number;
  notes?: string;
}

export interface ExecuteClosureStepDto {
  actualStatus?: ValveStatus;
  notes?: string;
}

export interface CalculateIsolationAreaDto {
  planId: string;
  bufferDistance?: number;
}

export interface IsolationAreaResult {
  area: number;
  geometry: any;
  affectedPipelines: Pipeline[];
  affectedFacilities: Facility[];
  estimatedUsers: number;
}

export interface ClosurePlanListFilters extends PaginationParams {
  status?: string;
  incidentId?: string;
  alertId?: string;
  pipelineId?: string;
  priority?: RiskLevel;
}

const planRepository = AppDataSource.getRepository(ValveClosurePlan);
const stepRepository = AppDataSource.getRepository(ValveClosureStep);
const pipelineRepository = AppDataSource.getRepository(Pipeline);
const nodeRepository = AppDataSource.getRepository(PipelineNode);
const facilityRepository = AppDataSource.getRepository(Facility);

interface ValveCandidate {
  valve: Facility;
  distance: number;
  direction: "upstream" | "downstream";
  pipelineId: string;
}

export async function generateValveClosurePlan(
  dto: GenerateValveClosurePlanDto,
  userId?: string
): Promise<ValveClosurePlan> {
  const { incidentLocation, incidentRadius = 10 } = dto;

  const nearestPipeline = await findNearestPipeline(incidentLocation);
  if (!nearestPipeline) {
    throwApiError("未找到附近的管线", 404);
  }

  const valveCandidates = await findValvesForIsolation(
    nearestPipeline.pipeline,
    incidentLocation,
    nearestPipeline.nearestPoint
  );

  if (valveCandidates.length === 0) {
    throwApiError("未找到可用于隔离的阀门", 404);
  }

  const optimizedValves = optimizeClosureSequence(valveCandidates);

  const planNo = await generatePlanNo();

  const plan = planRepository.create({
    planNo,
    name: dto.name,
    description: dto.description,
    incidentId: dto.incidentId,
    alertId: dto.alertId,
    pipelineId: nearestPipeline.pipeline.id,
    pipelineType: dto.pipelineType || nearestPipeline.pipeline.type,
    priority: dto.priority || RiskLevel.HIGH,
    status: "pending",
    incidentLocation: {
      type: "Point",
      coordinates: incidentLocation,
      srid: 4326,
    },
    estimatedIsolationTime: optimizedValves.reduce((sum, v) => sum + (v.valve.attributes?.estimatedTime || 5), 0),
    estimatedWaterLoss: 0,
    createdBy: userId,
    notes: dto.notes,
  });

  const savedPlan = await planRepository.save(plan);

  const steps: ValveClosureStep[] = optimizedValves.map((vc, index) =>
    stepRepository.create({
      planId: savedPlan.id,
      valveId: vc.valve.id,
      stepOrder: index + 1,
      targetStatus: ValveStatus.CLOSED,
      valveCode: vc.valve.code,
      valveName: vc.valve.name,
      locationDescription: vc.valve.locationDescription,
      valveLocation: vc.valve.geometry,
      estimatedTime: vc.valve.attributes?.estimatedTime || 5,
      isCompleted: false,
    })
  );

  await stepRepository.save(steps);

  const affectedUsers = await estimateAffectedUsersInternal(savedPlan.id);
  savedPlan.estimatedAffectedUsers = affectedUsers;
  await planRepository.save(savedPlan);

  return getValveClosurePlan(savedPlan.id);
}

async function findNearestPipeline(point: number[]): Promise<{ pipeline: Pipeline; nearestPoint: number[] } | null> {
  const [lng, lat] = point;
  const searchRadius = 50;

  const qb = pipelineRepository
    .createQueryBuilder("pipeline")
    .leftJoinAndSelect("pipeline.startNode", "startNode")
    .leftJoinAndSelect("pipeline.endNode", "endNode")
    .where(
      "ST_DWithin(pipeline.geometry::geography, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography, :radius)",
      { lng, lat, radius: searchRadius }
    )
    .orderBy(
      "ST_Distance(pipeline.geometry::geography, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography)",
      "ASC"
    )
    .limit(1);

  const pipeline = await qb.getOne();
  if (!pipeline) return null;

  const geom = parseGeometry(pipeline.geometry);
  if (!geom?.coordinates) return null;

  const nearest = nearestPointOnLine(geom.coordinates, point);
  return { pipeline, nearestPoint: nearest.point };
}

async function findValvesForIsolation(
  incidentPipeline: Pipeline,
  incidentPoint: number[],
  nearestPointOnPipeline: number[]
): Promise<ValveCandidate[]> {
  const visitedPipelines = new Set<string>();
  const visitedNodes = new Set<string>();
  const valves: ValveCandidate[] = [];

  async function bfsTraverse(
    startNodeId: string | undefined,
    direction: "upstream" | "downstream",
    startDistance: number
  ): Promise<boolean> {
    if (!startNodeId) return false;

    const queue: { nodeId: string; distance: number }[] = [{ nodeId: startNodeId, distance: startDistance }];
    visitedNodes.add(startNodeId);

    while (queue.length > 0) {
      const { nodeId, distance } = queue.shift()!;

      const nodeValve = await findValveAtNode(nodeId);
      if (nodeValve) {
        valves.push({
          valve: nodeValve,
          distance,
          direction,
          pipelineId: "",
        });
        return true;
      }

      const connectedPipelines = await getConnectedPipelinesFromNode(nodeId, direction);

      for (const pipeline of connectedPipelines) {
        if (visitedPipelines.has(pipeline.id)) continue;
        visitedPipelines.add(pipeline.id);

        const pipelineValve = await findValveOnPipeline(pipeline, direction);
        if (pipelineValve) {
          const valveGeom = parseGeometry(pipelineValve.valve.geometry);
          const valvePoint = valveGeom?.coordinates || [0, 0];
          const distToValve = distance + calculateDistance(nearestPointOnPipeline, valvePoint);

          valves.push({
            ...pipelineValve,
            distance: distToValve,
            direction,
          });
          continue;
        }

        const nextNodeId = direction === "downstream" ? pipeline.endNodeId : pipeline.startNodeId;
        if (nextNodeId && !visitedNodes.has(nextNodeId)) {
          const pipelineGeom = parseGeometry(pipeline.geometry);
          const pipelineLength = pipelineGeom?.coordinates
            ? calculateLineLengthApprox(pipelineGeom.coordinates)
            : pipeline.length || 0;

          visitedNodes.add(nextNodeId);
          queue.push({
            nodeId: nextNodeId,
            distance: distance + pipelineLength,
          });
        }
      }
    }

    return false;
  }

  const pipelineGeom = parseGeometry(incidentPipeline.geometry);
  const coordinates = pipelineGeom?.coordinates || [];
  const nearestResult = nearestPointOnLine(coordinates, incidentPoint);
  const distanceFromStart = nearestResult.location;
  const distanceFromEnd = (pipelineGeom?.coordinates
    ? calculateLineLengthApprox(pipelineGeom.coordinates)
    : incidentPipeline.length || 0) - distanceFromStart;

  const upstreamValve = await findValveOnPipeline(incidentPipeline, "upstream");
  if (upstreamValve) {
    const valveGeom = parseGeometry(upstreamValve.valve.geometry);
    const valvePoint = valveGeom?.coordinates || [0, 0];
    valves.push({
      ...upstreamValve,
      distance: calculateDistance(nearestPointOnPipeline, valvePoint),
      direction: "upstream",
    });
  } else {
    await bfsTraverse(incidentPipeline.startNodeId, "upstream", distanceFromStart);
  }

  const downstreamValve = await findValveOnPipeline(incidentPipeline, "downstream");
  if (downstreamValve) {
    const valveGeom = parseGeometry(downstreamValve.valve.geometry);
    const valvePoint = valveGeom?.coordinates || [0, 0];
    valves.push({
      ...downstreamValve,
      distance: calculateDistance(nearestPointOnPipeline, valvePoint),
      direction: "downstream",
    });
  } else {
    await bfsTraverse(incidentPipeline.endNodeId, "downstream", distanceFromEnd);
  }

  return valves;
}

async function findValveAtNode(nodeId: string): Promise<Facility | null> {
  return await facilityRepository.findOne({
    where: {
      nodeId,
      type: FacilityType.VALVE,
      status: ValveStatus.OPEN,
    },
  });
}

async function findValveOnPipeline(
  pipeline: Pipeline,
  direction: "upstream" | "downstream"
): Promise<{ valve: Facility; pipelineId: string } | null> {
  const valves = await facilityRepository.find({
    where: {
      pipelineId: pipeline.id,
      type: FacilityType.VALVE,
      status: ValveStatus.OPEN,
    },
  });

  if (valves.length === 0) return null;

  const pipelineGeom = parseGeometry(pipeline.geometry);
  if (!pipelineGeom?.coordinates) return { valve: valves[0], pipelineId: pipeline.id };

  const pipelineCoords = pipelineGeom.coordinates;

  let nearestValve: Facility | null = null;
  let minDistance = Infinity;

  for (const valve of valves) {
    const valveGeom = parseGeometry(valve.geometry);
    if (!valveGeom?.coordinates) continue;

    const nearest = nearestPointOnLine(pipelineCoords, valveGeom.coordinates);
    const location = nearest.location;

    const pipelineLength = calculateLineLengthApprox(pipelineCoords);
    const distanceFromStart = location;
    const distanceFromEnd = pipelineLength - location;

    const distance = direction === "upstream" ? distanceFromStart : distanceFromEnd;

    if (distance < minDistance && distance > 1) {
      minDistance = distance;
      nearestValve = valve;
    }
  }

  return nearestValve ? { valve: nearestValve, pipelineId: pipeline.id } : null;
}

async function getConnectedPipelinesFromNode(
  nodeId: string,
  direction: "upstream" | "downstream"
): Promise<Pipeline[]> {
  if (direction === "downstream") {
    return await pipelineRepository.find({
      where: { startNodeId: nodeId },
      relations: ["startNode", "endNode"],
    });
  } else {
    return await pipelineRepository.find({
      where: { endNodeId: nodeId },
      relations: ["startNode", "endNode"],
    });
  }
}

function calculateLineLengthApprox(coordinates: number[][]): number {
  let length = 0;
  for (let i = 1; i < coordinates.length; i++) {
    length += calculateDistance(coordinates[i - 1], coordinates[i]);
  }
  return length;
}

export function optimizeClosureSequence(valves: ValveCandidate[]): ValveCandidate[] {
  return [...valves].sort((a, b) => a.distance - b.distance);
}

async function generatePlanNo(): Promise<string> {
  const date = new Date();
  const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;

  const latest = await planRepository
    .createQueryBuilder("plan")
    .where("plan.planNo LIKE :prefix", { prefix: `VCP-${dateStr}%` })
    .orderBy("plan.planNo", "DESC")
    .limit(1)
    .getOne();

  let sequence = 1;
  if (latest) {
    const match = latest.planNo.match(/-(\d{4})$/);
    if (match) {
      sequence = parseInt(match[1]) + 1;
    }
  }

  return `VCP-${dateStr}-${String(sequence).padStart(4, "0")}`;
}

export async function getValveClosurePlan(id: string): Promise<ValveClosurePlan> {
  const plan = await planRepository.findOne({
    where: { id },
    relations: ["closureSteps", "pipeline", "creator", "approver"],
  });

  if (!plan) {
    throwApiError("关阀方案不存在", 404);
  }

  return plan;
}

export async function getValveClosurePlanByIncident(incidentId: string): Promise<ValveClosurePlan | null> {
  return await planRepository.findOne({
    where: { incidentId },
    relations: ["closureSteps", "pipeline"],
  });
}

export async function getClosurePlans(filters: ClosurePlanListFilters) {
  const { page, pageSize, ...queryFilters } = filters;
  const { skip, take, page: currentPage, pageSize: size } = getPaginationOptions({ page, pageSize });

  const qb = planRepository
    .createQueryBuilder("plan")
    .leftJoinAndSelect("plan.closureSteps", "closureSteps")
    .leftJoinAndSelect("plan.pipeline", "pipeline")
    .leftJoinAndSelect("plan.creator", "creator");

  if (queryFilters.status) {
    qb.andWhere("plan.status = :status", { status: queryFilters.status });
  }
  if (queryFilters.incidentId) {
    qb.andWhere("plan.incidentId = :incidentId", { incidentId: queryFilters.incidentId });
  }
  if (queryFilters.alertId) {
    qb.andWhere("plan.alertId = :alertId", { alertId: queryFilters.alertId });
  }
  if (queryFilters.pipelineId) {
    qb.andWhere("plan.pipelineId = :pipelineId", { pipelineId: queryFilters.pipelineId });
  }
  if (queryFilters.priority) {
    qb.andWhere("plan.priority = :priority", { priority: queryFilters.priority });
  }

  qb.orderBy("plan.createdAt", "DESC");

  const [data, total] = await qb.skip(skip).take(take).getManyAndCount();

  return {
    data,
    total,
    page: currentPage,
    pageSize: size,
  };
}

export async function executeClosureStep(
  planId: string,
  stepId: string,
  dto: ExecuteClosureStepDto,
  userId?: string
): Promise<ValveClosureStep> {
  const plan = await getValveClosurePlan(planId);

  if (plan.status === "completed") {
    throwApiError("关阀方案已完成，无法执行步骤", 400);
  }

  const step = await stepRepository.findOne({
    where: { id: stepId, planId },
    relations: ["valve"],
  });

  if (!step) {
    throwApiError("关阀步骤不存在", 404);
  }

  if (step.isCompleted) {
    throwApiError("该步骤已完成", 400);
  }

  step.actualStatus = dto.actualStatus || step.targetStatus;
  step.isCompleted = true;
  step.completedAt = new Date();
  step.completedBy = userId as string;
  step.notes = dto.notes || step.notes;

  const savedStep = await stepRepository.save(step);

  if (step.valve) {
    step.valve.status = step.actualStatus;
    step.valve.lastMaintenanceDate = new Date();
    await facilityRepository.save(step.valve);
  }

  const allSteps = await stepRepository.find({ where: { planId } });
  const allCompleted = allSteps.every((s) => s.isCompleted);

  if (allCompleted) {
    plan.status = "executed";
    plan.executedAt = new Date();
    plan.executedBy = userId as string;
    await planRepository.save(plan);
  }

  return savedStep;
}

export async function completeClosurePlan(planId: string, userId?: string): Promise<ValveClosurePlan> {
  const plan = await getValveClosurePlan(planId);

  if (plan.status === "completed") {
    throwApiError("关阀方案已完成", 400);
  }

  const steps = await stepRepository.find({ where: { planId } });
  const pendingSteps = steps.filter((s) => !s.isCompleted);

  if (pendingSteps.length > 0) {
    throwApiError(`还有 ${pendingSteps.length} 个步骤未完成`, 400);
  }

  plan.status = "completed";
  plan.completedAt = new Date();
  plan.executedBy = (plan.executedBy || userId) as string;

  return await planRepository.save(plan);
}

async function calculateIsolationGeometry(
  planId: string,
  bufferDistance: number = 50
): Promise<{ geometry: any; area: number; valveCount: number }> {
  const plan = await getValveClosurePlan(planId);

  const steps = await stepRepository.find({
    where: { planId },
  });

  const valvePoints = steps
    .filter((s) => s.valveLocation)
    .map((s) => {
      const geom = parseGeometry(s.valveLocation);
      return geom?.coordinates || [0, 0];
    });

  let buffer: any = null;

  if (valvePoints.length < 2) {
    const incidentGeom = parseGeometry(plan.incidentLocation);
    const incidentPoint = incidentGeom?.coordinates || [0, 0];
    buffer = bufferGeometry(
      { type: "Point", coordinates: incidentPoint },
      bufferDistance
    );
  } else {
    const hull = createConvexHull(valvePoints);
    buffer = bufferGeometry(hull, bufferDistance);
  }

  const area = buffer && buffer.geometry?.coordinates
    ? calculateArea(buffer.geometry.coordinates)
    : 0;

  return {
    geometry: buffer?.geometry || null,
    area,
    valveCount: valvePoints.length,
  };
}

export async function calculateIsolationArea(
  dto: CalculateIsolationAreaDto
): Promise<IsolationAreaResult> {
  const bufferDistance = dto.bufferDistance || 50;

  const isoGeom = await calculateIsolationGeometry(dto.planId, bufferDistance);

  const bufferFeature = isoGeom.geometry
    ? { type: "Feature", geometry: isoGeom.geometry }
    : null;

  const affectedPipelines = await getPipelinesInArea(bufferFeature);
  const affectedFacilities = await getFacilitiesInArea(bufferFeature);
  const estimatedUsers = calculateAffectedUsersFromPipelines(affectedPipelines);

  return {
    area: isoGeom.area,
    geometry: isoGeom.geometry,
    affectedPipelines,
    affectedFacilities,
    estimatedUsers,
  };
}

function createConvexHull(points: number[][]): any {
  if (points.length < 3) {
    const center = points[0];
    const radius = points.length === 2 ? calculateDistance(points[0], points[1]) / 2 : 10;
    const coordinates: number[][] = [];
    for (let i = 0; i < 36; i++) {
      const angle = (i * 10 * Math.PI) / 180;
      coordinates.push([center[0] + radius * Math.cos(angle), center[1] + radius * Math.sin(angle)]);
    }
    coordinates.push(coordinates[0]);
    return { type: "Polygon", coordinates: [coordinates] };
  }

  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);

  const cross = (o: number[], a: number[], b: number[]) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

  const lower: number[][] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }

  const upper: number[][] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }

  lower.pop();
  upper.pop();
  const hull = [...lower, ...upper];
  hull.push(hull[0]);

  return { type: "Polygon", coordinates: [hull] };
}

function calculateAffectedUsersFromPipelines(pipelines: Pipeline[]): number {
  let estimatedUsers = 0;
  for (const pipeline of pipelines) {
    const length = pipeline.length || 0;
    const usersPerKm = (pipeline.attributes as any)?.usersPerKm || 50;
    estimatedUsers += (length / 1000) * usersPerKm;
  }
  return Math.round(estimatedUsers);
}

async function getPipelinesInArea(feature: any): Promise<Pipeline[]> {
  if (!feature || !feature.geometry) return [];

  const geomJson = JSON.stringify(feature.geometry);

  return await pipelineRepository
    .createQueryBuilder("pipeline")
    .where("ST_Intersects(pipeline.geometry, ST_SetSRID(ST_GeomFromGeoJSON(:geom), 4326))", {
      geom: geomJson,
    })
    .getMany();
}

async function getFacilitiesInArea(feature: any): Promise<Facility[]> {
  if (!feature || !feature.geometry) return [];

  const geomJson = JSON.stringify(feature.geometry);

  return await facilityRepository
    .createQueryBuilder("facility")
    .where("ST_Intersects(facility.geometry, ST_SetSRID(ST_GeomFromGeoJSON(:geom), 4326))", {
      geom: geomJson,
    })
    .getMany();
}

async function estimateAffectedUsersInternal(planId: string): Promise<number> {
  const isoGeom = await calculateIsolationGeometry(planId, 30);

  const bufferFeature = isoGeom.geometry
    ? { type: "Feature", geometry: isoGeom.geometry }
    : null;

  const affectedPipelines = await getPipelinesInArea(bufferFeature);
  return calculateAffectedUsersFromPipelines(affectedPipelines);
}

export async function estimateAffectedUsers(planId: string): Promise<{
  estimatedUsers: number;
  breakdown: Array<{ pipelineId: string; pipelineName: string; users: number }>;
}> {
  const isoGeom = await calculateIsolationGeometry(planId, 30);

  const bufferFeature = isoGeom.geometry
    ? { type: "Feature", geometry: isoGeom.geometry }
    : null;

  const affectedPipelines = await getPipelinesInArea(bufferFeature);

  const breakdown = [];
  let totalUsers = 0;

  for (const pipeline of affectedPipelines) {
    const length = pipeline.length || 0;
    const usersPerKm = (pipeline.attributes as any)?.usersPerKm || 50;
    const users = Math.round((length / 1000) * usersPerKm);
    totalUsers += users;
    breakdown.push({
      pipelineId: pipeline.id,
      pipelineName: pipeline.name || pipeline.code,
      users,
    });
  }

  return {
    estimatedUsers: totalUsers,
    breakdown,
  };
}
