# Rainbond Helm Release 三种创建方式设计文档

## 一、项目背景
### 1.1 项目架构

本次需求面向 Rainbond 的团队资源中心，目标是在 `rainbond-ui` 资源中心的 Helm 安装弹窗中统一支持三种 Helm Release 创建方式，并保持最终语义为“直接安装 Helm Release 到团队命名空间”。

当前相关链路分布如下：

- `rainbond-ui` 资源中心已经有团队级 Helm Release 列表与安装入口，前端通过 `/console/teams/{team}/regions/{region}/helm/releases` 安装与卸载 Release。
- `rainbond-console` 负责将资源中心请求转发到 region API。
- `rainbond` 已支持基于已配置 Helm Repo 安装 Release，但安装请求结构仍然只覆盖 `repo_name + chart + version + release_name + values`。
- 历史上还存在一套旧的 Helm 应用创建页面，支持商店、命令、上传包等入口，但其底层语义是“生成 Rainbond 应用模板并安装组件”，与本次目标不一致。

### 1.2 现有基础

现有可复用能力包括：

- 资源中心弹窗与 Helm Release 列表能力：`rainbond-ui/src/pages/ResourceCenter/index.js:453-567`
- 团队资源中心 Helm 安装 API：`rainbond-console/console/views/team_resources.py:50-58`
- region Helm Release 安装请求结构：`rainbond/api/controller/helm_release.go:26-49`
- 旧 Helm 页面中的上传 chart 包事件上传能力：`rainbond-ui/src/components/HelmCmdForm/index.js`
- enterprise appstore 代理接口：
  - 仓库列表：`/console/proxy/enterprise-server/api/v1/enterprises/{eid}/appstores`
  - chart 列表：`/console/proxy/enterprise-server/api/v1/enterprises/{eid}/appstores/{name}/apps`
  - chart 详情：`/console/proxy/enterprise-server/api/v1/enterprises/{eid}/appstores/{name}/templates/{chart}/versions/{version}`

### 1.3 核心需求

需要在资源中心现有“安装 Helm 应用”弹窗中统一支持以下三种创建方式：

1. 基于 Helm 商店
2. 基于第三方来源
   - 填写 chart 地址
   - 支持 Helm 官方或自建 Helm Repo 仓库
   - 支持 OCI 格式制品仓库
3. 上传 chart 包

同时修复当前 Helm 商店 chart 列表请求仍走旧地址 `/console/enterprise/{eid}/helm/{repo}/apps` 导致线上返回 `404 Not Found` 的问题。

本次需求的最终语义固定为：

- 所有三种入口都直接安装为 Helm Release
- 不再走旧的“创建应用模板 / 生成组件”链路

## 二、用户旅程（MUST — 禁止跳过）
### 2.1 用户操作流程

- 用户如何配置/触发该功能？
  - 用户进入团队资源中心的 Helm 标签页，点击主按钮“安装 Helm 应用”。
  - 弹窗内提供三种页签：`Helm 商店`、`第三方仓库/OCI`、`上传 Chart 包`。
- 用户如何查看状态/结果？
  - 安装成功后弹窗关闭，资源中心 Helm Release 列表刷新，用户可直接看到新 Release。
  - 若安装失败，则在当前弹窗保留错误提示，用户修正参数后重试。
- 管理员/审批人如何操作？
  - 无额外审批流，沿用当前团队资源中心权限模型。

### 2.2 页面原型

- 页面一：资源中心 Helm 标签页
  - 入口：`/team/:teamName/region/:regionName/resource-center?tab=helm`
  - 关键交互：点击“安装 Helm 应用”打开弹窗
- 页面二：资源中心 Helm 安装弹窗
  - 页签 1：Helm 商店
    - 左侧仓库列表
    - 右侧 chart 列表、搜索、分页
    - 安装表单：版本、release name、values
  - 页签 2：第三方仓库/OCI
    - 模式切换：Helm Repo / OCI
    - Helm Repo：repo URL、chart name、version、用户名、密码、release name、values
    - OCI：chart URL、用户名、密码、release name、values
  - 页签 3：上传 Chart 包
    - 上传 `.tgz`
    - 上传完成后展示解析出的 chart 名称、版本、默认 values
    - 安装表单：release name、version、values

