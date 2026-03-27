/* eslint-disable camelcase */
import MavenConfiguration from '@/components/MavenConfiguration';
import globalUtil from '@/utils/global';
import handleAPIError from '@/utils/error';
import { Button, Form, Icon, Input, Radio, Select, Switch, Tooltip } from 'antd';
import { connect } from 'dva';
import React, { PureComponent } from 'react';
import { FormattedMessage } from 'umi';
import { formatMessage } from '@/utils/intl';

const RadioGroup = Radio.Group;
const { Option } = Select;
const PROCFILE_HELP = '可选，留空时使用 Paketo 默认启动进程；仓库根目录存在 Procfile 时会由 Paketo 识别';
const PROCFILE_LABEL = (
  <span>
    启动命令
    <Tooltip title={PROCFILE_HELP}>
      <Icon type="question-circle-o" style={{ marginLeft: 8, color: '#8d9bad' }} />
    </Tooltip>
  </span>
);

const getJavaRuntimePolicy = (policy = {}) => policy?.java?.jdk || {};

const getJavaVersions = (policy = {}) => {
  const versions = getJavaRuntimePolicy(policy).visible_versions || [];
  return versions;
};

const getJavaDefaultVersion = (policy = {}, currentValue = '') => {
  if (currentValue) {
    return currentValue;
  }
  const runtimePolicy = getJavaRuntimePolicy(policy);
  return runtimePolicy.default_version || (runtimePolicy.visible_versions || [])[0] || '';
};

const uniq = list => Array.from(new Set((list || []).filter(Boolean)));

