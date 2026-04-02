const {
  getExplicitBuildStrategy,
  getLangVersionQueryList,
  getLangVersionBuildStrategy,
  isCNBBuildConfig
} = require('./buildStrategy');

describe('CodeBuildConfig build strategy helpers', () => {
  it('prefers explicit cnb strategy from runtime/build source/app detail', () => {
    expect(
      getExplicitBuildStrategy({
        runtimeInfo: { build_strategy: 'cnb' },
        buildSource: {},
        appDetail: {}
      })
    ).toEqual('cnb');
  });

  it('detects cnb build config for supported language', () => {
    expect(
      isCNBBuildConfig({
        languageType: 'python',
        runtimeInfo: { build_strategy: 'cnb' },
        buildSource: {},
        appDetail: {},
        isCreate: false
      })
    ).toEqual(true);
  });

  it('only requests cnb long versions for cnb-scoped languages', () => {
    const options = {
      languageType: 'java-maven',
      runtimeInfo: { build_strategy: 'cnb' },
      buildSource: {},
      appDetail: {},
      isCreate: false
    };

    expect(getLangVersionBuildStrategy('openJDK', options)).toEqual('cnb');
    expect(getLangVersionBuildStrategy('java_server', options)).toEqual('');
    expect(getLangVersionBuildStrategy('maven', options)).toEqual('');
  });

  it('filters legacy version requests for cnb java-maven builds', () => {
    const options = {
      languageType: 'java-maven',
      runtimeInfo: { build_strategy: 'cnb' },
      buildSource: {},
      appDetail: {},
      isCreate: true
    };

    expect(getLangVersionQueryList(['openJDK', 'maven', 'java_server'], options)).toEqual([
      'openJDK'
    ]);
  });

  it('keeps legacy version requests for slug java-maven builds', () => {
    const options = {
      languageType: 'java-maven',
      runtimeInfo: { build_strategy: 'slug' },
      buildSource: {},
      appDetail: {},
      isCreate: false
    };

    expect(getLangVersionQueryList(['openJDK', 'maven', 'java_server'], options)).toEqual([
      'openJDK',
      'maven',
      'java_server'
    ]);
  });
});
