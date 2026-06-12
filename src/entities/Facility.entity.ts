import { Entity, Column, ManyToOne, JoinColumn, Index, OneToMany } from "typeorm";
import { BaseEntity } from "./Base.entity";
import { FacilityType, ValveType, ValveStatus, PipelineType, SharingLevel } from "../types/enums";
import { Department } from "./Department.entity";
import { Pipeline } from "./Pipeline.entity";
import { PipelineNode } from "./PipelineNode.entity";
import { WorkOrder } from "./WorkOrder.entity";
import { ChangeHistory } from "./ChangeHistory.entity";

@Entity("facilities")
@Index(["type", "status"])
@Index(["departmentId"])
export class Facility extends BaseEntity {
  @Column({ type: "varchar", length: 50, unique: true })
  code: string;

  @Column({ type: "varchar", length: 100, nullable: true })
  name: string;

  @Column({ type: "enum", enum: FacilityType })
  type: FacilityType;

  @Column({ type: "enum", enum: PipelineType, nullable: true })
  pipelineType: PipelineType;

  @Column({ type: "enum", enum: ValveType, nullable: true })
  valveType: ValveType;

  @Column({ type: "enum", enum: ValveStatus, nullable: true })
  status: ValveStatus;

  @Column({ type: "numeric", precision: 10, scale: 2, nullable: true })
  diameter: number;

  @Column({ type: "varchar", length: 50, nullable: true })
  brand: string;

  @Column({ type: "varchar", length: 50, nullable: true })
  model: string;

  @Column({ type: "date", nullable: true })
  installationDate: Date;

  @Column({ type: "numeric", precision: 10, scale: 2, nullable: true })
  groundElevation: number;

  @Column({ type: "numeric", precision: 10, scale: 2, nullable: true })
  coverElevation: number;

  @Column({ type: "numeric", precision: 10, scale: 2, nullable: true })
  bottomElevation: number;

  @Column({ type: "numeric", precision: 10, scale: 2, nullable: true })
  depth: number;

  @Column({ type: "varchar", length: 20, nullable: true })
  coverSize: string;

  @Column({ type: "varchar", length: 50, nullable: true })
  coverMaterial: string;

  @Column({ type: "varchar", length: 200, nullable: true })
  roadName: string;

  @Column({ type: "varchar", length: 500, nullable: true })
  locationDescription: string;

  @Column({ type: "uuid", nullable: true })
  pipelineId: string;

  @Column({ type: "uuid", nullable: true })
  nodeId: string;

  @Column({ type: "uuid" })
  departmentId: string;

  @Column({ type: "geometry", spatialFeatureType: "Point", srid: 4326 })
  geometry: any;

  @Column({ type: "jsonb", nullable: true })
  attributes: Record<string, any>;

  @Column({ type: "enum", enum: SharingLevel, default: SharingLevel.DEPARTMENT })
  sharingLevel: SharingLevel;

  @Column({ type: "text", nullable: true })
  remarks: string;

  @Column({ type: "timestamp", nullable: true })
  lastMaintenanceDate: Date;

  @Column({ type: "timestamp", nullable: true })
  lastInspectionDate: Date;

  @ManyToOne(() => Pipeline)
  @JoinColumn({ name: "pipelineId" })
  pipeline: Pipeline;

  @ManyToOne(() => PipelineNode)
  @JoinColumn({ name: "nodeId" })
  node: PipelineNode;

  @ManyToOne(() => Department)
  @JoinColumn({ name: "departmentId" })
  department: Department;

  @OneToMany(() => WorkOrder, (workOrder) => workOrder.facility)
  workOrders: WorkOrder[];

  @OneToMany(() => ChangeHistory, (history) => history.facility)
  changeHistories: ChangeHistory[];
}
