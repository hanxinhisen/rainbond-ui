function buildPodLogsStreamUrl(body = {}) {
  const query = [`region_name=${encodeURIComponent(body.region || '')}`];

  if (body.container) {
    query.push(`container=${encodeURIComponent(body.container)}`);
  }
  if (body.lines) {
    query.push(`lines=${encodeURIComponent(body.lines)}`);
  }

  return `${body.baseUrl || ''}/console/sse/v2/tenants/${body.team}/resource-center/pods/${body.pod_name}/logs?${query.join('&')}`;
}

module.exports = {
  buildPodLogsStreamUrl,
};
