import React, { PureComponent } from 'react';
import { connect } from 'dva';
import { routerRedux } from 'dva/router';
import {
  Table,
  Button,
  Modal,
  Input,
  Tag,
  Popconfirm,
  Form,
  Card,
  Icon,
  Select,
  Divider,
  List,
  Spin,
  Empty,
  Upload,
  notification,
} from 'antd';
import jsYaml from 'js-yaml';
import styles from './index.less';
import {
  WORKLOAD_KIND_OPTIONS,
  getResourceStatusMeta,
  getWorkloadKindLabel,
} from './utils';

const { TextArea } = Input;
const { Option } = Select;
const DEFAULT_TAB = 'helm';

// 每个 Tab 对应的 K8s 资源类型
const TAB_RESOURCE_MAP = {
  workload: { group: 'apps', version: 'v1', resource: 'deployments' },
  pod: { group: '', version: 'v1', resource: 'pods' },
  network: { group: '', version: 'v1', resource: 'services' },
  config: { group: '', version: 'v1', resource: 'configmaps' },
  storage: { group: '', version: 'v1', resource: 'persistentvolumeclaims' },
};

const TAB_META = {
  helm: {
    title: 'Helm 应用',
    icon: 'rocket',
    navDescription: '管理团队已安装的 Release 与分发入口',
    description: '统一查看当前团队的 Helm Release，并直接从仓库安装应用。',
    listTitle: 'Release 清单',
    listDescription: '查看安装状态、Chart 版本、命名空间与生命周期操作。',
    emptyTitle: '还没有 Helm Release',
    emptyDescription: '从 Helm 仓库选择 Chart 安装到当前团队命名空间，后续可以在这里统一查看与卸载。',
    emptyHint: '建议先确认 Helm 仓库已配置，再选择 Chart、版本和 Values 安装。',
    tips: ['从 Helm 仓库安装', '按 Release 维度管理', '适合团队级应用分发'],
  },
  workload: {
    title: '工作负载',
    icon: 'deployment-unit',
    navDescription: 'Deployment、StatefulSet 与定时任务总览',
    description: '聚焦当前团队下的核心工作负载，快速识别副本、状态与托管来源。',
    listTitle: '工作负载清单',
    listDescription: '支持按类型筛选、查看 YAML，并继续下钻到工作负载详情。',
    emptyTitle: '还没有工作负载',
    emptyDescription: '你可以通过 YAML 创建 Deployment、StatefulSet、DaemonSet 或 CronJob，并在这里持续观察运行状态。',
    emptyHint: '适合先从无状态组件开始，再按需切换到有状态组件或定时任务。',
    tips: ['按类型切换工作负载', '副本健康度直观展示', '支持从列表下钻到详情'],
  },
  pod: {
    title: '容器组',
    icon: 'appstore',
    navDescription: '实例级状态观察与排障入口',
    description: '适合从实例维度观察运行状态、重启次数与所属工作负载。',
    listTitle: '容器组清单',
    listDescription: '重点用于排障和联动查看，支持跳转容器组详情与 YAML。',
    emptyTitle: '还没有容器组',
    emptyDescription: '当工作负载启动后，这里会展示实例级容器组信息，便于查看节点、IP 和重启情况。',
    emptyHint: '如果这里为空，可以先检查工作负载是否创建完成或副本是否正常拉起。',
    tips: ['实例级运行视角', '重启次数一眼可见', '适合联动日志与终端排障'],
  },
  network: {
    title: '网络',
    icon: 'share-alt',
    navDescription: 'Service 类型、端口与选择器管理',
    description: '管理团队命名空间下的网络暴露方式，快速识别端口与流量入口。',
    listTitle: '网络资源清单',
    listDescription: '查看 Service 类型、端口暴露、Selector 绑定关系，并支持直接查看 YAML。',
    emptyTitle: '还没有网络资源',
    emptyDescription: '通过 YAML 新建 Service 后，可以在这里集中查看 ClusterIP、端口和选择器信息。',
    emptyHint: '如果要暴露服务，建议先创建工作负载，再补充对应的 Service 定义。',
    tips: ['端口与协议统一查看', '快速识别外部暴露类型', '适合核对流量入口配置'],
  },
  config: {
    title: '配置',
    icon: 'setting',
    navDescription: 'ConfigMap 与 Secret 统一查看',
    description: '集中管理应用配置和敏感配置对象，减少在多处 YAML 间切换。',
    listTitle: '配置资源清单',
    listDescription: '适合统一梳理配置对象、数据条目数和资源来源。',
    emptyTitle: '还没有配置资源',
    emptyDescription: '你可以通过 YAML 创建 ConfigMap 或 Secret，并在这里查看对象类型和条目数。',
    emptyHint: '涉及敏感信息时请优先通过安全的 Secret 管理方式创建，而不是直接暴露在普通配置里。',
    tips: ['ConfigMap / Secret 合并视角', '条目数量更易扫描', '支持从 YAML 继续维护'],
  },
  storage: {
    title: '存储',
    icon: 'database',
    navDescription: 'PVC 生命周期与容量配置查看',
    description: '聚焦存储声明状态、容量与存储类，帮助你快速判断绑定情况。',
    listTitle: '存储声明清单',
    listDescription: '适合查看 PVC 绑定状态、容量申请、访问模式和存储类信息。',
    emptyTitle: '还没有存储声明',
    emptyDescription: '通过 YAML 创建 PersistentVolumeClaim 后，这里会统一展示容量、访问模式与绑定状态。',
    emptyHint: '如果需要持久化数据，建议先确认目标存储类可用，再创建对应的 PVC。',
    tips: ['PVC 生命周期可视化', '容量与访问模式并排查看', '便于核对存储类配置'],
  },
};

const TAB_GROUPS = [
  { title: '应用与运行', items: ['helm', 'workload', 'pod'] },
  { title: '基础资源', items: ['network', 'config', 'storage'] },
];

const STATUS_DOT = ({ status }) => {
  const { color, text } = getResourceStatusMeta(status);
  return (
    <span>
      <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: color, marginRight: 6 }} />
      <span style={{ color }}>{text}</span>
    </span>
  );
};

@connect(({ teamResources, enterprise }) => ({
  resources: teamResources.resources,
  helmReleases: teamResources.helmReleases,
  total: teamResources.total,
  currentEnterprise: enterprise.currentEnterprise,
}))
class ResourceCenter extends PureComponent {
  state = {
    activeTab: DEFAULT_TAB,
    workloadKind: 'deployments',
    workloadKindGroup: 'apps',
    yamlModalVisible: false,
    yamlModalMode: 'create',
    yamlContent: '',
    yamlTargetName: '',
    yamlTargetParams: null,
    searchText: '',
    // Helm 应用商店弹窗状态
    helmModalVisible: false,
    helmStep: 'browse',         // 'browse' | 'install'
    helmRepos: [],
    helmRepoLoading: false,
    helmCurrentRepo: '',
    helmAllCharts: [],           // 当前仓库完整 chart 列表（客户端过滤用）
    helmCharts: [],              // 过滤+分页后展示的 chart 列表
    helmChartLoading: false,
    helmChartSearch: '',
    helmChartPage: 1,
    helmChartPageSize: 9,
    helmChartTotal: 0,
    helmSelectedChart: null,     // 用户点选的 chart
    helmForm: { version: '', release_name: '', values: '' },
  };

