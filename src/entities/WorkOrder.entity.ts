import { Entity, Column, ManyToOne, JoinColumn, Index, OneToMany } from "typeorm";
import { BaseEntity } from "./Base.entity";
import { WorkOrderStatus, WorkOrderPriority } from "../types/enums";
import { User } from "./User.entity";
import { Pipeline } from "./Pipeline.entity";
import { Facility } from "./Facility.entity";
import { Alert } from "./Alert.entity";
import { HazardPoint } from "./HazardPoint.entity";
import { DefectReport } from "./DefectReport.entity";
import { InspectionTask } from "./InspectionTask.entity";
import { WorkOrderProgress } from "./WorkOrderProgress.entity";

@Entity("work_orders")
@Index(["status", "priority"])
@Index(["assigneeId", "status"])
@Index(["createdAt"])
export class WorkOrder extends BaseEntity {
  @Column({ type: "varchar", length: 50, unique: true })
  orderNo: string;

  @Column({ type: "varchar", length: 200 })
  title: string;

  @Column({ type: "text", nullable: true })
  description: string;

  @Column({ type: "enum", enum: WorkOrderStatus, default: WorkOrderStatus.CREATED })
  status: WorkOrderStatus;

  @Column({ type: "enum", enum: WorkOrderPriority, default: WorkOrderPriority.MEDIUM })
  priority: WorkOrderPriority;

  @Column({ type: "varchar", length: 100, nullable: true })
  workType: string;

  @Column({ type: "uuid", nullable: true })
  pipelineId: string;

  @Column({ type: "uuid", nullable: true })
  facilityId: string;

  @Column({ type: "uuid", nullable: true })
  alertId: string;

  @Column({ type: "uuid", nullable: true })
  hazardId: string;

  @Column({ type: "uuid", nullable: true })
  defectReportId: string;

  @Column({ type: "uuid", nullable: true })
  inspectionTaskId: string;

  @Column({ type: "uuid" })
  createdBy: string;

  @Column({ type: "uuid", nullable: true })
  assigneeId: string;

  @Column({ type: "uuid", nullable: true })
  departmentId: string;

  @Column({ type: "date", nullable: true })
  plannedStartDate: Date;

  @Column({ type: "date", nullable: true })
  plannedEndDate: Date;

  @Column({ type: "timestamp", nullable: true })
  actualStartTime: Date;

  @Column({ type: "timestamp", nullable: true })
  actualEndTime: Date;

  @Column({ type: "numeric", precision: 10, scale: 2, nullable: true })
  estimatedCost: number;

  @Column({ type: "numeric", precision: 10, scale: 2, nullable: true })
  actualCost: number;

  @Column({ type: "geometry", spatialFeatureType: "Point", srid: 4326, nullable: true })
  location: any;

  @Column({ type: "varchar", length: 500, nullable: true })
  locationDescription: string;

  @Column({ type: "jsonb", nullable: true })
  requiredMaterials: Array<{
    name: string;
    quantity: number;
    unit: string;
  }>;

  @Column({ type: "jsonb", nullable: true })
  requiredPersonnel: string[];

  @Column({ type: "jsonb", nullable: true })
  photosBefore: string[];

  @Column({ type: "jsonb", nullable: true })
  photosAfter: string[];

  @Column({ type: "text", nullable: true })
  workContent: string;

  @Column({ type: "text", nullable: true })
  workResult: string;

  @Column({ type: "text", nullable: true })
  acceptanceComments: string;

  @Column({ type: "uuid", nullable: true })
  acceptedBy: string;

  @Column({ type: "timestamp", nullable: true })
  acceptedAt: Date;

  @Column({ type: "jsonb", nullable: true })
  attributes: Record<string, any>;

  @Column({ type: "text", nullable: true })
  remarks: string;

  @ManyToOne(() => User, (user) => user.createdWorkOrders)
  @JoinColumn({ name: "createdBy" })
  createdByUser: User;

  @ManyToOne(() => User, (user) => user.assignedWorkOrders)
  @JoinColumn({ name: "assigneeId" })
  assignee: User;

  @ManyToOne(() => Pipeline)
  @JoinColumn({ name: "pipelineId" })
  pipeline: Pipeline;

  @ManyToOne(() => Facility)
  @JoinColumn({ name: "facilityId" })
  facility: Facility;

  @ManyToOne(() => Alert, (alert) => alert.workOrders)
  @JoinColumn({ name: "alertId" })
  alert: Alert;

  @ManyToOne(() => HazardPoint, (hazard) => hazard.workOrders)
  @JoinColumn({ name: "hazardId" })
  hazard: HazardPoint;

  @ManyToOne(() => DefectReport, (report) => report.workOrders)
  @JoinColumn({ name: "defectReportId" })
  defectReport: DefectReport;

  @ManyToOne(() => InspectionTask, (task) => task.workOrders)
  @JoinColumn({ name: "inspectionTaskId" })
  inspectionTask: InspectionTask;

  @OneToMany(() => WorkOrderProgress, (progress) => progress.workOrder)
  progressRecords: WorkOrderProgress[];
}
