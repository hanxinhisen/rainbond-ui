const normalizeCnbPolicyVersion = (policyKey, version) => {
  const value = String(version || '').trim();
  if (!value) {
    return '';
  }

  if (policyKey === 'java') {
    if (value.startsWith('1.')) {
      return value.slice(2).split('.', 1)[0];
    }
    return value.split('.', 1)[0];
  }

  if (policyKey === 'python') {
    const normalized = value.startsWith('python-') ? value.slice('python-'.length) : value;
    const parts = normalized.split('.');
    return parts.length >= 2 ? `${parts[0]}.${parts[1]}` : normalized;
  }

  if (policyKey === 'golang') {
    const normalized = value.startsWith('go') ? value.slice(2) : value;
    const parts = normalized.split('.');
    return parts.length >= 2 ? `${parts[0]}.${parts[1]}` : normalized;
  }

  if (policyKey === 'php' || policyKey === 'dotnet') {
    const parts = value.split('.');
    return parts.length >= 2 ? `${parts[0]}.${parts[1]}` : value;
  }

  return value;
};

const resolveCnbPolicyVersion = (policyKey, versions = [], currentValue = '', defaultValue = '') => {
  const visibleVersions = Array.isArray(versions) ? versions.filter(Boolean) : [];
  if (!visibleVersions.length) {
    return '';
  }

  const normalizedCurrent = normalizeCnbPolicyVersion(policyKey, currentValue);
  if (normalizedCurrent && visibleVersions.includes(normalizedCurrent)) {
    return normalizedCurrent;
  }

  const normalizedDefault = normalizeCnbPolicyVersion(policyKey, defaultValue);
  if (normalizedDefault && visibleVersions.includes(normalizedDefault)) {
    return normalizedDefault;
  }

  return '';
};

module.exports = {
  normalizeCnbPolicyVersion,
  resolveCnbPolicyVersion
};
