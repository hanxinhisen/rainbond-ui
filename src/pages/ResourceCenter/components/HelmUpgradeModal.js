import React, { PureComponent } from 'react';
import {
  Avatar,
  Button,
  Card,
  Collapse,
  Empty,
  Form,
  Icon,
  Input,
  List,
  Modal,
  notification,
  Select,
  Spin,
  Tag,
  Upload,
} from 'antd';
import Result from '@/components/Result';

const { Option } = Select;
const { TextArea } = Input;

function getChartDescription(chart = {}) {
  return chart.description || (chart.versions && chart.versions[0] && chart.versions[0].description) || '';
}

export default class HelmUpgradeModal extends PureComponent {
  state = this.buildInitialState();

  getSourceInfo = () => ((this.props.targetRelease || {}).source_info) || {};

  isStoreLocked = () => {
    const sourceInfo = this.getSourceInfo();
    return sourceInfo.upgrade_mode === 'store_locked' || sourceInfo.source_type === 'store';
  };

  getDefaultSourceType = () => (this.isStoreLocked() ? 'store' : 'external');

  getLockedRepoName = () => this.getSourceInfo().repo_name || '';

  getLockedChartName = () => this.getSourceInfo().chart_name || ((this.props.targetRelease || {}).chart) || '';

  componentDidUpdate(prevProps) {
    const becameVisible = this.props.visible && !prevProps.visible;
    const targetChanged = (
      this.props.visible &&
      prevProps.targetRelease &&
      this.props.targetRelease &&
      prevProps.targetRelease.name !== this.props.targetRelease.name
    );
    if (becameVisible || targetChanged) {
      this.resetState();
      this.fetchHelmRepos();
      if (!this.isStoreLocked()) {
        this.initHelmUploadSession();
      }
    }
  }

  buildInitialState() {
    const releaseName = ((this.props.targetRelease || {}).name) || '';
    return {
      sourceType: this.getDefaultSourceType(),
      installLoading: false,
      repos: [],
      repoLoading: false,
      currentRepo: this.getLockedRepoName(),
      allCharts: [],
      charts: [],
      chartLoading: false,
      chartSearch: '',
      chartPage: 1,
      chartPageSize: 9,
      chartTotal: 0,
      selectedChart: null,
      storeForm: { version: '', release_name: releaseName, values: '' },
      previewLoading: false,
      previewData: null,
      previewFileKey: '',
      previewStatus: 'idle',
      previewError: '',
      configVisible: false,
      externalForm: {
        chart_protocol: 'https://',
        chart_address: '',
        auth_type: 'none',
        release_name: releaseName,
        values: '',
        username: '',
        password: '',
      },
      uploadRecord: {},
      uploadEventId: '',
      uploadFileList: [],
      uploadExistFiles: [],
      uploadChartInfo: null,
      uploadLoading: false,
      uploadForm: { version: '', release_name: releaseName, values: '' },
    };
  }

  resetState = () => {
    this.setState(this.buildInitialState());
  };

  getParams() {
    const { teamName, regionName } = this.props;
    return { teamName, regionName };
  }

  getErrorMessage = (err, fallbackMessage) =>
    (err && (
      err.msg_show
      || (err.response && err.response.data && err.response.data.msg_show)
      || (err.data && err.data.msg_show)
    )) || fallbackMessage;

  getChartIcon = (chart) => {
    const versions = (chart && chart.versions) || [];
    return (chart && chart.icon) || (versions[0] && versions[0].icon) || '';
  };

  decodeBase64Text = (value) => {
    if (!value) {
      return '';
    }
    try {
      return window.atob(value);
    } catch (e) {
      return '';
    }
  };

