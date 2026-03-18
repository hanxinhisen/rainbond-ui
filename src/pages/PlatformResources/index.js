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
  Empty,
} from 'antd';
import styles from './index.less';

const { TabPane } = Tabs;
const { TextArea } = Input;
const { Option } = Select;

const COMMON_RESOURCE_KINDS = [
  'Deployment', 'StatefulSet', 'DaemonSet', 'Job', 'CronJob',
  'Service', 'Ingress', 'ConfigMap', 'Secret',
  'ServiceAccount', 'Role', 'ClusterRole', 'RoleBinding', 'ClusterRoleBinding',
  'HorizontalPodAutoscaler', 'PodDisruptionBudget', 'NetworkPolicy',
  'CustomResourceDefinition',
];

const STORAGE_SECTION_META = {
  storageclass: {
    icon: 'database',
    eyebrow: 'Storage Workspace',
    title: '存储类',
    description: '集中维护集群可用的 StorageClass，统一梳理默认能力、绑定模式和回收策略。',
    hint: '适合管理存储能力供给',
  },
  pv: {
    icon: 'hdd',
    eyebrow: 'Storage Workspace',
    title: '存储卷',
    description: '查看 PersistentVolume 的容量、状态和绑定关系，快速定位存储生命周期问题。',
    hint: '适合排查存储状态',
  },
  storageconfig: {
    icon: 'setting',
    eyebrow: 'Storage Workspace',
    title: '存储配置',
    description: '控制应用市场安装应用时使用的默认存储类，保持平台安装体验一致。',
    hint: '影响后续安装默认行为',
  },
};

const STATUS_MAP = {
  running: { color: '#00D777', text: '运行中' },
  available: { color: '#00D777', text: '可用' },
  bound: { color: '#155aef', text: '已绑定' },
  released: { color: '#F69D4A', text: '已释放' },
  failed: { color: '#CD0200', text: '失败' },
  warning: { color: '#F69D4A', text: '警告' },
};

function sortResourceTypes(list) {
  const priority = {};
  COMMON_RESOURCE_KINDS.forEach((kind, index) => {
    priority[kind] = index;
  });
  return [...list].sort((a, b) => {
    const aPriority = priority[a.kind] !== undefined ? priority[a.kind] : COMMON_RESOURCE_KINDS.length;
    const bPriority = priority[b.kind] !== undefined ? priority[b.kind] : COMMON_RESOURCE_KINDS.length;
    if (aPriority !== bPriority) {
      return aPriority - bPriority;
    }
    return (a.kind || '').localeCompare(b.kind || '');
  });
}

function formatCreationTime(ts) {
  if (!ts) return '-';
  try {
    const date = new Date(ts);
    return date.toLocaleString('zh-CN', { hour12: false });
  } catch (e) {
    return ts;
  }
}

function getTypeKey(type) {
  return `${type.group || 'core'}/${type.version}/${type.resource}`;
}

function getTypeApiVersion(type) {
  if (!type) {
    return '-';
  }
  return type.group ? `${type.group}/${type.version}` : type.version;
}

function hasVerb(type, verb) {
  return Array.isArray(type && type.verbs) && type.verbs.includes(verb);
}

function getCapabilityLabels(type) {
  const labels = [];
  if (hasVerb(type, 'list')) labels.push('可浏览');
  if (hasVerb(type, 'create')) labels.push('可创建');
  if (hasVerb(type, 'update') || hasVerb(type, 'patch')) labels.push('可编辑');
  if (hasVerb(type, 'delete')) labels.push('可删除');
  return labels;
}

const StatusDot = ({ status }) => {
  const current = STATUS_MAP[(status || '').toLowerCase()] || { color: '#8d9bad', text: status || '-' };
  return (
    <span>
      <span
        style={{
          display: 'inline-block',
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: current.color,
          marginRight: 6,
        }}
      />
      <span style={{ color: current.color }}>{current.text}</span>
    </span>
  );
};

