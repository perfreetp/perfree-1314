import { FindManyOptions } from "typeorm";

export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

export interface PaginationResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export function getPaginationOptions(params: PaginationParams): {
  skip: number;
  take: number;
  page: number;
  pageSize: number;
} {
  const page = Math.max(1, params.page || 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize || 20));
  const skip = (page - 1) * pageSize;

  return { skip, take: pageSize, page, pageSize };
}

export function applyPagination<T>(
  options: FindManyOptions<T>,
  params: PaginationParams
): FindManyOptions<T> & { page: number; pageSize: number } {
  const { skip, take, page, pageSize } = getPaginationOptions(params);
  return {
    ...options,
    skip,
    take,
    page,
    pageSize,
  } as any;
}

export async function paginateQuery<T>(
  queryBuilder: any,
  params: PaginationParams
): Promise<PaginationResult<T>> {
  const { skip, take, page, pageSize } = getPaginationOptions(params);

  const [data, total] = await queryBuilder
    .skip(skip)
    .take(take)
    .getManyAndCount();

  return {
    data,
    total,
    page,
    pageSize,
  };
}

export async function paginateRepository<T>(
  repository: {
    findAndCount: (options: FindManyOptions<T>) => Promise<[T[], number]>;
  },
  options: FindManyOptions<T>,
  params: PaginationParams
): Promise<PaginationResult<T>> {
  const { skip, take, page, pageSize } = getPaginationOptions(params);

  const [data, total] = await repository.findAndCount({
    ...options,
    skip,
    take,
  } as any);

  return {
    data,
    total,
    page,
    pageSize,
  };
}
