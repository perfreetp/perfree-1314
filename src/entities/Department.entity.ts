import { Entity, Column, OneToMany, ManyToOne, JoinColumn } from "typeorm";
import { BaseEntity } from "./Base.entity";
import { PipelineType } from "../types/enums";
import { User } from "./User.entity";

@Entity("departments")
export class Department extends BaseEntity {
  @Column({ type: "varchar", length: 100 })
  name: string;

  @Column({ type: "varchar", length: 50, unique: true })
  code: string;

  @Column({ type: "text", nullable: true })
  description: string;

  @Column({ type: "uuid", nullable: true })
  parentId: string;

  @Column({ type: "enum", enum: PipelineType, array: true, nullable: true })
  responsibleTypes: PipelineType[];

  @Column({ type: "geometry", nullable: true })
  responsibleArea: any;

  @Column({ type: "varchar", length: 20, nullable: true })
  contactPhone: string;

  @Column({ type: "varchar", length: 100, nullable: true })
  contactEmail: string;

  @ManyToOne(() => Department, (department) => department.children)
  @JoinColumn({ name: "parentId" })
  parent: Department;

  @OneToMany(() => Department, (department) => department.parent)
  children: Department[];

  @OneToMany(() => User, (user) => user.department)
  users: User[];
}
