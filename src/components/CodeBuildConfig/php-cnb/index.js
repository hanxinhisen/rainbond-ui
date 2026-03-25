import React, { PureComponent } from 'react';
import { Form, Radio, Switch } from 'antd';
import { FormattedMessage } from 'umi';
import GlobalUtils from '@/utils/global';

const RadioGroup = Radio.Group;

const getPHPVersions = (policy = {}, fallback = []) => {
  const versions = policy?.php?.php?.visible_versions || [];
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
    const versions = getPHPVersions(cnbVersionPolicy, buildSourceArr.php);
    const serverOptions = [(envs && envs.BUILD_RUNTIMES_SERVER) || 'nginx', 'apache'].filter((item, index, arr) => item && arr.indexOf(item) === index);
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
        <Form.Item {...formItemLayout} label={<FormattedMessage id="componentOverview.body.PHPConfig.web" />}>
          {getFieldDecorator('BUILD_RUNTIMES_SERVER', {
            initialValue: (envs && envs.BUILD_RUNTIMES_SERVER) || 'nginx'
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
            initialValue: (envs && envs.BUILD_RUNTIMES) || GlobalUtils.getDefaultVsersion((buildSourceArr && buildSourceArr.php) || [])
          })(
            <RadioGroup>
              {versions.map(item => (
                <Radio key={item} value={item}>{item}</Radio>
              ))}
            </RadioGroup>
          )}
        </Form.Item>
      </div>
    );
  }
}

export default Index;
