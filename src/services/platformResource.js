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

export async function createPersistentVolume(body = {}) {
  return request(`${base(body.eid, body.region)}/persistentvolumes`, {
    method: 'post',
    data: body.yaml,
    headers: { 'Content-Type': 'application/yaml' }
  });
}

export async function deletePersistentVolume(body = {}) {
  return request(`${base(body.eid, body.region)}/persistentvolumes/${body.name}`, { method: 'delete' });
}

// 列出所有集群级资源类型
export async function listPlatformResourceTypes(body = {}) {
  return request(`${base(body.eid, body.region)}/platform-resources/types`, { method: 'get' });
}

// 列出某个类型的所有资源实例（group/version/resource 是必填的 query 参数）
export async function listPlatformResources(body = {}) {
  return request(`${base(body.eid, body.region)}/platform-resources`, {
    method: 'get',
    params: { group: body.group, version: body.version, resource: body.resource }
  });
}

// 获取单个资源实例的完整 JSON
export async function getPlatformResource(body = {}) {
  return request(
    `${base(body.eid, body.region)}/platform-resources/${body.name}`,
    {
      method: 'get',
      params: { group: body.group, version: body.version, resource: body.resource }
    }
  );
}

// 创建资源实例（body.yaml 可以是 YAML 或 JSON 字符串）
export async function createPlatformResource(body = {}) {
  return request(`${base(body.eid, body.region)}/platform-resources`, {
    method: 'post',
    params: { group: body.group, version: body.version, resource: body.resource },
    data: body.yaml,
    headers: { 'Content-Type': 'application/yaml' }
  });
}

// 更新资源实例（body.yaml 可以是 YAML 或 JSON 字符串）
export async function updatePlatformResource(body = {}) {
  return request(
    `${base(body.eid, body.region)}/platform-resources/${body.name}`,
    {
      method: 'put',
      params: { group: body.group, version: body.version, resource: body.resource },
      data: body.yaml,
      headers: { 'Content-Type': 'application/yaml' }
    }
  );
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

export async function getStorageConfig(body = {}) {
  return request(`${base(body.eid, body.region)}/storage-config`, { method: 'get' });
}

export async function updateStorageConfig(body = {}) {
  return request(`${base(body.eid, body.region)}/storage-config`, {
    method: 'put',
    data: { default_storage_class: body.defaultStorageClass },
  });
}
