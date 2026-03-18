const WORKLOAD_KIND_OPTIONS = [
  { label: '无状态组件', value: 'deployments', group: 'apps', kind: 'Deployment' },
  { label: '有状态组件', value: 'statefulsets', group: 'apps', kind: 'StatefulSet' },
  { label: '守护进程组件', value: 'daemonsets', group: 'apps', kind: 'DaemonSet' },
  { label: '定时任务', value: 'cronjobs', group: 'batch', kind: 'CronJob' },
];

const STATUS_META = {
  running: { color: '#00D777', text: '运行中', tone: 'running' },
  active: { color: '#00D777', text: '运行中', tone: 'running' },
  ready: { color: '#00D777', text: '已就绪', tone: 'running' },
  available: { color: '#00D777', text: '可用', tone: 'running' },
  bound: { color: '#155aef', text: '已绑定', tone: 'running' },
  deployed: { color: '#00D777', text: '已部署', tone: 'running' },
  succeeded: { color: '#00D777', text: '已完成', tone: 'running' },
  completed: { color: '#00D777', text: '已完成', tone: 'running' },
  pending: { color: '#F69D4A', text: '等待中', tone: 'warning' },
  warning: { color: '#F69D4A', text: '警告', tone: 'warning' },
  starting: { color: '#F69D4A', text: '启动中', tone: 'warning' },
  creating: { color: '#F69D4A', text: '创建中', tone: 'warning' },
  containercreating: { color: '#F69D4A', text: '创建中', tone: 'warning' },
  podinitializing: { color: '#F69D4A', text: '初始化中', tone: 'warning' },
  terminating: { color: '#F69D4A', text: '终止中', tone: 'warning' },
  uninstalling: { color: '#F69D4A', text: '卸载中', tone: 'warning' },
  superseded: { color: '#8d9bad', text: '已替换', tone: 'default' },
  failed: { color: '#CD0200', text: '异常', tone: 'error' },
  error: { color: '#CD0200', text: '异常', tone: 'error' },
  abnormal: { color: '#CD0200', text: '异常', tone: 'error' },
  crashloopbackoff: { color: '#CD0200', text: '异常', tone: 'error' },
  imagepullbackoff: { color: '#CD0200', text: '镜像拉取失败', tone: 'error' },
  errimagepull: { color: '#CD0200', text: '镜像拉取失败', tone: 'error' },
  unknown: { color: '#8d9bad', text: '未知', tone: 'default' },
  terminated: { color: '#8d9bad', text: '已终止', tone: 'default' },
};

function normalizeValue(value) {
  return (value || '').toString().trim().toLowerCase();
}

export function getResourceStatusMeta(status) {
  const normalized = normalizeValue(status);
  return STATUS_META[normalized] || {
    color: '#8d9bad',
    text: status || '-',
    tone: 'default',
  };
}

export function getResourceStatusText(status) {
  return getResourceStatusMeta(status).text;
}

export function getResourceStatusTone(status) {
  return getResourceStatusMeta(status).tone;
}

export function getWorkloadKindLabel(value) {
  const normalized = normalizeValue(value);
  const matched = WORKLOAD_KIND_OPTIONS.find(item => (
    normalizeValue(item.value) === normalized || normalizeValue(item.kind) === normalized
  ));
  return matched ? matched.label : value || '-';
}

export { WORKLOAD_KIND_OPTIONS };
