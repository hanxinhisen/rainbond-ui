import {
  listStorageClasses,
  createStorageClass,
  deleteStorageClass,
  listPersistentVolumes,
  listPlatformResources,
  deletePlatformResource,
  getStorageConfig,
  updateStorageConfig,
} from '../services/platformResource';

export default {
  namespace: 'platformResources',
  state: {
    storageClasses: [],
    persistentVolumes: [],
    platformResources: [],
    storageConfig: null,
    total: 0,
  },
  effects: {
    *fetchStorageClasses({ payload }, { call, put }) {
      const res = yield call(listStorageClasses, payload);
      if (res && res.bean) {
        yield put({ type: 'save', payload: { storageClasses: res.bean.list || [] } });
      }
    },
    *createStorageClass({ payload, callback }, { call }) {
      const res = yield call(createStorageClass, payload);
      if (res && callback) callback(res);
    },
    *deleteStorageClass({ payload, callback }, { call }) {
      const res = yield call(deleteStorageClass, payload);
      if (res && callback) callback(res);
    },
    *fetchPersistentVolumes({ payload }, { call, put }) {
      const res = yield call(listPersistentVolumes, payload);
      if (res && res.bean) {
        yield put({ type: 'save', payload: { persistentVolumes: res.bean.list || [] } });
      }
    },
    *fetchPlatformResources({ payload }, { call, put }) {
      const res = yield call(listPlatformResources, payload);
      if (res && res.bean) {
        yield put({ type: 'save', payload: { platformResources: res.bean.list || [], total: res.bean.total || 0 } });
      }
    },
    *deletePlatformResource({ payload, callback }, { call }) {
      const res = yield call(deletePlatformResource, payload);
      if (res && callback) callback(res);
    },
    *fetchStorageConfig({ payload }, { call, put }) {
      const res = yield call(getStorageConfig, payload);
      if (res && res.bean) {
        yield put({ type: 'save', payload: { storageConfig: res.bean } });
      }
    },
    *saveStorageConfig({ payload, callback }, { call }) {
      const res = yield call(updateStorageConfig, payload);
      if (res && callback) callback(res);
    },
  },
  reducers: {
    save(state, { payload }) {
      return { ...state, ...payload };
    },
  },
};
