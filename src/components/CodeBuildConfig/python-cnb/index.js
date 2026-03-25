import React, { PureComponent } from 'react';
import { Form, Input, Radio, Switch } from 'antd';
import { FormattedMessage } from 'umi';
import GlobalUtils from '@/utils/global';

const RadioGroup = Radio.Group;

const getPythonVersions = (policy = {}, fallback = []) => {
  const versions = policy?.python?.cpython?.visible_versions || [];
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
    const { envs, form, buildSourceArr, cnbVersionPolicy } = this.props;
    const { getFieldDecorator } = form;
    const versions = getPythonVersions(cnbVersionPolicy, buildSourceArr.python);
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
        <Form.Item {...formItemLayout} label={<FormattedMessage id="componentOverview.body.PythonConfig.Python" />}>
          {getFieldDecorator('BUILD_RUNTIMES', {
            initialValue: (envs && envs.BUILD_RUNTIMES) || GlobalUtils.getDefaultVsersion((buildSourceArr && buildSourceArr.python) || [])
          })(
            <RadioGroup>
              {versions.map(item => (
                <Radio key={item} value={item}>{item}</Radio>
              ))}
            </RadioGroup>
          )}
        </Form.Item>
        <Form.Item {...formItemLayout} label={<FormattedMessage id="componentOverview.body.PythonConfig.Pypi" />}>
          {getFieldDecorator('BUILD_PIP_INDEX_URL', {
            initialValue: (envs && envs.BUILD_PIP_INDEX_URL) || 'https://pypi.tuna.tsinghua.edu.cn/simple'
          })(<Input />)}
        </Form.Item>
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