  componentDidMount() {
    this.fetchTabData(DEFAULT_TAB);
  }

  getParams() {
    const { match } = this.props;
    return (match && match.params) || {};
  }

  fetchTabData = (tab, extra = {}) => {
    const { dispatch } = this.props;
    const { workloadKind, workloadKindGroup } = this.state;
    const { teamName, regionName } = this.getParams();
    if (tab === 'helm') {
      dispatch({ type: 'teamResources/fetchHelmReleases', payload: { team: teamName, region: regionName } });
      return;
    }
    const resourceParams = tab === 'workload'
      ? { group: extra.group || workloadKindGroup || 'apps', version: 'v1', resource: extra.resource || workloadKind || 'deployments' }
      : TAB_RESOURCE_MAP[tab] || TAB_RESOURCE_MAP.workload;
    dispatch({
      type: 'teamResources/fetchResources',
      payload: { team: teamName, region: regionName, ...resourceParams },
    });
  };

  handleTabChange = (key) => {
    this.setState({ activeTab: key, searchText: '' });
    this.fetchTabData(key);
  };

  handleWorkloadKindChange = (value) => {
    const found = WORKLOAD_KIND_OPTIONS.find(k => k.value === value);
    const group = found ? found.group : 'apps';
    this.setState({ workloadKind: value, workloadKindGroup: group });
    this.fetchTabData('workload', { resource: value, group });
  };

  getCurrentResourceParams = (tab = this.state.activeTab) => {
    const { workloadKind, workloadKindGroup } = this.state;
    return tab === 'workload'
      ? { group: workloadKindGroup, version: 'v1', resource: workloadKind }
      : TAB_RESOURCE_MAP[tab] || TAB_RESOURCE_MAP.workload;
  };

  getTabMeta = (tab = this.state.activeTab) => TAB_META[tab] || TAB_META[DEFAULT_TAB];

  getActiveData = (tab = this.state.activeTab) => {
    const { resources, helmReleases } = this.props;
    return tab === 'helm' ? (helmReleases || []) : (resources || []);
  };

  getStatusSummary = (list = []) => {
    return list.reduce((summary, item) => {
      const tone = getResourceStatusMeta(item.status).tone;
      summary.total += 1;
      if (tone === 'running') {
        summary.running += 1;
      } else if (tone === 'warning') {
        summary.warning += 1;
      } else if (tone === 'error') {
        summary.error += 1;
      } else {
        summary.default += 1;
      }
      return summary;
    }, {
      total: 0,
      running: 0,
      warning: 0,
      error: 0,
      default: 0,
    });
  };

  getDistinctCount = (list = [], getter) => {
    return new Set(
      (list || [])
        .map(item => getter(item))
        .filter(Boolean)
    ).size;
  };

  getMetricCards = () => {
    const { activeTab } = this.state;
    const list = this.getActiveData();
    const summary = this.getStatusSummary(list);

    if (activeTab === 'helm') {
      return [
        { label: 'Release 总数', value: list.length, helper: '当前团队下已安装的 Helm Release', tone: 'default' },
        { label: '运行稳定', value: summary.running, helper: '状态为已部署或可用的 Release', tone: 'running' },
        { label: '进行中', value: summary.warning, helper: '安装、升级或卸载中的 Release', tone: 'warning' },
        { label: '异常待处理', value: summary.error, helper: '需要进一步检查的 Release', tone: 'error' },
      ];
    }

    if (activeTab === 'workload') {
      const helmManagedCount = list.filter(item => item.source === 'helm').length;
      const notReadyCount = list.filter(item => (
        item.replicas !== undefined &&
        item.ready_replicas !== undefined &&
        Number(item.ready_replicas) < Number(item.replicas)
      )).length;
      return [
        { label: '工作负载数', value: list.length, helper: 'Deployment、StatefulSet、DaemonSet 与 CronJob', tone: 'default' },
        { label: '状态稳定', value: summary.running, helper: '处于运行中、已就绪或可用状态', tone: 'running' },
        { label: 'Helm 托管', value: helmManagedCount, helper: '由 Helm Release 管理的工作负载', tone: 'default' },
        { label: '副本待补齐', value: notReadyCount, helper: 'Ready 副本低于目标副本数', tone: 'warning' },
      ];
    }

    if (activeTab === 'pod') {
      const restartedCount = list.filter(item => Number(item.restart_count) > 0).length;
      return [
        { label: '容器组数', value: list.length, helper: '当前视图中的实例级资源总量', tone: 'default' },
        { label: '运行中', value: summary.running, helper: '状态稳定、可继续下钻排查', tone: 'running' },
        { label: '发生重启', value: restartedCount, helper: '重启次数大于 0 的容器组', tone: restartedCount > 0 ? 'warning' : 'default' },
        { label: '异常实例', value: summary.error, helper: '需要重点查看日志或事件', tone: 'error' },
      ];
    }

    if (activeTab === 'network') {
      const portCount = list.reduce((total, item) => total + ((item.ports || []).length || 0), 0);
      const exposedCount = list.filter(item => item.type && item.type !== 'ClusterIP').length;
      const selectorlessCount = list.filter(item => !item.selector || Object.keys(item.selector).length === 0).length;
      return [
        { label: '网络对象数', value: list.length, helper: '当前团队下的 Service 资源', tone: 'default' },
        { label: '暴露端口', value: portCount, helper: '已声明的端口与协议总数', tone: 'running' },
        { label: '外部暴露', value: exposedCount, helper: '非 ClusterIP 类型的 Service', tone: exposedCount > 0 ? 'warning' : 'default' },
        { label: '无选择器', value: selectorlessCount, helper: '需要人工确认流量绑定对象', tone: selectorlessCount > 0 ? 'warning' : 'default' },
      ];
    }

    if (activeTab === 'config') {
      const secretCount = list.filter(item => ((item.kind || '').toLowerCase() === 'secret')).length;
      const configMapCount = list.filter(item => !item.kind || ((item.kind || '').toLowerCase() === 'configmap')).length;
      const readOnlyCount = list.filter(item => item.source === 'external').length;
      return [
        { label: '配置对象数', value: list.length, helper: 'ConfigMap 与 Secret 的统一清单', tone: 'default' },
        { label: 'ConfigMap', value: configMapCount, helper: '适合管理普通配置项', tone: 'running' },
        { label: 'Secret', value: secretCount, helper: '适合敏感配置与凭据引用', tone: secretCount > 0 ? 'warning' : 'default' },
        { label: '只读对象', value: readOnlyCount, helper: '来自外部或只允许查看的配置', tone: 'default' },
      ];
    }

    if (activeTab === 'storage') {
      const boundCount = list.filter(item => getResourceStatusMeta(item.status).tone === 'running').length;
      const warningCount = summary.warning;
      const storageClassCount = this.getDistinctCount(list, item => item.storage_class);
      return [
        { label: 'PVC 数量', value: list.length, helper: '当前团队下的存储声明总数', tone: 'default' },
        { label: '绑定完成', value: boundCount, helper: '已经成功绑定卷的 PVC', tone: 'running' },
        { label: '待处理', value: warningCount, helper: '等待绑定或需要关注的 PVC', tone: warningCount > 0 ? 'warning' : 'default' },
        { label: '存储类', value: storageClassCount, helper: '当前视图涉及的存储类数量', tone: 'default' },
      ];
    }

    return [];
  };

