import { AppDataSource } from "../config/data-source";
import { ExcavationApplication } from "../entities/ExcavationApplication.entity";
import { ApplicationStatus, PipelineType, RiskLevel } from "../types/enums";
import { throwApiError } from "../utils/response";
import { PaginationParams } from "../utils/pagination";
import { parseGeometry, getCenter } from "../utils/spatial";

export interface CreateExcavationDto {
  projectName: string;
  projectDescription?: string;
  constructionUnit?: string;
  projectManager?: string;
  contactPhone?: string;
  plannedStartDate?: Date;
  plannedEndDate?: Date;
  excavationDepth?: number;
  excavationArea?: number;
  roadName?: string;
  applicantDepartmentId: string;
  excavationAreaGeometry?: any;
  centerPoint?: any;
  affectedPipelineTypes?: PipelineType[];
  hasUndergroundFacilities?: boolean;
  protectionMeasures?: string[];
  attachments?: string[];
  attributes?: Record<string, any>;
  remarks?: string;
}

export interface UpdateExcavationDto extends Partial<CreateExcavationDto> {}

export interface ExcavationListFilters extends PaginationParams {
  status?: ApplicationStatus;
  applicantDepartmentId?: string;
  projectName?: string;
  applicationNo?: string;
  hasConflict?: boolean;
}

export interface ReviewApplicationDto {
  status: ApplicationStatus.APPROVED | ApplicationStatus.REJECTED | ApplicationStatus.MODIFIED;
  reviewComments?: string;
}

export interface ExcavationStatistics {
  byStatus: Array<{
    status: ApplicationStatus;
    count: number;
  }>;
  total: {
    count: number;
  };
}

export interface SafetyVerificationResult {
  isSafe: boolean;
  riskLevel: RiskLevel;
  risks: Array<{
    type: string;
    description: string;
    severity: RiskLevel;
  }>;
  suggestions: string[];
}

const excavationRepository = AppDataSource.getRepository(ExcavationApplication);

function generateApplicationNo(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
  return `EXC-${year}${month}${day}-${random}`;
}

function getPaginationOptions(params: PaginationParams) {
  const page = Math.max(1, params.page || 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize || 20));
  const skip = (page - 1) * pageSize;
  return { skip, take: pageSize, page, pageSize };
}

export async function createExcavation(dto: CreateExcavationDto, userId?: string): Promise<ExcavationApplication> {
  const application = excavationRepository.create({
    ...dto,
    applicationNo: generateApplicationNo(),
    status: ApplicationStatus.DRAFT,
    applicantId: userId as string,
    createdBy: userId as string,
    updatedBy: userId as string,
  });

  if (dto.excavationAreaGeometry) {
    const geom = parseGeometry(dto.excavationAreaGeometry);
    if (geom) {
      const center = getCenter(geom);
      if (center) {
        application.centerPoint = {
          type: "Point",
          coordinates: center,
          srid: 4326,
        };
      }
    }
  }

  return await excavationRepository.save(application);
}

export async function getExcavation(id: string): Promise<ExcavationApplication> {
  const application = await excavationRepository.findOne({
    where: { id },
    relations: ["applicantDepartment", "applicant", "reviewer", "conflicts", "roadImpacts"],
  });
  if (!application) {
    throwApiError("开挖申请不存在", 404);
  }
  return application;
}

export async function updateExcavation(
  id: string,
  dto: UpdateExcavationDto,
  userId?: string
): Promise<ExcavationApplication> {
  const application = await getExcavation(id);

  if (application.status !== ApplicationStatus.DRAFT && application.status !== ApplicationStatus.MODIFIED) {
    throwApiError("只能修改草稿或待修改状态的申请", 400);
  }

  const updated = excavationRepository.merge(application, {
    ...dto,
    updatedBy: userId as string,
  });

  if (dto.excavationAreaGeometry) {
    const geom = parseGeometry(dto.excavationAreaGeometry);
    if (geom) {
      const center = getCenter(geom);
      if (center) {
        updated.centerPoint = {
          type: "Point",
          coordinates: center,
          srid: 4326,
        };
      }
    }
  }

  return await excavationRepository.save(updated);
}

export async function deleteExcavation(id: string): Promise<void> {
  const application = await getExcavation(id);
  if (application.status !== ApplicationStatus.DRAFT) {
    throwApiError("只能删除草稿状态的申请", 400);
  }
  await excavationRepository.softDelete(application.id);
}

export async function listExcavations(filters: ExcavationListFilters) {
  const { page, pageSize, ...queryFilters } = filters;
  const where: any = {};

  if (queryFilters.status) where.status = queryFilters.status;
  if (queryFilters.applicantDepartmentId) where.applicantDepartmentId = queryFilters.applicantDepartmentId;
  if (queryFilters.hasConflict !== undefined) where.hasConflict = queryFilters.hasConflict;

  const qb = excavationRepository
    .createQueryBuilder("excavation")
    .leftJoinAndSelect("excavation.applicantDepartment", "applicantDepartment")
    .leftJoinAndSelect("excavation.applicant", "applicant")
    .leftJoinAndSelect("excavation.reviewer", "reviewer");

  if (queryFilters.projectName) {
    qb.andWhere("excavation.projectName ILIKE :projectName", {
      projectName: `%${queryFilters.projectName}%`,
    });
  }

  if (queryFilters.applicationNo) {
    qb.andWhere("excavation.applicationNo ILIKE :applicationNo", {
      applicationNo: `%${queryFilters.applicationNo}%`,
    });
  }

  const { skip, take, page: currentPage, pageSize: size } = getPaginationOptions({
    page,
    pageSize,
  });

  const [data, total] = await qb.skip(skip).take(take).getManyAndCount();

  return {
    data,
    total,
    page: currentPage,
    pageSize: size,
  };
}

