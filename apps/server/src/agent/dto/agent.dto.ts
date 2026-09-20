import {
  IsString,
  IsOptional,
  MinLength,
  MaxLength,
  IsEnum,
} from 'class-validator';
import { UserStatus } from '../../../prisma/prisma-client';

/** 创建代理商账号（管理员操作） */
export class CreateAgentDto {
  @IsString()
  @MaxLength(11)
  phone!: string;

  @IsString()
  @MinLength(6, { message: '密码至少 6 位' })
  @MaxLength(64)
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  nickname?: string;

  @IsString()
  regionId!: string;
}

/** 修改代理商辖区 */
export class UpdateAgentRegionDto {
  @IsString()
  regionId!: string;
}

/** 管理员全量编辑代理商（对齐 UI 原型「编辑」弹窗） */
export class UpdateAgentDto {
  @IsOptional()
  @IsString()
  @MaxLength(32)
  nickname?: string;

  @IsOptional()
  @IsString()
  regionId?: string;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @IsOptional()
  @IsString()
  @MaxLength(11)
  phone?: string;
}