  openCreateYamlModal = () => {
    this.setState({
      yamlModalVisible: true,
      yamlModalMode: 'create',
      yamlContent: '',
      yamlTargetName: '',
      yamlTargetParams: this.getCurrentResourceParams(),
    });
  };

  openCreateChooser = () => {
    this.openCreateYamlModal();
  };

  handleYamlCreate = () => {
    const { dispatch } = this.props;
    const { teamName, regionName } = this.getParams();
    const { yamlContent, activeTab, yamlModalMode, yamlTargetName, yamlTargetParams } = this.state;
    const resourceParams = yamlTargetParams || this.getCurrentResourceParams();
    const action = yamlModalMode === 'edit' ? 'teamResources/updateResource' : 'teamResources/createResource';
    const payload = yamlModalMode === 'edit'
      ? { team: teamName, region: regionName, name: yamlTargetName, yaml: yamlContent, ...resourceParams }
      : { team: teamName, region: regionName, source: 'yaml', yaml: yamlContent, ...resourceParams };
    dispatch({
      type: action,
      payload,
      callback: () => {
        notification.success({ message: yamlModalMode === 'edit' ? 'YAML 保存成功' : '资源创建成功' });
        this.setState({ yamlModalVisible: false, yamlContent: '', yamlModalMode: 'create', yamlTargetName: '', yamlTargetParams: null });
        this.fetchTabData(activeTab);
      },
    });
  };

  handleYamlUpload = (file) => {
    const reader = new FileReader();
    reader.onload = event => {
      const content = event.target.result || '';
      try {
        jsYaml.loadAll(content);
      } catch (e) {
        notification.error({ message: 'YAML 文件格式无效', description: e.message });
        return;
      }
      this.setState({
        yamlModalVisible: true,
        yamlModalMode: 'create',
        yamlContent: content,
        yamlTargetName: '',
        yamlTargetParams: this.getCurrentResourceParams(),
      });
    };
    reader.readAsText(file);
    return false;
  };

  handleOpenResourceYaml = (record, resourceParams) => {
    const { dispatch } = this.props;
    const { teamName, regionName } = this.getParams();
    dispatch({
      type: 'teamResources/fetchResource',
      payload: {
        team: teamName,
        region: regionName,
        name: record.name,
        ...(resourceParams || this.getCurrentResourceParams()),
      },
      callback: bean => {
        this.setState({
          yamlModalVisible: true,
          yamlModalMode: 'edit',
          yamlTargetName: record.name,
          yamlTargetParams: resourceParams || this.getCurrentResourceParams(),
          yamlContent: jsYaml.dump(bean, { noRefs: true, lineWidth: 120 }),
        });
      },
    });
  };

  jumpToWorkloadDetail = (record) => {
    const { dispatch } = this.props;
    const { teamName, regionName } = this.getParams();
    const resourceParams = this.getCurrentResourceParams('workload');
    dispatch(routerRedux.push({
      pathname: `/team/${teamName}/region/${regionName}/resource-center/workloads/${resourceParams.resource}/${record.name}`,
      query: { group: resourceParams.group, version: resourceParams.version },
    }));
  };

  jumpToPodDetail = (record) => {
    const { dispatch } = this.props;
    const { teamName, regionName } = this.getParams();
    dispatch(routerRedux.push({
      pathname: `/team/${teamName}/region/${regionName}/resource-center/pods/${record.name}`,
    }));
  };

  // ─── Helm 应用商店 ────────────────────────────────────────────────────────

  openHelmInstallModal = () => {
    this.setState({
      helmModalVisible: true,
      helmStep: 'browse',
      helmCurrentRepo: '',
      helmAllCharts: [],
      helmCharts: [],
      helmChartSearch: '',
      helmChartPage: 1,
      helmChartTotal: 0,
      helmSelectedChart: null,
      helmForm: { version: '', release_name: '', values: '' },
    });
    this.fetchHelmRepos();
  };

  fetchHelmRepos = () => {
    const { dispatch } = this.props;
    const { teamName } = this.getParams();
    this.setState({ helmRepoLoading: true });
    dispatch({
      type: 'market/HelmwaRehouseList',
      payload: { team_name: teamName },
      callback: res => {
        const list = (res && (res.list || res)) || [];
        const repos = Array.isArray(list) ? list : [];
        this.setState({ helmRepos: repos, helmRepoLoading: false }, () => {
          if (repos.length > 0) {
            this.handleHelmRepoSelect(repos[0].name || repos[0].repo_name || repos[0]);
          }
        });
      },
      handleError: () => this.setState({ helmRepoLoading: false }),
    });
  };

  handleHelmRepoSelect = (repoName) => {
    const { dispatch, currentEnterprise } = this.props;
    const eid = currentEnterprise && currentEnterprise.enterprise_id;
    this.setState({
      helmCurrentRepo: repoName,
      helmChartLoading: true,
      helmChartSearch: '',
      helmChartPage: 1,
      helmAllCharts: [],
      helmCharts: [],
    });
    dispatch({
      type: 'market/fetchHelmMarkets',
      payload: { enterprise_id: eid, repo_name: repoName },
      callback: res => {
        const all = Array.isArray(res) ? res : [];
        this.setState({
          helmAllCharts: all,
          helmChartLoading: false,
        }, () => this.applyHelmChartFilter());
      },
      handleError: () => this.setState({ helmChartLoading: false }),
    });
  };

  applyHelmChartFilter = () => {
    const { helmAllCharts, helmChartSearch, helmChartPage, helmChartPageSize } = this.state;
    const q = (helmChartSearch || '').toLowerCase();
    const filtered = q
      ? helmAllCharts.filter(c => (c.name || '').toLowerCase().includes(q))
      : helmAllCharts;
    const total = filtered.length;
    const start = (helmChartPage - 1) * helmChartPageSize;
    const charts = filtered.slice(start, start + helmChartPageSize);
    this.setState({ helmCharts: charts, helmChartTotal: total });
  };

  handleHelmChartSearch = (v) => {
    this.setState({ helmChartSearch: v, helmChartPage: 1 }, () => this.applyHelmChartFilter());
  };

  handleHelmChartPageChange = (page) => {
    this.setState({ helmChartPage: page }, () => this.applyHelmChartFilter());
  };

  handleHelmChartSelect = (chart) => {
    const versions = chart.versions || [];
    this.setState({
      helmSelectedChart: chart,
      helmStep: 'install',
      helmForm: {
        version: (versions[0] && versions[0].version) || '',
        release_name: '',
        values: '',
      },
    });
  };