export async function submitApplication(id: string, userId?: string): Promise<ExcavationApplication> {
  const application = await getExcavation(id);

  if (application.status !== ApplicationStatus.DRAFT && application.status !== ApplicationStatus.MODIFIED) {
    throwApiError("只能提交草稿或待修改状态的申请", 400);
  }

  if (!application.excavationAreaGeometry) {
    throwApiError("请先设置开挖区域几何图形", 400);
  }

  application.status = ApplicationStatus.SUBMITTED;
  application.submittedAt = new Date();
  application.updatedBy = userId as string;

  return await excavationRepository.save(application);
}

export async function reviewApplication(
  id: string,
  dto: ReviewApplicationDto,
  userId?: string
): Promise<ExcavationApplication> {
  const application = await getExcavation(id);

  if (application.status !== ApplicationStatus.SUBMITTED && application.status !== ApplicationStatus.REVIEWING) {
    throwApiError("只能审核已提交或审核中的申请", 400);
  }

  application.status = dto.status;
  application.reviewComments = dto.reviewComments as string;
  application.reviewerId = userId as string;
  application.reviewedAt = new Date();
  application.updatedBy = userId as string;

  return await excavationRepository.save(application);
}

export async function getApplicationsByStatus(status: ApplicationStatus, pagination?: PaginationParams) {
  const filters: ExcavationListFilters = { status };
  if (pagination) {
    filters.page = pagination.page;
    filters.pageSize = pagination.pageSize;
  }
  return await listExcavations(filters);
}

export async function getApplicationsByDepartment(departmentId: string, pagination?: PaginationParams) {
  const filters: ExcavationListFilters = { applicantDepartmentId: departmentId };
  if (pagination) {
    filters.page = pagination.page;
    filters.pageSize = pagination.pageSize;
  }
  return await listExcavations(filters);
}

export async function verifyExcavationSafety(id: string): Promise<SafetyVerificationResult> {
  const application = await getExcavation(id);
  const risks: SafetyVerificationResult["risks"] = [];
  const suggestions: string[] = [];

  if (application.excavationDepth && application.excavationDepth > 5) {
    risks.push({
      type: "deep_excavation",
      description: `开挖深度 ${application.excavationDepth}m 超过5m，属于深基坑作业`,
      severity: RiskLevel.HIGH,
    });
    suggestions.push("需要编制专项施工方案并组织专家论证");
  }

  if (application.hasConflict) {
    risks.push({
      type: "pipeline_conflict",
      description: "开挖区域内存在管线冲突",
      severity: RiskLevel.HIGH,
    });
    suggestions.push("必须先解决管线冲突问题后方可施工");
  }

  if (application.hasUndergroundFacilities) {
    risks.push({
      type: "underground_facilities",
      description: "开挖区域内存在地下设施",
      severity: RiskLevel.MEDIUM,
    });
    suggestions.push("施工前需确认地下设施具体位置，采取保护措施");
  }

  if (application.affectedPipelineTypes && application.affectedPipelineTypes.length > 0) {
    if (application.affectedPipelineTypes.includes(PipelineType.GAS)) {
      risks.push({
        type: "gas_pipeline",
        description: "开挖区域影响燃气管道",
        severity: RiskLevel.VERY_HIGH,
      });
      suggestions.push("必须联系燃气公司进行现场监护，制定应急方案");
    }
    if (application.affectedPipelineTypes.includes(PipelineType.ELECTRIC)) {
      risks.push({
        type: "electric_pipeline",
        description: "开挖区域影响电力管线",
        severity: RiskLevel.HIGH,
      });
      suggestions.push("必须联系电力部门确认管线位置，采取绝缘保护措施");
    }
  }

  if (!application.protectionMeasures || application.protectionMeasures.length === 0) {
    risks.push({
      type: "no_protection",
      description: "未制定管线保护措施",
      severity: RiskLevel.MEDIUM,
    });
    suggestions.push("应制定详细的管线保护措施并经相关部门审批");
  }

  let riskLevel = RiskLevel.LOW;
  if (risks.some((r) => r.severity === RiskLevel.VERY_HIGH)) {
    riskLevel = RiskLevel.VERY_HIGH;
  } else if (risks.some((r) => r.severity === RiskLevel.HIGH)) {
    riskLevel = RiskLevel.HIGH;
  } else if (risks.some((r) => r.severity === RiskLevel.MEDIUM)) {
    riskLevel = RiskLevel.MEDIUM;
  }

  const isSafe = riskLevel === RiskLevel.LOW;

  return {
    isSafe,
    riskLevel,
    risks,
    suggestions,
  };
}

export async function completeApplication(id: string, userId?: string): Promise<ExcavationApplication> {
  const application = await getExcavation(id);

  if (application.status !== ApplicationStatus.APPROVED) {
    throwApiError("只能完成已通过审核的申请", 400);
  }

  application.status = ApplicationStatus.COMPLETED;
  application.updatedBy = userId as string;

  return await excavationRepository.save(application);
}

export async function getApplicationStatistics(): Promise<ExcavationStatistics> {
  const allApplications = await excavationRepository.find({ where: { deletedAt: null as any } });

  const byStatus = Object.values(ApplicationStatus).map((status) => {
    const filtered = allApplications.filter((a: ExcavationApplication) => a.status === status);
    return {
      status,
      count: filtered.length,
    };
  });

  const total = {
    count: allApplications.length,
  };

  return {
    byStatus,
    total,
  };
}
