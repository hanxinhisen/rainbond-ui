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
} from 'antd';

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

@connect(({ teamResources }) => ({
  resources: teamResources.resources,
  helmReleases: teamResources.helmReleases,
  total: teamResources.total,
}))
class ResourceCenter extends PureComponent {
  state = {
    activeTab: 'workload',
    workloadKind: 'deployments',
    workloadKindGroup: 'apps',
    yamlModalVisible: false,
    yamlContent: '',
    helmModalVisible: false,
    helmForm: { repo_name: '', chart: '', version: '', release_name: '', values: '' },
    searchText: '',
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

  handleHelmInstall = () => {
    const { dispatch } = this.props;
    const { teamName, regionName } = this.getParams();
    const { helmForm } = this.state;
    dispatch({
      type: 'teamResources/installRelease',
      payload: { team: teamName, region: regionName, ...helmForm },
      callback: () => {
        this.setState({ helmModalVisible: false, helmForm: { repo_name: '', chart: '', version: '', release_name: '', values: '' } });
        this.fetchTabData('helm');
      },
    });
  };

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
          <Select
            value={workloadKind}
            onChange={this.handleWorkloadKindChange}
            style={{ width: 160 }}
            size="small"
          >
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
          <Button
            type="primary"
            icon="plus"
            onClick={() => { this.fetchTabData('helm'); this.setState({ helmModalVisible: true }); }}
          >
            安装 Helm 应用
          </Button>
        </div>
        <Table dataSource={data} columns={columns} rowKey="name" size="middle"
          pagination={data.length > 10 ? { pageSize: 10, size: 'small' } : false}
          locale={{ emptyText: <div style={{ padding: '40px 0', color: '#8d9bad', textAlign: 'center' }}>暂无 Helm Release</div> }} />
      </div>
    );
  }

  renderTabContent() {
    const { activeTab } = this.state;
    switch (activeTab) {
      case 'workload': return this.renderWorkloadTab();
      case 'pod': return this.renderPodTab();
      case 'network': return this.renderNetworkTab();
      case 'config': return this.renderConfigTab();
      case 'storage': return this.renderStorageTab();
      case 'helm': return this.renderHelmTab();
      default: return null;
    }
  }

  render() {
    const { yamlModalVisible, yamlContent, helmModalVisible, helmForm, activeTab } = this.state;
    const showCreateBtn = activeTab !== 'helm';

    return (
      <div style={{ background: '#f2f4f7', minHeight: '100vh' }}>
        {/* 页头 */}
        <div style={{ background: '#fff', padding: '20px 24px 0', borderBottom: '1px solid #e8eaf0', marginBottom: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div>
              <h2 style={{ color: '#495464', fontSize: 18, fontWeight: 600, margin: 0 }}>资源中心</h2>
              <p style={{ color: '#676f83', fontSize: 13, margin: '4px 0 0' }}>当前团队范围内的资源与 Helm 应用管理</p>
            </div>
            <div style={{ paddingTop: 4 }}>
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
          <Tabs
            activeKey={activeTab}
            onChange={this.handleTabChange}
            style={{ marginBottom: -1 }}
          >
            <TabPane tab={<span><Icon type="deployment-unit" style={{ marginRight: 4 }} />工作负载</span>} key="workload" />
            <TabPane tab={<span><Icon type="appstore" style={{ marginRight: 4 }} />容器组</span>} key="pod" />
            <TabPane tab={<span><Icon type="share-alt" style={{ marginRight: 4 }} />网络</span>} key="network" />
            <TabPane tab={<span><Icon type="setting" style={{ marginRight: 4 }} />配置</span>} key="config" />
            <TabPane tab={<span><Icon type="database" style={{ marginRight: 4 }} />存储</span>} key="storage" />
            <TabPane tab={<span><Icon type="rocket" style={{ marginRight: 4 }} />Helm 应用</span>} key="helm" />
          </Tabs>
        </div>

        {/* 内容区 */}
        <div style={{ padding: '20px 24px' }}>
          <Card bodyStyle={{ padding: '16px 24px' }} style={{ borderRadius: 4, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            {this.renderTabContent()}
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

        {/* 安装 Helm 弹窗 */}
        <Modal
          title={<span><Icon type="rocket" style={{ marginRight: 8 }} />安装 Helm 应用</span>}
          visible={helmModalVisible}
          onOk={this.handleHelmInstall}
          onCancel={() => this.setState({ helmModalVisible: false })}
          width={560}
          okText="安装"
          cancelText="取消"
        >
          <Form layout="vertical">
            <Form.Item label="Repo 名称" required>
              <Input
                value={helmForm.repo_name}
                onChange={e => this.setState({ helmForm: { ...helmForm, repo_name: e.target.value } })}
                placeholder="如: bitnami"
                prefix={<Icon type="database" style={{ color: '#8d9bad' }} />}
              />
            </Form.Item>
            <Form.Item label="Chart 名称" required>
              <Input
                value={helmForm.chart}
                onChange={e => this.setState({ helmForm: { ...helmForm, chart: e.target.value } })}
                placeholder="如: nginx"
              />
            </Form.Item>
            <div style={{ display: 'flex', gap: 16 }}>
              <Form.Item label="版本" style={{ flex: 1 }}>
                <Input
                  value={helmForm.version}
                  onChange={e => this.setState({ helmForm: { ...helmForm, version: e.target.value } })}
                  placeholder="如: 1.2.3"
                />
              </Form.Item>
              <Form.Item label="Release 名称" required style={{ flex: 1 }}>
                <Input
                  value={helmForm.release_name}
                  onChange={e => this.setState({ helmForm: { ...helmForm, release_name: e.target.value } })}
                  placeholder="如: my-nginx"
                />
              </Form.Item>
            </div>
            <Form.Item label="Values（YAML 格式，可选）">
              <TextArea
                rows={6}
                value={helmForm.values}
                onChange={e => this.setState({ helmForm: { ...helmForm, values: e.target.value } })}
                placeholder="replicaCount: 2&#10;image:&#10;  tag: latest"
                style={{ fontFamily: 'monospace', fontSize: 13 }}
              />
            </Form.Item>
          </Form>
        </Modal>
      </div>
    );
  }
}

export default ResourceCenter;
