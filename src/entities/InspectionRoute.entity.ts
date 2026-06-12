import { Entity, Column, ManyToOne, JoinColumn, Index, OneToMany } from "typeorm";
import { BaseEntity } from "./Base.entity";
import { InspectionType, PipelineType, InspectionStatus } from "../types/enums";
import { Department } from "./Department.entity";
import { User } from "./User.entity";
import { InspectionTask } from "./InspectionTask.entity";

@Entity("inspection_routes")
@Index(["type", "status"])
@Index(["departmentId"])
export class InspectionRoute extends BaseEntity {
  @Column({ type: "varchar", length: 50, unique: true })
  code: string;

  @Column({ type: "varchar", length: 200 })
  name: string;

  @Column({ type: "enum", enum: InspectionType, default: InspectionType.ROUTINE })
  type: InspectionType;

  @Column({ type: "enum", enum: InspectionStatus, default: InspectionStatus.PENDING })
  status: InspectionStatus;

  @Column({ type: "text", nullable: true })
  description: string;

  @Column({ type: "enum", enum: PipelineType, array: true, nullable: true })
  targetPipelineTypes: PipelineType[];

  @Column({ type: "uuid" })
  departmentId: string;

  @Column({ type: "uuid", nullable: true })
  createdBy: string;

  @Column({ type: "uuid", nullable: true })
  assignedInspectorId: string;

  @Column({ type: "date", nullable: true })
  plannedDate: Date;

  @Column({ type: "numeric", precision: 10, scale: 2, nullable: true })
  estimatedDistance: number;

  @Column({ type: "numeric", precision: 10, scale: 2, nullable: true })
  estimatedDuration: number;

  @Column({ type: "integer", nullable: true })
  estimatedPointsCount: number;

  @Column({ type: "geometry", spatialFeatureType: "LineString", srid: 4326, nullable: true })
  routeGeometry: any;

  @Column({ type: "geometry", nullable: true })
  area: any;

  @Column({ type: "jsonb", nullable: true })
  checkPoints: Array<{
    id: string;
    name: string;
    type: string;
    geometry: any;
    pipelineId?: string;
    facilityId?: string;
    requiredChecks: string[];
    order: number;
  }>;

  @Column({ type: "timestamp", nullable: true })
  startedAt: Date;

  @Column({ type: "timestamp", nullable: true })
  completedAt: Date;

  @Column({ type: "numeric", precision: 10, scale: 2, nullable: true })
  actualDistance: number;

  @Column({ type: "numeric", precision: 10, scale: 2, nullable: true })
  actualDuration: number;

  @Column({ type: "jsonb", nullable: true })
  attributes: Record<string, any>;

  @Column({ type: "text", nullable: true })
  remarks: string;

  @ManyToOne(() => Department)
  @JoinColumn({ name: "departmentId" })
  department: Department;

  @ManyToOne(() => User)
  @JoinColumn({ name: "createdBy" })
  creator: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: "assignedInspectorId" })
  assignedInspector: User;

  @OneToMany(() => InspectionTask, (task) => task.route)
  tasks: InspectionTask[];
}
