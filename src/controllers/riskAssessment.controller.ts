import { Request, Response } from "express";
import { successResponse, throwApiError } from "../utils/response";
import * as riskAssessmentService from "../services/riskAssessment.service";

export async function createRiskAssessment(req: Request, res: Response) {
  const userId = (req as any).user?.id;
  const assessment = await riskAssessmentService.createRiskAssessment(req.body, userId);
  return successResponse(res, assessment, "风险评估创建成功");
}

export async function getRiskAssessment(req: Request, res: Response) {
  const { id } = req.params;
  if (!id) {
    throwApiError("风险评估ID不能为空", 400);
  }
  const assessment = await riskAssessmentService.getRiskAssessment(id);
  return successResponse(res, assessment, "查询成功");
}

export async function updateRiskAssessment(req: Request, res: Response) {
  const { id } = req.params;
  if (!id) {
    throwApiError("风险评估ID不能为空", 400);
  }
  const userId = (req as any).user?.id;
  const assessment = await riskAssessmentService.updateRiskAssessment(id, req.body, userId);
  return successResponse(res, assessment, "风险评估更新成功");
}

export async function deleteRiskAssessment(req: Request, res: Response) {
  const { id } = req.params;
  if (!id) {
    throwApiError("风险评估ID不能为空", 400);
  }
  await riskAssessmentService.deleteRiskAssessment(id);
  return successResponse(res, null, "风险评估删除成功");
}

export async function listRiskAssessments(req: Request, res: Response) {
  const filters = {
    page: req.query.page ? parseInt(req.query.page as string) : undefined,
    pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string) : undefined,
    pipelineId: req.query.pipelineId as string,
    hazardId: req.query.hazardId as string,
    overallRiskLevel: req.query.overallRiskLevel as any,
    startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
    endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
  };

  const result = await riskAssessmentService.listRiskAssessments(filters);
  return successResponse(res, result.data, "查询成功", {
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
  });
}

export async function assessHazardRisk(req: Request, res: Response) {
  const userId = (req as any).user?.id;
  const assessment = await riskAssessmentService.assessHazardRisk(req.body, userId);
  return successResponse(res, assessment, "隐患风险评估完成");
}

export async function assessPipelineRisk(req: Request, res: Response) {
  const userId = (req as any).user?.id;
  const assessment = await riskAssessmentService.assessPipelineRisk(req.body, userId);
  return successResponse(res, assessment, "管线风险评估完成");
}

export async function getRiskAssessmentHistory(req: Request, res: Response) {
  const hazardId = req.query.hazardId as string;
  const pipelineId = req.query.pipelineId as string;

  if (!hazardId && !pipelineId) {
    throwApiError("必须指定隐患ID或管线ID", 400);
  }

  const filters = {
    page: req.query.page ? parseInt(req.query.page as string) : undefined,
    pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string) : undefined,
  };

  const result = await riskAssessmentService.getRiskAssessmentHistory(
    hazardId,
    pipelineId,
    filters
  );
  return successResponse(res, result.data, "查询成功", {
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
  });
}

export async function batchAssessRisks(req: Request, res: Response) {
  const { assessments } = req.body;
  if (!assessments || !Array.isArray(assessments)) {
    throwApiError("评估数据不能为空且必须为数组", 400);
  }
  const userId = (req as any).user?.id;
  const result = await riskAssessmentService.batchAssessRisks(assessments, userId);
  return successResponse(res, result, "批量评估完成");
}

export async function getRiskStatistics(req: Request, res: Response) {
  const statistics = await riskAssessmentService.getRiskStatistics();
  return successResponse(res, statistics, "统计成功");
}

export async function calculateRiskScore(req: Request, res: Response) {
  const { likelihoodScore, consequenceScore } = req.body;
  if (likelihoodScore === undefined || consequenceScore === undefined) {
    throwApiError("可能性评分和后果评分不能为空", 400);
  }
  const score = riskAssessmentService.calculateRiskScore(
    parseFloat(likelihoodScore),
    parseFloat(consequenceScore)
  );
  const riskLevel = riskAssessmentService.determineRiskLevel(score);
  const mitigationMeasures = riskAssessmentService.generateMitigationMeasures(
    riskLevel,
    parseFloat(likelihoodScore),
    parseFloat(consequenceScore)
  );
  return successResponse(
    res,
    { score, riskLevel, mitigationMeasures },
    "计算成功"
  );
}
