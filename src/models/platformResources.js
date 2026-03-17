import {
  listStorageClasses,
  createStorageClass,
  deleteStorageClass,
  listPersistentVolumes,
  createPersistentVolume,
  deletePersistentVolume,
  listPlatformResourceTypes,
  listPlatformResources,
  getPlatformResource,
  createPlatformResource,
  updatePlatformResource,
  deletePlatformResource,
  getStorageConfig,
  updateStorageConfig,
} from '../services/platformResource';

export default {
  namespace: 'platformResources',
  state: {
    storageClasses: [],
    persistentVolumes: [],
    platformResources: [],   // 资源类型列表
    resourceInstances: [],   // 当前选中类型的实例列表
    storageConfig: null,
    total: 0,
  },
  effects: {
    *fetchStorageClasses({ payload }, { call, put }) {
      try {
        const res = yield call(listStorageClasses, payload);
        if (res && res.bean) {
          yield put({ type: 'save', payload: { storageClasses: res.bean.list || [] } });
        }
      } catch (e) { /* stay on page */ }
    },
    *createStorageClass({ payload, callback }, { call }) {
      try {
        const res = yield call(createStorageClass, payload);
        if (res && callback) callback(res);
      } catch (e) { if (callback) callback(null, e); }
    },
    *deleteStorageClass({ payload, callback }, { call }) {
      try {
        const res = yield call(deleteStorageClass, payload);
        if (res && callback) callback(res);
      } catch (e) { if (callback) callback(null, e); }
    },
    *fetchPersistentVolumes({ payload }, { call, put }) {
      try {
        const res = yield call(listPersistentVolumes, payload);
        if (res && res.bean) {
          yield put({ type: 'save', payload: { persistentVolumes: res.bean.list || [] } });
        }
      } catch (e) { /* stay on page */ }
    },
    *createPersistentVolume({ payload, callback }, { call }) {
      try {
        const res = yield call(createPersistentVolume, payload);
        if (callback) callback(res, null);
      } catch (e) { if (callback) callback(null, e); }
    },
    *deletePersistentVolume({ payload, callback }, { call }) {
      try {
        const res = yield call(deletePersistentVolume, payload);
        if (callback) callback(res, null);
      } catch (e) { if (callback) callback(null, e); }
    },
    // 其他资源 Tab：列出集群级资源类型
    *fetchPlatformResources({ payload }, { call, put }) {
      try {
        const res = yield call(listPlatformResourceTypes, payload);
        if (res && res.bean) {
          yield put({ type: 'save', payload: { platformResources: res.bean.list || [], total: res.bean.total || 0 } });
        }
      } catch (e) { /* stay on page */ }
    },
    // 列出某类型下的所有资源实例
    *fetchResourceInstances({ payload }, { call, put }) {
      try {
        const res = yield call(listPlatformResources, payload);
        if (res && res.bean) {
          yield put({ type: 'save', payload: { resourceInstances: res.bean.list || [] } });
        }
      } catch (e) {
        yield put({ type: 'save', payload: { resourceInstances: [] } });
      }
    },
    // 获取单个资源实例的完整 JSON（用于 YAML 查看/编辑弹窗）
    *fetchResourceInstance({ payload, callback }, { call }) {
      try {
        const res = yield call(getPlatformResource, payload);
        if (res && callback) callback(res.bean, null);
      } catch (e) { if (callback) callback(null, e); }
    },
    // 创建资源实例
    *createResourceInstance({ payload, callback }, { call }) {
      try {
        const res = yield call(createPlatformResource, payload);
        if (callback) callback(res, null);
      } catch (e) { if (callback) callback(null, e); }
    },
    // 更新资源实例
    *updateResourceInstance({ payload, callback }, { call }) {
      try {
        const res = yield call(updatePlatformResource, payload);
        if (callback) callback(res, null);
      } catch (e) { if (callback) callback(null, e); }
    },
    // 删除资源实例
    *deletePlatformResource({ payload, callback }, { call }) {
      try {
        const res = yield call(deletePlatformResource, payload);
        if (callback) callback(res, null);
      } catch (e) { if (callback) callback(null, e); }
    },
    *fetchStorageConfig({ payload }, { call, put }) {
      try {
        const res = yield call(getStorageConfig, payload);
        if (res && res.bean) {
          yield put({ type: 'save', payload: { storageConfig: res.bean } });
        }
      } catch (e) { /* stay on page */ }
    },
    *saveStorageConfig({ payload, callback }, { call }) {
      try {
        const res = yield call(updateStorageConfig, payload);
        if (res && callback) callback(res);
      } catch (e) { if (callback) callback(null, e); }
    },
  },
  reducers: {
    save(state, { payload }) {
      return { ...state, ...payload };
    },
  },
};
