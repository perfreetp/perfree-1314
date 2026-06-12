import { Request, Response } from "express";
import { successResponse, throwApiError } from "../utils/response";
import * as roadImpactService from "../services/roadImpact.service";

export async function getRoadImpactsByApplication(req: Request, res: Response) {
  const { id } = req.params;
  if (!id) {
    throwApiError("申请ID不能为空", 400);
  }
  const impacts = await roadImpactService.getRoadImpactsByApplication(id);
  return successResponse(res, impacts, "查询成功");
}

export async function calculateRoadImpact(req: Request, res: Response) {
  const { id } = req.params;
  if (!id) {
    throwApiError("申请ID不能为空", 400);
  }
  const { bufferDistance } = req.body;
  const result = await roadImpactService.calculateRoadImpact({
    applicationId: id,
    bufferDistance: bufferDistance,
  });
  return successResponse(res, result, "道路影响计算完成");
}

export async function assessTrafficImpact(req: Request, res: Response) {
  const { id } = req.params;
  if (!id) {
    throwApiError("申请ID不能为空", 400);
  }
  const impacts = await roadImpactService.getRoadImpactsByApplication(id);
  const excavationService = await import("../services/excavation.service");
  const application = await excavationService.getExcavation(id);
  const assessment = await roadImpactService.assessTrafficImpact(application, impacts);
  return successResponse(res, assessment, "交通影响评估完成");
}

export async function generateDetourSuggestions(req: Request, res: Response) {
  const { id } = req.params;
  if (!id) {
    throwApiError("申请ID不能为空", 400);
  }
  const impacts = await roadImpactService.getRoadImpactsByApplication(id);
  const excavationService = await import("../services/excavation.service");
  const application = await excavationService.getExcavation(id);
  const suggestions = roadImpactService.generateDetourSuggestions(application, impacts);
  return successResponse(res, suggestions, "绕行建议生成完成");
}

export async function getAffectedRoadsStatistics(req: Request, res: Response) {
  const applicationId = req.query.applicationId as string | undefined;
  const statistics = await roadImpactService.getAffectedRoadsStatistics(applicationId);
  return successResponse(res, statistics, "统计成功");
}
