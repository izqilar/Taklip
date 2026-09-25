import { IsString, IsOptional, MinLength, MaxLength, Matches } from 'class-validator';

export class RegisterDto {
  @IsString()
  @Matches(/^1\d{10}$/, { message: '手机号格式不正确' })
  phone!: string;

  @IsString()
  @MinLength(8, { message: '密码至少 8 位' })
  @MaxLength(64, { message: '密码过长' })
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(32, { message: '昵称过长' })
  nickname?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32, { message: '真实姓名过长' })
  realName?: string;

  /**
   * 入驻意图：user（默认，普通用户）/ provider（服务商）/ agent（代理商）。
   * **仅作前端引导与统计用，不落库、不改变 role、不携带任何区域维度** ——
   * 角色变更与区域归属只能由总台终审 APPROVED 落地（入驻管线单一真源），
   * 注册接口绝不接受/写入 regionId / regionPath（审查 M1）。
   */
  @IsOptional()
  @IsString()
  intent?: string;
}

export class LoginDto {
  @IsString()
  phone!: string;

  @IsString()
  @MinLength(6, { message: '密码至少 6 位' })
  @MaxLength(64, { message: '密码过长' })
  password!: string;
}

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(32, { message: '昵称过长' })
  nickname?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512, { message: '头像地址过长' })
  avatar?: string;

  @IsOptional()
  @IsString()
  @Matches(/^1\d{10}$/, { message: '手机号格式不正确' })
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32, { message: '真实姓名过长' })
  realName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: '个人简介过长' })
  bio?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, { message: '邮箱格式不正确' })
  email?: string;

  /**
   * 证件号（大陆二代身份证 18 位，末位可为 X）。
   * 提交/变更即置 realNameStatus=PENDING，等待管理员裁定（见 AuthService.updateProfile）。
   */
  @IsOptional()
  @IsString()
  @Matches(/^\d{17}[\dXx]$/, { message: '身份证号格式不正确（应为 18 位，末位可为 X）' })
  idCard?: string;

  /** 身份证人像面影像 URL（POST /api/assets/upload 回传的 /uploads/xxx） */
  @IsOptional()
  @IsString()
  @MaxLength(512, { message: '证件影像地址过长' })
  idCardFront?: string;

  /** 身份证国徽面影像 URL */
  @IsOptional()
  @IsString()
  @MaxLength(512, { message: '证件影像地址过长' })
  idCardBack?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10, { message: '语言代码过长' })
  locale?: string;
}

export class ChangePasswordDto {
  @IsString()
  @MinLength(6, { message: '密码至少 6 位' })
  @MaxLength(64, { message: '密码过长' })
  oldPassword!: string;

  @IsString()
  @MinLength(6, { message: '密码至少 6 位' })
  @MaxLength(64, { message: '密码过长' })
  newPassword!: string;
}
