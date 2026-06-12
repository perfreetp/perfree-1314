# 数字孪生城市地下管线管理后端服务

面向管线一张图、施工审批端和巡检 App 提供统一接口的后端服务系统。

## 功能模块

| 模块 | 功能说明 |
|------|----------|
| **管线资产** | 管线 CRUD、拓扑查询（上下游追踪）、断面占用分析、空间查询、风险评分、统计分析 |
| **设施档案** | 井盖、阀门、消防栓等设施的全生命周期管理，阀门状态控制，维护历史 |
| **传感器接入** | 多协议传感器数据接入，实时压力、液位、流量、燃气浓度监控 |
| **智能告警** | 阈值告警（压力高低、液位超限、泄漏检测、燃气超标），告警分级处理 |
| **隐患管理** | 隐患点标注、多维度风险评估（可能性×0.4 + 后果×0.6）、修复跟踪 |
| **施工审批** | 开挖申请、管线冲突检测（空间/垂直/安全距离）、道路影响评估、安全校核 |
| **应急指挥** | 关阀方案自动生成（BFS管网遍历算法）、影响范围分析、受影响用户估算 |
| **巡检管理** | TSP路线优化算法、巡检任务分配、现场签到、检查结果记录 |
| **缺陷上报** | 移动端缺陷上报、照片证据、风险自动评估、工单联动 |
| **工单流转** | 维修工单全流程管理（创建→派单→处理→验收→关闭）、进度实时回传 |
| **历史追溯** | 全实体变更历史记录、差异对比、版本恢复 |
| **共享控制** | 5级共享权限（私有/部门/组织/公开/指定）、字段级控制、空间范围限制 |
| **用户权限** | 6种角色（管理员/经理/工程师/巡检员/维修员/查看员）、细粒度权限矩阵 |

## 技术栈

- **运行时**: Node.js 18+
- **语言**: TypeScript 5.x
- **Web框架**: Express.js
- **ORM**: TypeORM 0.3.x
- **数据库**: PostgreSQL 14+  **PostGIS 3.x**（空间数据支持）
- **空间计算**: Turf.js
- **认证**: JWT + bcryptjs
- **实时通信**: WebSocket（可选，告警推送）
- **安全**: Helmet + CORS

## 数据库要求

1. 安装 PostgreSQL 14+
2. 安装 PostGIS 扩展：
```sql
CREATE EXTENSION postgis;
CREATE EXTENSION postgis_topology;
```
3. 创建数据库：
```sql
CREATE DATABASE pipeline_management;
\c pipeline_management
CREATE EXTENSION postgis;
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env` 文件并根据实际情况修改：

```bash
cp .env .env.local
```

主要配置项：
```
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=pipeline_management
JWT_SECRET=your-secret-key
PORT=3000
```

### 3. 初始化数据库

```bash
# 同步数据库表结构（开发环境自动同步）
npm run migration:run

# 填充种子数据（部门、用户、管线、设施、传感器）
npm run seed
```

### 4. 启动服务

```bash
# 开发模式（热重载）
npm run dev

# 生产构建
npm run build
npm start
```

服务启动后访问：http://localhost:3000/api/health

## 核心算法

### 关阀方案生成 (`emergency.service.ts`)

```
事故点定位 → 最近管线查找 → BFS双向遍历管网
     ↓
遇到阀门 → 记录候选阀门 → 判断是否形成隔离
     ↓
优化关阀顺序（近→远） → 计算影响范围 → 估算受影响用户
```

### 巡检路线优化 (`inspection.service.ts`)

```
巡检点集合 → 最近邻算法生成初始解
     ↓
2-opt局部搜索优化 → 计算总距离和预估时间
     ↓
生成巡检任务序列
```

### 风险评分模型 (`riskAssessment.service.ts`)

```
总分 = 可能性评分 × 0.4 + 后果评分 × 0.6

可能性因子：
  • 管线年限（20%）
  • 管材材质（15%）
  • 腐蚀程度（15%）
  • 运行压力（15%）
  • 泄漏历史（35%）

后果因子：
  • 影响人口（25%）
  • 环境影响（20%）
  • 经济损失（20%）
  • 交通影响（20%）
  • 财产损失（15%）

风险等级：
  • <30 → 低风险（LOW）
  • 30-60 → 中风险（MEDIUM）
  • 60-80 → 高风险（HIGH）
  • >80 → 极高风险（VERY_HIGH）
```

