import {
  getNsResource,
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
    serviceDetail: null,
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
    *fetchServiceDetail({ payload, callback }, { call, put }) {
      const serviceRes = yield call(getNsResource, {
        team: payload.team,
        region: payload.region,
        group: '',
        version: 'v1',
        resource: 'services',
        name: payload.name,
      });
      const endpointsRes = yield call(getNsResource, {
        team: payload.team,
        region: payload.region,
        group: '',
        version: 'v1',
        resource: 'endpoints',
        name: payload.name,
        showLoading: false,
        handleError: () => null,
      });
      const detail = serviceRes && serviceRes.bean
        ? {
          service: serviceRes.bean,
          endpoints: (endpointsRes && endpointsRes.bean) || null,
        }
        : null;
      yield put({ type: 'save', payload: { serviceDetail: detail } });
      if (callback) callback(detail);
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