### 2.3 外部系统交互

- Helm Repo 仓库：访问 `index.yaml`、下载 `.tgz`
- OCI 仓库：拉取 chart manifest/blob
- 对象存储/上传事件目录：上传 chart 包后由 region 读取事件目录中的文件

## 三、整体架构设计
### 3.1 系统架构图

```text
rainbond-ui ResourceCenter Modal
    ├─ Helm 商店
    ├─ 第三方仓库/OCI
    └─ 上传 Chart 包
            ↓ HTTP
rainbond-console /console/teams/{team}/regions/{region}/helm/releases
            ↓ HTTP
rainbond /v2/tenants/{tenant}/helm/releases
            ├─ store: 已配置 Helm Repo 安装
            ├─ repo: 临时 Helm Repo URL 安装
            ├─ oci: OCI chart 安装
            └─ upload: event_id 对应 chart 包安装
            ↓
Kubernetes Namespace Helm Release
```

### 3.2 核心流程

#### 3.2.1 Helm 商店

1. 前端加载仓库列表
2. 前端调用 appstore chart 列表接口加载某仓库的 charts
3. 用户选择 chart 和版本，填写 release name / values
4. 前端向资源中心 Helm Release 安装接口提交 `source_type=store`
5. console 转发到 region
6. region 按现有已配置 repo 安装 release

#### 3.2.2 第三方 Helm Repo / OCI

1. 用户切换到第三方页签
2. 选择模式：
   - Helm Repo
   - OCI
3. 输入来源地址、chart 信息、认证信息、release name、values
4. 前端提交到资源中心 Helm Release 安装接口
5. console 仅做参数透传和校验
6. region 根据 `source_type` 选择 Repo 或 OCI 安装逻辑

#### 3.2.3 上传 Chart 包

1. 用户切换到上传页签
2. 前端复用现有上传事件能力上传 `.tgz`
3. 上传成功后调用解析接口读取 chart 元信息与 values
4. 用户填写 release name / values
5. 前端提交 `source_type=upload + event_id`
6. region 根据事件目录中的 chart 包直接安装 release

## 四、数据模型设计
### 4.1 新增数据库表

本次不新增数据库表。

原因：

- Helm Release 状态仍然由 Helm / Kubernetes 维护
- 第三方 Repo、OCI、上传包安装所需参数仅在安装请求期间使用，不需要持久化到 console 数据库

### 4.2 数据关系

新增安装请求体字段，不新增持久化关系：

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
- `release_name`
- `values`
- `username`
- `password`
- `event_id`

## 五、API设计
### 5.1 接口列表

#### 5.1.1 继续复用

- `GET /console/teams/{team}/regions/{region}/helm/releases`
- `POST /console/teams/{team}/regions/{region}/helm/releases`
- `DELETE /console/teams/{team}/regions/{region}/helm/releases/{release_name}`
- `GET /console/proxy/enterprise-server/api/v1/enterprises/{eid}/appstores`
- `GET /console/proxy/enterprise-server/api/v1/enterprises/{eid}/appstores/{name}/apps`
- `GET /console/teams/{team}/get_upload_chart_information`
- `GET /console/teams/{team}/get_upload_chart_value`

#### 5.1.2 需要扩展

- `POST /console/teams/{team}/regions/{region}/helm/releases`
  - 扩展安装请求体，支持四种 `source_type`
- `POST /v2/tenants/{tenant}/helm/releases`
  - 扩展 region 侧安装请求体和分发逻辑

### 5.2 请求/响应结构

#### 5.2.1 安装请求

```json
{
  "source_type": "store | repo | oci | upload",
  "repo_name": "bitnami",
  "repo_url": "https://charts.bitnami.com/bitnami",
  "chart": "nginx",
  "chart_name": "nginx",
  "chart_url": "oci://registry-1.docker.io/bitnamicharts/nginx",
  "version": "15.9.0",
  "release_name": "nginx-demo",
  "values": "service:\\n  type: ClusterIP",
  "username": "optional",
  "password": "optional",
  "event_id": "upload-event-id"
}
```

