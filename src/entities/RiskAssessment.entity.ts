import { Entity, Column, ManyToOne, JoinColumn, Index } from "typeorm";
import { BaseEntity } from "./Base.entity";
import { RiskLevel } from "../types/enums";
import { Pipeline } from "./Pipeline.entity";
import { HazardPoint } from "./HazardPoint.entity";

@Entity("risk_assessments")
@Index(["assessmentDate"])
export class RiskAssessment extends BaseEntity {
  @Column({ type: "uuid", nullable: true })
  pipelineId: string;

  @Column({ type: "uuid", nullable: true })
  hazardId: string;

  @Column({ type: "date" })
  assessmentDate: Date;

  @Column({ type: "enum", enum: RiskLevel, default: RiskLevel.MEDIUM })
  overallRiskLevel: RiskLevel;

  @Column({ type: "numeric", precision: 5, scale: 2, default: 50 })
  overallRiskScore: number;

  @Column({ type: "numeric", precision: 5, scale: 2, nullable: true })
  likelihoodScore: number;

  @Column({ type: "numeric", precision: 5, scale: 2, nullable: true })
  likelihoodAgeScore: number;

  @Column({ type: "numeric", precision: 5, scale: 2, nullable: true })
  likelihoodMaterialScore: number;

  @Column({ type: "numeric", precision: 5, scale: 2, nullable: true })
  likelihoodCorrosionScore: number;

  @Column({ type: "numeric", precision: 5, scale: 2, nullable: true })
  likelihoodPressureScore: number;

  @Column({ type: "numeric", precision: 5, scale: 2, nullable: true })
  likelihoodLeakHistoryScore: number;

  @Column({ type: "numeric", precision: 5, scale: 2, nullable: true })
  consequenceScore: number;

  @Column({ type: "numeric", precision: 5, scale: 2, nullable: true })
  consequencePopulationScore: number;

  @Column({ type: "numeric", precision: 5, scale: 2, nullable: true })
  consequenceEnvironmentScore: number;

  @Column({ type: "numeric", precision: 5, scale: 2, nullable: true })
  consequenceEconomicScore: number;

  @Column({ type: "numeric", precision: 5, scale: 2, nullable: true })
  consequenceTrafficScore: number;

  @Column({ type: "numeric", precision: 5, scale: 2, nullable: true })
  consequencePropertyScore: number;

  @Column({ type: "text", nullable: true })
  assessmentMethod: string;

  @Column({ type: "text", nullable: true })
  analysisDetails: string;

  @Column({ type: "text", nullable: true })
  mitigationMeasures: string;

  @Column({ type: "date", nullable: true })
  nextAssessmentDate: Date;

  @Column({ type: "jsonb", nullable: true })
  attributes: Record<string, any>;

  @Column({ type: "text", nullable: true })
  remarks: string;

  @ManyToOne(() => Pipeline)
  @JoinColumn({ name: "pipelineId" })
  pipeline: Pipeline;

  @ManyToOne(() => HazardPoint, (hazard) => hazard.riskAssessments)
  @JoinColumn({ name: "hazardId" })
  hazard: HazardPoint;
}
