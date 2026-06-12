import { Entity, Column, ManyToOne, JoinColumn, OneToMany, Index } from "typeorm";
import { BaseEntity } from "./Base.entity";
import { PipelineType, PipelineMaterial, PipelineStatus, SharingLevel } from "../types/enums";
import { PipelineNode } from "./PipelineNode.entity";
import { Department } from "./Department.entity";
import { Sensor } from "./Sensor.entity";
import { HazardPoint } from "./HazardPoint.entity";
import { ChangeHistory } from "./ChangeHistory.entity";
import { SharingScope } from "./SharingScope.entity";

@Entity("pipelines")
@Index(["type", "status"])
@Index(["departmentId"])
export class Pipeline extends BaseEntity {
  @Column({ type: "varchar", length: 50, unique: true })
  code: string;

  @Column({ type: "varchar", length: 100, nullable: true })
  name: string;

  @Column({ type: "enum", enum: PipelineType })
  type: PipelineType;

  @Column({ type: "enum", enum: PipelineMaterial, nullable: true })
  material: PipelineMaterial;

  @Column({ type: "numeric", precision: 10, scale: 2, nullable: true })
  diameter: number;

  @Column({ type: "numeric", precision: 10, scale: 2, nullable: true })
  length: number;

  @Column({ type: "numeric", precision: 10, scale: 2, nullable: true })
  burialDepth: number;

  @Column({ type: "numeric", precision: 10, scale: 2, nullable: true })
  elevationStart: number;

  @Column({ type: "numeric", precision: 10, scale: 2, nullable: true })
  elevationEnd: number;

  @Column({ type: "varchar", length: 200, nullable: true })
  roadName: string;

  @Column({ type: "varchar", length: 500, nullable: true })
  locationDescription: string;

  @Column({ type: "date", nullable: true })
  constructionDate: Date;

  @Column({ type: "date", nullable: true })
  commissionDate: Date;

  @Column({ type: "enum", enum: PipelineStatus, default: PipelineStatus.NORMAL })
  status: PipelineStatus;

  @Column({ type: "uuid", nullable: true })
  startNodeId: string;

  @Column({ type: "uuid", nullable: true })
  endNodeId: string;

  @Column({ type: "uuid" })
  departmentId: string;

  @Column({ type: "geometry", spatialFeatureType: "LineString", srid: 4326 })
  geometry: any;

  @Column({ type: "jsonb", nullable: true })
  attributes: Record<string, any>;

  @Column({ type: "enum", enum: SharingLevel, default: SharingLevel.DEPARTMENT })
  sharingLevel: SharingLevel;

  @Column({ type: "numeric", precision: 5, scale: 2, default: 0 })
  riskScore: number;

  @Column({ type: "text", nullable: true })
  remarks: string;

  @ManyToOne(() => PipelineNode, (node) => node.outgoingPipelines)
  @JoinColumn({ name: "startNodeId" })
  startNode: PipelineNode;

  @ManyToOne(() => PipelineNode, (node) => node.incomingPipelines)
  @JoinColumn({ name: "endNodeId" })
  endNode: PipelineNode;

  @ManyToOne(() => Department)
  @JoinColumn({ name: "departmentId" })
  department: Department;

  @OneToMany(() => Sensor, (sensor) => sensor.pipeline)
  sensors: Sensor[];

  @OneToMany(() => HazardPoint, (hazard) => hazard.pipeline)
  hazards: HazardPoint[];

  @OneToMany(() => ChangeHistory, (history) => history.pipeline)
  changeHistories: ChangeHistory[];

  @OneToMany(() => SharingScope, (scope) => scope.pipeline)
  sharingScopes: SharingScope[];
}
