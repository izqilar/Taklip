import { IsString, IsOptional, IsIn, IsInt, Min, Max, IsObject, IsBoolean } from 'class-validator';
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

/** 占位符类型枚举 */
export type PlaceholderType = 'text' | 'image' | 'datetime' | 'address';
/** 占位符作用域枚举：record=名单字段型（从 record.data 取数）；batch=批次常量型（生成期一次性填写） */
export type PlaceholderScope = 'record' | 'batch';
/** 占位符状态枚举 */
export type PlaceholderStatus = 'visible' | 'hidden';

/** 列表查询参数（运营端「占位符管理」） */
export class ListPlaceholdersQueryDto {
  @IsOptional()
  type?: PlaceholderType;
  @IsOptional()
  scope?: PlaceholderScope;
  /** 关键字：跨 key 与单语言标签模糊匹配 */
  @IsOptional()
  keyword?: string;
  @IsOptional()
  page?: string;
  @IsOptional()
  pageSize?: string;
}

/** 新建占位符（运营端「占位符管理」）。key 唯一且为 ASCII，服务端二次校验。 */
export class CreatePlaceholderDto {
  @IsString()
  key!: string;
  @IsIn(['text', 'image', 'datetime', 'address'])
  type!: PlaceholderType;
  /** 单语言标签（管理员按当前语言录入） */
  @IsString()
  label!: string;
  @IsOptional()
  @IsString()
  hint?: string;
  @IsOptional()
  @IsString()
  defaultValue?: string;
  @IsOptional()
  @IsIn(['record', 'batch'])
  scope?: PlaceholderScope;
  @IsOptional()
  @IsBoolean()
  requiredDef?: boolean;
  @IsOptional()
  @IsIn(['visible', 'hidden'])
  status?: PlaceholderStatus;
}

/** 编辑占位符（全部字段可选，前端只传变化项；key 不可改）。 */
export class UpdatePlaceholderDto {
  @IsOptional()
  @IsIn(['text', 'image', 'datetime', 'address'])
  type?: PlaceholderType;
  @IsOptional()
  @IsString()
  label?: string;
  @IsOptional()
  @IsString()
  hint?: string;
  @IsOptional()
  @IsString()
  defaultValue?: string;
  @IsOptional()
  @IsIn(['record', 'batch'])
  scope?: PlaceholderScope;
  @IsOptional()
  @IsBoolean()
  requiredDef?: boolean;
  @IsOptional()
  @IsIn(['visible', 'hidden'])
  status?: PlaceholderStatus;
}
