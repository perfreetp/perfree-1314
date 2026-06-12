import { AppDataSource } from "../config/data-source";
import { RiskAssessment } from "../entities/RiskAssessment.entity";
import { HazardPoint } from "../entities/HazardPoint.entity";
import { Pipeline } from "../entities/Pipeline.entity";
import { RiskLevel } from "../types/enums";
import { throwApiError } from "../utils/response";
import { PaginationParams, paginateQuery } from "../utils/pagination";

export interface CreateRiskAssessmentDto {
  pipelineId?: string;
  hazardId?: string;
  assessmentDate: Date;
  overallRiskLevel?: RiskLevel;
  overallRiskScore?: number;
  likelihoodScore?: number;
  likelihoodAgeScore?: number;
  likelihoodMaterialScore?: number;
  likelihoodCorrosionScore?: number;
  likelihoodPressureScore?: number;
  likelihoodLeakHistoryScore?: number;
  consequenceScore?: number;
  consequencePopulationScore?: number;
  consequenceEnvironmentScore?: number;
  consequenceEconomicScore?: number;
  consequenceTrafficScore?: number;
  consequencePropertyScore?: number;
  assessmentMethod?: string;
  analysisDetails?: string;
  mitigationMeasures?: string;
  nextAssessmentDate?: Date;
  attributes?: Record<string, any>;
  remarks?: string;
}

export interface UpdateRiskAssessmentDto extends Partial<CreateRiskAssessmentDto> {}

export interface RiskAssessmentListFilters extends PaginationParams {
  pipelineId?: string;
  hazardId?: string;
  overallRiskLevel?: RiskLevel;
  startDate?: Date;
  endDate?: Date;
}

export interface AssessHazardRiskDto {
  hazardId: string;
  likelihoodScore: number;
  consequenceScore: number;
  likelihoodAgeScore?: number;
  likelihoodMaterialScore?: number;
  likelihoodCorrosionScore?: number;
  likelihoodPressureScore?: number;
  likelihoodLeakHistoryScore?: number;
  consequencePopulationScore?: number;
  consequenceEnvironmentScore?: number;
  consequenceEconomicScore?: number;
  consequenceTrafficScore?: number;
  consequencePropertyScore?: number;
  assessmentMethod?: string;
  analysisDetails?: string;
  remarks?: string;
}

export interface AssessPipelineRiskDto {
  pipelineId: string;
  assessmentMethod?: string;
  analysisDetails?: string;
  remarks?: string;
}

export interface RiskAssessmentResult {
  likelihoodScore: number;
  consequenceScore: number;
  totalScore: number;
  riskLevel: RiskLevel;
  mitigationMeasures: string[];
}

export interface BatchAssessResult {
  success: number;
  failed: number;
  results: Array<{
    hazardId: string;
    success: boolean;
    score?: number;
    riskLevel?: RiskLevel;
    error?: string;
  }>;
}

export interface RiskStatistics {
  byRiskLevel: Array<{
    riskLevel: RiskLevel;
    count: number;
    percentage: number;
    avgScore: number;
  }>;
  total: {
    count: number;
    avgScore: number;
  };
}

const assessmentRepository = AppDataSource.getRepository(RiskAssessment);
const hazardRepository = AppDataSource.getRepository(HazardPoint);
const pipelineRepository = AppDataSource.getRepository(Pipeline);

export function calculateRiskScore(likelihoodScore: number, consequenceScore: number): number {
  const totalScore = likelihoodScore * 0.4 + consequenceScore * 0.6;
  return Math.min(Math.max(Math.round(totalScore), 0), 100);
}

export function determineRiskLevel(score: number): RiskLevel {
  if (score < 30) return RiskLevel.LOW;
  if (score < 60) return RiskLevel.MEDIUM;
  if (score < 80) return RiskLevel.HIGH;
  return RiskLevel.VERY_HIGH;
}

