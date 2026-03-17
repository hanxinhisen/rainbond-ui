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
  Card,
  Select,
  Icon,
  Spin,
} from 'antd';

const { TabPane } = Tabs;
const { TextArea } = Input;
const { Option } = Select;

// 常用资源类型优先顺序，不在列表中的排到最后（按字母顺序）
const COMMON_RESOURCE_KINDS = [
  'Deployment', 'StatefulSet', 'DaemonSet', 'Job', 'CronJob',
  'Service', 'Ingress', 'ConfigMap', 'Secret',
  'ServiceAccount', 'Role', 'ClusterRole', 'RoleBinding', 'ClusterRoleBinding',
  'HorizontalPodAutoscaler', 'PodDisruptionBudget', 'NetworkPolicy',
  'CustomResourceDefinition',
];

function sortResourceTypes(list) {
  const priority = {};
  COMMON_RESOURCE_KINDS.forEach((k, i) => { priority[k] = i; });
  return [...list].sort((a, b) => {
    const pa = priority[a.kind] !== undefined ? priority[a.kind] : COMMON_RESOURCE_KINDS.length;
    const pb = priority[b.kind] !== undefined ? priority[b.kind] : COMMON_RESOURCE_KINDS.length;
    if (pa !== pb) return pa - pb;
    return (a.kind || '').localeCompare(b.kind || '');
  });
}

const STATUS_MAP = {
  running: { color: '#00D777', text: '运行中' },
  available: { color: '#00D777', text: '可用' },
  bound: { color: '#155aef', text: '已绑定' },
  released: { color: '#F69D4A', text: '已释放' },
  failed: { color: '#CD0200', text: '失败' },
  warning: { color: '#F69D4A', text: '警告' },
};

const StatusDot = ({ status }) => {
  const s = STATUS_MAP[(status || '').toLowerCase()] || { color: '#8d9bad', text: status || '-' };
  return (
    <span>
      <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: s.color, marginRight: 6 }} />
      <span style={{ color: s.color }}>{s.text}</span>
    </span>
  );
};

function formatCreationTime(ts) {
  if (!ts) return '-';
  try {
    const d = new Date(ts);
    return d.toLocaleString('zh-CN', { hour12: false });
  } catch (e) {
    return ts;
  }
}


@connect(({ platformResources }) => ({
  storageClasses: platformResources.storageClasses,
  persistentVolumes: platformResources.persistentVolumes,
  platformResources: platformResources.platformResources,
  resourceInstances: platformResources.resourceInstances,
  storageConfig: platformResources.storageConfig,
}))
class PlatformResources extends PureComponent {
  state = {
    // StorageClass tab
    createModalVisible: false,
    yamlContent: '',
    // StorageConfig tab
    configEditing: false,
    selectedStorageClass: null,
    // Main navigation
    mainTab: 'storage',
    storageSubTab: 'storageclass',
    // PV tab
    pvCreateVisible: false,
    pvCreateYaml: '',
    pvViewModal: { visible: false, content: '', name: '' },
    // 其他资源 tab
    selectedType: null,          // 当前选中的资源类型 {kind,group,version,resource,verbs}
    instancesLoading: false,
    typeSearchText: '',
    instanceSearchText: '',
    // YAML 弹窗 (view / edit / create)
    instanceModal: {
      visible: false,
      mode: 'view',
      name: '', content: '', saving: false,
    },
  };

  componentDidMount() {
    this.fetchStorageClasses();
    this.fetchStorageConfig();
    this.fetchPlatformResources();
  }

  getParams() {
    const { match } = this.props;
    return (match && match.params) || {};
  }

  // ─── fetch helpers ────────────────────────────────────────────────────────

  fetchStorageClasses = () => {
    const { dispatch } = this.props;
    const { eid, regionName } = this.getParams();
    dispatch({ type: 'platformResources/fetchStorageClasses', payload: { eid, region: regionName } });
  };

  fetchPersistentVolumes = () => {
    const { dispatch } = this.props;
    const { eid, regionName } = this.getParams();
    dispatch({ type: 'platformResources/fetchPersistentVolumes', payload: { eid, region: regionName } });
  };

  fetchStorageConfig = () => {
    const { dispatch } = this.props;
    const { eid, regionName } = this.getParams();
    dispatch({ type: 'platformResources/fetchStorageConfig', payload: { eid, region: regionName } });
  };

