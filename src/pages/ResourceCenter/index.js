import React, { PureComponent } from 'react';
import { connect } from 'dva';
import { routerRedux } from 'dva/router';
import {
  Table,
  Button,
  Modal,
  Input,
  Tag,
  Avatar,
  Popconfirm,
  Form,
  Collapse,
  Card,
  Icon,
  Select,
  Divider,
  List,
  Spin,
  Empty,
  Upload,
  notification,
  Steps,
} from 'antd';
import jsYaml from 'js-yaml';
import Result from '@/components/Result';
import styles from './index.less';
import { getPreferredHelmValuesFileKey, getSortedHelmValuesFileKeys } from './helmValues';
import {
  WORKLOAD_KIND_OPTIONS,
  getResourceStatusMeta,
  getWorkloadKindLabel,
} from './utils';

const { TextArea } = Input;
const { Option } = Select;
const { Step } = Steps;
const DEFAULT_TAB = 'helm';
const DEFAULT_TABLE_COLUMN_WIDTH = 160;
const HELM_WIZARD_STEPS = ['source', 'basic', 'values'];

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
    listDescription: '支持按类型筛选、删除资源，并继续下钻到工作负载详情。',
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
    listDescription: '重点用于排障和联动查看，支持直接跳转详情或删除实例。',
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
    listDescription: '查看 Service 类型、端口暴露、Selector 绑定关系，并支持直接编辑 YAML。',
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
    listDescription: '适合统一梳理配置对象、数据条目数、资源来源与可维护状态。',
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

const TAB_ORDER = ['helm', 'workload', 'pod', 'network', 'config', 'storage'];

const STATUS_DOT = ({ status }) => {
  const { color, text } = getResourceStatusMeta(status);
  return (
    <span>
      <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: color, marginRight: 6 }} />
      <span style={{ color }}>{text}</span>
    </span>
  );
};

const parseVersionToken = (input) => {
  const value = (input || '').trim();
  if (!value) {
    return null;
  }
  const matched = value.match(/^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?(.*)$/);
  if (!matched) {
    return null;
  }
  return {
    major: Number(matched[1] || 0),
    minor: Number(matched[2] || 0),
    patch: Number(matched[3] || 0),
    suffix: matched[4] || '',
  };
};

const compareHelmVersions = (left, right) => {
  const a = parseVersionToken(left);
  const b = parseVersionToken(right);
  if (!a || !b) {
    return String(left || '').localeCompare(String(right || ''));
  }
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  if (a.patch !== b.patch) return a.patch - b.patch;
  return a.suffix.localeCompare(b.suffix);
};

