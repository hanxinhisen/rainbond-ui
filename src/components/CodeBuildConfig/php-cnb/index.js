import React, { PureComponent } from 'react';
import { Form, Icon, Input, Radio, Switch, Tooltip } from 'antd';
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

const getPHPVersions = (policy = {}) => {
  const versions = policy?.php?.php?.visible_versions || [];
  return versions;
};

const getPHPDefaultVersion = (policy = {}, currentValue = '') => {
  if (currentValue) {
    return currentValue;
  }
  return policy?.php?.php?.default_version || (policy?.php?.php?.visible_versions || [])[0] || '';
};

class Index extends PureComponent {
  render() {
    const formItemLayout = {
      labelCol: { xs: { span: 24 }, sm: { span: 4 } },
      wrapperCol: { xs: { span: 24 }, sm: { span: 20 } }
    };
    const { envs, form, buildSourceArr, cnbVersionPolicy } = this.props;
    const { getFieldDecorator } = form;
    const versions = getPHPVersions(cnbVersionPolicy);
    const serverOptions = Array.from(new Set([
      (envs && envs.BUILD_RUNTIMES_SERVER) || GlobalUtils.getDefaultVsersion((buildSourceArr && buildSourceArr.web_runtime) || []) || 'nginx',
      ...((buildSourceArr && buildSourceArr.web_runtime) || []).map(item => item.version),
      'nginx',
      'apache',
      'php-server'
    ].filter(Boolean)));
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
        <Form.Item {...formItemLayout} label={<FormattedMessage id="componentOverview.body.PHPConfig.web" />}>
          {getFieldDecorator('BUILD_RUNTIMES_SERVER', {
            initialValue: (envs && envs.BUILD_RUNTIMES_SERVER) || GlobalUtils.getDefaultVsersion((buildSourceArr && buildSourceArr.web_runtime) || []) || 'nginx'
          })(
            <RadioGroup>
              {serverOptions.map(item => (
                <Radio key={item} value={item}>{item}</Radio>
              ))}
            </RadioGroup>
          )}
        </Form.Item>
        <Form.Item
          {...formItemLayout}
          label={<FormattedMessage id="componentOverview.body.PHPConfig.php" />}
          help={<FormattedMessage id="componentOverview.body.PHPConfig.definition" />}
        >
          {getFieldDecorator('BUILD_RUNTIMES', {
            initialValue: getPHPDefaultVersion(cnbVersionPolicy, (envs && envs.BUILD_RUNTIMES) || '')
          })(
            <RadioGroup>
              {versions.map(item => (
                <Radio key={item} value={item}>{item}</Radio>
              ))}
            </RadioGroup>
          )}
        </Form.Item>
        <Form.Item {...formItemLayout} label="Composer版本">
          {getFieldDecorator('BUILD_COMPOSER_VERSION', {
            initialValue: (envs && envs.BUILD_COMPOSER_VERSION) || ''
          })(<Input placeholder="2.7.7" />)}
        </Form.Item>
        <Form.Item {...formItemLayout} label="Composer 安装参数">
          {getFieldDecorator('BUILD_COMPOSER_INSTALL_OPTIONS', {
            initialValue: (envs && envs.BUILD_COMPOSER_INSTALL_OPTIONS) || ''
          })(<Input placeholder="--no-dev --optimize-autoloader" />)}
        </Form.Item>
        <Form.Item {...formItemLayout} label="Web 根目录">
          {getFieldDecorator('BUILD_PHP_WEB_DIR', {
            initialValue: (envs && envs.BUILD_PHP_WEB_DIR) || ''
          })(<Input placeholder="public" />)}
        </Form.Item>
        <Form.Item {...formItemLayout} label="Composer 全局安装">
          {getFieldDecorator('BUILD_COMPOSER_INSTALL_GLOBAL', {
            valuePropName: 'checked',
            initialValue: !!(envs && envs.BUILD_COMPOSER_INSTALL_GLOBAL)
          })(<Switch />)}
        </Form.Item>
        <Form.Item {...formItemLayout} label="Composer Vendor 目录">
          {getFieldDecorator('BUILD_COMPOSER_VENDOR_DIR', {
            initialValue: (envs && envs.BUILD_COMPOSER_VENDOR_DIR) || ''
          })(<Input placeholder="vendor" />)}
        </Form.Item>
        <Form.Item {...formItemLayout} label="Composer 文件路径">
          {getFieldDecorator('BUILD_COMPOSER_FILE', {
            initialValue: (envs && envs.BUILD_COMPOSER_FILE) || ''
          })(<Input placeholder="composer.json" />)}
        </Form.Item>
        <Form.Item {...formItemLayout} label="Composer Auth">
          {getFieldDecorator('BUILD_COMPOSER_AUTH', {
            initialValue: (envs && envs.BUILD_COMPOSER_AUTH) || ''
          })(<Input.TextArea rows={4} placeholder='{"http-basic":{"repo.example.com":{"username":"user","password":"***"}}}' />)}
        </Form.Item>
        <Form.Item {...formItemLayout} label="启用 HTTPS">
          {getFieldDecorator('BUILD_PHP_NGINX_ENABLE_HTTPS', {
            valuePropName: 'checked',
            initialValue: !!(envs && envs.BUILD_PHP_NGINX_ENABLE_HTTPS)
          })(<Switch />)}
        </Form.Item>
        <Form.Item {...formItemLayout} label="启用 HTTPS Redirect">
          {getFieldDecorator('BUILD_PHP_ENABLE_HTTPS_REDIRECT', {
            valuePropName: 'checked',
            initialValue: !!(envs && envs.BUILD_PHP_ENABLE_HTTPS_REDIRECT)
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