  fetchPlatformResources = () => {
    const { dispatch } = this.props;
    const { eid, regionName } = this.getParams();
    dispatch({ type: 'platformResources/fetchPlatformResources', payload: { eid, region: regionName } });
  };

  fetchInstancesForType = (type) => {
    const { dispatch } = this.props;
    const { eid, regionName } = this.getParams();
    this.setState({ instancesLoading: true });
    dispatch({
      type: 'platformResources/fetchResourceInstances',
      payload: { eid, region: regionName, group: type.group, version: type.version, resource: type.resource },
      callback: () => this.setState({ instancesLoading: false }),
    });
  };

  fetchInstances = (type) => {
    const { dispatch } = this.props;
    const { eid, regionName } = this.getParams();
    this.setState({ instancesLoading: true });
    dispatch({
      type: 'platformResources/fetchResourceInstances',
      payload: { eid, region: regionName, group: type.group, version: type.version, resource: type.resource },
      callback: () => this.setState({ instancesLoading: false }),
    });
    // fetchResourceInstances always clears loading via the effect's completion
    setTimeout(() => this.setState({ instancesLoading: false }), 5000);
  };

  // ─── StorageClass tab ─────────────────────────────────────────────────────

  handleStorageSubTabChange = (key) => {
    this.setState({ storageSubTab: key });
    if (key === 'pv') this.fetchPersistentVolumes();
    if (key === 'storageconfig') this.fetchStorageClasses();
  };

  handleDeleteStorageClass = (name) => {
    const { dispatch } = this.props;
    const { eid, regionName } = this.getParams();
    dispatch({
      type: 'platformResources/deleteStorageClass',
      payload: { eid, region: regionName, name },
      callback: () => this.fetchStorageClasses(),
    });
  };

  handleCreateConfirm = () => {
    const { dispatch } = this.props;
    const { eid, regionName } = this.getParams();
    const { yamlContent } = this.state;
    dispatch({
      type: 'platformResources/createStorageClass',
      payload: { eid, region: regionName, yaml: yamlContent },
      callback: () => {
        this.setState({ createModalVisible: false, yamlContent: '' });
        this.fetchStorageClasses();
      },
    });
  };

  // ─── StorageConfig tab ────────────────────────────────────────────────────

  handleSaveStorageConfig = () => {
    const { dispatch, storageConfig } = this.props;
    const { eid, regionName } = this.getParams();
    const { selectedStorageClass } = this.state;
    const scName = selectedStorageClass || (storageConfig && storageConfig.default_storage_class);
    dispatch({
      type: 'platformResources/saveStorageConfig',
      payload: { eid, region: regionName, defaultStorageClass: scName },
      callback: () => {
        this.setState({ configEditing: false, selectedStorageClass: null });
        this.fetchStorageConfig();
      },
    });
  };

  // ─── PV tab ───────────────────────────────────────────────────────────────

  handleViewPVYaml = (record) => {
    // Show available fields from the list response as pretty JSON
    const content = JSON.stringify(record, null, 2);
    this.setState({ pvViewModal: { visible: true, content, name: record.name } });
  };

  handleDeletePV = (name) => {
    const { dispatch } = this.props;
    const { eid, regionName } = this.getParams();
    dispatch({
      type: 'platformResources/deletePersistentVolume',
      payload: { eid, region: regionName, name },
      callback: () => this.fetchPersistentVolumes(),
    });
  };

  handleCreatePVConfirm = () => {
    const { dispatch } = this.props;
    const { eid, regionName } = this.getParams();
    const { pvCreateYaml } = this.state;
    dispatch({
      type: 'platformResources/createPersistentVolume',
      payload: { eid, region: regionName, yaml: pvCreateYaml },
      callback: (res, err) => {
        if (!err) {
          this.setState({ pvCreateVisible: false, pvCreateYaml: '' });
          this.fetchPersistentVolumes();
        }
      },
    });
  };

  // ─── 其他资源 tab ─────────────────────────────────────────────────────────

  handleSelectType = (type) => {
    this.setState({ selectedType: type, instanceSearchText: '' });
    this.fetchInstancesForType(type);
  };

