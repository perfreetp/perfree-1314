import { Entity, Column, ManyToOne, OneToMany, JoinColumn, Index } from "typeorm";
import { BaseEntity } from "./Base.entity";
import { FacilityType } from "../types/enums";
import { Pipeline } from "./Pipeline.entity";
import { Department } from "./Department.entity";

@Entity("pipeline_nodes")
@Index(["type"])
export class PipelineNode extends BaseEntity {
  @Column({ type: "varchar", length: 50, unique: true })
  code: string;

  @Column({ type: "varchar", length: 100, nullable: true })
  name: string;

  @Column({ type: "enum", enum: FacilityType, default: FacilityType.OTHER })
  type: FacilityType;

  @Column({ type: "numeric", precision: 10, scale: 2, nullable: true })
  groundElevation: number;

  @Column({ type: "numeric", precision: 10, scale: 2, nullable: true })
  bottomElevation: number;

  @Column({ type: "numeric", precision: 10, scale: 2, nullable: true })
  depth: number;

  @Column({ type: "varchar", length: 200, nullable: true })
  locationDescription: string;

  @Column({ type: "uuid" })
  departmentId: string;

  @Column({ type: "geometry", spatialFeatureType: "Point", srid: 4326 })
  geometry: any;

  @Column({ type: "jsonb", nullable: true })
  attributes: Record<string, any>;

  @Column({ type: "text", nullable: true })
  remarks: string;

  @ManyToOne(() => Department)
  @JoinColumn({ name: "departmentId" })
  department: Department;

  @OneToMany(() => Pipeline, (pipeline) => pipeline.startNode)
  outgoingPipelines: Pipeline[];

  @OneToMany(() => Pipeline, (pipeline) => pipeline.endNode)
  incomingPipelines: Pipeline[];
}
