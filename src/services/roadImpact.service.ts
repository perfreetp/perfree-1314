import { AppDataSource } from "../config/data-source";
import { RoadImpact } from "../entities/RoadImpact.entity";
import { ExcavationApplication } from "../entities/ExcavationApplication.entity";
import { RiskLevel } from "../types/enums";
import { throwApiError } from "../utils/response";
import { parseGeometry, bufferGeometry, calculateArea } from "../utils/spatial";
import * as turf from "@turf/turf";

export interface RoadImpactCalculationParams {
  applicationId: string;
  bufferDistance?: number;
}

export interface TrafficImpactAssessment {
  impactLevel: RiskLevel;
  affectedLanes: number;
  requiresRoadClosure: boolean;
  estimatedAffectedVehicles: number;
  estimatedDelayMinutes: number;
  trafficControlType: string;
}

export interface DetourSuggestion {
  routeName: string;
  routeDescription: string;
  distance: number;
  estimatedTime: number;
  suitableFor: string[];
}

export interface RoadImpactResult {
  totalImpacts: number;
  bySeverity: Array<{
    severity: RiskLevel;
    count: number;
  }>;
  impacts: RoadImpact[];
  trafficImpact: TrafficImpactAssessment;
  detourSuggestions: DetourSuggestion[];
}

export interface AffectedRoadStatistics {
  byRoadType: Array<{
    roadType: string;
    count: number;
    totalAffectedLength: number;
  }>;
  bySeverity: Array<{
    severity: RiskLevel;
    count: number;
    totalAffectedLength: number;
  }>;
  total: {
    roadCount: number;
    totalAffectedLength: number;
    totalAffectedArea: number;
    requiresClosureCount: number;
  };
}

const roadImpactRepository = AppDataSource.getRepository(RoadImpact);
const excavationRepository = AppDataSource.getRepository(ExcavationApplication);

const ROAD_TRAFFIC_FLOW: Record<string, number> = {
  expressway: 2000,
  main_road: 1500,
  secondary_road: 1000,
  branch_road: 500,
  residential_road: 200,
  other: 300,
};

const LANE_WIDTH = 3.5;

function getSeverity(impactFactor: number): RiskLevel {
  if (impactFactor >= 0.8) return RiskLevel.VERY_HIGH;
  if (impactFactor >= 0.6) return RiskLevel.HIGH;
  if (impactFactor >= 0.3) return RiskLevel.MEDIUM;
  return RiskLevel.LOW;
}

export async function calculateRoadImpact(params: RoadImpactCalculationParams): Promise<RoadImpactResult> {
  const { applicationId, bufferDistance = 10 } = params;

  const application = await excavationRepository.findOne({ where: { id: applicationId } });
  if (!application) {
    throwApiError("开挖申请不存在", 404);
  }

  if (!application.excavationAreaGeometry) {
    throwApiError("开挖区域几何图形不存在", 400);
  }

  await roadImpactRepository.delete({ applicationId });

  const impacts: RoadImpact[] = [];

  const excavationGeom = parseGeometry(application.excavationAreaGeometry);
  const bufferedGeom = bufferGeometry(excavationGeom, bufferDistance);

  if (bufferedGeom) {
    const impactArea = calculateArea(bufferedGeom.coordinates);
    const roadNames = application.roadName ? [application.roadName] : ["未命名道路"];

    for (const roadName of roadNames) {
      const impact = await createRoadImpact(application, roadName, bufferedGeom, impactArea);
      impacts.push(impact);
    }
  }

  const trafficImpact = await assessTrafficImpact(application, impacts);
  const detourSuggestions = generateDetourSuggestions(application, impacts);

  const bySeverity = Object.values(RiskLevel).map((severity) => ({
    severity,
    count: impacts.filter((i) => i.severity === severity).length,
  }));

  return {
    totalImpacts: impacts.length,
    bySeverity,
    impacts,
    trafficImpact,
    detourSuggestions,
  };
}