  handleBackToTypes = () => {
    const { dispatch } = this.props;
    this.setState({ selectedType: null, instanceSearchText: '' });
    dispatch({ type: 'platformResources/save', payload: { resourceInstances: [] } });
  };

  handleViewInstanceYaml = (record) => {
    const { dispatch } = this.props;
    const { eid, regionName } = this.getParams();
    const { selectedType } = this.state;
    dispatch({
      type: 'platformResources/fetchResourceInstance',
      payload: { eid, region: regionName, group: selectedType.group, version: selectedType.version, resource: selectedType.resource, name: record.metadata.name },
      callback: (bean) => {
        if (bean) this.setState({ instanceModal: { visible: true, mode: 'view', name: record.metadata.name, content: JSON.stringify(bean, null, 2), saving: false } });
      },
    });
  };

  handleEditInstanceYaml = (record) => {
    const { dispatch } = this.props;
    const { eid, regionName } = this.getParams();
    const { selectedType } = this.state;
    dispatch({
      type: 'platformResources/fetchResourceInstance',
      payload: { eid, region: regionName, group: selectedType.group, version: selectedType.version, resource: selectedType.resource, name: record.metadata.name },
      callback: (bean) => {
        if (bean) this.setState({ instanceModal: { visible: true, mode: 'edit', name: record.metadata.name, content: JSON.stringify(bean, null, 2), saving: false } });
      },
    });
  };

  handleSaveInstanceYaml = () => {
    const { dispatch } = this.props;
    const { eid, regionName } = this.getParams();
    const { selectedType, instanceModal } = this.state;
    this.setState({ instanceModal: { ...instanceModal, saving: true } });
    dispatch({
      type: 'platformResources/updateResourceInstance',
      payload: { eid, region: regionName, group: selectedType.group, version: selectedType.version, resource: selectedType.resource, name: instanceModal.name, yaml: instanceModal.content },
      callback: (res, err) => {
        if (!err) {
          this.setState({ instanceModal: { visible: false, mode: 'view', name: '', content: '', saving: false } });
          this.fetchInstancesForType(selectedType);
        } else {
          this.setState({ instanceModal: { ...instanceModal, saving: false } });
        }
      },
    });
  };

  handleOpenCreateInstance = () => {
    const { selectedType } = this.state;
    const apiVersion = selectedType.group ? `${selectedType.group}/${selectedType.version}` : selectedType.version;
    this.setState({
      instanceModal: {
        visible: true, mode: 'create', name: '', saving: false,
        content: `apiVersion: ${apiVersion}\nkind: ${selectedType.kind}\nmetadata:\n  name: ""\n`,
      },
    });
  };

  handleCreateInstanceConfirm = () => {
    const { dispatch } = this.props;
    const { eid, regionName } = this.getParams();
    const { selectedType, instanceModal } = this.state;
    this.setState({ instanceModal: { ...instanceModal, saving: true } });
    dispatch({
      type: 'platformResources/createResourceInstance',
      payload: { eid, region: regionName, group: selectedType.group, version: selectedType.version, resource: selectedType.resource, yaml: instanceModal.content },
      callback: (res, err) => {
        if (!err) {
          this.setState({ instanceModal: { visible: false, mode: 'view', name: '', content: '', saving: false } });
          this.fetchInstancesForType(selectedType);
        } else {
          this.setState({ instanceModal: { ...instanceModal, saving: false } });
        }
      },
    });
  };

  handleDeleteInstance = (record) => {
    const { dispatch } = this.props;
    const { eid, regionName } = this.getParams();
    const { selectedType } = this.state;
    dispatch({
      type: 'platformResources/deletePlatformResource',
      payload: { eid, region: regionName, group: selectedType.group, version: selectedType.version, resource: selectedType.resource, name: record.metadata.name },
      callback: () => this.fetchInstancesForType(selectedType),
    });
  };

  // ─── render helpers ───────────────────────────────────────────────────────