  buildExternalChartUrl = () => {
    const { externalForm } = this.state;
    const address = (externalForm.chart_address || '').trim();
    if (!address) {
      return '';
    }
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(address)) {
      return address;
    }
    return `${externalForm.chart_protocol || 'https://'}${address}`;
  };

  fetchHelmRepos = () => {
    const { dispatch, currentEnterprise } = this.props;
    const { teamName } = this.getParams();
    const eid = currentEnterprise && currentEnterprise.enterprise_id;
    const lockedRepoName = this.getLockedRepoName();
    this.setState({ repoLoading: true });
    dispatch({
      type: 'market/HelmwaRehouseList',
      payload: { team_name: teamName },
      callback: res => {
        const list = (res && (res.list || res)) || [];
        const repos = Array.isArray(list) ? list : [];
        this.setState({ repos, repoLoading: false }, () => {
          if (repos.length > 0) {
            const matchedRepo = this.isStoreLocked()
              ? repos.find(repo => (repo.name || repo.repo_name || repo) === lockedRepoName)
              : null;
            const targetRepo = matchedRepo || repos[0];
            const repoName = targetRepo && (targetRepo.name || targetRepo.repo_name || targetRepo);
            if (repoName) {
              this.handleRepoSelect(repoName);
            }
          }
        });
        if (!repos.length) {
          this.setState({ repos: [] });
        }
      },
      handleError: () => this.setState({ repoLoading: false }),
    });
    this.enterpriseID = eid;
  };

  handleRepoSelect = (repoName) => {
    const { dispatch, currentEnterprise } = this.props;
    const eid = currentEnterprise && currentEnterprise.enterprise_id;
    this.setState({
      currentRepo: repoName,
      chartLoading: true,
      chartSearch: '',
      chartPage: 1,
      allCharts: [],
      charts: [],
      selectedChart: null,
      previewData: null,
      previewFileKey: '',
      previewStatus: 'idle',
      configVisible: false,
    });
    dispatch({
      type: 'market/fetchHelmMarkets',
      payload: { enterprise_id: eid, repo_name: repoName },
      callback: res => {
        const all = Array.isArray(res)
          ? res.map(chart => ({
            ...chart,
            description: getChartDescription(chart),
          }))
          : [];
        this.setState({
          allCharts: all,
          chartLoading: false,
        }, () => {
          this.applyChartFilter();
          if (!this.isStoreLocked()) {
            return;
          }
          const lockedChartName = this.getLockedChartName();
          const lockedChart = all.find(chart => (chart.name || '') === lockedChartName);
          if (!lockedChart) {
            this.setState({
              previewLoading: false,
              previewData: null,
              previewFileKey: '',
              previewStatus: 'error',
              previewError: '未在已记录仓库中找到当前 Chart，请检查 Helm 仓库配置。',
              configVisible: false,
            });
            return;
          }
          this.handleChartSelect(lockedChart);
        });
      },
      handleError: () => this.setState({ chartLoading: false }),
    });
  };

  applyChartFilter = () => {
    const { allCharts, chartSearch, chartPage, chartPageSize } = this.state;
    const keyword = (chartSearch || '').toLowerCase();
    const filtered = keyword
      ? allCharts.filter(item => (item.name || '').toLowerCase().includes(keyword))
      : allCharts;
    const total = filtered.length;
    const start = (chartPage - 1) * chartPageSize;
    this.setState({
      chartTotal: total,
      charts: filtered.slice(start, start + chartPageSize),
    });
  };

  handleChartSearch = value => {
    this.setState({ chartSearch: value, chartPage: 1 }, this.applyChartFilter);
  };

  handleChartPageChange = page => {
    this.setState({ chartPage: page }, this.applyChartFilter);
  };

  handleChartSelect = (chart) => {
    const versions = chart.versions || [];
    const version = (versions[0] && versions[0].version) || '';
    this.setState({
      selectedChart: chart,
      previewData: null,
      previewFileKey: '',
      previewStatus: 'idle',
      configVisible: false,
      storeForm: {
        ...this.state.storeForm,
        version,
        values: '',
      },
    }, () => {
      const { teamName, regionName } = this.getParams();
      this.fetchChartPreview({
        team: teamName,
        region: regionName,
        source_type: 'store',
        repo_name: this.state.currentRepo,
        chart: chart && chart.name,
        version,
      }, 'store');
    });
  };

  handleStoreVersionChange = (version) => {
    const { selectedChart, currentRepo, storeForm } = this.state;
    const { teamName, regionName } = this.getParams();
    this.setState({
      storeForm: { ...storeForm, version },
      previewData: null,
      previewFileKey: '',
      previewStatus: 'idle',
      configVisible: false,
    }, () => {
      this.fetchChartPreview({
        team: teamName,
        region: regionName,
        source_type: 'store',
        repo_name: currentRepo,
        chart: selectedChart && selectedChart.name,
        version,
      }, 'store');
    });
  };

  handleExternalFieldChange = (key, value) => {
    const resetKeys = ['chart_protocol', 'chart_address', 'auth_type', 'username', 'password'];
    this.setState({
      externalForm: {
        ...this.state.externalForm,
        [key]: value,
      },
      ...(resetKeys.indexOf(key) > -1 ? {
        previewData: null,
        previewFileKey: '',
        previewStatus: 'idle',
        configVisible: false,
      } : {}),
    });
  };

  initHelmUploadSession = () => {
    const { dispatch } = this.props;
    const { teamName, regionName } = this.getParams();
    dispatch({
      type: 'createApp/createJarWarServices',
      payload: {
        region: regionName,
        team_name: teamName,
        component_id: '',
      },
      callback: res => {
        const bean = res && res.bean;
        this.setState({
          uploadRecord: bean || {},
          uploadEventId: bean && bean.event_id,
        });
      },
      handleError: err => {
        notification.error({
          message: this.getErrorMessage(err, '初始化 Chart 上传会话失败'),
        });
      },
    });
  };

  fetchUploadStatus = () => {
    const { dispatch } = this.props;
    const { teamName, regionName } = this.getParams();
    const { uploadEventId } = this.state;
    if (!uploadEventId) {
      return;
    }
    dispatch({
      type: 'createApp/createJarWarUploadStatus',
      payload: {
        region: regionName,
        team_name: teamName,
        event_id: uploadEventId,
      },
      callback: data => {
        const existFiles = (data && data.bean && data.bean.package_name) || [];
        this.setState({
          uploadExistFiles: existFiles,
          uploadLoading: false,
          previewData: null,
          previewFileKey: '',
          previewStatus: 'idle',
          configVisible: false,
        });
      },
      handleError: err => {
        notification.error({
          message: this.getErrorMessage(err, '读取上传状态失败'),
        });
      },
    });
  };

  handleUploadChange = info => {
    let fileList = info.fileList || [];
    fileList = fileList.filter(file => {
      if (file.response) {
        return file.response.msg === 'success';
      }
      return true;
    });
    this.setState({ uploadFileList: fileList });
    if (info.file && info.file.status === 'done') {
      this.fetchUploadStatus();
    }
    if (info.file && info.file.status === 'error') {
      notification.error({ message: 'Chart 包上传失败' });
    }
  };

  handleUploadRemove = () => {
    const { dispatch } = this.props;
    const { teamName } = this.getParams();
    const { uploadEventId } = this.state;
    if (!uploadEventId) {
      return;
    }
    dispatch({
      type: 'createApp/deleteJarWarUploadStatus',
      payload: { team_name: teamName, event_id: uploadEventId },
      callback: () => {
        this.setState({
          uploadFileList: [],
          uploadExistFiles: [],
          uploadChartInfo: null,
          previewData: null,
          previewFileKey: '',
          previewStatus: 'idle',
          configVisible: false,
          uploadForm: {
            version: '',
            release_name: ((this.props.targetRelease || {}).name) || '',
            values: '',
          },
        });
        this.initHelmUploadSession();
      },
      handleError: err => {
        notification.error({
          message: this.getErrorMessage(err, '删除上传包失败'),
        });
      },
    });
  };

  applyPreview = (preview, sourceType) => {
    const valuesMap = (preview && preview.values) || {};
    const firstKey = Object.keys(valuesMap)[0] || '';
    const decodedValues = firstKey ? this.decodeBase64Text(valuesMap[firstKey]) : '';
    const nextState = {
      previewLoading: false,
      previewData: preview || null,
      previewFileKey: firstKey,
      previewStatus: 'success',
      previewError: '',
      configVisible: false,
    };
    if (sourceType === 'store') {
      nextState.storeForm = { ...this.state.storeForm, values: decodedValues };
    } else if (sourceType === 'external') {
      nextState.externalForm = { ...this.state.externalForm, values: decodedValues };
    } else {
      nextState.uploadForm = {
        ...this.state.uploadForm,
        version: (preview && preview.version) || this.state.uploadForm.version,
        values: decodedValues,
      };
      nextState.uploadChartInfo = preview || null;
    }
    this.setState(nextState);
  };

  fetchChartPreview = (payload, sourceType) => {
    const { dispatch } = this.props;
    this.setState({
      previewLoading: true,
      previewStatus: 'checking',
      previewError: '',
      configVisible: false,
    });
    dispatch({
      type: 'teamResources/previewHelmChart',
      payload,
      callback: bean => this.applyPreview(bean, sourceType),
      handleError: err => {
        const message = this.getErrorMessage(err, 'Chart 检测失败');
        this.setState({
          previewLoading: false,
          previewStatus: 'error',
          previewError: message,
          configVisible: false,
        });
        notification.error({ message });
      },
    });
  };

  handlePreviewFileChange = (fileKey) => {
    const { previewData, sourceType } = this.state;
    const valuesMap = (previewData && previewData.values) || {};
    const decodedValues = fileKey ? this.decodeBase64Text(valuesMap[fileKey]) : '';
    const nextState = { previewFileKey: fileKey };
    if (sourceType === 'store') {
      nextState.storeForm = { ...this.state.storeForm, values: decodedValues };
    } else if (sourceType === 'external') {
      nextState.externalForm = { ...this.state.externalForm, values: decodedValues };
    } else {
      nextState.uploadForm = { ...this.state.uploadForm, values: decodedValues };
    }
    this.setState(nextState);
  };

  getUpgradeRisk = (payload) => {
    const currentChart = (((this.props.targetRelease || {}).chart) || '').trim();
    const previewChart = (((this.state.previewData || {}).name) || '').trim();
    if (!currentChart || !previewChart || currentChart === previewChart) {
      return null;
    }
    return { currentChart, previewChart, payload };
  };

  confirmRiskAndSubmit = (risk, submit) => {
    Modal.confirm({
      title: '检测到跨 Chart 升级风险',
      okText: '明确确认并继续',
      cancelText: '取消',
      width: 620,
      content: (
        <div style={{ color: '#495464', lineHeight: '24px' }}>
          <div>当前 Release Chart：<strong>{risk.currentChart}</strong></div>
          <div>目标升级 Chart：<strong>{risk.previewChart}</strong></div>
          <div style={{ marginTop: 12 }}>Helm upgrade 不会自动清理旧资源，这种跨 Chart 升级可能导致资源混跑、流量异常和回滚不可预期。</div>
          <div style={{ marginTop: 12 }}>更推荐使用 `helm uninstall + helm install` 完成替换，或使用新的 release 名称部署。</div>
        </div>
      ),
      onOk: submit,
    });
  };

  handleSubmit = () => {
    const { dispatch, targetRelease, onSuccess } = this.props;
    const { teamName, regionName } = this.getParams();
    const {
      sourceType,
      selectedChart,
      currentRepo,
      storeForm,
      externalForm,
      uploadEventId,
      uploadForm,
      uploadChartInfo,
      previewData,
    } = this.state;
    const targetReleaseName = (targetRelease && targetRelease.name) || '';
    let payload = null;
    let validationMessage = '';

    if (sourceType === 'store') {
      if (!selectedChart) {
        validationMessage = '请先选择一个 Helm Chart';
      } else if (!storeForm.version || !previewData) {
        validationMessage = '请先完成 Chart 检测';
      } else {
        payload = {
          team: teamName,
          region: regionName,
          source_type: 'store',
          repo_name: currentRepo,
          release_name: targetReleaseName,
          chart: selectedChart.name,
          version: storeForm.version,
          values: storeForm.values,
        };
      }
    } else if (sourceType === 'external') {
      const chartUrl = this.buildExternalChartUrl();
      const isOCI = chartUrl.indexOf('oci://') === 0;
      if (!chartUrl) {
        validationMessage = '请填写 Chart 地址';
      } else if (externalForm.auth_type === 'basic' && (!externalForm.username || !externalForm.password)) {
        validationMessage = '请选择 Basic 鉴权时填写用户名和密码';
      } else if (!previewData) {
        validationMessage = '请先检测 Chart';
      } else {
        payload = {
          team: teamName,
          region: regionName,
          source_type: isOCI ? 'oci' : 'repo',
          chart_url: chartUrl,
          release_name: targetReleaseName,
          values: externalForm.values,
          username: externalForm.auth_type === 'basic' ? externalForm.username : '',
          password: externalForm.auth_type === 'basic' ? externalForm.password : '',
        };
      }
    } else if (!uploadEventId || !uploadChartInfo) {
      validationMessage = '请先上传并检测 Chart 包';
    } else {
      payload = {
        team: teamName,
        region: regionName,
        source_type: 'upload',
        event_id: uploadEventId,
        version: uploadForm.version,
        release_name: targetReleaseName,
        values: uploadForm.values,
      };
    }

    if (validationMessage) {
      notification.warning({ message: validationMessage });
      return;
    }

    const submitUpgrade = (nextPayload) => {
      this.setState({ installLoading: true });
      dispatch({
        type: 'teamResources/upgradeRelease',
        payload: nextPayload,
        callback: () => {
          this.setState({ installLoading: false });
          if (onSuccess) {
            onSuccess();
          }
        },
        handleError: err => {
          this.setState({ installLoading: false });
          notification.error({
            message: this.getErrorMessage(err, '升级失败'),
          });
        },
      });
    };

    const risk = this.getUpgradeRisk(payload);
    if (risk) {
      this.confirmRiskAndSubmit(risk, () => submitUpgrade({
        ...payload,
        allow_chart_replace: true,
      }));
      return;
    }

    submitUpgrade(payload);
  };

  renderTargetBanner() {
    const target = this.props.targetRelease || {};
    const sourceInfo = this.getSourceInfo();
    const sourceText = this.isStoreLocked()
      ? `升级方式：Helm 商店（仓库 ${sourceInfo.repo_name || '-' }，Chart ${sourceInfo.chart_name || target.chart || '-'})`
      : '升级方式：通用升级（第三方仓库 / OCI 或上传 Chart 包）';
    return (
      <div style={{
        marginBottom: 16,
        padding: '14px 16px',
        borderRadius: 8,
        border: '1px solid #d9e6ff',
        background: '#f7faff',
      }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#495464' }}>
          升级 Release：{target.name || '-'}
        </div>
        <div style={{ marginTop: 4, fontSize: 12, color: '#8d9bad' }}>
          当前 Chart：{target.chart || '-'}
          <span style={{ marginLeft: 8 }}>当前版本：{target.chart_version || '-'}</span>
        </div>
        <div style={{ marginTop: 6, fontSize: 12, color: '#6f7b8f' }}>
          {sourceText}
        </div>
      </div>
    );
  }

  renderSourceTabs() {
    if (this.isStoreLocked()) {
      return null;
    }
    const { sourceType } = this.state;
    const tabs = [
      { key: 'external', label: '第三方仓库 / OCI', helper: '支持官方、自建 Repo 与 OCI' },
      { key: 'upload', label: '上传 Chart 包', helper: '上传 .tgz 后直接升级' },
    ];
    return (
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        {tabs.map(tab => {
          const active = sourceType === tab.key;
          return (
            <div
              key={tab.key}
              onClick={() => this.setState({
                sourceType: tab.key,
                previewData: null,
                previewFileKey: '',
                previewStatus: 'idle',
                previewError: '',
                configVisible: false,
              })}
              style={{
                flex: 1,
                cursor: 'pointer',
                borderRadius: 10,
                border: active ? '1px solid #b4c8ff' : '1px solid #eef0f5',
                background: active ? '#f6f9ff' : '#fff',
                padding: '12px 14px',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600, color: active ? '#155aef' : '#495464' }}>{tab.label}</div>
              <div style={{ marginTop: 4, fontSize: 12, color: '#8d9bad', lineHeight: '18px' }}>{tab.helper}</div>
            </div>
          );
        })}
      </div>
    );
  }

  renderPreviewHeader() {
    const {
      sourceType,
      selectedChart,
      previewData,
      currentRepo,
      uploadEventId,
    } = this.state;
    const preview = previewData || {};
    const chartName = preview.name || (selectedChart && selectedChart.name);
    if (!chartName) {
      return null;
    }
    const chartDesc = preview.description || getChartDescription(selectedChart);
    const chartVersion = preview.version || (selectedChart && selectedChart.versions && selectedChart.versions[0] && selectedChart.versions[0].version) || '-';
    const sourceLabel = sourceType === 'store'
      ? `仓库：${currentRepo || '-'}`
      : sourceType === 'external'
        ? `来源：${this.buildExternalChartUrl() || '-'}`
        : `上传会话：${uploadEventId || '-'}`;
    return (
      <Card size="small" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <Avatar
            shape="square"
            size={48}
            src={this.getChartIcon(selectedChart) || preview.icon}
            icon="appstore"
            style={{ background: 'rgba(21,90,239,0.08)', color: '#155aef', flexShrink: 0 }}
          />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#495464', marginBottom: 4 }}>{chartName}</div>
            {chartDesc ? <div style={{ fontSize: 13, color: '#6f7b8f', lineHeight: '22px', marginBottom: 8 }}>{chartDesc}</div> : null}
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 12, color: '#8d9bad' }}>
              <span>{sourceLabel}</span>
              <span>版本号 {chartVersion}</span>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  renderDetectState() {
    const { previewStatus, previewError } = this.state;
    if (previewStatus === 'checking') {
      return (
        <Card>
          <Result type="ing" title="应用包检验中" description="应用包检验中，请耐心等候..." style={{ marginTop: 36, marginBottom: 12 }} />
        </Card>
      );
    }
    if (previewStatus === 'success') {
      return (
        <Card>
          <Result
            type="success"
            title="应用包检验成功"
            description="应用包检验成功，点击下一步进行 values 配置。"
            actions={<Button onClick={() => this.setState({ configVisible: true })}>下一步</Button>}
            style={{ marginTop: 36, marginBottom: 12 }}
          />
        </Card>
      );
    }
    if (previewStatus === 'error') {
      return (
        <Card>
          <Result
            type="error"
            title="应用包检验失败"
            description={previewError || 'Chart 检测失败，请检查地址、权限或 Chart 内容。'}
            style={{ marginTop: 36, marginBottom: 12 }}
          />
        </Card>
      );
    }
    return null;
  }

  renderConfigPanel(formKey) {
    const { previewData, previewFileKey } = this.state;
    const valuesMap = (previewData && previewData.values) || {};
    const valueFiles = Object.keys(valuesMap);
    const readme = previewData && this.decodeBase64Text(previewData.readme);
    const formState = formKey === 'external'
      ? this.state.externalForm
      : formKey === 'upload'
        ? this.state.uploadForm
        : this.state.storeForm;
    const valuesField = formKey === 'external' ? 'externalForm' : formKey === 'upload' ? 'uploadForm' : 'storeForm';
    return (
      <Collapse bordered={false} defaultActiveKey={['config', 'readme']}>
        <Collapse.Panel key="config" header="配置选项">
          {formKey === 'upload' && (
            <Form.Item label="版本" style={{ marginBottom: 16 }}>
              <Input
                value={formState.version || (previewData && previewData.version) || ''}
                onChange={e => this.setState({
                  [valuesField]: {
                    ...formState,
                    version: e.target.value,
                  },
                })}
                placeholder="默认使用解析出的版本"
              />
            </Form.Item>
          )}
          {valueFiles.length > 0 && (
            <Form.Item label="Values 文件" style={{ marginBottom: 16 }}>
              <Select value={previewFileKey} onChange={this.handlePreviewFileChange}>
                {valueFiles.map(fileKey => <Option key={fileKey} value={fileKey}>{fileKey}</Option>)}
              </Select>
            </Form.Item>
          )}
          <Form.Item label="values.yaml" style={{ marginBottom: 0 }}>
            <TextArea
              rows={16}
              value={formState.values}
              onChange={e => this.setState({
                [valuesField]: {
                  ...formState,
                  values: e.target.value,
                },
              })}
              style={{
                fontFamily: 'SFMono-Regular, Consolas, Liberation Mono, Menlo, monospace',
                fontSize: 13,
                lineHeight: '22px',
                minHeight: 320,
                background: '#1f2329',
                color: '#e6edf3',
                border: '1px solid #3b4552',
              }}
            />
          </Form.Item>
        </Collapse.Panel>
        {readme ? (
          <Collapse.Panel key="readme" header="应用说明">
            <div style={{ padding: '12px', whiteSpace: 'pre-wrap', fontSize: 12, color: '#6f7b8f', lineHeight: '20px', maxHeight: 240, overflowY: 'auto' }}>
              {readme}
            </div>
          </Collapse.Panel>
        ) : null}
      </Collapse>
    );
  }

  renderStorePane() {
    const {
      repos,
      repoLoading,
      currentRepo,
      chartLoading,
      chartSearch,
      charts,
      chartTotal,
      chartPage,
      chartPageSize,
      selectedChart,
      storeForm,
      configVisible,
    } = this.state;
    const versions = (selectedChart && selectedChart.versions) || [];
    const lockedChartName = this.getLockedChartName();
    if (this.isStoreLocked()) {
      if (repoLoading || chartLoading) {
        return <div style={{ textAlign: 'center', padding: '60px 0' }}><Spin tip="加载商店应用信息..." /></div>;
      }
      return (
        <div>
          <div style={{ background: '#f7f9ff', border: '1px solid #d0dbff', borderRadius: 6, padding: '10px 14px', marginBottom: 20, fontSize: 12, color: '#6f7b8f', lineHeight: '20px' }}>
            当前 Release 由 Helm 商店安装。升级时仓库与 Chart 已固定，只需选择目标版本并修改 values。
          </div>
          {this.renderPreviewHeader()}
          <Form layout="vertical">
            <Form.Item label="来源仓库" style={{ marginBottom: 16 }}>
              <Input value={currentRepo || this.getLockedRepoName()} disabled />
            </Form.Item>
            <Form.Item label="Chart" style={{ marginBottom: 16 }}>
              <Input value={lockedChartName} disabled />
            </Form.Item>
            <Form.Item label="版本" required style={{ marginBottom: 16 }}>
              {versions.length > 0 ? (
                <Select value={storeForm.version} onChange={this.handleStoreVersionChange}>
                  {versions.map(ver => <Option key={ver.version} value={ver.version}>{ver.version}</Option>)}
                </Select>
              ) : (
                <Input value={storeForm.version} disabled placeholder="正在读取可升级版本" />
              )}
            </Form.Item>
            <Form.Item label="Release 名称" style={{ marginBottom: 16 }}>
              <Input value={storeForm.release_name} disabled />
            </Form.Item>
          </Form>
          {configVisible ? this.renderConfigPanel('store') : this.renderDetectState()}
        </div>
      );
    }
    if (repoLoading) {
      return <div style={{ textAlign: 'center', padding: '60px 0' }}><Spin tip="加载仓库列表..." /></div>;
    }
    if (!repos.length) {
      return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无 Helm 仓库" style={{ padding: '60px 0' }} />;
    }
    return (
      <div>
        <div style={{ display: 'flex', minHeight: 360 }}>
          <div style={{ width: 160, flexShrink: 0, borderRight: '1px solid #eef0f5', paddingRight: 0 }}>
            <div style={{ fontSize: 12, color: '#8d9bad', padding: '8px 12px 4px', fontWeight: 500 }}>Helm 仓库</div>
            {repos.map(repo => {
              const name = repo.name || repo.repo_name || repo;
              const active = currentRepo === name;
              return (
                <div
                  key={name}
                  onClick={() => this.handleRepoSelect(name)}
                  style={{
                    padding: '9px 12px',
                    cursor: 'pointer',
                    fontSize: 13,
                    color: active ? '#155aef' : '#495464',
                    background: active ? 'rgba(21,90,239,0.07)' : 'transparent',
                    borderRight: active ? '2px solid #155aef' : '2px solid transparent',
                    fontWeight: active ? 500 : 400,
                  }}
                >
                  <Icon type="database" style={{ fontSize: 12, opacity: 0.7, marginRight: 6 }} />
                  <span>{name}</span>
                </div>
              );
            })}
          </div>
          <div style={{ flex: 1, paddingLeft: 16 }}>
            <div style={{ marginBottom: 12 }}>
              <Input.Search
                placeholder="搜索 Chart 名称..."
                value={chartSearch}
                onChange={e => this.handleChartSearch(e.target.value)}
                onSearch={this.handleChartSearch}
                allowClear
                size="small"
                style={{ width: 240 }}
              />
            </div>
            {chartLoading ? (
              <div style={{ textAlign: 'center', padding: '60px 0' }}><Spin tip="加载 Chart 列表..." /></div>
            ) : !charts.length ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无 Chart" style={{ padding: '60px 0' }} />
            ) : (
              <>
                <List
                  grid={{ gutter: 12, column: 3 }}
                  dataSource={charts}
                  renderItem={chart => {
                    const versionsList = chart.versions || [];
                    const latestVer = (versionsList[0] && versionsList[0].version) || chart.version || '';
                    return (
                      <List.Item style={{ marginBottom: 8 }}>
                        <Card
                          size="small"
                          hoverable
                          onClick={() => this.handleChartSelect(chart)}
                          bodyStyle={{ padding: '12px 14px' }}
                          style={{ cursor: 'pointer', borderRadius: 6, border: '1px solid #eef0f5' }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
                            <Avatar
                              shape="square"
                              size={20}
                              src={this.getChartIcon(chart)}
                              icon="appstore"
                              style={{ marginRight: 7, background: 'rgba(21,90,239,0.08)', color: '#155aef' }}
                            />
                            <span style={{ fontWeight: 600, fontSize: 13, color: '#155aef' }}>{chart.name}</span>
                          </div>
                          <div style={{ fontSize: 11, color: '#8d9bad', marginBottom: 6 }}>{getChartDescription(chart)}</div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            {latestVer ? <Tag color="geekblue" style={{ fontSize: 11, margin: 0 }}>{latestVer}</Tag> : null}
                            {versionsList.length > 1 ? <span style={{ fontSize: 11, color: '#8d9bad' }}>共 {versionsList.length} 个版本</span> : null}
                          </div>
                        </Card>
                      </List.Item>
                    );
                  }}
                />
                {chartTotal > chartPageSize ? (
                  <div style={{ textAlign: 'right', marginTop: 8 }}>
                    {Array.from({ length: Math.ceil(chartTotal / chartPageSize) }, (_, index) => index + 1).map(page => (
                      <Button
                        key={page}
                        size="small"
                        type={page === chartPage ? 'primary' : 'default'}
                        style={{ margin: '0 2px', minWidth: 28 }}
                        onClick={() => this.handleChartPageChange(page)}
                      >
                        {page}
                      </Button>
                    ))}
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
        {selectedChart ? (
          <div style={{ marginTop: 16 }}>
            {this.renderPreviewHeader()}
            <Form layout="vertical">
              <Form.Item label="版本" required style={{ marginBottom: 16 }}>
                {versions.length > 0 ? (
                  <Select value={storeForm.version} onChange={this.handleStoreVersionChange}>
                    {versions.map(ver => <Option key={ver.version} value={ver.version}>{ver.version}</Option>)}
                  </Select>
                ) : (
                  <Input value={storeForm.version} disabled />
                )}
              </Form.Item>
              <Form.Item label="Release 名称" style={{ marginBottom: 16 }}>
                <Input value={storeForm.release_name} disabled />
              </Form.Item>
            </Form>
            {configVisible ? this.renderConfigPanel('store') : this.renderDetectState()}
          </div>
        ) : null}
      </div>
    );
  }

  renderExternalPane() {
    const { externalForm, previewLoading, configVisible } = this.state;
    const isBasicAuth = externalForm.auth_type === 'basic';
    const chartUrl = this.buildExternalChartUrl();
    const detectDisabled = !chartUrl || (isBasicAuth && (!externalForm.username || !externalForm.password));
    return (
      <div>
        <div style={{ background: '#f7f9ff', border: '1px solid #d0dbff', borderRadius: 6, padding: '10px 14px', marginBottom: 20, fontSize: 12, color: '#6f7b8f', lineHeight: '20px' }}>
          请直接填写 Chart 地址，支持 Helm Repo 包地址和 OCI 制品地址。
        </div>
        <Form layout="vertical">
          <Form.Item label="Chart 地址" required style={{ marginBottom: 8 }}>
            <Input.Group compact>
              <Select value={externalForm.chart_protocol} onChange={value => this.handleExternalFieldChange('chart_protocol', value)} style={{ width: 120 }}>
                <Option value="https://">https://</Option>
                <Option value="http://">http://</Option>
                <Option value="oci://">oci://</Option>
              </Select>
              <Input
                value={externalForm.chart_address}
                onChange={e => this.handleExternalFieldChange('chart_address', e.target.value)}
                style={{ width: 'calc(100% - 120px)' }}
                placeholder={externalForm.chart_protocol === 'oci://' ? 'registry-1.docker.io/bitnamicharts/nginx:15.9.0' : 'charts.bitnami.com/bitnami/nginx-15.9.0.tgz'}
              />
            </Input.Group>
          </Form.Item>
          <Form.Item label="鉴权方式" required style={{ marginBottom: 16 }}>
            <Select value={externalForm.auth_type} onChange={value => this.handleExternalFieldChange('auth_type', value)} style={{ width: 180 }}>
              <Option value="none">None</Option>
              <Option value="basic">Basic</Option>
            </Select>
          </Form.Item>
          {isBasicAuth ? (
            <>
              <Form.Item label="用户名" required style={{ marginBottom: 16 }}>
                <Input value={externalForm.username} onChange={e => this.handleExternalFieldChange('username', e.target.value)} />
              </Form.Item>
              <Form.Item label="密码" required style={{ marginBottom: 16 }}>
                <Input.Password value={externalForm.password} onChange={e => this.handleExternalFieldChange('password', e.target.value)} />
              </Form.Item>
            </>
          ) : null}
          <Form.Item label="Release 名称" style={{ marginBottom: 16 }}>
            <Input value={externalForm.release_name} disabled />
          </Form.Item>
          <Form.Item style={{ marginBottom: 16 }}>
            <Button
              type="primary"
              icon="search"
              loading={previewLoading}
              disabled={detectDisabled}
              onClick={() => {
                const { teamName, regionName } = this.getParams();
                this.fetchChartPreview({
                  team: teamName,
                  region: regionName,
                  source_type: chartUrl.indexOf('oci://') === 0 ? 'oci' : 'repo',
                  chart_url: chartUrl,
                  username: isBasicAuth ? externalForm.username : '',
                  password: isBasicAuth ? externalForm.password : '',
                }, 'external');
              }}
            >
              检测 Chart
            </Button>
          </Form.Item>
        </Form>
        {!configVisible ? this.renderPreviewHeader() : null}
        {configVisible ? this.renderConfigPanel('external') : this.renderDetectState()}
      </div>
    );
  }

  renderUploadPane() {
    const {
      uploadRecord,
      uploadFileList,
      uploadExistFiles,
      previewLoading,
      configVisible,
    } = this.state;
    return (
      <div>
        <div style={{ background: '#f7f9ff', border: '1px solid #d0dbff', borderRadius: 6, padding: '10px 14px', marginBottom: 20, fontSize: 12, color: '#6f7b8f', lineHeight: '20px' }}>
          上传 `.tgz` Chart 包后，系统会自动解析版本与默认 values，并直接以 Helm Release 方式升级。
        </div>
        <Form layout="vertical">
          <Form.Item label="上传 Chart 包" required style={{ marginBottom: 12 }}>
            <Upload
              name="packageTarFile"
              fileList={uploadFileList}
              action={uploadRecord && uploadRecord.upload_url}
              onChange={this.handleUploadChange}
              onRemove={() => this.setState({ uploadFileList: [] })}
              accept=".tgz"
            >
              <Button icon="upload" disabled={!uploadRecord || !uploadRecord.upload_url}>选择 Chart 包</Button>
            </Upload>
          </Form.Item>
          {uploadExistFiles.length ? (
            <Form.Item label="已上传文件" style={{ marginBottom: 12 }}>
              <div style={{ border: '1px solid #eef0f5', borderRadius: 6, padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  {uploadExistFiles.map(item => (
                    <div key={item} style={{ fontSize: 12, color: '#495464', lineHeight: '20px' }}>
                      <Icon type="inbox" style={{ marginRight: 6, color: '#8d9bad' }} />
                      {item}
                    </div>
                  ))}
                </div>
                <Button type="link" style={{ paddingRight: 0 }} onClick={this.handleUploadRemove}>删除</Button>
              </div>
            </Form.Item>
          ) : null}
          {uploadExistFiles.length ? (
            <Form.Item style={{ marginBottom: 16 }}>
              <Button
                type="primary"
                icon="search"
                loading={previewLoading}
                onClick={() => {
                  const { teamName, regionName } = this.getParams();
                  this.fetchChartPreview({
                    team: teamName,
                    region: regionName,
                    source_type: 'upload',
                    event_id: this.state.uploadEventId,
                  }, 'upload');
                }}
              >
                检测 Chart
              </Button>
            </Form.Item>
          ) : null}
        </Form>
        {!configVisible ? this.renderPreviewHeader() : null}
        {configVisible ? this.renderConfigPanel('upload') : (
          this.state.previewStatus === 'idle'
            ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="上传并检测后将在这里展示 Chart 信息" />
            : this.renderDetectState()
        )}
      </div>
    );
  }

  renderBody() {
    const { sourceType } = this.state;
    if (sourceType === 'store') {
      return this.renderStorePane();
    }
    if (sourceType === 'external') {
      return this.renderExternalPane();
    }
    return this.renderUploadPane();
  }

  renderFooter() {
    const {
      sourceType,
      installLoading,
      storeForm,
      externalForm,
      uploadChartInfo,
      uploadForm,
      previewData,
      previewLoading,
    } = this.state;
    let disabled = false;
    if (sourceType === 'store') {
      disabled = !storeForm.release_name || !storeForm.version || !previewData || previewLoading;
    } else if (sourceType === 'external') {
      disabled = !externalForm.release_name || !previewData || previewLoading;
    } else {
      disabled = !uploadChartInfo || !uploadForm.release_name || !previewData || previewLoading;
    }
    return (
      <span>
        <Button onClick={this.props.onClose} style={{ marginRight: 8 }}>取消</Button>
        <Button type="primary" loading={installLoading} disabled={disabled} onClick={this.handleSubmit}>升级</Button>
      </span>
    );
  }

  render() {
    return (
      <Modal
        title={(
          <span>
            <Icon type="rocket" style={{ marginRight: 8 }} />
            升级 Helm Release
          </span>
        )}
        visible={this.props.visible}
        width={1080}
        destroyOnClose
        onCancel={this.props.onClose}
        footer={this.renderFooter()}
        bodyStyle={{ padding: '16px 20px 20px' }}
      >
        {this.renderTargetBanner()}
        {this.renderSourceTabs()}
        {this.renderBody()}
      </Modal>
    );
  }
}
