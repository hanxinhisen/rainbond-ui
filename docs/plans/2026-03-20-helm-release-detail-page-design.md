# Rainbond Helm Release 详情页设计文档

## 一、项目背景
### 1.1 项目架构

本次需求覆盖 Rainbond 三层链路：

- `rainbond`：提供 Helm Release 详情聚合能力，返回 Release 基础信息、历史版本、参数配置和关联资源
- `rainbond-console`：代理 region 详情接口到 console 团队资源中心路径
- `rainbond-ui`：将 Helm Release 列表中的详情弹窗升级为独立详情页，并把升级、回滚操作收拢到详情页中

### 1.2 现有基础

当前资源中心已经具备以下能力：

- Helm Release 列表、安装、升级、回滚、卸载
- 工作负载详情页与容器组详情页
- `ns-resources` 通用资源列表接口
- region 侧 Helm SDK `ListReleases / Status / History / Upgrade / Rollback / Uninstall`

当前缺口：

- Helm Release 只有列表与弹窗详情，没有独立详情页
- 升级、回滚按钮仍在列表行内，信息密度高
- 缺少“以 Release 为中心”的关联资源聚合接口

### 1.3 核心需求

1. 工作空间资源中心的 Helm Release 详情改为新页面，而不是弹窗
2. Helm 列表只保留 `详情` 和 `卸载`
3. `升级`、`回滚` 收拢到详情页右上角
4. 详情页风格对齐工作负载详情页，主内容采用长页概览
5. 详情页可查看：
   - 基本信息
   - Helm 管理的工作负载
   - Helm 管理的服务
   - 其他资源
   - 历史版本
   - 当前参数配置

## 二、用户旅程（MUST — 禁止跳过）
### 2.1 用户操作流程

- 用户如何配置/触发该功能？
  - 用户进入 `工作空间 -> 资源中心 -> Helm 应用`
  - 在 Release 列表点击名称或 `详情`
- 用户如何查看状态/结果？
  - 进入新的 Helm Release 详情页
  - 在 `概览` 中查看资源分组和健康状态
  - 在 `历史版本` 中查看 revision 并触发回滚
  - 在页面右上角点击 `升级` 进入现有升级流程
- 管理员/审批人如何操作？
  - 沿用资源中心现有团队权限，无新增审批流

### 2.2 页面原型

- 页面一：Helm Release 列表页
  - 行操作：`详情`、`卸载`
  - 名称列可点击进入详情页
- 页面二：Helm Release 详情页
  - 面包屑：`Helm 应用列表页 / Helm 应用详情页`
  - 头部：Release 名称、状态、Chart、命名空间、更新时间
  - 头部操作：`升级`、`回滚`、`刷新`
  - 页签：`概览`、`历史版本`、`参数配置`
- 页面三：概览长页
  - 基本信息
  - 工作负载
  - 服务
  - 其他资源

### 2.3 外部系统交互

- Helm Release 状态和历史来自 region 侧 Helm SDK
- 关联资源来自 Kubernetes namespace-scoped 资源查询
- 资源关联依据 Helm 标准标签：
  - `app.kubernetes.io/managed-by=Helm`
  - `app.kubernetes.io/instance=<release_name>`

## 三、整体架构设计
### 3.1 系统架构图

```text
rainbond-ui ResourceCenter Helm List
    ├─ click release name/detail
    └─ Helm Release Detail Page
          ├─ Overview
          ├─ History
          └─ Values
                ↓ HTTP
rainbond-console /console/teams/{team}/regions/{region}/helm/releases/{release_name}/detail
                ↓ HTTP
rainbond /v2/tenants/{tenant_name}/helm/releases/{release_name}/detail
          ├─ Helm Status
          ├─ Helm History
          └─ K8s namespace resources filtered by Helm labels
```

### 3.2 核心流程

#### 3.2.1 详情页打开

