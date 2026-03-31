import apiconfig from '../../config/api.config';
import request from '../utils/request';

export async function getPlatformSettings(body = {}) {
  return request(
    `${apiconfig.baseUrl}/console/enterprise/${body.eid}/platform-settings`,
    { method: 'get' }
  );
}

export async function updatePlatformSettings(body = {}) {
  return request(
    `${apiconfig.baseUrl}/console/enterprise/${body.eid}/platform-settings/update`,
    {
      method: 'put',
      data: { enable_team_resource_view: body.enable_team_resource_view }
    }
  );
}
