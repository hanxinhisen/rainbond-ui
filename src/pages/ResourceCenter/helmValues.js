function normalizePath(fileKey) {
  return (fileKey || '').replace(/\\/g, '/');
}

function getPathSegments(fileKey) {
  return normalizePath(fileKey).split('/').filter(Boolean);
}

function getFilePriority(fileKey) {
  const normalized = normalizePath(fileKey);
  const segments = getPathSegments(normalized);
  const basename = segments[segments.length - 1] || '';
  const chartsIndex = segments.indexOf('charts');

  return {
    exactValuesName: basename === 'values.yaml' ? 0 : 1,
    nestedDependency: chartsIndex > -1 ? 1 : 0,
    depth: segments.length || Number.MAX_SAFE_INTEGER,
    normalized,
  };
}

function compareHelmValuesFileKeys(left, right) {
  const leftPriority = getFilePriority(left);
  const rightPriority = getFilePriority(right);

  if (leftPriority.exactValuesName !== rightPriority.exactValuesName) {
    return leftPriority.exactValuesName - rightPriority.exactValuesName;
  }
  if (leftPriority.nestedDependency !== rightPriority.nestedDependency) {
    return leftPriority.nestedDependency - rightPriority.nestedDependency;
  }
  if (leftPriority.depth !== rightPriority.depth) {
    return leftPriority.depth - rightPriority.depth;
  }
  return leftPriority.normalized.localeCompare(rightPriority.normalized);
}

function getSortedHelmValuesFileKeys(valuesMap) {
  return Object.keys(valuesMap || {}).sort(compareHelmValuesFileKeys);
}

function getPreferredHelmValuesFileKey(valuesMap) {
  return getSortedHelmValuesFileKeys(valuesMap)[0] || '';
}

module.exports = {
  getPreferredHelmValuesFileKey,
  getSortedHelmValuesFileKeys,
};