  renderStorageClassTab() {
    const { storageClasses } = this.props;
    const columns = [
      {
        title: '名称',
        dataIndex: 'name',
        key: 'name',
        render: (text, record) => (
          <span>
            <span style={{ color: '#155aef', fontWeight: 500 }}>{text}</span>
            {record.is_default && <Tag color="blue" style={{ marginLeft: 8, fontSize: 11 }}>默认</Tag>}
          </span>
        ),
      },
      {
        title: 'Provisioner',
        dataIndex: 'provisioner',
        key: 'provisioner',
        render: v => <code style={{ fontSize: 12, color: '#495464', background: '#f2f4f7', padding: '1px 4px', borderRadius: 2 }}>{v}</code>,
      },
      { title: '回收策略', dataIndex: 'reclaim_policy', key: 'reclaim_policy', render: v => <Tag>{v || '-'}</Tag> },
      { title: '绑定模式', dataIndex: 'volume_binding_mode', key: 'volume_binding_mode', render: v => v || '-' },
      { title: '存储卷数', dataIndex: 'pv_count', key: 'pv_count', align: 'center' },
      {
        title: '操作',
        key: 'action',
        width: 80,
        render: (_, record) => (
          <Popconfirm title={`确认删除 "${record.name}"？`} onConfirm={() => this.handleDeleteStorageClass(record.name)}>
            <a style={{ color: '#FC481B' }}>删除</a>
          </Popconfirm>
        ),
      },
    ];
    return (
      <div>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
          <Button type="primary" icon="plus" onClick={() => this.setState({ createModalVisible: true })}>
            创建存储类
          </Button>
        </div>
        <Table
          dataSource={storageClasses}
          columns={columns}
          rowKey="name"
          size="middle"
          pagination={storageClasses.length > 10 ? { pageSize: 10, size: 'small' } : false}
          locale={{ emptyText: <div style={{ padding: '40px 0', color: '#8d9bad', textAlign: 'center' }}>暂无存储类</div> }}
        />
      </div>
    );
  }

  renderPVTab() {
    const { persistentVolumes } = this.props;
    const { pvViewModal } = this.state;
    const columns = [
      {
        title: '名称',
        dataIndex: 'name',
        key: 'name',
        render: (text, record) => (
          <a
            style={{ color: '#155aef', fontWeight: 500 }}
            onClick={e => { e.preventDefault(); this.handleViewPVYaml(record); }}
          >
            {text}
          </a>
        ),
      },
      { title: '容量', dataIndex: 'capacity', key: 'capacity', render: v => <Tag color="geekblue">{v || '-'}</Tag> },
      {
        title: '访问模式',
        dataIndex: 'access_modes',
        key: 'access_modes',
        render: modes => {
          const list = Array.isArray(modes) ? modes : [modes].filter(Boolean);
          return list.map(m => <Tag key={m} style={{ fontSize: 11 }}>{m}</Tag>);
        },
      },
      { title: '存储类', dataIndex: 'storage_class', key: 'storage_class', render: v => v || <span style={{ color: '#8d9bad' }}>-</span> },
      { title: '状态', dataIndex: 'status', key: 'status', render: v => <StatusDot status={v} /> },
      { title: '回收策略', dataIndex: 'reclaim_policy', key: 'reclaim_policy', render: v => v || '-' },
      { title: '绑定到', dataIndex: 'claim', key: 'claim', render: v => v || <span style={{ color: '#8d9bad' }}>-</span> },
      {
        title: '操作',
        key: 'action',
        width: 80,
        render: (_, record) => (
          <Popconfirm title={`确认删除存储卷 "${record.name}"？`} onConfirm={() => this.handleDeletePV(record.name)}>
            <a style={{ color: '#FC481B' }}>删除</a>
          </Popconfirm>
        ),
      },
    ];
    return (
      <div>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            type="primary"
            icon="plus"
            onClick={() => this.setState({ pvCreateVisible: true, pvCreateYaml: '' })}
          >
            创建存储卷
          </Button>
        </div>
        <Table
          dataSource={persistentVolumes}
          columns={columns}
          rowKey="name"
          size="middle"
          pagination={persistentVolumes.length > 10 ? { pageSize: 10, size: 'small' } : false}
          locale={{ emptyText: <div style={{ padding: '40px 0', color: '#8d9bad', textAlign: 'center' }}>暂无存储卷</div> }}
        />
        {/* PV YAML 查看弹窗 */}
        <Modal
          title={<span><Icon type="code" style={{ marginRight: 8 }} />存储卷 — {pvViewModal.name}</span>}
          visible={pvViewModal.visible}
          onCancel={() => this.setState({ pvViewModal: { visible: false, content: '', name: '' } })}
          footer={<Button onClick={() => this.setState({ pvViewModal: { visible: false, content: '', name: '' } })}>关闭</Button>}
          width={720}
        >
          <TextArea
            rows={20}
            readOnly
            value={pvViewModal.content}
            style={{ fontFamily: 'monospace', fontSize: 12 }}
          />
        </Modal>
        {/* 创建 PV 弹窗 */}
        <Modal
          title={<span><Icon type="plus" style={{ marginRight: 8 }} />YAML 创建存储卷</span>}
          visible={this.state.pvCreateVisible}
          onOk={this.handleCreatePVConfirm}
          onCancel={() => this.setState({ pvCreateVisible: false, pvCreateYaml: '' })}
          width={640}
          okText="创建"
          cancelText="取消"
        >
          <p style={{ color: '#676f83', marginBottom: 8, fontSize: 13 }}>粘贴 PersistentVolume 的 YAML 定义内容</p>
          <TextArea
            rows={16}
            value={this.state.pvCreateYaml}
            onChange={e => this.setState({ pvCreateYaml: e.target.value })}
            placeholder={`apiVersion: v1\nkind: PersistentVolume\nmetadata:\n  name: my-pv\nspec:\n  capacity:\n    storage: 10Gi\n  accessModes:\n    - ReadWriteOnce`}
            style={{ fontFamily: 'monospace', fontSize: 13 }}
          />
        </Modal>
      </div>
    );
  }

