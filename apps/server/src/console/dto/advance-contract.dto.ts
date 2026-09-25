import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * 合同推进签署阶段 DTO（审查 L3）。
 *
 * 历史缺陷：端点 `@Body()` 为无校验裸对象，当 `stage` 省略时直接落 `EFFECTIVE`，
 * 相当于「前端/调用方漏传 stage 即跳过 APPROVING 直接打开付费闸门」。
 * 现显式要求 `stage` 必须为 'APPROVING' | 'EFFECTIVE'，缺失/非法即 400，杜绝静默旁路。
 */
export class AdvanceContractDto {
  @IsIn(['APPROVING', 'EFFECTIVE'], {
    message: 'stage 必须为 APPROVING 或 EFFECTIVE',
  })
  stage!: 'APPROVING' | 'EFFECTIVE';

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: '审批备注过长' })
  note?: string;
}
