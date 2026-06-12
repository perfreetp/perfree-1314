import { Entity, Column, ManyToOne, JoinColumn, Index } from "typeorm";
import { BaseEntity } from "./Base.entity";
import { Sensor } from "./Sensor.entity";

@Entity("sensor_readings")
@Index(["sensorId", "timestamp"])
@Index(["timestamp"])
export class SensorReading extends BaseEntity {
  @Column({ type: "uuid" })
  sensorId: string;

  @Column({ type: "numeric", precision: 15, scale: 6 })
  value: number;

  @Column({ type: "timestamp" })
  timestamp: Date;

  @Column({ type: "varchar", length: 20, nullable: true })
  unit: string;

  @Column({ type: "numeric", precision: 10, scale: 2, nullable: true })
  temperature: number;

  @Column({ type: "numeric", precision: 10, scale: 2, nullable: true })
  battery: number;

  @Column({ type: "integer", nullable: true })
  signalStrength: number;

  @Column({ type: "jsonb", nullable: true })
  rawData: Record<string, any>;

  @Column({ type: "boolean", default: false })
  isAnomaly: boolean;

  @ManyToOne(() => Sensor, (sensor) => sensor.readings)
  @JoinColumn({ name: "sensorId" })
  sensor: Sensor;
}
