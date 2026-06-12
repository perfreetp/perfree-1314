import { Entity, Column, ManyToOne, JoinColumn, Index, OneToMany } from "typeorm";
import { BaseEntity } from "./Base.entity";
import { InspectionStatus, DefectType, RiskLevel } from "../types/enums";
import { InspectionRoute } from "./InspectionRoute.entity";
import { User } from "./User.entity";
import { Pipeline } from "./Pipeline.entity";
import { Facility } from "./Facility.entity";
import { DefectReport } from "./DefectReport.entity";
import { WorkOrder } from "./WorkOrder.entity";

@Entity("inspection_tasks")
@Index(["routeId", "status"])
@Index(["inspectorId", "status"])
export class InspectionTask extends BaseEntity {
  @Column({ type: "uuid", nullable: true })
  routeId: string;

  @Column({ type: "varchar", length: 50, unique: true })
  code: string;

  @Column({ type: "varchar", length: 200 })
  name: string;

  @Column({ type: "enum", enum: InspectionStatus, default: InspectionStatus.PENDING })
  status: InspectionStatus;

  @Column({ type: "uuid", nullable: true })
  inspectorId: string;

  @Column({ type: "uuid", nullable: true })
  pipelineId: string;

  @Column({ type: "uuid", nullable: true })
  facilityId: string;

  @Column({ type: "date", nullable: true })
  plannedDate: Date;

  @Column({ type: "geometry", spatialFeatureType: "Point", srid: 4326, nullable: true })
  location: any;

  @Column({ type: "varchar", length: 500, nullable: true })
  locationDescription: string;

  @Column({ type: "jsonb", nullable: true })
  requiredChecks: string[];

  @Column({ type: "jsonb", nullable: true })
  checkResults: Array<{
    checkItem: string;
    result: string;
    isNormal: boolean;
    remarks?: string;
  }>;

  @Column({ type: "text", nullable: true })
  inspectionNotes: string;

  @Column({ type: "boolean", default: false })
  hasDefect: boolean;

  @Column({ type: "enum", enum: DefectType, nullable: true })
  defectType: DefectType;

  @Column({ type: "enum", enum: RiskLevel, nullable: true })
  defectSeverity: RiskLevel;

  @Column({ type: "jsonb", nullable: true })
  photos: string[];

  @Column({ type: "timestamp", nullable: true })
  startedAt: Date;

  @Column({ type: "timestamp", nullable: true })
  completedAt: Date;

  @Column({ type: "numeric", precision: 10, scale: 6, nullable: true })
  actualLatitude: number;

  @Column({ type: "numeric", precision: 10, scale: 6, nullable: true })
  actualLongitude: number;

  @Column({ type: "numeric", precision: 10, scale: 0, nullable: true })
  accuracy: number;

  @Column({ type: "jsonb", nullable: true })
  attributes: Record<string, any>;

  @Column({ type: "text", nullable: true })
  remarks: string;

  @ManyToOne(() => InspectionRoute, (route) => route.tasks)
  @JoinColumn({ name: "routeId" })
  route: InspectionRoute;

  @ManyToOne(() => User, (user) => user.inspectionTasks)
  @JoinColumn({ name: "inspectorId" })
  inspector: User;

  @ManyToOne(() => Pipeline)
  @JoinColumn({ name: "pipelineId" })
  pipeline: Pipeline;

  @ManyToOne(() => Facility)
  @JoinColumn({ name: "facilityId" })
  facility: Facility;

  @OneToMany(() => DefectReport, (report) => report.inspectionTask)
  defectReports: DefectReport[];

  @OneToMany(() => WorkOrder, (workOrder) => workOrder.inspectionTask)
  workOrders: WorkOrder[];
}
