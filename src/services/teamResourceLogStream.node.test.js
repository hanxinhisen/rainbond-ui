const assert = require('assert');
const { buildPodLogsStreamUrl } = require('./teamResourceLogStream');

assert.strictEqual(
  buildPodLogsStreamUrl({
    baseUrl: '',
    team: 'yirlz5nj',
    region: 'rainbond',
    pod_name: 'nginx-demo-2048-cb6cd9b69-hx5nj',
    container: 'demo-2048',
    lines: 200,
  }),
  '/console/sse/v2/tenants/yirlz5nj/resource-center/pods/nginx-demo-2048-cb6cd9b69-hx5nj/logs?region_name=rainbond&container=demo-2048&lines=200',
  'resource center pod logs should reuse the existing SSE proxy path'
);

assert.strictEqual(
  buildPodLogsStreamUrl({
    baseUrl: '',
    team: 'team-a',
    region: 'region-a',
    pod_name: 'pod-a',
  }),
  '/console/sse/v2/tenants/team-a/resource-center/pods/pod-a/logs?region_name=region-a',
  'resource center pod logs should always include the region query for the SSE proxy'
);

console.log('resource center log stream url tests passed');
