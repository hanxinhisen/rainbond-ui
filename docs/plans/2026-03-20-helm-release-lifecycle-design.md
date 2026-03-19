# Rainbond Helm Release 生命周期管理设计文档

## 一、项目背景
### 1.1 项目架构

本次需求面向 Rainbond 工作空间视图中的资源中心 Helm 标签页，目标是在现有 Helm Release 列表基础上补齐 Helm 原生生命周期能力：

- 升级
- 回滚
- 卸载

功能链路覆盖三层仓库：

- `rainbond-ui`：资源中心页面、升级/回滚弹窗、交互编排
- `rainbond-console`：团队资源中心接口代理、参数透传、namespace 处理
- `rainbond`：Helm Release 的升级检测、升级执行、历史查询、回滚执行

### 1.2 现有基础

当前系统已经具备以下基础能力：

- 资源中心 Helm Release 列表展示与卸载：
  - `rainbond-ui/src/pages/ResourceCenter/index.js`
  - `rainbond-ui/src/models/teamResources.js`
  - `rainbond-ui/src/services/teamResource.js`
- Helm Release 三种创建方式与安装前 preview：
  - `rainbond-ui/docs/plans/2026-03-19-helm-release-create-modes-design.md`
- region 已具备 Helm SDK 封装：
  - `pkg/helm/helm.go` 中已有 `Upgrade`、`History`、`Rollback`、`Uninstall`
- 资源中心后端链路已具备：
  - `GET /helm/releases`
  - `POST /helm/releases`
  - `POST /helm/chart-preview`
  - `DELETE /helm/releases/{release_name}`

### 1.3 核心需求

需要在资源中心 Helm 标签页补齐如下能力，并与 Helm 原生能力保持一致：

1. 所有 Helm Release 都支持升级、回滚、卸载
2. 回滚必须先展示 Helm revision 历史，再执行回滚
3. 升级采用“双轨升级”：
   - 自动发现：当系统能从已配置 Helm 仓库可靠识别到更高版本时，显示推荐升级版本
   - 手动升级：无论 release 来自 repo、OCI、上传包还是历史未知来源，都允许用户手动指定目标 chart 进行升级
4. 不记录“安装来源”到数据库或额外存储；能力判断完全基于当前 release 状态与用户本次输入
5. 产品行为必须与 Helm 原生语义一致：
   - `upgrade` 允许使用 repo、OCI、tgz、chart path 等多种来源
   - `rollback` 只依赖 release history，与初始安装来源无关

## 二、用户旅程（MUST — 禁止跳过）
### 2.1 用户操作流程

- 用户如何配置/触发该功能？
  - 用户进入 `工作空间 -> 资源中心 -> Helm 应用`
  - 在某个 Release 行点击 `升级`、`回滚`、`卸载`
- 用户如何查看状态/结果？
  - 升级成功后列表刷新，展示新的 chart version / revision / 更新时间
  - 回滚成功后列表刷新，展示回滚后的 revision 和状态
  - 若升级或回滚失败，在当前弹窗中显示错误信息
- 管理员/审批人如何操作？
  - 沿用团队资源中心现有权限，无新增审批流

### 2.2 页面原型

- 页面一：资源中心 Helm 列表页
  - 列展示：Release 名称、Chart、状态、版本号、命名空间、更新时间
  - 行操作：`详情`、`升级`、`回滚`、`卸载`
- 页面二：升级弹窗
  - 区域 A：当前 Release 信息
  - 区域 B：自动升级卡片
    - 若识别到更高版本，展示“推荐升级到 x.y.z”
    - 若无法识别，则展示“未发现可自动识别的升级版本”
  - 区域 C：手动升级
    - `Helm 商店`
    - `第三方仓库 / OCI`
    - `上传 Chart 包`
  - 区域 D：Chart preview / README / values 编辑
- 页面三：回滚历史弹窗
  - 展示 revision、chart version、app version、状态、更新时间
  - 用户选择目标 revision 后执行回滚

### 2.3 外部系统交互

- Helm 仓库：使用已配置 appstore / Helm repo 查询 chart 版本列表
- OCI 仓库：用户手动输入 `oci://` chart 引用与认证信息
- 上传包：用户上传新的 `.tgz`，由现有事件上传机制处理
- Kubernetes 集群：最终由 region 侧 Helm SDK 对 release 执行 upgrade / rollback / uninstall

