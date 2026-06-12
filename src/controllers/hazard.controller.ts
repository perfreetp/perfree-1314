import { Request, Response } from "express";
import { successResponse, throwApiError } from "../utils/response";
import * as hazardService from "../services/hazard.service";

export async function createHazard(req: Request, res: Response) {
  const userId = (req as any).user?.id;
  const hazard = await hazardService.createHazardPoint(req.body, userId);
  return successResponse(res, hazard, "隐患创建成功");
}

export async function getHazard(req: Request, res: Response) {
  const { id } = req.params;
  if (!id) {
    throwApiError("隐患ID不能为空", 400);
  }
  const hazard = await hazardService.getHazardPoint(id);
  return successResponse(res, hazard, "查询成功");
}

export async function updateHazard(req: Request, res: Response) {
  const { id } = req.params;
  if (!id) {
    throwApiError("隐患ID不能为空", 400);
  }
  const userId = (req as any).user?.id;
  const hazard = await hazardService.updateHazardPoint(id, req.body, userId);
  return successResponse(res, hazard, "隐患更新成功");
}

export async function deleteHazard(req: Request, res: Response) {
  const { id } = req.params;
  if (!id) {
    throwApiError("隐患ID不能为空", 400);
  }
  const userId = (req as any).user?.id;
  await hazardService.deleteHazardPoint(id, userId);
  return successResponse(res, null, "隐患删除成功");
}

export async function listHazards(req: Request, res: Response) {
  const filters = {
    page: req.query.page ? parseInt(req.query.page as string) : undefined,
    pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string) : undefined,
    type: req.query.type as any,
    riskLevel: req.query.riskLevel as any,
    pipelineId: req.query.pipelineId as string,
    facilityId: req.query.facilityId as string,
    departmentId: req.query.departmentId as string,
    isRepaired: req.query.isRepaired !== undefined ? req.query.isRepaired === "true" : undefined,
    code: req.query.code as string,
    title: req.query.title as string,
    sharingLevel: req.query.sharingLevel as any,
  };

  const result = await hazardService.listHazardPoints(filters);
  return successResponse(res, result.data, "查询成功", {
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
  });
}

export async function annotateHazard(req: Request, res: Response) {
  const { id } = req.params;
  if (!id) {
    throwApiError("隐患ID不能为空", 400);
  }
  const userId = (req as any).user?.id;
  const hazard = await hazardService.annotateHazardPoint(id, req.body, userId);
  return successResponse(res, hazard, "隐患标注成功");
}

export async function getHazardsByPipeline(req: Request, res: Response) {
  const { pipelineId } = req.params;
  if (!pipelineId) {
    throwApiError("管线ID不能为空", 400);
  }
  const filters = {
    page: req.query.page ? parseInt(req.query.page as string) : undefined,
    pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string) : undefined,
  };
  const result = await hazardService.getHazardsByPipeline(pipelineId, filters);
  return successResponse(res, result.data, "查询成功", {
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
  });
}

export async function getHazardsByGeometry(req: Request, res: Response) {
  const { geometry, relation, distance, page, pageSize } = req.body;
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

  const result = await hazardService.getHazardsByGeometry(
    {
      geometry,
      relation: relation as any,
      distance: distance ? parseFloat(distance as string) : undefined,
    },
    pagination
  );

  if (pagination) {
    return successResponse(res, result.data, "查询成功", {
      total: result.total,
      page: (result as any).page,
      pageSize: (result as any).pageSize,
    });
  }

  return successResponse(res, result.data, "查询成功");
}

export async function updateRepairStatus(req: Request, res: Response) {
  const { id } = req.params;
  if (!id) {
    throwApiError("隐患ID不能为空", 400);
  }
  const userId = (req as any).user?.id;
  const hazard = await hazardService.updateHazardRepairStatus(id, req.body, userId);
  return successResponse(res, hazard, "修复状态更新成功");
}

export async function getHazardStatistics(req: Request, res: Response) {
  const statistics = await hazardService.getHazardStatistics();
  return successResponse(res, statistics, "统计成功");
}

export async function linkHazardToWorkOrder(req: Request, res: Response) {
  const { id } = req.params;
  if (!id) {
    throwApiError("隐患ID不能为空", 400);
  }
  const userId = (req as any).user?.id;
  const hazard = await hazardService.linkHazardToWorkOrder(id, req.body, userId);
  return successResponse(res, hazard, "关联工单成功");
}

export async function batchImportHazards(req: Request, res: Response) {
  const { hazards } = req.body;
  if (!hazards || !Array.isArray(hazards)) {
    throwApiError("隐患数据不能为空且必须为数组", 400);
  }
  const userId = (req as any).user?.id;
  const result = await hazardService.batchImportHazards(hazards, userId);
  return successResponse(res, result, "批量导入完成");
}
