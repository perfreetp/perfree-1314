import { Entity, Column, ManyToOne, JoinColumn, Index } from "typeorm";
import { BaseEntity } from "./Base.entity";
import { WorkOrderStatus } from "../types/enums";
import { WorkOrder } from "./WorkOrder.entity";
import { User } from "./User.entity";

@Entity("work_order_progress")
@Index(["workOrderId", "timestamp"])
export class WorkOrderProgress extends BaseEntity {
  @Column({ type: "uuid" })
  workOrderId: string;

  @Column({ type: "enum", enum: WorkOrderStatus })
  status: WorkOrderStatus;

  @Column({ type: "timestamp" })
  timestamp: Date;

  @Column({ type: "uuid", nullable: true })
  operatorId: string;

  @Column({ type: "varchar", length: 200, nullable: true })
  operatorName: string;

  @Column({ type: "text", nullable: true })
  description: string;

  @Column({ type: "numeric", precision: 5, scale: 2, nullable: true })
  progressPercentage: number;

  @Column({ type: "jsonb", nullable: true })
  photos: string[];

  @Column({ type: "jsonb", nullable: true })
  attributes: Record<string, any>;

  @Column({ type: "text", nullable: true })
  remarks: string;

  @ManyToOne(() => WorkOrder, (workOrder) => workOrder.progressRecords)
  @JoinColumn({ name: "workOrderId" })
  workOrder: WorkOrder;

  @ManyToOne(() => User)
  @JoinColumn({ name: "operatorId" })
  operator: User;
}
