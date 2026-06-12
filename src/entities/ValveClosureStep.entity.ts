import { Entity, Column, ManyToOne, JoinColumn, Index } from "typeorm";
import { BaseEntity } from "./Base.entity";
import { ValveStatus } from "../types/enums";
import { ValveClosurePlan } from "./ValveClosurePlan.entity";
import { Facility } from "./Facility.entity";

@Entity("valve_closure_steps")
@Index(["planId", "stepOrder"])
export class ValveClosureStep extends BaseEntity {
  @Column({ type: "uuid" })
  planId: string;

  @Column({ type: "uuid" })
  valveId: string;

  @Column({ type: "integer" })
  stepOrder: number;

  @Column({ type: "enum", enum: ValveStatus, default: ValveStatus.CLOSED })
  targetStatus: ValveStatus;

  @Column({ type: "enum", enum: ValveStatus, nullable: true })
  actualStatus: ValveStatus;

  @Column({ type: "varchar", length: 200, nullable: true })
  valveCode: string;

  @Column({ type: "varchar", length: 200, nullable: true })
  valveName: string;

  @Column({ type: "varchar", length: 500, nullable: true })
  locationDescription: string;

  @Column({ type: "geometry", spatialFeatureType: "Point", srid: 4326, nullable: true })
  valveLocation: any;

  @Column({ type: "numeric", precision: 10, scale: 2, nullable: true })
  estimatedTime: number;

  @Column({ type: "boolean", default: false })
  isCompleted: boolean;

  @Column({ type: "timestamp", nullable: true })
  completedAt: Date;

  @Column({ type: "uuid", nullable: true })
  completedBy: string;

  @Column({ type: "text", nullable: true })
  notes: string;

  @Column({ type: "jsonb", nullable: true })
  attributes: Record<string, any>;

  @ManyToOne(() => ValveClosurePlan, (plan) => plan.closureSteps)
  @JoinColumn({ name: "planId" })
  plan: ValveClosurePlan;

  @ManyToOne(() => Facility)
  @JoinColumn({ name: "valveId" })
  valve: Facility;
}
