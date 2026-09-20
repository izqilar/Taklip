import { IsString, IsOptional, IsIn } from 'class-validator';
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
