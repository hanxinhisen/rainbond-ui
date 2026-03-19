import React, { PureComponent } from 'react';
import { connect } from 'dva';
import { routerRedux } from 'dva/router';
import {
  Button,
  Card,
  Empty,
  Input,
  notification,
  Table,
  Tabs,
  Tag,
} from 'antd';
import jsYaml from 'js-yaml';
import PodLogStream from './components/PodLogStream';
import TerminalModal from './components/TerminalModal';
import styles from './detail.less';
import { getResourceStatusText, getResourceStatusTone } from './utils';

const { TextArea } = Input;
const { TabPane } = Tabs;

function getStatusClass(status) {
  const tone = getResourceStatusTone(status);
  if (tone === 'running') {
    return styles.statusRunning;
  }
  if (tone === 'warning') {
    return styles.statusWarning;
  }
  if (tone === 'error') {
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

function formatPorts(containers) {
  const result = [];
  (containers || []).forEach(container => {
    (((container || {}).ports) || []).forEach(port => {
      result.push(`${container.name}:${port.containerPort}/${port.protocol || 'TCP'}`);
    });
  });
  return result.join(' , ') || '-';
}

@connect(({ resourceCenterDetail, loading }) => ({
  podDetail: resourceCenterDetail.podDetail,
  events: resourceCenterDetail.events,
  wsInfo: resourceCenterDetail.wsInfo,
  detailLoading: loading.effects['resourceCenterDetail/fetchPodDetail'],
  eventsLoading: loading.effects['resourceCenterDetail/fetchEvents'],
}))
class PodDetail extends PureComponent {
  state = {
    activeTab: 'overview',
    yamlText: '',
    terminalVisible: false,
  };

  componentDidMount() {
    this.fetchDetail();
    this.fetchWSInfo();
  }

  getRouteParams() {
    const { match } = this.props;
    return (match && match.params) || {};
  }

  fetchDetail = () => {
    const { dispatch } = this.props;
    const params = this.getRouteParams();
    dispatch({
      type: 'resourceCenterDetail/fetchPodDetail',
      payload: {
        team: params.teamName,
        region: params.regionName,
        pod_name: params.podName || params.name,
      },
      callback: bean => {
        this.setState({ yamlText: safeYaml(bean && bean.pod) });
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
    const { dispatch, podDetail } = this.props;
    const params = this.getRouteParams();
    const summary = (podDetail && podDetail.summary) || {};
    dispatch({
      type: 'resourceCenterDetail/fetchEvents',
      payload: {
        team: params.teamName,
        region: params.regionName,
        namespace: summary.namespace,
        kind: 'Pod',
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

  getContainerNames() {
    return ((this.props.podDetail && this.props.podDetail.containers) || []).map(item => item.name);
  }

  getResourceCenterRoute() {
    const params = this.getRouteParams();
    return {
      pathname: `/team/${params.teamName}/region/${params.regionName}/resource-center`,
    };
  }

  getPodListRoute() {
    const params = this.getRouteParams();
    return {
      pathname: `/team/${params.teamName}/region/${params.regionName}/resource-center`,
      query: {
        tab: 'pod',
      },
    };
  }

  goToResourceCenter = () => {
    const { dispatch } = this.props;
    dispatch(routerRedux.push(this.getResourceCenterRoute()));
  };

  goToPodList = () => {
    const { dispatch } = this.props;
    dispatch(routerRedux.push(this.getPodListRoute()));
  };

  handleSaveYaml = () => {
    const { dispatch } = this.props;
    const params = this.getRouteParams();
    dispatch({
      type: 'resourceCenterDetail/saveYaml',
      payload: {
        team: params.teamName,
        region: params.regionName,
        group: '',
        version: 'v1',
        resource: 'pods',
        name: params.podName || params.name,
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
    const { podDetail } = this.props;
    const summary = (podDetail && podDetail.summary) || {};
    const pod = (podDetail && podDetail.pod) || {};
    const labels = (((pod || {}).metadata || {}).labels) || {};

    return (
      <div>
        <div className={styles.heroStats}>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>运行状态</div>
            <div className={styles.statValue}>{getResourceStatusText(summary.phase)}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Pod IP</div>
            <div className={styles.statValue}>{summary.pod_ip || '-'}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>节点</div>
            <div className={styles.statValue}>{summary.node_name || '-'}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>容器数</div>
            <div className={styles.statValue}>{((podDetail && podDetail.containers) || []).length}</div>
          </div>
        </div>

        <div className={styles.overviewGrid}>
          <Card bordered={false} className={styles.infoCard} title={<span className={styles.cardTitle}>基本信息</span>}>
            <div className={styles.infoList}>
              <div className={styles.infoLabel}>名称</div>
              <div className={styles.infoValue}>{summary.name || '-'}</div>
              <div className={styles.infoLabel}>命名空间</div>
              <div className={styles.infoValue}>{summary.namespace || '-'}</div>
              <div className={styles.infoLabel}>创建时间</div>
              <div className={styles.infoValue}>{summary.created_at || '-'}</div>
              <div className={styles.infoLabel}>端口</div>
              <div className={styles.infoValue}>{formatPorts((pod || {}).spec && pod.spec.containers)}</div>
            </div>
          </Card>
          <Card bordered={false} className={styles.infoCard} title={<span className={styles.cardTitle}>标签</span>}>
            <div className={styles.tagList}>
              {Object.keys(labels).length > 0
                ? Object.keys(labels).map(key => <Tag key={key}>{`${key}=${labels[key]}`}</Tag>)
                : '-'}
            </div>
          </Card>
        </div>
      </div>
    );
  }

  renderContainersTab() {
    const containers = (this.props.podDetail && this.props.podDetail.containers) || [];
    const columns = [
      { title: '容器名称', dataIndex: 'name', key: 'name' },
      { title: '镜像', dataIndex: 'image', key: 'image' },
      { title: '就绪', dataIndex: 'ready', key: 'ready', width: 100, render: value => value ? '是' : '否' },
      { title: '重启次数', dataIndex: 'restart_count', key: 'restart_count', width: 100 },
    ];
    return (
      <Table
        rowKey="name"
        dataSource={containers}
        columns={columns}
        pagination={false}
        locale={{ emptyText: <Empty description="暂无容器信息" /> }}
      />
    );
  }

  renderAccessTab() {
    const services = (this.props.podDetail && this.props.podDetail.services) || [];
    const ingresses = (this.props.podDetail && this.props.podDetail.ingresses) || [];
    const serviceColumns = [
      { title: '服务名称', dataIndex: 'metadata.name', key: 'name' },
      { title: '类型', dataIndex: 'spec.type', key: 'type', width: 120, render: value => value || 'ClusterIP' },
      { title: 'Cluster IP', dataIndex: 'spec.clusterIP', key: 'clusterIP', render: value => value ? <span className={styles.monoText}>{value}</span> : '-' },
      {
        title: '端口',
        key: 'ports',
        render: (_, record) => (((record || {}).spec || {}).ports || []).map(port => `${port.port}/${port.protocol || 'TCP'}`).join(' , ') || '-',
      },
    ];
    const ingressColumns = [
      { title: '路由名称', dataIndex: 'metadata.name', key: 'name' },
      {
        title: 'Host',
        key: 'host',
        render: (_, record) => ((((record || {}).spec || {}).rules) || []).map(rule => rule.host).filter(Boolean).join(' , ') || '-',
      },
    ];

    return (
      <div>
        <Card bordered={false} className={styles.infoCard} title={<span className={styles.cardTitle}>关联服务</span>}>
          <Table rowKey={record => record.metadata.uid || record.metadata.name} dataSource={services} columns={serviceColumns} pagination={false} locale={{ emptyText: <Empty description="暂无关联服务" /> }} />
        </Card>
        <Card bordered={false} className={`${styles.infoCard} ${styles.sectionSplit}`} title={<span className={styles.cardTitle}>关联路由</span>}>
          <Table rowKey={record => record.metadata.uid || record.metadata.name} dataSource={ingresses} columns={ingressColumns} pagination={false} locale={{ emptyText: <Empty description="暂无关联路由" /> }} />
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
      <Table
        loading={eventsLoading}
        rowKey={(record, index) => `${record.reason}-${index}`}
        dataSource={events}
        columns={columns}
        pagination={events.length > 10 ? { pageSize: 10, size: 'small' } : false}
        locale={{ emptyText: <Empty description="暂无事件" /> }}
      />
    );
  }

  renderLogsTab() {
    const podName = ((this.props.podDetail || {}).summary || {}).name;
    return (
      <PodLogStream
        active={this.state.activeTab === 'logs'}
        teamName={this.getRouteParams().teamName}
        regionName={this.getRouteParams().regionName}
        podName={podName}
        containers={this.getContainerNames()}
        title="容器组日志"
      />
    );
  }

  renderYamlTab() {
    return (
      <div className={styles.yamlPanel}>
        <div className={styles.yamlHint}>YAML 与当前容器组对象保持一致，可直接查看或编辑保存。</div>
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
    const { podDetail, detailLoading, wsInfo } = this.props;
    const summary = (podDetail && podDetail.summary) || {};

    return (
      <div className={styles.detailPage}>
        <div className={styles.detailHeader}>
          <div className={styles.breadcrumb}>
            <button type="button" className={styles.breadcrumbLink} onClick={this.goToResourceCenter}>
              K8S 原生资源
            </button>
            <span className={styles.breadcrumbSeparator}>/</span>
            <button type="button" className={styles.breadcrumbLink} onClick={this.goToPodList}>
              容器组
            </button>
            <span className={styles.breadcrumbSeparator}>/</span>
            <span>{summary.name || this.getRouteParams().name}</span>
          </div>
          <div className={styles.headerRow}>
            <div className={styles.titleWrap}>
              <span className={styles.eyebrow}>Pod Detail Workspace</span>
              <div className={styles.titleLine}>
                <h1 className={styles.title}>{summary.name || '-'}</h1>
                <span className={`${styles.statusDot} ${getStatusClass(summary.phase)}`}>{getResourceStatusText(summary.phase)}</span>
                <Tag color="blue">容器组</Tag>
              </div>
              <div className={styles.summaryText}>
                容器组详情保持与现有 Rainbond 体系一致，重点提供概览、容器、访问方式、事件、日志、终端与 YAML。
              </div>
            </div>
            <div className={styles.headerActions}>
              <Button icon="left" onClick={this.goToPodList}>
                返回容器组
              </Button>
              <Button type="primary" icon="code" onClick={() => this.setState({ terminalVisible: true })}>
                Web 终端
              </Button>
            </div>
          </div>
        </div>

        <Card bordered={false} className={styles.workspaceCard} bodyStyle={{ padding: '22px 24px 28px' }}>
          <Tabs activeKey={this.state.activeTab} onChange={this.handleTabChange}>
            <TabPane tab="概览" key="overview">{this.renderOverview()}</TabPane>
            <TabPane tab="容器列表" key="containers">{this.renderContainersTab()}</TabPane>
            <TabPane tab="访问方式" key="access">{this.renderAccessTab()}</TabPane>
            <TabPane tab="事件" key="events">{this.renderEventsTab()}</TabPane>
            <TabPane tab="日志" key="logs">{this.renderLogsTab()}</TabPane>
            <TabPane tab="YAML" key="yaml">{this.renderYamlTab()}</TabPane>
          </Tabs>
        </Card>

        <TerminalModal
          visible={this.state.terminalVisible}
          onCancel={() => this.setState({ terminalVisible: false })}
          websocketURL={wsInfo && wsInfo.event_websocket_url}
          podName={summary.name}
          namespace={(wsInfo && wsInfo.namespace) || summary.namespace}
          containers={this.getContainerNames()}
        />

        {!detailLoading && !podDetail && (
          <Card bordered={false} className={styles.workspaceCard}>
            <Empty description="未找到容器组详情" />
          </Card>
        )}
      </div>
    );
  }
}

export default PodDetail;
