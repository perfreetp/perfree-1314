import { Entity, Column, ManyToOne, JoinColumn, Index } from "typeorm";
import { BaseEntity } from "./Base.entity";
import { SharingLevel, PipelineType } from "../types/enums";
import { Pipeline } from "./Pipeline.entity";
import { Department } from "./Department.entity";

@Entity("sharing_scopes")
@Index(["pipelineId", "targetType", "targetId"])
export class SharingScope extends BaseEntity {
  @Column({ type: "uuid", nullable: true })
  pipelineId: string;

  @Column({ type: "uuid", nullable: true })
  facilityId: string;

  @Column({ type: "enum", enum: SharingLevel, default: SharingLevel.DEPARTMENT })
  sharingLevel: SharingLevel;

  @Column({ type: "varchar", length: 50, nullable: true })
  targetType: string;

  @Column({ type: "uuid", nullable: true })
  targetId: string;

  @Column({ type: "varchar", length: 200, nullable: true })
  targetName: string;

  @Column({ type: "enum", enum: PipelineType, array: true, nullable: true })
  allowedPipelineTypes: PipelineType[];

  @Column({ type: "geometry", nullable: true })
  allowedArea: any;

  @Column({ type: "boolean", default: true })
  canView: boolean;

  @Column({ type: "boolean", default: false })
  canEdit: boolean;

  @Column({ type: "boolean", default: false })
  canDelete: boolean;

  @Column({ type: "boolean", default: false })
  canExport: boolean;

  @Column({ type: "jsonb", nullable: true })
  allowedFields: string[];

  @Column({ type: "jsonb", nullable: true })
  deniedFields: string[];

  @Column({ type: "date", nullable: true })
  validFrom: Date;

  @Column({ type: "date", nullable: true })
  validTo: Date;

  @Column({ type: "boolean", default: true })
  isActive: boolean;

  @Column({ type: "jsonb", nullable: true })
  attributes: Record<string, any>;

  @Column({ type: "text", nullable: true })
  remarks: string;

  @ManyToOne(() => Pipeline, (pipeline) => pipeline.sharingScopes)
  @JoinColumn({ name: "pipelineId" })
  pipeline: Pipeline;

  @ManyToOne(() => Department)
  @JoinColumn({ name: "targetId" })
  targetDepartment: Department;
}