@connect(({ teamResources, enterprise }) => ({
  resources: teamResources.resources,
  helmReleases: teamResources.helmReleases,
  helmPreview: teamResources.helmPreview,
  helmReleaseHistory: teamResources.helmReleaseHistory,
  total: teamResources.total,
  currentEnterprise: enterprise.currentEnterprise,
}))
class ResourceCenter extends PureComponent {
  contentCardRef = React.createRef();

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
    helmModalMode: 'install',
    helmTargetRelease: null,
    helmSourceType: 'store',
    helmStep: 'source',         // 'source' | 'basic' | 'values'
    helmInstallLoading: false,
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
    helmPreviewLoading: false,
    helmPreviewData: null,
    helmPreviewFileKey: '',
    helmPreviewStatus: 'idle',
    helmPreviewError: '',
    helmConfigVisible: false,
    helmValuesEditorVisible: false,
    helmValuesEditorSourceType: 'store',
    helmExternalForm: {
      chart_protocol: 'https://',
      chart_address: '',
      auth_type: 'none',
      release_name: '',
      values: '',
      username: '',
      password: '',
    },
    helmUploadRecord: {},
    helmUploadEventId: '',
    helmUploadFileList: [],
    helmUploadExistFiles: [],
    helmUploadChartInfo: null,
    helmUploadLoading: false,
    helmUploadForm: {
      version: '',
      release_name: '',
      values: '',
    },
    helmDetailVisible: false,
    helmDetailRelease: null,
    helmAutoUpgradeLoading: false,
    helmAutoUpgradeInfo: null,
    helmAutoUpgradeError: '',
    helmHistoryVisible: false,
    helmHistoryLoading: false,
    helmHistoryRelease: null,
    helmHistoryList: [],
    helmRollbackLoading: false,
  };

  componentDidMount() {
    const initialViewState = this.getInitialViewState();
    this.setState(initialViewState, () => {
      this.fetchTabData(
        initialViewState.activeTab,
        initialViewState.activeTab === 'workload'
          ? {
            resource: initialViewState.workloadKind,
            group: initialViewState.workloadKindGroup,
          }
          : {}
      );
    });
  }

  componentWillUnmount() {
    if (this.scrollFrame) {
      window.cancelAnimationFrame(this.scrollFrame);
    }
  }

  getParams() {
    const { match } = this.props;
    return (match && match.params) || {};
  }

  getLocationQuery() {
    const { location } = this.props;
    const query = (location && location.query) || {};
    const searchParams = location && location.search ? new URLSearchParams(location.search) : null;
    return {
      tab: query.tab || (searchParams && searchParams.get('tab')) || '',
      workloadKind: query.workloadKind || (searchParams && searchParams.get('workloadKind')) || '',
    };
  }

  getInitialViewState() {
    const { tab, workloadKind } = this.getLocationQuery();
    const matchedWorkloadKind = WORKLOAD_KIND_OPTIONS.find(item => item.value === workloadKind) || WORKLOAD_KIND_OPTIONS[0];
    return {
      activeTab: TAB_META[tab] ? tab : DEFAULT_TAB,
      workloadKind: matchedWorkloadKind.value,
      workloadKindGroup: matchedWorkloadKind.group,
    };
  }

  fetchTabData = (tab, extra = {}) => {
    const { dispatch } = this.props;
    const { workloadKind, workloadKindGroup } = this.state;
    const { teamName, regionName } = this.getParams();
    if (tab === 'helm') {
      dispatch({ type: 'teamResources/fetchHelmReleases', payload: { team: teamName, region: regionName } });
      return;
    }
    if (tab === 'config') {
      dispatch({
        type: 'teamResources/fetchConfigResources',
        payload: { team: teamName, region: regionName, group: '', version: 'v1' },
      });
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
    const { activeTab } = this.state;
    if (key === activeTab) {
      return;
    }
    this.setState({ activeTab: key, searchText: '' }, () => {
      this.fetchTabData(key);
      this.scrollToContentCard();
    });
  };

  scrollToContentCard = () => {
    if (this.scrollFrame) {
      window.cancelAnimationFrame(this.scrollFrame);
    }
    this.scrollFrame = window.requestAnimationFrame(() => {
      if (this.contentCardRef && this.contentCardRef.current) {
        this.contentCardRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }
      this.scrollFrame = null;
    });
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

  getRecordResourceParams = (record, tab = this.state.activeTab) => {
    if (tab === 'config') {
      const kind = ((record && record.kind) || '').toLowerCase();
      return { group: '', version: 'v1', resource: kind === 'secret' ? 'secrets' : 'configmaps' };
    }
    return this.getCurrentResourceParams(tab);
  };

  resolveCreateResourceParams = (resourceParams, yamlContent) => {
    if (!resourceParams || resourceParams.resource !== 'configmaps') {
      return resourceParams;
    }
    try {
      const [firstDoc] = jsYaml.loadAll(yamlContent).filter(Boolean);
      const kind = ((firstDoc && firstDoc.kind) || '').toLowerCase();
      if (kind === 'secret') {
        return { ...resourceParams, resource: 'secrets' };
      }
      if (kind === 'configmap') {
        return { ...resourceParams, resource: 'configmaps' };
      }
    } catch (e) {
      return resourceParams;
    }
    return resourceParams;
  };

  closeYamlModal = () => {
    this.setState({
      yamlModalVisible: false,
      yamlModalMode: 'create',
      yamlContent: '',
      yamlTargetName: '',
      yamlTargetParams: null,
    });
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
      const externalCount = list.filter(item => item.source === 'external').length;
      return [
        { label: '配置对象数', value: list.length, helper: 'ConfigMap 与 Secret 的统一清单', tone: 'default' },
        { label: 'ConfigMap', value: configMapCount, helper: '适合管理普通配置项', tone: 'running' },
        { label: 'Secret', value: secretCount, helper: '适合敏感配置与凭据引用', tone: secretCount > 0 ? 'warning' : 'default' },
        { label: '外部来源', value: externalCount, helper: '未携带 Rainbond 来源标记的配置对象', tone: 'default' },
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
    const rawResourceParams = yamlTargetParams || this.getCurrentResourceParams();
    const resourceParams = yamlModalMode === 'edit'
      ? rawResourceParams
      : this.resolveCreateResourceParams(rawResourceParams, yamlContent);
    const action = yamlModalMode === 'edit' ? 'teamResources/updateResource' : 'teamResources/createResource';
    const payload = yamlModalMode === 'edit'
      ? { team: teamName, region: regionName, name: yamlTargetName, yaml: yamlContent, ...resourceParams }
      : { team: teamName, region: regionName, source: 'yaml', yaml: yamlContent, ...resourceParams };
    dispatch({
      type: action,
      payload,
      callback: () => {
        notification.success({ message: yamlModalMode === 'edit' ? 'YAML 保存成功' : '资源创建成功' });
        this.closeYamlModal();
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
      query: {
        group: resourceParams.group,
        version: resourceParams.version,
        tab: 'workload',
        workloadKind: resourceParams.resource,
      },
    }));
  };

  jumpToPodDetail = (record) => {
    const { dispatch } = this.props;
    const { teamName, regionName } = this.getParams();
    dispatch(routerRedux.push({
      pathname: `/team/${teamName}/region/${regionName}/resource-center/pods/${record.name}`,
    }));
  };

  jumpToServiceDetail = (record) => {
    const { dispatch } = this.props;
    const { teamName, regionName } = this.getParams();
    const serviceName = (record && record.name) || record;
    dispatch(routerRedux.push({
      pathname: `/team/${teamName}/region/${regionName}/resource-center/services/${serviceName}`,
    }));
  };

  jumpToHelmDetail = (record, query = {}) => {
    const { dispatch } = this.props;
    const { teamName, regionName } = this.getParams();
    dispatch(routerRedux.push({
      pathname: `/team/${teamName}/region/${regionName}/resource-center/helm/${record.name}`,
      query,
    }));
  };

  // ─── Helm 应用商店 ────────────────────────────────────────────────────────

  buildHelmModalState = (mode = 'install', release = null) => {
    const fixedReleaseName = (release && release.name) || '';
    return {
      helmModalVisible: true,
      helmModalMode: mode,
      helmTargetRelease: release,
      helmSourceType: 'store',
      helmStep: 'source',
      helmInstallLoading: false,
      helmCurrentRepo: '',
      helmAllCharts: [],
      helmCharts: [],
      helmChartSearch: '',
      helmChartPage: 1,
      helmChartTotal: 0,
      helmSelectedChart: null,
      helmForm: { version: '', release_name: fixedReleaseName, values: '' },
      helmPreviewLoading: false,
      helmPreviewData: null,
      helmPreviewFileKey: '',
      helmPreviewStatus: 'idle',
      helmPreviewError: '',
      helmConfigVisible: false,
      helmValuesEditorVisible: false,
      helmValuesEditorSourceType: 'store',
      helmExternalForm: {
        chart_protocol: 'https://',
        chart_address: '',
        auth_type: 'none',
        release_name: fixedReleaseName,
        values: '',
        username: '',
        password: '',
      },
      helmUploadRecord: {},
      helmUploadEventId: '',
      helmUploadFileList: [],
      helmUploadExistFiles: [],
      helmUploadChartInfo: null,
      helmUploadLoading: false,
      helmUploadForm: { version: '', release_name: fixedReleaseName, values: '' },
      helmAutoUpgradeLoading: false,
      helmAutoUpgradeInfo: null,
      helmAutoUpgradeError: '',
    };
  };

  getHelmWizardSteps = () => {
    const { helmSourceType } = this.state;
    return [
      {
        key: 'source',
        title: helmSourceType === 'store' ? '选择应用' : '准备来源',
        helper: helmSourceType === 'store'
          ? '先从 Helm 仓库中选择目标 Chart。'
          : helmSourceType === 'external'
            ? '先填写 Chart 地址，点击下一步时自动检测。'
            : '先上传 Chart 包，点击下一步时自动检测。',
      },
      {
        key: 'basic',
        title: '基础信息',
        helper: '在这一页确认版本与 Release 名称。',
      },
      {
        key: 'values',
        title: '安装配置',
        helper: '最后统一编辑 values.yaml，并直接执行安装。',
      },
    ];
  };

  getHelmStepIndex = () => {
    const { helmStep } = this.state;
    const index = HELM_WIZARD_STEPS.indexOf(helmStep);
    return index > -1 ? index : 0;
  };

  canProceedHelmStep = () => {
    const {
      helmStep,
      helmSourceType,
      helmSelectedChart,
      helmPreviewData,
      helmPreviewLoading,
      helmForm,
      helmExternalForm,
      helmUploadExistFiles,
      helmUploadForm,
    } = this.state;

    if (helmStep === 'source') {
      if (helmSourceType === 'store') {
        return !!helmSelectedChart && !!helmPreviewData && !helmPreviewLoading;
      }
      if (helmSourceType === 'external') {
        const chartUrl = this.buildHelmExternalChartUrl();
        return !!chartUrl && !(
          helmExternalForm.auth_type === 'basic'
          && (!helmExternalForm.username || !helmExternalForm.password)
        ) && !helmPreviewLoading;
      }
      return !!helmUploadExistFiles.length && !helmPreviewLoading;
    }

    if (helmStep === 'basic') {
      if (helmPreviewLoading || !helmPreviewData) {
        return false;
      }
      if (helmSourceType === 'store') {
        return !!helmForm.release_name && !!helmForm.version;
      }
      if (helmSourceType === 'external') {
        return !!helmExternalForm.release_name;
      }
      return !!helmUploadForm.release_name;
    }

    return false;
  };

  buildHelmSourcePreviewPayload = () => {
    const { teamName, regionName } = this.getParams();
    const { helmSourceType, helmExternalForm, helmUploadEventId } = this.state;
    if (helmSourceType === 'external') {
      const chartUrl = this.buildHelmExternalChartUrl();
      if (!chartUrl) {
        return null;
      }
      return {
        team: teamName,
        region: regionName,
        source_type: chartUrl.indexOf('oci://') === 0 ? 'oci' : 'repo',
        chart_url: chartUrl,
        username: helmExternalForm.auth_type === 'basic' ? helmExternalForm.username : '',
        password: helmExternalForm.auth_type === 'basic' ? helmExternalForm.password : '',
      };
    }
    if (helmSourceType === 'upload') {
      if (!helmUploadEventId) {
        return null;
      }
      return {
        team: teamName,
        region: regionName,
        source_type: 'upload',
        event_id: helmUploadEventId,
      };
    }
    return null;
  };

  canInstallHelm = () => {
    const {
      helmSourceType,
      helmPreviewData,
      helmPreviewLoading,
      helmForm,
      helmExternalForm,
      helmUploadChartInfo,
      helmUploadForm,
    } = this.state;

    if (helmPreviewLoading || !helmPreviewData) {
      return false;
    }
    if (helmSourceType === 'store') {
      return !!helmForm.release_name && !!helmForm.version;
    }
    if (helmSourceType === 'external') {
      return !!helmExternalForm.release_name;
    }
    return !!helmUploadChartInfo && !!helmUploadForm.release_name;
  };

  goToNextHelmStep = () => {
    const { helmStep, helmSourceType, helmPreviewData } = this.state;
    const currentIndex = this.getHelmStepIndex();
    if (!this.canProceedHelmStep() || currentIndex >= HELM_WIZARD_STEPS.length - 1) {
      return;
    }
    if (helmStep === 'source' && helmSourceType !== 'store') {
      if (helmPreviewData) {
        this.setState({ helmStep: HELM_WIZARD_STEPS[currentIndex + 1] });
        return;
      }
      const payload = this.buildHelmSourcePreviewPayload();
      if (!payload) {
        return;
      }
      this.fetchHelmChartPreview(payload, helmSourceType, () => {
        this.setState({ helmStep: HELM_WIZARD_STEPS[currentIndex + 1] });
      });
      return;
    }
    this.setState({ helmStep: HELM_WIZARD_STEPS[currentIndex + 1] });
  };

  goToPrevHelmStep = () => {
    const currentIndex = this.getHelmStepIndex();
    if (currentIndex <= 0) {
      return;
    }
    this.setState({ helmStep: HELM_WIZARD_STEPS[currentIndex - 1] });
  };

  openHelmInstallModal = () => {
    this.setState(this.buildHelmModalState('install'));
    this.fetchHelmRepos();
    this.initHelmUploadSession();
  };

  openHelmUpgradeModal = (release) => {
    this.setState(this.buildHelmModalState('upgrade', release));
    this.fetchHelmRepos();
    this.initHelmUploadSession();
  };

  openHelmDetailModal = (release) => {
    this.setState({
      helmDetailVisible: true,
      helmDetailRelease: release,
    });
  };

  closeHelmDetailModal = () => {
    this.setState({
      helmDetailVisible: false,
      helmDetailRelease: null,
    });
  };

  openHelmRollbackModal = (release) => {
    const { dispatch } = this.props;
    const { teamName, regionName } = this.getParams();
    this.setState({
      helmHistoryVisible: true,
      helmHistoryLoading: true,
      helmHistoryRelease: release,
      helmHistoryList: [],
      helmRollbackLoading: false,
    });
    dispatch({
      type: 'teamResources/fetchHelmReleaseHistory',
      payload: {
        team: teamName,
        region: regionName,
        release_name: release.name,
      },
      callback: list => {
        this.setState({
          helmHistoryLoading: false,
          helmHistoryList: Array.isArray(list) ? list : [],
        });
      },
      handleError: err => {
        this.setState({ helmHistoryLoading: false });
        notification.error({
          message: this.getHelmErrorMessage(err, '读取回滚历史失败'),
        });
      },
    });
  };

  handleHelmSourceChange = (sourceType) => {
    const { helmModalMode, helmTargetRelease, helmSourceType, helmForm, helmExternalForm, helmUploadForm } = this.state;
    if (sourceType === helmSourceType) {
      return;
    }
    const fixedReleaseName = helmModalMode === 'upgrade' && helmTargetRelease ? helmTargetRelease.name : '';
    const nextState = {
      helmSourceType: sourceType,
      helmStep: 'source',
      helmPreviewLoading: false,
      helmValuesEditorVisible: false,
      helmValuesEditorSourceType: sourceType,
      ...this.buildHelmPreviewResetState(),
    };
    if (helmSourceType === 'store') {
      nextState.helmSelectedChart = null;
      nextState.helmForm = {
        ...helmForm,
        version: '',
        values: '',
        release_name: fixedReleaseName || helmForm.release_name,
      };
    }
    if (helmSourceType === 'external') {
      nextState.helmExternalForm = {
        ...helmExternalForm,
        values: '',
        release_name: fixedReleaseName || helmExternalForm.release_name,
      };
    }
    if (helmSourceType === 'upload') {
      nextState.helmUploadChartInfo = null;
      nextState.helmUploadForm = {
        ...helmUploadForm,
        version: '',
        values: '',
        release_name: fixedReleaseName || helmUploadForm.release_name,
      };
    }
    this.setState(nextState);
    if (sourceType === 'upload' && !(this.state.helmUploadRecord && this.state.helmUploadRecord.upload_url)) {
      this.initHelmUploadSession();
    }
  };

  fetchHelmRepos = (afterLoad) => {
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
          if (afterLoad) {
            afterLoad(repos);
          }
        });
      },
      handleError: () => {
        this.setState({ helmRepoLoading: false });
        if (afterLoad) {
          afterLoad([]);
        }
      },
    });
  };

  fetchHelmChartsByRepo = (repoName, query) => {
    const { dispatch, currentEnterprise } = this.props;
    const eid = currentEnterprise && currentEnterprise.enterprise_id;
    return new Promise(resolve => {
      dispatch({
        type: 'market/fetchHelmMarkets',
        payload: {
          enterprise_id: eid,
          repo_name: repoName,
          query,
          page: 1,
          pageSize: 20,
          versions_limit: 20,
        },
        callback: res => {
          const charts = Array.isArray(res) ? res : [];
          resolve(charts);
        },
        handleError: () => resolve([]),
      });
    });
  };

  detectHelmUpgradeOptions = async (release) => {
    const { helmRepos } = this.state;
    const releaseChart = (release && release.chart) || '';
    const currentVersion = (release && release.chart_version) || '';
    if (!releaseChart) {
      this.setState({
        helmAutoUpgradeLoading: false,
        helmAutoUpgradeInfo: null,
        helmAutoUpgradeError: '当前 Release 缺少 Chart 信息，请改用手动升级。',
      });
      return;
    }
    const repos = Array.isArray(helmRepos) ? helmRepos : [];
    if (!repos.length) {
      this.setState({
        helmAutoUpgradeLoading: false,
        helmAutoUpgradeInfo: null,
        helmAutoUpgradeError: '当前没有可用于自动检测的 Helm 仓库，请改用手动升级。',
      });
      return;
    }

    const matches = [];
    for (let i = 0; i < repos.length; i += 1) {
      const repo = repos[i];
      const repoName = repo.name || repo.repo_name || repo;
      const charts = await this.fetchHelmChartsByRepo(repoName, releaseChart);
      const targetChart = charts.find(item => (item.name || '') === releaseChart);
      if (!targetChart) {
        // eslint-disable-next-line no-continue
        continue;
      }
      const versions = ((targetChart.versions || []).map(item => item.version).filter(Boolean))
        .filter(version => compareHelmVersions(version, currentVersion) > 0)
        .sort((left, right) => compareHelmVersions(right, left));
      if (versions.length > 0) {
        matches.push({
          repoName,
          chart: targetChart,
          versions,
          recommendedVersion: versions[0],
        });
      }
    }

    if (matches.length === 1) {
      this.setState({
        helmAutoUpgradeLoading: false,
        helmAutoUpgradeInfo: matches[0],
        helmAutoUpgradeError: '',
      });
      return;
    }

    this.setState({
      helmAutoUpgradeLoading: false,
      helmAutoUpgradeInfo: null,
      helmAutoUpgradeError: matches.length > 1
        ? '检测到多个同名 Chart 来源，请改用手动升级。'
        : '暂未发现可自动识别的更新版本，请改用手动升级。',
    });
  };

  applyRecommendedUpgrade = () => {
    const { helmAutoUpgradeInfo, helmTargetRelease } = this.state;
    if (!helmAutoUpgradeInfo) {
      return;
    }
    const chart = helmAutoUpgradeInfo.chart || {};
    const version = helmAutoUpgradeInfo.recommendedVersion || '';
    this.setState({
      helmSourceType: 'store',
      helmStep: 'basic',
      helmCurrentRepo: helmAutoUpgradeInfo.repoName,
      helmSelectedChart: chart,
      helmPreviewData: null,
      helmPreviewFileKey: '',
      helmForm: {
        version,
        release_name: (helmTargetRelease && helmTargetRelease.name) || '',
        values: '',
      },
    }, () => {
      this.fetchHelmChartPreview({
        team: this.getParams().teamName,
        region: this.getParams().regionName,
        source_type: 'store',
        repo_name: helmAutoUpgradeInfo.repoName,
        chart: chart && chart.name,
        version,
      }, 'store');
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
        const all = Array.isArray(res)
          ? res.map(chart => ({
            ...chart,
            description:
              chart.description
              || (chart.versions && chart.versions[0] && chart.versions[0].description)
              || '',
          }))
          : [];
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
    const version = (versions[0] && versions[0].version) || '';
    const { helmModalMode, helmTargetRelease } = this.state;
    this.setState({
      helmSelectedChart: chart,
      helmStep: 'source',
      helmPreviewData: null,
      helmPreviewFileKey: '',
      helmForm: {
        version,
        release_name: helmModalMode === 'upgrade' && helmTargetRelease ? helmTargetRelease.name : '',
        values: '',
      },
    }, () => {
      this.fetchHelmChartPreview({
        team: this.getParams().teamName,
        region: this.getParams().regionName,
        source_type: 'store',
        repo_name: this.state.helmCurrentRepo,
        chart: chart && chart.name,
        version,
      }, 'store');
    });
  };

  handleHelmStoreVersionChange = (version) => {
    const { helmSelectedChart, helmCurrentRepo, helmForm } = this.state;
    const { teamName, regionName } = this.getParams();
    this.setState({
      helmForm: { ...helmForm, version },
      helmPreviewData: null,
      helmPreviewFileKey: '',
    }, () => {
      this.fetchHelmChartPreview({
        team: teamName,
        region: regionName,
        source_type: 'store',
        repo_name: helmCurrentRepo,
        chart: helmSelectedChart && helmSelectedChart.name,
        version,
      }, 'store');
    });
  };

  getHelmChartIcon = (chart) => {
    const versions = (chart && chart.versions) || [];
    return (chart && chart.icon) || (versions[0] && versions[0].icon) || '';
  };

  handleHelmExternalFieldChange = (key, value) => {
    const { helmExternalForm } = this.state;
    const resetPreviewKeys = ['chart_protocol', 'chart_address', 'auth_type', 'username', 'password'];
    this.setState({
      helmExternalForm: {
        ...helmExternalForm,
        [key]: value,
      },
      ...(resetPreviewKeys.indexOf(key) > -1 ? {
        ...this.buildHelmPreviewResetState(),
      } : {}),
    });
  };

  buildHelmExternalChartUrl = () => {
    const { helmExternalForm } = this.state;
    const chartAddress = (helmExternalForm.chart_address || '').trim();
    if (!chartAddress) {
      return '';
    }
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(chartAddress)) {
      return chartAddress;
    }
    return `${helmExternalForm.chart_protocol || 'https://'}${chartAddress}`;
  };

  initHelmUploadSession = () => {
    const { dispatch } = this.props;
    const { teamName, regionName } = this.getParams();
    dispatch({
      type: 'createApp/createJarWarServices',
      payload: {
        region: regionName,
        team_name: teamName,
        component_id: '',
      },
      callback: res => {
        const bean = res && res.bean;
        this.setState({
          helmUploadRecord: bean || {},
          helmUploadEventId: bean && bean.event_id,
        });
      },
      handleError: err => {
        notification.error({
          message: (err && err.msg_show) || '初始化 Chart 上传会话失败',
        });
      },
    });
  };

  decodeBase64Text = (value) => {
    if (!value) {
      return '';
    }
    try {
      return window.atob(value);
    } catch (e) {
      return '';
    }
  };

  getHelmErrorMessage = (err, fallbackMessage) =>
    (err && (
      err.msg_show
      || (err.response && err.response.data && err.response.data.msg_show)
      || (err.data && err.data.msg_show)
    )) || fallbackMessage;

  getHelmFormStateKey = (sourceType) => {
    if (sourceType === 'external') {
      return 'helmExternalForm';
    }
    if (sourceType === 'upload') {
      return 'helmUploadForm';
    }
    return 'helmForm';
  };

  getHelmFormState = (sourceType) => this.state[this.getHelmFormStateKey(sourceType)] || {};

  updateHelmFormState = (sourceType, patch) => {
    const stateKey = this.getHelmFormStateKey(sourceType);
    this.setState(prevState => ({
      [stateKey]: {
        ...(prevState[stateKey] || {}),
        ...patch,
      },
    }));
  };

  buildHelmPreviewResetState = (extra = {}) => ({
    helmPreviewData: null,
    helmPreviewFileKey: '',
    helmPreviewStatus: 'idle',
    helmPreviewError: '',
    helmConfigVisible: false,
    ...extra,
  });

  applyHelmPreview = (preview, sourceType, callback) => {
    const valuesMap = (preview && preview.values) || {};
    const firstKey = getPreferredHelmValuesFileKey(valuesMap);
    const decodedValues = firstKey ? this.decodeBase64Text(valuesMap[firstKey]) : '';
    const formStateKey = this.getHelmFormStateKey(sourceType);
    const nextState = {
      helmPreviewLoading: false,
      helmPreviewData: preview || null,
      helmPreviewFileKey: firstKey,
      helmPreviewStatus: 'success',
      helmPreviewError: '',
      helmConfigVisible: true,
      helmValuesEditorSourceType: sourceType,
    };
    if (sourceType === 'upload') {
      nextState[formStateKey] = {
        ...this.state[formStateKey],
        version: (preview && preview.version) || this.state.helmUploadForm.version,
        values: decodedValues,
      };
      nextState.helmUploadChartInfo = preview || null;
    } else {
      nextState[formStateKey] = {
        ...this.state[formStateKey],
        values: decodedValues,
      };
    }
    this.setState(nextState, callback);
  };

  fetchHelmChartPreview = (payload, sourceType, callback) => {
    const { dispatch } = this.props;
    this.setState({
      helmPreviewLoading: true,
      helmPreviewData: null,
      helmPreviewFileKey: '',
      helmPreviewStatus: 'checking',
      helmPreviewError: '',
      helmConfigVisible: false,
    });
    dispatch({
      type: 'teamResources/previewHelmChart',
      payload,
      callback: bean => this.applyHelmPreview(bean, sourceType, callback),
      handleError: err => {
        const message = this.getHelmErrorMessage(err, 'Chart 检测失败');
        this.setState({
          helmPreviewLoading: false,
          helmPreviewStatus: 'error',
          helmPreviewError: message,
          helmConfigVisible: false,
          helmValuesEditorVisible: false,
        });
        notification.error({
          message,
        });
      },
    });
  };

  handleHelmPreviewFileChange = (fileKey) => {
    const { helmPreviewData, helmSourceType } = this.state;
    const valuesMap = (helmPreviewData && helmPreviewData.values) || {};
    const decodedValues = fileKey ? this.decodeBase64Text(valuesMap[fileKey]) : '';
    const formStateKey = this.getHelmFormStateKey(helmSourceType);
    const nextState = {
      helmPreviewFileKey: fileKey,
      [formStateKey]: {
        ...this.state[formStateKey],
        values: decodedValues,
      },
    };
    this.setState(nextState);
  };

  fetchHelmUploadStatusAndInfo = () => {
    const { dispatch } = this.props;
    const { teamName, regionName } = this.getParams();
    const { helmUploadEventId } = this.state;
    if (!helmUploadEventId) {
      return;
    }
    dispatch({
      type: 'createApp/createJarWarUploadStatus',
      payload: {
        region: regionName,
        team_name: teamName,
        event_id: helmUploadEventId,
      },
      callback: data => {
        const existFiles = (data && data.bean && data.bean.package_name) || [];
        this.setState({
          helmUploadExistFiles: existFiles,
          helmUploadLoading: false,
          ...this.buildHelmPreviewResetState(),
        });
      },
      handleError: err => {
        notification.error({
          message: (err && err.msg_show) || '读取上传状态失败',
        });
      },
    });
  };

  handleHelmUploadChange = info => {
    let fileList = info.fileList || [];
    fileList = fileList.filter(file => {
      if (file.response) {
        return file.response.msg === 'success';
      }
      return true;
    });
    this.setState({ helmUploadFileList: fileList });
    if (info.file && info.file.status === 'done') {
      this.fetchHelmUploadStatusAndInfo();
    }
    if (info.file && info.file.status === 'error') {
      notification.error({
        message: 'Chart 包上传失败',
      });
    }
  };

  handleHelmUploadRemove = () => {
    const { dispatch } = this.props;
    const { teamName } = this.getParams();
    const { helmUploadEventId, helmModalMode, helmTargetRelease } = this.state;
    if (!helmUploadEventId) {
      return;
    }
    dispatch({
      type: 'createApp/deleteJarWarUploadStatus',
      payload: {
        team_name: teamName,
        event_id: helmUploadEventId,
      },
      callback: () => {
        this.setState({
          helmUploadFileList: [],
          helmUploadExistFiles: [],
          helmUploadChartInfo: null,
          ...this.buildHelmPreviewResetState(),
          helmUploadForm: {
            version: '',
            release_name: helmModalMode === 'upgrade' && helmTargetRelease ? helmTargetRelease.name : '',
            values: '',
          },
        });
        this.initHelmUploadSession();
      },
      handleError: err => {
        notification.error({
          message: (err && err.msg_show) || '删除上传包失败',
        });
      },
    });
  };

  openHelmValuesEditor = (sourceType) => {
    this.setState({
      helmValuesEditorVisible: true,
      helmValuesEditorSourceType: sourceType,
    });
  };

  closeHelmValuesEditor = () => {
    this.setState({ helmValuesEditorVisible: false });
  };

  getHelmUpgradeRisk = (payload) => {
    const { helmModalMode, helmTargetRelease } = this.state;
    if (helmModalMode !== 'upgrade' || !helmTargetRelease) {
      return null;
    }
    const currentChart = (helmTargetRelease.chart || '').trim();
    const previewChart = (((this.state.helmPreviewData || {}).name) || '').trim();
    if (!currentChart || !previewChart || currentChart === previewChart) {
      return null;
    }
    return {
      currentChart,
      previewChart,
      payload,
    };
  };

  confirmHelmRiskAndSubmit = (risk, submit) => {
    Modal.confirm({
      title: '检测到跨 Chart 升级风险',
      okText: '明确确认并继续',
      cancelText: '取消',
      width: 620,
      content: (
        <div style={{ color: '#495464', lineHeight: '24px' }}>
          <div>当前 Release Chart：<strong>{risk.currentChart}</strong></div>
          <div>目标升级 Chart：<strong>{risk.previewChart}</strong></div>
          <div style={{ marginTop: 12 }}>
            Helm upgrade 不会自动清理旧资源，这种跨 Chart 升级可能导致：
          </div>
          <div>1. 新旧应用资源混合运行</div>
          <div>2. 流量异常与资源冲突</div>
          <div>3. 回滚失败或结果不可预期</div>
          <div style={{ marginTop: 12 }}>
            更推荐使用 `helm uninstall + helm install` 完成替换，或使用新的 release 名称部署。
          </div>
          <div style={{ marginTop: 12, color: '#CD0200' }}>
            若你未明确确认，本次升级将被默认拒绝。
          </div>
        </div>
      ),
      onOk: submit,
    });
  };

  handleHelmInstall = () => {
    const { dispatch } = this.props;
    const { teamName, regionName } = this.getParams();
    const {
      helmModalMode,
      helmTargetRelease,
      helmSourceType,
      helmSelectedChart,
      helmCurrentRepo,
      helmForm,
      helmExternalForm,
      helmUploadEventId,
      helmUploadForm,
    } = this.state;
    let payload = null;
    let validationMessage = '';
    const targetReleaseName = (helmModalMode === 'upgrade' && helmTargetRelease && helmTargetRelease.name) || '';

    if (helmSourceType === 'store') {
      if (!helmSelectedChart) {
        validationMessage = '请先选择一个 Helm Chart';
      } else if (!helmForm.release_name || !helmForm.version) {
        validationMessage = '请填写 Release 名称并选择版本';
      } else if (!this.state.helmPreviewData) {
        validationMessage = '请等待 Chart 检测完成';
      } else {
        payload = {
          team: teamName,
          region: regionName,
          source_type: 'store',
          repo_name: helmCurrentRepo,
          release_name: targetReleaseName || helmForm.release_name,
          chart: helmSelectedChart && helmSelectedChart.name,
          version: helmForm.version,
          values: helmForm.values,
        };
      }
    } else if (helmSourceType === 'external') {
      const chartUrl = this.buildHelmExternalChartUrl();
      const isOCI = chartUrl.indexOf('oci://') === 0;
      if (!helmExternalForm.release_name) {
        validationMessage = '请填写 Release 名称';
      } else if (!chartUrl) {
        validationMessage = '请填写 Chart 地址';
      } else if (
        helmExternalForm.auth_type === 'basic'
        && (!helmExternalForm.username || !helmExternalForm.password)
      ) {
        validationMessage = '请选择 Basic 鉴权时填写用户名和密码';
      } else if (!this.state.helmPreviewData) {
        validationMessage = '请先检测 Chart';
      } else {
        payload = {
          team: teamName,
          region: regionName,
          source_type: isOCI ? 'oci' : 'repo',
          chart_url: chartUrl,
          release_name: targetReleaseName || helmExternalForm.release_name,
          values: helmExternalForm.values,
          username: helmExternalForm.auth_type === 'basic' ? helmExternalForm.username : '',
          password: helmExternalForm.auth_type === 'basic' ? helmExternalForm.password : '',
        };
      }
    } else if (helmSourceType === 'upload') {
      if (!helmUploadEventId || !this.state.helmUploadChartInfo) {
        validationMessage = '请先上传并检测 Chart 包';
      } else if (!helmUploadForm.release_name) {
        validationMessage = '请填写 Release 名称';
      } else {
        payload = {
          team: teamName,
          region: regionName,
          source_type: 'upload',
          event_id: helmUploadEventId,
          version: helmUploadForm.version,
          release_name: targetReleaseName || helmUploadForm.release_name,
          values: helmUploadForm.values,
        };
      }
    }

    if (validationMessage) {
      notification.warning({ message: validationMessage });
      return;
    }

    const submitInstall = (nextPayload) => {
      this.setState({ helmInstallLoading: true });
      dispatch({
        type: helmModalMode === 'upgrade' ? 'teamResources/upgradeRelease' : 'teamResources/installRelease',
        payload: nextPayload,
        callback: () => {
          this.setState({ helmModalVisible: false, helmInstallLoading: false });
          this.fetchTabData('helm');
        },
        handleError: err => {
          this.setState({ helmInstallLoading: false });
          notification.error({
            message: this.getHelmErrorMessage(err, helmModalMode === 'upgrade' ? '升级失败' : '安装失败'),
          });
        },
      });
    };

    const risk = this.getHelmUpgradeRisk(payload);
    if (risk) {
      this.confirmHelmRiskAndSubmit(risk, () => submitInstall({
        ...payload,
        allow_chart_replace: true,
      }));
      return;
    }

    submitInstall(payload);
  };

  handleHelmHistoryClose = () => {
    this.setState({
      helmHistoryVisible: false,
      helmHistoryLoading: false,
      helmHistoryRelease: null,
      helmHistoryList: [],
      helmRollbackLoading: false,
    });
  };

  handleHelmModalClose = () => {
    this.setState({
      helmModalVisible: false,
      helmValuesEditorVisible: false,
    });
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

  handleHelmRollback = (releaseName, revision) => {
    const { dispatch } = this.props;
    const { teamName, regionName } = this.getParams();
    this.setState({ helmRollbackLoading: true });
    dispatch({
      type: 'teamResources/rollbackRelease',
      payload: { team: teamName, region: regionName, release_name: releaseName, revision },
      callback: () => {
        this.setState({ helmRollbackLoading: false, helmHistoryVisible: false });
        this.fetchTabData('helm');
      },
      handleError: err => {
        this.setState({ helmRollbackLoading: false });
        notification.error({
          message: this.getHelmErrorMessage(err, '回滚失败'),
        });
      },
    });
  };

  handleDeleteResource = (record) => {
    const { dispatch } = this.props;
    const { teamName, regionName } = this.getParams();
    const { activeTab } = this.state;
    const resourceParams = this.getRecordResourceParams(record, activeTab);
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
      ? null
      : { label: '新建资源', onClick: this.openCreateChooser };

    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyStateIcon}>
          <Icon type={meta.icon} />
        </div>
        <div className={styles.emptyStateTitle}>{meta.emptyTitle}</div>
        <div className={styles.emptyStateDescription}>{meta.emptyDescription}</div>
        <div className={styles.emptyStateActions}>
          {primaryAction && (
            <Button type="primary" onClick={primaryAction.onClick}>
              {primaryAction.label}
            </Button>
          )}
          <span className={styles.emptyStateHint}>{meta.emptyHint}</span>
        </div>
      </div>
    );
  };

  renderSidebarNav = () => {
    const { activeTab } = this.state;
    const activeDataLength = this.getActiveData().length;

    return (
      <aside className={styles.sidebar}>
        <div className={styles.sidebarGroupTitle}>资源导航</div>
        <div className={styles.sidebarGroupItems}>
          {TAB_ORDER.map(tab => {
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
            <div className={styles.sectionHeroCopy}>
              <div className={styles.sectionHeroTitleRow}>
                <h2 className={styles.sectionHeroTitle}>{meta.title}</h2>
                <div className={styles.summaryBar}>
                  {summaryItems.map(item => (
                    <span key={item.label} className={`${styles.summaryItem} ${item.tone}`}>
                      <span className={styles.summaryItemLabel}>{item.label}</span>
                      <strong>{item.value}</strong>
                    </span>
                  ))}
                </div>
              </div>
              <p className={styles.sectionHeroDescription}>{meta.description}</p>
            </div>
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
              {yamlModalMode === 'edit' ? '编辑 YAML' : '创建 YAML 资源'}
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

  getTableScroll = (columns) => ({
    x: columns.reduce(
      (width, column) =>
        width + (typeof column.width === 'number' ? column.width : DEFAULT_TABLE_COLUMN_WIDTH),
      0
    ),
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
        width: 240,
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
        width: 140,
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
        width: 120,
        render: v => <STATUS_DOT status={v} />,
      },
      {
        title: '副本/容量',
        dataIndex: 'replicas',
        key: 'replicas',
        width: 120,
        render: (v, record) => {
          const ready = record.ready_replicas !== undefined ? record.ready_replicas : v;
          const total = v;
          if (total === undefined) return '-';
          const color = ready < total ? '#F69D4A' : '#00D777';
          return <span style={{ color, fontWeight: 500 }}>{ready}/{total}</span>;
        },
      },
      { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 180, render: v => <span style={{ color: '#8d9bad', fontSize: 12 }}>{v || '-'}</span> },
      {
        title: '操作',
        key: 'action',
        width: 140,
        render: (_, record) => (
          <span>
            <a style={{ color: '#155aef' }} onClick={() => this.jumpToWorkloadDetail(record)}>详情</a>
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
          scroll={this.getTableScroll(columns)}
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
        width: 220,
        render: (text, record) => <span style={{ color: '#155aef', fontWeight: 500, cursor: 'pointer' }} onClick={() => this.jumpToPodDetail(record)}>{text}</span>
      },
      { title: '状态', dataIndex: 'status', key: 'status', width: 120, render: v => <STATUS_DOT status={v} /> },
      { title: '节点', dataIndex: 'node', key: 'node', width: 180, render: v => v || <span style={{ color: '#8d9bad' }}>-</span> },
      { title: '重启次数', dataIndex: 'restart_count', key: 'restart_count', width: 90, align: 'center', render: v => v !== undefined ? <span style={{ color: v > 3 ? '#FC481B' : '#495464' }}>{v}</span> : '-' },
      { title: '所属工作负载', dataIndex: 'owner', key: 'owner', width: 180, render: v => v || <span style={{ color: '#8d9bad' }}>-</span> },
      { title: 'IP', dataIndex: 'pod_ip', key: 'pod_ip', width: 150, render: v => <code style={{ fontSize: 12 }}>{v || '-'}</code> },
      { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 180, render: v => <span style={{ color: '#8d9bad', fontSize: 12 }}>{v || '-'}</span> },
      {
        title: '操作',
        key: 'action',
        width: 140,
        render: (_, record) => (
          <span>
            <a style={{ color: '#155aef' }} onClick={() => this.jumpToPodDetail(record)}>详情</a>
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
        {this.renderResourceToolbar(null, '搜索容器组名称...')}
        <Table
          className={styles.resourceTable}
          dataSource={data}
          columns={columns}
          rowKey="name"
          size="middle"
          scroll={this.getTableScroll(columns)}
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
      {
        title: '名称',
        dataIndex: 'name',
        key: 'name',
        width: 220,
        render: (text, record) => (
          <span style={{ color: '#155aef', fontWeight: 500, cursor: 'pointer' }} onClick={() => this.jumpToServiceDetail(record)}>
            {text}
          </span>
        ),
      },
      { title: '类型', dataIndex: 'type', key: 'type', width: 120, render: v => <Tag>{v || 'ClusterIP'}</Tag> },
      { title: 'Cluster IP', dataIndex: 'cluster_ip', key: 'cluster_ip', width: 150, render: v => <code style={{ fontSize: 12 }}>{v || '-'}</code> },
      {
        title: '端口',
        dataIndex: 'ports',
        key: 'ports',
        width: 220,
        render: ports => (Array.isArray(ports) ? ports : []).map((p, i) => (
          <Tag key={i} color="geekblue" style={{ fontSize: 11 }}>{p.port}/{p.protocol || 'TCP'}</Tag>
        )),
      },
      { title: '选择器', dataIndex: 'selector', key: 'selector', width: 220, render: v => v ? Object.entries(v).map(([k, val]) => <Tag key={k} style={{ fontSize: 11 }}>{k}={val}</Tag>) : <span style={{ color: '#8d9bad' }}>-</span> },
      { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 180, render: v => <span style={{ color: '#8d9bad', fontSize: 12 }}>{v || '-'}</span> },
      {
        title: '操作',
        key: 'action',
        width: 140,
        render: (_, record) => (
          <span>
            <a style={{ color: '#676f83' }} onClick={() => this.handleOpenResourceYaml(record, { group: '', version: 'v1', resource: 'services' })}>编辑</a>
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
          scroll={this.getTableScroll(columns)}
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
      {
        title: '名称',
        dataIndex: 'name',
        key: 'name',
        width: 220,
        render: (text, record) => (
          <span
            style={{ color: '#155aef', fontWeight: 500, cursor: 'pointer' }}
            onClick={() => this.handleOpenResourceYaml(record, this.getRecordResourceParams(record, 'config'))}
          >
            {text}
          </span>
        )
      },
      { title: '类型', dataIndex: 'kind', key: 'kind', width: 140, render: v => <Tag color={v === 'Secret' ? 'orange' : 'cyan'}>{v || 'ConfigMap'}</Tag> },
      { title: '数据条目数', dataIndex: 'data_count', key: 'data_count', width: 120, align: 'center', render: v => v !== undefined ? v : '-' },
      { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 180, render: v => <span style={{ color: '#8d9bad', fontSize: 12 }}>{v || '-'}</span> },
      {
        title: '操作', key: 'action', width: 140,
        render: (_, record) => (
          <span>
            <a style={{ color: '#676f83' }} onClick={() => this.handleOpenResourceYaml(record, this.getRecordResourceParams(record, 'config'))}>编辑</a>
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
        {this.renderResourceToolbar(null, '搜索配置资源名称...')}
        <Table
          className={styles.resourceTable}
          dataSource={data}
          columns={columns}
          rowKey="name"
          size="middle"
          scroll={this.getTableScroll(columns)}
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
      { title: '名称', dataIndex: 'name', key: 'name', width: 220, render: (text, record) => <span style={{ color: '#155aef', fontWeight: 500, cursor: 'pointer' }} onClick={() => this.handleOpenResourceYaml(record, { group: '', version: 'v1', resource: 'persistentvolumeclaims' })}>{text}</span> },
      {
        title: '状态', dataIndex: 'status', key: 'status', width: 120,
        render: v => <STATUS_DOT status={v} />,
      },
      { title: '容量', dataIndex: 'storage', key: 'storage', width: 100, render: v => v ? <Tag color="geekblue">{v}</Tag> : '-' },
      { title: '访问模式', dataIndex: 'access_modes', key: 'access_modes', width: 180, render: modes => (Array.isArray(modes) ? modes : [modes].filter(Boolean)).map(m => <Tag key={m} style={{ fontSize: 11 }}>{m}</Tag>) },
      { title: '存储类', dataIndex: 'storage_class', key: 'storage_class', width: 180, render: v => v || <span style={{ color: '#8d9bad' }}>-</span> },
      { title: '绑定到 PV', dataIndex: 'volume_name', key: 'volume_name', width: 180, render: v => v || <span style={{ color: '#8d9bad' }}>-</span> },
      { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 180, render: v => <span style={{ color: '#8d9bad', fontSize: 12 }}>{v || '-'}</span> },
      {
        title: '操作',
        key: 'action',
        width: 140,
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
          scroll={this.getTableScroll(columns)}
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
        width: 220,
        render: (text, record) => (
          <span style={{ color: '#155aef', fontWeight: 500, cursor: 'pointer' }} onClick={() => this.jumpToHelmDetail(record)}>
            {text}
          </span>
        ),
      },
      {
        title: 'Chart',
        dataIndex: 'chart',
        key: 'chart',
        width: 240,
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
        width: 120,
        render: v => <STATUS_DOT status={v} />,
      },
      { title: '版本号', dataIndex: 'version', key: 'version', width: 100, align: 'center', render: v => v || '-' },
      { title: '命名空间', dataIndex: 'namespace', key: 'namespace', width: 180, render: v => <code style={{ fontSize: 12 }}>{v || '-'}</code> },
      { title: '更新时间', dataIndex: 'updated', key: 'updated', width: 180, render: v => <span style={{ color: '#8d9bad', fontSize: 12 }}>{v || '-'}</span> },
      {
        title: '操作',
        key: 'action',
        width: 140,
        render: (_, record) => (
          <span>
            <a style={{ color: '#155aef' }} onClick={() => this.jumpToHelmDetail(record)}>详情</a>
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
          scroll={this.getTableScroll(columns)}
          pagination={this.getTablePagination(data)}
          locale={{ emptyText: this.renderEmptyState('helm') }}
        />
      </div>
    );
  }

  renderHelmUpgradeAssistant() {
    const {
      helmModalMode,
      helmTargetRelease,
    } = this.state;
    if (helmModalMode !== 'upgrade') {
      return null;
    }
    return (
      <div style={{
        marginBottom: 16,
        padding: '14px 16px',
        borderRadius: 8,
        border: '1px solid #d9e6ff',
        background: '#f7faff',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#495464' }}>
              升级 Release：{(helmTargetRelease && helmTargetRelease.name) || '-'}
            </div>
            <div style={{ marginTop: 4, fontSize: 12, color: '#8d9bad' }}>
              当前 Chart：{(helmTargetRelease && helmTargetRelease.chart) || '-'}
              <span style={{ marginLeft: 8 }}>
                当前版本：{(helmTargetRelease && helmTargetRelease.chart_version) || '-'}
              </span>
            </div>
          </div>
        </div>
        <div style={{ marginTop: 10, fontSize: 12, color: '#6f7b8f', lineHeight: '20px' }}>
          请从 Helm 商店、第三方仓库 / OCI 或上传 Chart 包中手动选择目标应用与版本进行升级。
        </div>
      </div>
    );
  }

  // ─── Helm 弹窗内容 ────────────────────────────────────────────────────────

  renderHelmBrowse() {
    const {
      helmRepos, helmRepoLoading, helmCurrentRepo,
      helmCharts, helmChartLoading, helmChartSearch,
      helmChartPage, helmChartPageSize, helmChartTotal,
      helmSelectedChart, helmPreviewStatus, helmPreviewLoading, helmPreviewData, helmPreviewError,
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
          <div style={{
            marginBottom: 12,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
          }}>
            <Input.Search
              placeholder="搜索 Chart 名称..."
              value={helmChartSearch}
              onChange={e => this.handleHelmChartSearch(e.target.value)}
              onSearch={this.handleHelmChartSearch}
              allowClear
              size="small"
              style={{ width: 240 }}
            />
            {helmSelectedChart && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                maxWidth: 'calc(100% - 252px)',
                padding: '6px 10px',
                borderRadius: 999,
                border: '1px solid #e8eef9',
                background: '#fafcff',
                fontSize: 12,
                lineHeight: '18px',
              }}>
                <span style={{
                  color: '#495464',
                  fontWeight: 500,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  已选 {helmSelectedChart.name}
                </span>
                <span style={{
                  color: helmPreviewStatus === 'error'
                    ? '#FC481B'
                    : helmPreviewLoading
                      ? '#155aef'
                      : helmPreviewData
                        ? '#18B633'
                        : '#8d9bad',
                  whiteSpace: 'nowrap',
                }}>
                  {helmPreviewStatus === 'error'
                    ? '检测失败'
                    : helmPreviewLoading
                      ? '检测中...'
                      : helmPreviewData
                        ? '可下一步'
                        : '已选择'}
                </span>
              </div>
            )}
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
                  const selected = helmSelectedChart && helmSelectedChart.name === chart.name;
                  return (
                    <List.Item style={{ marginBottom: 8 }}>
                      <Card
                        size="small"
                        hoverable
                        onClick={() => this.handleHelmChartSelect(chart)}
                        bodyStyle={{ padding: '12px 14px' }}
                        style={{
                          cursor: 'pointer',
                          borderRadius: 6,
                          border: selected ? '1px solid #155aef' : '1px solid #eef0f5',
                          boxShadow: selected ? '0 0 0 3px rgba(21,90,239,0.08)' : 'none',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
                          <Avatar
                            shape="square"
                            size={20}
                            src={this.getHelmChartIcon(chart)}
                            icon="appstore"
                            style={{ marginRight: 7, background: 'rgba(21,90,239,0.08)', color: '#155aef' }}
                          />
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
                          {selected && (
                            <Tag color="blue" style={{ marginLeft: 'auto', marginRight: 0, fontSize: 11 }}>
                              已选
                            </Tag>
                          )}
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

  renderHelmBasicForm() {
    const { helmSourceType, helmSelectedChart, helmPreviewData, helmModalMode } = this.state;
    const versions = (helmSelectedChart && helmSelectedChart.versions) || [];
    const currentForm = this.getHelmFormState(helmSourceType);

    return (
      <div>
        {this.renderHelmPreviewHeader()}
        <div style={{
          marginBottom: 16,
          padding: '10px 14px',
          borderRadius: 6,
          border: '1px solid #d9e6ff',
          background: '#f7faff',
          color: '#6f7b8f',
          fontSize: 12,
          lineHeight: '20px',
        }}>
          当前步骤只保留必要的基础安装信息，Values 配置会放到下一步集中处理。
        </div>
        <Form layout="vertical">
          {helmSourceType === 'store' && (
            <Form.Item label="版本" required style={{ marginBottom: 16 }}>
              {versions.length > 0 ? (
                <Select
                  value={currentForm.version}
                  onChange={this.handleHelmStoreVersionChange}
                  style={{ width: '100%' }}
                >
                  {versions.map(ver => (
                    <Option key={ver.version} value={ver.version}>{ver.version}</Option>
                  ))}
                </Select>
              ) : (
                <Input
                  value={currentForm.version}
                  onChange={e => this.updateHelmFormState('store', { version: e.target.value })}
                  placeholder="如：1.2.3"
                />
              )}
            </Form.Item>
          )}
          {helmSourceType === 'upload' && (
            <Form.Item label="版本" style={{ marginBottom: 16 }}>
              <Input
                value={currentForm.version || (helmPreviewData && helmPreviewData.version) || ''}
                onChange={e => this.updateHelmFormState('upload', { version: e.target.value })}
                placeholder="默认使用解析出的版本"
              />
            </Form.Item>
          )}
          <Form.Item label="Release 名称" required style={{ marginBottom: 16 }}>
            <Input
              value={currentForm.release_name}
              onChange={e => this.updateHelmFormState(helmSourceType, { release_name: e.target.value })}
              disabled={helmModalMode === 'upgrade'}
              placeholder={
                helmSourceType === 'external'
                  ? '如：thirdparty-nginx'
                  : '如：my-nginx（小写字母、数字、连字符）'
              }
            />
          </Form.Item>
        </Form>
        {!helmPreviewData && (
          this.renderHelmDetectState() || (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="请先在上一步完成 Chart 检测" />
          )
        )}
      </div>
    );
  }

  renderHelmPreviewHeader() {
    const {
      helmSourceType,
      helmSelectedChart,
      helmPreviewData,
      helmCurrentRepo,
      helmForm,
      helmUploadForm,
    } = this.state;
    const preview = helmPreviewData || {};
    const chartName = preview.name || (helmSelectedChart && helmSelectedChart.name) || 'Helm Chart';
    const chartDesc = preview.description || (helmSelectedChart && helmSelectedChart.description) || '';
    const chartVersion = preview.version
      || (helmSourceType === 'store' && helmForm.version)
      || (helmSourceType === 'upload' && helmUploadForm.version)
      || (helmSelectedChart && helmSelectedChart.versions && helmSelectedChart.versions[0] && helmSelectedChart.versions[0].version)
      || '-';
    const chartIcon = this.getHelmChartIcon(helmSelectedChart) || preview.icon;
    const keywords = preview.keywords || [];
    if (!preview.name && !helmSelectedChart) {
      return null;
    }
    const sourceLabel = helmSourceType === 'store'
      ? `仓库：${helmCurrentRepo || '-'}`
      : helmSourceType === 'external'
        ? `来源：${this.buildHelmExternalChartUrl() || '-'}`
        : `上传会话：${this.state.helmUploadEventId || '-'}`;

    return (
      <Card size="small" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <Avatar
            shape="square"
            size={48}
            src={chartIcon}
            icon="appstore"
            style={{ background: 'rgba(21,90,239,0.08)', color: '#155aef', flexShrink: 0 }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#495464', marginBottom: 4 }}>
              {chartName}
            </div>
            {chartDesc && (
              <div style={{ fontSize: 13, color: '#6f7b8f', lineHeight: '22px', marginBottom: 8 }}>
                {chartDesc}
              </div>
            )}
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 12, color: '#8d9bad' }}>
              <span>{sourceLabel}</span>
              <span>版本号 {chartVersion}</span>
              {keywords.length > 0 && (
                <span>
                  关键字
                  <span style={{ marginLeft: 8 }}>
                    {keywords.slice(0, 3).map(item => (
                      <Tag key={item} style={{ marginRight: 6 }}>{item}</Tag>
                    ))}
                  </span>
                </span>
              )}
            </div>
          </div>
        </div>
      </Card>
    );
  }

  renderHelmDetectState() {
    const { helmPreviewStatus, helmPreviewError } = this.state;
    if (helmPreviewStatus === 'checking') {
      return (
        <Card>
          <Result
            type="ing"
            title="应用包检验中"
            description="应用包检验中，请耐心等候..."
            style={{ marginTop: 36, marginBottom: 12 }}
          />
        </Card>
      );
    }
    if (helmPreviewStatus === 'success') {
      return (
        <Card>
          <Result
            type="success"
            title="应用包检验成功"
            description="应用包检验成功，可点击下一步继续填写安装参数。"
            style={{ marginTop: 36, marginBottom: 12 }}
          />
        </Card>
      );
    }
    if (helmPreviewStatus === 'error') {
      return (
        <Card>
          <Result
            type="error"
            title="应用包检验失败"
            description={helmPreviewError || 'Chart 检测失败，请检查地址、权限或 Chart 内容。'}
            style={{ marginTop: 36, marginBottom: 12 }}
          />
        </Card>
      );
    }
    return null;
  }

  renderHelmConfigPanel(sourceType) {
    const { helmPreviewData, helmPreviewFileKey } = this.state;
    const previewValues = (helmPreviewData && helmPreviewData.values) || {};
    const valueFiles = getSortedHelmValuesFileKeys(previewValues);
    const readme = helmPreviewData && this.decodeBase64Text(helmPreviewData.readme);
    const currentForm = this.getHelmFormState(sourceType);
    const emptyValuesHint = !!helmPreviewData && valueFiles.length === 0 && !currentForm.values;

    return (
      <div>
        <Collapse bordered={false} defaultActiveKey={['config']}>
          <Collapse.Panel
            key="config"
            header={(
              <div>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#495464' }}>配置选项</div>
                <div style={{ fontSize: 12, color: '#8d9bad', marginTop: 2 }}>基于 Helm 规范应用配置的查看与设置</div>
              </div>
            )}
          >
            <div style={{ padding: '8px 12px 0' }}>
              {valueFiles.length > 0 && (
                <Form.Item label="Values 文件" style={{ marginBottom: 16 }}>
                  <Select value={helmPreviewFileKey} onChange={this.handleHelmPreviewFileChange}>
                    {valueFiles.map(fileKey => (
                      <Option key={fileKey} value={fileKey}>{fileKey}</Option>
                    ))}
                  </Select>
                </Form.Item>
              )}
              {emptyValuesHint && (
                <div style={{
                  marginBottom: 16,
                  padding: '10px 12px',
                  borderRadius: 6,
                  border: '1px solid #ffe7ba',
                  background: '#fffbe6',
                  color: '#8c6d1f',
                  fontSize: 12,
                  lineHeight: '20px',
                }}>
                  当前 Chart 没有返回可展示的 values.yaml，你可以直接在下面手动填写 YAML。
                </div>
              )}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 8,
                gap: 12,
              }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: '#495464' }}>values.yaml</div>
                <Button size="small" onClick={() => this.openHelmValuesEditor(sourceType)}>
                  <Icon type="arrows-alt" />放大编辑
                </Button>
              </div>
              <Form.Item style={{ marginBottom: 16 }}>
                <TextArea
                  rows={12}
                  value={currentForm.values}
                  onChange={e => {
                    const nextValues = e.target.value;
                    this.updateHelmFormState(sourceType, { values: nextValues });
                  }}
                  placeholder={emptyValuesHint
                    ? '当前 Chart 未返回 values.yaml，请按需手动填写 YAML'
                    : 'Chart 检测完成后会在这里展示真实 values.yaml'}
                  style={{
                    fontFamily: 'SFMono-Regular, Consolas, Liberation Mono, Menlo, monospace',
                    fontSize: 13,
                    lineHeight: '22px',
                    minHeight: 280,
                    resize: 'vertical',
                    background: '#1f2329',
                    color: '#e6edf3',
                    border: '1px solid #3b4552',
                  }}
                />
              </Form.Item>
            </div>
          </Collapse.Panel>
          {readme && (
            <Collapse.Panel
              key="readme"
              header={(
                <div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: '#495464' }}>应用说明</div>
                  <div style={{ fontSize: 12, color: '#8d9bad', marginTop: 2 }}>来自 Chart README 的原始内容</div>
                </div>
              )}
            >
              <div style={{
                padding: '12px',
                whiteSpace: 'pre-wrap',
                fontSize: 12,
                color: '#6f7b8f',
                lineHeight: '20px',
                maxHeight: 240,
                overflowY: 'auto',
              }}>
                {readme}
              </div>
            </Collapse.Panel>
          )}
        </Collapse>
      </div>
    );
  }

  renderHelmSourceTabs() {
    const { helmSourceType } = this.state;
    const tabs = [
      { key: 'store', label: 'Helm 商店', helper: '从已配置仓库中选择 Chart' },
      { key: 'external', label: '第三方仓库 / OCI', helper: '支持官方、自建 Repo 与 OCI' },
      { key: 'upload', label: '上传 Chart 包', helper: '上传 .tgz 后直接安装 Release' },
    ];

    return (
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        {tabs.map(tab => {
          const active = helmSourceType === tab.key;
          return (
            <div
              key={tab.key}
              onClick={() => this.handleHelmSourceChange(tab.key)}
              style={{
                flex: 1,
                cursor: 'pointer',
                borderRadius: 10,
                border: active ? '1px solid #b4c8ff' : '1px solid #eef0f5',
                background: active ? '#f6f9ff' : '#fff',
                padding: '12px 14px',
                transition: 'all 0.2s',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600, color: active ? '#155aef' : '#495464' }}>
                {tab.label}
              </div>
              <div style={{ marginTop: 4, fontSize: 12, color: '#8d9bad', lineHeight: '18px' }}>
                {tab.helper}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  renderHelmStepNavigation() {
    const steps = this.getHelmWizardSteps();
    const currentIndex = this.getHelmStepIndex();
    const currentStep = steps[currentIndex] || steps[0];

    return (
      <div style={{ marginBottom: 18 }}>
        <Steps current={currentIndex} size="small">
          {steps.map(step => (
            <Step key={step.key} title={step.title} />
          ))}
        </Steps>
        <div style={{ marginTop: 10, fontSize: 12, color: '#8d9bad', lineHeight: '20px' }}>
          {currentStep && currentStep.helper}
        </div>
      </div>
    );
  }

  renderHelmExternalSourceForm() {
    const { helmExternalForm, helmPreviewStatus } = this.state;
    const isBasicAuth = helmExternalForm.auth_type === 'basic';
    const authButtonStyle = active => ({
      minWidth: 96,
      borderColor: active ? '#155aef' : '#d9e1f2',
      background: active ? '#155aef' : '#fff',
      color: active ? '#fff' : '#495464',
      boxShadow: 'none',
    });

    return (
      <div>
        <div style={{
          background: '#f7f9ff',
          border: '1px solid #d0dbff',
          borderRadius: 6,
          padding: '10px 14px',
          marginBottom: 20,
          fontSize: 12,
          color: '#6f7b8f',
          lineHeight: '20px',
        }}>
          请直接填写 Chart 地址，支持 Helm 官方或自建 Helm Repo 中的 Chart 包地址，以及使用 OCI 格式的制品仓库。点击下一步后会自动检测并解析 Chart。
        </div>
        <Form layout="vertical">
          <Form.Item label="Chart 地址" required style={{ marginBottom: 8 }}>
            <Input.Group compact>
              <Select
                value={helmExternalForm.chart_protocol}
                onChange={value => this.handleHelmExternalFieldChange('chart_protocol', value)}
                style={{ width: 120 }}
              >
                <Option value="https://">https://</Option>
                <Option value="http://">http://</Option>
                <Option value="oci://">oci://</Option>
              </Select>
              <Input
                value={helmExternalForm.chart_address}
                onChange={e => this.handleHelmExternalFieldChange('chart_address', e.target.value)}
                style={{ width: 'calc(100% - 120px)' }}
                placeholder={
                  helmExternalForm.chart_protocol === 'oci://'
                    ? 'registry-1.docker.io/bitnamicharts/nginx:15.9.0'
                    : 'charts.bitnami.com/bitnami/nginx-15.9.0.tgz'
                }
              />
            </Input.Group>
          </Form.Item>
          <div style={{ marginBottom: 18, fontSize: 12, color: '#8d9bad', lineHeight: '20px' }}>
            支持 Helm 官方或自建 Helm Repo 仓库，以及使用 OCI 格式的制品仓库。
          </div>
          <Form.Item label="鉴权方式" required style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 12 }}>
              <Button
                style={authButtonStyle(helmExternalForm.auth_type === 'none')}
                onClick={() => this.handleHelmExternalFieldChange('auth_type', 'none')}
              >
                None
              </Button>
              <Button
                style={authButtonStyle(helmExternalForm.auth_type === 'basic')}
                onClick={() => this.handleHelmExternalFieldChange('auth_type', 'basic')}
              >
                Basic
              </Button>
            </div>
          </Form.Item>
          {isBasicAuth && (
            <>
              <Form.Item label="用户名" required style={{ marginBottom: 16 }}>
                <Input
                  value={helmExternalForm.username}
                  onChange={e => this.handleHelmExternalFieldChange('username', e.target.value)}
                  placeholder="请输入用户名"
                />
              </Form.Item>
              <Form.Item label="密码" required style={{ marginBottom: 16 }}>
                <Input.Password
                  value={helmExternalForm.password}
                  onChange={e => this.handleHelmExternalFieldChange('password', e.target.value)}
                  placeholder="请输入密码"
                />
              </Form.Item>
            </>
          )}
        </Form>
        {helmPreviewStatus === 'checking' || helmPreviewStatus === 'error'
          ? this.renderHelmDetectState()
          : (
            <div style={{
              padding: '10px 14px',
              borderRadius: 6,
              border: '1px dashed #d9e6ff',
              background: '#fafcff',
              color: '#8d9bad',
              fontSize: 12,
              lineHeight: '20px',
            }}>
              填写完成后点击下一步，系统会自动检测 Chart 并进入安装信息填写。
            </div>
          )}
      </div>
    );
  }

  renderHelmUploadSourceForm() {
    const {
      helmUploadRecord,
      helmUploadFileList,
      helmUploadExistFiles,
      helmPreviewStatus,
    } = this.state;

    return (
      <div>
        <div style={{
          background: '#f7f9ff',
          border: '1px solid #d0dbff',
          borderRadius: 6,
          padding: '10px 14px',
          marginBottom: 20,
          fontSize: 12,
          color: '#6f7b8f',
          lineHeight: '20px',
        }}>
          上传 `.tgz` Chart 包后，点击下一步时系统会自动解析版本与默认 values，并继续安装流程。
        </div>

        <Form layout="vertical">
          <Form.Item label="上传 Chart 包" required style={{ marginBottom: 12 }}>
            <Upload
              name="packageTarFile"
              fileList={helmUploadFileList}
              action={helmUploadRecord && helmUploadRecord.upload_url}
              onChange={this.handleHelmUploadChange}
              onRemove={() => this.setState({ helmUploadFileList: [] })}
              accept=".tgz"
            >
              <Button icon="upload" disabled={!helmUploadRecord || !helmUploadRecord.upload_url}>
                选择 Chart 包
              </Button>
            </Upload>
          </Form.Item>

          {!!helmUploadExistFiles.length && (
            <Form.Item label="已上传文件" style={{ marginBottom: 12 }}>
              <div style={{
                border: '1px solid #eef0f5',
                borderRadius: 6,
                padding: '10px 12px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <div style={{ minWidth: 0 }}>
                  {helmUploadExistFiles.map(item => (
                    <div key={item} style={{ fontSize: 12, color: '#495464', lineHeight: '20px' }}>
                      <Icon type="inbox" style={{ marginRight: 6, color: '#8d9bad' }} />
                      {item}
                    </div>
                  ))}
                </div>
                <Button type="link" style={{ paddingRight: 0 }} onClick={this.handleHelmUploadRemove}>
                  删除
                </Button>
              </div>
            </Form.Item>
          )}

        </Form>
        {helmPreviewStatus === 'checking' || helmPreviewStatus === 'error' ? (
          this.renderHelmDetectState()
        ) : (
          <div style={{
            padding: '10px 14px',
            borderRadius: 6,
            border: '1px dashed #d9e6ff',
            background: '#fafcff',
            color: '#8d9bad',
            fontSize: 12,
            lineHeight: '20px',
          }}>
            上传完成后点击下一步，系统会自动检测 Chart 并进入安装信息填写。
          </div>
        )}
      </div>
    );
  }

  renderHelmModalFooter() {
    const {
      helmModalMode,
      helmSourceType,
      helmStep,
      helmInstallLoading,
      helmPreviewLoading,
    } = this.state;
    const actionText = helmModalMode === 'upgrade' ? '升级' : '安装';
    const isLastStep = helmStep === 'values';
    const nextLoading = helmStep === 'source' && helmSourceType !== 'store' && helmPreviewLoading;

    return (
      <span>
        {helmStep !== 'source' && (
          <Button onClick={this.goToPrevHelmStep} style={{ marginRight: 8 }}>
            <Icon type="left" />上一步
          </Button>
        )}
        <Button onClick={this.handleHelmModalClose} style={{ marginRight: 8 }}>取消</Button>
        {isLastStep ? (
          <Button
            type="primary"
            loading={helmInstallLoading}
            onClick={this.handleHelmInstall}
            disabled={!this.canInstallHelm()}
          >
            {actionText}
          </Button>
        ) : (
          <Button
            type="primary"
            loading={nextLoading}
            onClick={this.goToNextHelmStep}
            disabled={!this.canProceedHelmStep()}
          >
            下一步
          </Button>
        )}
      </span>
    );
  }

  renderHelmSourceStep() {
    const { helmSourceType } = this.state;
    if (helmSourceType === 'store') {
      return this.renderHelmBrowse();
    }
    if (helmSourceType === 'external') {
      return this.renderHelmExternalSourceForm();
    }
    return this.renderHelmUploadSourceForm();
  }

  renderHelmBasicStep() {
    return this.renderHelmBasicForm();
  }

  renderHelmValuesStep() {
    const { helmSourceType, helmModalMode, helmPreviewData } = this.state;

    return (
      <div>
        {this.renderHelmPreviewHeader()}
        <div style={{
          marginBottom: 16,
          padding: '10px 14px',
          borderRadius: 6,
          border: '1px solid #d9e6ff',
          background: '#f7faff',
          color: '#6f7b8f',
          fontSize: 12,
          lineHeight: '20px',
        }}>
          最后一步统一编辑 values.yaml，确认无误后即可直接{helmModalMode === 'upgrade' ? '升级' : '安装'}。
        </div>
        {helmPreviewData
          ? this.renderHelmConfigPanel(helmSourceType)
          : (
            this.renderHelmDetectState() || (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="请先完成 Chart 检测" />
            )
          )}
      </div>
    );
  }

  renderHelmStepContent() {
    const { helmStep } = this.state;
    if (helmStep === 'basic') {
      return this.renderHelmBasicStep();
    }
    if (helmStep === 'values') {
      return this.renderHelmValuesStep();
    }
    return this.renderHelmSourceStep();
  }

  renderHelmHistoryModal() {
    const { helmHistoryVisible, helmHistoryLoading, helmHistoryList, helmHistoryRelease, helmRollbackLoading } = this.state;
    const latestRevision = Math.max.apply(null, [0].concat((helmHistoryList || []).map(item => item.revision || 0)));
    const columns = [
      { title: 'Revision', dataIndex: 'revision', key: 'revision', width: 100 },
      {
        title: 'Chart',
        dataIndex: 'chart',
        key: 'chart',
        width: 220,
        render: (value, record) => (
          <span>
            <span style={{ fontWeight: 500 }}>{value || '-'}</span>
            {record.chart_version && <span style={{ marginLeft: 4, color: '#8d9bad', fontSize: 12 }}>@{record.chart_version}</span>}
          </span>
        ),
      },
      { title: '状态', dataIndex: 'status', key: 'status', width: 120, render: value => <STATUS_DOT status={value} /> },
      { title: '应用版本', dataIndex: 'app_version', key: 'app_version', width: 120, render: value => value || '-' },
      { title: '更新时间', dataIndex: 'updated', key: 'updated', width: 180, render: value => <span style={{ color: '#8d9bad', fontSize: 12 }}>{value || '-'}</span> },
      {
        title: '操作',
        key: 'action',
        width: 120,
        render: (_, record) => (
          record.revision === latestRevision
            ? <span style={{ color: '#b0b7c3' }}>当前版本</span>
            : (
              <Popconfirm
                title={`确认回滚 ${helmHistoryRelease ? helmHistoryRelease.name : ''} 到 revision ${record.revision}？`}
                onConfirm={() => this.handleHelmRollback(helmHistoryRelease.name, record.revision)}
              >
                <a style={{ color: '#155aef' }}>回滚到此版本</a>
              </Popconfirm>
            )
        ),
      },
    ];
    return (
      <Modal
        title={(
          <span>
            <Icon type="history" style={{ marginRight: 8 }} />
            回滚历史 {helmHistoryRelease ? `· ${helmHistoryRelease.name}` : ''}
          </span>
        )}
        visible={helmHistoryVisible}
        footer={<Button onClick={this.handleHelmHistoryClose}>关闭</Button>}
        onCancel={this.handleHelmHistoryClose}
        width={860}
        bodyStyle={{ padding: '16px 24px' }}
      >
        <Table
          loading={helmHistoryLoading || helmRollbackLoading}
          dataSource={helmHistoryList}
          columns={columns}
          rowKey={record => String(record.revision)}
          pagination={false}
          locale={{ emptyText: '暂无可回滚历史版本' }}
        />
      </Modal>
    );
  }

  renderHelmDetailModal() {
    const { helmDetailVisible, helmDetailRelease } = this.state;
    const release = helmDetailRelease || {};
    const sourceInfo = release.source_info || {};
    const upgradeTypeText = sourceInfo.upgrade_mode === 'store_locked'
      ? 'Helm 商店固定升级'
      : '通用升级（第三方仓库 / OCI 或上传 Chart 包）';
    const infoRows = [
      { label: 'Release 名称', value: release.name || '-' },
      {
        label: 'Chart',
        value: (
          <span>
            <span style={{ fontWeight: 500 }}>{release.chart || '-'}</span>
            {release.chart_version ? <span style={{ marginLeft: 6, color: '#8d9bad' }}>@{release.chart_version}</span> : null}
          </span>
        ),
      },
      { label: '应用版本', value: release.app_version || '-' },
      { label: '状态', value: <STATUS_DOT status={release.status} /> },
      { label: 'Revision', value: release.version || '-' },
      { label: '命名空间', value: <code style={{ fontSize: 12 }}>{release.namespace || '-'}</code> },
      { label: '更新时间', value: release.updated || '-' },
      { label: '安装来源', value: sourceInfo.source_type || 'legacy' },
      { label: '升级方式', value: upgradeTypeText },
    ];

    return (
      <Modal
        title={(
          <span>
            <Icon type="profile" style={{ marginRight: 8 }} />
            Helm Release 详情
          </span>
        )}
        visible={helmDetailVisible}
        onCancel={this.closeHelmDetailModal}
        footer={(
          <span>
            <Button
              style={{ marginRight: 8 }}
              onClick={() => {
                const target = helmDetailRelease;
                this.closeHelmDetailModal();
                if (target) {
                  this.openHelmRollbackModal(target);
                }
              }}
            >
              查看回滚历史
            </Button>
            <Button
              type="primary"
              style={{ marginRight: 8 }}
              onClick={() => {
                const target = helmDetailRelease;
                this.closeHelmDetailModal();
                if (target) {
                  this.jumpToHelmDetail(target, { upgrade: 'true' });
                }
              }}
            >
              去升级
            </Button>
            <Button onClick={this.closeHelmDetailModal}>关闭</Button>
          </span>
        )}
        width={720}
      >
        <div style={{
          padding: '14px 16px',
          borderRadius: 8,
          border: '1px solid #e8eef9',
          background: '#fafcff',
          marginBottom: 18,
          color: '#6f7b8f',
          fontSize: 12,
          lineHeight: '20px',
        }}>
          这里展示当前 Release 的基础信息。点击“去升级”会进入详情页，并根据安装来源打开对应的升级内容。
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', rowGap: 14, columnGap: 16 }}>
          {infoRows.map(item => (
            <React.Fragment key={item.label}>
              <div style={{ color: '#8d9bad', fontSize: 12 }}>{item.label}</div>
              <div style={{ color: '#495464', fontSize: 13, lineHeight: '22px' }}>{item.value}</div>
            </React.Fragment>
          ))}
        </div>
      </Modal>
    );
  }

  // ─── 主渲染 ───────────────────────────────────────────────────────────────

  render() {
    const {
      yamlModalVisible,
      yamlContent,
      helmModalVisible,
      helmModalMode,
      helmValuesEditorVisible,
      helmValuesEditorSourceType,
      yamlModalMode,
      helmStep,
    } = this.state;
    const helmEditorForm = this.getHelmFormState(helmValuesEditorSourceType);

    return (
      <div className={styles.page}>
        <div className={styles.workspace}>
          {this.renderSidebarNav()}

          <div className={styles.mainPanel}>
            <Card className={styles.contentCard} bodyStyle={{ padding: 0, height: '100%' }}>
              <div ref={this.contentCardRef} className={styles.contentCardAnchor}>
                {this.renderSectionHero()}
                {this.renderContentHeader()}
                <div className={styles.contentBody}>
                  {this.renderCurrentTab()}
                </div>
              </div>
            </Card>
          </div>
        </div>

        <Modal
          title={this.renderYamlModalHeader()}
          visible={yamlModalVisible}
          onOk={this.handleYamlCreate}
          onCancel={this.closeYamlModal}
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
              {helmModalMode === 'upgrade' ? '升级 Helm Release' : '安装 Helm 应用'}
            </span>
          }
          visible={helmModalVisible}
          footer={this.renderHelmModalFooter()}
          onCancel={this.handleHelmModalClose}
          width={800}
          bodyStyle={{ padding: '16px 24px', minHeight: 560 }}
        >
          {this.renderHelmUpgradeAssistant()}
          {this.renderHelmStepNavigation()}
          {helmStep === 'source' && this.renderHelmSourceTabs()}
          {this.renderHelmStepContent()}
        </Modal>

        <Modal
          title={(
            <span>
              <Icon type="edit" style={{ marginRight: 8 }} />
              放大编辑 values.yaml
            </span>
          )}
          visible={helmValuesEditorVisible}
          onCancel={this.closeHelmValuesEditor}
          footer={<Button onClick={this.closeHelmValuesEditor}>关闭</Button>}
          width={980}
          bodyStyle={{ padding: '16px 24px 24px' }}
          destroyOnClose={false}
        >
          <div style={{
            marginBottom: 12,
            padding: '10px 14px',
            borderRadius: 6,
            border: '1px solid #d9e6ff',
            background: '#f7faff',
            color: '#6f7b8f',
            fontSize: 12,
            lineHeight: '20px',
          }}>
            这里的修改会实时同步到安装表单，你可以在大编辑区里直接调整 values.yaml。
          </div>
          <TextArea
            rows={26}
            value={helmEditorForm.values}
            onChange={e => this.updateHelmFormState(helmValuesEditorSourceType, { values: e.target.value })}
            placeholder="Chart 检测完成后会在这里展示真实 values.yaml"
            style={{
              fontFamily: 'SFMono-Regular, Consolas, Liberation Mono, Menlo, monospace',
              fontSize: 13,
              lineHeight: '22px',
              minHeight: 560,
              resize: 'vertical',
              background: '#1f2329',
              color: '#e6edf3',
              border: '1px solid #3b4552',
            }}
          />
        </Modal>

        {this.renderHelmDetailModal()}
        {this.renderHelmHistoryModal()}
      </div>
    );
  }

}

export default ResourceCenter;
