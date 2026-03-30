# 应用版本快照发布改造设计文档

## 一、项目背景
### 1.1 项目架构
应用版本时间线页面位于 `rainbond-ui`，发布时间线记录与发布流程接口位于 `rainbond-console`。当前版本时间线点击发布后，会先创建 `service_share_record`，再进入 `/share/:shareId/one` 的发布第一页，最后进入 `/share/:shareId/two` 的镜像推送页。

### 1.2 现有基础
- 版本时间线创建发布记录时，已经会传递 `snapshot_app_id` 与 `snapshot_version`
- `GET /console/teams/{team_name}/share/{share_id}/info` 已经能在快照场景下返回快照版本中的 `apps/plugins/k8s_resources`
- 前端已将快照创建与发布入口拆成 `AppSnapshotSetting` 与 `AppPublishSetting` 两个组件，但底层骨架仍大量复用

### 1.3 核心需求
- 发布某个版本时间线时，发布内容必须直接来源于该快照版本的模板数据
- 不能再根据“当前应用下组件信息”重新采集和组装发布内容
- 发布第一页保留“版本与模版”区块
- 发布第一页保留“平台插件”按钮与相关配置内容
- 发布第一页移除“编辑发布组件信息”
- 发布第一页移除“资源确认”
- 快照创建页与发布页不再共用同一个页面骨架
- 第二页镜像推送页与相关接口保留

## 二、用户旅程
### 2.1 用户操作流程
- 用户进入应用版本时间线页面
- 用户在某一个快照版本上点击“发布”
- 系统创建发布记录，并带上该快照版本的源信息
- 用户进入新的发布第一页
- 页面只展示：
  - 版本与模版
  - 平台插件配置
  - 当前快照包含的组件摘要（只读）
- 用户确认发布元信息后提交
- 系统直接以快照版本对应的模板内容创建目标发布版本
- 页面进入第二页镜像推送流程
- 推送完成后返回版本时间线

### 2.2 页面原型
- 页面一：应用版本时间线
  - 入口：`/apps/:appID/version`
  - 关键交互：在某个快照版本点击“发布”
- 页面二：发布第一页
  - 入口：`/apps/:appID/share/:shareId/one`
  - 保留区块：版本与模版、平台插件
  - 只读展示：快照组件摘要
  - 移除区块：编辑发布组件信息、资源确认
- 页面三：发布第二页
  - 入口：`/apps/:appID/share/:shareId/two`
  - 关键交互：推送镜像、查看日志、完成发布

### 2.3 外部系统交互
- 前端通过 `rainbond-console` 发起发布记录创建和发布提交流程
- `rainbond-console` 继续通过 region API 触发镜像/介质推送
- 云应用商店发布流程继续沿用现有逻辑

## 三、整体架构设计
### 3.1 系统架构图
```text
版本时间线发布动作
  -> 创建发布记录（绑定快照 app_id/version）
  -> 打开发布第一页（只采集发布元信息）
  -> 提交发布信息
  -> console 从快照版本 app_template 复制 apps/plugins/k8s_resources
  -> 生成目标 RainbondCenterAppVersion
  -> 创建事件
  -> 打开镜像推送页
```

### 3.2 核心流程
1. 时间线页创建发布记录时，继续保存快照来源
2. 发布第一页获取记录详情时，后端返回快照模板内容和快照发布标识
3. 发布第一页只允许编辑目标模板/版本/平台插件元信息
4. 提交时前端不再上送当前页面编辑后的组件数据
5. 后端从快照版本中读取源模板，直接复制：
   - `apps`
   - `plugins`
   - `k8s_resources`
6. 后端只对目标模板元信息、平台插件补充字段、推送所需镜像字段和事件进行处理
7. 第二页继续按现有事件模型执行推送

## 四、数据模型设计
### 4.1 新增数据库表
本次不新增数据库表。

### 4.2 数据关系
- `service_share_record.app_id/share_version`
  - 在快照发布场景下表示源快照模板 ID 与快照版本号
- `rainbond_center_app_version`
  - 继续保存最终发布出的目标模板版本
- 目标模板仍由第一页“版本与模版”区块决定
- 源模板内容以快照版本的 `app_template` 为准

## 五、API设计
### 5.1 接口列表
- 保留：`POST /console/teams/{team_name}/groups/{group_id}/share/record`
  - 继续用于创建发布记录，仍需接收 `snapshot_app_id`、`snapshot_version`
- 改造：`GET /console/teams/{team_name}/share/{share_id}/info`
  - 快照发布场景返回快照模板内容与发布模式标识
- 改造：`POST /console/teams/{team_name}/share/{share_id}/info`
  - 快照发布场景直接基于快照模板创建发布版本，不再根据当前组件组装内容
- 保留：`GET/POST /console/teams/{team_name}/share/{share_id}/events`
  - 第二页镜像推送继续使用