export function generateMitigationMeasures(
  riskLevel: RiskLevel,
  likelihoodScore: number,
  consequenceScore: number
): string[] {
  const measures: string[] = [];

  if (riskLevel === RiskLevel.VERY_HIGH) {
    measures.push("立即采取紧急处理措施，制定专项整改方案");
    measures.push("启动应急预案，安排24小时专人值守监控");
    measures.push("优先安排维修资源，立即组织抢修");
    measures.push("降低运营压力，必要时暂停相关设施运行");
    measures.push("每周进行一次专项检查，跟踪整改进度");
  } else if (riskLevel === RiskLevel.HIGH) {
    measures.push("制定详细的整改计划，明确整改时限");
    measures.push("增加巡检频次，每半月至少检查一次");
    measures.push("安排专项维修资金，优先保障整改需求");
    measures.push("加强监测，必要时安装在线监测设备");
    measures.push("制定应急处置预案，定期组织演练");
  } else if (riskLevel === RiskLevel.MEDIUM) {
    measures.push("纳入年度维修计划，按计划进行整改");
    measures.push("按常规频次进行巡检和维护");
    measures.push("加强日常管理，防止风险升级");
    measures.push("定期评估风险变化情况");
  } else {
    measures.push("保持正常巡检和维护");
    measures.push("持续关注风险变化");
    measures.push("做好记录，建立风险台账");
  }

  if (likelihoodScore > 70) {
    measures.push("加强腐蚀防护措施，定期进行腐蚀检测");
    measures.push("优化运行参数，降低设备负荷");
    measures.push("建立预防性维护机制，延长设备使用寿命");
  }

  if (consequenceScore > 70) {
    measures.push("完善安全防护设施，降低事故后果");
    measures.push("制定人员疏散和应急救援预案");
    measures.push("加强周边环境监测，设置警示标识");
    measures.push("配备必要的应急救援物资和设备");
  }

  return measures;
}

export async function createRiskAssessment(
  dto: CreateRiskAssessmentDto,
  userId?: string
): Promise<RiskAssessment> {
  if (dto.hazardId) {
    const hazard = await hazardRepository.findOne({ where: { id: dto.hazardId } });
    if (!hazard) {
      throwApiError(`隐患 ${dto.hazardId} 不存在`, 404);
    }
  }

  if (dto.pipelineId) {
    const pipeline = await pipelineRepository.findOne({ where: { id: dto.pipelineId } });
    if (!pipeline) {
      throwApiError(`管线 ${dto.pipelineId} 不存在`, 404);
    }
  }

  const assessment = assessmentRepository.create({
    ...dto,
    createdBy: userId,
    updatedBy: userId,
  });

  return await assessmentRepository.save(assessment);
}

export async function getRiskAssessment(id: string): Promise<RiskAssessment> {
  const assessment = await assessmentRepository.findOne({
    where: { id },
    relations: ["pipeline", "hazard"],
  });
  if (!assessment) {
    throwApiError("风险评估不存在", 404);
  }
  return assessment;
}

export async function updateRiskAssessment(
  id: string,
  dto: UpdateRiskAssessmentDto,
  userId?: string
): Promise<RiskAssessment> {
  const assessment = await getRiskAssessment(id);

  if (dto.hazardId && dto.hazardId !== assessment.hazardId) {
    const hazard = await hazardRepository.findOne({ where: { id: dto.hazardId } });
    if (!hazard) {
      throwApiError(`隐患 ${dto.hazardId} 不存在`, 404);
    }
  }

  if (dto.pipelineId && dto.pipelineId !== assessment.pipelineId) {
    const pipeline = await pipelineRepository.findOne({ where: { id: dto.pipelineId } });
    if (!pipeline) {
      throwApiError(`管线 ${dto.pipelineId} 不存在`, 404);
    }
  }

  const updated = assessmentRepository.merge(assessment, {
    ...dto,
    updatedBy: userId,
  });

  return await assessmentRepository.save(updated);
}

export async function deleteRiskAssessment(id: string): Promise<void> {
  const assessment = await getRiskAssessment(id);
  await assessmentRepository.softDelete(assessment.id);
}