### 管线冲突检测 (`conflict.service.ts`)

```
开挖区域多边形 → ST_Intersects空间查询相交管线
     ├─ 空间冲突：几何相交
     ├─ 垂直冲突：|开挖深度 - 管线埋深| < 安全净距
     └─ 安全距离：ST_Distance < 管线类型安全阈值
```

## API 接口总览

### 认证模块 (`/api/auth`)
```
POST   /api/auth/login          # 用户登录
POST   /api/auth/register       # 用户注册
POST   /api/auth/logout         # 用户登出
POST   /api/auth/refresh-token  # 刷新令牌
POST   /api/auth/change-password # 修改密码
GET    /api/auth/me             # 当前用户信息
```

### 管线模块 (`/api/pipelines`)
```
POST   /api/pipelines              # 创建管线
GET    /api/pipelines              # 管线列表（支持类型/状态/部门过滤）
GET    /api/pipelines/statistics   # 管线统计
GET    /api/pipelines/section-occupancy # 断面占用分析
POST   /api/pipelines/geometry     # 空间范围查询
GET    /api/pipelines/:id          # 管线详情
PUT    /api/pipelines/:id          # 更新管线
DELETE /api/pipelines/:id          # 删除管线
GET    /api/pipelines/:id/upstream # 上游管线追踪
GET    /api/pipelines/:id/downstream # 下游管线追踪
GET    /api/pipelines/:id/connected # 直接连接管线
```

### 设施模块 (`/api/facilities`)
```
POST   /api/facilities                    # 创建设施
GET    /api/facilities                    # 设施列表
GET    /api/facilities/statistics         # 设施统计
GET    /api/facilities/valves             # 阀门列表
GET    /api/facilities/manholes           # 井盖列表
GET    /api/facilities/type/:type         # 按类型查询
GET    /api/facilities/pipeline/:pipelineId # 按管线查询
POST   /api/facilities/geometry           # 空间查询
POST   /api/facilities/:id/valve-status   # 更新阀门状态
```

### 传感器模块 (`/api/sensors`)
```
POST   /api/sensors                    # 创建传感器
GET    /api/sensors                    # 传感器列表
GET    /api/sensors/statistics         # 传感器统计
GET    /api/sensors/readings/latest    # 最新读数
POST   /api/sensors/:id/readings       # 接入传感器读数
GET    /api/sensors/:id/readings       # 历史读数查询
```

### 告警模块 (`/api/alerts`)
```
GET    /api/alerts/active              # 活动告警
POST   /api/alerts/:id/acknowledge     # 确认告警
POST   /api/alerts/:id/resolve         # 消除告警
POST   /api/alerts/:id/work-order      # 从告警创建工单
```

### 施工审批模块 (`/api/excavations`)
```
POST   /api/excavations                    # 创建开挖申请
POST   /api/excavations/:id/submit         # 提交申请
POST   /api/excavations/:id/review         # 审核申请
POST   /api/excavations/:id/verify         # 安全校核
GET    /api/excavations/:id/conflicts      # 管线冲突列表
POST   /api/excavations/:id/conflicts/detect # 检测管线冲突
GET    /api/excavations/:id/road-impacts   # 道路影响列表
POST   /api/excavations/:id/calculate-impact # 计算道路影响
```

### 应急模块 (`/api/emergency`)
```
POST   /api/emergency/valve-closure-plan            # 生成关阀方案
GET    /api/emergency/valve-closure-plans/:id        # 关阀方案详情
POST   /api/emergency/valve-closure-plans/:id/steps/:stepId/execute # 执行关阀
POST   /api/emergency/valve-closure-plans/:id/complete # 完成关阀方案
POST   /api/emergency/calculate-isolation-area        # 计算隔离区域
```

### 巡检模块 (`/api/inspections`)
```
POST   /api/inspections/generate-route     # 生成巡检路线
GET    /api/inspections/routes             # 巡检路线列表
POST   /api/inspections/tasks/:id/start    # 开始巡检
POST   /api/inspections/tasks/:id/complete # 完成巡检
POST   /api/defects                        # 上报缺陷
GET    /api/defects/statistics             # 缺陷统计
```

