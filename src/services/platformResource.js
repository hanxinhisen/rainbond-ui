import apiconfig from '../../config/api.config';
import request from '../utils/request';

const base = (eid, region) =>
  `${apiconfig.baseUrl}/console/enterprise/${eid}/platform/regions/${region}`;

export async function listStorageClasses(body = {}) {
  return request(`${base(body.eid, body.region)}/storageclasses`, { method: 'get' });
}

export async function createStorageClass(body = {}) {
  return request(`${base(body.eid, body.region)}/storageclasses`, {
    method: 'post',
    data: body.yaml,
    headers: { 'Content-Type': 'application/yaml' }
  });
}

export async function deleteStorageClass(body = {}) {
  return request(`${base(body.eid, body.region)}/storageclasses/${body.name}`, { method: 'delete' });
}

export async function listPersistentVolumes(body = {}) {
  return request(`${base(body.eid, body.region)}/persistentvolumes`, { method: 'get' });
}

export async function listPlatformResources(body = {}) {
  return request(`${base(body.eid, body.region)}/platform-resources`, {
    method: 'get',
    params: { group: body.group, version: body.version, resource: body.resource }
  });
}

export async function deletePlatformResource(body = {}) {
  return request(
    `${base(body.eid, body.region)}/platform-resources/${body.name}`,
    {
      method: 'delete',
      params: { group: body.group, version: body.version, resource: body.resource }
    }
  );
}
