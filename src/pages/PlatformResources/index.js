import React, { PureComponent } from 'react';
import { connect } from 'dva';
import { Tabs, Table, Button, Modal, Input, Tag, Popconfirm } from 'antd';
import { formatMessage } from '@/utils/intl';

const { TabPane } = Tabs;
const { TextArea } = Input;

@connect(({ platformResources }) => ({
  storageClasses: platformResources.storageClasses,
  persistentVolumes: platformResources.persistentVolumes,
}))
class PlatformResources extends PureComponent {
  state = {
    createModalVisible: false,
    yamlContent: '',
    createTarget: '',
  };

  componentDidMount() {
    this.fetchStorageClasses();
  }

  fetchStorageClasses = () => {
    const { dispatch, match } = this.props;
    const { eid, regionName } = match.params;
    dispatch({
      type: 'platformResources/fetchStorageClasses',
      payload: { eid, region: regionName },
    });
  };

  handleDeleteStorageClass = (name) => {
    const { dispatch, match } = this.props;
    const { eid, regionName } = match.params;
    dispatch({
      type: 'platformResources/deleteStorageClass',
      payload: { eid, region: regionName, name },
      callback: () => this.fetchStorageClasses(),
    });
  };

  handleCreateConfirm = () => {
    const { dispatch, match } = this.props;
    const { eid, regionName } = match.params;
    const { yamlContent, createTarget } = this.state;
    dispatch({
      type: `platformResources/create${createTarget}`,
      payload: { eid, region: regionName, yaml: yamlContent },
      callback: () => {
        this.setState({ createModalVisible: false, yamlContent: '' });
        this.fetchStorageClasses();
      },
    });
  };

  renderStorageClassTab() {
    const { storageClasses } = this.props;
    const columns = [
      { title: '名称', dataIndex: 'name', key: 'name' },
      { title: 'Provisioner', dataIndex: 'provisioner', key: 'provisioner' },
      { title: '默认', dataIndex: 'is_default', key: 'is_default',
        render: v => v ? <Tag color="blue">默认</Tag> : null },
      { title: '回收策略', dataIndex: 'reclaim_policy', key: 'reclaim_policy' },
      { title: '绑定模式', dataIndex: 'volume_binding_mode', key: 'volume_binding_mode' },
      { title: '卷数', dataIndex: 'pv_count', key: 'pv_count' },
      {
        title: '操作', key: 'action',
        render: (_, record) => (
          <Popconfirm title="确认删除？" onConfirm={() => this.handleDeleteStorageClass(record.name)}>
            <a style={{ color: '#FC481B' }}>删除</a>
          </Popconfirm>
        ),
      },
    ];
    return (
      <div>
        <div style={{ marginBottom: 16, textAlign: 'right' }}>
          <Button
            type="primary"
            onClick={() => this.setState({ createModalVisible: true, createTarget: 'StorageClass' })}
          >
            创建存储类
          </Button>
        </div>
        <Table
          dataSource={storageClasses}
          columns={columns}
          rowKey="name"
          size="small"
        />
      </div>
    );
  }

  render() {
    const { createModalVisible, yamlContent } = this.state;
    return (
      <div>
        <h2>平台资源</h2>
        <p style={{ color: '#676f83' }}>全局资源与集群级公共资源管理</p>
        <Tabs defaultActiveKey="storage">
          <TabPane tab="资源总览" key="overview">
            <p>集群资源概览（待实现）</p>
          </TabPane>
          <TabPane tab="全局存储" key="storage">
            <Tabs defaultActiveKey="storageclass" size="small">
              <TabPane tab="存储类" key="storageclass">
                {this.renderStorageClassTab()}
              </TabPane>
              <TabPane tab="存储卷" key="pv">
                <p>存储卷列表（待实现）</p>
              </TabPane>
            </Tabs>
          </TabPane>
          <TabPane tab="权限与访问控制" key="rbac">
            <p>ClusterRole / ClusterRoleBinding（待实现）</p>
          </TabPane>
          <TabPane tab="平台扩展" key="crd">
            <p>CRD 列表（待实现）</p>
          </TabPane>
          <TabPane tab="命名空间治理" key="namespace">
            <p>Namespace 列表（待实现）</p>
          </TabPane>
        </Tabs>

        <Modal
          title="YAML 创建"
          visible={createModalVisible}
          onOk={this.handleCreateConfirm}
          onCancel={() => this.setState({ createModalVisible: false })}
          width={640}
        >
          <TextArea
            rows={16}
            value={yamlContent}
            onChange={e => this.setState({ yamlContent: e.target.value })}
            placeholder="粘贴 YAML 内容..."
            style={{ fontFamily: 'monospace' }}
          />
        </Modal>
      </div>
    );
  }
}

export default PlatformResources;
