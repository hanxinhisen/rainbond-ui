import { getInnerEnvs, getOuterEnvs } from '../services/app';

const STORAGE_KEY = 'rainbond_app_version_mock_v1';

export const APP_VERSION_MOCK_EVENT = 'app-version-mock-updated';

function canUseStorage() {
  return typeof window !== 'undefined' && window.localStorage;
}

function safeParse(value, fallback) {
  if (!value) {
    return fallback;
  }
  try {
    return JSON.parse(value);
  } catch (error) {
    return fallback;
  }
}

function readStore() {
  if (!canUseStorage()) {
    return {};
  }
  return safeParse(window.localStorage.getItem(STORAGE_KEY), {});
}

function writeStore(store) {
  if (!canUseStorage()) {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function emitUpdate(appId) {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') {
    return;
  }
  window.dispatchEvent(
    new CustomEvent(APP_VERSION_MOCK_EVENT, {
      detail: { appId }
    })
  );
}

function pad(num) {
  return `${num}`.padStart(2, '0');
}

function toList(apps) {
  if (!Array.isArray(apps)) {
    return [];
  }
  return apps;
}

function getComponentName(app) {
  return app.service_cname || app.k8s_component_name || app.service_alias || '未命名组件';
}

function componentTagList(apps) {
  return toList(apps)
    .slice()
    .sort((a, b) => getComponentName(a).localeCompare(getComponentName(b)))
    .slice(0, 3)
    .map(item => getComponentName(item));
}

function normalizeEnvList(list = []) {
  return list
    .map(item => ({
      attr_name: item.attr_name || '',
      attr_value: item.attr_value || '',
      name: item.name || '',
      scope: item.scope || '',
      is_change: !!item.is_change
    }))
    .sort((a, b) => {
      const left = `${a.attr_name}:${a.attr_value}:${a.scope}`;
      const right = `${b.attr_name}:${b.attr_value}:${b.scope}`;
      return left.localeCompare(right);
    });
}

function captureComponentState(apps, envStateMap = {}) {
  return toList(apps)
    .slice()
    .sort((a, b) => {
      const left = a.service_alias || '';
      const right = b.service_alias || '';
      return left.localeCompare(right);
    })
      .map(app => ({
        service_alias: app.service_alias || '',
        service_cname: getComponentName(app),
        status: app.status || '',
        service_source: app.service_source || '',
        deploy_version: app.deploy_version || '',
        build_version: app.build_version || '',
        update_time: app.update_time || '',
        inner_envs: normalizeEnvList((envStateMap[app.service_alias] && envStateMap[app.service_alias].inner) || []),
        outer_envs: normalizeEnvList((envStateMap[app.service_alias] && envStateMap[app.service_alias].outer) || [])
      }));
}

export function buildAppSnapshotSignature(apps) {
  return JSON.stringify(captureComponentState(apps));
}

async function fetchComponentEnvState(teamName, serviceAlias) {
  try {
    const [innerRes, outerRes] = await Promise.all([
      getInnerEnvs({
        team_name: teamName,
        app_alias: serviceAlias,
        page: 1,
        page_size: 200
      }),
      getOuterEnvs({
        team_name: teamName,
        app_alias: serviceAlias,
        page: 1,
        page_size: 200
      })
    ]);
    return {
      inner: (innerRes && innerRes.list) || [],
      outer: (outerRes && outerRes.list) || []
    };
  } catch (error) {
    return {
      inner: [],
      outer: []
    };
  }
}

export async function fetchComponentSnapshotState(teamName, apps) {
  const envEntries = await Promise.all(
    toList(apps).map(async app => {
      const alias = app.service_alias || '';
      if (!alias) {
        return [alias, { inner: [], outer: [] }];
      }
      const envState = await fetchComponentEnvState(teamName, alias);
      return [alias, envState];
    })
  );
  const envStateMap = {};
  envEntries.forEach(([alias, envState]) => {
    if (alias) {
      envStateMap[alias] = envState;
    }
  });
  return captureComponentState(apps, envStateMap);
}

export async function buildAppSnapshotSignatureAsync(teamName, apps) {
  const componentStates = await fetchComponentSnapshotState(teamName, apps);
  return JSON.stringify(componentStates);
}

function nextVersion(version) {
  const matched = `${version || ''}`.match(/^v?(\d+)\.(\d+)\.(\d+)$/);
  if (!matched) {
    return 'v1.0.0';
  }
  const major = parseInt(matched[1], 10);
  const minor = parseInt(matched[2], 10);
  const patch = parseInt(matched[3], 10) + 1;
  return `v${major}.${minor}.${patch}`;
}

function createSeedSnapshots(appName, apps, sourceGroups = []) {
  const names = componentTagList(apps);
  const currentComponents = captureComponentState(apps);
  const latestComponents = currentComponents.map(item => ({
    ...item,
    deploy_version: item.deploy_version || 'v2.0.1'
  }));
  const middleComponents = currentComponents.map(item => ({
    ...item,
    deploy_version: item.deploy_version || 'v1.5.0',
    build_version: item.build_version || 'build-15'
  }));
  const initialComponents = currentComponents
    .slice(0, Math.max(currentComponents.length - 1, 1))
    .map(item => ({
      ...item,
      deploy_version: 'v1.0.0',
      build_version: '',
      update_time: ''
    }));
  const now = Date.now();
  return [
    {
      id: `seed-${now}-latest`,
      version: 'v2.0.1',
      title: `${appName || '当前应用'}稳定基线`,
      note: '最近一次可发布的稳定基线，建议作为团队模板来源。',
      createdAt: now - 1000 * 60 * 60 * 26,
      createdBy: 'Rainbond',
      componentCount: toList(apps).length,
      componentNames: names,
      components: latestComponents,
      sourceGroups,
      sharedTargets: ['team'],
      publishedToTeam: true,
      publishedVersion: '团队模板 v2.0.1'
    },
    {
      id: `seed-${now}-mid`,
      version: 'v1.5.0',
      title: '数据库联调快照',
      note: '用于联调 PostgreSQL 与 Redis 依赖关系的阶段版本。',
      createdAt: now - 1000 * 60 * 60 * 24 * 6,
      createdBy: 'Rainbond',
      componentCount: Math.max(toList(apps).length - 1, 1),
      componentNames: names.length > 1 ? names.slice(0, 2) : names,
      components: middleComponents,
      sourceGroups,
      sharedTargets: [],
      publishedToTeam: false,
      publishedVersion: ''
    },
    {
      id: `seed-${now}-initial`,
      version: 'v1.0.0',
      title: '初始快照',
      note: '应用首次成型时留存的初始化快照。',
      createdAt: now - 1000 * 60 * 60 * 24 * 14,
      createdBy: 'Rainbond',
      componentCount: 1,
      componentNames: names.length > 0 ? [names[0]] : [],
      components: initialComponents,
      sourceGroups,
      sharedTargets: [],
      publishedToTeam: false,
      publishedVersion: ''
    }
  ];
}

function createSeedRecord(appId, appName, apps, currentSignature, sourceGroups = []) {
  const snapshots = createSeedSnapshots(appName, apps, sourceGroups);
  return {
    appId,
    appName,
    hasPendingChanges: true,
    lastObservedSignature: currentSignature,
    currentSnapshotId: snapshots[0].id,
    snapshots
  };
}

function mergeSourceGroups(baseGroups = [], latestGroups = []) {
  const latestMap = {};
  latestGroups.forEach(group => {
    latestMap[group.sourceKey] = group;
  });

  const merged = baseGroups.map(group => {
    const latest = latestMap[group.sourceKey];
    if (!latest) {
      return group;
    }
    return {
      ...latest,
      ...group,
      sourceName: group.sourceName || latest.sourceName,
      marketName: group.marketName || latest.marketName,
      componentAliases:
        Array.isArray(group.componentAliases) && group.componentAliases.length > 0
          ? group.componentAliases
          : latest.componentAliases,
      componentNames:
        Array.isArray(group.componentNames) && group.componentNames.length > 0
          ? group.componentNames
          : latest.componentNames,
      upgradeVersions:
        Array.isArray(group.upgradeVersions) && group.upgradeVersions.length > 0
          ? group.upgradeVersions
          : latest.upgradeVersions,
      canUpgrade: typeof group.canUpgrade === 'boolean' ? group.canUpgrade : latest.canUpgrade
    };
  });

  latestGroups.forEach(group => {
    const exists = merged.find(item => item.sourceKey === group.sourceKey);
    if (!exists) {
      merged.push(group);
    }
  });

  return merged;
}

function normalizeRecord(record, appId, appName, apps, currentSignature, sourceGroups = []) {
  let nextRecord = record;
  if (!nextRecord) {
    nextRecord = createSeedRecord(appId, appName, apps, currentSignature, sourceGroups);
  }

  if (appName && nextRecord.appName !== appName) {
    nextRecord.appName = appName;
  }

  if (
    currentSignature &&
    nextRecord.lastObservedSignature &&
    currentSignature !== nextRecord.lastObservedSignature
  ) {
    nextRecord.hasPendingChanges = true;
  }

  if (Array.isArray(nextRecord.snapshots)) {
    nextRecord.snapshots = nextRecord.snapshots.map(snapshot => ({
      ...snapshot,
      components: snapshot.components || captureComponentState(apps),
      sourceGroups:
        Array.isArray(snapshot.sourceGroups) && snapshot.sourceGroups.length > 0
          ? mergeSourceGroups(snapshot.sourceGroups, sourceGroups)
          : sourceGroups,
      sharedTargets: Array.isArray(snapshot.sharedTargets)
        ? snapshot.sharedTargets
        : snapshot.publishedToTeam
          ? ['team']
          : []
    }));
  }

  return nextRecord;
}

function persistRecord(record) {
  const store = readStore();
  store[record.appId] = record;
  writeStore(store);
  emitUpdate(record.appId);
  return record;
}

export function getAppVersionMockRecord({ appId, appName, apps }) {
  const store = readStore();
  const currentSignature = buildAppSnapshotSignature(apps);
  const record = normalizeRecord(store[appId], appId, appName, apps, currentSignature);
  if (!store[appId] || store[appId] !== record) {
    store[appId] = record;
    writeStore(store);
  }
  return record;
}

export async function getAppVersionMockRecordAsync({ appId, appName, teamName, apps, sourceGroups = [] }) {
  const store = readStore();
  const componentStates = await fetchComponentSnapshotState(teamName, apps);
  const currentSignature = JSON.stringify(componentStates);
  const record = normalizeRecord(store[appId], appId, appName, apps, currentSignature, sourceGroups);
  if (Array.isArray(record.snapshots)) {
    record.snapshots = record.snapshots.map(snapshot => ({
      ...snapshot,
      components: snapshot.components || componentStates,
      sourceGroups:
        Array.isArray(snapshot.sourceGroups) && snapshot.sourceGroups.length > 0
          ? mergeSourceGroups(snapshot.sourceGroups, sourceGroups)
          : sourceGroups
    }));
  }
  store[appId] = record;
  writeStore(store);
  return {
    record,
    componentStates,
    currentSignature
  };
}

export function getAppVersionMockSummary({ appId, appName, apps }) {
  const record = getAppVersionMockRecord({ appId, appName, apps });
  const currentSnapshot = record.snapshots.find(item => item.id === record.currentSnapshotId) || null;
  return {
    hasPendingChanges: !!record.hasPendingChanges,
    snapshotCount: record.snapshots.length,
    currentSnapshot
  };
}

export async function getAppVersionMockSummaryAsync({ appId, appName, teamName, apps, sourceGroups = [] }) {
  const result = await getAppVersionMockRecordAsync({ appId, appName, teamName, apps, sourceGroups });
  const currentSnapshot = result.record.snapshots.find(item => item.id === result.record.currentSnapshotId) || null;
  return {
    hasPendingChanges: !!result.record.hasPendingChanges,
    snapshotCount: result.record.snapshots.length,
    currentSnapshot,
    componentStates: result.componentStates,
    currentSignature: result.currentSignature,
    record: result.record
  };
}

export function createMockSnapshot({ appId, appName, apps, createdBy, note }) {
  const currentSignature = buildAppSnapshotSignature(apps);
  const record = getAppVersionMockRecord({ appId, appName, apps });
  const latestVersion = record.snapshots[0] && record.snapshots[0].version;
  const snapshot = {
    id: `snapshot-${Date.now()}`,
    version: nextVersion(latestVersion),
    title: note ? `快照 ${note}` : `${appName || '当前应用'}快照`,
    note: note || '通过前端原型创建的应用快照。',
    createdAt: Date.now(),
    createdBy: createdBy || '当前用户',
    componentCount: toList(apps).length,
    componentNames: componentTagList(apps),
    components: captureComponentState(apps),
    sharedTargets: [],
    publishedToTeam: false,
    publishedVersion: '',
    signature: currentSignature
  };
  record.snapshots = [snapshot].concat(record.snapshots);
  record.currentSnapshotId = snapshot.id;
  record.lastObservedSignature = currentSignature;
  record.hasPendingChanges = false;
  return persistRecord(record);
}

export async function createMockSnapshotAsync({ appId, appName, teamName, apps, createdBy, note, sourceGroups = [] }) {
  const result = await getAppVersionMockRecordAsync({ appId, appName, teamName, apps, sourceGroups });
  const record = result.record;
  const latestVersion = record.snapshots[0] && record.snapshots[0].version;
  const snapshot = {
    id: `snapshot-${Date.now()}`,
    version: nextVersion(latestVersion),
    title: note ? `快照 ${note}` : `${appName || '当前应用'}快照`,
    note: note || '通过前端原型创建的应用快照。',
    createdAt: Date.now(),
    createdBy: createdBy || '当前用户',
    componentCount: toList(apps).length,
    componentNames: componentTagList(apps),
    components: result.componentStates,
    sourceGroups,
    sharedTargets: [],
    publishedToTeam: false,
    publishedVersion: '',
    signature: result.currentSignature
  };
  record.snapshots = [snapshot].concat(record.snapshots);
  record.currentSnapshotId = snapshot.id;
  record.lastObservedSignature = result.currentSignature;
  record.hasPendingChanges = false;
  return persistRecord(record);
}

export function publishMockSnapshotToTeam({ appId, appName, apps, snapshotId }) {
  const record = getAppVersionMockRecord({ appId, appName, apps });
  record.snapshots = record.snapshots.map(snapshot => {
    if (snapshot.id !== snapshotId) {
      return snapshot;
    }
    return {
      ...snapshot,
      publishedToTeam: true,
      publishedVersion: `团队模板 ${snapshot.version}`
    };
  });
  return persistRecord(record);
}

export function shareMockSnapshot({ appId, appName, apps, snapshotId, target }) {
  const record = getAppVersionMockRecord({ appId, appName, apps });
  record.snapshots = record.snapshots.map(snapshot => {
    if (snapshot.id !== snapshotId) {
      return snapshot;
    }
    const currentTargets = Array.isArray(snapshot.sharedTargets) ? snapshot.sharedTargets : [];
    const nextTargets = currentTargets.includes(target) ? currentTargets : currentTargets.concat(target);
    return {
      ...snapshot,
      sharedTargets: nextTargets,
      publishedToTeam: nextTargets.includes('team'),
      publishedVersion: nextTargets.includes('team') ? `团队模板 ${snapshot.version}` : snapshot.publishedVersion
    };
  });
  return persistRecord(record);
}

export function formatSharedTargets(targets = []) {
  const targetMap = {
    team: '团队',
    enterprise: '企业'
  };
  const validTargets = (Array.isArray(targets) ? targets : []).filter(Boolean);
  if (validTargets.length === 0) {
    return '';
  }
  return validTargets.map(item => targetMap[item] || item).join(' / ');
}

export function rollbackMockSnapshot({ appId, appName, apps, snapshotId }) {
  const currentSignature = buildAppSnapshotSignature(apps);
  const record = getAppVersionMockRecord({ appId, appName, apps });
  record.currentSnapshotId = snapshotId;
  record.lastObservedSignature = currentSignature;
  record.hasPendingChanges = false;
  return persistRecord(record);
}

export function getPendingMockSummary(apps) {
  const names = componentTagList(apps);
  const count = toList(apps).length;
  if (count === 0) {
    return '暂无可用于快照的组件。';
  }
  if (count === 1) {
    return `${names[0]} 存在未快照的组件变更。`;
  }
  return `${names.join('、')} 等 ${count} 个组件存在未快照的变更。`;
}

function mapFieldLabel(field) {
  const fieldMap = {
    service_cname: '组件名称',
    status: '运行状态',
    service_source: '组件来源',
    deploy_version: '部署版本',
    build_version: '构建版本',
    update_time: '组件配置',
    inner_envs: '内部环境变量',
    outer_envs: '对外环境变量'
  };
  return fieldMap[field] || field;
}

export function compareComponentStates(baseComponents = [], targetComponents = []) {
  const baseMap = {};
  const targetMap = {};
  baseComponents.forEach(item => {
    baseMap[item.service_alias] = item;
  });
  targetComponents.forEach(item => {
    targetMap[item.service_alias] = item;
  });

  const added = [];
  const removed = [];
  const changed = [];

  Object.keys(targetMap).forEach(alias => {
    if (!baseMap[alias]) {
      added.push(targetMap[alias]);
      return;
    }
    const diffFields = [];
    ['service_cname', 'status', 'service_source', 'deploy_version', 'build_version', 'update_time', 'inner_envs', 'outer_envs'].forEach(field => {
      if ((baseMap[alias][field] || '') !== (targetMap[alias][field] || '')) {
        diffFields.push(mapFieldLabel(field));
      }
    });
    if (diffFields.length > 0) {
      changed.push({
        service_alias: alias,
        service_cname: targetMap[alias].service_cname || baseMap[alias].service_cname || alias,
        fields: diffFields
      });
    }
  });

  Object.keys(baseMap).forEach(alias => {
    if (!targetMap[alias]) {
      removed.push(baseMap[alias]);
    }
  });

  return {
    added,
    removed,
    changed
  };
}

export function buildDiffSummary(diff) {
  const addedCount = diff && diff.added ? diff.added.length : 0;
  const removedCount = diff && diff.removed ? diff.removed.length : 0;
  const changedCount = diff && diff.changed ? diff.changed.length : 0;
  const parts = [];
  if (addedCount > 0) {
    parts.push(`新增 ${addedCount} 个组件`);
  }
  if (changedCount > 0) {
    parts.push(`修改 ${changedCount} 个组件`);
  }
  if (removedCount > 0) {
    parts.push(`删除 ${removedCount} 个组件`);
  }
  return {
    addedCount,
    changedCount,
    removedCount,
    text: parts.length > 0 ? parts.join('，') : '无可见改动'
  };
}

export function getWorkingDiff({ appId, appName, apps }) {
  const record = getAppVersionMockRecord({ appId, appName, apps });
  const currentSnapshot = record.snapshots.find(item => item.id === record.currentSnapshotId) || record.snapshots[0];
  const workingComponents = captureComponentState(apps);
  const diff = compareComponentStates(
    currentSnapshot && currentSnapshot.components ? currentSnapshot.components : [],
    workingComponents
  );
  return {
    currentSnapshot,
    diff,
    summary: buildDiffSummary(diff)
  };
}

export function getSnapshotDiff({ appId, appName, apps, snapshotId }) {
  const record = getAppVersionMockRecord({ appId, appName, apps });
  const index = record.snapshots.findIndex(item => item.id === snapshotId);
  const snapshot = index > -1 ? record.snapshots[index] : null;
  const previousSnapshot = index > -1 ? record.snapshots[index + 1] : null;
  if (!snapshot) {
    return {
      snapshot: null,
      previousSnapshot: null,
      diff: {
        added: [],
        removed: [],
        changed: []
      },
      summary: buildDiffSummary(null)
    };
  }
  const diff = compareComponentStates(
    previousSnapshot && previousSnapshot.components ? previousSnapshot.components : [],
    snapshot.components || []
  );
  return {
    snapshot,
    previousSnapshot,
    diff,
    summary: buildDiffSummary(diff)
  };
}

export function formatMockDate(timestamp) {
  if (!timestamp) {
    return '-';
  }
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
