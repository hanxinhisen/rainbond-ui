import React, { PureComponent } from 'react';
import { connect } from 'dva';
import {
  Tabs,
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
} from 'antd';
import styles from './index.less';

const { TabPane } = Tabs;
const { TextArea } = Input;
const { Option } = Select;

// 每个 Tab 对应的 K8s 资源类型
const TAB_RESOURCE_MAP = {
  workload: { group: 'apps', version: 'v1', resource: 'deployments' },
  pod: { group: '', version: 'v1', resource: 'pods' },
  network: { group: '', version: 'v1', resource: 'services' },
  config: { group: '', version: 'v1', resource: 'configmaps' },
  storage: { group: '', version: 'v1', resource: 'persistentvolumeclaims' },
};

const WORKLOAD_KINDS = [
  { label: 'Deployment', value: 'deployments', group: 'apps' },
  { label: 'StatefulSet', value: 'statefulsets', group: 'apps' },
  { label: 'DaemonSet', value: 'daemonsets', group: 'apps' },
  { label: 'CronJob', value: 'cronjobs', group: 'batch' },
];

const SOURCE_COLORS = { helm: 'purple', yaml: 'blue', manual: 'green', external: 'default' };
const SOURCE_LABELS = { helm: 'Helm 托管', yaml: 'YAML 导入', manual: '手动创建', external: '外部创建' };

