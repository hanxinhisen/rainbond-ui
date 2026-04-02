/* eslint-disable react/jsx-no-target-blank */
import { Button, Form, Input, Modal, Select, Tag, Radio } from 'antd';
import { connect } from 'dva';
import React, { PureComponent } from 'react';
import { formatMessage } from '@/utils/intl';
import AddGroup from '../../components/AddOrEditGroup';
import globalUtil from '../../utils/global';
import rainbondUtil from '../../utils/rainbond';
import role from '../../utils/newRole';
import cookie from '../../utils/cookie';
import {
  DEFAULT_SOURCE_EXAMPLE,
  getVisibleSourceExamples,
  getSourceExampleDefaultName
} from '../CodeCustomForm/sourceExamples';

const { Option } = Select;

const formItemLayout = {
  labelCol: {
    span: 24
  },
  wrapperCol: {
    span: 24
  }
};
const en_formItemLayout = {
  labelCol: {
    span: 24
  },
  wrapperCol: {
    span: 24
  }
};

const sourceExamples = getVisibleSourceExamples();

@connect(
  ({ global, loading, teamControl }) => ({
    groups: global.groups,
    createAppByCodeLoading: loading.effects['createApp/createAppByCode'],
    rainbondInfo: global.rainbondInfo,
    currentTeamPermissionsInfo: teamControl.currentTeamPermissionsInfo

  }),
  null,
  null,
  { withRef: true }
)
@Form.create()
export default class Index extends PureComponent {
  constructor(props) {
    super(props);
    const initialDemoUrl =
      this.props.data.git_url || DEFAULT_SOURCE_EXAMPLE.gitUrl;
    this.state = {
      language: cookie.get('language') === 'zh-CN' ? true : false,
      addGroup: false,
      demoHref: initialDemoUrl,
      defaultName: getSourceExampleDefaultName(initialDemoUrl),
      creatComPermission: {}
    };
  }
  componentDidMount() {
    const group_id = globalUtil.getAppID();
    if (group_id) {
      this.handleChangeGroup(group_id);
    }
  }

  handleChangeGroup = (appid) => {
    this.setState({
      creatComPermission: role.queryPermissionsInfo(this.props.currentTeamPermissionsInfo?.team, 'app_overview', `app_${appid}`)
    });
  };
  onAddGroup = () => {
    this.setState({ addGroup: true });
  };
  cancelAddGroup = () => {
    this.setState({ addGroup: false });
  };
  handleSubmit = e => {
    e.preventDefault();
    const { form, onSubmit, handleType, archInfo } = this.props;
    const isService = handleType && handleType === 'Service';
    const group_id = globalUtil.getAppID();

    form.validateFields((err, fieldsValue) => {
      if (!err && onSubmit) {
        // 非服务模式设置示例应用配置
        if (!isService) {
          fieldsValue.k8s_app = 'appCodeDemo';
          fieldsValue.is_demo = !group_id;
        }

        // 处理架构信息
        if (archInfo && archInfo.length !== 2 && archInfo.length !== 0) {
          fieldsValue.arch = archInfo[0];
        }

        onSubmit(fieldsValue);
      }
    });
  };

  handleAddGroup = groupId => {
    const { setFieldsValue } = this.props.form;
    setFieldsValue({ group_id: groupId });
    role.refreshPermissionsInfo(groupId, false, this.handlePermissionCallback);
    this.cancelAddGroup();
  };

  handlePermissionCallback = (val) => {
    this.setState({ creatComPermission: val });
  };
  fetchGroup = () => {
    this.props.dispatch({
      type: 'global/fetchGroups',
      payload: {
        team_name: globalUtil.getCurrTeamName()
      }
    });
  };

  getExampleLabel = example => (
    example.labelId ? formatMessage({ id: example.labelId }) : example.label
  );

  handleOpenDemo = () => {
    Modal.warning({
      title: formatMessage({ id: 'teamAdd.create.code.demoBtn' }),
      content: (
        <div>
          {sourceExamples.map(example => (
            <Tag
              key={example.id}
              color={example.tagColor}
              style={{ marginBottom: '10px' }}
            >
              <a
                target="_blank"
                style={{ color: example.linkColor }}
                href={example.gitUrl}
              >
                {this.getExampleLabel(example)}
              </a>
            </Tag>
          ))}
        </div>
      )
    });
  };