async function createRoadImpact(
  application: ExcavationApplication,
  roadName: string,
  bufferedGeom: any,
  impactArea: number
): Promise<RoadImpact> {
  const excavationArea = application.excavationArea || 0;
  const excavationDepth = application.excavationDepth || 0;

  const impactFactor = Math.min(1, (excavationArea / 100) * 0.4 + (excavationDepth / 5) * 0.6);
  const severity = getSeverity(impactFactor);

  const affectedLength = Math.sqrt(excavationArea) * 2;
  const affectedWidth = Math.min(excavationArea / affectedLength, 20);
  const affectedLanes = Math.ceil(affectedWidth / LANE_WIDTH);
  const requiresRoadClosure = affectedLanes >= 2 || severity === RiskLevel.VERY_HIGH;

  const trafficFlow = ROAD_TRAFFIC_FLOW["main_road"] || 1000;
  const estimatedAffectedVehicles = Math.round(trafficFlow * (affectedLanes / 2) * 0.5);
  const estimatedDelayMinutes = requiresRoadClosure ? 30 : affectedLanes * 5;

  let trafficControlType = "临时交通管制";
  if (requiresRoadClosure) {
    trafficControlType = "全封闭施工";
  } else if (affectedLanes >= 2) {
    trafficControlType = "半幅通行";
  } else if (affectedLanes >= 1) {
    trafficControlType = "占道施工";
  }

  const roadType = getRoadTypeBySeverity(severity);
  const roadGrade = getRoadGrade(roadName);

  const impact = roadImpactRepository.create({
    applicationId: application.id,
    roadName,
    roadType,
    roadGrade,
    severity,
    affectedLength: Math.round(affectedLength * 100) / 100,
    affectedWidth: Math.round(affectedWidth * 100) / 100,
    affectedArea: Math.round(impactArea * 100) / 100,
    affectedLanes,
    requiresRoadClosure,
    trafficControlType,
    description: `开挖施工对 ${roadName} 造成交通影响`,
    estimatedAffectedVehicles,
    estimatedDelayMinutes,
    mitigationMeasures: generateMitigationMeasures(severity, requiresRoadClosure),
    affectedAreaGeometry: bufferedGeom,
  });

  return await roadImpactRepository.save(impact);
}

function getRoadTypeBySeverity(severity: RiskLevel): string {
  switch (severity) {
    case RiskLevel.VERY_HIGH:
      return "main_road";
    case RiskLevel.HIGH:
      return "secondary_road";
    case RiskLevel.MEDIUM:
      return "branch_road";
    default:
      return "residential_road";
  }
}

function getRoadGrade(roadName: string): string {
  if (roadName.includes("高速") || roadName.includes("快速")) return "expressway";
  if (roadName.includes("大道") || roadName.includes("大街")) return "main_road";
  if (roadName.includes("路") || roadName.includes("街")) return "secondary_road";
  if (roadName.includes("巷") || roadName.includes("弄")) return "branch_road";
  return "other";
}

function generateMitigationMeasures(severity: RiskLevel, requiresClosure: boolean): string {
  const measures: string[] = [];

  if (requiresClosure) {
    measures.push("设置封闭围挡");
    measures.push("发布封路公告");
    measures.push("安排交通疏导人员");
  }

  switch (severity) {
    case RiskLevel.VERY_HIGH:
      measures.push("建议夜间施工减少影响");
      measures.push("设置完整的绕行指示标志");
      break;
    case RiskLevel.HIGH:
      measures.push("设置警示标志和减速带");
      measures.push("安排专人指挥交通");
      break;
    case RiskLevel.MEDIUM:
      measures.push("设置施工警示标志");
      measures.push("保持施工区域整洁");
      break;
    default:
      measures.push("设置安全防护设施");
  }

  measures.push("施工完成后及时恢复路面");

  return measures.join("；");
}

