const DEFAULT_SNAPSHOT_VERSION = '0.0.1';

function buildNextSnapshotVersion(latestVersion) {
  if (!latestVersion) {
    return DEFAULT_SNAPSHOT_VERSION;
  }
  const parts = String(latestVersion).split('.');
  if (parts.some(part => !/^\d+$/.test(part))) {
    return DEFAULT_SNAPSHOT_VERSION;
  }
  if (parts.length === 2) {
    return `${parts[0]}.${parts[1]}.1`;
  }
  if (parts.length === 3) {
    return `${parts[0]}.${parts[1]}.${Number(parts[2]) + 1}`;
  }
  return DEFAULT_SNAPSHOT_VERSION;
}

function getLatestSnapshotVersionSeed(overview) {
  if (!overview || typeof overview !== 'object') {
    return '';
  }
  return overview.latest_snapshot_version || overview.current_version || '';
}

module.exports = {
  DEFAULT_SNAPSHOT_VERSION,
  buildNextSnapshotVersion,
  getLatestSnapshotVersionSeed
};