## 三、整体架构设计
### 3.1 系统架构图

```text
rainbond-ui ResourceCenter Helm List
    ├─ Upgrade Modal
    │   ├─ auto detect (repo versions if discoverable)
    │   └─ manual target chart (store / repo / oci / upload)
    ├─ Rollback History Modal
    └─ Uninstall Confirm
            ↓ HTTP
rainbond-console /console/teams/{team}/regions/{region}/helm/*
            ↓ HTTP
rainbond /v2/tenants/{tenant}/helm/*
            ├─ list releases
            ├─ list release history
            ├─ list upgrade options
            ├─ upgrade release
            ├─ rollback release
            └─ uninstall release
            ↓
Helm storage + Kubernetes namespace resources
```

### 3.2 核心流程

#### 3.2.1 自动发现升级

1. 用户点击某个 release 的 `升级`
2. 前端请求 `upgrade-options`
3. region 基于当前 release 的 chart name / chart version，在已配置仓库中查找匹配 chart
4. 若存在唯一且可信的更高版本集合，则返回可升级版本列表
5. 前端展示推荐版本与快速升级入口

#### 3.2.2 手动升级

1. 用户点击 `升级`
2. 自动发现结果仅作为辅助，不阻塞手动升级
3. 用户可选择以下任一目标来源：
   - 平台已配置 Helm 仓库
   - 第三方 repo chart URL
   - OCI chart URL
   - 上传新的 `.tgz`
4. 前端调用 preview 接口解析目标 chart
5. preview 成功后，用户编辑 values 并提交升级
6. region 使用用户本次提供的目标 chart 执行 Helm upgrade

#### 3.2.3 历史回滚

1. 用户点击 `回滚`
2. 前端请求 history 列表
3. region 返回 release revision 历史
4. 用户选择 revision
5. 前端调用 rollback 接口
6. region 执行 Helm rollback

## 四、数据模型设计
### 4.1 新增数据库表

本次不新增数据库表。

原因：

- Helm lifecycle 状态由 Helm release 历史本身维护
- 自动升级检测结果可动态计算，不需要持久化
- 手动升级参数仅在本次升级请求中使用

### 4.2 数据关系

新增的数据结构全部为 API 请求/响应结构。

#### 4.2.1 HelmReleaseHistoryItem

- `revision`
- `chart`
- `chart_version`
- `app_version`
- `status`
- `description`
- `updated`

#### 4.2.2 HelmReleaseUpgradeOption

- `mode`
  - `auto`
  - `manual_only`
- `repo_name`
- `chart`
- `current_version`
- `available_versions`
- `recommended_version`
- `reason`

#### 4.2.3 HelmReleaseUpgradeRequest

- `release_name`
- `source_type`
  - `store`
  - `repo`
  - `oci`
  - `upload`
- `repo_name`
- `repo_url`
- `chart`
- `chart_name`
- `chart_url`
- `version`
- `values`
- `username`
- `password`
- `event_id`

#### 4.2.4 HelmReleaseRollbackRequest

- `release_name`
- `revision`

## 五、API设计
### 5.1 接口列表

#### 5.1.1 新增 region API

- `GET /v2/tenants/{tenant_name}/helm/releases/{release_name}/history`
- `GET /v2/tenants/{tenant_name}/helm/releases/{release_name}/upgrade-options`
- `PUT /v2/tenants/{tenant_name}/helm/releases/{release_name}`
- `POST /v2/tenants/{tenant_name}/helm/releases/{release_name}/rollback`

#### 5.1.2 新增 console API

- `GET /console/teams/{team}/regions/{region}/helm/releases/{release_name}/history`
- `GET /console/teams/{team}/regions/{region}/helm/releases/{release_name}/upgrade-options`
- `PUT /console/teams/{team}/regions/{region}/helm/releases/{release_name}`
- `POST /console/teams/{team}/regions/{region}/helm/releases/{release_name}/rollback`

#### 5.1.3 继续复用

- `GET /console/teams/{team}/regions/{region}/helm/releases`
- `POST /console/teams/{team}/regions/{region}/helm/chart-preview`
- `DELETE /console/teams/{team}/regions/{region}/helm/releases/{release_name}`

