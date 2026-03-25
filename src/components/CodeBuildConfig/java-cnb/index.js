import React, { PureComponent } from 'react';
import { Form, Input, Radio, Switch } from 'antd';
import { FormattedMessage } from 'umi';
import GlobalUtils from '@/utils/global';

const RadioGroup = Radio.Group;

const getJavaVersions = (policy = {}, fallback = []) => {
  const versions = policy?.java?.jdk?.visible_versions || [];
  if (versions.length) {
    return versions;
  }
  return (fallback || []).map(item => item.version);
};

class Index extends PureComponent {
  render() {
    const formItemLayout = {
      labelCol: { xs: { span: 24 }, sm: { span: 4 } },
      wrapperCol: { xs: { span: 24 }, sm: { span: 20 } }
    };
    const { envs, form, buildSourceArr, cnbVersionPolicy, languageType } = this.props;
    const { getFieldDecorator } = form;
    const javaVersions = getJavaVersions(cnbVersionPolicy, buildSourceArr.openJDK);
    const runtimeServer = (envs && envs.BUILD_RUNTIMES_SERVER) || 'tomcat';
    const isWar = (languageType || '').toLowerCase().indexOf('war') > -1;
    const isMaven = (languageType || '').toLowerCase().indexOf('maven') > -1;
    return (
      <div>
        <Form.Item
          {...formItemLayout}
          label={<FormattedMessage id="componentOverview.body.GoConfig.Disable" />}
          help={<FormattedMessage id="componentOverview.body.GoConfig.remove" />}
        >
          {getFieldDecorator('BUILD_NO_CACHE', {
            initialValue: !!(envs && envs.BUILD_NO_CACHE)
          })(<Switch defaultChecked={!!(envs && envs.BUILD_NO_CACHE)} />)}
        </Form.Item>
        <Form.Item {...formItemLayout} label={<FormattedMessage id="componentOverview.body.JavaJDKConfig.edition" />}>
          {getFieldDecorator('BUILD_RUNTIMES', {
            initialValue: (envs && envs.BUILD_RUNTIMES) || GlobalUtils.getDefaultVsersion((buildSourceArr && buildSourceArr.openJDK) || [])
          })(
            <RadioGroup>
              {javaVersions.map(item => (
                <Radio key={item} value={item}>{item}</Radio>
              ))}
            </RadioGroup>
          )}
        </Form.Item>
        {isMaven && (
          <Form.Item {...formItemLayout} label="Maven Goals">
            {getFieldDecorator('BUILD_MAVEN_CUSTOM_GOALS', {
              initialValue: (envs && envs.BUILD_MAVEN_CUSTOM_GOALS) || 'clean package'
            })(<Input />)}
          </Form.Item>
        )}
        {isMaven && (
          <Form.Item {...formItemLayout} label="Maven Opts">
            {getFieldDecorator('BUILD_MAVEN_CUSTOM_OPTS', {
              initialValue: (envs && envs.BUILD_MAVEN_CUSTOM_OPTS) || ''
            })(<Input />)}
          </Form.Item>
        )}
        {isMaven && (
          <Form.Item {...formItemLayout} label="MAVEN_OPTS">
            {getFieldDecorator('BUILD_MAVEN_JAVA_OPTS', {
              initialValue: (envs && envs.BUILD_MAVEN_JAVA_OPTS) || ''
            })(<Input />)}
          </Form.Item>
        )}
        {isWar && (
          <Form.Item {...formItemLayout} label="App Server">
            {getFieldDecorator('BUILD_RUNTIMES_SERVER', {
              initialValue: runtimeServer
            })(
              <RadioGroup>
                {[runtimeServer, 'tomcat'].filter((item, index, arr) => item && arr.indexOf(item) === index).map(item => (
                  <Radio key={item} value={item}>{item}</Radio>
                ))}
              </RadioGroup>
            )}
          </Form.Item>
        )}
        <Form.Item {...formItemLayout} label="Procfile">
          {getFieldDecorator('BUILD_PROCFILE', {
            initialValue: (envs && envs.BUILD_PROCFILE) || ''
          })(<Input />)}
        </Form.Item>
      </div>
    );
  }
}

export default Index;
