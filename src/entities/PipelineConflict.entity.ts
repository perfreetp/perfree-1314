import { Entity, Column, ManyToOne, JoinColumn, Index } from "typeorm";
import { BaseEntity } from "./Base.entity";
import { ConflictType, RiskLevel, PipelineType } from "../types/enums";
import { ExcavationApplication } from "./ExcavationApplication.entity";
import { Pipeline } from "./Pipeline.entity";
import { Facility } from "./Facility.entity";

@Entity("pipeline_conflicts")
@Index(["applicationId", "type"])
export class PipelineConflict extends BaseEntity {
  @Column({ type: "uuid" })
  applicationId: string;

  @Column({ type: "uuid", nullable: true })
  pipelineId: string;

  @Column({ type: "uuid", nullable: true })
  facilityId: string;

  @Column({ type: "enum", enum: ConflictType })
  type: ConflictType;

  @Column({ type: "enum", enum: PipelineType, nullable: true })
  pipelineType: PipelineType;

  @Column({ type: "enum", enum: RiskLevel, default: RiskLevel.MEDIUM })
  severity: RiskLevel;

  @Column({ type: "varchar", length: 200 })
  title: string;

  @Column({ type: "text", nullable: true })
  description: string;

  @Column({ type: "numeric", precision: 10, scale: 2, nullable: true })
  distance: number;

  @Column({ type: "numeric", precision: 10, scale: 2, nullable: true })
  minimumSafeDistance: number;

  @Column({ type: "numeric", precision: 10, scale: 2, nullable: true })
  verticalDistance: number;

  @Column({ type: "numeric", precision: 10, scale: 2, nullable: true })
  verticalSafeDistance: number;

  @Column({ type: "geometry", nullable: true })
  conflictPoint: any;

  @Column({ type: "jsonb", nullable: true })
  affectedLength: number;

  @Column({ type: "text", nullable: true })
  suggestedSolution: string;

  @Column({ type: "boolean", default: false })
  isResolved: boolean;

  @Column({ type: "text", nullable: true })
  resolutionNotes: string;

  @Column({ type: "timestamp", nullable: true })
  resolvedAt: Date;

  @Column({ type: "uuid", nullable: true })
  resolvedBy: string;

  @Column({ type: "jsonb", nullable: true })
  attributes: Record<string, any>;

  @Column({ type: "text", nullable: true })
  remarks: string;

  @ManyToOne(() => ExcavationApplication, (application) => application.conflicts)
  @JoinColumn({ name: "applicationId" })
  application: ExcavationApplication;

  @ManyToOne(() => Pipeline)
  @JoinColumn({ name: "pipelineId" })
  pipeline: Pipeline;

  @ManyToOne(() => Facility)
  @JoinColumn({ name: "facilityId" })
  facility: Facility;
}