### 5.2 请求/响应结构

#### 5.2.1 GET history 响应

```json
{
  "list": [
    {
      "revision": 3,
      "chart": "nginx",
      "chart_version": "15.10.0",
      "app_version": "1.27.1",
      "status": "deployed",
      "description": "Upgrade complete",
      "updated": "2026-03-20T07:20:00Z"
    }
  ],
  "total": 3
}
```

#### 5.2.2 GET upgrade-options 响应

```json
{
  "mode": "auto",
  "repo_name": "bitnami",
  "chart": "nginx",
  "current_version": "15.9.0",
  "available_versions": ["15.10.0", "15.10.1"],
  "recommended_version": "15.10.1",
  "reason": ""
}
```

若无法自动识别，则返回：

```json
{
  "mode": "manual_only",
  "available_versions": [],
  "reason": "release chart cannot be matched to a unique configured repo"
}
```

#### 5.2.3 PUT upgrade 请求

```json
{
  "source_type": "oci",
  "chart_url": "oci://registry-1.docker.io/bitnamicharts/nginx",
  "version": "15.10.1",
  "values": "service:\\n  type: ClusterIP",
  "username": "",
  "password": ""
}
```

#### 5.2.4 POST rollback 请求

```json
{
  "revision": 2
}
```

## 六、核心实现设计
### 6.1 关键逻辑

#### 6.1.1 自动升级检测策略

不记录安装来源，改为动态探测：

1. 读取当前 release 的 `chart`、`chart_version`
2. 遍历平台已配置 Helm 仓库
3. 查找名称匹配的 chart
4. 若只有一个可信匹配源，则返回大于当前版本的可升级版本列表
5. 若存在多个候选、无候选、版本非 semver 或信息不完整，则降级为 `manual_only`

说明：

- 自动发现只是辅助能力，不作为升级能力的前置条件
- 所有 release 都保留手动升级入口

#### 6.1.2 手动升级策略

与安装阶段三种来源保持一致，并补充同名 release 语义：

- `store`
  - 使用平台已配置仓库与 chart 名称升级
- `repo`
  - 使用第三方 repo URL 或直接 chart URL 升级
- `oci`
  - 使用 `oci://` chart URL 升级
- `upload`
  - 上传新 `.tgz` 后升级

升级前必须执行 preview，并附加如下保护：

1. 目标 chart 必须能成功 preview
2. 默认校验目标 chart `metadata.name` 与当前 release chart 名一致
3. 若不一致，则不允许直接升级，避免把完全不同的 chart 升到同一个 release

#### 6.1.3 回滚策略

完全遵循 Helm 原生：

1. 通过 `History` 拉取 revision 列表
2. 列表中仅展示有效 revision
3. 用户选择 revision 后调用 `Rollback`
4. 不依赖 release 最初安装来源

#### 6.1.4 UI 行为策略

- 所有 release 都显示：
  - `升级`
  - `回滚`
  - `卸载`
- `回滚`按钮在无历史 revision 时可点击后提示“暂无可回滚版本”，或者直接禁用
- `升级`按钮点击后总能进入升级弹窗
- 弹窗内若自动升级检测失败，不隐藏升级能力，只提示用户改用手动升级

### 6.2 复用现有代码

- 复用：
  - 现有 Helm 安装 preview 能力
  - 现有三种安装来源 UI 结构
  - 现有上传 chart 事件与 preview 解析
  - `pkg/helm/helm.go` 中已有的 `Upgrade`、`History`、`Rollback`
- 新增：
  - Helm release history summary 转换
  - upgrade-options 动态探测
  - release 级 upgrade / rollback controller、handler、console bridge
- 不做：
  - 来源持久化
  - 额外数据库表
  - OCI tag 自动发现

## 七、实施计划
### 跨层覆盖检查（MUST）

- [x] Go (rainbond): 需要 — 新增 history、upgrade-options、upgrade、rollback API 及请求/响应结构
- [x] Python (console): 需要 — 新增 region client、view、url、测试
- [x] React (rainbond-ui): 需要 — 新增升级弹窗、回滚历史弹窗、列表操作与状态管理
- [x] Plugin: 不涉及 — 资源中心原生能力，不涉及插件