  handleHelmInstall = () => {
    const { dispatch } = this.props;
    const { teamName, regionName } = this.getParams();
    const { helmSelectedChart, helmCurrentRepo, helmForm } = this.state;
    dispatch({
      type: 'teamResources/installRelease',
      payload: {
        team: teamName,
        region: regionName,
        repo_name: helmCurrentRepo,
        chart: helmSelectedChart && helmSelectedChart.name,
        version: helmForm.version,
        release_name: helmForm.release_name,
        values: helmForm.values,
      },
      callback: () => {
        this.setState({ helmModalVisible: false });
        this.fetchTabData('helm');
      },
    });
  };

  handleHelmModalClose = () => {
    this.setState({ helmModalVisible: false });
  };

  // ─── 其他资源操作 ─────────────────────────────────────────────────────────

  handleHelmUninstall = (releaseName) => {
    const { dispatch } = this.props;
    const { teamName, regionName } = this.getParams();
    dispatch({
      type: 'teamResources/uninstallRelease',
      payload: { team: teamName, region: regionName, release_name: releaseName },
      callback: () => this.fetchTabData('helm'),
    });
  };

  handleDeleteResource = (record) => {
    const { dispatch } = this.props;
    const { teamName, regionName } = this.getParams();
    const { activeTab, workloadKind, workloadKindGroup } = this.state;
    const resourceParams = activeTab === 'workload'
      ? { group: workloadKindGroup, version: 'v1', resource: workloadKind }
      : TAB_RESOURCE_MAP[activeTab] || TAB_RESOURCE_MAP.workload;
    dispatch({
      type: 'teamResources/deleteResource',
      payload: { team: teamName, region: regionName, name: record.name, ...resourceParams },
      callback: () => this.fetchTabData(activeTab),
    });
  };

  getFilteredData(data) {
    const { searchText } = this.state;
    if (!searchText) return data;
    return data.filter(r => (r.name || '').toLowerCase().includes(searchText.toLowerCase()));
  }

  renderResourceToolbar = (leftContent, searchPlaceholder = '搜索资源名称...') => {
    const { searchText, activeTab } = this.state;
    const primaryAction = activeTab === 'helm'
      ? { label: '安装 Helm 应用', onClick: this.openHelmInstallModal }
      : { label: '新建资源', onClick: this.openCreateChooser };

    return (
      <div className={styles.toolbar}>
        <div className={styles.toolbarFilters}>
          {leftContent}
          <Input.Search
            placeholder={searchPlaceholder}
            className={styles.toolbarSearch}
            value={searchText}
            allowClear
            size="default"
            onChange={e => this.setState({ searchText: e.target.value })}
          />
        </div>
        <div className={styles.toolbarActions}>
          <Button icon="reload" onClick={() => this.fetchTabData(activeTab)}>
            刷新
          </Button>
          <Button type="primary" icon="plus" onClick={primaryAction.onClick}>
            {primaryAction.label}
          </Button>
        </div>
      </div>
    );
  };