1. 用户点击 Helm Release 名称或 `详情`
2. UI 跳转到独立详情路由
3. 前端请求 release detail 接口
4. console 透传到 region
5. region 读取 Helm Release 状态并聚合同 namespace 下带同一 `instance` 标签的资源
6. 前端按 `工作负载 / 服务 / 其他资源` 分块渲染

#### 3.2.2 升级

1. 用户在详情页点击 `升级`
2. 打开现有升级流程弹窗
3. 升级成功后刷新详情页和列表页数据

#### 3.2.3 回滚

1. 用户进入 `历史版本`
2. 选择某个 revision
3. 执行回滚
4. 成功后刷新详情页

## 四、数据模型设计
### 4.1 新增数据库表

本次不新增数据库表。

### 4.2 数据关系

新增 API 返回结构：

#### 4.2.1 HelmReleaseDetail

- `summary`
  - `name`
  - `namespace`
  - `status`
  - `chart`
  - `chart_version`
  - `app_version`
  - `revision`
  - `updated`
  - `values`
- `workloads`
  - 复用 `NsResourceInfo`
- `services`
  - 复用 `NsResourceInfo`
- `others`
  - 复用 `NsResourceInfo`
- `history`
  - 复用 `HelmReleaseHistoryItem`

#### 4.2.2 资源归类规则

- `workloads`
  - Deployment
  - StatefulSet
  - DaemonSet
  - Job
  - CronJob
- `services`
  - Service
- `others`
  - ConfigMap
  - Secret
  - PersistentVolumeClaim
  - ServiceAccount
  - Role
  - RoleBinding
  - Ingress
  - HPA
  - 其他带 Helm 标签的 namespace 资源

## 五、API设计
### 5.1 接口列表

#### 5.1.1 新增 region API

- `GET /v2/tenants/{tenant_name}/helm/releases/{release_name}/detail`

#### 5.1.2 新增 console API

- `GET /console/teams/{team}/regions/{region}/helm/releases/{release_name}/detail`

#### 5.1.3 继续复用

- `GET /console/teams/{team}/regions/{region}/helm/releases`
- `GET /console/teams/{team}/regions/{region}/helm/releases/{release_name}/history`
- `PUT /console/teams/{team}/regions/{region}/helm/releases/{release_name}`
- `POST /console/teams/{team}/regions/{region}/helm/releases/{release_name}/rollback`

### 5.2 请求/响应结构

#### 5.2.1 GET detail 响应

```json
{
  "summary": {
    "name": "grafana",
    "namespace": "monitoring",
    "status": "deployed",
    "chart": "grafana",
    "chart_version": "8.12.1",
    "app_version": "12.1.1",
    "revision": 8,
    "updated": "2026-03-20T07:20:00Z",
    "values": "replicaCount: 1\nservice:\n  type: ClusterIP\n"
  },
  "workloads": [],
  "services": [],
  "others": [],
  "history": []
}
```

## 六、核心实现设计
### 6.1 关键逻辑

#### 6.1.1 region 详情聚合

- 通过 Helm `Status(releaseName)` 获取当前 release
- 通过 Helm `History(releaseName)` 获取 revision 历史
- 通过 namespace 动态资源查询列出目标 namespace 的常见 namespace-scoped 资源
- 仅保留满足下列条件的对象：
  - `app.kubernetes.io/managed-by = Helm`
  - `app.kubernetes.io/instance = release_name`
- 按 kind 分类为 `workloads / services / others`

#### 6.1.2 参数配置展示

- 直接读取当前 Helm release 的 values
- 详情页只展示，不直接保存
- 真正修改参数仍通过升级流程提交

#### 6.1.3 前端交互迁移

- 删除列表行内 `升级 / 回滚`
- 删除旧详情弹窗入口
- 新建详情页组件，复用工作负载详情页的样式和卡片结构
- 升级弹窗保留原实现，从详情页触发
- 回滚逻辑从旧 modal 挪到详情页 `历史版本` 页签中

### 6.2 复用现有代码