### Sprint 1: rainbond Helm 生命周期 API

#### Task 1.1: 扩展 handler 与 controller
- 仓库：rainbond
- 文件：
  - `rainbond/api/controller/helm_release.go`
  - `rainbond/api/handler/helm_release.go`
  - `rainbond/api/api_routers/version2/v2Routers.go`
- 实现内容：
  - 新增 history、upgrade-options、upgrade、rollback 路由与控制器
  - 扩展 release summary / history / upgrade option 结构
- 验收标准：
  - v2 API 可以完整覆盖列表、升级检测、升级、回滚、卸载

#### Task 1.2: 扩展 Helm 封装
- 仓库：rainbond
- 文件：
  - `rainbond/pkg/helm/helm.go`
  - `rainbond/api/handler/helm_release.go`
- 实现内容：
  - 为多来源 upgrade 补齐统一入口
  - 补齐 history summary 转换
  - 补齐 upgrade-options 仓库探测逻辑
- 验收标准：
  - store / repo / oci / upload 都能通过统一请求升级
  - history 可用于回滚选择

### Sprint 2: rainbond-console 代理层

#### Task 2.1: 扩展 regionapi
- 仓库：rainbond-console
- 文件：
  - `rainbond-console/www/apiclient/regionapi.py`
- 实现内容：
  - 新增 history、upgrade-options、upgrade、rollback 请求函数
- 验收标准：
  - console 可以完整代理新 region API

#### Task 2.2: 扩展团队资源中心 view / url / tests
- 仓库：rainbond-console
- 文件：
  - `rainbond-console/console/views/team_resources.py`
  - `rainbond-console/console/urls/team_resources.py`
  - `rainbond-console/console/tests/team_resources_test.py`
- 实现内容：
  - 新增 4 个资源中心 Helm 生命周期接口
  - 延续 namespace 透传策略
- 验收标准：
  - 单测覆盖 namespace、透传字段与回滚 revision

### Sprint 3: rainbond-ui 资源中心生命周期管理

#### Task 3.1: 扩展 service / model
- 仓库：rainbond-ui
- 文件：
  - `rainbond-ui/src/services/teamResource.js`
  - `rainbond-ui/src/models/teamResources.js`
- 实现内容：
  - 新增 history、upgrade-options、upgrade、rollback service 与 effect
- 验收标准：
  - 前端状态层可完整编排升级与回滚

#### Task 3.2: 扩展资源中心 Helm 列表与弹窗
- 仓库：rainbond-ui
- 文件：
  - `rainbond-ui/src/pages/ResourceCenter/index.js`
  - `rainbond-ui/src/pages/ResourceCenter/index.less`
- 实现内容：
  - 列表新增升级、回滚操作
  - 新增升级弹窗与回滚历史弹窗
  - 复用现有 preview / values 编辑 / 上传逻辑
- 验收标准：
  - 所有 release 都能进入升级流程
  - 有 history 的 release 可回滚
  - 升级成功后列表刷新

## 八、关键参考代码

| 功能 | 文件 | 说明 |
|------|------|------|
| 资源中心 Helm 列表与安装弹窗 | `rainbond-ui/src/pages/ResourceCenter/index.js` | 当前 UI 主入口 |
| Helm 资源中心前端状态 | `rainbond-ui/src/models/teamResources.js` | 现有 list/install/preview/uninstall effect |
| Helm 资源中心前端接口 | `rainbond-ui/src/services/teamResource.js` | 现有 console API 调用 |
| console 团队资源中心视图 | `rainbond-console/console/views/team_resources.py` | 当前 Helm list/install/preview/uninstall 代理 |
| console 团队资源中心路由 | `rainbond-console/console/urls/team_resources.py` | 资源中心接口总路由 |
| console region api client | `rainbond-console/www/apiclient/regionapi.py` | console -> region 调用封装 |
| region Helm release controller | `rainbond/api/controller/helm_release.go` | 当前 Helm Release HTTP 入口 |
| region Helm release handler | `rainbond/api/handler/helm_release.go` | 当前 list/install/preview/uninstall 核心逻辑 |
| Helm SDK 封装 | `rainbond/pkg/helm/helm.go` | 已有 Upgrade / History / Rollback / Uninstall 能力 |