  handleChangeDemo = value => {
    const name = getSourceExampleDefaultName(value);
    const { setFieldsValue } = this.props.form;
    setFieldsValue({ service_cname: name, k8s_component_name: name, git_url: value });
    this.setState({
      demoHref: value,
      defaultName: name
    });
  };

  handleValiateNameSpace = (_, value, callback) => {
    if (!value) {
      return callback(new Error(formatMessage({ id: 'placeholder.k8s_component_name' })));
    }
    if (value && value.length <= 32) {
      const Reg = /^[a-z]([-a-z0-9]*[a-z0-9])?$/;
      if (!Reg.test(value)) {
        return callback(
          new Error(
            formatMessage({ id: 'placeholder.nameSpaceReg' })
          )
        );
      }
      callback();
    }
    if (value.length > 16) {
      return callback(new Error(formatMessage({ id: 'placeholder.max16' })));
    }
  };
  render() {
    const { getFieldDecorator } = this.props.form;
    const { groups, createAppByCodeLoading, rainbondInfo, handleType, showCreateGroup, groupId, showSubmitBtn = true, ButtonGroupState, handleServiceBotton, archInfo } = this.props;
    const data = this.props.data || {};
    const { language, defaultName } = this.state;
    const is_language = language ? formItemLayout : en_formItemLayout;
    const isService = handleType && handleType === 'Service';
    const showCreateGroups = showCreateGroup === void 0 ? true : showCreateGroup;

    let arch = 'amd64';
    const archLength = archInfo.length;
    if (archLength === 2) {
      arch = 'amd64';
    } else if (archInfo.length === 1) {
      arch = archInfo && archInfo[0];
    }
    const group_id = globalUtil.getAppID();    
    return (
      <Form layout="vertical" hideRequiredMark>
        <Form.Item {...is_language} label={<span>{formatMessage({ id: 'teamAdd.create.code.selectDemo' })}</span>}>
          {getFieldDecorator('git_url', {
            initialValue:
              data.git_url || DEFAULT_SOURCE_EXAMPLE.gitUrl,
            rules: [{ required: true, message: formatMessage({ id: 'placeholder.select' }) }]
          })(
            <Select
              getPopupContainer={triggerNode => triggerNode.parentNode}
              style={language ? {
                display: 'inline-block',
                width: 400,
                marginRight: 15
              } : {
                display: 'inline-block',
                width: 360,
                marginRight: 15
              }}
              showSearch
              filterOption={(input, option) => 
                option.props.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
              }
              onChange={this.handleChangeDemo}
            >
              {sourceExamples.map(example => (
                <Option key={example.id} value={example.gitUrl}>
                  {this.getExampleLabel(example)}
                </Option>
              ))}
            </Select>
          )}
          {this.state.demoHref &&
            rainbondUtil.documentPlatform_url(rainbondInfo) && (
              <a
                target="_blank"
                href={this.state.demoHref}
              >
                {formatMessage({ id: 'teamAdd.create.code.href' })}
              </a>
            )}
        </Form.Item>
        <Form.Item {...is_language} label={formatMessage({ id: 'teamAdd.create.form.appName' })}>
          {getFieldDecorator('group_id', {
            initialValue: group_id ? Number(group_id) : (language ? '源码构建示例' : 'Source sample application'),
            rules: [{ required: true, message: formatMessage({ id: 'placeholder.select' }) }]
          })(
            <Select
              getPopupContainer={triggerNode => triggerNode.parentNode}
              placeholder={formatMessage({ id: 'placeholder.appName' })}
              disabled={true}
            >
              {(groups || []).map(group => (
                <Option key={group.group_id} value={group.group_id}>
                  {group.group_name}
                </Option>
              ))}
            </Select>
          )}
        </Form.Item>
        <Form.Item {...is_language} label={formatMessage({ id: 'teamAdd.create.form.service_cname' })}>
          {getFieldDecorator('service_cname', {
            initialValue: defaultName,
            rules: [
              { required: true, message: formatMessage({ id: 'placeholder.service_cname' }) },
              {
                max: 24,
                message: formatMessage({ id: 'placeholder.max24' })
              }
            ]
          })(
            <Input
              disabled={true}
              placeholder={formatMessage({ id: 'placeholder.service_cname' })}
            />
          )}
        </Form.Item>
        <Form.Item {...is_language} label={formatMessage({ id: 'teamAdd.create.form.k8s_component_name' })}>
          {getFieldDecorator('k8s_component_name', {
            initialValue: defaultName,
            rules: [
              {
                required: true,
                validator: this.handleValiateNameSpace
              }
            ]
          })(<Input placeholder={formatMessage({ id: 'placeholder.k8s_component_name' })} disabled={true}/>)}
        </Form.Item>
        <Form.Item {...is_language} label={formatMessage({id: 'teamAdd.create.code.address'})}>
            {getFieldDecorator('type', {
              initialValue: this.state.demoHref || '',
              force: true,
              rules: [
                { required: true, message: formatMessage({id: 'placeholder.git_url'}) },
              ]
            })(
              <Input
                disabled={true}
                addonBefore={
                <Select
                  disabled={true}
                  defaultValue={'git'}
                  style={{ width: 70 }}
                  getPopupContainer={triggerNode => triggerNode.parentNode}
                >
                  <Option value="git">Git</Option>
                  <Option value="svn">Svn</Option>
                  <Option value="oss">OSS</Option>
                </Select>
                }
                placeholder={formatMessage({id: 'placeholder.git_url'})}
              />
            )}
          </Form.Item>
          <Form.Item {...is_language} label={formatMessage({id: 'teamAdd.create.code.versions'})}>
            {getFieldDecorator('uuurl', {
              initialValue: 'master',
              rules: [{ required: true, message: formatMessage({id: 'placeholder.code_version'}) }]
            })(
              <Input
                disabled={true}
                addonBefore={
                <Select
                  disabled={true}
                  defaultValue={'branch'}
                  style={{ width: 70 }}
                  getPopupContainer={triggerNode => triggerNode.parentNode}
                >
                  <Option value="branch">{formatMessage({id: 'teamAdd.create.code.branch'})}</Option>
                  <Option value="tag">Tag</Option>
                </Select>}
                placeholder={formatMessage({id: 'placeholder.code_version'})}
              />
            )}
          </Form.Item>
          {archLength === 2 && 
          <Form.Item {...is_language} label={formatMessage({id:'enterpriseColony.mgt.node.framework'})}>
            {getFieldDecorator('arch', {
              initialValue: arch,
              rules: [{ required: true, message: formatMessage({ id: 'placeholder.code_version' }) }]
            })(
                <Radio.Group>
                  <Radio value='amd64'>amd64</Radio>
                  <Radio value='arm64'>arm64</Radio>
                </Radio.Group>
            )}
          </Form.Item>}
        
        {showSubmitBtn ? (
            <Form.Item
              wrapperCol={{
                xs: { span: 24, offset: 0 },
                sm: { span: 24, offset: 0 }
              }}
              label=""
            >
              <div style={{ textAlign: 'center', marginTop: '24px' }}>
                {isService && ButtonGroupState
                  ? handleServiceBotton(
                      <Button
                        onClick={this.handleSubmit}
                        type="primary"
                        loading={createAppByCodeLoading}
                      >
                        {formatMessage({id: 'teamAdd.create.btn.createComponent'})}
                      </Button>,
                      false
                    )
                  : !handleType && (
                      <Button
                        onClick={this.handleSubmit}
                        type="primary"
                        loading={createAppByCodeLoading}
                      >
                        {formatMessage({id: 'teamAdd.create.btn.create'})}
                      </Button>
                    )}
              </div>
            </Form.Item>
          ) : null}
        {this.state.addGroup && (
          <AddGroup onCancel={this.cancelAddGroup} onOk={this.handleAddGroup} />
        )}
      </Form>
    );
  }
}
