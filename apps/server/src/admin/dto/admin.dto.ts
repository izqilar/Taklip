import { IsString, IsOptional, IsIn, IsInt, Min, Max, IsObject } from 'class-validator';
import type { Role, UserStatus, ProviderStatus } from '../../../prisma/prisma-client';

/** 启用/禁用账号 */
export class UpdateUserStatusDto {
  @IsIn(['ACTIVE', 'DISABLED'])
  status!: UserStatus;
}

/** 分配角色（管理员操作） */
export class AssignRoleDto {
  @IsString()
  role!: Role;
}

/** 列表查询参数 */
export class ListUsersQueryDto {
  @IsOptional()
  page?: string;
  @IsOptional()
  pageSize?: string;
  @IsOptional()
  role?: Role;
  @IsOptional()
  keyword?: string;
  /** 按区域路径前缀过滤（代理商辖区查看用户/服务商时使用） */
  @IsOptional()
  regionPath?: string;
}

/**
 * 编辑服务商（运营端「服务商管理·编辑」弹窗）
 * 四个字段均可选，前端只传发生变化的字段。
 * reason 为编辑理由（必填留痕），与 rejectProvider.reason 一致，仅作审计入参。
 */
export class UpdateProviderReviewDto {
  @IsOptional()
  @IsString()
  nickname?: string;

  @IsOptional()
  @IsString()
  regionId?: string;

  @IsOptional()
  @IsIn(['PENDING', 'APPROVED', 'REJECTED'])
  providerStatus?: ProviderStatus;

  @IsString()
  reason!: string;
}

/**
 * 更新平台分账费率（运营端「财务中心 · 分账费率」页）。
 * 全部字段可选，前端只传发生变化的字段。
 * providerRate 不接收前端入参：恒 = 100 - platformRate - agentRate，由服务端推导落库，
 * 避免三方比例被手工写歪（三者之和必须恒为 100）。
 */
export class UpdateFeeConfigDto {
  /** 平台抽成（百分比整数 0-100） */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  platformRate?: number;

  /** 代理商分账（百分比整数 0-100） */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  agentRate?: number;

  /** 结算周期 */
  @IsOptional()
  @IsIn(['MONTH', 'HALF_MONTH', 'WEEK'])
  settlePeriod?: string;

  /** 类目费率覆盖 { [品类]: 平台抽成百分比 }；未命中的类目回落到 platformRate */
  @IsOptional()
  @IsObject()
  categoryRates?: Record<string, number>;

  /** 最低提现门槛（分），0 表示不限制 */
  @IsOptional()
  @IsInt()
  @Min(0)
  minWithdrawCents?: number;
}
