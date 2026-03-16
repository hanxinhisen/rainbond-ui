import apiconfig from '../../config/api.config';
import request from '../utils/request';

/**
 * Get storage overview information
 */
export async function getStorageOverview(body = {}) {
  return request(
    `${apiconfig.baseUrl}/console/platform/storage/overview`,
    {
      method: 'get',
      params: {
        cluster_id: body.cluster_id
      }
    }
  );
}

/**
 * Get available storage classes
 */
export async function getStorageClasses(body = {}) {
  return request(
    `${apiconfig.baseUrl}/console/platform/storage/classes`,
    {
      method: 'get',
      params: {
        cluster_id: body.cluster_id
      }
    }
  );
}

/**
 * Get persistent volumes
 */
export async function getPersistentVolumes(body = {}) {
  return request(
    `${apiconfig.baseUrl}/console/platform/storage/volumes`,
    {
      method: 'get',
      params: {
        cluster_id: body.cluster_id,
        page: body.page,
        page_size: body.page_size
      }
    }
  );
}

/**
 * Get cluster resource types
 */
export async function getClusterResourceTypes(body = {}) {
  return request(
    `${apiconfig.baseUrl}/console/platform/cluster/resource-types`,
    {
      method: 'get',
      params: {
        cluster_id: body.cluster_id
      }
    }
  );
}

/**
 * Get cluster resources
 */
export async function getClusterResources(body = {}) {
  return request(
    `${apiconfig.baseUrl}/console/platform/cluster/resources`,
    {
      method: 'get',
      params: {
        cluster_id: body.cluster_id,
        resource_type: body.resource_type,
        page: body.page,
        page_size: body.page_size
      }
    }
  );
}

/**
 * Get cluster resource detail
 */
export async function getClusterResourceDetail(body = {}) {
  return request(
    `${apiconfig.baseUrl}/console/platform/cluster/resources/${body.resource_id}`,
    {
      method: 'get',
      params: {
        cluster_id: body.cluster_id,
        resource_type: body.resource_type
      }
    }
  );
}