export async function listRiskAssessments(filters: RiskAssessmentListFilters) {
  const { page, pageSize, ...queryFilters } = filters;

  const qb = assessmentRepository
    .createQueryBuilder("assessment")
    .leftJoinAndSelect("assessment.pipeline", "pipeline")
    .leftJoinAndSelect("assessment.hazard", "hazard");

  if (queryFilters.pipelineId)
    qb.andWhere("assessment.pipelineId = :pipelineId", { pipelineId: queryFilters.pipelineId });
  if (queryFilters.hazardId)
    qb.andWhere("assessment.hazardId = :hazardId", { hazardId: queryFilters.hazardId });
  if (queryFilters.overallRiskLevel)
    qb.andWhere("assessment.overallRiskLevel = :overallRiskLevel", {
      overallRiskLevel: queryFilters.overallRiskLevel,
    });
  if (queryFilters.startDate)
    qb.andWhere("assessment.assessmentDate >= :startDate", { startDate: queryFilters.startDate });
  if (queryFilters.endDate)
    qb.andWhere("assessment.assessmentDate <= :endDate", { endDate: queryFilters.endDate });

  qb.orderBy("assessment.assessmentDate", "DESC");

  return await paginateQuery(qb, { page, pageSize });
}

export async function assessHazardRisk(
  dto: AssessHazardRiskDto,
  userId?: string
): Promise<RiskAssessment> {
  const hazard = await hazardRepository.findOne({ where: { id: dto.hazardId } });
  if (!hazard) {
    throwApiError(`隐患 ${dto.hazardId} 不存在`, 404);
  }

  if (dto.likelihoodScore < 0 || dto.likelihoodScore > 100) {
    throwApiError("可能性评分必须在0-100之间", 400);
  }
  if (dto.consequenceScore < 0 || dto.consequenceScore > 100) {
    throwApiError("后果评分必须在0-100之间", 400);
  }

  const totalScore = calculateRiskScore(dto.likelihoodScore, dto.consequenceScore);
  const riskLevel = determineRiskLevel(totalScore);
  const mitigationMeasures = generateMitigationMeasures(
    riskLevel,
    dto.likelihoodScore,
    dto.consequenceScore
  );

  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    const assessment = assessmentRepository.create({
      hazardId: dto.hazardId,
      pipelineId: hazard.pipelineId,
      assessmentDate: new Date(),
      overallRiskScore: totalScore,
      overallRiskLevel: riskLevel,
      likelihoodScore: dto.likelihoodScore,
      likelihoodAgeScore: dto.likelihoodAgeScore,
      likelihoodMaterialScore: dto.likelihoodMaterialScore,
      likelihoodCorrosionScore: dto.likelihoodCorrosionScore,
      likelihoodPressureScore: dto.likelihoodPressureScore,
      likelihoodLeakHistoryScore: dto.likelihoodLeakHistoryScore,
      consequenceScore: dto.consequenceScore,
      consequencePopulationScore: dto.consequencePopulationScore,
      consequenceEnvironmentScore: dto.consequenceEnvironmentScore,
      consequenceEconomicScore: dto.consequenceEconomicScore,
      consequenceTrafficScore: dto.consequenceTrafficScore,
      consequencePropertyScore: dto.consequencePropertyScore,
      assessmentMethod: dto.assessmentMethod || "综合评分法",
      analysisDetails: dto.analysisDetails,
      mitigationMeasures: mitigationMeasures.join("; "),
      nextAssessmentDate: calculateNextAssessmentDate(riskLevel),
      createdBy: userId,
      updatedBy: userId,
      remarks: dto.remarks,
    });

    const savedAssessment = await queryRunner.manager.save(assessment);

    hazard.riskScore = totalScore;
    hazard.riskLevel = riskLevel;
    hazard.likelihoodScore = dto.likelihoodScore;
    hazard.consequenceScore = dto.consequenceScore;
    hazard.updatedBy = userId;

    await queryRunner.manager.save(hazard);

    await queryRunner.commitTransaction();

    return savedAssessment;
  } catch (error) {
    await queryRunner.rollbackTransaction();
    throw error;
  } finally {
    await queryRunner.release();
  }
}