export async function assessTrafficImpact(
  application: ExcavationApplication,
  impacts: RoadImpact[]
): Promise<TrafficImpactAssessment> {
  if (impacts.length === 0) {
    return {
      impactLevel: RiskLevel.LOW,
      affectedLanes: 0,
      requiresRoadClosure: false,
      estimatedAffectedVehicles: 0,
      estimatedDelayMinutes: 0,
      trafficControlType: "无影响",
    };
  }

  const highestSeverity = impacts.reduce(
    (max, impact) => {
      const severityOrder = [RiskLevel.LOW, RiskLevel.MEDIUM, RiskLevel.HIGH, RiskLevel.VERY_HIGH];
      return severityOrder.indexOf(impact.severity) > severityOrder.indexOf(max) ? impact.severity : max;
    },
    RiskLevel.LOW as RiskLevel
  );

  const totalAffectedLanes = impacts.reduce((sum, impact) => sum + (impact.affectedLanes || 0), 0);
  const requiresClosure = impacts.some((impact) => impact.requiresRoadClosure);
  const totalAffectedVehicles = impacts.reduce(
    (sum, impact) => sum + (impact.estimatedAffectedVehicles || 0),
    0
  );
  const maxDelay = Math.max(...impacts.map((impact) => impact.estimatedDelayMinutes || 0));

  const controlTypes = [...new Set(impacts.map((impact) => impact.trafficControlType).filter(Boolean))];
  const trafficControlType = controlTypes.join("；") || "临时交通管制";

  return {
    impactLevel: highestSeverity,
    affectedLanes: totalAffectedLanes,
    requiresRoadClosure: requiresClosure,
    estimatedAffectedVehicles: totalAffectedVehicles,
    estimatedDelayMinutes: maxDelay,
    trafficControlType,
  };
}

export function generateDetourSuggestions(
  application: ExcavationApplication,
  impacts: RoadImpact[]
): DetourSuggestion[] {
  const suggestions: DetourSuggestion[] = [];
  const hasClosure = impacts.some((i) => i.requiresRoadClosure);
  const hasHighImpact = impacts.some((i) => i.severity === RiskLevel.HIGH || i.severity === RiskLevel.VERY_HIGH);

  if (hasClosure) {
    suggestions.push({
      routeName: "主要绕行路线",
      routeDescription: `通过周边主干道绕行，避开 ${application.roadName || "施工路段"}`,
      distance: 2.5,
      estimatedTime: 10,
      suitableFor: ["机动车", "货车"],
    });

    suggestions.push({
      routeName: "次要绕行路线",
      routeDescription: "通过邻近支路绕行，适用于熟悉路况的本地车辆",
      distance: 1.8,
      estimatedTime: 8,
      suitableFor: ["机动车", "电动车"],
    });
  }

  if (hasHighImpact) {
    suggestions.push({
      routeName: "慢行交通绕行",
      routeDescription: "行人、非机动车可通过人行道或专用通道通行",
      distance: 0.5,
      estimatedTime: 5,
      suitableFor: ["行人", "非机动车"],
    });
  }

  if (suggestions.length === 0) {
    suggestions.push({
      routeName: "正常通行",
      routeDescription: "施工区域保持通行，请注意减速避让",
      distance: 0,
      estimatedTime: 2,
      suitableFor: ["所有车辆"],
    });
  }

  return suggestions;
}

export async function getRoadImpactsByApplication(applicationId: string): Promise<RoadImpact[]> {
  const application = await excavationRepository.findOne({ where: { id: applicationId } });
  if (!application) {
    throwApiError("开挖申请不存在", 404);
  }

  return await roadImpactRepository.find({
    where: { applicationId },
    order: { createdAt: "DESC" },
  });
}

export async function getAffectedRoadsStatistics(applicationId?: string): Promise<AffectedRoadStatistics> {
  let whereClause: any = {};
  if (applicationId) {
    whereClause.applicationId = applicationId;
  }

  const allImpacts = await roadImpactRepository.find({ where: whereClause });

  const roadTypes = [...new Set(allImpacts.map((i) => i.roadType).filter(Boolean))];
  const byRoadType = roadTypes.map((roadType) => {
    const filtered = allImpacts.filter((i) => i.roadType === roadType);
    return {
      roadType: roadType || "unknown",
      count: filtered.length,
      totalAffectedLength: filtered.reduce((sum, i) => sum + (i.affectedLength || 0), 0),
    };
  });

  const bySeverity = Object.values(RiskLevel).map((severity) => {
    const filtered = allImpacts.filter((i) => i.severity === severity);
    return {
      severity,
      count: filtered.length,
      totalAffectedLength: filtered.reduce((sum, i) => sum + (i.affectedLength || 0), 0),
    };
  });

  const total = {
    roadCount: allImpacts.length,
    totalAffectedLength: allImpacts.reduce((sum, i) => sum + (i.affectedLength || 0), 0),
    totalAffectedArea: allImpacts.reduce((sum, i) => sum + (i.affectedArea || 0), 0),
    requiresClosureCount: allImpacts.filter((i) => i.requiresRoadClosure).length,
  };

  return {
    byRoadType,
    bySeverity,
    total,
  };
}
