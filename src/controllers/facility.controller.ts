import { Request, Response, NextFunction } from "express";
import {
  createFacility,
  getFacilityById,
  getFacilities,
  updateFacility,
  deleteFacility,
  getFacilitiesByType,
  getFacilitiesByPipeline,
  getValvesForClosure,
  updateValveStatus,
  getFacilityStatistics,
  getFacilitiesByGeometry,
  checkValveAccessibility,
  getMaintenanceHistory,
  FacilityCreateData,
  FacilityUpdateData,
} from "../services/facility.service";
import { FacilityType, ValveStatus } from "../types/enums";
import { successResponse, throwApiError } from "../utils/response";
import { FindOptionsWhere } from "typeorm";
import { Facility } from "../entities/Facility.entity";

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const data = req.body as FacilityCreateData;
    const facility = await createFacility(data);
    successResponse(res, facility, "创建设施成功");
  } catch (error) {
    next(error);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const facility = await getFacilityById(id);
    successResponse(res, facility, "获取设施成功");
  } catch (error) {
    next(error);
  }
}

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const { page, pageSize, type, status, departmentId, pipelineId } = req.query;

    const filters: FindOptionsWhere<Facility> = {};
    if (type) filters.type = type as FacilityType;
    if (status) filters.status = status as ValveStatus;
    if (departmentId) filters.departmentId = departmentId as string;
    if (pipelineId) filters.pipelineId = pipelineId as string;

    const pagination = {
      page: page ? parseInt(page as string) : undefined,
      pageSize: pageSize ? parseInt(pageSize as string) : undefined,
    };

    const result = await getFacilities(filters, pagination);
    successResponse(res, result.data, "获取设施列表成功", {
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    });
  } catch (error) {
    next(error);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const data = req.body as FacilityUpdateData;
    const facility = await updateFacility(id, data);
    successResponse(res, facility, "更新设施成功");
  } catch (error) {
    next(error);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    await deleteFacility(id);
    successResponse(res, null, "删除设施成功");
  } catch (error) {
    next(error);
  }
}

export async function getValves(req: Request, res: Response, next: NextFunction) {
  try {
    const { page, pageSize, pipelineId } = req.query;

    const pagination = {
      page: page ? parseInt(page as string) : undefined,
      pageSize: pageSize ? parseInt(pageSize as string) : undefined,
    };

    const result = await getValvesForClosure(pipelineId as string, pagination);
    successResponse(res, result.data, "获取阀门列表成功", {
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    });
  } catch (error) {
    next(error);
  }
}

export async function getManholes(req: Request, res: Response, next: NextFunction) {
  try {
    const { page, pageSize } = req.query;

    const pagination = {
      page: page ? parseInt(page as string) : undefined,
      pageSize: pageSize ? parseInt(pageSize as string) : undefined,
    };

    const result = await getFacilitiesByType(FacilityType.MANHOLE, pagination);
    successResponse(res, result.data, "获取井盖列表成功", {
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateValveStatusController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = req.params;
    const { status, operatorId } = req.body;

    if (!status) {
      throwApiError("状态不能为空", 400);
    }

    const validStatuses = [
      ValveStatus.OPEN,
      ValveStatus.CLOSED,
      ValveStatus.PARTIAL,
      ValveStatus.MAINTENANCE,
      ValveStatus.FAULT,
    ];

    if (!validStatuses.includes(status as ValveStatus)) {
      throwApiError("无效的阀门状态", 400);
    }

    const facility = await updateValveStatus(id, status as ValveStatus, operatorId);
    successResponse(res, facility, "更新阀门状态成功");
  } catch (error) {
    next(error);
  }
}

export async function getStatistics(req: Request, res: Response, next: NextFunction) {
  try {
    const statistics = await getFacilityStatistics();
    successResponse(res, statistics, "获取设施统计成功");
  } catch (error) {
    next(error);
  }
}

export async function listByType(req: Request, res: Response, next: NextFunction) {
  try {
    const { type } = req.params;
    const { page, pageSize } = req.query;

    if (!Object.values(FacilityType).includes(type as FacilityType)) {
      throwApiError("无效的设施类型", 400);
    }

    const pagination = {
      page: page ? parseInt(page as string) : undefined,
      pageSize: pageSize ? parseInt(pageSize as string) : undefined,
    };

    const result = await getFacilitiesByType(type as FacilityType, pagination);
    successResponse(res, result.data, "获取设施列表成功", {
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    });
  } catch (error) {
    next(error);
  }
}

export async function listByPipeline(req: Request, res: Response, next: NextFunction) {
  try {
    const { pipelineId } = req.params;
    const { page, pageSize } = req.query;

    const pagination = {
      page: page ? parseInt(page as string) : undefined,
      pageSize: pageSize ? parseInt(pageSize as string) : undefined,
    };

    const result = await getFacilitiesByPipeline(pipelineId, pagination);
    successResponse(res, result.data, "获取管线上的设施成功", {
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    });
  } catch (error) {
    next(error);
  }
}

export async function queryByGeometry(req: Request, res: Response, next: NextFunction) {
  try {
    const { geometry, relation, type, status, departmentId, page, pageSize } = req.body;

    if (!geometry) {
      throwApiError("几何数据不能为空", 400);
    }

    const filters: FindOptionsWhere<Facility> = {};
    if (type) filters.type = type as FacilityType;
    if (status) filters.status = status as ValveStatus;
    if (departmentId) filters.departmentId = departmentId as string;

    const pagination = {
      page: page ? parseInt(page as string) : undefined,
      pageSize: pageSize ? parseInt(pageSize as string) : undefined,
    };

    const result = await getFacilitiesByGeometry(
      { geometry, relation: relation as "intersects" | "contains" | "within" },
      filters,
      pagination
    );

    successResponse(res, result.data, "空间查询成功", {
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    });
  } catch (error) {
    next(error);
  }
}

export async function checkAccessibility(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { targetPoint, maxDistance } = req.body;

    if (!targetPoint || !Array.isArray(targetPoint) || targetPoint.length !== 2) {
      throwApiError("目标点坐标无效", 400);
    }

    const result = await checkValveAccessibility(
      id,
      targetPoint as [number, number],
      maxDistance ? Number(maxDistance) : undefined
    );

    successResponse(res, result, "检查阀门可达性成功");
  } catch (error) {
    next(error);
  }
}

export async function getHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { page, pageSize } = req.query;

    const pagination = {
      page: page ? parseInt(page as string) : undefined,
      pageSize: pageSize ? parseInt(pageSize as string) : undefined,
    };

    const result = await getMaintenanceHistory(id, pagination);
    successResponse(res, result.data, "获取维护历史成功", {
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    });
  } catch (error) {
    next(error);
  }
}
