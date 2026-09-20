import { IsIn, IsString, IsOptional, MaxLength } from 'class-validator';

/** 发起评价与反馈（投诉 / 好评 / 建议 / 咨询 / 申诉） */
export class CreateTicketDto {
  @IsIn(['COMPLAINT', 'PRAISE', 'SUGGESTION', 'CONSULT', 'APPEAL'])
  type!: string;

  @IsString()
  @MaxLength(120)
  title!: string;

  @IsString()
  @MaxLength(2000)
  content!: string;

  /** 被反馈对象（服务商 userId），投诉/评价类有意义 */
  @IsOptional()
  @IsString()
  targetId?: string;
}
