import { Entity, Column, ManyToOne, JoinColumn, Index, OneToMany } from "typeorm";
import { BaseEntity } from "./Base.entity";
import { ApplicationStatus, PipelineType } from "../types/enums";
import { Department } from "./Department.entity";
import { User } from "./User.entity";
import { PipelineConflict } from "./PipelineConflict.entity";
import { RoadImpact } from "./RoadImpact.entity";

@Entity("excavation_applications")
@Index(["status", "createdAt"])
@Index(["applicantDepartmentId"])
export class ExcavationApplication extends BaseEntity {
  @Column({ type: "varchar", length: 50, unique: true })
  applicationNo: string;

  @Column({ type: "varchar", length: 200 })
  projectName: string;

  @Column({ type: "varchar", length: 500, nullable: true })
  projectDescription: string;

  @Column({ type: "varchar", length: 100, nullable: true })
  constructionUnit: string;

  @Column({ type: "varchar", length: 50, nullable: true })
  projectManager: string;

  @Column({ type: "varchar", length: 20, nullable: true })
  contactPhone: string;

  @Column({ type: "date", nullable: true })
  plannedStartDate: Date;

  @Column({ type: "date", nullable: true })
  plannedEndDate: Date;

  @Column({ type: "numeric", precision: 10, scale: 2, nullable: true })
  excavationDepth: number;

  @Column({ type: "numeric", precision: 10, scale: 2, nullable: true })
  excavationArea: number;

  @Column({ type: "varchar", length: 200, nullable: true })
  roadName: string;

  @Column({ type: "enum", enum: ApplicationStatus, default: ApplicationStatus.DRAFT })
  status: ApplicationStatus;

  @Column({ type: "uuid" })
  applicantDepartmentId: string;

  @Column({ type: "uuid" })
  applicantId: string;

  @Column({ type: "uuid", nullable: true })
  reviewerId: string;

  @Column({ type: "timestamp", nullable: true })
  submittedAt: Date;

  @Column({ type: "timestamp", nullable: true })
  reviewedAt: Date;

  @Column({ type: "text", nullable: true })
  reviewComments: string;

  @Column({ type: "geometry", spatialFeatureType: "Polygon", srid: 4326, nullable: true })
  excavationAreaGeometry: any;

  @Column({ type: "geometry", spatialFeatureType: "Point", srid: 4326, nullable: true })
  centerPoint: any;

  @Column({ type: "enum", enum: PipelineType, array: true, nullable: true })
  affectedPipelineTypes: PipelineType[];

  @Column({ type: "boolean", default: false })
  hasConflict: boolean;

  @Column({ type: "boolean", default: false })
  hasUndergroundFacilities: boolean;

  @Column({ type: "jsonb", nullable: true })
  protectionMeasures: string[];

  @Column({ type: "jsonb", nullable: true })
  attachments: string[];

  @Column({ type: "jsonb", nullable: true })
  attributes: Record<string, any>;

  @Column({ type: "text", nullable: true })
  remarks: string;

  @ManyToOne(() => Department)
  @JoinColumn({ name: "applicantDepartmentId" })
  applicantDepartment: Department;

  @ManyToOne(() => User)
  @JoinColumn({ name: "applicantId" })
  applicant: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: "reviewerId" })
  reviewer: User;

  @OneToMany(() => PipelineConflict, (conflict) => conflict.application)
  conflicts: PipelineConflict[];

  @OneToMany(() => RoadImpact, (impact) => impact.application)
  roadImpacts: RoadImpact[];
}