  renderStorageConfigTab() {
    const { storageClasses, storageConfig } = this.props;
    const { configEditing, selectedStorageClass } = this.state;
    const currentSC = storageConfig && storageConfig.default_storage_class;
    const currentScInfo = storageClasses.find(sc => sc.name === currentSC);
    return (
      <div style={{ maxWidth: 700 }}>
        <Card
          title={<span><Icon type="database" style={{ color: '#155aef', marginRight: 8 }} />应用市场默认存储配置</span>}
          extra={
            configEditing ? (
              <span>
                <Button type="primary" size="small" onClick={this.handleSaveStorageConfig} style={{ marginRight: 8 }}>保存</Button>
                <Button size="small" onClick={() => this.setState({ configEditing: false, selectedStorageClass: null })}>取消</Button>
              </span>
            ) : (
              <Button size="small" icon="edit" onClick={() => this.setState({ configEditing: true, selectedStorageClass: currentSC })}>修改</Button>
            )
          }
          style={{ marginBottom: 16, borderRadius: 4 }}
        >
          <p style={{ color: '#676f83', marginBottom: 20, fontSize: 13 }}>
            配置从应用市场安装应用时默认使用的存储类（StorageClass），安装后可在应用级别单独修改。
          </p>
          <div style={{ marginBottom: 20 }}>
            <div style={{ color: '#8d9bad', fontSize: 12, marginBottom: 6 }}>默认 StorageClass</div>
            {configEditing ? (
              <Select
                style={{ width: '100%' }}
                value={selectedStorageClass}
                onChange={v => this.setState({ selectedStorageClass: v })}
                placeholder="请选择存储类"
              >
                {storageClasses.map(sc => (
                  <Option key={sc.name} value={sc.name}>
                    <Icon type="database" style={{ marginRight: 6, color: '#155aef' }} />
                    {sc.name}
                    {sc.is_default && <Tag color="blue" style={{ marginLeft: 8, fontSize: 11 }}>默认</Tag>}
                    <span style={{ color: '#8d9bad', marginLeft: 8, fontSize: 12 }}>({sc.provisioner})</span>
                  </Option>
                ))}
              </Select>
            ) : (
              <div style={{ padding: '8px 12px', background: '#f2f4f7', borderRadius: 4, display: 'flex', alignItems: 'center' }}>
                <Icon type="database" style={{ color: '#155aef', marginRight: 8 }} />
                <span style={{ fontWeight: 500, color: '#495464' }}>{currentSC || <span style={{ color: '#8d9bad' }}>未配置</span>}</span>
                {currentScInfo && <span style={{ color: '#8d9bad', marginLeft: 8, fontSize: 12 }}>({currentScInfo.provisioner})</span>}
              </div>
            )}
          </div>
          {currentScInfo && (
            <div style={{ background: '#f9fafb', border: '1px solid #e8eaf0', borderRadius: 4, padding: '16px 20px' }}>
              <div style={{ color: '#8d9bad', fontSize: 12, fontWeight: 500, marginBottom: 12 }}>当前已选配置</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 32px' }}>
                {[
                  ['StorageClass', currentScInfo.name],
                  ['Provisioner', currentScInfo.provisioner],
                  ['回收策略', currentScInfo.reclaim_policy || '-'],
                  ['集群默认', currentScInfo.is_default ? '是' : '否'],
                ].map(([label, value]) => (
                  <div key={label}>
                    <div style={{ color: '#8d9bad', fontSize: 12 }}>{label}</div>
                    <div style={{ color: '#495464', fontWeight: 500, marginTop: 2 }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
        <div style={{ background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 4, padding: '10px 16px', display: 'flex', alignItems: 'flex-start', fontSize: 13, color: '#856404' }}>
          <Icon type="info-circle" style={{ marginRight: 8, marginTop: 2, color: '#F69D4A' }} />
          此配置仅影响从应用市场新安装的应用，已安装的应用不会受影响。如需修改已安装应用的存储，请前往对应应用进行配置。
        </div>
      </div>
    );
  }

  renderOtherResourcesTab() {
    const { platformResources, resourceInstances } = this.props;
    const { selectedType, instancesLoading, typeSearchText, instanceSearchText, instanceModal } = this.state;

    // ── Level 1：资源类型列表 ──────────────────────────────────────────────
    if (!selectedType) {
      const filtered = sortResourceTypes(
        typeSearchText
          ? platformResources.filter(r =>
              (r.kind || '').toLowerCase().includes(typeSearchText.toLowerCase()) ||
              (r.resource || '').toLowerCase().includes(typeSearchText.toLowerCase()) ||
              (r.group || '').toLowerCase().includes(typeSearchText.toLowerCase())
            )
          : platformResources
      );

      const columns = [
        {
          title: 'Kind',
          dataIndex: 'kind',
          key: 'kind',
          render: text => <span style={{ color: '#155aef', fontWeight: 500 }}>{text || '-'}</span>,
        },
        {
          title: 'API 分组 / 版本',
          key: 'gv',
          render: (_, r) => {
            const gv = r.group ? `${r.group}/${r.version}` : r.version;
            return <code style={{ fontSize: 11, color: '#676f83', background: '#f2f4f7', padding: '1px 5px', borderRadius: 2 }}>{gv}</code>;
          },
        },
        {
          title: '支持操作',
          dataIndex: 'verbs',
          key: 'verbs',
          render: verbs => (Array.isArray(verbs) ? verbs : []).map(v => <Tag key={v} style={{ fontSize: 11, marginBottom: 2 }}>{v}</Tag>),
        },
        {
          title: '',
          key: 'action',
          width: 90,
          render: (_, record) => {
            const canList = Array.isArray(record.verbs) && record.verbs.includes('list');
            return (
              <Button size="small" type="primary" ghost disabled={!canList} onClick={() => canList && this.handleSelectType(record)}>
                查看实例
              </Button>
            );
          },
        },
      ];

      return (
        <div>
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#676f83', fontSize: 13 }}>
              共 <strong style={{ color: '#495464' }}>{platformResources.length}</strong> 个集群级资源类型
            </span>
            <Input.Search
              placeholder="搜索 Kind、资源名或分组..."
              style={{ width: 260 }}
              allowClear
              onChange={e => this.setState({ typeSearchText: e.target.value })}
            />
          </div>
          <Table
            dataSource={filtered}
            columns={columns}
            rowKey={r => `${r.group}/${r.version}/${r.resource}`}
            size="middle"
            pagination={filtered.length > 20 ? { pageSize: 20, size: 'small' } : false}
            locale={{ emptyText: <div style={{ padding: '40px 0', color: '#8d9bad', textAlign: 'center' }}>暂无数据</div> }}
          />
        </div>
      );
    }

    // ── Level 2：实例列表 ──────────────────────────────────────────────────
    const canCreate = Array.isArray(selectedType.verbs) && selectedType.verbs.includes('create');
    const canUpdate = Array.isArray(selectedType.verbs) && (selectedType.verbs.includes('update') || selectedType.verbs.includes('patch'));
    const canDelete = Array.isArray(selectedType.verbs) && selectedType.verbs.includes('delete');
    const apiVersion = selectedType.group ? `${selectedType.group}/${selectedType.version}` : selectedType.version;

    const items = Array.isArray(resourceInstances) ? resourceInstances : [];
    const filtered = instanceSearchText
      ? items.filter(r => ((r.metadata && r.metadata.name) || '').toLowerCase().includes(instanceSearchText.toLowerCase()))
      : items;

    const instanceColumns = [
      {
        title: '名称',
        key: 'name',
        render: (_, r) => (
          <a style={{ color: '#155aef', fontWeight: 500 }} onClick={e => { e.preventDefault(); this.handleViewInstanceYaml(r); }}>
            {(r.metadata && r.metadata.name) || '-'}
          </a>
        ),
      },
      {
        title: '创建时间',
        key: 'createdAt',
        width: 180,
        render: (_, r) => formatCreationTime(r.metadata && r.metadata.creationTimestamp),
      },
      {
        title: '操作',
        key: 'action',
        width: 180,
        render: (_, r) => (
          <span>
            <a style={{ marginRight: 12 }} onClick={e => { e.preventDefault(); this.handleViewInstanceYaml(r); }}>查看 YAML</a>
            {canUpdate && <a style={{ marginRight: 12 }} onClick={e => { e.preventDefault(); this.handleEditInstanceYaml(r); }}>编辑</a>}
            {canDelete && (
              <Popconfirm title={`确认删除 "${r.metadata && r.metadata.name}"？`} onConfirm={() => this.handleDeleteInstance(r)}>
                <a style={{ color: '#FC481B' }}>删除</a>
              </Popconfirm>
            )}
          </span>
        ),
      },
    ];

    const modalTitle = instanceModal.mode === 'create' ? `创建 ${selectedType.kind}`
      : instanceModal.mode === 'edit' ? `编辑 — ${instanceModal.name}`
      : `查看 YAML — ${instanceModal.name}`;

    const modalFooter = instanceModal.mode === 'view'
      ? [<Button key="c" onClick={() => this.setState({ instanceModal: { ...instanceModal, visible: false } })}>关闭</Button>]
      : [
          <Button key="cancel" onClick={() => this.setState({ instanceModal: { ...instanceModal, visible: false, saving: false } })}>取消</Button>,
          <Button key="ok" type="primary" loading={instanceModal.saving}
            onClick={instanceModal.mode === 'create' ? this.handleCreateInstanceConfirm : this.handleSaveInstanceYaml}>
            {instanceModal.mode === 'create' ? '创建' : '保存'}
          </Button>,
        ];

    return (
      <div>
        {/* 顶栏：返回 + 类型信息 + 操作 */}
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <Button icon="arrow-left" size="small" style={{ marginRight: 12 }} onClick={this.handleBackToTypes}>返回</Button>
            <span style={{ color: '#8d9bad', fontSize: 13 }}>集群级资源</span>
            <Icon type="right" style={{ margin: '0 6px', color: '#c0c9d6', fontSize: 11 }} />
            <span style={{ color: '#495464', fontWeight: 500 }}>
              {selectedType.kind}
              <code style={{ fontSize: 11, color: '#8d9bad', background: '#f2f4f7', padding: '1px 5px', borderRadius: 2, marginLeft: 8 }}>
                {apiVersion}/{selectedType.resource}
              </code>
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Input.Search
              placeholder="搜索名称..."
              style={{ width: 200 }}
              allowClear
              onChange={e => this.setState({ instanceSearchText: e.target.value })}
            />
            {canCreate && <Button type="primary" icon="plus" onClick={this.handleOpenCreateInstance}>创建</Button>}
          </div>
        </div>

        <Spin spinning={instancesLoading}>
          <Table
            dataSource={filtered}
            columns={instanceColumns}
            rowKey={r => (r.metadata && r.metadata.name) || Math.random()}
            size="middle"
            pagination={filtered.length > 20 ? { pageSize: 20, size: 'small' } : false}
            locale={{ emptyText: <div style={{ padding: '40px 0', color: '#8d9bad', textAlign: 'center' }}>{instancesLoading ? '加载中...' : `暂无 ${selectedType.kind} 实例`}</div> }}
          />
        </Spin>

        {/* YAML 弹窗 */}
        <Modal
          title={<span><Icon type="code" style={{ marginRight: 8 }} />{modalTitle}</span>}
          visible={instanceModal.visible}
          onCancel={() => this.setState({ instanceModal: { ...instanceModal, visible: false, saving: false } })}
          footer={modalFooter}
          width={760}
          destroyOnClose
        >
          <TextArea
            rows={22}
            readOnly={instanceModal.mode === 'view'}
            value={instanceModal.content}
            onChange={instanceModal.mode !== 'view' ? e => this.setState({ instanceModal: { ...instanceModal, content: e.target.value } }) : undefined}
            style={{ fontFamily: 'monospace', fontSize: 12 }}
          />
        </Modal>
      </div>
    );
  }

  render() {
    const { createModalVisible, yamlContent, mainTab, storageSubTab } = this.state;

    return (
      <div style={{ background: '#f2f4f7', minHeight: '100vh' }}>
        {/* 页头区 */}
        <div style={{ background: '#fff', padding: '20px 24px 0', borderBottom: '1px solid #e8eaf0', marginBottom: 0 }}>
          <div style={{ marginBottom: 12 }}>
            <h2 style={{ color: '#495464', fontSize: 18, fontWeight: 600, margin: 0 }}>平台资源</h2>
            <p style={{ color: '#676f83', fontSize: 13, margin: '4px 0 0' }}>集群级全局资源管理</p>
          </div>
          <Tabs
            activeKey={mainTab}
            onChange={key => {
              this.setState({ mainTab: key });
              if (key === 'other') this.fetchPlatformResources();
            }}
            style={{ marginBottom: -1 }}
          >
            <TabPane tab={<span><Icon type="database" style={{ marginRight: 4 }} />全局存储</span>} key="storage" />
            <TabPane tab={<span><Icon type="global" style={{ marginRight: 4 }} />其他资源</span>} key="other" />
          </Tabs>
        </div>

        {/* 内容区 */}
        <div style={{ padding: '20px 24px' }}>
          {mainTab === 'storage' && (
            <Card
              bodyStyle={{ padding: '0 24px 24px' }}
              style={{ borderRadius: 4, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
            >
              <Tabs
                activeKey={storageSubTab}
                onChange={this.handleStorageSubTabChange}
                size="default"
              >
                <TabPane tab={<span>存储类</span>} key="storageclass">
                  <div style={{ paddingTop: 8 }}>{this.renderStorageClassTab()}</div>
                </TabPane>
                <TabPane tab={<span>存储卷</span>} key="pv">
                  <div style={{ paddingTop: 8 }}>{this.renderPVTab()}</div>
                </TabPane>
                <TabPane tab={<span>存储配置</span>} key="storageconfig">
                  <div style={{ paddingTop: 16 }}>{this.renderStorageConfigTab()}</div>
                </TabPane>
              </Tabs>
            </Card>
          )}

          {mainTab === 'other' && (
            <Card
              bodyStyle={{ padding: '20px 24px' }}
              style={{ borderRadius: 4, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
            >
              {this.renderOtherResourcesTab()}
            </Card>
          )}
        </div>

        {/* 创建 StorageClass 弹窗 */}
        <Modal
          title={<span><Icon type="code" style={{ marginRight: 8 }} />YAML 创建存储类</span>}
          visible={createModalVisible}
          onOk={this.handleCreateConfirm}
          onCancel={() => this.setState({ createModalVisible: false, yamlContent: '' })}
          width={640}
          okText="创建"
          cancelText="取消"
        >
          <p style={{ color: '#676f83', marginBottom: 8, fontSize: 13 }}>粘贴 StorageClass 的 YAML 定义内容</p>
          <TextArea
            rows={16}
            value={yamlContent}
            onChange={e => this.setState({ yamlContent: e.target.value })}
            placeholder={`apiVersion: storage.k8s.io/v1\nkind: StorageClass\nmetadata:\n  name: my-storage\nprovisioner: your.provisioner`}
            style={{ fontFamily: 'monospace', fontSize: 13 }}
          />
        </Modal>
      </div>
    );
  }
}

export default PlatformResources;
