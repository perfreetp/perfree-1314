import { Request, Response } from "express";
import { successResponse, throwApiError } from "../utils/response";
import * as emergencyService from "../services/emergency.service";

export async function generateValveClosurePlan(req: Request, res: Response) {
  const userId = (req as any).user?.id;
  const { incidentLocation, ...rest } = req.body;

  if (!incidentLocation) {
    throwApiError("事故点位不能为空", 400);
  }

  let locationCoords: number[];
  try {
    if (typeof incidentLocation === "string") {
      locationCoords = JSON.parse(incidentLocation);
    } else if (Array.isArray(incidentLocation)) {
      locationCoords = incidentLocation.map((coord) =>
        typeof coord === "string" ? parseFloat(coord) : (coord as number)
      );
    } else {
      locationCoords = incidentLocation as unknown as number[];
    }
    if (!Array.isArray(locationCoords) || locationCoords.length !== 2) {
      throw new Error();
    }
  } catch {
    throwApiError("事故点位格式错误，应为 [lng, lat] 数组", 400);
  }

  const plan = await emergencyService.generateValveClosurePlan(
    {
      ...rest,
      incidentLocation: locationCoords,
    },
    userId
  );

  return successResponse(res, plan, "关阀方案生成成功");
}

export async function getValveClosurePlan(req: Request, res: Response) {
  const { id } = req.params;
  if (!id) {
    throwApiError("方案ID不能为空", 400);
  }

  const plan = await emergencyService.getValveClosurePlan(id);
  return successResponse(res, plan, "查询成功");
}

export async function getValveClosurePlanByIncident(req: Request, res: Response) {
  const { incidentId } = req.params;
  if (!incidentId) {
    throwApiError("事故ID不能为空", 400);
  }

  const plan = await emergencyService.getValveClosurePlanByIncident(incidentId);
  return successResponse(res, plan, "查询成功");
}

export async function getValveClosurePlans(req: Request, res: Response) {
  const filters = {
    page: req.query.page ? parseInt(req.query.page as string) : undefined,
    pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string) : undefined,
    status: req.query.status as string,
    incidentId: req.query.incidentId as string,
    alertId: req.query.alertId as string,
    pipelineId: req.query.pipelineId as string,
    priority: req.query.priority as any,
  };

  const result = await emergencyService.getClosurePlans(filters);
  return successResponse(res, result.data, "查询成功", {
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
  });
}

export async function executeClosureStep(req: Request, res: Response) {
  const { id, stepId } = req.params;
  const userId = (req as any).user?.id;

  if (!id || !stepId) {
    throwApiError("方案ID和步骤ID不能为空", 400);
  }

  const step = await emergencyService.executeClosureStep(id, stepId, req.body, userId);
  return successResponse(res, step, "关阀步骤执行成功");
}

export async function completeClosurePlan(req: Request, res: Response) {
  const { id } = req.params;
  const userId = (req as any).user?.id;

  if (!id) {
    throwApiError("方案ID不能为空", 400);
  }

  const plan = await emergencyService.completeClosurePlan(id, userId);
  return successResponse(res, plan, "关阀方案完成成功");
}

export async function calculateIsolationArea(req: Request, res: Response) {
  const { planId, bufferDistance } = req.body;

  if (!planId) {
    throwApiError("方案ID不能为空", 400);
  }

  const result = await emergencyService.calculateIsolationArea({
    planId,
    bufferDistance: bufferDistance ? parseFloat(bufferDistance as string) : undefined,
  });

  return successResponse(res, result, "隔离区域计算成功");
}

export async function estimateAffectedUsers(req: Request, res: Response) {
  const { planId } = req.params;

  if (!planId) {
    throwApiError("方案ID不能为空", 400);
  }

  const result = await emergencyService.estimateAffectedUsers(planId);
  return successResponse(res, result, "受影响用户估算成功");
}
