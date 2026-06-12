import { Entity, Column, ManyToOne, JoinColumn, Index } from "typeorm";
import { BaseEntity } from "./Base.entity";
import { SharingLevel, PipelineType } from "../types/enums";
import { Pipeline } from "./Pipeline.entity";
import { Facility } from "./Facility.entity";
import { HazardPoint } from "./HazardPoint.entity";
import { WorkOrder } from "./WorkOrder.entity";
import { Alert } from "./Alert.entity";
import { Department } from "./Department.entity";

@Entity("sharing_scopes")
@Index(["pipelineId", "targetType", "targetId"])
@Index(["facilityId", "targetType", "targetId"])
@Index(["hazardId", "targetType", "targetId"])
@Index(["workOrderId", "targetType", "targetId"])
@Index(["alertId", "targetType", "targetId"])
export class SharingScope extends BaseEntity {
  @Column({ type: "uuid", nullable: true })
  pipelineId: string;

  @Column({ type: "uuid", nullable: true })
  facilityId: string;

  @Column({ type: "uuid", nullable: true })
  hazardId: string;

  @Column({ type: "uuid", nullable: true })
  workOrderId: string;

  @Column({ type: "uuid", nullable: true })
  alertId: string;

  @Column({ type: "enum", enum: SharingLevel, default: SharingLevel.DEPARTMENT })
  sharingLevel: SharingLevel;

  @Column({ type: "varchar", length: 50, nullable: true })
  targetType: string;

  @Column({ type: "uuid", nullable: true })
  targetId: string;

  @Column({ type: "varchar", length: 200, nullable: true })
  targetName: string;

  @Column({ type: "enum", enum: PipelineType, array: true, nullable: true })
  allowedPipelineTypes: PipelineType[];

  @Column({ type: "geometry", nullable: true })
  allowedArea: any;

  @Column({ type: "boolean", default: true })
  canView: boolean;

  @Column({ type: "boolean", default: false })
  canEdit: boolean;

  @Column({ type: "boolean", default: false })
  canDelete: boolean;

  @Column({ type: "boolean", default: false })
  canExport: boolean;

  @Column({ type: "jsonb", nullable: true })
  allowedFields: string[];

  @Column({ type: "jsonb", nullable: true })
  deniedFields: string[];

  @Column({ type: "date", nullable: true })
  validFrom: Date;

  @Column({ type: "date", nullable: true })
  validTo: Date;

  @Column({ type: "boolean", default: true })
  isActive: boolean;

  @Column({ type: "jsonb", nullable: true })
  attributes: Record<string, any>;

  @Column({ type: "text", nullable: true })
  remarks: string;

  @ManyToOne(() => Pipeline, (pipeline) => pipeline.sharingScopes)
  @JoinColumn({ name: "pipelineId" })
  pipeline: Pipeline;

  @ManyToOne(() => Facility)
  @JoinColumn({ name: "facilityId" })
  facility: Facility;

  @ManyToOne(() => HazardPoint)
  @JoinColumn({ name: "hazardId" })
  hazard: HazardPoint;

  @ManyToOne(() => WorkOrder)
  @JoinColumn({ name: "workOrderId" })
  workOrder: WorkOrder;

  @ManyToOne(() => Alert)
  @JoinColumn({ name: "alertId" })
  alert: Alert;

  @ManyToOne(() => Department)
  @JoinColumn({ name: "targetId" })
  targetDepartment: Department;
}
