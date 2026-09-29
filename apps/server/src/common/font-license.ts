import { BadRequestException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import { collectFontFamilies } from '@h5design/core';
import { buildFontCatalog } from '../console/font-catalog';

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

/**
 * 解析 schema 中用到的「付费字体」family 列表。
 *
 * isPaid 判定改走**目录扫描**（`buildFontCatalog`，与 font.controller 编辑器端点、
 * export.service 导出同源），不再依赖 DB 的 `font` 表。
 *
 * 原因：DB 的 isPaid 只在手动 `POST /fonts/refresh` 时才更新，而从目录新增的付费字体在
 * refresh 前不会被写进 DB → 若此处仍查 DB，发布/导出闸口会对「目录里明明是付费字体」漏判
 * 为免费，导致免费模板夹带付费字体却放行、或作品授权误判。目录即真相可消除该时间窗口。
 *
 * 注：`_prisma` 保留仅为兼容既有调用签名（其余授权逻辑仍依赖它），本函数不再查 DB。
 */
export async function paidFontsInSchema(
  _prisma: PrismaLike,
  row: { schema?: unknown; draftSchema?: unknown },
): Promise<string[]> {
  const families = collectFontFamilies(effectiveSchema(row));
  if (families.length === 0) return [];
  const paidSet = new Set(
    buildFontCatalog()
      .filter((f) => f.isPaid)
      .map((f) => f.family),
  );
  return families.filter((f) => paidSet.has(f));
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