export async function assessPipelineRisk(
  dto: AssessPipelineRiskDto,
  userId?: string
): Promise<RiskAssessment> {
  const pipeline = await pipelineRepository.findOne({
    where: { id: dto.pipelineId },
    relations: ["hazards"],
  });
  if (!pipeline) {
    throwApiError(`管线 ${dto.pipelineId} 不存在`, 404);
  }

  const hazards = await hazardRepository.find({
    where: { pipelineId: dto.pipelineId, isRepaired: false },
  });

  if (hazards.length === 0) {
    const assessment = assessmentRepository.create({
      pipelineId: dto.pipelineId,
      assessmentDate: new Date(),
      overallRiskScore: 0,
      overallRiskLevel: RiskLevel.LOW,
      assessmentMethod: dto.assessmentMethod || "管线整体评估",
      analysisDetails: dto.analysisDetails || "管线无未修复隐患，风险状态良好",
      mitigationMeasures: "保持正常巡检和维护",
      nextAssessmentDate: calculateNextAssessmentDate(RiskLevel.LOW),
      createdBy: userId,
      updatedBy: userId,
      remarks: dto.remarks,
    });
    return await assessmentRepository.save(assessment);
  }

  let totalLikelihood = 0;
  let totalConsequence = 0;
  let maxScore = 0;

  for (const hazard of hazards) {
    const likelihood = hazard.likelihoodScore || 50;
    const consequence = hazard.consequenceScore || 50;
    totalLikelihood += likelihood;
    totalConsequence += consequence;
    maxScore = Math.max(maxScore, hazard.riskScore || 50);
  }

  const avgLikelihood = totalLikelihood / hazards.length;
  const avgConsequence = totalConsequence / hazards.length;

  const weightedLikelihood = avgLikelihood * 0.4 + Math.max(avgLikelihood, maxScore * 0.3) * 0.6;
  const weightedConsequence =
    avgConsequence * 0.4 + Math.max(avgConsequence, maxScore * 0.3) * 0.6;

  const totalScore = calculateRiskScore(weightedLikelihood, weightedConsequence);
  const riskLevel = determineRiskLevel(totalScore);
  const mitigationMeasures = generateMitigationMeasures(
    riskLevel,
    weightedLikelihood,
    weightedConsequence
  );

  const assessment = assessmentRepository.create({
    pipelineId: dto.pipelineId,
    assessmentDate: new Date(),
    overallRiskScore: totalScore,
    overallRiskLevel: riskLevel,
    likelihoodScore: weightedLikelihood,
    consequenceScore: weightedConsequence,
    assessmentMethod: dto.assessmentMethod || "管线整体评估",
    analysisDetails:
      dto.analysisDetails ||
      `管线共有 ${hazards.length} 处未修复隐患，综合评估管线整体风险`,
    mitigationMeasures: mitigationMeasures.join("; "),
    nextAssessmentDate: calculateNextAssessmentDate(riskLevel),
    attributes: {
      hazardCount: hazards.length,
      avgLikelihood,
      avgConsequence,
      maxRiskScore: maxScore,
    },
    createdBy: userId,
    updatedBy: userId,
    remarks: dto.remarks,
  });

  return await assessmentRepository.save(assessment);
}

export async function getRiskAssessmentHistory(
  hazardId?: string,
  pipelineId?: string,
  filters?: PaginationParams
) {
  if (!hazardId && !pipelineId) {
    throwApiError("必须指定隐患ID或管线ID", 400);
  }

  const qb = assessmentRepository
    .createQueryBuilder("assessment")
    .leftJoinAndSelect("assessment.pipeline", "pipeline")
    .leftJoinAndSelect("assessment.hazard", "hazard");

  if (hazardId) {
    qb.andWhere("assessment.hazardId = :hazardId", { hazardId });
  }
  if (pipelineId) {
    qb.andWhere("assessment.pipelineId = :pipelineId", { pipelineId });
  }

  qb.orderBy("assessment.assessmentDate", "DESC");

  return await paginateQuery(qb, filters || {});
}

