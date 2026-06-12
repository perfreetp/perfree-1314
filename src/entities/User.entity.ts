import { Entity, Column, ManyToOne, OneToMany, JoinColumn } from "typeorm";
import { BaseEntity } from "./Base.entity";
import { UserRole, SharingLevel } from "../types/enums";
import { Department } from "./Department.entity";
import { WorkOrder } from "./WorkOrder.entity";
import { InspectionTask } from "./InspectionTask.entity";

@Entity("users")
export class User extends BaseEntity {
  @Column({ type: "varchar", length: 50, unique: true })
  username: string;

  @Column({ type: "varchar", length: 100 })
  passwordHash: string;

  @Column({ type: "varchar", length: 50 })
  realName: string;

  @Column({ type: "varchar", length: 50, unique: true, nullable: true })
  employeeId: string;

  @Column({ type: "varchar", length: 20, nullable: true })
  phone: string;

  @Column({ type: "varchar", length: 100, nullable: true })
  email: string;

  @Column({ type: "enum", enum: UserRole, default: UserRole.VIEWER })
  role: UserRole;

  @Column({ type: "uuid", nullable: true })
  departmentId: string;

  @Column({ type: "boolean", default: true })
  isActive: boolean;

  @Column({ type: "jsonb", nullable: true })
  permissions: string[];

  @Column({ type: "geometry", nullable: true })
  defaultArea: any;

  @Column({ type: "enum", enum: SharingLevel, default: SharingLevel.DEPARTMENT })
  defaultSharingLevel: SharingLevel;

  @Column({ type: "timestamp", nullable: true })
  lastLoginAt: Date;

  @Column({ type: "timestamp", nullable: true })
  lastLogoutAt: Date;

  @ManyToOne(() => Department, (department) => department.users)
  @JoinColumn({ name: "departmentId" })
  department: Department;

  @OneToMany(() => WorkOrder, (workOrder) => workOrder.assignee)
  assignedWorkOrders: WorkOrder[];

  @OneToMany(() => WorkOrder, (workOrder) => workOrder.createdByUser)
  createdWorkOrders: WorkOrder[];

  @OneToMany(() => InspectionTask, (task) => task.inspector)
  inspectionTasks: InspectionTask[];
}
