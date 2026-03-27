import { Form, Icon, Input, Radio, Switch, Tooltip } from 'antd';
import React, { PureComponent } from 'react';
import { FormattedMessage } from 'umi';
import GlobalUtils from '@/utils/global';

const RadioGroup = Radio.Group;
const PROCFILE_HELP = '可选，留空时使用 Paketo 默认启动进程；仓库根目录存在 Procfile 时会由 Paketo 识别';
const PROCFILE_LABEL = (
  <span>
    启动命令
    <Tooltip title={PROCFILE_HELP}>
      <Icon type="question-circle-o" style={{ marginLeft: 8, color: '#8d9bad' }} />
    </Tooltip>
  </span>
);

const getGoVersions = (policy = {}) => {
  const versions = policy?.golang?.go?.visible_versions || [];
  return versions;
};

const getGoDefaultVersion = (policy = {}, currentValue = '') => {
  if (currentValue) {
    return currentValue;
  }
  return policy?.golang?.go?.default_version || (policy?.golang?.go?.visible_versions || [])[0] || '';
};

class Index extends PureComponent {
  render() {
    const formItemLayout = {
      labelCol: { xs: { span: 24 }, sm: { span: 4 } },
      wrapperCol: { xs: { span: 24 }, sm: { span: 20 } }
    };
    const { envs, form, cnbVersionPolicy } = this.props;
    const { getFieldDecorator } = form;
    const versions = getGoVersions(cnbVersionPolicy);
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
        <Form.Item {...formItemLayout} label={<FormattedMessage id="componentOverview.body.GoConfig.edition" />}>
          {getFieldDecorator('BUILD_GOVERSION', {
            initialValue: getGoDefaultVersion(cnbVersionPolicy, (envs && envs.BUILD_GOVERSION) || '')
          })(
            <RadioGroup>
              {versions.map(item => (
                <Radio key={item} value={item}>{item}</Radio>
              ))}
            </RadioGroup>
          )}
        </Form.Item>
        <Form.Item {...formItemLayout} label="GOPROXY">
          {getFieldDecorator('BUILD_GOPROXY', {
            initialValue: (envs && envs.BUILD_GOPROXY) || 'https://goproxy.cn'
          })(<Input />)}
        </Form.Item>
        <Form.Item {...formItemLayout} label="GOPRIVATE">
          {getFieldDecorator('BUILD_GOPRIVATE', {
            initialValue: (envs && envs.BUILD_GOPRIVATE) || ''
          })(<Input />)}
        </Form.Item>
        <Form.Item {...formItemLayout} label={<FormattedMessage id="componentOverview.body.GoConfig.blocks" />}>
          {getFieldDecorator('BUILD_GO_INSTALL_PACKAGE_SPEC', {
            initialValue: (envs && envs.BUILD_GO_INSTALL_PACKAGE_SPEC) || ''
          })(<Input />)}
        </Form.Item>
        <Form.Item {...formItemLayout} label="Go Build Flags">
          {getFieldDecorator('BUILD_GO_BUILD_FLAGS', {
            initialValue: (envs && envs.BUILD_GO_BUILD_FLAGS) || ''
          })(<Input placeholder="-mod=mod -trimpath" />)}
        </Form.Item>
        <Form.Item {...formItemLayout} label="Go Ldflags">
          {getFieldDecorator('BUILD_GO_BUILD_LDFLAGS', {
            initialValue: (envs && envs.BUILD_GO_BUILD_LDFLAGS) || ''
          })(<Input placeholder="-s -w -X main.version=1.0.0" />)}
        </Form.Item>
        <Form.Item {...formItemLayout} label="Import Path">
          {getFieldDecorator('BUILD_GO_BUILD_IMPORT_PATH', {
            initialValue: (envs && envs.BUILD_GO_BUILD_IMPORT_PATH) || ''
          })(<Input placeholder="github.com/example/app/cmd/api" />)}
        </Form.Item>
        <Form.Item {...formItemLayout} label="Keep Files">
          {getFieldDecorator('BUILD_GO_KEEP_FILES', {
            initialValue: (envs && envs.BUILD_GO_KEEP_FILES) || ''
          })(<Input placeholder="configs/**,templates/**" />)}
        </Form.Item>
        <Form.Item {...formItemLayout} label="Workspace Modules">
          {getFieldDecorator('BUILD_GO_WORK_USE', {
            initialValue: (envs && envs.BUILD_GO_WORK_USE) || ''
          })(<Input placeholder="./cmd/api ./pkg/common" />)}
        </Form.Item>
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
