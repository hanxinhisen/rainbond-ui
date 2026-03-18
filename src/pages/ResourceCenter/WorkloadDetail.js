import React, { PureComponent } from 'react';
import { connect } from 'dva';
import { routerRedux } from 'dva/router';
import {
  Button,
  Card,
  Dropdown,
  Empty,
  Input,
  Menu,
  notification,
  Select,
  Spin,
  Table,
  Tabs,
  Tag,
} from 'antd';
import jsYaml from 'js-yaml';
import PodLogStream from './components/PodLogStream';
import TerminalModal from './components/TerminalModal';
import styles from './detail.less';

const { TextArea } = Input;
const { TabPane } = Tabs;
const { Option } = Select;

function getStatusClass(status) {
  const value = (status || '').toLowerCase();
  if (['running', 'active', 'bound', 'ready'].includes(value)) {
    return styles.statusRunning;
  }
  if (['warning', 'pending'].includes(value)) {
    return styles.statusWarning;
  }
  if (['failed', 'error', 'unknown'].includes(value)) {
    return styles.statusError;
  }
  return styles.statusDefault;
}

function safeYaml(value) {
  if (!value) {
    return '';
  }
  const resource = JSON.parse(JSON.stringify(value));
  if (resource.metadata && resource.metadata.managedFields) {
    delete resource.metadata.managedFields;
  }
  return jsYaml.dump(resource, { noRefs: true, lineWidth: 120 });
}

function formatPorts(ports) {
  return (ports || []).map(port => `${port.port}/${port.protocol || 'TCP'}`).join(' , ') || '-';
}

function formatIngressRules(ingress) {
  const rules = (((ingress || {}).spec || {}).rules) || [];
  const hosts = rules.map(rule => rule.host).filter(Boolean);
  return hosts.join(' , ') || '-';
}

@connect(({ resourceCenterDetail, loading }) => ({
  workloadDetail: resourceCenterDetail.workloadDetail,
  events: resourceCenterDetail.events,
  wsInfo: resourceCenterDetail.wsInfo,
  detailLoading: loading.effects['resourceCenterDetail/fetchWorkloadDetail'],
  eventsLoading: loading.effects['resourceCenterDetail/fetchEvents'],
}))
class WorkloadDetail extends PureComponent {
  state = {
    activeTab: 'overview',
    currentPodName: '',
    yamlText: '',
    terminalVisible: false,
  };

  componentDidMount() {
    this.fetchDetail();
    this.fetchWSInfo();
  }

  getRouteParams() {
    const { match, location } = this.props;
    const query = (location && location.query) || {};
    const searchParams = location && location.search ? new URLSearchParams(location.search) : null;
    return {
      ...(match && match.params),
      group: query.group || (searchParams && searchParams.get('group')) || 'apps',
      version: query.version || (searchParams && searchParams.get('version')) || 'v1',
    };
  }

  fetchDetail = () => {
    const { dispatch } = this.props;
    const params = this.getRouteParams();
    dispatch({
      type: 'resourceCenterDetail/fetchWorkloadDetail',
      payload: {
        team: params.teamName,
        region: params.regionName,
        group: params.group,
        version: params.version,
        resource: params.resource,
        name: params.name,
      },
      callback: bean => {
        const pods = (bean && bean.pods) || [];
        this.setState({
          currentPodName: pods[0] ? pods[0].metadata.name : '',
          yamlText: safeYaml(bean && bean.workload),
        });
      },
    });
  };

  fetchWSInfo = () => {
    const { dispatch } = this.props;
    const params = this.getRouteParams();
    dispatch({
      type: 'resourceCenterDetail/fetchWSInfo',
      payload: { team: params.teamName, region: params.regionName },
    });
  };

  fetchEvents = () => {
    const { dispatch, workloadDetail } = this.props;
    const params = this.getRouteParams();
    const summary = (workloadDetail && workloadDetail.summary) || {};
    dispatch({
      type: 'resourceCenterDetail/fetchEvents',
      payload: {
        team: params.teamName,
        region: params.regionName,
        namespace: summary.namespace,
        kind: summary.kind,
        name: summary.name,
      },
    });
  };

  handleTabChange = key => {
    this.setState({ activeTab: key });
    if (key === 'events') {
      this.fetchEvents();
    }
  };

  getCurrentPod() {
    const { workloadDetail } = this.props;
    const pods = (workloadDetail && workloadDetail.pods) || [];
    return pods.find(item => item.metadata.name === this.state.currentPodName) || pods[0] || null;
  }

