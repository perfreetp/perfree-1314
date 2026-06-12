import { Entity, Column, ManyToOne, JoinColumn, Index, OneToMany } from "typeorm";
import { BaseEntity } from "./Base.entity";
import { SensorType, PipelineType } from "../types/enums";
import { Pipeline } from "./Pipeline.entity";
import { Facility } from "./Facility.entity";
import { Department } from "./Department.entity";
import { SensorReading } from "./SensorReading.entity";
import { Alert } from "./Alert.entity";

@Entity("sensors")
@Index(["type", "status"])
@Index(["pipelineId"])
export class Sensor extends BaseEntity {
  @Column({ type: "varchar", length: 50, unique: true })
  code: string;

  @Column({ type: "varchar", length: 100, nullable: true })
  name: string;

  @Column({ type: "enum", enum: SensorType })
  type: SensorType;

  @Column({ type: "enum", enum: PipelineType, nullable: true })
  pipelineType: PipelineType;

  @Column({ type: "varchar", length: 50, nullable: true })
  brand: string;

  @Column({ type: "varchar", length: 50, nullable: true })
  model: string;

  @Column({ type: "varchar", length: 100, nullable: true })
  protocol: string;

  @Column({ type: "varchar", length: 50, unique: true })
  deviceId: string;

  @Column({ type: "varchar", length: 50, nullable: true })
  communicationMethod: string;

  @Column({ type: "numeric", precision: 10, scale: 4, nullable: true })
  samplingInterval: number;

  @Column({ type: "varchar", length: 20, nullable: true })
  unit: string;

  @Column({ type: "numeric", precision: 10, scale: 4, nullable: true })
  minValue: number;

  @Column({ type: "numeric", precision: 10, scale: 4, nullable: true })
  maxValue: number;

  @Column({ type: "numeric", precision: 10, scale: 4, nullable: true })
  warningLow: number;

  @Column({ type: "numeric", precision: 10, scale: 4, nullable: true })
  warningHigh: number;

  @Column({ type: "numeric", precision: 10, scale: 4, nullable: true })
  criticalLow: number;

  @Column({ type: "numeric", precision: 10, scale: 4, nullable: true })
  criticalHigh: number;

  @Column({ type: "boolean", default: true })
  isActive: boolean;

  @Column({ type: "boolean", default: true })
  enableAlert: boolean;

  @Column({ type: "uuid", nullable: true })
  pipelineId: string;

  @Column({ type: "uuid", nullable: true })
  facilityId: string;

  @Column({ type: "uuid" })
  departmentId: string;

  @Column({ type: "geometry", spatialFeatureType: "Point", srid: 4326 })
  geometry: any;

  @Column({ type: "numeric", precision: 10, scale: 4, nullable: true })
  installationDepth: number;

  @Column({ type: "date", nullable: true })
  installationDate: Date;

  @Column({ type: "date", nullable: true })
  lastCalibrationDate: Date;

  @Column({ type: "timestamp", nullable: true })
  lastOnlineTime: Date;

  @Column({ type: "jsonb", nullable: true })
  attributes: Record<string, any>;

  @Column({ type: "text", nullable: true })
  remarks: string;

  @ManyToOne(() => Pipeline)
  @JoinColumn({ name: "pipelineId" })
  pipeline: Pipeline;

  @ManyToOne(() => Facility)
  @JoinColumn({ name: "facilityId" })
  facility: Facility;

  @ManyToOne(() => Department)
  @JoinColumn({ name: "departmentId" })
  department: Department;

  @OneToMany(() => SensorReading, (reading) => reading.sensor)
  readings: SensorReading[];

  @OneToMany(() => Alert, (alert) => alert.sensor)
  alerts: Alert[];
}
