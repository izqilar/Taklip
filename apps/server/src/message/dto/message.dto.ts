import { IsIn, IsString, IsOptional, MaxLength } from 'class-validator';

/** 发布消息（分层：权威公告 / 一般消息 / 诉求） */
export class CreateMessageDto {
  @IsIn(['ANNOUNCEMENT', 'NOTICE', 'APPEAL'])
  type!: string;

  @IsIn(['GLOBAL', 'REGION', 'OWN'])
  scope!: string;

  @IsString()
  @MaxLength(120)
  title!: string;

  @IsString()
  @MaxLength(4000)
  content!: string;

  /** scope=REGION 且作者为 ADMIN 时可指定区域路径 */
  @IsOptional()
  @IsString()
  regionPath?: string;

  /** scope=OWN 时的接收角色 */
  @IsOptional()
  @IsIn(['USER', 'SERVICE_PROVIDER', 'AGENT', 'ADMIN'])
  targetRole?: string;
}

/** 审核（驳回时带备注） */
export class AuditMessageDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