#### 5.2.2 source_type 约束

- `store`
  - 必填：`repo_name`, `chart`, `version`, `release_name`
- `repo`
  - 必填：`repo_url`, `chart_name`, `version`, `release_name`
- `oci`
  - 必填：`chart_url`, `release_name`
- `upload`
  - 必填：`event_id`, `release_name`

#### 5.2.3 安装响应

沿用当前 Helm Release 安装成功返回结构，返回 release 基本信息即可。

## 六、核心实现设计
### 6.1 关键逻辑

#### 6.1.1 前端弹窗统一建模

资源中心中当前的 Helm 商店弹窗状态将从单一路径调整为统一来源模型：

- 当前弹窗状态
  - `helmStep`
  - `helmCurrentRepo`
  - `helmSelectedChart`
  - `helmForm`
- 目标弹窗状态
  - `helmSourceType`
  - `helmStoreState`
  - `helmExternalState`
  - `helmUploadState`

这样每个页签维护自己的字段与校验，提交时再统一映射为安装请求。

#### 6.1.2 404 修复

`rainbond-ui/src/services/market.js:84-90` 仍调用旧接口：

- 旧：`/console/enterprise/{eid}/helm/{repo}/apps`

需要替换为现有后端可用接口：

- 新：`/console/proxy/enterprise-server/api/v1/enterprises/{eid}/appstores/{repo}/apps`

这是本次线上 `404 Not Found` 的直接原因。

#### 6.1.3 第三方 Repo 安装

region 侧新增“无需预先持久化仓库”的临时 Repo 安装能力：

1. 根据 `repo_url`、用户名、密码创建临时 Chart 下载配置
2. 直接解析 index 或使用 Helm downloader 定位 chart
3. 下载 chart 到临时目录
4. 安装到租户 namespace

不将该仓库写入持久 HelmRepoInfo，避免把一次性外部来源污染为平台长期仓库。

#### 6.1.4 OCI 安装

region 侧新增 OCI 安装能力：

1. 支持 `oci://` chart URL
2. 处理用户名/密码认证
3. 下载 chart 到本地临时文件
4. 复用已有 Helm 安装逻辑从本地 chart path 安装

说明：

- console 现有 `AppstoreChart` 已具备部分 OCI 下载解析逻辑，但它仅用于读取 values/README，不用于安装 Release
- 本次需要将 OCI 安装能力真正补到 `rainbond` 的 Helm Release 安装链路

#### 6.1.5 上传包安装

region 侧复用已有上传 chart 目录处理逻辑：

1. 根据 `event_id` 找到 `/grdata/package_build/temp/events/{event_id}`
2. 如有 `.tgz` 则解压
3. 读取 chart 元信息与默认 values
4. 从解压目录直接安装 Helm Release

上传完成后的“解析信息”和“安装 release”都走资源中心统一弹窗，不再跳转旧 `Group/Helm` 页面。

### 6.2 复用现有代码

复用但不直接复用整条旧业务流程：

- 复用
  - 资源中心 Helm Release 列表与安装入口
  - enterprise appstore 代理接口
  - 上传 chart 包事件上传能力
  - region 侧上传 chart 解析能力
- 不复用
  - `Group/Helm` 的“生成模板 / 创建应用 / 安装组件”流程
  - `helm_center_app` / `helm_app` 相关旧模板生成接口

## 七、实施计划
### 跨层覆盖检查（MUST）

- [x] Go (rainbond): 需要 — 扩展 Helm Release 安装请求结构，新增 repo / oci / upload 三种直装能力
- [x] Python (console): 需要 — 扩展资源中心 Helm Release 安装接口透传与校验，复用上传 chart 信息接口
- [x] React (rainbond-ui): 需要 — 资源中心 Helm 安装弹窗改为三页签，修复 chart 列表 404，新增第三方与上传安装流程
- [x] Plugin: 不涉及 — 本次不涉及插件前后端

