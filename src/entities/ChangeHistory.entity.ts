import { Entity, Column, ManyToOne, JoinColumn, Index } from "typeorm";
import { BaseEntity } from "./Base.entity";
import { ChangeType } from "../types/enums";
import { Pipeline } from "./Pipeline.entity";
import { Facility } from "./Facility.entity";
import { User } from "./User.entity";

@Entity("change_histories")
@Index(["entityType", "entityId", "createdAt"])
@Index(["changeType", "createdAt"])
export class ChangeHistory extends BaseEntity {
  @Column({ type: "varchar", length: 50 })
  entityType: string;

  @Column({ type: "uuid" })
  entityId: string;

  @Column({ type: "enum", enum: ChangeType })
  changeType: ChangeType;

  @Column({ type: "varchar", length: 200, nullable: true })
  fieldName: string;

  @Column({ type: "text", nullable: true })
  oldValue: string;

  @Column({ type: "text", nullable: true })
  newValue: string;

  @Column({ type: "uuid", nullable: true })
  operatorId: string;

  @Column({ type: "varchar", length: 100, nullable: true })
  operatorName: string;

  @Column({ type: "varchar", length: 200, nullable: true })
  changeReason: string;

  @Column({ type: "jsonb", nullable: true })
  oldValues: Record<string, any>;

  @Column({ type: "jsonb", nullable: true })
  newValues: Record<string, any>;

  @Column({ type: "jsonb", nullable: true })
  diff: Record<string, any>;

  @Column({ type: "text", nullable: true })
  remarks: string;

  @ManyToOne(() => Pipeline, (pipeline) => pipeline.changeHistories)
  @JoinColumn({ name: "entityId" })
  pipeline: Pipeline;

  @ManyToOne(() => Facility, (facility) => facility.changeHistories)
  @JoinColumn({ name: "entityId" })
  facility: Facility;

  @ManyToOne(() => User)
  @JoinColumn({ name: "operatorId" })
  operator: User;
}
