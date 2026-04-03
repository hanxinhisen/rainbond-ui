const assert = require('assert');
const {
  isBuildEnvTruthy,
  mergeRuntimeBuildEnvs
} = require('./buildEnvHelpers');

assert.strictEqual(
  isBuildEnvTruthy('True'),
  true,
  'should treat backend-serialized True as enabled'
);

assert.strictEqual(
  isBuildEnvTruthy('FALSE'),
  false,
  'should treat case-insensitive false strings as disabled'
);

assert.deepStrictEqual(
  mergeRuntimeBuildEnvs(
    {
      BUILD_NO_CACHE: 'True',
      BUILD_PROCFILE: 'web: ./demo',
      BUILD_ENABLE_ORACLEJDK: true
    },
    {
      BUILD_NO_CACHE: false,
      GO_START_MODE: 'default',
      JDK_TYPE: 'OpenJDK'
    }
  ),
  {},
  'should remove disabled cache, default procfile, and stale oracle jdk flags from merged envs'
);

assert.deepStrictEqual(
  mergeRuntimeBuildEnvs(
    {
      CNB_START_SCRIPT: 'node server.js',
      CNB_FRAMEWORK: 'express'
    },
    {
      CNB_FRAMEWORK: 'other-static'
    }
  ),
  {
    CNB_FRAMEWORK: 'other-static'
  },
  'should drop stale node start commands when the framework switches to a static target'
);

console.log('build env helper tests passed');
