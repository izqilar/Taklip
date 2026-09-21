/**
 * 代理商 / 总台的「我的团队」页面（本单位内部员工）。
 *
 * 与服务商层的差异：
 *  - **无「服务类型」联动**：这两层没有工种概念，岗位池直接用 STAFF_ROLE_POOLS[org]
 *  - 岗位池：代理商（区域经理 / 入驻审核员 / 商务拓展 / 财务专员 / 客服专员）
 *           总台（超级管理员 / 内容运营 / 审核员 / 财务 / 客服·工单）
 *  - 数据范围：代理商 self / region / agent；总台 self / all
 *
 * 其余（岗位 AutoComplete、职责自动带出、权限复选框、停用留痕）与服务商层完全同构。
 * 文档：`docs/平台角色边界规范化.md` §5.2 / §5.3
 */
import { StaffTeamCreate, StaffTeamList, StaffTeamMember } from './staffTeamPages';

/* ════════════ 代理商 · 我的团队 ════════════ */

export const AgentTeam = () => (
  <StaffTeamList
    org="AGENT"
    resource="agent/team"
    basePath="/agent/team"
    title="我的团队"
    sub="本单位内部员工 · 按岗位划分业务边界"
    chip="代理商 · 本代理商作用域"
  />
);

export const AgentTeamCreate = () => (
  <StaffTeamCreate
    org="AGENT"
    resource="agent/team"
    basePath="/agent/team"
    title="新建团队成员"
    sub="选择内置岗位，自动带出职责与权限"
    chip="代理商 · 本代理商作用域"
  />
);

export const AgentTeamMember = () => (
  <StaffTeamMember
    org="AGENT"
    resource="agent/team"
    basePath="/agent/team"
    title="团队成员详情"
    sub="岗位 · 职责 · 功能权限 · 数据范围"
    chip="代理商 · 本代理商作用域"
  />
);

/* ════════════ 管理总台 · 我的团队 ════════════ */

export const AdminTeam = () => (
  <StaffTeamList
    org="CONSOLE"
    resource="admin/team"
    basePath="/admin/team"
    title="我的团队"
    sub="总台内部员工 · 按岗位划分业务边界"
    chip="管理总台 · 全平台作用域"
  />
);

export const AdminTeamCreate = () => (
  <StaffTeamCreate
    org="CONSOLE"
    resource="admin/team"
    basePath="/admin/team"
    title="新建团队成员"
    sub="选择内置岗位，自动带出职责与权限"
    chip="管理总台 · 全平台作用域"
  />
);

export const AdminTeamMember = () => (
  <StaffTeamMember
    org="CONSOLE"
    resource="admin/team"
    basePath="/admin/team"
    title="团队成员详情"
    sub="岗位 · 职责 · 功能权限 · 数据范围"
    chip="管理总台 · 全平台作用域"
  />
);
