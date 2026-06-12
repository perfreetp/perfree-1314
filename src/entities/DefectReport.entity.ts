import { Entity, Column, ManyToOne, JoinColumn, Index, OneToMany } from "typeorm";
import { BaseEntity } from "./Base.entity";
import { DefectType, RiskLevel } from "../types/enums";
import { InspectionTask } from "./InspectionTask.entity";
import { User } from "./User.entity";
import { Pipeline } from "./Pipeline.entity";
import { Facility } from "./Facility.entity";
import { WorkOrder } from "./WorkOrder.entity";

@Entity("defect_reports")
@Index(["type", "severity"])
@Index(["pipelineId"])
export class DefectReport extends BaseEntity {
  @Column({ type: "varchar", length: 50, unique: true })
  code: string;

  @Column({ type: "enum", enum: DefectType })
  type: DefectType;

  @Column({ type: "enum", enum: RiskLevel, default: RiskLevel.MEDIUM })
  severity: RiskLevel;

  @Column({ type: "varchar", length: 200 })
  title: string;

  @Column({ type: "text", nullable: true })
  description: string;

  @Column({ type: "uuid", nullable: true })
  inspectionTaskId: string;

  @Column({ type: "uuid", nullable: true })
  pipelineId: string;

  @Column({ type: "uuid", nullable: true })
  facilityId: string;

  @Column({ type: "uuid" })
  reporterId: string;

  @Column({ type: "uuid", nullable: true })
  workOrderId: string;

  @Column({ type: "geometry", spatialFeatureType: "Point", srid: 4326, nullable: true })
  location: any;

  @Column({ type: "varchar", length: 500, nullable: true })
  locationDescription: string;

  @Column({ type: "numeric", precision: 10, scale: 2, nullable: true })
  pipelineOffset: number;

  @Column({ type: "numeric", precision: 10, scale: 2, nullable: true })
  defectSize: number;

  @Column({ type: "numeric", precision: 5, scale: 2, nullable: true })
  riskScore: number;

  @Column({ type: "date", nullable: true })
  discoveryDate: Date;

  @Column({ type: "boolean", default: false })
  isRepaired: boolean;

  @Column({ type: "date", nullable: true })
  repairDate: Date;

  @Column({ type: "jsonb", nullable: true })
  photos: string[];

  @Column({ type: "text", nullable: true })
  recommendedAction: string;

  @Column({ type: "jsonb", nullable: true })
  attributes: Record<string, any>;

  @Column({ type: "text", nullable: true })
  remarks: string;

  @ManyToOne(() => InspectionTask, (task) => task.defectReports)
  @JoinColumn({ name: "inspectionTaskId" })
  inspectionTask: InspectionTask;

  @ManyToOne(() => User)
  @JoinColumn({ name: "reporterId" })
  reporter: User;

  @ManyToOne(() => Pipeline)
  @JoinColumn({ name: "pipelineId" })
  pipeline: Pipeline;

  @ManyToOne(() => Facility)
  @JoinColumn({ name: "facilityId" })
  facility: Facility;

  @OneToMany(() => WorkOrder, (workOrder) => workOrder.defectReport)
  workOrders: WorkOrder[];
}
