import { Entity, Column, ManyToOne, JoinColumn, Index, OneToMany } from "typeorm";
import { BaseEntity } from "./Base.entity";
import { HazardType, RiskLevel } from "../types/enums";
import { Pipeline } from "./Pipeline.entity";
import { Facility } from "./Facility.entity";
import { Department } from "./Department.entity";
import { WorkOrder } from "./WorkOrder.entity";
import { RiskAssessment } from "./RiskAssessment.entity";

@Entity("hazard_points")
@Index(["type", "riskLevel"])
@Index(["pipelineId"])
export class HazardPoint extends BaseEntity {
  @Column({ type: "varchar", length: 50, unique: true })
  code: string;

  @Column({ type: "enum", enum: HazardType })
  type: HazardType;

  @Column({ type: "varchar", length: 200 })
  title: string;

  @Column({ type: "text", nullable: true })
  description: string;

  @Column({ type: "enum", enum: RiskLevel, default: RiskLevel.MEDIUM })
  riskLevel: RiskLevel;

  @Column({ type: "numeric", precision: 5, scale: 2, default: 50 })
  riskScore: number;

  @Column({ type: "numeric", precision: 5, scale: 2, nullable: true })
  likelihoodScore: number;

  @Column({ type: "numeric", precision: 5, scale: 2, nullable: true })
  consequenceScore: number;

  @Column({ type: "uuid", nullable: true })
  pipelineId: string;

  @Column({ type: "uuid", nullable: true })
  facilityId: string;

  @Column({ type: "numeric", precision: 10, scale: 2, nullable: true })
  pipelineOffset: number;

  @Column({ type: "uuid" })
  departmentId: string;

  @Column({ type: "geometry", spatialFeatureType: "Point", srid: 4326, nullable: true })
  geometry: any;

  @Column({ type: "date", nullable: true })
  discoveryDate: Date;

  @Column({ type: "uuid", nullable: true })
  discoveredBy: string;

  @Column({ type: "varchar", length: 200, nullable: true })
  discoveryMethod: string;

  @Column({ type: "text", nullable: true })
  recommendedAction: string;

  @Column({ type: "date", nullable: true })
  expectedRepairDate: Date;

  @Column({ type: "boolean", default: false })
  isRepaired: boolean;

  @Column({ type: "date", nullable: true })
  repairDate: Date;

  @Column({ type: "uuid", nullable: true })
  repairWorkOrderId: string;

  @Column({ type: "jsonb", nullable: true })
  images: string[];

  @Column({ type: "jsonb", nullable: true })
  attributes: Record<string, any>;

  @Column({ type: "text", nullable: true })
  remarks: string;

  @ManyToOne(() => Pipeline, (pipeline) => pipeline.hazards)
  @JoinColumn({ name: "pipelineId" })
  pipeline: Pipeline;

  @ManyToOne(() => Facility)
  @JoinColumn({ name: "facilityId" })
  facility: Facility;

  @ManyToOne(() => Department)
  @JoinColumn({ name: "departmentId" })
  department: Department;

  @OneToMany(() => WorkOrder, (workOrder) => workOrder.hazard)
  workOrders: WorkOrder[];

  @OneToMany(() => RiskAssessment, (assessment) => assessment.hazard)
  riskAssessments: RiskAssessment[];
}
