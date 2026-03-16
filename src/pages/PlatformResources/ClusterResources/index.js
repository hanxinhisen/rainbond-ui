/* eslint-disable react/sort-comp */
import React, { PureComponent } from 'react';
import { connect } from 'dva';
import { Row, Col, Tree, Table, Button, Drawer, Form, Input, notification, Spin, Empty } from 'antd';
import { formatMessage } from '@/utils/intl';
import PageHeaderLayout from '@/layouts/PageHeaderLayout';
import globalUtil from '../../../utils/global';
import roleUtil from '../../../utils/newRole';
import styles from './index.less';

const { TreeNode } = Tree;

@connect(({ teamControl, platformResources }) => ({
  currentTeamPermissionsInfo: teamControl.currentTeamPermissionsInfo,
  resourceList: platformResources.resourceList,
  resourceTypes: platformResources.resourceTypes,
  loading: platformResources.loading,
}))
@Form.create()
class ClusterResources extends PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      selectedResourceType: null,
      expandedKeys: [],
      selectedKeys: [],
      drawerVisible: false,
      drawerTitle: formatMessage({ id: 'platformResources.cluster.add' }),
      drawerType: 'add',
      formData: {},
      resourcePermission: roleUtil.queryPermissionsInfo(
        this.props.currentTeamPermissionsInfo && this.props.currentTeamPermissionsInfo.team,
        'platform_resources',
        'cluster'
      ),
    };
  }

  componentDidMount() {
    this.fetchResourceTypes();
  }

  fetchResourceTypes = () => {
    const { dispatch } = this.props;
    dispatch({
      type: 'platformResources/fetchResourceTypes',
      payload: {
        team_name: globalUtil.getCurrTeamName(),
        resource_category: 'cluster',
      },
    });
  };

  fetchResourceList = (resourceType) => {
    const { dispatch } = this.props;
    dispatch({
      type: 'platformResources/fetchResourceList',
      payload: {
        team_name: globalUtil.getCurrTeamName(),
        resource_type: resourceType,
      },
    });
  };

  handleTreeSelect = (selectedKeys, event) => {
    if (selectedKeys.length > 0) {
      const resourceType = selectedKeys[0];
      this.setState({ selectedResourceType: resourceType, selectedKeys });
      this.fetchResourceList(resourceType);
    }
  };

  handleTreeExpand = (expandedKeys) => {
    this.setState({ expandedKeys });
  };

  handleAddResource = () => {
    this.setState({
      drawerVisible: true,
      drawerType: 'add',
      drawerTitle: formatMessage({ id: 'platformResources.cluster.add' }),
      formData: {},
    });
  };

  handleEditResource = (record) => {
    this.setState({
      drawerVisible: true,
      drawerType: 'edit',
      drawerTitle: formatMessage({ id: 'platformResources.cluster.edit' }),
      formData: record,
    });
  };

  handleDeleteResource = (record) => {
    const { dispatch } = this.props;
    const { selectedResourceType } = this.state;
    dispatch({
      type: 'platformResources/deleteResource',
      payload: {
        team_name: globalUtil.getCurrTeamName(),
        resource_id: record.id,
      },
      callback: () => {
        notification.success({
          message: formatMessage({ id: 'platformResources.cluster.deleteSuccess' }),
        });
        this.fetchResourceList(selectedResourceType);
      },
    });
  };

  handleDrawerClose = () => {
    this.setState({ drawerVisible: false });
  };

  handleDrawerSubmit = () => {
    const { form, dispatch } = this.props;
    const { drawerType, selectedResourceType, formData } = this.state;

    form.validateFields((err, values) => {
      if (!err) {
        const payload = {
          team_name: globalUtil.getCurrTeamName(),
          resource_type: selectedResourceType,
          ...values,
        };

        if (drawerType === 'edit') {
          payload.resource_id = formData.id;
        }

        const actionType = drawerType === 'add'
          ? 'platformResources/createResource'
          : 'platformResources/updateResource';

        dispatch({
          type: actionType,
          payload,
          callback: () => {
            notification.success({
              message: formatMessage({
                id: drawerType === 'add'
                  ? 'platformResources.cluster.addSuccess'
                  : 'platformResources.cluster.editSuccess',
              }),
            });
            this.handleDrawerClose();
            this.fetchResourceList(selectedResourceType);
          },
        });
      }
    });
  };

  renderResourceTree = () => {
    const { resourceTypes } = this.props;
    const { expandedKeys } = this.state;

    if (!resourceTypes || resourceTypes.length === 0) {
      return <Empty description={formatMessage({ id: 'platformResources.cluster.noTypes' })} />;
    }

    return (
      <Tree
        expandedKeys={expandedKeys}
        onExpand={this.handleTreeExpand}
        onSelect={this.handleTreeSelect}
        defaultExpandAll
      >
        {resourceTypes.map((type) => (
          <TreeNode key={type.id} title={type.name} />
        ))}
      </Tree>
    );
  };

  renderResourceTable = () => {
    const { resourceList, loading } = this.props;
    const { resourcePermission } = this.state;

    const columns = [
      {
        title: formatMessage({ id: 'platformResources.cluster.name' }),
        dataIndex: 'name',
        key: 'name',
      },
      {
        title: formatMessage({ id: 'platformResources.cluster.type' }),
        dataIndex: 'type',
        key: 'type',
      },
      {
        title: formatMessage({ id: 'platformResources.cluster.status' }),
        dataIndex: 'status',
        key: 'status',
        render: (status) => {
          const statusMap = {
            active: formatMessage({ id: 'platformResources.cluster.statusActive' }),
            inactive: formatMessage({ id: 'platformResources.cluster.statusInactive' }),
          };
          return statusMap[status] || status;
        },
      },
      {
        title: formatMessage({ id: 'platformResources.cluster.action' }),
        key: 'action',
        render: (text, record) => (
          <span>
            {resourcePermission && resourcePermission.edit && (
              <>
                <a onClick={() => this.handleEditResource(record)}>
                  {formatMessage({ id: 'platformResources.cluster.edit' })}
                </a>
                <span className={styles.divider}>|</span>
              </>
            )}
            {resourcePermission && resourcePermission.delete && (
              <a onClick={() => this.handleDeleteResource(record)}>
                {formatMessage({ id: 'platformResources.cluster.delete' })}
              </a>
            )}
          </span>
        ),
      },
    ];

    return (
      <Spin spinning={loading}>
        <Table
          columns={columns}
          dataSource={resourceList}
          rowKey="id"
          pagination={{ pageSize: 10 }}
          locale={{
            emptyText: formatMessage({ id: 'platformResources.cluster.noData' }),
          }}
        />
      </Spin>
    );
  };

  renderDrawer = () => {
    const { form } = this.props;
    const { drawerVisible, drawerTitle, drawerType, formData } = this.state;
    const { getFieldDecorator } = form;

    return (
      <Drawer
        title={drawerTitle}
        placement="right"
        onClose={this.handleDrawerClose}
        visible={drawerVisible}
        width={400}
      >
        <Form layout="vertical">
          <Form.Item label={formatMessage({ id: 'platformResources.cluster.name' })}>
            {getFieldDecorator('name', {
              initialValue: formData.name || '',
              rules: [
                {
                  required: true,
                  message: formatMessage({ id: 'platformResources.cluster.nameRequired' }),
                },
              ],
            })(<Input placeholder={formatMessage({ id: 'platformResources.cluster.namePlaceholder' })} />)}
          </Form.Item>

          <Form.Item label={formatMessage({ id: 'platformResources.cluster.description' })}>
            {getFieldDecorator('description', {
              initialValue: formData.description || '',
            })(<Input.TextArea rows={4} />)}
          </Form.Item>

          <Form.Item>
            <Button type="primary" onClick={this.handleDrawerSubmit} style={{ marginRight: 8 }}>
              {formatMessage({ id: 'platformResources.cluster.submit' })}
            </Button>
            <Button onClick={this.handleDrawerClose}>
              {formatMessage({ id: 'platformResources.cluster.cancel' })}
            </Button>
          </Form.Item>
        </Form>
      </Drawer>
    );
  };

  render() {
    const { resourcePermission } = this.state;

    return (
      <PageHeaderLayout title={formatMessage({ id: 'platformResources.cluster.title' })}>
        <div className={styles.container}>
          <Row gutter={16}>
            <Col span={6} className={styles.treePanel}>
              <div className={styles.treeHeader}>
                <h3>{formatMessage({ id: 'platformResources.cluster.resourceTypes' })}</h3>
              </div>
              <div className={styles.treeContent}>
                {this.renderResourceTree()}
              </div>
            </Col>
            <Col span={18} className={styles.listPanel}>
              <div className={styles.listHeader}>
                <h3>{formatMessage({ id: 'platformResources.cluster.resourceList' })}</h3>
                {resourcePermission && resourcePermission.add && (
                  <Button type="primary" onClick={this.handleAddResource}>
                    {formatMessage({ id: 'platformResources.cluster.add' })}
                  </Button>
                )}
              </div>
              <div className={styles.listContent}>
                {this.renderResourceTable()}
              </div>
            </Col>
          </Row>
          {this.renderDrawer()}
        </div>
      </PageHeaderLayout>
    );
  }
}

export default ClusterResources;
