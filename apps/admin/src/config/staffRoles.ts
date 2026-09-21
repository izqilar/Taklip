/**
 * 组织内员工「岗位（StaffRole）」字典 —— 运营端 facade。
 *
 * ⚠️ P2 起本文件不再是真值源：字典与岗位模板已收敛到
 *    `packages/core/src/staff-roles.ts`（全平台唯一真值源，服务端与运营端共用）。
 *    本文件仅做 re-export facade，保持既有 `import { ... } from '../config/staffRoles'`
 *    写法不变，避免散落各处的引用批量改动。
 *
 * 如需修改岗位池 / 职责 / 权限 / 数据范围，请改 `packages/core/src/staff-roles.ts`，
 * 不要在此处另起一份（否则会重新出现 P2 前两份字典漂移的 K-04 问题）。
 *
 * 关联文档：`docs/平台角色边界规范化.md` §13.6
 */

export * from '@h5design/core';
