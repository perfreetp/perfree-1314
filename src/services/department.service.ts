import { AppDataSource } from "../config/data-source";
import { Department } from "../entities/Department.entity";
import { PipelineType } from "../types/enums";
import { throwApiError } from "../utils/response";
import { PaginationParams, paginateQuery } from "../utils/pagination";
import { getUsersByDepartmentIds } from "./user.service";

export interface CreateDepartmentDto {
  name: string;
  code: string;
  description?: string;
  parentId?: string;
  responsibleTypes?: PipelineType[];
  responsibleArea?: any;
  contactPhone?: string;
  contactEmail?: string;
}

export interface UpdateDepartmentDto extends Partial<CreateDepartmentDto> {}

export interface DepartmentListFilters extends PaginationParams {
  parentId?: string;
  keyword?: string;
}

export interface DepartmentTree extends Department {
  children: DepartmentTree[];
}

const departmentRepository = AppDataSource.getRepository(Department);

export async function createDepartment(
  dto: CreateDepartmentDto,
  userId?: string
): Promise<Department> {
  const existingDepartment = await departmentRepository.findOne({
    where: { code: dto.code },
  });

  if (existingDepartment) {
    throwApiError("部门编码已存在", 409);
  }

  if (dto.parentId) {
    const parentDepartment = await departmentRepository.findOne({
      where: { id: dto.parentId },
    });
    if (!parentDepartment) {
      throwApiError("父部门不存在", 404);
    }
  }

  const department = departmentRepository.create({
    ...dto,
    createdBy: userId,
    updatedBy: userId,
  });

  return await departmentRepository.save(department);
}

export async function getDepartment(id: string): Promise<Department> {
  const department = await departmentRepository.findOne({
    where: { id },
    relations: ["parent", "children", "users"],
  });

  if (!department) {
    throwApiError("部门不存在", 404);
  }

  return department;
}

export async function updateDepartment(
  id: string,
  dto: UpdateDepartmentDto,
  userId?: string
): Promise<Department> {
  const department = await departmentRepository.findOne({ where: { id } });

  if (!department) {
    throwApiError("部门不存在", 404);
  }

  if (dto.code && dto.code !== department.code) {
    const existingDepartment = await departmentRepository.findOne({
      where: { code: dto.code },
    });
    if (existingDepartment) {
      throwApiError("部门编码已存在", 409);
    }
  }

  if (dto.parentId && dto.parentId !== department.parentId) {
    if (dto.parentId === id) {
      throwApiError("不能将自己设为父部门", 400);
    }
    const parentDepartment = await departmentRepository.findOne({
      where: { id: dto.parentId },
    });
    if (!parentDepartment) {
      throwApiError("父部门不存在", 404);
    }

    const childDepartments = await departmentRepository.find({
      where: { parentId: id },
    });
    const checkCycle = async (parentId: string): Promise<boolean> => {
      if (parentId === id) return true;
      const dept = await departmentRepository.findOne({ where: { id: parentId } });
      if (!dept || !dept.parentId) return false;
      return checkCycle(dept.parentId);
    };
    if (await checkCycle(dto.parentId)) {
      throwApiError("不能形成循环的部门层级", 400);
    }
  }

  const updated = departmentRepository.merge(department, {
    ...dto,
    updatedBy: userId,
  });

  return await departmentRepository.save(updated);
}

export async function deleteDepartment(id: string): Promise<void> {
  const department = await departmentRepository.findOne({
    where: { id },
    relations: ["children", "users"],
  });

  if (!department) {
    throwApiError("部门不存在", 404);
  }

  if (department.children && department.children.length > 0) {
    throwApiError("该部门下有子部门，无法删除", 400);
  }

  if (department.users && department.users.length > 0) {
    throwApiError("该部门下有用户，无法删除", 400);
  }

  await departmentRepository.softDelete(id);
}

export async function listDepartments(filters: DepartmentListFilters) {
  const { page, pageSize, ...queryFilters } = filters;

  const qb = departmentRepository
    .createQueryBuilder("department")
    .leftJoinAndSelect("department.parent", "parent")
    .leftJoinAndSelect("department.users", "users")
    .where("department.deletedAt IS NULL");

  if (queryFilters.parentId !== undefined) {
    if (queryFilters.parentId === null) {
      qb.andWhere("department.parentId IS NULL");
    } else {
      qb.andWhere("department.parentId = :parentId", { parentId: queryFilters.parentId });
    }
  }

  if (queryFilters.keyword) {
    qb.andWhere(
      "(department.name LIKE :keyword OR department.code LIKE :keyword)",
      { keyword: `%${queryFilters.keyword}%` }
    );
  }

  qb.orderBy("department.createdAt", "DESC");

  return await paginateQuery(qb, { page, pageSize });
}

export async function getAllDepartments(): Promise<Department[]> {
  return await departmentRepository.find({
    where: { deletedAt: null as any },
    relations: ["parent", "children"],
    order: { createdAt: "DESC" },
  });
}

export async function getDepartmentTree(rootId?: string): Promise<DepartmentTree[]> {
  const allDepartments = await getAllDepartments();

  const departmentMap = new Map<string, DepartmentTree>();

  allDepartments.forEach((dept) => {
    departmentMap.set(dept.id, { ...dept, children: [] });
  });

  const rootDepartments: DepartmentTree[] = [];

  departmentMap.forEach((dept) => {
    if (dept.parentId) {
      const parent = departmentMap.get(dept.parentId);
      if (parent) {
        parent.children.push(dept);
      }
    } else {
      rootDepartments.push(dept);
    }
  });

  const sortTree = (nodes: DepartmentTree[]): DepartmentTree[] => {
    return nodes
      .sort((a, b) => a.code.localeCompare(b.code))
      .map((node) => ({
        ...node,
        children: sortTree(node.children),
      }));
  };

  const sortedTree = sortTree(rootDepartments);

  if (rootId) {
    const findSubtree = (nodes: DepartmentTree[]): DepartmentTree[] => {
      for (const node of nodes) {
        if (node.id === rootId) {
          return [node];
        }
        if (node.children.length > 0) {
          const found = findSubtree(node.children);
          if (found.length > 0) return found;
        }
      }
      return [];
    };
    return findSubtree(sortedTree);
  }

  return sortedTree;
}

async function getAllChildDepartmentIds(
  departmentId: string,
  deptMap: Map<string, Department>
): Promise<string[]> {
  const result: string[] = [departmentId];

  const findChildren = (parentId: string) => {
    deptMap.forEach((dept) => {
      if (dept.parentId === parentId) {
        result.push(dept.id);
        findChildren(dept.id);
      }
    });
  };

  findChildren(departmentId);
  return result;
}

export async function getUsersByDepartmentTree(departmentId: string) {
  const department = await departmentRepository.findOne({ where: { id: departmentId } });
  if (!department) {
    throwApiError("部门不存在", 404);
  }

  const allDepartments = await departmentRepository.find({
    where: { deletedAt: null as any },
  });
  const deptMap = new Map<string, Department>();
  allDepartments.forEach((dept) => deptMap.set(dept.id, dept));

  const departmentIds = await getAllChildDepartmentIds(departmentId, deptMap);

  return await getUsersByDepartmentIds(departmentIds);
}