### Sprint 1: 直装能力补齐

#### Task 1.1: 扩展 region Helm Release 安装请求
- 仓库：rainbond
- 文件：
  - `rainbond/api/controller/helm_release.go:26-49`
  - `rainbond/api/handler/helm_release.go`
- 实现内容：
  - 扩展安装请求结构
  - 增加 `source_type` 分发
  - 保留现有 store 安装兼容
- 验收标准：
  - 四种 source_type 都能进入正确安装分支

#### Task 1.2: 新增临时 Repo / OCI / Upload 安装实现
- 仓库：rainbond
- 文件：
  - `rainbond/pkg/helm/helm.go`
  - `rainbond/api/handler/helm.go`
  - `rainbond/api/handler/helm_release.go`
- 实现内容：
  - 增加 repo_url 直装
  - 增加 oci chart 直装
  - 增加 event_id 上传包直装
- 验收标准：
  - 不需要先持久化仓库，也能成功安装 Release

### Sprint 2: console 资源中心接口扩展

#### Task 2.1: 扩展 console Helm Release 安装透传
- 仓库：rainbond-console
- 文件：
  - `rainbond-console/console/views/team_resources.py:50-58`
  - `rainbond-console/www/apiclient/regionapi.py:3690-3704`
- 实现内容：
  - 透传新增字段
  - 对 source_type 做基础校验
- 验收标准：
  - console 可正确转发四种安装请求

#### Task 2.2: 保持 appstore 与上传解析接口兼容
- 仓库：rainbond-console
- 文件：
  - `rainbond-console/console/views/adaptor.py`
  - `rainbond-console/console/views/helm_app.py`
- 实现内容：
  - 继续提供 appstore 列表、chart 列表、chart 详情
  - 上传包解析接口可供资源中心新弹窗直接复用
- 验收标准：
  - 前端三页签所需数据均有可用接口

### Sprint 3: 资源中心弹窗改造

#### Task 3.1: 修复 Helm 商店 404 并重构三页签弹窗
- 仓库：rainbond-ui
- 文件：
  - `rainbond-ui/src/services/market.js:75-90`
  - `rainbond-ui/src/pages/ResourceCenter/index.js:453-567`
  - `rainbond-ui/src/pages/ResourceCenter/index.less`
- 实现内容：
  - 修复 chart 列表接口
  - 将单一路径弹窗调整为三页签统一弹窗
- 验收标准：
  - 商店安装恢复可用
  - 弹窗可切换三种方式

#### Task 3.2: 接入第三方与上传包安装
- 仓库：rainbond-ui
- 文件：
  - `rainbond-ui/src/services/teamResource.js`
  - `rainbond-ui/src/models/teamResources.js`
  - `rainbond-ui/src/pages/ResourceCenter/index.js`
- 实现内容：
  - 扩展 installRelease 请求体
  - 接入上传 chart 包和解析接口
  - 增加第三方 Repo / OCI 提交表单
- 验收标准：
  - 三种方式都能在资源中心内闭环完成安装

## 八、关键参考代码

| 功能 | 文件 | 说明 |
|------|------|------|
| 资源中心 Helm 弹窗 | `rainbond-ui/src/pages/ResourceCenter/index.js` | 当前 Helm Release 安装入口与弹窗状态 |
| Helm 商店接口 | `rainbond-ui/src/services/market.js` | 当前 chart 列表接口仍指向已失效旧地址 |
| 资源中心 Release 安装转发 | `rainbond-console/console/views/team_resources.py` | 当前 console 仅简单透传安装请求 |
| region Release 安装入口 | `rainbond/api/controller/helm_release.go` | 当前仅支持 repo_name 安装 |
| 上传 chart 解析 | `rainbond/api/handler/helm.go` | 已有上传 chart 元信息、values、资源解析能力 |
| appstore chart 列表代理 | `rainbond-console/console/views/adaptor.py` | 现有可用的 appstore charts 查询代理 |
