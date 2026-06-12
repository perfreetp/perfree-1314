import { AppDataSource } from "../config/data-source";
import { Sensor } from "../entities/Sensor.entity";
import { SensorReading } from "../entities/SensorReading.entity";
import { SensorType } from "../types/enums";
import { throwApiError } from "../utils/response";
import { PaginationParams, paginateQuery, getPaginationOptions } from "../utils/pagination";
import { generateAlert } from "./alert.service";
import { Between, MoreThan } from "typeorm";

export interface CreateSensorDto {
  code: string;
  name?: string;
  type: SensorType;
  pipelineType?: any;
  brand?: string;
  model?: string;
  protocol?: string;
  deviceId: string;
  communicationMethod?: string;
  samplingInterval?: number;
  unit?: string;
  minValue?: number;
  maxValue?: number;
  warningLow?: number;
  warningHigh?: number;
  criticalLow?: number;
  criticalHigh?: number;
  isActive?: boolean;
  enableAlert?: boolean;
  pipelineId?: string;
  facilityId?: string;
  departmentId: string;
  geometry: any;
  installationDepth?: number;
  installationDate?: Date;
  lastCalibrationDate?: Date;
  attributes?: Record<string, any>;
  remarks?: string;
}

export interface UpdateSensorDto extends Partial<CreateSensorDto> {}

export interface IngestSensorReadingDto {
  value: number;
  timestamp?: Date;
  unit?: string;
  temperature?: number;
  battery?: number;
  signalStrength?: number;
  rawData?: Record<string, any>;
}

export interface SensorReadingFilters extends PaginationParams {
  startTime?: Date;
  endTime?: Date;
  isAnomaly?: boolean;
}

export interface SensorStatistics {
  totalSensors: number;
  activeSensors: number;
  onlineSensors: number;
  offlineSensors: number;
  onlineRate: number;
  totalReadings: number;
  alertCount: number;
  byType: Array<{
    type: SensorType;
    count: number;
    onlineCount: number;
  }>;
}

export interface ThresholdCheckResult {
  isNormal: boolean;
  severity?: "warning" | "critical";
  thresholdType?: "low" | "high";
  thresholdValue?: number;
}

const sensorRepository = AppDataSource.getRepository(Sensor);
const readingRepository = AppDataSource.getRepository(SensorReading);

export async function createSensor(dto: CreateSensorDto, userId?: string): Promise<Sensor> {
  const existingByCode = await sensorRepository.findOne({ where: { code: dto.code } });
  if (existingByCode) {
    throwApiError(`传感器编号 ${dto.code} 已存在`, 409);
  }

  const existingByDeviceId = await sensorRepository.findOne({ where: { deviceId: dto.deviceId } });
  if (existingByDeviceId) {
    throwApiError(`设备ID ${dto.deviceId} 已存在`, 409);
  }

  const sensor = sensorRepository.create({
    ...dto,
    createdBy: userId,
    updatedBy: userId,
  });

  return await sensorRepository.save(sensor);
}

export async function getSensor(id: string): Promise<Sensor> {
  const sensor = await sensorRepository.findOne({
    where: { id },
    relations: ["pipeline", "facility", "department"],
  });
  if (!sensor) {
    throwApiError("传感器不存在", 404);
  }
  return sensor;
}

export async function updateSensor(
  id: string,
  dto: UpdateSensorDto,
  userId?: string
): Promise<Sensor> {
  const sensor = await getSensor(id);

  if (dto.code && dto.code !== sensor.code) {
    const existing = await sensorRepository.findOne({ where: { code: dto.code } });
    if (existing) {
      throwApiError(`传感器编号 ${dto.code} 已存在`, 409);
    }
  }

  if (dto.deviceId && dto.deviceId !== sensor.deviceId) {
    const existing = await sensorRepository.findOne({ where: { deviceId: dto.deviceId } });
    if (existing) {
      throwApiError(`设备ID ${dto.deviceId} 已存在`, 409);
    }
  }

  const updated = sensorRepository.merge(sensor, {
    ...dto,
    updatedBy: userId,
  });

  return await sensorRepository.save(updated);
}

export async function deleteSensor(id: string): Promise<void> {
  const sensor = await getSensor(id);
  await sensorRepository.softDelete(sensor.id);
}

export async function listSensors(filters: PaginationParams & { type?: SensorType; isActive?: boolean; departmentId?: string }) {
  const { page, pageSize, ...queryFilters } = filters;
  const where: any = {};

  if (queryFilters.type) where.type = queryFilters.type;
  if (queryFilters.isActive !== undefined) where.isActive = queryFilters.isActive;
  if (queryFilters.departmentId) where.departmentId = queryFilters.departmentId;

  const qb = sensorRepository
    .createQueryBuilder("sensor")
    .leftJoinAndSelect("sensor.pipeline", "pipeline")
    .leftJoinAndSelect("sensor.facility", "facility")
    .leftJoinAndSelect("sensor.department", "department")
    .where(where);

  return await paginateQuery(qb, { page, pageSize });
}