export async function batchAssessRisks(
  assessments: Array<AssessHazardRiskDto>,
  userId?: string
): Promise<BatchAssessResult> {
  const result: BatchAssessResult = {
    success: 0,
    failed: 0,
    results: [],
  };

  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    for (const dto of assessments) {
      try {
        const hazard = await queryRunner.manager.findOne(HazardPoint, {
          where: { id: dto.hazardId },
        });
        if (!hazard) {
          throw new Error(`隐患 ${dto.hazardId} 不存在`);
        }

        if (dto.likelihoodScore < 0 || dto.likelihoodScore > 100) {
          throw new Error("可能性评分必须在0-100之间");
        }
        if (dto.consequenceScore < 0 || dto.consequenceScore > 100) {
          throw new Error("后果评分必须在0-100之间");
        }

        const totalScore = calculateRiskScore(dto.likelihoodScore, dto.consequenceScore);
        const riskLevel = determineRiskLevel(totalScore);
        const mitigationMeasures = generateMitigationMeasures(
          riskLevel,
          dto.likelihoodScore,
          dto.consequenceScore
        );

        const assessment = assessmentRepository.create({
          hazardId: dto.hazardId,
          pipelineId: hazard.pipelineId,
          assessmentDate: new Date(),
          overallRiskScore: totalScore,
          overallRiskLevel: riskLevel,
          likelihoodScore: dto.likelihoodScore,
          likelihoodAgeScore: dto.likelihoodAgeScore,
          likelihoodMaterialScore: dto.likelihoodMaterialScore,
          likelihoodCorrosionScore: dto.likelihoodCorrosionScore,
          likelihoodPressureScore: dto.likelihoodPressureScore,
          likelihoodLeakHistoryScore: dto.likelihoodLeakHistoryScore,
          consequenceScore: dto.consequenceScore,
          consequencePopulationScore: dto.consequencePopulationScore,
          consequenceEnvironmentScore: dto.consequenceEnvironmentScore,
          consequenceEconomicScore: dto.consequenceEconomicScore,
          consequenceTrafficScore: dto.consequenceTrafficScore,
          consequencePropertyScore: dto.consequencePropertyScore,
          assessmentMethod: dto.assessmentMethod || "综合评分法",
          analysisDetails: dto.analysisDetails,
          mitigationMeasures: mitigationMeasures.join("; "),
          nextAssessmentDate: calculateNextAssessmentDate(riskLevel),
          createdBy: userId,
          updatedBy: userId,
          remarks: dto.remarks,
        });

        await queryRunner.manager.save(assessment);

        hazard.riskScore = totalScore;
        hazard.riskLevel = riskLevel;
        hazard.likelihoodScore = dto.likelihoodScore;
        hazard.consequenceScore = dto.consequenceScore;
        hazard.updatedBy = userId;

        await queryRunner.manager.save(hazard);

        result.success++;
        result.results.push({
          hazardId: dto.hazardId,
          success: true,
          score: totalScore,
          riskLevel,
        });
      } catch (error: any) {
        result.failed++;
        result.results.push({
          hazardId: dto.hazardId,
          success: false,
          error: error.message || "未知错误",
        });
      }
    }

    await queryRunner.commitTransaction();
  } catch (error) {
    await queryRunner.rollbackTransaction();
    throw error;
  } finally {
    await queryRunner.release();
  }

  return result;
}

export async function getRiskStatistics(): Promise<RiskStatistics> {
  const allAssessments = await assessmentRepository.find();
  const totalCount = allAssessments.length;

  if (totalCount === 0) {
    return {
      byRiskLevel: Object.values(RiskLevel).map((riskLevel) => ({
        riskLevel,
        count: 0,
        percentage: 0,
        avgScore: 0,
      })),
      total: {
        count: 0,
        avgScore: 0,
      },
    };
  }

  const totalScore = allAssessments.reduce(
    (sum: number, a: RiskAssessment) => sum + (a.overallRiskScore || 0),
    0
  );

  const byRiskLevel = Object.values(RiskLevel).map((riskLevel) => {
    const filtered = allAssessments.filter(
      (a: RiskAssessment) => a.overallRiskLevel === riskLevel
    );
    const count = filtered.length;
    const avgScore =
      count > 0
        ? filtered.reduce((sum: number, a: RiskAssessment) => sum + (a.overallRiskScore || 0), 0) /
          count
        : 0;

    return {
      riskLevel,
      count,
      percentage: Math.round((count / totalCount) * 100 * 100) / 100,
      avgScore: Math.round(avgScore * 100) / 100,
    };
  });

  return {
    byRiskLevel,
    total: {
      count: totalCount,
      avgScore: Math.round((totalScore / totalCount) * 100) / 100,
    },
  };
}

function calculateNextAssessmentDate(riskLevel: RiskLevel): Date {
  const now = new Date();
  switch (riskLevel) {
    case RiskLevel.VERY_HIGH:
      return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    case RiskLevel.HIGH:
      return new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    case RiskLevel.MEDIUM:
      return new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000);
    case RiskLevel.LOW:
      return new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
    default:
      return new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000);
  }
}
