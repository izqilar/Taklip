import { BadRequestException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import { collectFontFamilies } from '@h5design/core';

/**
 * 字体授权判定（服务端权威）—— 纯函数工具，不参与 DI。
 *
 * 业务规则见 docs/font-licensing-dev-doc.md：
 * - 付费字体不单独售卖，只作为「付费模板」的属性存在；
 * - 服务商可自由用付费字体设计模板，但**免费模板不得包含任何付费字体**；
 * - 用户只有在「购买了某个付费模板」后，才能在该模板语境下使用其中的付费字体；
 * - 草稿保存永不卡，只有「发布 / 导出」卡授权。
 *
 * 之所以做成纯函数（而不是 @Injectable 服务）：
 * provider-console.controller、PublishService、ExportService 分属不同 Nest 模块，
 * 若以依赖注入方式复用会要求跨模块 import/export，容易触发 DI 解析失败（历史踩坑）。
 * 这里统一接收 prisma 实例入参，零注入风险。
 */

/** 字体授权业务错误码 */
export const FONT_ERROR_CODE = {
  /** 免费模板包含付费字体 */
  FREE_TEMPLATE_PAID_FONT: 6001,
  /** 作品包含未授权付费字体（需购买含该字体的付费模板） */
  WORK_FONT_NOT_LICENSED: 6002,
} as const;

/** 带业务码的授权异常，响应体形如 { code: 6002, message, missing: [...] } */
export class FontLicenseException extends BadRequestException {
  constructor(code: number, message: string, data?: Record<string, unknown>) {
    super({ code, message, ...(data ?? {}) });
  }
}

type PrismaLike = PrismaService;

/** 取有效 schema（与读写口径一致：草稿优先于线上） */
export function effectiveSchema(row: {
  schema?: unknown;
  draftSchema?: unknown;
}): unknown {
  return row.draftSchema && typeof row.draftSchema === 'object'
    ? row.draftSchema
    : row.schema;
}

/** 解析 schema 中用到的「付费字体」family 列表（按 Font.isPaid 判定） */
export async function paidFontsInSchema(
  prisma: PrismaLike,
  row: { schema?: unknown; draftSchema?: unknown },
): Promise<string[]> {
  const families = collectFontFamilies(effectiveSchema(row));
  if (families.length === 0) return [];
  const fonts = await prisma.font.findMany({
    where: { family: { in: families }, isPaid: true },
    select: { family: true },
  });
  return fonts.map((f) => f.family);
}

/** 用户是否已购买该模板（TemplateOrder 支付态 paid） */
export async function hasTemplatePurchase(
  prisma: PrismaLike,
  userId: string,
  templateId: string,
): Promise<boolean> {
  const order = await prisma.templateOrder.findFirst({
    where: { buyerId: userId, templateId, status: 'paid' },
    select: { id: true },
  });
  return order != null;
}

/**
 * 模板发布闸口：免费模板不得包含付费字体（错误码 6001）。
 * @returns 该模板实际使用的付费字体清单（发布方可写回 Template.paidFonts 作冗余）
 */
export async function assertTemplateFontRule(
  prisma: PrismaLike,
  template: { id: string; name?: string; price?: number | null; schema?: unknown; draftSchema?: unknown },
): Promise<string[]> {
  const paid = await paidFontsInSchema(prisma, template);
  const isFree = (template.price ?? 0) <= 0;
  if (isFree && paid.length > 0) {
    throw new FontLicenseException(
      FONT_ERROR_CODE.FREE_TEMPLATE_PAID_FONT,
      `免费模板不能包含付费字体：${paid.join(', ')}（请将模板设为付费，或改用免费字体）`,
      { paidFonts: paid },
    );
  }
  return paid;
}

/**
 * 作品授权检查（不抛错版），供导出场景按结果降级（低分辨率 + 水印）。
 * @returns licensed=true 表示完全授权；false 时 missing 为未授权的付费字体清单
 */
export async function checkWorkFontLicense(
  prisma: PrismaLike,
  project: { templateId?: string | null; schema?: unknown; draftSchema?: unknown },
  userId: string,
): Promise<{ licensed: boolean; missing: string[] }> {
  const paid = await paidFontsInSchema(prisma, project);
  if (paid.length === 0) return { licensed: true, missing: [] };

  const tpl = project.templateId
    ? await prisma.template.findUnique({
        where: { id: project.templateId },
        select: { id: true, price: true, paidFonts: true },
      })
    : null;

  // 授权成立三要素：来源模板付费 + 所用字体都在该模板清单内 + 用户已购买
  const covered = !!tpl && (tpl.price ?? 0) > 0 && paid.every((f) => (tpl.paidFonts ?? []).includes(f));
  const purchased = tpl ? await hasTemplatePurchase(prisma, userId, tpl.id) : false;

  return covered && purchased
    ? { licensed: true, missing: [] }
    : { licensed: false, missing: paid };
}

/**
 * 作品发布闸口：用到付费字体 ⇒ 必须来自「已购」的付费模板（错误码 6002）。
 * 发布是硬门槛，因此这里直接抛错；导出如需降级请用 checkWorkFontLicense。
 */
export async function assertWorkFontLicense(
  prisma: PrismaLike,
  project: { templateId?: string | null; schema?: unknown; draftSchema?: unknown },
  userId: string,
): Promise<void> {
  const { licensed, missing } = await checkWorkFontLicense(prisma, project, userId);
  if (!licensed) {
    throw new FontLicenseException(
      FONT_ERROR_CODE.WORK_FONT_NOT_LICENSED,
      `作品包含未授权付费字体：${missing.join(', ')}（需购买对应的付费模板后才能发布）`,
      { missing },
    );
  }
}