@connect(
  ({ enterprise }) => ({
    currentEnterprise: enterprise.currentEnterprise
  }),
  null,
  null,
  { withRef: true }
)
class Index extends PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      mavenVisible: false,
      MavenList: [],
      activeMaven: ''
    };
  }

  componentDidMount() {
    if (this.isMavenLanguage(this.props.languageType)) {
      this.fetchMavensettings();
    }
  }

  componentDidUpdate(prevProps) {
    if (!this.isMavenLanguage(prevProps.languageType) && this.isMavenLanguage(this.props.languageType)) {
      this.fetchMavensettings();
    }
  }

  onCancel = MavenName => {
    this.fetchMavensettings();
    const { setFieldsValue } = this.props.form;
    setFieldsValue({
      BUILD_MAVEN_SETTING_NAME: MavenName || ''
    });
    this.setState({
      mavenVisible: false
    });
  };

  fetchMavensettings = () => {
    const { dispatch, currentEnterprise } = this.props;
    if (!dispatch || !currentEnterprise || !currentEnterprise.enterprise_id) {
      return;
    }
    dispatch({
      type: 'appControl/fetchMavensettings',
      payload: {
        region_name: globalUtil.getCurrRegionName(),
        enterprise_id: currentEnterprise.enterprise_id,
        onlyname: true
      },
      callback: res => {
        if (res && res.status_code === 200) {
          this.setState({ MavenList: res.list || [] });
        }
      },
      handleError: err => {
        handleAPIError(err);
      }
    });
  };

  handleMavenConfiguration = () => {
    const { getFieldValue } = this.props.form;
    this.setState({
      activeMaven: getFieldValue('BUILD_MAVEN_SETTING_NAME'),
      mavenVisible: true
    });
  };

  isMavenLanguage = languageType => {
    const value = (languageType || '').toLowerCase();
    return value === 'java-maven';
  };

  isWarLanguage = languageType => {
    const value = (languageType || '').toLowerCase();
    return value === 'java-war';
  };

  isGradleLanguage = languageType => {
    const value = (languageType || '').toLowerCase();
    return value === 'gradle' || value === 'javagradle' || value === 'java-gradle';
  };

  render() {
    const formItemLayout = {
      labelCol: { xs: { span: 24 }, sm: { span: 4 } },
      wrapperCol: { xs: { span: 24 }, sm: { span: 20 } }
    };
    const { envs, form, buildSourceArr, cnbVersionPolicy, languageType } = this.props;
    const { getFieldDecorator } = form;
    const { mavenVisible, MavenList, activeMaven } = this.state;
    const isMaven = this.isMavenLanguage(languageType);
    const isWar = this.isWarLanguage(languageType);
    const isGradle = this.isGradleLanguage(languageType);
    const javaVersions = getJavaVersions(cnbVersionPolicy);
    const defaultJavaVersion = getJavaDefaultVersion(cnbVersionPolicy, envs && envs.BUILD_RUNTIMES);
    const runtimeServer = (envs && envs.BUILD_RUNTIMES_SERVER) || globalUtil.getDefaultVsersion((buildSourceArr && buildSourceArr.java_server) || []) || 'tomcat';
    const runtimeServerOptions = uniq([
      runtimeServer,
      ...((buildSourceArr && buildSourceArr.java_server) || []).map(item => item.version),
      'tomcat'
    ]);
    const envBUILD_MAVEN_SETTING_NAME = envs && envs.BUILD_MAVEN_SETTING_NAME;
    const mavenList = MavenList || [];
    let defaultMavenSettingName = '';
    if (mavenList.length && envBUILD_MAVEN_SETTING_NAME) {
      mavenList.forEach(item => {
        if (item.name === envBUILD_MAVEN_SETTING_NAME) {
          defaultMavenSettingName = envBUILD_MAVEN_SETTING_NAME;
        }
      });
    }
    if (mavenList.length && !defaultMavenSettingName) {
      const defaultMaven = mavenList.find(item => item.is_default);
      defaultMavenSettingName = defaultMaven ? defaultMaven.name : mavenList[0].name;
    }
    return (
      <div>
        {mavenVisible && (
          <MavenConfiguration
            activeMaven={activeMaven}
            onCancel={this.onCancel}
          />
        )}
        <Form.Item
          {...formItemLayout}
          label={<FormattedMessage id="componentOverview.body.GoConfig.Disable" />}
          help={<FormattedMessage id="componentOverview.body.GoConfig.remove" />}
        >
          {getFieldDecorator('BUILD_NO_CACHE', {
            valuePropName: 'checked',
            initialValue: !!(envs && envs.BUILD_NO_CACHE)
          })(<Switch />)}
        </Form.Item>
        <Form.Item {...formItemLayout} label={<FormattedMessage id="componentOverview.body.JavaJDKConfig.edition" />}>
          {getFieldDecorator('BUILD_RUNTIMES', {
            initialValue: defaultJavaVersion
          })(
            <RadioGroup>
              {javaVersions.map(item => (
                <Radio key={item} value={item}>
                  {item}
                </Radio>
              ))}
            </RadioGroup>
          )}
        </Form.Item>
        {isWar && (
          <Form.Item
            {...formItemLayout}
            label={<FormattedMessage id="componentOverview.body.JavaMavenConfig.Web" />}
            help={<FormattedMessage id="componentOverview.body.JavaMavenConfig.War" />}
          >
            {getFieldDecorator('BUILD_RUNTIMES_SERVER', {
              initialValue: runtimeServer
            })(
              <RadioGroup>
                {runtimeServerOptions.map(item => (
                  <Radio key={item} value={item}>
                    {item}
                  </Radio>
                ))}
              </RadioGroup>
            )}
          </Form.Item>
        )}
        {isMaven && (
          <Form.Item {...formItemLayout} label={<FormattedMessage id="componentOverview.body.JavaMavenConfig.configure" />}>
            {getFieldDecorator('BUILD_MAVEN_SETTING_NAME', {
              initialValue: defaultMavenSettingName,
              rules: mavenList.length > 0 ? [
                {
                  required: true,
                  message: formatMessage({ id: 'componentOverview.body.JavaMavenConfig.choice' })
                }
              ] : []
            })(
              <Select
                getPopupContainer={triggerNode => triggerNode.parentNode}
                placeholder={formatMessage({ id: 'componentOverview.body.JavaMavenConfig.choice' })}
                style={{ width: '300px', marginRight: '20px' }}
              >
                {mavenList.map(item => {
                  const { is_default = false, name } = item;
                  return (
                    <Option key={name}>
                      {is_default ? `默认(${name})` : name}
                    </Option>
                  );
                })}
              </Select>
            )}
            <Button onClick={this.handleMavenConfiguration} type="primary">
              <FormattedMessage id="componentOverview.body.JavaMavenConfig.Administration" />
            </Button>
          </Form.Item>
        )}
        {isMaven && (
          <Form.Item {...formItemLayout} label={<FormattedMessage id="componentOverview.body.JavaMavenConfig.Build_command" />}>
            {getFieldDecorator('BUILD_MAVEN_CUSTOM_GOALS', {
              initialValue: (envs && envs.BUILD_MAVEN_CUSTOM_GOALS) || 'clean package',
              rules: [
                {
                  required: true,
                  message: formatMessage({ id: 'componentOverview.body.JavaMavenConfig.input_parameters' })
                }
              ]
            })(<Input placeholder={formatMessage({ id: 'componentOverview.body.JavaMavenConfig.input_parameters' })} />)}
          </Form.Item>
        )}
        {isMaven && (
          <Form.Item {...formItemLayout} label={<FormattedMessage id="componentOverview.body.JavaMavenConfig.parameter" />}>
            {getFieldDecorator('BUILD_MAVEN_CUSTOM_OPTS', {
              initialValue: (envs && envs.BUILD_MAVEN_CUSTOM_OPTS) || '-DskipTests'
            })(<Input placeholder={formatMessage({ id: 'componentOverview.body.JavaMavenConfig.parameters' })} />)}
          </Form.Item>
        )}
        {isMaven && (
          <Form.Item {...formItemLayout} label={<FormattedMessage id="componentOverview.body.JavaMavenConfig.configuration" />}>
            {getFieldDecorator('BUILD_MAVEN_JAVA_OPTS', {
              initialValue: (envs && envs.BUILD_MAVEN_JAVA_OPTS) || '-Xmx1024m'
            })(<Input placeholder={formatMessage({ id: 'componentOverview.body.JavaMavenConfig.input_configuration' })} />)}
          </Form.Item>
        )}
        {isGradle && (
          <Form.Item {...formItemLayout} label="Gradle构建命令">
            {getFieldDecorator('BUILD_GRADLE_BUILD_ARGUMENTS', {
              initialValue: (envs && envs.BUILD_GRADLE_BUILD_ARGUMENTS) || 'build'
            })(<Input placeholder="build" />)}
          </Form.Item>
        )}
        {isGradle && (
          <Form.Item {...formItemLayout} label="Gradle 附加参数">
            {getFieldDecorator('BUILD_GRADLE_ADDITIONAL_BUILD_ARGUMENTS', {
              initialValue: (envs && envs.BUILD_GRADLE_ADDITIONAL_BUILD_ARGUMENTS) || ''
            })(<Input placeholder="--info -x test" />)}
          </Form.Item>
        )}
        {isMaven && (
          <Form.Item {...formItemLayout} label="Maven 构建模块">
            {getFieldDecorator('BUILD_MAVEN_BUILT_MODULE', {
              initialValue: (envs && envs.BUILD_MAVEN_BUILT_MODULE) || ''
            })(<Input placeholder="service-a" />)}
          </Form.Item>
        )}
        {isMaven && (
          <Form.Item {...formItemLayout} label="Maven 目标产物">
            {getFieldDecorator('BUILD_MAVEN_BUILT_ARTIFACT', {
              initialValue: (envs && envs.BUILD_MAVEN_BUILT_ARTIFACT) || ''
            })(<Input placeholder="service-a/target/app.jar" />)}
          </Form.Item>
        )}
        {isGradle && (
          <Form.Item {...formItemLayout} label="Gradle 构建模块">
            {getFieldDecorator('BUILD_GRADLE_BUILT_MODULE', {
              initialValue: (envs && envs.BUILD_GRADLE_BUILT_MODULE) || ''
            })(<Input placeholder="service-a" />)}
          </Form.Item>
        )}
        {isGradle && (
          <Form.Item {...formItemLayout} label="Gradle 目标产物">
            {getFieldDecorator('BUILD_GRADLE_BUILT_ARTIFACT', {
              initialValue: (envs && envs.BUILD_GRADLE_BUILT_ARTIFACT) || ''
            })(<Input placeholder="service-a/build/libs/app.jar" />)}
          </Form.Item>
        )}
        <Form.Item
          {...formItemLayout}
          label={PROCFILE_LABEL}
        >
          {getFieldDecorator('BUILD_PROCFILE', {
            initialValue: (envs && envs.BUILD_PROCFILE) || ''
          })(
            <Input placeholder="留空时使用 Paketo 默认启动进程" />
          )}
        </Form.Item>
      </div>
    );
  }
}

export default Index;
