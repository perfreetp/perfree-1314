import { Entity, Column, ManyToOne, JoinColumn, Index } from "typeorm";
import { BaseEntity } from "./Base.entity";
import { RiskLevel } from "../types/enums";
import { ExcavationApplication } from "./ExcavationApplication.entity";

@Entity("road_impacts")
@Index(["applicationId", "severity"])
export class RoadImpact extends BaseEntity {
  @Column({ type: "uuid" })
  applicationId: string;

  @Column({ type: "varchar", length: 200 })
  roadName: string;

  @Column({ type: "varchar", length: 50, nullable: true })
  roadType: string;

  @Column({ type: "varchar", length: 50, nullable: true })
  roadGrade: string;

  @Column({ type: "enum", enum: RiskLevel, default: RiskLevel.MEDIUM })
  severity: RiskLevel;

  @Column({ type: "numeric", precision: 10, scale: 2, nullable: true })
  affectedLength: number;

  @Column({ type: "numeric", precision: 10, scale: 2, nullable: true })
  affectedWidth: number;

  @Column({ type: "numeric", precision: 10, scale: 2, nullable: true })
  affectedArea: number;

  @Column({ type: "numeric", precision: 10, scale: 2, nullable: true })
  affectedLanes: number;

  @Column({ type: "boolean", default: false })
  requiresRoadClosure: boolean;

  @Column({ type: "varchar", length: 200, nullable: true })
  trafficControlType: string;

  @Column({ type: "text", nullable: true })
  description: string;

  @Column({ type: "text", nullable: true })
  suggestedDetourRoute: string;

  @Column({ type: "integer", nullable: true })
  estimatedAffectedVehicles: number;

  @Column({ type: "numeric", precision: 10, scale: 2, nullable: true })
  estimatedDelayMinutes: number;

  @Column({ type: "text", nullable: true })
  mitigationMeasures: string;

  @Column({ type: "geometry", spatialFeatureType: "Polygon", srid: 4326, nullable: true })
  affectedAreaGeometry: any;

  @Column({ type: "jsonb", nullable: true })
  attributes: Record<string, any>;

  @Column({ type: "text", nullable: true })
  remarks: string;

  @ManyToOne(() => ExcavationApplication, (application) => application.roadImpacts)
  @JoinColumn({ name: "applicationId" })
  application: ExcavationApplication;
}
