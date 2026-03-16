import React, { PureComponent } from 'react';
import { Card, Row, Col, Table, Spin, Button, Modal, notification } from 'antd';
import { connect } from 'dva';
import { formatMessage } from '@/utils/intl';
import globalUtil from '@/utils/global';
import styles from './index.less';

@connect(({ loading, platformResources }) => ({
  storageLoading: loading.effects['platformResources/fetchStorageData'],
  storageClassList: platformResources.storageClassList || [],
  pvList: platformResources.pvList || [],
  storageStats: platformResources.storageStats || {}
}))
export default class StoragePage extends PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      selectedStorageClass: null,
      selectedPV: null
    };
  }

  componentDidMount() {
    this.loadStorageData();
  }

  loadStorageData = () => {
    const { dispatch } = this.props;
    const regionName = globalUtil.getCurrRegionName();

    dispatch({
      type: 'platformResources/fetchStorageData',
      payload: {
        region_name: regionName
      },
      callback: res => {
        if (res && res.status_code !== 200) {
          notification.error({
            message: formatMessage({ id: 'notification.error.load_storage' })
          });
        }
      }
    });
  };

  handleRefresh = () => {
    this.loadStorageData();
  };

  handleDeleteStorageClass = (record) => {
    const { dispatch } = this.props;
    const regionName = globalUtil.getCurrRegionName();

    Modal.confirm({
      title: formatMessage({ id: 'modal.confirm.delete' }),
      content: formatMessage({ id: 'modal.confirm.delete_storage_class' }),
      okText: formatMessage({ id: 'button.confirm' }),
      cancelText: formatMessage({ id: 'button.cancel' }),
      onOk: () => {
        dispatch({
          type: 'platformResources/deleteStorageClass',
          payload: {
            region_name: regionName,
            name: record.name
          },
          callback: res => {
            if (res && res.status_code === 200) {
              notification.success({
                message: formatMessage({ id: 'notification.success.delete' })
              });
              this.loadStorageData();
            }
          }
        });
      }
    });
  };

  handleDeletePV = (record) => {
    const { dispatch } = this.props;
    const regionName = globalUtil.getCurrRegionName();

    Modal.confirm({
      title: formatMessage({ id: 'modal.confirm.delete' }),
      content: formatMessage({ id: 'modal.confirm.delete_pv' }),
      okText: formatMessage({ id: 'button.confirm' }),
      cancelText: formatMessage({ id: 'button.cancel' }),
      onOk: () => {
        dispatch({
          type: 'platformResources/deletePV',
          payload: {
            region_name: regionName,
            name: record.name
          },
          callback: res => {
            if (res && res.status_code === 200) {
              notification.success({
                message: formatMessage({ id: 'notification.success.delete' })
              });
              this.loadStorageData();
            }
          }
        });
      }
    });
  };

  renderStorageStats = () => {
    const { storageStats } = this.props;

    const stats = [
      {
        label: formatMessage({ id: 'storage.stats.total_capacity' }),
        value: storageStats.totalCapacity || '0 Gi',
        color: '#155aef'
      },
      {
        label: formatMessage({ id: 'storage.stats.used_capacity' }),
        value: storageStats.usedCapacity || '0 Gi',
        color: '#18B633'
      },
      {
        label: formatMessage({ id: 'storage.stats.available_capacity' }),
        value: storageStats.availableCapacity || '0 Gi',
        color: '#FF8D3C'
      },
      {
        label: formatMessage({ id: 'storage.stats.storage_class_count' }),
        value: storageStats.storageClassCount || 0,
        color: '#FC481B'
      }
    ];

    return (
      <Row gutter={16} className={styles.statsRow}>
        {stats.map((stat, index) => (
          <Col key={index} xs={24} sm={12} lg={6}>
            <Card className={styles.statCard}>
              <div className={styles.statLabel}>{stat.label}</div>
              <div className={styles.statValue} style={{ color: stat.color }}>
                {stat.value}
              </div>
            </Card>
          </Col>
        ))}
      </Row>
    );
  };

  renderStorageClassTable = () => {
    const { storageClassList, storageLoading } = this.props;

    const columns = [
      {
        title: formatMessage({ id: 'storage.table.name' }),
        dataIndex: 'name',
        key: 'name',
        width: '20%'
      },
      {
        title: formatMessage({ id: 'storage.table.provisioner' }),
        dataIndex: 'provisioner',
        key: 'provisioner',
        width: '20%'
      },
      {
        title: formatMessage({ id: 'storage.table.reclaim_policy' }),
        dataIndex: 'reclaimPolicy',
        key: 'reclaimPolicy',
        width: '15%'
      },
      {
        title: formatMessage({ id: 'storage.table.allow_volume_expansion' }),
        dataIndex: 'allowVolumeExpansion',
        key: 'allowVolumeExpansion',
        width: '15%',
        render: (text) => (text ? formatMessage({ id: 'common.yes' }) : formatMessage({ id: 'common.no' }))
      },
      {
        title: formatMessage({ id: 'storage.table.pv_count' }),
        dataIndex: 'pvCount',
        key: 'pvCount',
        width: '10%'
      },
      {
        title: formatMessage({ id: 'common.action' }),
        key: 'action',
        width: '20%',
        render: (text, record) => (
          <div>
            <Button
              type="link"
              size="small"
              onClick={() => this.handleDeleteStorageClass(record)}
            >
              {formatMessage({ id: 'button.delete' })}
            </Button>
          </div>
        )
      }
    ];

    return (
      <Card
        title={formatMessage({ id: 'storage.storage_class.title' })}
        extra={<Button onClick={this.handleRefresh}>{formatMessage({ id: 'button.refresh' })}</Button>}
        className={styles.tableCard}
      >
        <Table
          columns={columns}
          dataSource={storageClassList}
          loading={storageLoading}
          rowKey="name"
          pagination={{ pageSize: 10 }}
        />
      </Card>
    );
  };

  renderPVTable = () => {
    const { pvList, storageLoading } = this.props;

    const columns = [
      {
        title: formatMessage({ id: 'storage.table.name' }),
        dataIndex: 'name',
        key: 'name',
        width: '15%'
      },
      {
        title: formatMessage({ id: 'storage.table.storage_class' }),
        dataIndex: 'storageClassName',
        key: 'storageClassName',
        width: '15%'
      },
      {
        title: formatMessage({ id: 'storage.table.capacity' }),
        dataIndex: 'capacity',
        key: 'capacity',
        width: '12%'
      },
      {
        title: formatMessage({ id: 'storage.table.access_modes' }),
        dataIndex: 'accessModes',
        key: 'accessModes',
        width: '15%',
        render: (modes) => (modes ? modes.join(', ') : '-')
      },
      {
        title: formatMessage({ id: 'storage.table.status' }),
        dataIndex: 'status',
        key: 'status',
        width: '12%',
        render: (status) => {
          let color = '#676f83';
          if (status === 'Bound') {
            color = '#18B633';
          } else if (status === 'Available') {
            color = '#155aef';
          } else if (status === 'Released') {
            color = '#FF8D3C';
          } else if (status === 'Failed') {
            color = '#FC481B';
          }
          return <span style={{ color }}>{status}</span>;
        }
      },
      {
        title: formatMessage({ id: 'storage.table.claim' }),
        dataIndex: 'claimRef',
        key: 'claimRef',
        width: '15%',
        render: (claim) => (claim ? `${claim.namespace}/${claim.name}` : '-')
      },
      {
        title: formatMessage({ id: 'common.action' }),
        key: 'action',
        width: '16%',
        render: (text, record) => (
          <div>
            <Button
              type="link"
              size="small"
              onClick={() => this.handleDeletePV(record)}
            >
              {formatMessage({ id: 'button.delete' })}
            </Button>
          </div>
        )
      }
    ];

    return (
      <Card
        title={formatMessage({ id: 'storage.pv.title' })}
        extra={<Button onClick={this.handleRefresh}>{formatMessage({ id: 'button.refresh' })}</Button>}
        className={styles.tableCard}
      >
        <Table
          columns={columns}
          dataSource={pvList}
          loading={storageLoading}
          rowKey="name"
          pagination={{ pageSize: 10 }}
        />
      </Card>
    );
  };

  render() {
    const { storageLoading } = this.props;

    return (
      <Spin spinning={storageLoading}>
        <div className={styles.storageContainer}>
          <div className={styles.header}>
            <h2>{formatMessage({ id: 'storage.page.title' })}</h2>
          </div>

          {this.renderStorageStats()}

          <Row gutter={16} style={{ marginTop: '24px' }}>
            <Col xs={24}>
              {this.renderStorageClassTable()}
            </Col>
          </Row>

          <Row gutter={16} style={{ marginTop: '24px' }}>
            <Col xs={24}>
              {this.renderPVTable()}
            </Col>
          </Row>
        </div>
      </Spin>
    );
  }
}