### 5.2 请求/响应结构
- `GET share/:id/info` 新增语义：
  - `bean.publish_mode = "snapshot"`
  - `bean.share_service_list` 为快照模板中的组件列表，仅供展示
- `POST share/:id/info`
  - 请求只保留：
    - `app_version_info`
    - `share_plugin_list`（仅平台插件相关场景需要）
  - 服务端忽略当前页面提交的组件编辑结果
  - 服务端以快照模板中的 `apps/plugins/k8s_resources` 作为发布源

## 六、核心实现设计
### 6.1 关键逻辑
- `AppPublishSetting`
  - 保留模板选择、版本号、版本说明、平台插件配置
  - 移除组件编辑、组件删除、批量编辑、资源确认
  - 新增快照组件只读摘要区域
- `AppShareBase`
  - 不再作为快照页与发布页共用的“三段式页面骨架”
  - 发布页改为独立结构，只承载发布所需内容
- `ServiceShareInfoView.get`
  - 快照场景下返回快照模板内容与 `publish_mode`
- `ShareService.create_share_info`
  - 快照场景识别当前记录对应快照版本
  - 读取源快照 `app_template`
  - 复制 `apps/plugins/k8s_resources`
  - 只使用前端提交的目标模板、版本、版本说明、平台插件配置
  - 继续补齐镜像推送所需字段与事件

### 6.2 复用现有代码
- 复用时间线页创建发布记录逻辑
- 复用镜像推送第二页与事件模型
- 复用云市发布完成逻辑
- 复用快照模板读取逻辑
- 仅移除第一页中面向“当前组件编辑”的那部分逻辑

## 七、实施计划
### 跨层覆盖检查
- [ ] Go (rainbond): 不涉及
- [ ] Python (console): 需要 — 改造快照发布读取与提交逻辑
- [ ] React (rainbond-ui): 需要 — 发布页收敛为模板与平台插件页面
- [ ] Plugin: 不涉及

### Sprint 1: console 快照发布链路改造
#### Task 1.1: 为快照发布提交补充测试
- 仓库：rainbond-console
- 文件：`console/tests/service_share_test.py`
- 实现内容：
  - 验证快照发布读取第一页信息时返回快照模式标识
  - 验证快照发布提交时使用快照模板，而不是当前组件输入
- 验收标准：
  - 新增测试先失败，改造后通过

#### Task 1.2: 改造 share info 接口与服务
- 仓库：rainbond-console
- 文件：`console/views/service_share.py`
- 文件：`console/services/share_services.py`
- 实现内容：
  - `GET /share/:id/info` 返回快照模式元信息
  - `POST /share/:id/info` 直接从快照模板复制发布内容
- 验收标准：
  - 发布内容中的 `apps/plugins/k8s_resources` 与快照模板一致
  - 不再依赖当前应用组件输入

### Sprint 2: UI 发布第一页拆分与收敛
#### Task 2.1: 将发布页从共享骨架中拆出来
- 仓库：rainbond-ui
- 文件：`src/pages/Group/AppShare.js`
- 文件：`src/pages/Group/components/AppPublishSetting.js`
- 文件：`src/pages/Group/components/AppShareBase.js`
- 实现内容：
  - 快照创建页与发布页不再共用同一页面骨架
  - 发布页只保留发布所需区块
- 验收标准：
  - 快照页与发布页显示结构明显分离

#### Task 2.2: 移除组件编辑与资源确认，保留模板与平台插件
- 仓库：rainbond-ui
- 文件：`src/pages/Group/components/AppPublishSetting.js`
- 文件：`src/pages/Group/components/appShareHelpers.js`
- 实现内容：
  - 删除组件编辑表单和资源确认区块
  - 保留“创建模版”按钮
  - 保留“平台插件”按钮与全部配置项
  - 增加快照组件只读展示
- 验收标准：
  - 第一页不再出现组件编辑和资源确认
  - 仍可完成模板选择和平台插件配置

## 八、关键参考代码
| 功能 | 文件 | 说明 |
|------|------|------|
| 时间线创建发布记录 | `rainbond-ui/src/pages/AppVersion/index.js` | 已传 `snapshot_app_id/snapshot_version` |
| 发布页路由分发 | `rainbond-ui/src/pages/Group/AppShare.js` | 当前用 query 区分快照与发布 |
| 快照创建页 | `rainbond-ui/src/pages/Group/components/AppSnapshotSetting.js` | 已单独存在，但仍复用基础骨架 |
| 发布第一页 | `rainbond-ui/src/pages/Group/components/AppPublishSetting.js` | 当前仍包含组件编辑逻辑 |
| 发布页共用骨架 | `rainbond-ui/src/pages/Group/components/AppShareBase.js` | 当前三段式布局来源 |
| 快照 share info 分支 | `rainbond-console/console/views/service_share.py` | 已能返回快照模板内容 |
| 发布核心服务 | `rainbond-console/console/services/share_services.py` | 需改为快照驱动发布 |