- `rainbond/api/handler/helm_release.go`
- `rainbond/api/handler/ns_resource.go`
- `rainbond/api/handler/resource_center.go`
- `rainbond-console/console/views/team_resources.py`
- `rainbond-console/console/tests/team_resources_test.py`
- `rainbond-ui/src/pages/ResourceCenter/WorkloadDetail.js`
- `rainbond-ui/src/pages/ResourceCenter/index.js`
- `rainbond-ui/src/models/teamResources.js`
- `rainbond-ui/src/services/teamResource.js`

## 七、实施计划
### 跨层覆盖检查（MUST）

- [x] Go (rainbond): 需要 — 新增 Helm Release 详情聚合 DTO、handler、controller、route 和测试
- [x] Python (console): 需要 — 新增 detail 代理视图、region client 方法、URL 和测试
- [x] React (rainbond-ui): 需要 — 新增详情页路由、service/model、列表入口调整、详情页组件
- [x] Plugin: 不涉及 — 工作空间资源中心主平台功能

### Sprint 1: 后端详情接口
#### Task 1.1: region 新增 Helm Release detail 接口
- 仓库：rainbond
- 文件：`api/handler/helm_release.go`、`api/controller/helm_release.go`、`api/api_routers/version2/v2Routers.go`
- 实现内容：返回 Release 基础信息、values、history 和关联资源
- 验收标准：接口可按 release 名称稳定返回聚合结果

#### Task 1.2: region 新增测试
- 仓库：rainbond
- 文件：`api/handler/helm_release_test.go`、`api/handler/resource_center_test.go`
- 实现内容：验证聚合规则、分类结果与响应结构
- 验收标准：新增测试先失败后通过

### Sprint 2: console 代理
#### Task 2.1: console 暴露 detail 代理接口
- 仓库：rainbond-console
- 文件：`www/apiclient/regionapi.py`、`console/views/team_resources.py`、`console/urls/team_resources.py`
- 实现内容：新增 release detail 透传接口
- 验收标准：console 接口路径与 region 保持一致

#### Task 2.2: console 补测试
- 仓库：rainbond-console
- 文件：`console/tests/team_resources_test.py`
- 实现内容：验证 namespace 透传和响应返回
- 验收标准：测试通过

### Sprint 3: UI 详情页
#### Task 3.1: 列表页调整
- 仓库：rainbond-ui
- 文件：`src/pages/ResourceCenter/index.js`
- 实现内容：列表页仅保留详情与卸载；名称可跳详情页
- 验收标准：行内不再出现升级/回滚

#### Task 3.2: 新增 Helm 详情页
- 仓库：rainbond-ui
- 文件：`src/pages/ResourceCenter/HelmDetail.js`、`src/pages/ResourceCenter/detail.less`
- 实现内容：实现概览、历史版本、参数配置页签和右上角操作
- 验收标准：页面结构与工作负载详情风格一致

#### Task 3.3: service/model/router 接线
- 仓库：rainbond-ui
- 文件：`src/services/teamResource.js`、`src/models/teamResources.js`、`config/router.config.js`
- 实现内容：新增 detail 获取能力与新路由
- 验收标准：页面可正常加载详情

## 八、关键参考代码
| 功能 | 文件 | 说明 |
|------|------|------|
| Helm 生命周期接口 | `rainbond/api/handler/helm_release.go` | 已有列表、历史、升级、回滚、卸载 |
| 通用资源列表 | `rainbond/api/handler/ns_resource.go` | 已有资源状态与 Helm 来源识别 |
| 工作负载详情聚合 | `rainbond/api/handler/resource_center.go` | 可复用资源聚合方式 |
| console 团队资源中心 | `rainbond-console/console/views/team_resources.py` | Helm 与资源中心接口入口 |
| 资源中心主页面 | `rainbond-ui/src/pages/ResourceCenter/index.js` | 当前 Helm 列表页与旧弹窗逻辑 |
| 工作负载详情页 | `rainbond-ui/src/pages/ResourceCenter/WorkloadDetail.js` | 目标视觉与信息结构参考 |
