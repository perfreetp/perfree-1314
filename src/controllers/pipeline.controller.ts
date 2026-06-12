import { Request, Response } from "express";
import { successResponse, throwApiError } from "../utils/response";
import * as pipelineService from "../services/pipeline.service";

export async function createPipeline(req: Request, res: Response) {
  const userId = (req as any).user?.id;
  const pipeline = await pipelineService.createPipeline(req.body, userId);
  return successResponse(res, pipeline, "管线创建成功");
}

export async function getPipeline(req: Request, res: Response) {
  const { id } = req.params;
  if (!id) {
    throwApiError("管线ID不能为空", 400);
  }
  const pipeline = await pipelineService.getPipeline(id);
  return successResponse(res, pipeline, "查询成功");
}

export async function updatePipeline(req: Request, res: Response) {
  const { id } = req.params;
  if (!id) {
    throwApiError("管线ID不能为空", 400);
  }
  const userId = (req as any).user?.id;
  const pipeline = await pipelineService.updatePipeline(id, req.body, userId);
  return successResponse(res, pipeline, "管线更新成功");
}

export async function deletePipeline(req: Request, res: Response) {
  const { id } = req.params;
  if (!id) {
    throwApiError("管线ID不能为空", 400);
  }
  const userId = (req as any).user?.id;
  await pipelineService.deletePipeline(id, userId);
  return successResponse(res, null, "管线删除成功");
}

export async function listPipelines(req: Request, res: Response) {
  const filters = {
    page: req.query.page ? parseInt(req.query.page as string) : undefined,
    pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string) : undefined,
    type: req.query.type as any,
    status: req.query.status as any,
    material: req.query.material as any,
    departmentId: req.query.departmentId as string,
    code: req.query.code as string,
    name: req.query.name as string,
    riskScoreMin: req.query.riskScoreMin
      ? parseFloat(req.query.riskScoreMin as string)
      : undefined,
    riskScoreMax: req.query.riskScoreMax
      ? parseFloat(req.query.riskScoreMax as string)
      : undefined,
  };

  const result = await pipelineService.listPipelines(filters);
  return successResponse(res, result.data, "查询成功", {
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
  });
}

export async function getUpstreamPipelines(req: Request, res: Response) {
  const { id } = req.params;
  if (!id) {
    throwApiError("管线ID不能为空", 400);
  }
  const maxDepth = req.query.maxDepth ? parseInt(req.query.maxDepth as string) : 5;
  const pipelines = await pipelineService.getUpstreamPipelines(id, maxDepth);
  return successResponse(res, pipelines, "查询成功");
}

export async function getDownstreamPipelines(req: Request, res: Response) {
  const { id } = req.params;
  if (!id) {
    throwApiError("管线ID不能为空", 400);
  }
  const maxDepth = req.query.maxDepth ? parseInt(req.query.maxDepth as string) : 5;
  const pipelines = await pipelineService.getDownstreamPipelines(id, maxDepth);
  return successResponse(res, pipelines, "查询成功");
}

export async function getConnectedPipelines(req: Request, res: Response) {
  const { id } = req.params;
  if (!id) {
    throwApiError("管线ID不能为空", 400);
  }
  const pipelines = await pipelineService.getConnectedPipelines(id);
  return successResponse(res, pipelines, "查询成功");
}

export async function getSectionOccupancy(req: Request, res: Response) {
  const { point, radius } = req.query;
  if (!point) {
    throwApiError("点位坐标不能为空", 400);
  }

  let pointCoords: number[];
  try {
    if (typeof point === "string") {
      pointCoords = JSON.parse(point);
    } else if (Array.isArray(point)) {
      pointCoords = point.map((coord) =>
        typeof coord === "string" ? parseFloat(coord) : Number(coord)
      );
    } else {
      pointCoords = point as any;
    }
    if (!Array.isArray(pointCoords) || pointCoords.length !== 2) {
      throw new Error();
    }
  } catch {
    throwApiError("点位坐标格式错误，应为 [lng, lat] 数组", 400);
  }

  const result = await pipelineService.getSectionOccupancy({
    point: pointCoords,
    radius: radius ? parseFloat(radius as string) : undefined,
  });
  return successResponse(res, result, "查询成功");
}

export async function getPipelinesByGeometry(req: Request, res: Response) {
  const { geometry, relation, page, pageSize } = req.body;
  if (!geometry) {
    throwApiError("几何对象不能为空", 400);
  }

  const pagination =
    page || pageSize
      ? {
          page: page ? parseInt(page as string) : undefined,
          pageSize: pageSize ? parseInt(pageSize as string) : undefined,
        }
      : undefined;

  const result = await pipelineService.getPipelinesByGeometry(
    {
      geometry,
      relation: relation as any,
    },
    pagination
  );

  if (pagination) {
    return successResponse(res, result.data, "查询成功", {
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    });
  }

  return successResponse(res, result.data, "查询成功");
}

export async function getPipelineStatistics(req: Request, res: Response) {
  const filters = {
    type: req.query.type as any,
    status: req.query.status as any,
    material: req.query.material as any,
    departmentId: req.query.departmentId as string,
    code: req.query.code as string,
    name: req.query.name as string,
    riskScoreMin: req.query.riskScoreMin
      ? parseFloat(req.query.riskScoreMin as string)
      : undefined,
    riskScoreMax: req.query.riskScoreMax
      ? parseFloat(req.query.riskScoreMax as string)
      : undefined,
  };
  const statistics = await pipelineService.getPipelineStatistics(filters);
  return successResponse(res, statistics, "统计成功");
}

export async function calculateRiskScore(req: Request, res: Response) {
  const factors = req.body;
  if (!factors) {
    throwApiError("风险评分因子不能为空", 400);
  }
  const score = pipelineService.calculateRiskScore(factors);
  return successResponse(res, { score }, "计算成功");
}

export async function calculatePipelineAge(req: Request, res: Response) {
  const { id } = req.params;
  if (!id) {
    throwApiError("管线ID不能为空", 400);
  }
  const pipeline = await pipelineService.getPipeline(id);
  const age = pipelineService.calculatePipelineAge(pipeline);
  return successResponse(res, { age }, "计算成功");
}
