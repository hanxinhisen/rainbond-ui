import {
  getPlatformResourcesOverview,
  getPlatformStorageClasses,
  getPlatformPersistentVolumes,
  getPlatformResourceTypes,
  getPlatformResourceMetrics,
  getPlatformResourceAlerts,
} from '../services/platformResource';

export default {
  namespace: 'platformResources',

  state: {
    overview: {},
    storageClasses: [],
    persistentVolumes: [],
    resourceTypes: [],
    metrics: {},
    alerts: [],
  },

  effects: {
    *fetchOverview({ payload, callback, handleError }, { call, put }) {
      const response = yield call(getPlatformResourcesOverview, payload, handleError);
      if (response) {
        yield put({ type: 'saveOverview', payload: response });
        if (callback) callback(response);
      }
    },

    *fetchStorageClasses({ payload, callback, handleError }, { call, put }) {
      const response = yield call(getPlatformStorageClasses, payload, handleError);
      if (response) {
        yield put({ type: 'saveStorageClasses', payload: response });
        if (callback) callback(response);
      }
    },

    *fetchPersistentVolumes({ payload, callback, handleError }, { call, put }) {
      const response = yield call(getPlatformPersistentVolumes, payload, handleError);
      if (response) {
        yield put({ type: 'savePersistentVolumes', payload: response });
        if (callback) callback(response);
      }
    },

    *fetchResourceTypes({ payload, callback, handleError }, { call, put }) {
      const response = yield call(getPlatformResourceTypes, payload, handleError);
      if (response) {
        yield put({ type: 'saveResourceTypes', payload: response });
        if (callback) callback(response);
      }
    },

    *fetchMetrics({ payload, callback, handleError }, { call, put }) {
      const response = yield call(getPlatformResourceMetrics, payload, handleError);
      if (response) {
        yield put({ type: 'saveMetrics', payload: response });
        if (callback) callback(response);
      }
    },

    *fetchAlerts({ payload, callback, handleError }, { call, put }) {
      const response = yield call(getPlatformResourceAlerts, payload, handleError);
      if (response) {
        yield put({ type: 'saveAlerts', payload: response });
        if (callback) callback(response);
      }
    },
  },

  reducers: {
    saveOverview(state, action) {
      return { ...state, overview: action.payload };
    },

    saveStorageClasses(state, action) {
      return { ...state, storageClasses: action.payload };
    },

    savePersistentVolumes(state, action) {
      return { ...state, persistentVolumes: action.payload };
    },

    saveResourceTypes(state, action) {
      return { ...state, resourceTypes: action.payload };
    },

    saveMetrics(state, action) {
      return { ...state, metrics: action.payload };
    },

    saveAlerts(state, action) {
      return { ...state, alerts: action.payload };
    },
  },
};