export async function ingestSensorReading(
  sensorId: string,
  dto: IngestSensorReadingDto
): Promise<{ reading: SensorReading; alerts: any[] }> {
  const sensor = await getSensor(sensorId);

  if (!sensor.isActive) {
    throwApiError("传感器未激活", 400);
  }

  const reading = readingRepository.create({
    sensorId,
    value: dto.value,
    timestamp: dto.timestamp || new Date(),
    unit: dto.unit || sensor.unit,
    temperature: dto.temperature,
    battery: dto.battery,
    signalStrength: dto.signalStrength,
    rawData: dto.rawData,
  });

  const thresholdResult = checkSensorThresholds(sensor, dto.value);
  reading.isAnomaly = !thresholdResult.isNormal;

  const savedReading = await readingRepository.save(reading);

  sensor.lastOnlineTime = new Date();
  await sensorRepository.save(sensor);

  const alerts: any[] = [];
  if (!thresholdResult.isNormal && sensor.enableAlert) {
    const alert = await generateAlert(sensor, savedReading, thresholdResult);
    alerts.push(alert);
  }

  return { reading: savedReading, alerts };
}

export async function getSensorReadings(
  sensorId: string,
  filters: SensorReadingFilters
) {
  await getSensor(sensorId);

  const { page, pageSize, startTime, endTime, isAnomaly } = filters;
  const { skip, take, page: currentPage, pageSize: size } = getPaginationOptions({ page, pageSize });

  const qb = readingRepository
    .createQueryBuilder("reading")
    .where("reading.sensorId = :sensorId", { sensorId })
    .orderBy("reading.timestamp", "DESC");

  if (startTime && endTime) {
    qb.andWhere("reading.timestamp BETWEEN :startTime AND :endTime", { startTime, endTime });
  } else if (startTime) {
    qb.andWhere("reading.timestamp >= :startTime", { startTime });
  } else if (endTime) {
    qb.andWhere("reading.timestamp <= :endTime", { endTime });
  }

  if (isAnomaly !== undefined) {
    qb.andWhere("reading.isAnomaly = :isAnomaly", { isAnomaly });
  }

  const [data, total] = await qb.skip(skip).take(take).getManyAndCount();

  return {
    data,
    total,
    page: currentPage,
    pageSize: size,
  };
}

export async function getLatestReadings(sensorIds?: string[]): Promise<SensorReading[]> {
  const qb = readingRepository
    .createQueryBuilder("reading")
    .innerJoinAndSelect(
      (subQuery) => {
        const sq = subQuery
          .select("MAX(r.timestamp)", "max_timestamp")
          .addSelect("r.sensorId", "sensorId")
          .from(SensorReading, "r")
          .groupBy("r.sensorId");

        if (sensorIds && sensorIds.length > 0) {
          sq.where("r.sensorId IN (:...sensorIds)", { sensorIds });
        }

        return sq;
      },
      "latest",
      "reading.sensorId = latest.sensorId AND reading.timestamp = latest.max_timestamp"
    )
    .leftJoinAndSelect("reading.sensor", "sensor");

  return await qb.getMany();
}

export async function getSensorStatistics(): Promise<SensorStatistics> {
  const allSensors = await sensorRepository.find();
  const activeSensors = allSensors.filter((s) => s.isActive);

  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  const onlineSensors = activeSensors.filter(
    (s) => s.lastOnlineTime && new Date(s.lastOnlineTime) > fiveMinutesAgo
  );
  const offlineSensors = activeSensors.filter(
    (s) => !s.lastOnlineTime || new Date(s.lastOnlineTime) <= fiveMinutesAgo
  );

  const totalReadings = await readingRepository.count();

  const alertResult = await AppDataSource.query(
    `SELECT COUNT(*) as count FROM alerts WHERE "deletedAt" IS NULL`
  );
  const alertCount = parseInt(alertResult[0]?.count || 0);

  const byType = Object.values(SensorType).map((type) => {
    const typeSensors = allSensors.filter((s) => s.type === type);
    const typeOnline = typeSensors.filter(
      (s) => s.isActive && s.lastOnlineTime && new Date(s.lastOnlineTime) > fiveMinutesAgo
    );
    return {
      type,
      count: typeSensors.length,
      onlineCount: typeOnline.length,
    };
  });

  return {
    totalSensors: allSensors.length,
    activeSensors: activeSensors.length,
    onlineSensors: onlineSensors.length,
    offlineSensors: offlineSensors.length,
    onlineRate: activeSensors.length > 0 ? onlineSensors.length / activeSensors.length : 0,
    totalReadings,
    alertCount,
    byType,
  };
}

export function checkSensorThresholds(
  sensor: Sensor,
  value: number
): ThresholdCheckResult {
  if (sensor.criticalLow !== undefined && value <= sensor.criticalLow) {
    return {
      isNormal: false,
      severity: "critical",
      thresholdType: "low",
      thresholdValue: sensor.criticalLow,
    };
  }

  if (sensor.criticalHigh !== undefined && value >= sensor.criticalHigh) {
    return {
      isNormal: false,
      severity: "critical",
      thresholdType: "high",
      thresholdValue: sensor.criticalHigh,
    };
  }

  if (sensor.warningLow !== undefined && value <= sensor.warningLow) {
    return {
      isNormal: false,
      severity: "warning",
      thresholdType: "low",
      thresholdValue: sensor.warningLow,
    };
  }

  if (sensor.warningHigh !== undefined && value >= sensor.warningHigh) {
    return {
      isNormal: false,
      severity: "warning",
      thresholdType: "high",
      thresholdValue: sensor.warningHigh,
    };
  }

  return { isNormal: true };
}
