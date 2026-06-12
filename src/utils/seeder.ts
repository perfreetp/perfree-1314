import "reflect-metadata";
import { AppDataSource } from "../config/data-source";
import { User } from "../entities/User.entity";
import { Department } from "../entities/Department.entity";
import { Pipeline } from "../entities/Pipeline.entity";
import { Facility } from "../entities/Facility.entity";
import { Sensor } from "../entities/Sensor.entity";
import { PipelineNode } from "../entities/PipelineNode.entity";
import { UserRole, PipelineType, PipelineMaterial, PipelineStatus, FacilityType, ValveType, ValveStatus, SensorType } from "../types/enums";
import { hashPassword } from "../utils/jwt";
import dayjs from "dayjs";

async function seed() {
  console.log("🌱 开始初始化数据库种子数据...");

  await AppDataSource.initialize();
  console.log("✅ 数据库连接成功");

  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.startTransaction();

  try {
    const userRepo = queryRunner.manager.getRepository(User);
    const deptRepo = queryRunner.manager.getRepository(Department);
    const pipelineRepo = queryRunner.manager.getRepository(Pipeline);
    const facilityRepo = queryRunner.manager.getRepository(Facility);
    const sensorRepo = queryRunner.manager.getRepository(Sensor);
    const nodeRepo = queryRunner.manager.getRepository(PipelineNode);

    console.log("📊 清理现有数据...");
    await queryRunner.query("TRUNCATE TABLE sensor_readings CASCADE");
    await queryRunner.query("TRUNCATE TABLE alerts CASCADE");
    await queryRunner.query("TRUNCATE TABLE sensors CASCADE");
    await queryRunner.query("TRUNCATE TABLE facilities CASCADE");
    await queryRunner.query("TRUNCATE TABLE pipelines CASCADE");
    await queryRunner.query("TRUNCATE TABLE pipeline_nodes CASCADE");
    await queryRunner.query("TRUNCATE TABLE users CASCADE");
    await queryRunner.query("TRUNCATE TABLE departments CASCADE");

    console.log("🏢 创建部门...");
    const depts: Department[] = [
      { code: "WATER", name: "供水管理处", description: "负责供水管网管理维护" },
      { code: "SEWAGE", name: "排水管理处", description: "负责排水管网管理维护" },
      { code: "GAS", name: "燃气管理处", description: "负责燃气管网管理维护" },
      { code: "ELECTRIC", name: "电力管理处", description: "负责电力管网管理维护" },
      { code: "TELECOM", name: "通信管理处", description: "负责通信管网管理维护" },
      { code: "HEAT", name: "热力管理处", description: "负责热力管网管理维护" },
    ].map(d => deptRepo.create(d));

    const savedDepts = await deptRepo.save(depts);
    console.log(`✅ 已创建 ${savedDepts.length} 个部门`);

    console.log("👤 创建用户...");
    const passwordHash = await hashPassword("123456");

    const users: User[] = [
      { username: "admin", realName: "系统管理员", passwordHash, role: UserRole.ADMIN, departmentId: savedDepts[0].id, phone: "13800138000", email: "admin@example.com", permissions: ["*"] },
      { username: "manager", realName: "张经理", passwordHash, role: UserRole.MANAGER, departmentId: savedDepts[0].id, phone: "13800138001", email: "manager@example.com", permissions: ["pipeline.*", "facility.*", "workOrder.*"] },
      { username: "engineer", realName: "李工程师", passwordHash, role: UserRole.ENGINEER, departmentId: savedDepts[0].id, phone: "13800138002", email: "engineer@example.com", permissions: ["pipeline.view", "pipeline.edit", "facility.view", "hazard.*"] },
      { username: "inspector", realName: "王巡检", passwordHash, role: UserRole.INSPECTOR, departmentId: savedDepts[0].id, phone: "13800138003", email: "inspector@example.com", permissions: ["inspection.*", "defect.*"] },
      { username: "maintenance", realName: "赵维修", passwordHash, role: UserRole.MAINTENANCE, departmentId: savedDepts[0].id, phone: "13800138004", email: "maintenance@example.com", permissions: ["workOrder.*"] },
      { username: "viewer", realName: "刘查看", passwordHash, role: UserRole.VIEWER, departmentId: savedDepts[0].id, phone: "13800138005", email: "viewer@example.com", permissions: ["*.view"] },
    ].map(u => userRepo.create(u));

    const savedUsers = await userRepo.save(users);
    console.log(`✅ 已创建 ${savedUsers.length} 个用户，默认密码: 123456`);

    console.log("📍 创建管点节点...");
    const nodes: PipelineNode[] = [
      { code: "N001", name: "人民广场节点", type: FacilityType.MANHOLE, departmentId: savedDepts[0].id, groundElevation: 45.5, depth: 2.5, geometry: { type: "Point", coordinates: [116.397, 39.908], srid: 4326 } },
      { code: "N002", name: "王府井节点", type: FacilityType.VALVE, departmentId: savedDepts[0].id, groundElevation: 44.8, depth: 2.2, geometry: { type: "Point", coordinates: [116.410, 39.914], srid: 4326 } },
      { code: "N003", name: "东单节点", type: FacilityType.MANHOLE, departmentId: savedDepts[0].id, groundElevation: 46.2, depth: 3.0, geometry: { type: "Point", coordinates: [116.425, 39.910], srid: 4326 } },
      { code: "N004", name: "西单节点", type: FacilityType.FIRE_HYDRANT, departmentId: savedDepts[0].id, groundElevation: 45.0, depth: 1.8, geometry: { type: "Point", coordinates: [116.370, 39.910], srid: 4326 } },
      { code: "N005", name: "天安门节点", type: FacilityType.MANHOLE, departmentId: savedDepts[0].id, groundElevation: 44.5, depth: 2.8, geometry: { type: "Point", coordinates: [116.397, 39.903], srid: 4326 } },
    ].map(n => nodeRepo.create(n));

    const savedNodes = await nodeRepo.save(nodes);
    console.log(`✅ 已创建 ${savedNodes.length} 个管点节点`);

    console.log("🚰 创建管线...");
    const pipelines: Pipeline[] = [
      {
        code: "PL-W001", name: "人民路供水管线", type: PipelineType.WATER,
        material: PipelineMaterial.DUCTILE_IRON, diameter: 300, length: 1500,
        burialDepth: 2.5, elevationStart: 45.5, elevationEnd: 44.8,
        roadName: "人民路", locationDescription: "人民广场至王府井段",
        constructionDate: dayjs("2010-06-15").toDate(), commissionDate: dayjs("2010-09-01").toDate(),
        status: PipelineStatus.NORMAL, startNodeId: savedNodes[0].id, endNodeId: savedNodes[1].id,
        departmentId: savedDepts[0].id, riskScore: 25,
        geometry: { type: "LineString", coordinates: [[116.397, 39.908], [116.400, 39.910], [116.405, 39.912], [116.410, 39.914]], srid: 4326 },
        attributes: { pressureZone: "Zone A", flowDirection: "east" }
      },
      {
        code: "PL-W002", name: "东长安街供水管线", type: PipelineType.WATER,
        material: PipelineMaterial.STEEL, diameter: 500, length: 2000,
        burialDepth: 3.0, elevationStart: 44.8, elevationEnd: 46.2,
        roadName: "东长安街", locationDescription: "王府井至东单段",
        constructionDate: dayjs("2015-03-20").toDate(), commissionDate: dayjs("2015-06-10").toDate(),
        status: PipelineStatus.NORMAL, startNodeId: savedNodes[1].id, endNodeId: savedNodes[2].id,
        departmentId: savedDepts[0].id, riskScore: 35,
        geometry: { type: "LineString", coordinates: [[116.410, 39.914], [116.415, 39.912], [116.420, 39.911], [116.425, 39.910]], srid: 4326 },
        attributes: { pressureZone: "Zone A", flowDirection: "east" }
      },
      {
        code: "PL-S001", name: "西长安街排水管线", type: PipelineType.SEWAGE,
        material: PipelineMaterial.CONCRETE, diameter: 800, length: 1800,
        burialDepth: 3.5, elevationStart: 45.0, elevationEnd: 44.5,
        roadName: "西长安街", locationDescription: "西单至天安门段",
        constructionDate: dayjs("2008-08-08").toDate(), commissionDate: dayjs("2008-12-01").toDate(),
        status: PipelineStatus.NORMAL, startNodeId: savedNodes[3].id, endNodeId: savedNodes[4].id,
        departmentId: savedDepts[1].id, riskScore: 45,
        geometry: { type: "LineString", coordinates: [[116.370, 39.910], [116.380, 39.908], [116.390, 39.905], [116.397, 39.903]], srid: 4326 },
        attributes: { slope: 0.003, maxCapacity: 500 }
      },
      {
        code: "PL-G001", name: "王府井燃气干线", type: PipelineType.GAS,
        material: PipelineMaterial.STEEL, diameter: 200, length: 1200,
        burialDepth: 1.8, elevationStart: 44.8, elevationEnd: 45.5,
        roadName: "王府井大街", locationDescription: "王府井至人民广场段",
        constructionDate: dayjs("2012-11-01").toDate(), commissionDate: dayjs("2013-02-15").toDate(),
        status: PipelineStatus.NORMAL, startNodeId: savedNodes[1].id, endNodeId: savedNodes[0].id,
        departmentId: savedDepts[2].id, riskScore: 75,
        geometry: { type: "LineString", coordinates: [[116.410, 39.914], [116.405, 39.912], [116.400, 39.910], [116.397, 39.908]], srid: 4326 },
        attributes: { pressure: "medium", operatingPressure: 0.4 }
      },
    ].map(p => pipelineRepo.create(p));

    const savedPipelines = await pipelineRepo.save(pipelines);
    console.log(`✅ 已创建 ${savedPipelines.length} 条管线`);

    console.log("🔧 创建设施（井盖、阀门）...");
    const facilities: Facility[] = [
      {
        code: "F-M001", name: "人民广场1号井盖", type: FacilityType.MANHOLE,
        pipelineType: PipelineType.WATER, pipelineId: savedPipelines[0].id,
        diameter: 800, coverSize: "700", coverMaterial: "球墨铸铁",
        roadName: "人民路", locationDescription: "人民广场东南角",
        installationDate: dayjs("2010-06-15").toDate(),
        groundElevation: 45.5, coverElevation: 45.5, bottomElevation: 43.0, depth: 2.5,
        departmentId: savedDepts[0].id,
        geometry: { type: "Point", coordinates: [116.398, 39.909], srid: 4326 },
        lastMaintenanceDate: dayjs("2026-03-15").toDate(),
        lastInspectionDate: dayjs("2026-05-20").toDate(),
      },
      {
        code: "F-V001", name: "王府井主阀门", type: FacilityType.VALVE,
        valveType: ValveType.GATE, status: ValveStatus.OPEN,
        pipelineType: PipelineType.WATER, pipelineId: savedPipelines[0].id, nodeId: savedNodes[1].id,
        diameter: 300, brand: "沃茨", model: "Z45X-16Q",
        roadName: "王府井大街", locationDescription: "王府井大街与东长安街交口",
        installationDate: dayjs("2010-06-15").toDate(),
        groundElevation: 44.8, depth: 2.2,
        departmentId: savedDepts[0].id,
        geometry: { type: "Point", coordinates: [116.410, 39.914], srid: 4326 },
        lastMaintenanceDate: dayjs("2026-04-10").toDate(),
        lastInspectionDate: dayjs("2026-06-01").toDate(),
      },
      {
        code: "F-V002", name: "东单控制阀", type: FacilityType.VALVE,
        valveType: ValveType.BUTTERFLY, status: ValveStatus.OPEN,
        pipelineType: PipelineType.WATER, pipelineId: savedPipelines[1].id, nodeId: savedNodes[2].id,
        diameter: 500, brand: "泰科", model: "D341X-16Q",
        roadName: "东长安街", locationDescription: "东单路口西侧",
        installationDate: dayjs("2015-03-20").toDate(),
        groundElevation: 46.2, depth: 3.0,
        departmentId: savedDepts[0].id,
        geometry: { type: "Point", coordinates: [116.425, 39.910], srid: 4326 },
        lastMaintenanceDate: dayjs("2026-02-28").toDate(),
        lastInspectionDate: dayjs("2026-05-15").toDate(),
      },
      {
        code: "F-FH001", name: "西单消防栓", type: FacilityType.FIRE_HYDRANT,
        pipelineType: PipelineType.WATER, pipelineId: savedPipelines[2].id,
        roadName: "西长安街", locationDescription: "西单路口东北角",
        installationDate: dayjs("2008-08-08").toDate(),
        groundElevation: 45.0, depth: 1.8,
        departmentId: savedDepts[0].id,
        geometry: { type: "Point", coordinates: [116.370, 39.910], srid: 4326 },
        lastMaintenanceDate: dayjs("2026-04-01").toDate(),
        lastInspectionDate: dayjs("2026-06-05").toDate(),
      },
      {
        code: "F-M002", name: "天安门污水井", type: FacilityType.MANHOLE,
        pipelineType: PipelineType.SEWAGE, pipelineId: savedPipelines[2].id, nodeId: savedNodes[4].id,
        diameter: 1000, coverSize: "800", coverMaterial: "钢筋混凝土",
        roadName: "西长安街", locationDescription: "天安门广场西侧",
        installationDate: dayjs("2008-08-08").toDate(),
        groundElevation: 44.5, coverElevation: 44.5, bottomElevation: 41.0, depth: 3.5,
        departmentId: savedDepts[1].id,
        geometry: { type: "Point", coordinates: [116.397, 39.903], srid: 4326 },
        lastMaintenanceDate: dayjs("2026-03-20").toDate(),
        lastInspectionDate: dayjs("2026-05-25").toDate(),
      },
      {
        code: "F-V003", name: "王府井燃气阀门", type: FacilityType.VALVE,
        valveType: ValveType.BALL, status: ValveStatus.OPEN,
        pipelineType: PipelineType.GAS, pipelineId: savedPipelines[3].id,
        diameter: 200, brand: "Fisher", model: "EZ",
        roadName: "王府井大街", locationDescription: "王府井大街中段",
        installationDate: dayjs("2012-11-01").toDate(),
        groundElevation: 44.8, depth: 1.8,
        departmentId: savedDepts[2].id,
        geometry: { type: "Point", coordinates: [116.405, 39.912], srid: 4326 },
        lastMaintenanceDate: dayjs("2026-04-15").toDate(),
        lastInspectionDate: dayjs("2026-06-10").toDate(),
      },
    ].map(f => facilityRepo.create(f));

    const savedFacilities = await facilityRepo.save(facilities);
    console.log(`✅ 已创建 ${savedFacilities.length} 个设施`);

    console.log("📡 创建传感器...");
    const sensors: Sensor[] = [
      {
        code: "S-P001", name: "人民广场压力传感器", type: SensorType.PRESSURE,
        pipelineType: PipelineType.WATER, deviceId: "PRESS-001", protocol: "Modbus-RTU",
        communicationMethod: "4G", samplingInterval: 300, unit: "MPa",
        minValue: 0, maxValue: 1.6, warningLow: 0.2, warningHigh: 0.8,
        criticalLow: 0.1, criticalHigh: 1.0,
        pipelineId: savedPipelines[0].id, departmentId: savedDepts[0].id,
        geometry: { type: "Point", coordinates: [116.3975, 39.9085], srid: 4326 },
        installationDepth: 2.5, installationDate: dayjs("2023-05-01").toDate(),
        lastCalibrationDate: dayjs("2026-05-01").toDate(),
        brand: "Siemens", model: "SITRANS P320",
      },
      {
        code: "S-P002", name: "东单压力传感器", type: SensorType.PRESSURE,
        pipelineType: PipelineType.WATER, deviceId: "PRESS-002", protocol: "Modbus-RTU",
        communicationMethod: "4G", samplingInterval: 300, unit: "MPa",
        minValue: 0, maxValue: 1.6, warningLow: 0.2, warningHigh: 0.8,
        criticalLow: 0.1, criticalHigh: 1.0,
        pipelineId: savedPipelines[1].id, departmentId: savedDepts[0].id,
        geometry: { type: "Point", coordinates: [116.425, 39.910], srid: 4326 },
        installationDepth: 3.0, installationDate: dayjs("2023-06-15").toDate(),
        lastCalibrationDate: dayjs("2026-06-01").toDate(),
        brand: "Siemens", model: "SITRANS P320",
      },
      {
        code: "S-L001", name: "天安门液位传感器", type: SensorType.LEVEL,
        pipelineType: PipelineType.SEWAGE, deviceId: "LEVEL-001", protocol: "LoRaWAN",
        communicationMethod: "LoRa", samplingInterval: 600, unit: "m",
        minValue: 0, maxValue: 3.0, warningHigh: 2.0, criticalHigh: 2.5,
        pipelineId: savedPipelines[2].id, departmentId: savedDepts[1].id,
        geometry: { type: "Point", coordinates: [116.397, 39.903], srid: 4326 },
        installationDepth: 3.5, installationDate: dayjs("2022-10-01").toDate(),
        lastCalibrationDate: dayjs("2026-04-15").toDate(),
        brand: "Endress+Hauser", model: "VEGAPULS 64",
      },
      {
        code: "S-F001", name: "王府井流量传感器", type: SensorType.FLOW,
        pipelineType: PipelineType.WATER, deviceId: "FLOW-001", protocol: "Modbus-TCP",
        communicationMethod: "光纤", samplingInterval: 60, unit: "m³/h",
        minValue: 0, maxValue: 500, warningLow: 10, warningHigh: 400,
        criticalLow: 5, criticalHigh: 450,
        pipelineId: savedPipelines[0].id, departmentId: savedDepts[0].id,
        geometry: { type: "Point", coordinates: [116.400, 39.910], srid: 4326 },
        installationDepth: 2.5, installationDate: dayjs("2023-03-20").toDate(),
        lastCalibrationDate: dayjs("2026-03-20").toDate(),
        brand: "Krohne", model: "OPTIFLUX 4000",
      },
      {
        code: "S-G001", name: "王府井燃气浓度传感器", type: SensorType.GAS,
        pipelineType: PipelineType.GAS, deviceId: "GAS-001", protocol: "NB-IoT",
        communicationMethod: "NB-IoT", samplingInterval: 120, unit: "%LEL",
        minValue: 0, maxValue: 100, warningHigh: 20, criticalHigh: 50,
        pipelineId: savedPipelines[3].id, departmentId: savedDepts[2].id,
        geometry: { type: "Point", coordinates: [116.405, 39.912], srid: 4326 },
        installationDepth: 1.8, installationDate: dayjs("2024-01-10").toDate(),
        lastCalibrationDate: dayjs("2026-05-10").toDate(),
        brand: "MSA", model: "Altair 5X",
      },
      {
        code: "S-LK001", name: "人民广场漏水传感器", type: SensorType.LEAK,
        pipelineType: PipelineType.WATER, deviceId: "LEAK-001", protocol: "NB-IoT",
        communicationMethod: "NB-IoT", samplingInterval: 3600, unit: "状态",
        minValue: 0, maxValue: 1, warningHigh: 1, criticalHigh: 1,
        pipelineId: savedPipelines[0].id, departmentId: savedDepts[0].id,
        geometry: { type: "Point", coordinates: [116.397, 39.908], srid: 4326 },
        installationDepth: 2.5, installationDate: dayjs("2024-03-15").toDate(),
        lastCalibrationDate: dayjs("2026-03-15").toDate(),
        brand: "PermaNet", model: "PermaNet+",
      },
    ].map(s => sensorRepo.create(s));

    const savedSensors = await sensorRepo.save(sensors);
    console.log(`✅ 已创建 ${savedSensors.length} 个传感器`);

    await queryRunner.commitTransaction();
    console.log("\n🎉 种子数据初始化完成！");
    console.log("\n📋 初始化数据统计:");
    console.log(`   - 部门: ${savedDepts.length} 个`);
    console.log(`   - 用户: ${savedUsers.length} 个`);
    console.log(`   - 管点节点: ${savedNodes.length} 个`);
    console.log(`   - 管线: ${savedPipelines.length} 条`);
    console.log(`   - 设施: ${savedFacilities.length} 个`);
    console.log(`   - 传感器: ${savedSensors.length} 个`);
    console.log("\n🔑 默认账户:");
    console.log(`   - 管理员: admin / 123456`);
    console.log(`   - 经理: manager / 123456`);
    console.log(`   - 工程师: engineer / 123456`);
    console.log(`   - 巡检员: inspector / 123456`);
    console.log(`   - 维修员: maintenance / 123456`);
    console.log(`   - 查看员: viewer / 123456`);
    console.log("\n🚀 现在可以运行 `npm run dev` 启动服务了！");

  } catch (error) {
    await queryRunner.rollbackTransaction();
    console.error("❌ 种子数据初始化失败:", error);
    throw error;
  } finally {
    await queryRunner.release();
    await AppDataSource.destroy();
  }
}

seed().catch(console.error);
