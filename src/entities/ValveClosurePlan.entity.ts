import { Entity, Column, ManyToOne, JoinColumn, Index, OneToMany } from "typeorm";
import { BaseEntity } from "./Base.entity";
import { RiskLevel, PipelineType } from "../types/enums";
import { Pipeline } from "./Pipeline.entity";
import { Facility } from "./Facility.entity";
import { Alert } from "./Alert.entity";
import { User } from "./User.entity";
import { ValveClosureStep } from "./ValveClosureStep.entity";

@Entity("valve_closure_plans")
@Index(["status", "createdAt"])
@Index(["incidentId"])
export class ValveClosurePlan extends BaseEntity {
  @Column({ type: "varchar", length: 50, unique: true })
  planNo: string;

  @Column({ type: "varchar", length: 200 })
  name: string;

  @Column({ type: "text", nullable: true })
  description: string;

  @Column({ type: "uuid", nullable: true })
  incidentId: string;

  @Column({ type: "uuid", nullable: true })
  alertId: string;

  @Column({ type: "uuid", nullable: true })
  pipelineId: string;

  @Column({ type: "enum", enum: PipelineType, nullable: true })
  pipelineType: PipelineType;

  @Column({ type: "enum", enum: RiskLevel, default: RiskLevel.HIGH })
  priority: RiskLevel;

  @Column({ type: "varchar", length: 50, default: "pending" })
  status: string;

  @Column({ type: "geometry", spatialFeatureType: "Point", srid: 4326, nullable: true })
  incidentLocation: any;

  @Column({ type: "numeric", precision: 10, scale: 2, nullable: true })
  estimatedIsolationTime: number;

  @Column({ type: "numeric", precision: 10, scale: 2, nullable: true })
  estimatedAffectedUsers: number;

  @Column({ type: "numeric", precision: 10, scale: 2, nullable: true })
  estimatedWaterLoss: number;

  @Column({ type: "uuid", nullable: true })
  createdBy: string;

  @Column({ type: "uuid", nullable: true })
  approvedBy: string;

  @Column({ type: "timestamp", nullable: true })
  approvedAt: Date;

  @Column({ type: "timestamp", nullable: true })
  executedAt: Date;

  @Column({ type: "uuid", nullable: true })
  executedBy: string;

  @Column({ type: "timestamp", nullable: true })
  completedAt: Date;

  @Column({ type: "text", nullable: true })
  notes: string;

  @Column({ type: "jsonb", nullable: true })
  attributes: Record<string, any>;

  @ManyToOne(() => Alert)
  @JoinColumn({ name: "alertId" })
  alert: Alert;

  @ManyToOne(() => Pipeline)
  @JoinColumn({ name: "pipelineId" })
  pipeline: Pipeline;

  @ManyToOne(() => User)
  @JoinColumn({ name: "createdBy" })
  creator: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: "approvedBy" })
  approver: User;

  @OneToMany(() => ValveClosureStep, (step) => step.plan)
  closureSteps: ValveClosureStep[];
}