const STATUS_DOT = ({ status }) => {
  const map = {
    running: '#00D777', active: '#00D777', bound: '#155aef',
    warning: '#F69D4A', pending: '#F69D4A',
    failed: '#CD0200', terminated: '#CD0200',
    succeeded: '#00D777', completed: '#00D777',
  };
  const s = (status || '').toLowerCase();
  const color = map[s] || '#8d9bad';
  const text = status || '-';
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
    activeTab: 'workload',
    workloadKind: 'deployments',
    workloadKindGroup: 'apps',
    yamlModalVisible: false,
    yamlContent: '',
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
    this.fetchTabData('workload');
  }

  getParams() {
    const { match } = this.props;
    return (match && match.params) || {};
  }

  fetchTabData = (tab, extra = {}) => {
    const { dispatch } = this.props;
    const { teamName, regionName } = this.getParams();
    if (tab === 'helm') {
      dispatch({ type: 'teamResources/fetchHelmReleases', payload: { team: teamName, region: regionName } });
      return;
    }
    const resourceParams = tab === 'workload'
      ? { group: extra.group || 'apps', version: 'v1', resource: extra.resource || 'deployments' }
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
    const found = WORKLOAD_KINDS.find(k => k.value === value);
    const group = found ? found.group : 'apps';
    this.setState({ workloadKind: value, workloadKindGroup: group });
    this.fetchTabData('workload', { resource: value, group });
  };

  handleYamlCreate = () => {
    const { dispatch } = this.props;
    const { teamName, regionName } = this.getParams();
    const { yamlContent, activeTab, workloadKind, workloadKindGroup } = this.state;
    const resourceParams = activeTab === 'workload'
      ? { group: workloadKindGroup, version: 'v1', resource: workloadKind }
      : TAB_RESOURCE_MAP[activeTab] || TAB_RESOURCE_MAP.workload;
    dispatch({
      type: 'teamResources/createResource',
      payload: { team: teamName, region: regionName, source: 'yaml', yaml: yamlContent, ...resourceParams },
      callback: () => {
        this.setState({ yamlModalVisible: false, yamlContent: '' });
        this.fetchTabData(activeTab);
      },
    });
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
            <span style={{ color: '#155aef', fontWeight: 500, cursor: 'pointer' }}>{text}</span>
            {record.source === 'helm' && <Tag color="purple" style={{ marginLeft: 8, fontSize: 11 }}>Helm 托管</Tag>}
          </span>
        ),
      },
      {
        title: 'Kind',
        dataIndex: 'kind',
        key: 'kind',
        width: 130,
        render: v => <code style={{ fontSize: 12, color: '#495464', background: '#f2f4f7', padding: '1px 5px', borderRadius: 2 }}>{v || WORKLOAD_KINDS.find(k => k.value === workloadKind)?.label || '-'}</code>,
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
      {
        title: '来源',
        dataIndex: 'source',
        key: 'source',
        width: 110,
        render: src => src ? <Tag color={SOURCE_COLORS[src] || 'default'} style={{ fontSize: 11 }}>{SOURCE_LABELS[src] || src}</Tag> : '-',
      },
      { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 130, render: v => <span style={{ color: '#8d9bad', fontSize: 12 }}>{v || '-'}</span> },
      {
        title: '操作',
        key: 'action',
        width: 110,
        render: (_, record) => (
          <span>
            <a style={{ color: '#155aef' }}>详情</a>
            {record.source !== 'external' && (
              <>
                <Divider type="vertical" />
                <a style={{ color: '#676f83' }}>YAML</a>
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
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Select value={workloadKind} onChange={this.handleWorkloadKindChange} style={{ width: 160 }} size="small">
            {WORKLOAD_KINDS.map(k => <Option key={k.value} value={k.value}>{k.label}</Option>)}
          </Select>
          <Input.Search
            placeholder="搜索资源名称..."
            style={{ width: 220 }}
            allowClear
            size="small"
            onChange={e => this.setState({ searchText: e.target.value })}
          />
        </div>
        <Table dataSource={data} columns={columns} rowKey="name" size="middle"
          pagination={data.length > 10 ? { pageSize: 10, size: 'small' } : false}
          locale={{ emptyText: <div style={{ padding: '40px 0', color: '#8d9bad', textAlign: 'center' }}>暂无工作负载</div> }} />
      </div>
    );
  }

  renderPodTab() {
    const { resources } = this.props;
    const data = this.getFilteredData(resources || []);
    const columns = [
      { title: '名称', dataIndex: 'name', key: 'name', render: text => <span style={{ color: '#155aef', fontWeight: 500 }}>{text}</span> },
      { title: '状态', dataIndex: 'status', key: 'status', width: 110, render: v => <STATUS_DOT status={v} /> },
      { title: '节点', dataIndex: 'node', key: 'node', render: v => v || <span style={{ color: '#8d9bad' }}>-</span> },
      { title: '重启次数', dataIndex: 'restart_count', key: 'restart_count', width: 90, align: 'center', render: v => v !== undefined ? <span style={{ color: v > 3 ? '#FC481B' : '#495464' }}>{v}</span> : '-' },
      { title: '所属工作负载', dataIndex: 'owner', key: 'owner', render: v => v || <span style={{ color: '#8d9bad' }}>-</span> },
      { title: 'IP', dataIndex: 'pod_ip', key: 'pod_ip', render: v => <code style={{ fontSize: 12 }}>{v || '-'}</code> },
      { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 130, render: v => <span style={{ color: '#8d9bad', fontSize: 12 }}>{v || '-'}</span> },
    ];
    return (
      <Table dataSource={data} columns={columns} rowKey="name" size="middle"
        pagination={data.length > 10 ? { pageSize: 10, size: 'small' } : false}
        locale={{ emptyText: <div style={{ padding: '40px 0', color: '#8d9bad', textAlign: 'center' }}>暂无容器组</div> }} />
    );
  }

  renderNetworkTab() {
    const { resources } = this.props;
    const data = this.getFilteredData(resources || []);
    const columns = [
      { title: '名称', dataIndex: 'name', key: 'name', render: text => <span style={{ color: '#155aef', fontWeight: 500 }}>{text}</span> },
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
    ];
    return (
      <Table dataSource={data} columns={columns} rowKey="name" size="middle"
        pagination={data.length > 10 ? { pageSize: 10, size: 'small' } : false}
        locale={{ emptyText: <div style={{ padding: '40px 0', color: '#8d9bad', textAlign: 'center' }}>暂无网络资源</div> }} />
    );
  }

  renderConfigTab() {
    const { resources } = this.props;
    const data = this.getFilteredData(resources || []);
    const columns = [
      { title: '名称', dataIndex: 'name', key: 'name', render: text => <span style={{ color: '#155aef', fontWeight: 500 }}>{text}</span> },
      { title: '类型', dataIndex: 'kind', key: 'kind', width: 130, render: v => <Tag color={v === 'Secret' ? 'orange' : 'cyan'}>{v || 'ConfigMap'}</Tag> },
      { title: '数据条目数', dataIndex: 'data_count', key: 'data_count', width: 100, align: 'center', render: v => v !== undefined ? v : '-' },
      { title: '来源', dataIndex: 'source', key: 'source', render: src => src ? <Tag color={SOURCE_COLORS[src] || 'default'} style={{ fontSize: 11 }}>{SOURCE_LABELS[src] || src}</Tag> : '-' },
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
      <Table dataSource={data} columns={columns} rowKey="name" size="middle"
        pagination={data.length > 10 ? { pageSize: 10, size: 'small' } : false}
        locale={{ emptyText: <div style={{ padding: '40px 0', color: '#8d9bad', textAlign: 'center' }}>暂无配置资源</div> }} />
    );
  }

  renderStorageTab() {
    const { resources } = this.props;
    const data = this.getFilteredData(resources || []);
    const columns = [
      { title: '名称', dataIndex: 'name', key: 'name', render: text => <span style={{ color: '#155aef', fontWeight: 500 }}>{text}</span> },
      {
        title: '状态', dataIndex: 'status', key: 'status', width: 110,
        render: v => {
          const s = (v || '').toLowerCase();
          const color = s === 'bound' ? '#155aef' : s === 'pending' ? '#F69D4A' : '#8d9bad';
          return <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: color, marginRight: 6 }} /><span style={{ color }}>{v || '-'}</span></span>;
        },
      },
      { title: '容量', dataIndex: 'storage', key: 'storage', width: 100, render: v => v ? <Tag color="geekblue">{v}</Tag> : '-' },
      { title: '访问模式', dataIndex: 'access_modes', key: 'access_modes', render: modes => (Array.isArray(modes) ? modes : [modes].filter(Boolean)).map(m => <Tag key={m} style={{ fontSize: 11 }}>{m}</Tag>) },
      { title: '存储类', dataIndex: 'storage_class', key: 'storage_class', render: v => v || <span style={{ color: '#8d9bad' }}>-</span> },
      { title: '绑定到 PV', dataIndex: 'volume_name', key: 'volume_name', render: v => v || <span style={{ color: '#8d9bad' }}>-</span> },
      { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 130, render: v => <span style={{ color: '#8d9bad', fontSize: 12 }}>{v || '-'}</span> },
    ];
    return (
      <Table dataSource={data} columns={columns} rowKey="name" size="middle"
        pagination={data.length > 10 ? { pageSize: 10, size: 'small' } : false}
        locale={{ emptyText: <div style={{ padding: '40px 0', color: '#8d9bad', textAlign: 'center' }}>暂无存储声明</div> }} />
    );
  }

  renderHelmTab() {
    const { helmReleases } = this.props;
    const { searchText } = this.state;
    const data = searchText
      ? (helmReleases || []).filter(r => (r.name || '').toLowerCase().includes(searchText.toLowerCase()))
      : (helmReleases || []);

    const HELM_STATUS_COLORS = { deployed: '#00D777', failed: '#CD0200', pending: '#F69D4A', superseded: '#8d9bad', uninstalling: '#F69D4A' };
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
        render: v => {
          const color = HELM_STATUS_COLORS[(v || '').toLowerCase()] || '#8d9bad';
          return <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: color, marginRight: 6 }} /><span style={{ color }}>{v || '-'}</span></span>;
        },
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
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Input.Search
            placeholder="搜索 Release 名称..."
            style={{ width: 220 }}
            allowClear
            size="small"
            onChange={e => this.setState({ searchText: e.target.value })}
          />
          <Button type="primary" icon="plus" onClick={this.openHelmInstallModal}>
            安装 Helm 应用
          </Button>
        </div>
        <Table dataSource={data} columns={columns} rowKey="name" size="middle"
          pagination={data.length > 10 ? { pageSize: 10, size: 'small' } : false}
          locale={{ emptyText: <div style={{ padding: '40px 0', color: '#8d9bad', textAlign: 'center' }}>暂无 Helm Release</div> }} />
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
    const { yamlModalVisible, yamlContent, helmModalVisible, helmStep } = this.state;

    return (
      <div style={{ background: '#f2f4f7', minHeight: '100vh' }}>
        {/* 页头 */}
        <div style={{ background: '#fff', padding: '20px 24px', borderBottom: '1px solid #e8eaf0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ color: '#495464', fontSize: 18, fontWeight: 600, margin: 0 }}>资源中心</h2>
              <p style={{ color: '#676f83', fontSize: 13, margin: '4px 0 0' }}>当前团队范围内的资源与 Helm 应用管理</p>
            </div>
            <div>
              <Button
                style={{ marginRight: 8 }}
                onClick={() => this.setState({ yamlModalVisible: true })}
                icon="code"
              >
                YAML 创建
              </Button>
              <Button type="primary" icon="plus">新建资源</Button>
            </div>
          </div>
        </div>

        {/* 内容区 - 竖向 Tab 导航 */}
        <div style={{ padding: '20px 24px' }}>
          <Card
            bodyStyle={{ padding: 0 }}
            style={{ borderRadius: 4, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' }}
          >
            <Tabs
              tabPosition="left"
              activeKey={this.state.activeTab}
              onChange={this.handleTabChange}
              className={styles.verticalTabs}
            >
              <TabPane tab={<span><Icon type="deployment-unit" />工作负载</span>} key="workload">
                <div className={styles.tabContent}>{this.renderWorkloadTab()}</div>
              </TabPane>
              <TabPane tab={<span><Icon type="appstore" />容器组</span>} key="pod">
                <div className={styles.tabContent}>{this.renderPodTab()}</div>
              </TabPane>
              <TabPane tab={<span><Icon type="share-alt" />网络</span>} key="network">
                <div className={styles.tabContent}>{this.renderNetworkTab()}</div>
              </TabPane>
              <TabPane tab={<span><Icon type="setting" />配置</span>} key="config">
                <div className={styles.tabContent}>{this.renderConfigTab()}</div>
              </TabPane>
              <TabPane tab={<span><Icon type="database" />存储</span>} key="storage">
                <div className={styles.tabContent}>{this.renderStorageTab()}</div>
              </TabPane>
              <TabPane tab={<span><Icon type="rocket" />Helm 应用</span>} key="helm">
                <div className={styles.tabContent}>{this.renderHelmTab()}</div>
              </TabPane>
            </Tabs>
          </Card>
        </div>

        {/* YAML 创建弹窗 */}
        <Modal
          title={<span><Icon type="code" style={{ marginRight: 8 }} />YAML 创建资源</span>}
          visible={yamlModalVisible}
          onOk={this.handleYamlCreate}
          onCancel={() => this.setState({ yamlModalVisible: false, yamlContent: '' })}
          width={660}
          okText="创建"
          cancelText="取消"
        >
          <p style={{ color: '#676f83', marginBottom: 8, fontSize: 13 }}>
            粘贴 Kubernetes 资源 YAML 定义，将自动添加来源标签
          </p>
          <TextArea
            rows={18}
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