  getCurrentContainerNames() {
    const pod = this.getCurrentPod();
    return (((pod || {}).spec || {}).containers || []).map(container => container.name);
  }

  jumpToPod = podName => {
    const { dispatch } = this.props;
    const params = this.getRouteParams();
    dispatch(routerRedux.push({
      pathname: `/team/${params.teamName}/region/${params.regionName}/resource-center/pods/${podName}`,
    }));
  };

  handleSaveYaml = () => {
    const { dispatch } = this.props;
    const params = this.getRouteParams();
    dispatch({
      type: 'resourceCenterDetail/saveYaml',
      payload: {
        team: params.teamName,
        region: params.regionName,
        group: params.group,
        version: params.version,
        resource: params.resource,
        name: params.name,
        yaml: this.state.yamlText,
      },
      callback: res => {
        if (res) {
          notification.success({ message: 'YAML 保存成功' });
          this.fetchDetail();
        }
      },
    });
  };

  renderOverview() {
    const { workloadDetail } = this.props;
    const summary = (workloadDetail && workloadDetail.summary) || {};
    const workload = (workloadDetail && workloadDetail.workload) || {};
    const labels = (((workload || {}).metadata || {}).labels) || {};
    const selectors = summary.selector || {};

    return (
      <div>
        <div className={styles.heroStats}>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>状态</div>
            <div className={styles.statValue}>{summary.status || '-'}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>就绪副本</div>
            <div className={styles.statValue}>{`${summary.ready_replicas || 0}/${summary.replicas || 0}`}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>实例数量</div>
            <div className={styles.statValue}>{((workloadDetail && workloadDetail.pods) || []).length}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>访问方式</div>
            <div className={styles.statValue}>{`${((workloadDetail && workloadDetail.services) || []).length} 服务`}</div>
          </div>
        </div>

        <div className={styles.overviewGrid}>
          <Card bordered={false} className={styles.infoCard} title={<span className={styles.cardTitle}>基本信息</span>}>
            <div className={styles.infoList}>
              <div className={styles.infoLabel}>资源名称</div>
              <div className={styles.infoValue}>{summary.name || '-'}</div>
              <div className={styles.infoLabel}>资源类型</div>
              <div className={styles.infoValue}>{summary.kind || '-'}</div>
              <div className={styles.infoLabel}>命名空间</div>
              <div className={styles.infoValue}>{summary.namespace || '-'}</div>
              <div className={styles.infoLabel}>创建时间</div>
              <div className={styles.infoValue}>{summary.created_at || '-'}</div>
              <div className={styles.infoLabel}>API Version</div>
              <div className={styles.infoValue}>{workload.apiVersion || '-'}</div>
            </div>
          </Card>

          <Card bordered={false} className={styles.infoCard} title={<span className={styles.cardTitle}>标签与选择器</span>}>
            <div className={styles.infoList}>
              <div className={styles.infoLabel}>选择器</div>
              <div className={styles.infoValue}>
                <div className={styles.tagList}>
                  {Object.keys(selectors).length > 0
                    ? Object.keys(selectors).map(key => <Tag key={key}>{`${key}=${selectors[key]}`}</Tag>)
                    : '-'}
                </div>
              </div>
              <div className={styles.infoLabel}>资源标签</div>
              <div className={styles.infoValue}>
                <div className={styles.tagList}>
                  {Object.keys(labels).length > 0
                    ? Object.keys(labels).map(key => <Tag key={key}>{`${key}=${labels[key]}`}</Tag>)
                    : '-'}
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  renderPodsTab() {
    const { workloadDetail } = this.props;
    const pods = (workloadDetail && workloadDetail.pods) || [];
    const columns = [
      {
        title: '实例名称',
        dataIndex: 'metadata.name',
        key: 'name',
        render: (_, record) => (
          <span className={styles.nameLink} onClick={() => this.jumpToPod(record.metadata.name)}>
            {record.metadata.name}
          </span>
        ),
      },
      {
        title: '状态',
        dataIndex: 'status.phase',
        key: 'phase',
        width: 120,
        render: value => <span className={`${styles.statusDot} ${getStatusClass(value)}`}>{value || '-'}</span>,
      },
      {
        title: '节点',
        dataIndex: 'spec.nodeName',
        key: 'nodeName',
        render: value => value || '-',
      },
      {
        title: 'Pod IP',
        dataIndex: 'status.podIP',
        key: 'podIP',
        render: value => value ? <span className={styles.monoText}>{value}</span> : '-',
      },
      {
        title: '容器数',
        key: 'containers',
        width: 88,
        render: (_, record) => ((((record || {}).spec || {}).containers) || []).length,
      },
      {
        title: '创建时间',
        dataIndex: 'metadata.creationTimestamp',
        key: 'creationTimestamp',
        width: 180,
        render: value => value || '-',
      },
    ];

    return (
      <div>
        <div className={styles.toolbar}>
          <div className={styles.toolbarMeta}>
            <span>工作负载实例会直接联动到容器组详情页</span>
            <span className={styles.toolbarDot} />
            <span>点击实例名称可继续查看日志与终端</span>
          </div>
        </div>
        <div className={styles.tableShell}>
          <Table
            rowKey={record => record.metadata.uid || record.metadata.name}
            dataSource={pods}
            columns={columns}
            pagination={pods.length > 10 ? { pageSize: 10, size: 'small' } : false}
            locale={{ emptyText: <Empty description="暂无实例" /> }}
          />
        </div>
      </div>
    );
  }

  renderAccessTab() {
    const { workloadDetail } = this.props;
    const services = (workloadDetail && workloadDetail.services) || [];
    const ingresses = (workloadDetail && workloadDetail.ingresses) || [];

    const serviceColumns = [
      { title: '服务名称', dataIndex: 'metadata.name', key: 'name' },
      { title: '类型', dataIndex: 'spec.type', key: 'type', width: 120, render: value => value || 'ClusterIP' },
      { title: 'Cluster IP', dataIndex: 'spec.clusterIP', key: 'clusterIP', render: value => value ? <span className={styles.monoText}>{value}</span> : '-' },
      { title: '端口', key: 'ports', render: (_, record) => formatPorts(record.spec.ports) },
    ];

    const ingressColumns = [
      { title: '路由名称', dataIndex: 'metadata.name', key: 'name' },
      { title: 'Host', key: 'host', render: (_, record) => formatIngressRules(record) },
      {
        title: '后端服务',
        key: 'backend',
        render: (_, record) => {
          const rules = (((record || {}).spec || {}).rules) || [];
          const values = [];
          rules.forEach(rule => {
            (((rule || {}).http || {}).paths || []).forEach(path => {
              const service = (((path || {}).backend || {}).service || {}).name;
              if (service) {
                values.push(service);
              }
            });
          });
          return values.join(' , ') || '-';
        },
      },
    ];

    return (
      <div>
        <Card bordered={false} className={styles.infoCard} title={<span className={styles.cardTitle}>服务</span>}>
          <Table
            rowKey={record => record.metadata.uid || record.metadata.name}
            dataSource={services}
            columns={serviceColumns}
            pagination={false}
            locale={{ emptyText: <Empty description="暂无服务暴露" /> }}
          />
        </Card>
        <Card bordered={false} className={`${styles.infoCard} ${styles.sectionSplit}`} title={<span className={styles.cardTitle}>路由规则</span>}>
          <Table
            rowKey={record => record.metadata.uid || record.metadata.name}
            dataSource={ingresses}
            columns={ingressColumns}
            pagination={false}
            locale={{ emptyText: <Empty description="暂无路由规则" /> }}
          />
        </Card>
      </div>
    );
  }

  renderEventsTab() {
    const { events, eventsLoading } = this.props;
    const columns = [
      { title: '类型', dataIndex: 'type', key: 'type', width: 100 },
      { title: '原因', dataIndex: 'reason', key: 'reason', width: 160 },
      { title: '消息', dataIndex: 'message', key: 'message' },
      { title: '次数', dataIndex: 'count', key: 'count', width: 90 },
      { title: '最后时间', dataIndex: 'last_timestamp', key: 'last_timestamp', width: 180 },
    ];

    return (
      <Spin spinning={eventsLoading}>
        <Table
          rowKey={(record, index) => `${record.reason}-${index}`}
          dataSource={events}
          columns={columns}
          pagination={events.length > 10 ? { pageSize: 10, size: 'small' } : false}
          locale={{ emptyText: <Empty description="暂无事件" /> }}
        />
      </Spin>
    );
  }

  renderLogsTab() {
    const pod = this.getCurrentPod();
    const pods = (this.props.workloadDetail && this.props.workloadDetail.pods) || [];
    const containers = (((pod || {}).spec || {}).containers || []).map(item => item.name);
    return (
      <div>
        <div className={styles.toolbar}>
          <div className={styles.toolbarMeta}>
            <span>日志沿用现有 Rainbond 终端风格</span>
            <span className={styles.toolbarDot} />
            <span>默认聚焦当前工作负载实例</span>
          </div>
          <div className={styles.toolbarActions}>
            <Select
              value={this.state.currentPodName || undefined}
              style={{ width: 260 }}
              onChange={value => this.setState({ currentPodName: value })}
            >
              {pods.map(item => (
                <Option key={item.metadata.name} value={item.metadata.name}>{item.metadata.name}</Option>
              ))}
            </Select>
          </div>
        </div>
        <PodLogStream
          active={this.state.activeTab === 'logs'}
          teamName={this.getRouteParams().teamName}
          regionName={this.getRouteParams().regionName}
          podName={pod && pod.metadata.name}
          containers={containers}
          title="工作负载实例日志"
        />
      </div>
    );
  }

  renderYamlTab() {
    return (
      <div className={styles.yamlPanel}>
        <div className={styles.yamlHint}>YAML 是当前工作负载的原始资源定义。你可以直接修改后保存。</div>
        <TextArea
          rows={28}
          value={this.state.yamlText}
          onChange={e => this.setState({ yamlText: e.target.value })}
          className={styles.yamlEditor}
        />
        <div className={styles.yamlActions}>
          <Button onClick={this.fetchDetail}>重置</Button>
          <Button type="primary" onClick={this.handleSaveYaml}>保存 YAML</Button>
        </div>
      </div>
    );
  }

  render() {
    const { workloadDetail, detailLoading, wsInfo } = this.props;
    const summary = (workloadDetail && workloadDetail.summary) || {};
    const pods = (workloadDetail && workloadDetail.pods) || [];
    const currentPod = this.getCurrentPod();
    const menu = (
      <Menu onClick={({ key }) => {
        this.setState({ activeTab: key });
        if (key === 'events') {
          this.fetchEvents();
        }
      }}>
        <Menu.Item key="yaml">前往 YAML</Menu.Item>
        <Menu.Item key="events">查看事件</Menu.Item>
      </Menu>
    );

    return (
      <div className={styles.detailPage}>
        <div className={styles.detailHeader}>
          <div className={styles.breadcrumb}>K8S 原生资源 / 工作负载 / {summary.name || this.getRouteParams().name}</div>
          <div className={styles.headerRow}>
            <div className={styles.titleWrap}>
              <span className={styles.eyebrow}>Trust & Authority Console</span>
              <div className={styles.titleLine}>
                <h1 className={styles.title}>{summary.name || '-'}</h1>
                <span className={`${styles.statusDot} ${getStatusClass(summary.status)}`}>{summary.status || 'Unknown'}</span>
                <Tag color="blue">{summary.kind || this.getRouteParams().resource}</Tag>
              </div>
              <div className={styles.summaryText}>
                这里聚焦工作负载本身、实例列表、访问方式、事件、日志与 YAML。容器组详情会从实例列表继续下钻。
              </div>
            </div>
            <div className={styles.headerActions}>
              <Button
                type="primary"
                icon="code"
                onClick={() => this.setState({ terminalVisible: true })}
                disabled={!currentPod}
              >
                Web 终端
              </Button>
              <Button icon="reload" onClick={this.fetchDetail}>刷新</Button>
              <Dropdown overlay={menu} trigger={['click']}>
                <Button icon="ellipsis" />
              </Dropdown>
            </div>
          </div>
        </div>

        <Spin spinning={detailLoading}>
          <Card bordered={false} className={styles.workspaceCard} bodyStyle={{ padding: '22px 24px 28px' }}>
            <Tabs activeKey={this.state.activeTab} onChange={this.handleTabChange}>
              <TabPane tab="概览" key="overview">{this.renderOverview()}</TabPane>
              <TabPane tab="实例列表" key="pods">{this.renderPodsTab()}</TabPane>
              <TabPane tab="访问方式" key="access">{this.renderAccessTab()}</TabPane>
              <TabPane tab="事件" key="events">{this.renderEventsTab()}</TabPane>
              <TabPane tab="日志" key="logs">{this.renderLogsTab()}</TabPane>
              <TabPane tab="YAML" key="yaml">{this.renderYamlTab()}</TabPane>
            </Tabs>
          </Card>
        </Spin>

        <TerminalModal
          visible={this.state.terminalVisible}
          onCancel={() => this.setState({ terminalVisible: false })}
          websocketURL={wsInfo && wsInfo.event_websocket_url}
          podName={currentPod && currentPod.metadata.name}
          namespace={(wsInfo && wsInfo.namespace) || ((summary && summary.namespace) || '')}
          containers={this.getCurrentContainerNames()}
        />

        {!detailLoading && !workloadDetail && (
          <Card bordered={false} className={styles.workspaceCard}>
            <Empty description="未找到工作负载详情" />
          </Card>
        )}
      </div>
    );
  }
}

export default WorkloadDetail;