  renderEmptyState = (tab) => {
    const meta = this.getTabMeta(tab);
    const primaryAction = tab === 'helm'
      ? { label: '安装 Helm 应用', onClick: this.openHelmInstallModal }
      : { label: '新建资源', onClick: this.openCreateChooser };

    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyStateIcon}>
          <Icon type={meta.icon} />
        </div>
        <div className={styles.emptyStateTitle}>{meta.emptyTitle}</div>
        <div className={styles.emptyStateDescription}>{meta.emptyDescription}</div>
        <div className={styles.emptyStateActions}>
          <Button type="primary" onClick={primaryAction.onClick}>
            {primaryAction.label}
          </Button>
          <span className={styles.emptyStateHint}>{meta.emptyHint}</span>
        </div>
      </div>
    );
  };

  renderPageHeader = () => {
    const { teamName, regionName } = this.getParams();

    return (
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderMain}>
          <div className={styles.pageEyebrow}>应用管理 / 团队资源中心</div>
          <h1 className={styles.pageTitle}>K8S 原生资源</h1>
          <p className={styles.pageDescription}>
            用一个工作区统一管理当前团队范围内的 Helm 应用、工作负载与基础资源，让日常巡检、发布和排障更顺手。
          </p>
        </div>
        <div className={styles.pageScope}>
          <span className={styles.scopeTag}>
            <Icon type="team" />
            团队 {teamName}
          </span>
          <span className={styles.scopeTag}>
            <Icon type="environment" />
            区域 {regionName}
          </span>
          <span className={styles.scopeTag}>
            <Icon type="appstore" />
            命名空间级资源视图
          </span>
        </div>
      </div>
    );
  };

  renderSidebarNav = () => {
    const { activeTab } = this.state;
    const activeDataLength = this.getActiveData().length;

    return (
      <aside className={styles.sidebar}>
        {TAB_GROUPS.map(group => (
          <div className={styles.sidebarGroup} key={group.title}>
            <div className={styles.sidebarGroupTitle}>{group.title}</div>
            <div className={styles.sidebarGroupItems}>
              {group.items.map(tab => {
                const meta = this.getTabMeta(tab);
                const isActive = tab === activeTab;
                return (
                  <button
                    key={tab}
                    type="button"
                    className={`${styles.sidebarButton} ${isActive ? styles.sidebarButtonActive : ''}`}
                    onClick={() => this.handleTabChange(tab)}
                  >
                    <span className={styles.sidebarButtonIcon}>
                      <Icon type={meta.icon} />
                    </span>
                    <span className={styles.sidebarButtonBody}>
                      <span className={styles.sidebarButtonTitleRow}>
                        <span className={styles.sidebarButtonTitle}>{meta.title}</span>
                        {isActive && <span className={styles.sidebarButtonCount}>{activeDataLength}</span>}
                      </span>
                      <span className={styles.sidebarButtonDescription}>{meta.navDescription}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </aside>
    );
  };

  renderSectionHero = () => {
    const meta = this.getTabMeta();
    const metrics = this.getMetricCards();
    const summary = this.getStatusSummary(this.getActiveData());
    const summaryItems = [
      { label: '稳定', value: summary.running, tone: styles.summaryItemRunning },
      { label: '关注', value: summary.warning, tone: styles.summaryItemWarning },
      { label: '异常', value: summary.error, tone: styles.summaryItemError },
    ];

    return (
      <div className={styles.sectionHero}>
        <div className={styles.sectionHeroTop}>
          <div className={styles.sectionHeroIntro}>
            <span className={styles.sectionHeroIcon}>
              <Icon type={meta.icon} />
            </span>
            <div>
              <h2 className={styles.sectionHeroTitle}>{meta.title}</h2>
              <p className={styles.sectionHeroDescription}>{meta.description}</p>
            </div>
          </div>
          <div className={styles.sectionHeroActions}>
            <Button icon="reload" onClick={() => this.fetchTabData(this.state.activeTab)}>
              刷新当前视图
            </Button>
          </div>
        </div>
        <div className={styles.sectionTips}>
          {meta.tips.map(item => (
            <span className={styles.sectionTip} key={item}>{item}</span>
          ))}
        </div>
        <div className={styles.metricGrid}>
          {metrics.map(metric => (
            <div key={metric.label} className={`${styles.metricCard} ${styles[`metricCard${metric.tone.charAt(0).toUpperCase()}${metric.tone.slice(1)}`] || ''}`}>
              <div className={styles.metricLabel}>{metric.label}</div>
              <div className={styles.metricValue}>{metric.value}</div>
              <div className={styles.metricHelper}>{metric.helper}</div>
            </div>
          ))}
        </div>
        <div className={styles.summaryBar}>
          {summaryItems.map(item => (
            <span key={item.label} className={`${styles.summaryItem} ${item.tone}`}>
              <span className={styles.summaryItemLabel}>{item.label}</span>
              <strong>{item.value}</strong>
            </span>
          ))}
        </div>
      </div>
    );
  };

  renderContentHeader = () => {
    const meta = this.getTabMeta();

    return (
      <div className={styles.contentHeader}>
        <div>
          <h3 className={styles.contentTitle}>{meta.listTitle}</h3>
          <p className={styles.contentDescription}>{meta.listDescription}</p>
        </div>
      </div>
    );
  };

  renderCurrentTab = () => {
    const { activeTab } = this.state;
    if (activeTab === 'helm') {
      return this.renderHelmTab();
    }
    if (activeTab === 'workload') {
      return this.renderWorkloadTab();
    }
    if (activeTab === 'pod') {
      return this.renderPodTab();
    }
    if (activeTab === 'network') {
      return this.renderNetworkTab();
    }
    if (activeTab === 'config') {
      return this.renderConfigTab();
    }
    return this.renderStorageTab();
  };

  renderYamlModalHeader = () => {
    const { yamlModalMode } = this.state;
    return (
      <div className={styles.yamlModalHeader}>
        <div className={styles.yamlModalHeaderMain}>
          <span className={styles.yamlModalHeaderIcon}>
            <Icon type="code" />
          </span>
          <div className={styles.yamlModalHeaderCopy}>
            <div className={styles.yamlModalHeaderTitle}>
              {yamlModalMode === 'edit' ? '查看 / 编辑 YAML' : '创建 YAML 资源'}
            </div>
            <div className={styles.yamlModalHeaderHint}>
              {yamlModalMode === 'edit' ? '直接修改当前资源定义并保存' : '粘贴或导入 Kubernetes YAML 后继续编辑'}
            </div>
          </div>
        </div>
        {yamlModalMode === 'create' && (
          <Upload showUploadList={false} beforeUpload={this.handleYamlUpload} accept=".yaml,.yml">
            <Button className={styles.yamlUploadTrigger} icon="upload">导入文件</Button>
          </Upload>
        )}
      </div>
    );
  };

  getTableScroll = (width) => ({
    x: width,
  });

  getTablePagination = (data) => (
    data.length > 10 ? { pageSize: 10, size: 'small' } : false
  );

  // ─── 各 Tab 渲染 ──────────────────────────────────────────────────────────

  renderWorkloadTab() {
    const { resources } = this.props;
    const { workloadKind } = this.state;
    const data = this.getFilteredData(resources || []);
    const columns = [
      {
        title: '名称',
        dataIndex: 'name',
        key: 'name',
        render: (text, record) => (
          <span>
            <span style={{ color: '#155aef', fontWeight: 500, cursor: 'pointer' }} onClick={() => this.jumpToWorkloadDetail(record)}>{text}</span>
            {record.source === 'helm' && <Tag color="purple" style={{ marginLeft: 8, fontSize: 11 }}>Helm 托管</Tag>}
          </span>
        ),
      },
      {
        title: '类型',
        dataIndex: 'kind',
        key: 'kind',
        width: 130,
        render: v => (
          <code style={{ fontSize: 12, color: '#495464', background: '#f2f4f7', padding: '1px 5px', borderRadius: 2 }}>
            {getWorkloadKindLabel(v || workloadKind)}
          </code>
        ),
      },
      {
        title: '状态',
        dataIndex: 'status',
        key: 'status',
        width: 110,
        render: v => <STATUS_DOT status={v} />,
      },
      {
        title: '副本/容量',
        dataIndex: 'replicas',
        key: 'replicas',
        width: 110,
        render: (v, record) => {
          const ready = record.ready_replicas !== undefined ? record.ready_replicas : v;
          const total = v;
          if (total === undefined) return '-';
          const color = ready < total ? '#F69D4A' : '#00D777';
          return <span style={{ color, fontWeight: 500 }}>{ready}/{total}</span>;
        },
      },
      { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 130, render: v => <span style={{ color: '#8d9bad', fontSize: 12 }}>{v || '-'}</span> },
      {
        title: '操作',
        key: 'action',
        width: 110,
        render: (_, record) => (
          <span>
            <a style={{ color: '#155aef' }} onClick={() => this.jumpToWorkloadDetail(record)}>详情</a>
            {record.source !== 'external' && (
              <>
                <Divider type="vertical" />
                <a style={{ color: '#676f83' }} onClick={() => this.handleOpenResourceYaml(record, this.getCurrentResourceParams('workload'))}>YAML</a>
                <Divider type="vertical" />
                <Popconfirm title={`确认删除 "${record.name}"？`} onConfirm={() => this.handleDeleteResource(record)}>
                  <a style={{ color: '#FC481B' }}>删除</a>
                </Popconfirm>
              </>
            )}
          </span>
        ),
      },
    ];
    return (
      <div>
        {this.renderResourceToolbar(
          <Select value={workloadKind} onChange={this.handleWorkloadKindChange} className={styles.toolbarSelect}>
            {WORKLOAD_KIND_OPTIONS.map(k => <Option key={k.value} value={k.value}>{k.label}</Option>)}
          </Select>,
          '搜索工作负载名称...'
        )}
        <Table
          className={styles.resourceTable}
          dataSource={data}
          columns={columns}
          rowKey="name"
          size="middle"
          scroll={this.getTableScroll(920)}
          pagination={this.getTablePagination(data)}
          locale={{ emptyText: this.renderEmptyState('workload') }}
        />
      </div>
    );
  }

  renderPodTab() {
    const { resources } = this.props;
    const data = this.getFilteredData(resources || []);
    const columns = [
      {
        title: '名称',
        dataIndex: 'name',
        key: 'name',
        render: (text, record) => <span style={{ color: '#155aef', fontWeight: 500, cursor: 'pointer' }} onClick={() => this.jumpToPodDetail(record)}>{text}</span>
      },
      { title: '状态', dataIndex: 'status', key: 'status', width: 110, render: v => <STATUS_DOT status={v} /> },
      { title: '节点', dataIndex: 'node', key: 'node', render: v => v || <span style={{ color: '#8d9bad' }}>-</span> },
      { title: '重启次数', dataIndex: 'restart_count', key: 'restart_count', width: 90, align: 'center', render: v => v !== undefined ? <span style={{ color: v > 3 ? '#FC481B' : '#495464' }}>{v}</span> : '-' },
      { title: '所属工作负载', dataIndex: 'owner', key: 'owner', render: v => v || <span style={{ color: '#8d9bad' }}>-</span> },
      { title: 'IP', dataIndex: 'pod_ip', key: 'pod_ip', render: v => <code style={{ fontSize: 12 }}>{v || '-'}</code> },
      { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 130, render: v => <span style={{ color: '#8d9bad', fontSize: 12 }}>{v || '-'}</span> },
      {
        title: '操作',
        key: 'action',
        width: 120,
        render: (_, record) => (
          <span>
            <a style={{ color: '#155aef' }} onClick={() => this.jumpToPodDetail(record)}>详情</a>
            <Divider type="vertical" />
            <a style={{ color: '#676f83' }} onClick={() => this.handleOpenResourceYaml(record, { group: '', version: 'v1', resource: 'pods' })}>YAML</a>
          </span>
        ),
      },
    ];
    return (
      <div>
        {this.renderResourceToolbar(null, '搜索容器组名称...')}
        <Table
          className={styles.resourceTable}
          dataSource={data}
          columns={columns}
          rowKey="name"
          size="middle"
          scroll={this.getTableScroll(960)}
          pagination={this.getTablePagination(data)}
          locale={{ emptyText: this.renderEmptyState('pod') }}
        />
      </div>
    );
  }

  renderNetworkTab() {
    const { resources } = this.props;
    const data = this.getFilteredData(resources || []);
    const columns = [
      { title: '名称', dataIndex: 'name', key: 'name', render: (text, record) => <span style={{ color: '#155aef', fontWeight: 500, cursor: 'pointer' }} onClick={() => this.handleOpenResourceYaml(record, { group: '', version: 'v1', resource: 'services' })}>{text}</span> },
      { title: '类型', dataIndex: 'type', key: 'type', width: 120, render: v => <Tag>{v || 'ClusterIP'}</Tag> },
      { title: 'Cluster IP', dataIndex: 'cluster_ip', key: 'cluster_ip', render: v => <code style={{ fontSize: 12 }}>{v || '-'}</code> },
      {
        title: '端口',
        dataIndex: 'ports',
        key: 'ports',
        render: ports => (Array.isArray(ports) ? ports : []).map((p, i) => (
          <Tag key={i} color="geekblue" style={{ fontSize: 11 }}>{p.port}/{p.protocol || 'TCP'}</Tag>
        )),
      },
      { title: '选择器', dataIndex: 'selector', key: 'selector', render: v => v ? Object.entries(v).map(([k, val]) => <Tag key={k} style={{ fontSize: 11 }}>{k}={val}</Tag>) : <span style={{ color: '#8d9bad' }}>-</span> },
      { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 130, render: v => <span style={{ color: '#8d9bad', fontSize: 12 }}>{v || '-'}</span> },
      {
        title: '操作',
        key: 'action',
        width: 120,
        render: (_, record) => (
          <span>
            <a style={{ color: '#676f83' }} onClick={() => this.handleOpenResourceYaml(record, { group: '', version: 'v1', resource: 'services' })}>YAML</a>
            <Divider type="vertical" />
            <Popconfirm title={`确认删除 "${record.name}"？`} onConfirm={() => this.handleDeleteResource(record)}>
              <a style={{ color: '#FC481B' }}>删除</a>
            </Popconfirm>
          </span>
        ),
      },
    ];
    return (
      <div>
        {this.renderResourceToolbar(null, '搜索网络资源名称...')}
        <Table
          className={styles.resourceTable}
          dataSource={data}
          columns={columns}
          rowKey="name"
          size="middle"
          scroll={this.getTableScroll(1080)}
          pagination={this.getTablePagination(data)}
          locale={{ emptyText: this.renderEmptyState('network') }}
        />
      </div>
    );
  }

  renderConfigTab() {
    const { resources } = this.props;
    const data = this.getFilteredData(resources || []);
    const columns = [
      { title: '名称', dataIndex: 'name', key: 'name', render: (text, record) => <span style={{ color: '#155aef', fontWeight: 500, cursor: 'pointer' }} onClick={() => this.handleOpenResourceYaml(record, { group: '', version: 'v1', resource: 'configmaps' })}>{text}</span> },
      { title: '类型', dataIndex: 'kind', key: 'kind', width: 130, render: v => <Tag color={v === 'Secret' ? 'orange' : 'cyan'}>{v || 'ConfigMap'}</Tag> },
      { title: '数据条目数', dataIndex: 'data_count', key: 'data_count', width: 100, align: 'center', render: v => v !== undefined ? v : '-' },
      { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 130, render: v => <span style={{ color: '#8d9bad', fontSize: 12 }}>{v || '-'}</span> },
      {
        title: '操作', key: 'action', width: 100,
        render: (_, record) => record.source !== 'external' ? (
          <Popconfirm title={`确认删除 "${record.name}"？`} onConfirm={() => this.handleDeleteResource(record)}>
            <a style={{ color: '#FC481B' }}>删除</a>
          </Popconfirm>
        ) : <span style={{ color: '#8d9bad' }}>只读</span>,
      },
    ];
    return (
      <div>
        {this.renderResourceToolbar(null, '搜索配置资源名称...')}
        <Table
          className={styles.resourceTable}
          dataSource={data}
          columns={columns}
          rowKey="name"
          size="middle"
          scroll={this.getTableScroll(860)}
          pagination={this.getTablePagination(data)}
          locale={{ emptyText: this.renderEmptyState('config') }}
        />
      </div>
    );
  }

  renderStorageTab() {
    const { resources } = this.props;
    const data = this.getFilteredData(resources || []);
    const columns = [
      { title: '名称', dataIndex: 'name', key: 'name', render: (text, record) => <span style={{ color: '#155aef', fontWeight: 500, cursor: 'pointer' }} onClick={() => this.handleOpenResourceYaml(record, { group: '', version: 'v1', resource: 'persistentvolumeclaims' })}>{text}</span> },
      {
        title: '状态', dataIndex: 'status', key: 'status', width: 110,
        render: v => <STATUS_DOT status={v} />,
      },
      { title: '容量', dataIndex: 'storage', key: 'storage', width: 100, render: v => v ? <Tag color="geekblue">{v}</Tag> : '-' },
      { title: '访问模式', dataIndex: 'access_modes', key: 'access_modes', render: modes => (Array.isArray(modes) ? modes : [modes].filter(Boolean)).map(m => <Tag key={m} style={{ fontSize: 11 }}>{m}</Tag>) },
      { title: '存储类', dataIndex: 'storage_class', key: 'storage_class', render: v => v || <span style={{ color: '#8d9bad' }}>-</span> },
      { title: '绑定到 PV', dataIndex: 'volume_name', key: 'volume_name', render: v => v || <span style={{ color: '#8d9bad' }}>-</span> },
      { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 130, render: v => <span style={{ color: '#8d9bad', fontSize: 12 }}>{v || '-'}</span> },
      {
        title: '操作',
        key: 'action',
        width: 120,
        render: (_, record) => (
          <span>
            <a style={{ color: '#676f83' }} onClick={() => this.handleOpenResourceYaml(record, { group: '', version: 'v1', resource: 'persistentvolumeclaims' })}>YAML</a>
            <Divider type="vertical" />
            <Popconfirm title={`确认删除 "${record.name}"？`} onConfirm={() => this.handleDeleteResource(record)}>
              <a style={{ color: '#FC481B' }}>删除</a>
            </Popconfirm>
          </span>
        ),
      },
    ];
    return (
      <div>
        {this.renderResourceToolbar(null, '搜索存储声明名称...')}
        <Table
          className={styles.resourceTable}
          dataSource={data}
          columns={columns}
          rowKey="name"
          size="middle"
          scroll={this.getTableScroll(1020)}
          pagination={this.getTablePagination(data)}
          locale={{ emptyText: this.renderEmptyState('storage') }}
        />
      </div>
    );
  }

  renderHelmTab() {
    const { helmReleases } = this.props;
    const { searchText } = this.state;
    const data = searchText
      ? (helmReleases || []).filter(r => (r.name || '').toLowerCase().includes(searchText.toLowerCase()))
      : (helmReleases || []);

    const columns = [
      {
        title: 'Release 名称',
        dataIndex: 'name',
        key: 'name',
        render: text => <span style={{ color: '#155aef', fontWeight: 500 }}>{text}</span>,
      },
      {
        title: 'Chart',
        dataIndex: 'chart',
        key: 'chart',
        render: (v, record) => (
          <span>
            <span style={{ fontWeight: 500 }}>{v || '-'}</span>
            {record.chart_version && <span style={{ color: '#8d9bad', fontSize: 12, marginLeft: 4 }}>@{record.chart_version}</span>}
          </span>
        ),
      },
      {
        title: '状态',
        dataIndex: 'status',
        key: 'status',
        width: 110,
        render: v => <STATUS_DOT status={v} />,
      },
      { title: '版本号', dataIndex: 'version', key: 'version', width: 80, align: 'center', render: v => v || '-' },
      { title: '命名空间', dataIndex: 'namespace', key: 'namespace', render: v => <code style={{ fontSize: 12 }}>{v || '-'}</code> },
      { title: '更新时间', dataIndex: 'updated', key: 'updated', width: 130, render: v => <span style={{ color: '#8d9bad', fontSize: 12 }}>{v || '-'}</span> },
      {
        title: '操作',
        key: 'action',
        width: 100,
        render: (_, record) => (
          <span>
            <a style={{ color: '#155aef' }}>详情</a>
            <Divider type="vertical" />
            <Popconfirm title={`确认卸载 "${record.name}"？`} onConfirm={() => this.handleHelmUninstall(record.name)}>
              <a style={{ color: '#FC481B' }}>卸载</a>
            </Popconfirm>
          </span>
        ),
      },
    ];
    return (
      <div>
        {this.renderResourceToolbar(null, '搜索 Release 名称...')}
        <Table
          className={styles.resourceTable}
          dataSource={data}
          columns={columns}
          rowKey="name"
          size="middle"
          scroll={this.getTableScroll(980)}
          pagination={this.getTablePagination(data)}
          locale={{ emptyText: this.renderEmptyState('helm') }}
        />
      </div>
    );
  }

  // ─── Helm 弹窗内容 ────────────────────────────────────────────────────────

  renderHelmBrowse() {
    const {
      helmRepos, helmRepoLoading, helmCurrentRepo,
      helmCharts, helmChartLoading, helmChartSearch,
      helmChartPage, helmChartPageSize, helmChartTotal,
    } = this.state;

    if (helmRepoLoading) {
      return (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <Spin tip="加载仓库列表..." />
        </div>
      );
    }

    if (!helmRepos.length) {
      return (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <span style={{ color: '#8d9bad' }}>
              暂无 Helm 仓库，请先在应用市场中添加 Helm 仓库
            </span>
          }
          style={{ padding: '60px 0' }}
        />
      );
    }

    return (
      <div style={{ display: 'flex', minHeight: 400 }}>
        {/* 左侧仓库列表 */}
        <div style={{ width: 160, flexShrink: 0, borderRight: '1px solid #eef0f5', paddingRight: 0 }}>
          <div style={{ fontSize: 12, color: '#8d9bad', padding: '8px 12px 4px', fontWeight: 500 }}>Helm 仓库</div>
          {helmRepos.map(repo => {
            const name = repo.name || repo.repo_name || repo;
            const active = helmCurrentRepo === name;
            return (
              <div
                key={name}
                onClick={() => this.handleHelmRepoSelect(name)}
                style={{
                  padding: '9px 12px',
                  cursor: 'pointer',
                  fontSize: 13,
                  color: active ? '#155aef' : '#495464',
                  background: active ? 'rgba(21,90,239,0.07)' : 'transparent',
                  borderRight: active ? '2px solid #155aef' : '2px solid transparent',
                  fontWeight: active ? 500 : 400,
                  transition: 'all 0.15s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Icon type="database" style={{ fontSize: 12, opacity: 0.7 }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
              </div>
            );
          })}
        </div>

        {/* 右侧 Chart 列表 */}
        <div style={{ flex: 1, paddingLeft: 16, overflow: 'hidden' }}>
          {/* 搜索栏 */}
          <div style={{ marginBottom: 12 }}>
            <Input.Search
              placeholder="搜索 Chart 名称..."
              value={helmChartSearch}
              onChange={e => this.handleHelmChartSearch(e.target.value)}
              onSearch={this.handleHelmChartSearch}
              allowClear
              size="small"
              style={{ width: 240 }}
            />
          </div>

          {helmChartLoading ? (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <Spin tip="加载 Chart 列表..." />
            </div>
          ) : helmCharts.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无 Chart" style={{ padding: '60px 0' }} />
          ) : (
            <>
              <List
                grid={{ gutter: 12, column: 3 }}
                dataSource={helmCharts}
                renderItem={chart => {
                  const versions = chart.versions || [];
                  const latestVer = (versions[0] && versions[0].version) || chart.version || '';
                  return (
                    <List.Item style={{ marginBottom: 8 }}>
                      <Card
                        size="small"
                        hoverable
                        onClick={() => this.handleHelmChartSelect(chart)}
                        bodyStyle={{ padding: '12px 14px' }}
                        style={{ cursor: 'pointer', borderRadius: 6, border: '1px solid #eef0f5' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
                          <Icon type="rocket" style={{ color: '#155aef', marginRight: 7, fontSize: 16 }} />
                          <span style={{
                            fontWeight: 600,
                            fontSize: 13,
                            color: '#155aef',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            maxWidth: 130,
                          }} title={chart.name}>
                            {chart.name}
                          </span>
                        </div>
                        {chart.description && (
                          <div style={{
                            fontSize: 11,
                            color: '#8d9bad',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            marginBottom: 6,
                          }} title={chart.description}>
                            {chart.description}
                          </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          {latestVer && (
                            <Tag color="geekblue" style={{ fontSize: 11, margin: 0 }}>{latestVer}</Tag>
                          )}
                          {versions.length > 1 && (
                            <span style={{ fontSize: 11, color: '#8d9bad' }}>共 {versions.length} 个版本</span>
                          )}
                        </div>
                      </Card>
                    </List.Item>
                  );
                }}
              />
              {helmChartTotal > helmChartPageSize && (
                <div style={{ textAlign: 'right', marginTop: 8 }}>
                  <span style={{ fontSize: 12, color: '#8d9bad', marginRight: 8 }}>
                    共 {helmChartTotal} 个 Chart
                  </span>
                  {/* 简单分页 */}
                  {Array.from({ length: Math.ceil(helmChartTotal / helmChartPageSize) }, (_, i) => i + 1).map(p => (
                    <Button
                      key={p}
                      size="small"
                      type={p === helmChartPage ? 'primary' : 'default'}
                      style={{ margin: '0 2px', minWidth: 28 }}
                      onClick={() => this.handleHelmChartPageChange(p)}
                    >
                      {p}
                    </Button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  renderHelmInstallForm() {
    const { helmSelectedChart, helmCurrentRepo, helmForm } = this.state;
    const versions = (helmSelectedChart && helmSelectedChart.versions) || [];

    return (
      <div>
        {/* 已选 Chart 信息 */}
        <div style={{
          background: '#f7f9ff',
          border: '1px solid #d0dbff',
          borderRadius: 6,
          padding: '12px 16px',
          marginBottom: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          <Icon type="rocket" style={{ fontSize: 22, color: '#155aef' }} />
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, color: '#155aef' }}>
              {helmSelectedChart && helmSelectedChart.name}
            </div>
            <div style={{ fontSize: 12, color: '#8d9bad', marginTop: 2 }}>
              仓库：{helmCurrentRepo}
              {helmSelectedChart && helmSelectedChart.description && (
                <span style={{ marginLeft: 12 }}>{helmSelectedChart.description}</span>
              )}
            </div>
          </div>
        </div>

        <Form layout="vertical">
          <Form.Item label="版本" required style={{ marginBottom: 16 }}>
            {versions.length > 0 ? (
              <Select
                value={helmForm.version}
                onChange={v => this.setState({ helmForm: { ...helmForm, version: v } })}
                style={{ width: '100%' }}
              >
                {versions.map(ver => (
                  <Option key={ver.version} value={ver.version}>{ver.version}</Option>
                ))}
              </Select>
            ) : (
              <Input
                value={helmForm.version}
                onChange={e => this.setState({ helmForm: { ...helmForm, version: e.target.value } })}
                placeholder="如：1.2.3"
              />
            )}
          </Form.Item>
          <Form.Item label="Release 名称" required style={{ marginBottom: 16 }}>
            <Input
              value={helmForm.release_name}
              onChange={e => this.setState({ helmForm: { ...helmForm, release_name: e.target.value } })}
              placeholder="如：my-nginx（小写字母、数字、连字符）"
            />
          </Form.Item>
          <Form.Item label="Values（YAML 格式，可选）" style={{ marginBottom: 0 }}>
            <TextArea
              rows={5}
              value={helmForm.values}
              onChange={e => this.setState({ helmForm: { ...helmForm, values: e.target.value } })}
              placeholder="replicaCount: 2&#10;image:&#10;  tag: latest"
              style={{ fontFamily: 'monospace', fontSize: 13 }}
            />
          </Form.Item>
        </Form>
      </div>
    );
  }

  renderHelmModalFooter() {
    const { helmStep, helmForm } = this.state;
    if (helmStep === 'browse') {
      return (
        <Button onClick={this.handleHelmModalClose}>取消</Button>
      );
    }
    return (
      <span>
        <Button onClick={() => this.setState({ helmStep: 'browse' })} style={{ marginRight: 8 }}>
          <Icon type="left" />返回选择
        </Button>
        <Button onClick={this.handleHelmModalClose} style={{ marginRight: 8 }}>取消</Button>
        <Button
          type="primary"
          onClick={this.handleHelmInstall}
          disabled={!helmForm.release_name || !helmForm.version}
        >
          安装
        </Button>
      </span>
    );
  }

  // ─── 主渲染 ───────────────────────────────────────────────────────────────

  render() {
    const { yamlModalVisible, yamlContent, helmModalVisible, helmStep, yamlModalMode } = this.state;

    return (
      <div className={styles.page}>
        {this.renderPageHeader()}

        <div className={styles.workspace}>
          {this.renderSidebarNav()}
          <div className={styles.mainPanel}>
            {this.renderSectionHero()}
            <Card className={styles.contentCard} bodyStyle={{ padding: 0 }}>
              {this.renderContentHeader()}
              <div className={styles.contentBody}>
                {this.renderCurrentTab()}
              </div>
            </Card>
          </div>
        </div>

        <Modal
          title={this.renderYamlModalHeader()}
          visible={yamlModalVisible}
          onOk={this.handleYamlCreate}
          onCancel={() => this.setState({ yamlModalVisible: false, yamlContent: '', yamlModalMode: 'create', yamlTargetName: '', yamlTargetParams: null })}
          width={820}
          okText={yamlModalMode === 'edit' ? '保存' : '创建'}
          cancelText="取消"
          wrapClassName={styles.yamlModalWrap}
          bodyStyle={{ padding: '0 24px 24px' }}
        >
          <div className={styles.yamlModalToolbar}>
            <div className={styles.yamlModalToolbarInfo}>
              <span className={styles.yamlMetaBadge}>Kubernetes YAML</span>
              <span className={styles.yamlMetaText}>
                {yamlModalMode === 'edit'
                  ? '保存后会直接更新当前资源定义。'
                  : '支持 `.yaml` / `.yml`，导入后可继续校对与修改。'}
              </span>
            </div>
            <div className={styles.yamlModalToolbarTips}>
              <span className={styles.yamlMiniTip}>支持多文档</span>
              <span className={styles.yamlMiniTip}>保留手动编辑</span>
            </div>
          </div>
          <TextArea
            className={styles.yamlEditor}
            rows={20}
            value={yamlContent}
            onChange={e => this.setState({ yamlContent: e.target.value })}
            placeholder="apiVersion: apps/v1&#10;kind: Deployment&#10;metadata:&#10;  name: my-app&#10;..."
            style={{ fontFamily: 'monospace', fontSize: 13 }}
          />
        </Modal>

        {/* Helm 应用商店弹窗 */}
        <Modal
          title={
            <span>
              <Icon type="rocket" style={{ marginRight: 8 }} />
              {helmStep === 'browse' ? '选择 Helm 应用' : '配置安装参数'}
            </span>
          }
          visible={helmModalVisible}
          footer={this.renderHelmModalFooter()}
          onCancel={this.handleHelmModalClose}
          width={800}
          bodyStyle={{ padding: '16px 24px' }}
        >
          {helmStep === 'browse' ? this.renderHelmBrowse() : this.renderHelmInstallForm()}
        </Modal>
      </div>
    );
  }

}

export default ResourceCenter;