### 工单模块 (`/api/work-orders`)
```
POST   /api/work-orders                  # 创建工单
POST   /api/work-orders/:id/assign       # 派单
POST   /api/work-orders/:id/start        # 开始处理
POST   /api/work-orders/:id/complete     # 完成工单
POST   /api/work-orders/:id/accept       # 验收通过
POST   /api/work-orders/:id/close        # 关闭工单
POST   /api/work-orders/:id/progress     # 添加进度记录
GET    /api/work-orders/:id/progress     # 进度历史
POST   /api/work-orders/from-alert       # 从告警创建
POST   /api/work-orders/from-defect      # 从缺陷创建
POST   /api/work-orders/from-hazard      # 从隐患创建
```

### 权限与历史
```
GET    /api/change-history/:entityType/:entityId  # 实体变更历史
POST   /api/sharing-scopes/share-to-department    # 共享给部门
POST   /api/sharing-scopes/check-permission        # 权限检查
```

## 默认账户

种子数据初始化后可用以下账户登录（密码均为 `123456`）：

| 用户名 | 角色 | 权限范围 |
|--------|------|----------|
| `admin` | 管理员 | 全部权限 |
| `manager` | 经理 | 管线、设施、工单管理 |
| `engineer` | 工程师 | 管线编辑、隐患管理 |
| `inspector` | 巡检员 | 巡检、缺陷上报 |
| `maintenance` | 维修员 | 工单处理 |
| `viewer` | 查看员 | 只读权限 |

## 项目结构

```
src/
├── config/              # 配置文件
│   └── data-source.ts   # 数据库连接配置
├── entities/            # TypeORM实体（22个）
│   ├── Base.entity.ts
│   ├── User.entity.ts
│   ├── Department.entity.ts
│   ├── Pipeline.entity.ts
│   ├── PipelineNode.entity.ts
│   ├── Facility.entity.ts
│   ├── Sensor.entity.ts
│   ├── SensorReading.entity.ts
│   ├── Alert.entity.ts
│   ├── HazardPoint.entity.ts
│   ├── RiskAssessment.entity.ts
│   ├── ExcavationApplication.entity.ts
│   ├── PipelineConflict.entity.ts
│   ├── RoadImpact.entity.ts
│   ├── ValveClosurePlan.entity.ts
│   ├── ValveClosureStep.entity.ts
│   ├── InspectionRoute.entity.ts
│   ├── InspectionTask.entity.ts
│   ├── DefectReport.entity.ts
│   ├── WorkOrder.entity.ts
│   ├── WorkOrderProgress.entity.ts
│   ├── ChangeHistory.entity.ts
│   └── SharingScope.entity.ts
├── services/            # 业务服务（15个）
├── controllers/         # API控制器（14个）
├── routes/              # 路由定义（14个）
├── middleware/          # 中间件
│   ├── auth.middleware.ts
│   └── error.middleware.ts
├── types/               # 类型定义
│   └── enums.ts         # 枚举类型
├── utils/               # 工具函数
│   ├── response.ts      # 统一响应格式
│   ├── jwt.ts           # JWT认证工具
│   ├── spatial.ts       # 空间计算工具
│   ├── pagination.ts    # 分页工具
│   └── seeder.ts        # 数据填充脚本
├── app.ts               # Express应用配置
└── server.ts            # 服务入口
```

## 统一响应格式

```json
{
  "success": true,
  "code": 200,
  "message": "操作成功",
  "data": {},
  "timestamp": 1718246400000,
  "total": 100,
  "page": 1,
  "pageSize": 20
}
```

## 开发规范

- 所有接口使用 HTTP 状态码 + 业务状态码双重标识
- 统一使用 `throwApiError` 抛出业务异常
- 统一使用 `successResponse` 返回成功响应
- 空间数据统一使用 WGS84 (EPSG:4326) 坐标系
- 分页参数：`page` (默认1) + `pageSize` (默认20，最大100)
- 日期格式：ISO 8601，使用 `dayjs` 处理

## 许可证

MIT
