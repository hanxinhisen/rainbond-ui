import {
  listNsResources,
  getNsResource,
  createNsResource,
  updateNsResource,
  deleteNsResource,
  listHelmReleases,
  installHelmRelease,
  previewHelmChart,
  uninstallHelmRelease,
} from '../services/teamResource';

export default {
  namespace: 'teamResources',
  state: {
    resources: [],
    helmReleases: [],
    total: 0,
    resourceDetail: null,
    helmPreview: null,
  },
  effects: {
    *fetchResources({ payload }, { call, put }) {
      const res = yield call(listNsResources, payload);
      if (res && res.bean) {
        yield put({ type: 'save', payload: { resources: res.bean.list || [], total: res.bean.total || 0 } });
      }
    },
    *fetchConfigResources({ payload }, { call, put }) {
      const configMapsRes = yield call(listNsResources, { ...payload, resource: 'configmaps' });
      const secretsRes = yield call(listNsResources, { ...payload, resource: 'secrets' });
      const configMaps = (configMapsRes && configMapsRes.bean && configMapsRes.bean.list) || [];
      const secrets = (secretsRes && secretsRes.bean && secretsRes.bean.list) || [];
      const resources = [...configMaps, ...secrets];
      yield put({ type: 'save', payload: { resources, total: resources.length } });
    },
    *createResource({ payload, callback }, { call }) {
      const res = yield call(createNsResource, payload);
      if (callback) callback(res);
    },
    *fetchResource({ payload, callback, handleError }, { call, put }) {
      try {
        const res = yield call(getNsResource, payload);
        if (res && res.bean) {
          yield put({ type: 'save', payload: { resourceDetail: res.bean } });
        }
        if (callback) callback(res && res.bean);
      } catch (e) {
        if (handleError) handleError(e);
      }
    },
    *updateResource({ payload, callback }, { call }) {
      const res = yield call(updateNsResource, payload);
      if (callback) callback(res);
    },
    *deleteResource({ payload, callback }, { call }) {
      const res = yield call(deleteNsResource, payload);
      if (callback) callback(res);
    },
    *fetchHelmReleases({ payload }, { call, put }) {
      const res = yield call(listHelmReleases, payload);
      if (res && res.bean) {
        yield put({ type: 'save', payload: { helmReleases: res.bean.list || [] } });
      }
    },
    *installRelease({ payload, callback, handleError }, { call }) {
      try {
        const res = yield call(installHelmRelease, payload);
        if (callback) callback(res);
      } catch (e) {
        if (handleError) handleError(e);
      }
    },
    *previewHelmChart({ payload, callback, handleError }, { call, put }) {
      try {
        const res = yield call(previewHelmChart, payload);
        if (res && res.bean) {
          yield put({ type: 'save', payload: { helmPreview: res.bean } });
        }
        if (callback) callback(res && res.bean);
      } catch (e) {
        if (handleError) handleError(e);
      }
    },
    *uninstallRelease({ payload, callback }, { call }) {
      const res = yield call(uninstallHelmRelease, payload);
      if (callback) callback(res);
    },
  },
  reducers: {
    save(state, { payload }) {
      return { ...state, ...payload };
    },
  },
};
