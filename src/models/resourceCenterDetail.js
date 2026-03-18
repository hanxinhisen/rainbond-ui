import {
  getWorkloadDetail,
  getPodDetail,
  getResourceEvents,
  getResourceWSInfo,
  updateNsResource,
} from '../services/teamResource';

export default {
  namespace: 'resourceCenterDetail',
  state: {
    workloadDetail: null,
    podDetail: null,
    events: [],
    wsInfo: null,
  },
  effects: {
    *fetchWorkloadDetail({ payload, callback }, { call, put }) {
      const res = yield call(getWorkloadDetail, payload);
      if (res && res.bean) {
        yield put({ type: 'save', payload: { workloadDetail: res.bean } });
      }
      if (callback) callback(res && res.bean);
    },
    *fetchPodDetail({ payload, callback }, { call, put }) {
      const res = yield call(getPodDetail, payload);
      if (res && res.bean) {
        yield put({ type: 'save', payload: { podDetail: res.bean } });
      }
      if (callback) callback(res && res.bean);
    },
    *fetchEvents({ payload, callback }, { call, put }) {
      const res = yield call(getResourceEvents, payload);
      const events = (res && res.bean && res.bean.list) || [];
      yield put({ type: 'save', payload: { events } });
      if (callback) callback(events);
    },
    *fetchWSInfo({ payload, callback }, { call, put }) {
      const res = yield call(getResourceWSInfo, payload);
      if (res && res.bean) {
        yield put({ type: 'save', payload: { wsInfo: res.bean } });
      }
      if (callback) callback(res && res.bean);
    },
    *saveYaml({ payload, callback }, { call }) {
      const res = yield call(updateNsResource, payload);
      if (callback) callback(res);
    },
  },
  reducers: {
    save(state, { payload }) {
      return { ...state, ...payload };
    },
  },
};
