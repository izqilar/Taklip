import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsArray,
  IsIn,
  Matches,
  MaxLength,
} from 'class-validator';

/**
 * 组织内员工（OrgStaff）新建 / 更新 DTO。
 *
 * 此前 `/api/provider/team` 是 `@Body() body: any` + 手写校验，
 * 且 `dataScope` / `funcPerms` 完全没有白名单（任意字符串可落库）。
 * 本 DTO 收口基础类型校验；**依赖 orgType 的校验（dataScope 白名单、
 * funcPerms 权限池、红线裁剪）在 service 层完成**，因为 DTO 层拿不到 orgType。
 *
 * 关联文档：`docs/平台角色边界规范化.md` §6
 */

export class CreateStaffDto {
  @IsNotEmpty({ message: '成员姓名必填' })
  @IsString()
  @MaxLength(40)
  name!: string;

  @Matches(/^\d{11}$/, { message: '手机号须为 11 位数字' })
  phone!: string;

  @IsOptional()
  @IsIn(['ACTIVE', 'PENDING', 'DISABLED'])
  accountStatus?: string;

  /** 工种（仅服务商层使用）；代理商 / 总台无工种概念，传了会被忽略 */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  serviceType?: string;

  /**
   * 岗位。非空必填；**允许自填自定义岗位**（存量数据已是自由文本，
   * 严格枚举会让存量记录无法回显，见文档 §2.2 冲突 2）。
   */
  @IsNotEmpty({ message: '岗位必填' })
  @IsString()
  @MaxLength(40)
  staffRole!: string;

  /**
   * 契约别名：旧前端 / 存量调用方传的是 teamRole，等价于 staffRole。
   * 两者并存以便灰度；service 层取 `staffRole ?? teamRole`。
   */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  teamRole?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  duties?: string[];

  /** 功能权限子集（service 层按层校验白名单 + 红线裁剪） */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  funcPerms?: string[];

  /** 数据范围（service 层按层校验白名单） */
  @IsOptional()
  @IsString()
  dataScope?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  personality?: string;
}

export class UpdateStaffDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  name?: string;

  @IsOptional()
  @Matches(/^\d{11}$/, { message: '手机号须为 11 位数字' })
  phone?: string;

  @IsOptional()
  @IsIn(['ACTIVE', 'PENDING', 'DISABLED'])
  accountStatus?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  serviceType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  staffRole?: string;

  /** 契约别名，等价于 staffRole */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  teamRole?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  duties?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  funcPerms?: string[];

  @IsOptional()
  @IsString()
  dataScope?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  personality?: string;
}
