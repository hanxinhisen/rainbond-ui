import React, { PureComponent } from 'react';
import { Form, Icon, Input, Radio, Select, Switch, Tooltip } from 'antd';
import { FormattedMessage } from 'umi';
import GlobalUtils from '@/utils/global';

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

const getPythonVersions = (policy = {}) => {
  const versions = policy?.python?.cpython?.visible_versions || [];
  return versions;
};

const getPythonDefaultVersion = (policy = {}, currentValue = '') => {
  if (currentValue) {
    return currentValue;
  }
  return policy?.python?.cpython?.default_version || (policy?.python?.cpython?.visible_versions || [])[0] || '';
};

class Index extends PureComponent {
  render() {
    const formItemLayout = {
      labelCol: { xs: { span: 24 }, sm: { span: 4 } },
      wrapperCol: { xs: { span: 24 }, sm: { span: 20 } }
    };
    const { envs, form, cnbVersionPolicy } = this.props;
    const { getFieldDecorator, getFieldValue } = form;
    const versions = getPythonVersions(cnbVersionPolicy);
    const packageManagerValue = getFieldValue('BUILD_PYTHON_PACKAGE_MANAGER');
    const packageManager = packageManagerValue || (envs && envs.BUILD_PYTHON_PACKAGE_MANAGER) || 'pip';
    return (
      <div>
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
        <Form.Item {...formItemLayout} label={<FormattedMessage id="componentOverview.body.PythonConfig.Python" />}>
          {getFieldDecorator('BUILD_RUNTIMES', {
            initialValue: getPythonDefaultVersion(cnbVersionPolicy, (envs && envs.BUILD_RUNTIMES) || '')
          })(
            <RadioGroup>
              {versions.map(item => (
                <Radio key={item} value={item}>{item}</Radio>
              ))}
            </RadioGroup>
          )}
        </Form.Item>
        <Form.Item {...formItemLayout} label="Python 包管理器">
          {getFieldDecorator('BUILD_PYTHON_PACKAGE_MANAGER', {
            initialValue: (envs && envs.BUILD_PYTHON_PACKAGE_MANAGER) || 'pip'
          })(
            <Select getPopupContainer={triggerNode => triggerNode.parentNode}>
              <Option value="pip">pip</Option>
              <Option value="pipenv">pipenv</Option>
              <Option value="poetry">poetry</Option>
              <Option value="conda">conda</Option>
            </Select>
          )}
        </Form.Item>
        <Form.Item {...formItemLayout} label="包管理器版本">
          {getFieldDecorator('BUILD_PYTHON_PACKAGE_MANAGER_VERSION', {
            initialValue: (envs && envs.BUILD_PYTHON_PACKAGE_MANAGER_VERSION) || ''
          })(<Input placeholder="24.0 / 2024.4.1 / 1.8.3" />)}
        </Form.Item>
        <Form.Item {...formItemLayout} label={<FormattedMessage id="componentOverview.body.PythonConfig.Pypi" />}>
          {getFieldDecorator('BUILD_PIP_INDEX_URL', {
            initialValue: (envs && envs.BUILD_PIP_INDEX_URL) || 'https://pypi.tuna.tsinghua.edu.cn/simple'
          })(<Input />)}
        </Form.Item>
        {packageManager === 'conda' && (
          <Form.Item {...formItemLayout} label="Conda Solver">
            {getFieldDecorator('BUILD_CONDA_SOLVER', {
              initialValue: (envs && envs.BUILD_CONDA_SOLVER) || ''
            })(<Input placeholder="libmamba / classic" />)}
          </Form.Item>
        )}
        <Form.Item {...formItemLayout} label="Live Reload">
          {getFieldDecorator('BUILD_LIVE_RELOAD_ENABLED', {
            valuePropName: 'checked',
            initialValue: !!(envs && envs.BUILD_LIVE_RELOAD_ENABLED)
          })(<Switch />)}
        </Form.Item>
        <Form.Item
          {...formItemLayout}
          label={PROCFILE_LABEL}
        >
          {getFieldDecorator('BUILD_PROCFILE', {
            initialValue: (envs && envs.BUILD_PROCFILE) || ''
          })(<Input placeholder="留空时使用 Paketo 默认启动进程" />)}
        </Form.Item>
      </div>
    );
  }
}

export default Index;