@connect(({ platformResources }) => ({
  storageClasses: platformResources.storageClasses,
  persistentVolumes: platformResources.persistentVolumes,
  platformResources: platformResources.platformResources,
  resourceInstances: platformResources.resourceInstances,
  storageConfig: platformResources.storageConfig,
}))
class PlatformResources extends PureComponent {
  state = {
    createModalVisible: false,
    yamlContent: '',
    configEditing: false,
    selectedStorageClass: null,
    mainTab: 'storage',
    storageSubTab: 'storageclass',
    pvCreateVisible: false,
    pvCreateYaml: '',
    pvViewModal: { visible: false, content: '', name: '' },
    selectedType: null,
    instancesLoading: false,
    typeSearchText: '',
    instanceSearchText: '',
    instanceModal: {
      visible: false,
      mode: 'view',
      name: '',
      content: '',
      saving: false,
    },
  };

  componentDidMount() {
    this.fetchStorageClasses();
    this.fetchPersistentVolumes();
    this.fetchStorageConfig();
    this.fetchPlatformResources();
  }

  getParams() {
    const { match } = this.props;
    return (match && match.params) || {};
  }

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
      payload: {
        eid,
        region: regionName,
        group: type.group,
        version: type.version,
        resource: type.resource,
      },
      callback: () => this.setState({ instancesLoading: false }),
    });
  };

  handleMainTabChange = (key) => {
    this.setState({ mainTab: key });
    if (key === 'other') {
      this.fetchPlatformResources();
    }
  };

  handleStorageSubTabChange = (key) => {
    this.setState({ storageSubTab: key });
    if (key === 'storageclass') {
      this.fetchStorageClasses();
    }
    if (key === 'pv') {
      this.fetchPersistentVolumes();
    }
    if (key === 'storageconfig') {
      this.fetchStorageClasses();
      this.fetchStorageConfig();
    }
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

  handleSaveStorageConfig = () => {
    const { dispatch, storageConfig } = this.props;
    const { eid, regionName } = this.getParams();
    const { selectedStorageClass } = this.state;
    const storageClassName = selectedStorageClass || (storageConfig && storageConfig.default_storage_class);
    dispatch({
      type: 'platformResources/saveStorageConfig',
      payload: { eid, region: regionName, defaultStorageClass: storageClassName },
      callback: () => {
        this.setState({ configEditing: false, selectedStorageClass: null });
        this.fetchStorageConfig();
      },
    });
  };

  handleViewPVYaml = (record) => {
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
      payload: {
        eid,
        region: regionName,
        group: selectedType.group,
        version: selectedType.version,
        resource: selectedType.resource,
        name: record.metadata.name,
      },
      callback: (bean) => {
        if (bean) {
          this.setState({
            instanceModal: {
              visible: true,
              mode: 'view',
              name: record.metadata.name,
              content: JSON.stringify(bean, null, 2),
              saving: false,
            },
          });
        }
      },
    });
  };

  handleEditInstanceYaml = (record) => {
    const { dispatch } = this.props;
    const { eid, regionName } = this.getParams();
    const { selectedType } = this.state;
    dispatch({
      type: 'platformResources/fetchResourceInstance',
      payload: {
        eid,
        region: regionName,
        group: selectedType.group,
        version: selectedType.version,
        resource: selectedType.resource,
        name: record.metadata.name,
      },
      callback: (bean) => {
        if (bean) {
          this.setState({
            instanceModal: {
              visible: true,
              mode: 'edit',
              name: record.metadata.name,
              content: JSON.stringify(bean, null, 2),
              saving: false,
            },
          });
        }
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
      payload: {
        eid,
        region: regionName,
        group: selectedType.group,
        version: selectedType.version,
        resource: selectedType.resource,
        name: instanceModal.name,
        yaml: instanceModal.content,
      },
      callback: (res, err) => {
        if (!err) {
          this.setState({
            instanceModal: {
              visible: false,
              mode: 'view',
              name: '',
              content: '',
              saving: false,
            },
          });
          this.fetchInstancesForType(selectedType);
        } else {
          this.setState({ instanceModal: { ...instanceModal, saving: false } });
        }
      },
    });
  };

  handleOpenCreateInstance = () => {
    const { selectedType } = this.state;
    const apiVersion = getTypeApiVersion(selectedType);
    this.setState({
      instanceModal: {
        visible: true,
        mode: 'create',
        name: '',
        saving: false,
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
      payload: {
        eid,
        region: regionName,
        group: selectedType.group,
        version: selectedType.version,
        resource: selectedType.resource,
        yaml: instanceModal.content,
      },
      callback: (res, err) => {
        if (!err) {
          this.setState({
            instanceModal: {
              visible: false,
              mode: 'view',
              name: '',
              content: '',
              saving: false,
            },
          });
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
      payload: {
        eid,
        region: regionName,
        group: selectedType.group,
        version: selectedType.version,
        resource: selectedType.resource,
        name: record.metadata.name,
      },
      callback: () => this.fetchInstancesForType(selectedType),
    });
  };

  renderSectionIntro = (meta) => {
    return (
      <div className={styles.sectionIntro}>
        <div className={styles.sectionIntroMain}>
          <div className={styles.sectionIcon}>
            <Icon type={meta.icon} />
          </div>
          <div>
            <div className={styles.sectionEyebrow}>{meta.eyebrow}</div>
            <div className={styles.sectionTitle}>{meta.title}</div>
            <p className={styles.sectionDescription}>{meta.description}</p>
          </div>
        </div>
        <div className={styles.sectionIntroHint}>{meta.hint}</div>
      </div>
    );
  };

  renderPageHeader() {
    const { storageClasses, persistentVolumes, platformResources, storageConfig } = this.props;
    const { mainTab } = this.state;

    const stats = [
      {
        label: '存储类',
        value: storageClasses.length,
        hint: 'StorageClass',
      },
      {
        label: '存储卷',
        value: persistentVolumes.length,
        hint: 'PersistentVolume',
      },
      {
        label: '资源类型',
        value: platformResources.length,
        hint: '可浏览的全局 Kind',
      },
      {
        label: '默认存储',
        value: storageConfig && storageConfig.default_storage_class ? storageConfig.default_storage_class : '未配置',
        hint: '应用市场默认使用',
      },
    ];

    return (
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderTop}>
          <div className={styles.pageTitleBlock}>
            <span className={styles.pageEyebrow}>Platform Control Plane</span>
            <h1 className={styles.pageTitle}>平台资源</h1>
            <p className={styles.pageDescription}>
              围绕集群级存储与 Kubernetes 全局资源，提供更清晰的资源目录、集中筛选和 YAML 级操作工作区。
            </p>
          </div>
          <div className={styles.pageStats}>
            {stats.map(item => (
              <div key={item.label} className={styles.statCard}>
                <div className={styles.statLabel}>{item.label}</div>
                <div className={styles.statValue}>{item.value}</div>
                <div className={styles.statHint}>{item.hint}</div>
              </div>
            ))}
          </div>
        </div>
        <Tabs
          activeKey={mainTab}
          onChange={this.handleMainTabChange}
          className={styles.heroTabs}
        >
          <TabPane
            key="storage"
            tab={(
              <span>
                <Icon type="database" style={{ marginRight: 6 }} />
                全局存储
              </span>
            )}
          />
          <TabPane
            key="other"
            tab={(
              <span>
                <Icon type="appstore" style={{ marginRight: 6 }} />
                其他资源
              </span>
            )}
          />
        </Tabs>
      </div>
    );
  }

  renderStorageOverview() {
    const { storageClasses, persistentVolumes, storageConfig } = this.props;
    const currentStorageClass = storageConfig && storageConfig.default_storage_class;

    const cards = [
      {
        label: '存储类总数',
        value: storageClasses.length,
        meta: '统一管理 StorageClass 定义和默认能力。',
      },
      {
        label: '存储卷总数',
        value: persistentVolumes.length,
        meta: '集中查看容量、绑定和回收状态。',
      },
      {
        label: '应用市场默认存储',
        value: currentStorageClass || '未配置',
        meta: currentStorageClass ? '新安装应用会默认使用该存储类。' : '建议先配置一个默认存储类。',
      },
    ];

    return (
      <div className={styles.storageOverview}>
        {cards.map(card => (
          <div key={card.label} className={styles.overviewCard}>
            <div className={styles.overviewLabel}>{card.label}</div>
            <div className={styles.overviewValue}>{card.value}</div>
            <div className={styles.overviewMeta}>{card.meta}</div>
          </div>
        ))}
      </div>
    );
  }

  renderStorageClassTab() {
    const { storageClasses } = this.props;
    const columns = [
      {
        title: '名称',
        dataIndex: 'name',
        key: 'name',
        render: (text, record) => (
          <span>
            <span style={{ color: '#155aef', fontWeight: 600 }}>{text}</span>
            {record.is_default && <Tag color="blue" style={{ marginLeft: 8, fontSize: 11 }}>默认</Tag>}
          </span>
        ),
      },
      {
        title: 'Provisioner',
        dataIndex: 'provisioner',
        key: 'provisioner',
        render: value => <span className={styles.codeText}>{value || '-'}</span>,
      },
      {
        title: '回收策略',
        dataIndex: 'reclaim_policy',
        key: 'reclaim_policy',
        render: value => <Tag>{value || '-'}</Tag>,
      },
      {
        title: '绑定模式',
        dataIndex: 'volume_binding_mode',
        key: 'volume_binding_mode',
        render: value => value || '-',
      },
      {
        title: '存储卷数',
        dataIndex: 'pv_count',
        key: 'pv_count',
        align: 'center',
        width: 120,
      },
      {
        title: '操作',
        key: 'action',
        width: 100,
        render: (_, record) => (
          <Popconfirm title={`确认删除 "${record.name}"？`} onConfirm={() => this.handleDeleteStorageClass(record.name)}>
            <a style={{ color: '#FC481B' }}>删除</a>
          </Popconfirm>
        ),
      },
    ];

    return (
      <div className={styles.tabPanel}>
        {this.renderSectionIntro(STORAGE_SECTION_META.storageclass)}
        <div className={styles.tableActionBar}>
          <div>
            <div className={styles.actionTitle}>存储类列表</div>
            <div className={styles.actionDescription}>优先展示常用存储能力，便于快速浏览默认类、Provisioner 和策略差异。</div>
          </div>
          <Button type="primary" icon="plus" onClick={() => this.setState({ createModalVisible: true })}>
            创建存储类
          </Button>
        </div>
        <div className={styles.tableShell}>
          <Table
            dataSource={storageClasses}
            columns={columns}
            rowKey="name"
            size="middle"
            pagination={storageClasses.length > 10 ? { pageSize: 10, size: 'small' } : false}
            locale={{ emptyText: <div style={{ padding: '48px 0', color: '#8d9bad' }}>暂无存储类</div> }}
          />
        </div>
      </div>
    );
  }

  renderPVTab() {
    const { persistentVolumes } = this.props;
    const { pvViewModal, pvCreateVisible, pvCreateYaml } = this.state;

    const columns = [
      {
        title: '名称',
        dataIndex: 'name',
        key: 'name',
        render: (text, record) => (
          <a
            style={{ color: '#155aef', fontWeight: 600 }}
            onClick={e => {
              e.preventDefault();
              this.handleViewPVYaml(record);
            }}
          >
            {text}
          </a>
        ),
      },
      {
        title: '容量',
        dataIndex: 'capacity',
        key: 'capacity',
        render: value => <Tag color="geekblue">{value || '-'}</Tag>,
      },
      {
        title: '访问模式',
        dataIndex: 'access_modes',
        key: 'access_modes',
        render: modes => {
          const list = Array.isArray(modes) ? modes : [modes].filter(Boolean);
          return list.map(mode => (
            <Tag key={mode} style={{ fontSize: 11 }}>
              {mode}
            </Tag>
          ));
        },
      },
      {
        title: '存储类',
        dataIndex: 'storage_class',
        key: 'storage_class',
        render: value => (value ? <span className={styles.codeText}>{value}</span> : <span style={{ color: '#8d9bad' }}>-</span>),
      },
      {
        title: '状态',
        dataIndex: 'status',
        key: 'status',
        render: value => <StatusDot status={value} />,
      },
      {
        title: '回收策略',
        dataIndex: 'reclaim_policy',
        key: 'reclaim_policy',
        render: value => value || '-',
      },
      {
        title: '绑定到',
        dataIndex: 'claim',
        key: 'claim',
        render: value => value || <span style={{ color: '#8d9bad' }}>-</span>,
      },
      {
        title: '操作',
        key: 'action',
        width: 100,
        render: (_, record) => (
          <Popconfirm title={`确认删除存储卷 "${record.name}"？`} onConfirm={() => this.handleDeletePV(record.name)}>
            <a style={{ color: '#FC481B' }}>删除</a>
          </Popconfirm>
        ),
      },
    ];

    return (
      <div className={styles.tabPanel}>
        {this.renderSectionIntro(STORAGE_SECTION_META.pv)}
        <div className={styles.tableActionBar}>
          <div>
            <div className={styles.actionTitle}>存储卷列表</div>
            <div className={styles.actionDescription}>把容量、绑定关系和状态放进同一张工作表，定位异常卷时不需要频繁切换视角。</div>
          </div>
          <Button
            type="primary"
            icon="plus"
            onClick={() => this.setState({ pvCreateVisible: true, pvCreateYaml: '' })}
          >
            创建存储卷
          </Button>
        </div>
        <div className={styles.tableShell}>
          <Table
            dataSource={persistentVolumes}
            columns={columns}
            rowKey="name"
            size="middle"
            pagination={persistentVolumes.length > 10 ? { pageSize: 10, size: 'small' } : false}
            locale={{ emptyText: <div style={{ padding: '48px 0', color: '#8d9bad' }}>暂无存储卷</div> }}
          />
        </div>

        <Modal
          title={<span><Icon type="code" style={{ marginRight: 8 }} />存储卷 - {pvViewModal.name}</span>}
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

        <Modal
          title={<span><Icon type="plus" style={{ marginRight: 8 }} />YAML 创建存储卷</span>}
          visible={pvCreateVisible}
          onOk={this.handleCreatePVConfirm}
          onCancel={() => this.setState({ pvCreateVisible: false, pvCreateYaml: '' })}
          width={680}
          okText="创建"
          cancelText="取消"
        >
          <p style={{ color: '#676f83', marginBottom: 8, fontSize: 13 }}>粘贴 PersistentVolume 的 YAML 定义内容。</p>
          <TextArea
            rows={16}
            value={pvCreateYaml}
            onChange={e => this.setState({ pvCreateYaml: e.target.value })}
            placeholder={'apiVersion: v1\nkind: PersistentVolume\nmetadata:\n  name: my-pv\nspec:\n  capacity:\n    storage: 10Gi\n  accessModes:\n    - ReadWriteOnce'}
            style={{ fontFamily: 'monospace', fontSize: 13 }}
          />
        </Modal>
      </div>
    );
  }

  renderStorageConfigTab() {
    const { storageClasses, storageConfig } = this.props;
    const { configEditing, selectedStorageClass } = this.state;
    const currentStorageClass = storageConfig && storageConfig.default_storage_class;
    const currentStorageInfo = storageClasses.find(sc => sc.name === currentStorageClass);

    return (
      <div className={styles.tabPanel}>
        {this.renderSectionIntro(STORAGE_SECTION_META.storageconfig)}
        <div className={styles.configLayout}>
          <Card
            bordered={false}
            className={styles.configCard}
            title={<span><Icon type="database" style={{ color: '#155aef', marginRight: 8 }} />应用市场默认存储配置</span>}
            extra={
              configEditing ? (
                <span>
                  <Button type="primary" size="small" onClick={this.handleSaveStorageConfig} style={{ marginRight: 8 }}>
                    保存
                  </Button>
                  <Button size="small" onClick={() => this.setState({ configEditing: false, selectedStorageClass: null })}>
                    取消
                  </Button>
                </span>
              ) : (
                <Button
                  size="small"
                  icon="edit"
                  onClick={() => this.setState({ configEditing: true, selectedStorageClass: currentStorageClass })}
                >
                  修改
                </Button>
              )
            }
          >
            <p className={styles.configLead}>
              配置从应用市场安装应用时默认使用的 StorageClass，安装后仍可在应用层级按需单独调整。
            </p>
            <div style={{ marginBottom: 20 }}>
              <div className={styles.infoItemLabel}>默认 StorageClass</div>
              {configEditing ? (
                <Select
                  style={{ width: '100%' }}
                  value={selectedStorageClass}
                  onChange={value => this.setState({ selectedStorageClass: value })}
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
                <div className={styles.valueBox}>
                  <Icon type="database" style={{ color: '#155aef' }} />
                  <span style={{ color: '#495464', fontWeight: 600 }}>
                    {currentStorageClass || <span style={{ color: '#8d9bad' }}>未配置</span>}
                  </span>
                  {currentStorageInfo && <span style={{ color: '#8d9bad', fontSize: 12 }}>({currentStorageInfo.provisioner})</span>}
                </div>
              )}
            </div>

            {currentStorageInfo && (
              <div className={styles.infoGrid}>
                {[
                  ['StorageClass', currentStorageInfo.name],
                  ['Provisioner', currentStorageInfo.provisioner],
                  ['回收策略', currentStorageInfo.reclaim_policy || '-'],
                  ['集群默认', currentStorageInfo.is_default ? '是' : '否'],
                ].map(([label, value]) => (
                  <div key={label}>
                    <div className={styles.infoItemLabel}>{label}</div>
                    <div className={styles.infoItemValue}>{value}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <div className={styles.noticeBanner}>
            <Icon type="info-circle" style={{ marginTop: 3, color: '#F69D4A' }} />
            <span>
              此配置仅影响从应用市场新安装的应用，已安装应用不会被回写修改。如需调整现有应用的存储，请前往应用级配置页面处理。
            </span>
          </div>
        </div>
      </div>
    );
  }

  renderOtherResourcesTab() {
    const { platformResources, resourceInstances } = this.props;
    const {
      selectedType,
      instancesLoading,
      typeSearchText,
      instanceSearchText,
      instanceModal,
    } = this.state;

    const filteredTypes = sortResourceTypes(
      typeSearchText
        ? platformResources.filter(resource => (
          (resource.kind || '').toLowerCase().includes(typeSearchText.toLowerCase()) ||
          (resource.resource || '').toLowerCase().includes(typeSearchText.toLowerCase()) ||
          (resource.group || '').toLowerCase().includes(typeSearchText.toLowerCase())
        ))
        : platformResources
    );

    const capabilityLabels = getCapabilityLabels(selectedType);
    const canCreate = hasVerb(selectedType, 'create');
    const canUpdate = hasVerb(selectedType, 'update') || hasVerb(selectedType, 'patch');
    const canDelete = hasVerb(selectedType, 'delete');
    const items = Array.isArray(resourceInstances) ? resourceInstances : [];
    const filteredInstances = instanceSearchText
      ? items.filter(resource => ((resource.metadata && resource.metadata.name) || '').toLowerCase().includes(instanceSearchText.toLowerCase()))
      : items;

    const instanceColumns = [
      {
        title: '名称',
        key: 'name',
        render: (_, record) => (
          <a
            style={{ color: '#155aef', fontWeight: 600 }}
            onClick={e => {
              e.preventDefault();
              this.handleViewInstanceYaml(record);
            }}
          >
            {(record.metadata && record.metadata.name) || '-'}
          </a>
        ),
      },
      {
        title: '创建时间',
        key: 'createdAt',
        width: 190,
        render: (_, record) => formatCreationTime(record.metadata && record.metadata.creationTimestamp),
      },
      {
        title: '操作',
        key: 'action',
        width: 190,
        render: (_, record) => (
          <span>
            <a
              style={{ marginRight: 12 }}
              onClick={e => {
                e.preventDefault();
                this.handleViewInstanceYaml(record);
              }}
            >
              查看 YAML
            </a>
            {canUpdate && (
              <a
                style={{ marginRight: 12 }}
                onClick={e => {
                  e.preventDefault();
                  this.handleEditInstanceYaml(record);
                }}
              >
                编辑
              </a>
            )}
            {canDelete && (
              <Popconfirm
                title={`确认删除 "${record.metadata && record.metadata.name}"？`}
                onConfirm={() => this.handleDeleteInstance(record)}
              >
                <a style={{ color: '#FC481B' }}>删除</a>
              </Popconfirm>
            )}
          </span>
        ),
      },
    ];

    const modalTitle = instanceModal.mode === 'create'
      ? `创建 ${selectedType ? selectedType.kind : ''}`
      : instanceModal.mode === 'edit'
        ? `编辑 - ${instanceModal.name}`
        : `查看 YAML - ${instanceModal.name}`;

    const modalFooter = instanceModal.mode === 'view'
      ? [
          <Button key="close" onClick={() => this.setState({ instanceModal: { ...instanceModal, visible: false } })}>
            关闭
          </Button>,
        ]
      : [
          <Button
            key="cancel"
            onClick={() => this.setState({ instanceModal: { ...instanceModal, visible: false, saving: false } })}
          >
            取消
          </Button>,
          <Button
            key="ok"
            type="primary"
            loading={instanceModal.saving}
            onClick={instanceModal.mode === 'create' ? this.handleCreateInstanceConfirm : this.handleSaveInstanceYaml}
          >
            {instanceModal.mode === 'create' ? '创建' : '保存'}
          </Button>,
        ];

    return (
      <div className={styles.resourceWorkbench}>
        <div className={styles.resourceNavigator}>
          <div className={styles.navigatorHeader}>
            <div className={styles.navigatorTitleRow}>
              <div>
                <span className={styles.navigatorEyebrow}>Resource Catalog</span>
                <h2 className={styles.navigatorTitle}>资源目录</h2>
              </div>
              <span className={styles.countBadge}>{platformResources.length}</span>
            </div>
            <p className={styles.navigatorDesc}>选择一个 Kind 后，在右侧查看实例、筛选名称并执行 YAML 级操作。</p>
            <Input.Search
              placeholder="搜索 Kind、group 或 resource"
              value={typeSearchText}
              allowClear
              onChange={e => this.setState({ typeSearchText: e.target.value })}
              className={styles.navigatorSearch}
            />
          </div>

          <div className={styles.navigatorBody}>
            {filteredTypes.map(type => {
              const isActive = selectedType && getTypeKey(selectedType) === getTypeKey(type);
              const canList = hasVerb(type, 'list');
              const labels = getCapabilityLabels(type);
              return (
                <button
                  key={getTypeKey(type)}
                  type="button"
                  disabled={!canList}
                  onClick={() => this.handleSelectType(type)}
                  className={[
                    styles.navigatorItem,
                    isActive ? styles.navigatorItemActive : '',
                    !canList ? styles.navigatorItemDisabled : '',
                  ].join(' ')}
                >
                  <div className={styles.itemTitleRow}>
                    <span className={styles.itemTitle}>{type.kind || '-'}</span>
                    {!canList && <span className={styles.itemDisabledText}>不可浏览</span>}
                  </div>
                  <div className={styles.itemMeta}>
                    {getTypeApiVersion(type)} · {type.resource}
                  </div>
                  <div className={styles.itemCapabilities}>
                    {(labels.length > 0 ? labels : ['仅展示']).map(label => (
                      <span
                        key={label}
                        className={[
                          styles.itemCapability,
                          isActive ? styles.itemCapabilityActive : '',
                        ].join(' ')}
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                </button>
              );
            })}

            {filteredTypes.length === 0 && (
              <div className={styles.navigatorEmpty}>
                <Empty description="没有匹配的资源类型" />
              </div>
            )}
          </div>
        </div>

        <div className={styles.resourceWorkspace}>
          {!selectedType ? (
            <div className={styles.emptyWorkspace}>
              <div className={styles.emptyStateCard}>
                <div className={styles.emptyIcon}>
                  <Icon type="appstore" />
                </div>
                <div className={styles.emptyTitle}>从左侧选择一个资源类型</div>
                <p className={styles.emptyDesc}>
                  选中后会在这里展示实例列表、搜索入口，以及查看、编辑、创建 YAML 的操作工作区。
                </p>
              </div>
            </div>
          ) : (
            <React.Fragment>
              <div className={styles.resourceHero}>
                <div className={styles.resourceHeroTop}>
                  <div>
                    <div className={styles.resourceHeroEyebrow}>Resource Workspace</div>
                    <div className={styles.resourceHeroTitleRow}>
                      <h2 className={styles.resourceHeroTitle}>{selectedType.kind}</h2>
                      {capabilityLabels.map(label => (
                        <span key={label} className={styles.metaChip}>{label}</span>
                      ))}
                    </div>
                    <div className={styles.metaChips}>
                      <span className={styles.metaChip}>{getTypeApiVersion(selectedType)}</span>
                      <span className={styles.metaChip}>{selectedType.resource}</span>
                      <span className={styles.metaChip}>{selectedType.group || 'core api'}</span>
                    </div>
                    <p className={styles.resourceHeroDesc}>
                      统一查看 {selectedType.kind} 实例，支持 YAML 浏览、编辑与创建操作，适合在平台层做全局资源维护。
                    </p>
                  </div>
                  <Button icon="rollback" onClick={this.handleBackToTypes}>清空选择</Button>
                </div>

                <div className={styles.workspaceToolbar}>
                  <div className={styles.toolbarSummary}>
                    <span>{instanceSearchText ? `${filteredInstances.length}/${items.length} 个实例` : `${items.length} 个实例`}</span>
                    <span className={styles.toolbarDot} />
                    <span>支持 YAML 工作流</span>
                    <span className={styles.toolbarDot} />
                    <span>实例名称可快速搜索</span>
                  </div>
                  <div className={styles.workspaceToolbarActions}>
                    <Input.Search
                      placeholder="搜索实例名称..."
                      value={instanceSearchText}
                      allowClear
                      onChange={e => this.setState({ instanceSearchText: e.target.value })}
                      className={styles.workspaceSearch}
                    />
                    {canCreate && (
                      <Button type="primary" icon="plus" onClick={this.handleOpenCreateInstance}>
                        创建
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              <div className={styles.tableShell}>
                <Spin spinning={instancesLoading}>
                  <Table
                    dataSource={filteredInstances}
                    columns={instanceColumns}
                    rowKey={(record, index) => (record.metadata && (record.metadata.uid || record.metadata.name)) || `${selectedType.resource}-${index}`}
                    size="middle"
                    pagination={filteredInstances.length > 20 ? { pageSize: 20, size: 'small' } : false}
                    locale={{
                      emptyText: (
                        <div style={{ padding: '56px 0', color: '#8d9bad' }}>
                          {instancesLoading ? '加载中...' : `暂无 ${selectedType.kind} 实例`}
                        </div>
                      ),
                    }}
                  />
                </Spin>
              </div>

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
                  onChange={instanceModal.mode !== 'view'
                    ? e => this.setState({ instanceModal: { ...instanceModal, content: e.target.value } })
                    : undefined}
                  style={{ fontFamily: 'monospace', fontSize: 12 }}
                />
              </Modal>
            </React.Fragment>
          )}
        </div>
      </div>
    );
  }

  renderStorageWorkspace() {
    const { storageSubTab } = this.state;

    return (
      <Card bordered={false} className={styles.workspaceCard}>
        {this.renderStorageOverview()}
        <Tabs
          activeKey={storageSubTab}
          onChange={this.handleStorageSubTabChange}
          className={styles.innerTabs}
        >
          <TabPane key="storageclass" tab="存储类">
            {this.renderStorageClassTab()}
          </TabPane>
          <TabPane key="pv" tab="存储卷">
            {this.renderPVTab()}
          </TabPane>
          <TabPane key="storageconfig" tab="存储配置">
            {this.renderStorageConfigTab()}
          </TabPane>
        </Tabs>
      </Card>
    );
  }

  render() {
    const { createModalVisible, yamlContent, mainTab } = this.state;

    return (
      <div className={styles.platformResourcesPage}>
        <div className={styles.pageShell}>
          {this.renderPageHeader()}

          <div className={styles.pageContent}>
            {mainTab === 'storage' && this.renderStorageWorkspace()}

            {mainTab === 'other' && (
              <Card bordered={false} className={styles.workspaceCard}>
                {this.renderOtherResourcesTab()}
              </Card>
            )}
          </div>

          <Modal
            title={<span><Icon type="code" style={{ marginRight: 8 }} />YAML 创建存储类</span>}
            visible={createModalVisible}
            onOk={this.handleCreateConfirm}
            onCancel={() => this.setState({ createModalVisible: false, yamlContent: '' })}
            width={680}
            okText="创建"
            cancelText="取消"
          >
            <p style={{ color: '#676f83', marginBottom: 8, fontSize: 13 }}>粘贴 StorageClass 的 YAML 定义内容。</p>
            <TextArea
              rows={16}
              value={yamlContent}
              onChange={e => this.setState({ yamlContent: e.target.value })}
              placeholder={'apiVersion: storage.k8s.io/v1\nkind: StorageClass\nmetadata:\n  name: my-storage\nprovisioner: your.provisioner'}
              style={{ fontFamily: 'monospace', fontSize: 13 }}
            />
          </Modal>
        </div>
      </div>
    );
  }
}

export default PlatformResources;
