import React, { PureComponent } from 'react';
import { connect } from 'dva';
import { Tabs, Table, Button, Modal, Input, Tag, Popconfirm, Form } from 'antd';
import { formatMessage } from '@/utils/intl';

const { TabPane } = Tabs;
const { TextArea } = Input;

const SOURCE_COLORS = {
  helm: 'purple',
  yaml: 'blue',
  manual: 'green',
  external: 'default',
};

const SOURCE_LABELS = {
  helm: 'Helm 托管',
  yaml: 'YAML 导入',
  manual: '手动创建',
  external: '外部创建',
};

@connect(({ teamResources }) => ({
  resources: teamResources.resources,
  helmReleases: teamResources.helmReleases,
  total: teamResources.total,
}))
class ResourceCenter extends PureComponent {
  state = {
    yamlModalVisible: false,
    yamlContent: '',
    helmModalVisible: false,
    helmForm: { repo_name: '', chart: '', version: '', release_name: '', values: '' },
  };

  componentDidMount() {
    this.fetchWorkloads();
  }

  fetchWorkloads = () => {
    const { dispatch, match } = this.props;
    const { teamName, regionName } = match.params;
    dispatch({
      type: 'teamResources/fetchResources',
      payload: { team: teamName, region: regionName, group: 'apps', version: 'v1', resource: 'deployments' },
    });
  };

  fetchHelmReleases = () => {
    const { dispatch, match } = this.props;
    const { teamName, regionName } = match.params;
    dispatch({
      type: 'teamResources/fetchHelmReleases',
      payload: { team: teamName, region: regionName },
    });
  };

  handleYamlCreate = () => {
    const { dispatch, match } = this.props;
    const { teamName, regionName } = match.params;
    const { yamlContent } = this.state;
    dispatch({
      type: 'teamResources/createResource',
      payload: {
        team: teamName, region: regionName,
        source: 'yaml', yaml: yamlContent,
        group: 'apps', version: 'v1', resource: 'deployments'
      },
      callback: () => {
        this.setState({ yamlModalVisible: false, yamlContent: '' });
        this.fetchWorkloads();
      },
    });
  };

  handleHelmInstall = () => {
    const { dispatch, match } = this.props;
    const { teamName, regionName } = match.params;
    const { helmForm } = this.state;
    dispatch({
      type: 'teamResources/installRelease',
      payload: { team: teamName, region: regionName, ...helmForm },
      callback: () => {
        this.setState({ helmModalVisible: false });
        this.fetchHelmReleases();
      },
    });
  };

  renderResourceTable(resources) {
    const { dispatch, match } = this.props;
    const { teamName, regionName } = match.params;
    const columns = [
      { title: '名称', dataIndex: 'name', key: 'name' },
      { title: 'Kind', dataIndex: 'kind', key: 'kind' },
      { title: '状态', dataIndex: 'status', key: 'status' },
      {
        title: '来源', dataIndex: 'source', key: 'source',
        render: src => (
          <Tag color={SOURCE_COLORS[src] || 'default'}>
            {SOURCE_LABELS[src] || src}
          </Tag>
        ),
      },
      { title: '创建时间', dataIndex: 'created_at', key: 'created_at' },
      {
        title: '操作', key: 'action',
        render: (_, record) => record.source !== 'external' ? (
          <Popconfirm
            title="确认删除？"
            onConfirm={() => dispatch({
              type: 'teamResources/deleteResource',
              payload: { team: teamName, region: regionName, name: record.name,
                group: 'apps', version: 'v1', resource: 'deployments' },
              callback: () => this.fetchWorkloads(),
            })}
          >
            <a style={{ color: '#FC481B' }}>删除</a>
          </Popconfirm>
        ) : <span style={{ color: '#8d9bad' }}>只读</span>,
      },
    ];
    return <Table dataSource={resources} columns={columns} rowKey="name" size="small" />;
  }

