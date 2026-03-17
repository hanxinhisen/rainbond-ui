import apiconfig from '../../config/api.config';
import request from '../utils/request';

const base = (team, region) =>
  `${apiconfig.baseUrl}/console/teams/${team}/regions/${region}`;

export async function listNsResources(body = {}) {
  return request(`${base(body.team, body.region)}/ns-resources`, {
    method: 'get',
    params: { group: body.group, version: body.version, resource: body.resource }
  });
}

export async function createNsResource(body = {}) {
  return request(`${base(body.team, body.region)}/ns-resources?source=${body.source || 'manual'}`, {
    method: 'post',
    data: body.yaml,
    params: { group: body.group, version: body.version, resource: body.resource },
    headers: { 'Content-Type': 'application/yaml' }
  });
}

export async function deleteNsResource(body = {}) {
  return request(
    `${base(body.team, body.region)}/ns-resources/${body.name}`,
    {
      method: 'delete',
      params: { group: body.group, version: body.version, resource: body.resource }
    }
  );
}

export async function listHelmReleases(body = {}) {
  return request(`${base(body.team, body.region)}/helm/releases`, { method: 'get' });
}

export async function installHelmRelease(body = {}) {
  return request(`${base(body.team, body.region)}/helm/releases`, {
    method: 'post',
    data: {
      repo_name: body.repo_name,
      chart: body.chart,
      version: body.version,
      release_name: body.release_name,
      values: body.values,
    }
  });
}

export async function uninstallHelmRelease(body = {}) {
  return request(`${base(body.team, body.region)}/helm/releases/${body.release_name}`, { method: 'delete' });
}
