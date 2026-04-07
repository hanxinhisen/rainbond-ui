const NODEJS_LANGUAGE_TYPES = new Set(['nodejsstatic', 'nodejs', 'node', 'node.js']);
const CNB_LANGUAGE_TYPES = new Set([
  'java-maven',
  'java-war',
  'java-jar',
  'gradle',
  'javagradle',
  'java-gradle',
  'python',
  'php',
  'golang',
  'go',
  'nodejsstatic',
  'nodejs',
  'node',
  'node.js',
  'static'
]);
const CNB_VERSION_QUERY_LANGS = new Set(['openjdk', 'python', 'php', 'golang', 'node']);

const normalizeBuildLanguage = language => (language || '').toLowerCase();

const isNodeJSLanguage = type =>
  !!type && NODEJS_LANGUAGE_TYPES.has(normalizeBuildLanguage(type));

const isCnbLanguageType = type =>
  !!type && CNB_LANGUAGE_TYPES.has(normalizeBuildLanguage(type));

const getExplicitBuildStrategy = ({ runtimeInfo, buildSource, appDetail }) =>
  (
    runtimeInfo?.build_strategy ||
    buildSource?.build_strategy ||
    appDetail?.service?.build_strategy ||
    ''
  ).toLowerCase();

const hasLegacyCNBFramework = (runtimeInfo, languageType) =>
  !!runtimeInfo?.BUILD_FRAMEWORK &&
  (isNodeJSLanguage(languageType) || normalizeBuildLanguage(languageType) === 'static');

const isCNBBuildConfig = ({
  languageType,
  runtimeInfo,
  buildSource,
  appDetail,
  isCreate
}) => {
  const normalizedLanguageType = normalizeBuildLanguage(languageType);
  const isDockerfile = normalizedLanguageType.includes('dockerfile');
  const explicitBuildStrategy = getExplicitBuildStrategy({ runtimeInfo, buildSource, appDetail });

  if (isDockerfile) {
    return false;
  }

  return (
    explicitBuildStrategy === 'cnb' ||
    (isCreate && isCnbLanguageType(languageType)) ||
    runtimeInfo?.BUILD_TYPE === 'cnb' ||
    !!runtimeInfo?.CNB_FRAMEWORK ||
    hasLegacyCNBFramework(runtimeInfo, languageType)
  );
};

const getLangVersionBuildStrategy = (lang, options) => {
  if (!isCNBBuildConfig(options)) {
    return '';
  }
  return CNB_VERSION_QUERY_LANGS.has(normalizeBuildLanguage(lang)) ? 'cnb' : '';
};

const getLangVersionQueryList = (langs = [], options = {}) => {
  if (!Array.isArray(langs)) {
    return [];
  }
  if (!isCNBBuildConfig(options)) {
    return langs;
  }
  return langs.filter(lang => CNB_VERSION_QUERY_LANGS.has(normalizeBuildLanguage(lang)));
};

module.exports = {
  getExplicitBuildStrategy,
  getLangVersionQueryList,
  getLangVersionBuildStrategy,
  hasLegacyCNBFramework,
  isCNBBuildConfig,
  isCnbLanguageType,
  isNodeJSLanguage,
  normalizeBuildLanguage
};