  renderHelmTab() {
    const { helmReleases } = this.props;
    const columns = [
      { title: 'Release 名称', dataIndex: 'name', key: 'name' },
      { title: 'Chart', dataIndex: 'chart', key: 'chart' },
      { title: '版本', dataIndex: 'version', key: 'version' },
      { title: '状态', dataIndex: 'info.status', key: 'status' },
      { title: '命名空间', dataIndex: 'namespace', key: 'namespace' },
    ];
    return (
      <div>
        <div style={{ marginBottom: 16, textAlign: 'right' }}>
          <Button type="primary" onClick={() => { this.fetchHelmReleases(); this.setState({ helmModalVisible: true }); }}>
            安装 Helm 应用
          </Button>
        </div>
        <Table dataSource={helmReleases} columns={columns} rowKey="name" size="small" />
      </div>
    );
  }

  render() {
    const { resources } = this.props;
    const { yamlModalVisible, yamlContent, helmModalVisible, helmForm } = this.state;
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2>资源中心</h2>
            <p style={{ color: '#676f83' }}>当前团队范围内的资源与 Helm 应用管理</p>
          </div>
          <div>
            <Button onClick={() => this.setState({ yamlModalVisible: true })} style={{ marginRight: 8 }}>
              &lt;/&gt; YAML 创建
            </Button>
            <Button type="primary">+ 新建资源</Button>
          </div>
        </div>

        <Tabs defaultActiveKey="workload">
          <TabPane tab="工作负载" key="workload">{this.renderResourceTable(resources)}</TabPane>
          <TabPane tab="容器组" key="pod"><p>Pod 列表（待实现）</p></TabPane>
          <TabPane tab="网络" key="network"><p>Service/Ingress（待实现）</p></TabPane>
          <TabPane tab="配置" key="config"><p>ConfigMap/Secret（待实现）</p></TabPane>
          <TabPane tab="存储" key="storage"><p>PVC 列表（待实现）</p></TabPane>
          <TabPane tab="Helm 应用" key="helm">{this.renderHelmTab()}</TabPane>
        </Tabs>

        <Modal
          title="YAML 创建"
          visible={yamlModalVisible}
          onOk={this.handleYamlCreate}
          onCancel={() => this.setState({ yamlModalVisible: false })}
          width={640}
        >
          <TextArea
            rows={16}
            value={yamlContent}
            onChange={e => this.setState({ yamlContent: e.target.value })}
            placeholder="粘贴 YAML 内容（将自动添加 rainbond.io/source: yaml 标签）"
            style={{ fontFamily: 'monospace' }}
          />
        </Modal>

        <Modal
          title="安装 Helm 应用"
          visible={helmModalVisible}
          onOk={this.handleHelmInstall}
          onCancel={() => this.setState({ helmModalVisible: false })}
          width={560}
        >
          <Form layout="vertical">
            <Form.Item label="Repo 名称">
              <Input value={helmForm.repo_name}
                onChange={e => this.setState({ helmForm: { ...helmForm, repo_name: e.target.value } })}
                placeholder="如: bitnami" />
            </Form.Item>
            <Form.Item label="Chart 名称">
              <Input value={helmForm.chart}
                onChange={e => this.setState({ helmForm: { ...helmForm, chart: e.target.value } })}
                placeholder="如: nginx" />
            </Form.Item>
            <Form.Item label="版本">
              <Input value={helmForm.version}
                onChange={e => this.setState({ helmForm: { ...helmForm, version: e.target.value } })}
                placeholder="如: 1.2.3" />
            </Form.Item>
            <Form.Item label="Release 名称">
              <Input value={helmForm.release_name}
                onChange={e => this.setState({ helmForm: { ...helmForm, release_name: e.target.value } })}
                placeholder="如: my-nginx" />
            </Form.Item>
            <Form.Item label="Values（YAML 格式，可选）">
              <TextArea rows={6} value={helmForm.values}
                onChange={e => this.setState({ helmForm: { ...helmForm, values: e.target.value } })}
                placeholder="replicaCount: 2" style={{ fontFamily: 'monospace' }} />
            </Form.Item>
          </Form>
        </Modal>
      </div>
    );
  }
}

export default ResourceCenter;
