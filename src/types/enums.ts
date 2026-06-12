export enum PipelineType {
  WATER = "water",
  SEWAGE = "sewage",
  GAS = "gas",
  HEAT = "heat",
  ELECTRIC = "electric",
  TELECOM = "telecom",
  RAINWATER = "rainwater",
  OTHER = "other",
}

export enum PipelineMaterial {
  CAST_IRON = "cast_iron",
  DUCTILE_IRON = "ductile_iron",
  STEEL = "steel",
  PVC = "pvc",
  PE = "pe",
  CONCRETE = "concrete",
  BRICK = "brick",
  OTHER = "other",
}

export enum PipelineStatus {
  NORMAL = "normal",
  MAINTENANCE = "maintenance",
  FAULT = "fault",
  ABANDONED = "abandoned",
  PLANNED = "planned",
}

export enum FacilityType {
  MANHOLE = "manhole",
  VALVE = "valve",
  FIRE_HYDRANT = "fire_hydrant",
  PUMP = "pump",
  METER = "meter",
  OTHER = "other",
}

export enum ValveType {
  GATE = "gate",
  BUTTERFLY = "butterfly",
  BALL = "ball",
  CHECK = "check",
  OTHER = "other",
}

export enum ValveStatus {
  OPEN = "open",
  CLOSED = "closed",
  PARTIAL = "partial",
  MAINTENANCE = "maintenance",
  FAULT = "fault",
}

export enum SensorType {
  PRESSURE = "pressure",
  LEVEL = "level",
  FLOW = "flow",
  TEMPERATURE = "temperature",
  LEAK = "leak",
  GAS = "gas",
  VIBRATION = "vibration",
  OTHER = "other",
}

export enum AlertType {
  PRESSURE_HIGH = "pressure_high",
  PRESSURE_LOW = "pressure_low",
  LEVEL_HIGH = "level_high",
  LEVEL_LOW = "level_low",
  LEAK_DETECTED = "leak_detected",
  GAS_EXCEED = "gas_exceed",
  ABNORMAL_FLOW = "abnormal_flow",
  TEMPERATURE_EXCEED = "temperature_exceed",
  DEVICE_OFFLINE = "device_offline",
  OTHER = "other",
}

export enum AlertSeverity {
  INFO = "info",
  WARNING = "warning",
  CRITICAL = "critical",
  EMERGENCY = "emergency",
}

export enum AlertStatus {
  PENDING = "pending",
  ACKNOWLEDGED = "acknowledged",
  PROCESSING = "processing",
  RESOLVED = "resolved",
  CLOSED = "closed",
}

export enum HazardType {
  CORROSION = "corrosion",
  DAMAGE = "damage",
  LEAK = "leak",
  SETTLEMENT = "settlement",
  OBSTRUCTION = "obstruction",
  AGING = "aging",
  OTHER = "other",
}

export enum RiskLevel {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  VERY_HIGH = "very_high",
}

export enum ApplicationStatus {
  DRAFT = "draft",
  SUBMITTED = "submitted",
  REVIEWING = "reviewing",
  APPROVED = "approved",
  REJECTED = "rejected",
  MODIFIED = "modified",
  COMPLETED = "completed",
}

export enum ConflictType {
  SPATIAL = "spatial",
  VERTICAL = "vertical",
  SAFETY_DISTANCE = "safety_distance",
  OTHER = "other",
}

export enum InspectionType {
  ROUTINE = "routine",
  SPECIAL = "special",
  EMERGENCY = "emergency",
}

export enum InspectionStatus {
  PENDING = "pending",
  IN_PROGRESS = "in_progress",
  COMPLETED = "completed",
  CANCELLED = "cancelled",
}

export enum DefectType {
  CRACK = "crack",
  CORROSION = "corrosion",
  LEAK = "leak",
  DEFORMATION = "deformation",
  BLOCKAGE = "blockage",
  MANHOLE_DAMAGE = "manhole_damage",
  VALVE_FAULT = "valve_fault",
  OTHER = "other",
}

export enum WorkOrderStatus {
  CREATED = "created",
  ASSIGNED = "assigned",
  IN_PROGRESS = "in_progress",
  SUSPENDED = "suspended",
  COMPLETED = "completed",
  ACCEPTED = "accepted",
  CLOSED = "closed",
}

export enum WorkOrderPriority {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  URGENT = "urgent",
}

export enum ChangeType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  STATUS_CHANGE = "status_change",
}

export enum UserRole {
  ADMIN = "admin",
  MANAGER = "manager",
  ENGINEER = "engineer",
  INSPECTOR = "inspector",
  MAINTENANCE = "maintenance",
  VIEWER = "viewer",
}

export enum SharingLevel {
  PRIVATE = "private",
  DEPARTMENT = "department",
  ORGANIZATION = "organization",
  PUBLIC = "public",
}
