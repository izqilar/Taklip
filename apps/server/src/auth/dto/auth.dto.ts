import { IsString, IsOptional, MinLength, MaxLength, Matches } from 'class-validator';

export class RegisterDto {
  @IsString()
  @Matches(/^1\d{10}$/, { message: '手机号格式不正确' })
  phone!: string;

  @IsString()
  @MinLength(6, { message: '密码至少 6 位' })
  @MaxLength(64, { message: '密码过长' })
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(32, { message: '昵称过长' })
  nickname?: string;
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

  @IsOptional()
  @IsString()
  @MaxLength(18, { message: '证件号过长' })
  idCard?: string;

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
