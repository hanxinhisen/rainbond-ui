import {
  listNsResources,
  createNsResource,
  deleteNsResource,
  listHelmReleases,
  installHelmRelease,
  uninstallHelmRelease,
} from '../services/teamResource';

export default {
  namespace: 'teamResources',
  state: {
    resources: [],
    helmReleases: [],
    total: 0,
  },
  effects: {
    *fetchResources({ payload }, { call, put }) {
      const res = yield call(listNsResources, payload);
      if (res && res.bean) {
        yield put({ type: 'save', payload: { resources: res.bean.list || [], total: res.bean.total || 0 } });
      }
    },
    *createResource({ payload, callback }, { call }) {
      const res = yield call(createNsResource, payload);
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
    *installRelease({ payload, callback }, { call }) {
      const res = yield call(installHelmRelease, payload);
      if (callback) callback(res);
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
