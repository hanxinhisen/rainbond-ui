import { Form, Input, Radio, Switch } from 'antd';
import React, { PureComponent } from 'react';
import { FormattedMessage } from 'umi';
import GlobalUtils from '@/utils/global';

const RadioGroup = Radio.Group;

const getGoVersions = (policy = {}, fallback = []) => {
  const versions = policy?.golang?.go?.visible_versions || [];
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
    const versions = getGoVersions(cnbVersionPolicy, buildSourceArr.golang);
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
        <Form.Item {...formItemLayout} label={<FormattedMessage id="componentOverview.body.GoConfig.edition" />}>
          {getFieldDecorator('BUILD_GOVERSION', {
            initialValue: (envs && envs.BUILD_GOVERSION) || GlobalUtils.getDefaultVsersion((buildSourceArr && buildSourceArr.golang) || [])
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
