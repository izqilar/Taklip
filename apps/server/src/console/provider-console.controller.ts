import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  Req,
  Body,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { InspectSubjectGuard } from '../common/guards/inspect-subject.guard';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../../prisma/prisma-client';
import type { JwtUser } from '../common/types/jwt-user';
import { bucketMonthly, since180 } from './chart-util';
import { sanitizeSchema, safeMedia, buildPublishedSchema, createProject } from '@h5design/core';
import {
  assertTemplateFontRule,
  assertWorkFontLicense,
  checkWorkFontLicense,
} from '../common/font-license';
import { PublishService } from '../publish/publish.service';

type ReqUser = Express.Request & { user: JwtUser };

/** 规范化日期：date-only('YYYY-MM-DD') 或 ISO 字符串 → 完整 ISO；非法/空 → null（Prisma DateTime 拒绝 date-only 串） */
const normDate = (v: any): string | null => {
  if (!v || typeof v !== 'string') return null;
  const t = new Date(v);
  return isNaN(t.getTime()) ? null : t.toISOString();
};

const SERVICE_SELECT = {
  id: true,
  name: true,
  category: true,
  status: true,
  useCount: true,
  price: true,
  tags: true,
  isOfficial: true,
  cover: true,
  schema: true,
  // 必须一并选出：列表响应里 schema 会被替换成 effectiveSchema(row)（draftSchema ?? schema）
  // 后即抹掉本字段。运营端「模板/服务详情」用 fetchOne(列表定位) 取单条，
  // 少了它就会把详情页右栏渲染成未同步的线上旧稿。
  draftSchema: true,
  createdAt: true,
} as const;

/** 服务商视角消息编号（与用户视角口径一致：公告 N-9xx、业务消息 M-1xxx） */
const CODE = {
  message: (i: number) => 'M-' + (1001 + i),
  notice: (i: number) => 'N-' + (901 + i),
};

/** 视察视角：ADMIN 带 ?subject=<服务商id> 时以被视察对象作用域查询，否则取自身 */
const subjectId = (req: ReqUser, subject?: string) =>
  subject && req.user.role === 'ADMIN' ? subject : req.user.id;

/**
 * 方案 A draft/live 的「当前有效副本」取值口径：有草稿取草稿，否则取线上。
 *
 * ⚠️ 所有用于**展示 / 装载画布**的读接口都必须走这里。
 * 历史 bug：`catalog`（合并列表）做了映射，但 `works/:id`（作品详情）与
 * `services`（模板列表，被模板/服务详情用列表定位取值）没做 —— 同一个作品在
 * 列表卡片里渲染的是最新草稿（图片带 10px 描边拱形、装饰线宽 280），进详情页
 * 右栏却渲染成未同步的线上旧稿（无描边、装饰线只剩 99），表现为
 * 「详情页右侧预览映射不上编辑器的设计效果」。
 */
const effectiveSchema = (row: { draftSchema?: unknown; schema?: unknown }) =>
  row.draftSchema && typeof row.draftSchema === 'object' ? row.draftSchema : row.schema;

/**
 * 服务商中心（SERVICE_PROVIDER 自身视角）作用域端点。
 * 钱包复用 /api/wallet/mine；反馈/消息复用 /api/tickets、/api/messages 的按角色作用域逻辑。
 * 本控制器只负责服务商独有的「我的看板 / 服务管理 / 订单处理 / 资质管理」。
 */
@Controller('api/provider')
@UseGuards(AuthGuard('jwt'), InspectSubjectGuard)
export class ProviderConsoleController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly publishService: PublishService,
  ) {}

  /** 我的看板：钱包 + 订单 + 服务 + 反馈概览 */
  @Get('dashboard')
  @Roles('SERVICE_PROVIDER', 'ADMIN')
  @UseGuards(RolesGuard)
  async dashboard(@Req() req: ReqUser) {
    const id = req.user.id;
    const [
      wallet,
      orderTotal,
      dealOrders,
      refundedOrders,
      payAgg,
      refundAgg,
      refundRevRows,
      serviceCount,
      feedbackCount,
      catAgg,
      revRows,
    ] = await this.prisma.$transaction([
      this.prisma.providerWallet.findUnique({ where: { providerId: id } }),
      this.prisma.templateOrder.count({ where: { template: { authorId: id } } }),
      this.prisma.templateOrder.count({ where: { template: { authorId: id }, status: 'paid' } }),
      this.prisma.templateOrder.count({
        where: { template: { authorId: id }, status: 'refunded' },
      }),
      // 全量支付金额（退款率金额口径分母）
      this.prisma.templateOrder.aggregate({
        where: { template: { authorId: id } },
        _sum: { amount: true },
      }),
      // 退款金额（退款率分子）
      this.prisma.templateOrder.aggregate({
        where: { template: { authorId: id }, status: 'refunded' },
        _sum: { amount: true },
      }),
      // 近 180 天退款（月收入净额冲减）
      this.prisma.templateOrder.findMany({
        where: { template: { authorId: id }, status: 'refunded', createdAt: { gte: since180() } },
        select: { amount: true, createdAt: true },
        take: 2000,
      }),
      this.prisma.template.count({ where: { authorId: id } }),
      this.prisma.ticket.count({
        where: { OR: [{ targetId: id }, { reporterId: id }] },
      }),
      // 图表①：我的服务按类别占比（findMany + 内存聚合）
      this.prisma.template.findMany({
        where: { authorId: id },
        select: { category: true },
      }),
      // 图表②：近 180 天我的收入（按自然月聚合）
      this.prisma.templateOrder.findMany({
        where: { template: { authorId: id }, createdAt: { gte: since180() } },
        select: { amount: true, createdAt: true },
        take: 2000,
      }),
    ]);
    const catMap = new Map<string, number>();
    for (const t of catAgg) {
      const c = t.category || '未分类';
      catMap.set(c, (catMap.get(c) ?? 0) + 1);
    }
    const serviceCategoryShare = [...catMap.entries()].map(([category, count]) => ({
      category,
      count,
    }));
    const totalPayCents = payAgg._sum.amount ?? 0;
    const refundCents = refundAgg._sum.amount ?? 0;
    // 月收入净额：总支付 − 退款（按自然月）
    const grossMonthly = bucketMonthly(revRows.map((r) => ({ amount: r.amount, date: r.createdAt })));
    const refundMonthly = bucketMonthly(
      refundRevRows.map((r) => ({ amount: r.amount, date: r.createdAt })),
    );
    const monthlyRevenue = grossMonthly.map((g, i) => ({
      month: g.month,
      amountCents: Math.max(0, g.amountCents - (refundMonthly[i]?.amountCents ?? 0)),
    }));
    return {
      balanceCents: wallet?.balance ?? 0,
      totalIncomeCents: wallet?.totalIncome ?? 0,
      withdrawnCents: wallet?.withdrawn ?? 0,
      orderCount: orderTotal,
      dealOrders,
      refundedOrders,
      dealRate: orderTotal ? Math.round((dealOrders / orderTotal) * 1000) / 10 : 0,
      returnRate: orderTotal ? Math.round((refundedOrders / orderTotal) * 1000) / 10 : 0,
      refundRate: totalPayCents ? Math.round((refundCents / totalPayCents) * 1000) / 10 : 0,
      serviceCount,
      feedbackCount,
      serviceCategoryShare,
      monthlyRevenue,
    };
  }

  /** 服务管理：我发布的模板（服务供给） */
  @Get('services')
  @Roles('SERVICE_PROVIDER', 'ADMIN')
  @UseGuards(RolesGuard)
  async services(
    @Req() req: ReqUser,
    @Query('subject') subject?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const p = page ? Number(page) : 1;
    const ps = Math.min(pageSize ? Number(pageSize) : 20, 100);
    // 视察视角：ADMIN 带 ?subject=<服务商id> 时以被视察对象作用域查询，否则取自身
    const authorId = subjectId(req, subject);
    const where = { authorId };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.template.findMany({
        where,
        skip: (p - 1) * ps,
        take: ps,
        orderBy: { createdAt: 'desc' },
        select: SERVICE_SELECT,
      }),
      this.prisma.template.count({ where }),
    ]);
    // 对外只暴露「当前有效副本」：schema = draftSchema ?? schema，并抹掉 draftSchema，
    // 保证列表卡片与详情页右栏（fetchOne 走本列表定位单条）读到同一份稿子。
    const items = rows.map((r) => {
      const row: Record<string, unknown> = { ...r, schema: effectiveSchema(r) };
      delete row.draftSchema;
      return row;
    });
    return { items, total, page: p, pageSize: ps };
  }

  /**
   * 模板管理「合并目录」：把前端「我的作品」(Project) 与 服务商模板 (Template)
   * 合并进同一张列表，统一为 { kind, id, name, category, status, cover, schema, ... } 行。
   * - kind='template' 来自 Template（authorId 作用域）；kind='work' 来自 Project（userId 作用域）。
   * - 支持 ?kind=template|work 服务端过滤（与前端「来源」胶囊对齐）；支持 ?page&pageSize 分页。
   * - 每条带完整 schema，供详情页右侧预览区渲染首屏。
   */
  @Get('catalog')
  @Roles('SERVICE_PROVIDER', 'ADMIN')
  @UseGuards(RolesGuard)
  async catalog(
    @Req() req: ReqUser,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('kind') kind?: string,
    @Query('subject') subject?: string,
  ) {
    const uid = subjectId(req, subject);
    const p = page ? Number(page) : 1;
    const ps = Math.min(pageSize ? Number(pageSize) : 20, 100);

    const rows: any[] = [];

    if (!kind || kind === 'template') {
      const tpls = await this.prisma.template.findMany({
        where: { authorId: uid },
        select: {
          id: true, name: true, category: true, status: true, cover: true,
          schema: true, draftSchema: true, useCount: true, price: true, tags: true, isOfficial: true, createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });
      for (const t of tpls) {
        rows.push({
          kind: 'template',
          id: t.id,
          name: t.name,
          category: t.category,
          status: t.status,
          cover: t.cover,
          schema: effectiveSchema(t),
          useCount: t.useCount,
          price: t.price,
          tags: t.tags,
          isOfficial: t.isOfficial,
          viewCount: null,
          publishCode: null,
          createdAt: t.createdAt,
        });
      }
    }

    if (!kind || kind === 'work') {
      const prjs = await this.prisma.project.findMany({
        where: { userId: uid },
        select: {
          id: true, title: true, cover: true, schema: true, draftSchema: true, status: true,
          viewCount: true, publishCode: true, createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });
      for (const pr of prjs) {
        rows.push({
          kind: 'work',
          id: pr.id,
          name: pr.title,
          category: null,
          status: pr.status, // 'draft' | 'published'
          cover: pr.cover,
          schema: effectiveSchema(pr),
          useCount: null,
          price: null,
          tags: [],
          isOfficial: false,
          viewCount: pr.viewCount,
          publishCode: pr.publishCode,
          createdAt: pr.createdAt,
        });
      }
    }

    // 合并后按创建时间倒序（两表各自已倒序，但跨表需整体再排）
    rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const total = rows.length;
    const start = (p - 1) * ps;
    const items = rows.slice(start, start + ps);
    return { items, total, page: p, pageSize: ps };
  }

  /**
   * 作品详情：返回前端「我的作品」完整 schema 供详情页右侧预览区渲染首屏（SELF 作用域）。
   *
   * 关键：schema 必须给出「当前有效副本」(draftSchema ?? schema)。
   * 作品列表卡片（provider/catalog）渲染的是草稿，若这里只给线上 schema，
   * 详情页右栏就会渲染未同步的旧稿 —— 表现为预览与列表/编辑器设计效果不一致。
   */
  @Get('works/:id')
  @Roles('SERVICE_PROVIDER', 'ADMIN')
  @UseGuards(RolesGuard)
  async workDetail(
    @Req() req: ReqUser,
    @Param('id') id: string,
    @Query('subject') subject?: string,
  ) {
    const uid = subjectId(req, subject);
    const proj = await this.prisma.project.findFirst({
      where: { id, userId: uid },
      select: {
        id: true, title: true, cover: true, schema: true, draftSchema: true, status: true,
        viewCount: true, publishCode: true, createdAt: true, updatedAt: true,
      },
    });
    if (!proj) throw new NotFoundException('作品不存在或无权查看');
    const row: Record<string, unknown> = { ...proj, schema: effectiveSchema(proj), kind: 'work' };
    delete row.draftSchema; // 只读预览页不需要草稿原稿，避免响应里出现两套 schema 造成误用
    return row;
  }

  /**
   * 新建作品（SELF / ADMIN 视察 作用域）。
   * 与 web 端「我的作品」同源（同一 Project 表），但归属按 subjectId 解析：
   * ADMIN 视察服务商视角带 ?subject=<服务商id> → 归属于被视察服务商；
   * 服务商自身视角 subject 为空 → 归属 req.user.id。
   * 必须与 GET works/:id 的 subjectId 口径一致，否则 ADMIN 视察视角新建的稿归属
   * 成登录者自身，编辑宿主页按 subject 读会 404「加载作品失败」。
   * ⚠️ @Query('subject') 必须放在 @Body() 之后（TS1016：必选参数不能跟在可选参数后）。
   */
  @Post('works')
  @Roles('SERVICE_PROVIDER', 'ADMIN')
  @UseGuards(RolesGuard)
  async createWork(
    @Req() req: ReqUser,
    @Body() body: { title?: string; schema?: any },
    @Query('subject') subject?: string,
  ) {
    const uid = subjectId(req, subject);
    const schema = body.schema && typeof body.schema === 'object' ? body.schema : createProject(body.title);
    return this.prisma.project.create({
      data: {
        userId: uid,
        title: body.title ?? (schema as any)?.title ?? '未命名作品',
        // 创建即过消毒闸口（与 web 端同源，防御越权/未消毒直写）
        schema: sanitizeSchema(schema) as object,
      },
    });
  }

  /** 模板管理：服务商新建模板（自身作用域） */
  @Post('services')
  @Roles('SERVICE_PROVIDER', 'ADMIN')
  @UseGuards(RolesGuard)
  async createService(@Req() req: ReqUser, @Body() body: any, @Query('subject') subject?: string) {
    const uid = subjectId(req, subject);
    const name = (body.name || '').toString().trim();
    if (!name) throw new BadRequestException('模板名称必填');
    const category = (body.category || '').toString().trim();
    if (!category) throw new BadRequestException('模板分类必填');
    const price = Number(body.price);
    if (!Number.isFinite(price) || price < 0) throw new BadRequestException('售价须为不小于 0 的数值（元）');
    const tags = Array.isArray(body.tags) ? body.tags.map((x: any) => String(x)) : [];
    const isOfficial = req.user.role === 'ADMIN' ? !!body.isOfficial : false;
    const status = ['DRAFT', 'PENDING', 'APPROVED', 'TAKEN_DOWN'].includes(body.status) ? body.status : 'PENDING';
    // 生成 T-NNNN 编号（取现有 T- 前缀最大数值 +1）
    const all = await this.prisma.template.findMany({ where: { id: { startsWith: 'T-' } }, select: { id: true } });
    let max = 1000;
    for (const t of all) {
      const n = parseInt((t.id || '').replace(/\D/g, ''), 10);
      if (!isNaN(n) && n > max) max = n;
    }
    const id = 'T-' + String(max + 1);
    const meta = {
      coverTitle: (body.coverTitle || '').toString(),
      titleColor: (body.titleColor || '').toString(),
      coverColor: (body.coverColor || '').toString(),
      intro: (body.intro || '').toString(),
    };
    const rawSchema: any = body.schema && typeof body.schema === 'object'
      ? { ...body.schema, meta }
      : { version: 1, pages: [], meta };
    // 创建即过消毒闸口（模板会在管理端预览/发布）
    const schema = sanitizeSchema(rawSchema) as object;
    const data: any = {
      id,
      name,
      category,
      tags,
      isOfficial,
      price: Math.round(price * 100), // 元 → 分
      status,
      authorId: uid,
      schema,
      cover: body.cover ? safeMedia(body.cover) : null,
    };
    return this.prisma.template.create({ data });
  }

  /** 模板管理：服务商编辑自己的模板（SELF 作用域） */
  @Patch('services/:id')
  @Roles('SERVICE_PROVIDER', 'ADMIN')
  @UseGuards(RolesGuard)
  async updateService(@Req() req: ReqUser, @Param('id') id: string, @Body() body: any, @Query('subject') subject?: string) {
    const uid = subjectId(req, subject);
    const cur = await this.prisma.template.findFirst({ where: { id, authorId: uid } });
    if (!cur) throw new NotFoundException('模板不存在或无权操作');
    const upd: any = {};
    if (typeof body.name === 'string') upd.name = body.name.trim();
    if (typeof body.category === 'string') upd.category = body.category;
    if (Array.isArray(body.tags)) upd.tags = body.tags.map((x: any) => String(x));
    if (typeof body.price === 'number') upd.price = Math.round(body.price * 100);
    if (typeof body.cover === 'string') {
      const c = body.cover.trim();
      // 封面媒体消毒（仅放通 http(s) 直链，剥离危险协议）
      upd.cover = c ? safeMedia(c) : null;
    }
    if (body.status && ['DRAFT', 'PENDING', 'APPROVED', 'TAKEN_DOWN'].includes(body.status)) upd.status = body.status;
    if (req.user.role === 'ADMIN' && typeof body.isOfficial === 'boolean') upd.isOfficial = body.isOfficial;
    const prev = cur.schema && typeof cur.schema === 'object' ? cur.schema : ({} as any);
    const prevMeta = prev.meta && typeof prev.meta === 'object' ? prev.meta : {};
    const meta = {
      coverTitle: body.coverTitle !== undefined ? String(body.coverTitle) : (prevMeta.coverTitle || ''),
      titleColor: body.titleColor !== undefined ? String(body.titleColor) : (prevMeta.titleColor || ''),
      coverColor: body.coverColor !== undefined ? String(body.coverColor) : (prevMeta.coverColor || ''),
      intro: body.intro !== undefined ? String(body.intro) : (prevMeta.intro || ''),
    };
    upd.schema = { ...prev, meta };
    return this.prisma.template.update({ where: { id }, data: upd });
  }

  /** 模板管理：服务商删除自己的模板（SELF 作用域） */
  @Delete('services/:id')
  @Roles('SERVICE_PROVIDER', 'ADMIN')
  @UseGuards(RolesGuard)
  async deleteService(@Req() req: ReqUser, @Param('id') id: string, @Query('subject') subject?: string) {
    const uid = subjectId(req, subject);
    const cur = await this.prisma.template.findFirst({ where: { id, authorId: uid } });
    if (!cur) throw new NotFoundException('模板不存在或无权操作');
    await this.prisma.template.delete({ where: { id } });
    return { ok: true };
  }

  /**
   * 沙盒→闸门桥接（阶段 D）：将当前服务商的「个人作品 Project」升级为「服务商模板 Template」。
   * - 默认（web 端 submitAsTemplate）直接落 PENDING，汇入运营端审核闸门；
   * - 传入 asDraft=true（运营端「升级为服务」桥接）则先落 DRAFT，把作品带入标准化属性页
   *   补全封面/简介/标签/价格后，再由服务商「提交审核」转 PENDING。
   * schema 取自作品的当前有效副本（draftSchema ?? schema），避免把未发布草稿意外送审。
   * 仅服务商本人（或 ADMIN）可调。
   */
  @Post('from-project')
  @Roles('SERVICE_PROVIDER', 'ADMIN')
  @UseGuards(RolesGuard)
  async fromProject(
    @Req() req: ReqUser,
    @Query('subject') subject?: string,
    @Body()
    body?: {
      projectId?: string;
      name?: string;
      category?: string;
      tags?: string[];
      price?: number;
      cover?: string;
      coverTitle?: string;
      titleColor?: string;
      coverColor?: string;
      intro?: string;
      isOfficial?: boolean;
      asDraft?: boolean;
    },
  ) {
    const uid = subjectId(req, subject);
    if (!body?.projectId) throw new BadRequestException('projectId 必填');
    const project = await this.prisma.project.findFirst({
      where: { id: body.projectId, userId: uid },
    });
    if (!project) throw new NotFoundException('作品不存在或无权操作');
    const schema =
      project.draftSchema && typeof project.draftSchema === 'object'
        ? project.draftSchema
        : project.schema;
    // 作品属性合并进 meta（与 SPTemplateDetail 保存结构一致），保证升级后预览/库卡片一致
    const meta = {
      coverTitle: (body.coverTitle ?? '').toString(),
      titleColor: (body.titleColor ?? '').toString(),
      coverColor: (body.coverColor ?? '').toString(),
      intro: (body.intro ?? '').toString(),
    };
    const rawSchema =
      schema && typeof schema === 'object' ? { ...(schema as any), meta } : { version: 1, pages: [], meta };
    const tpl = await this.prisma.template.create({
      data: {
        authorId: uid,
        name: body.name || project.title || '未命名模板',
        category: body.category || '其他',
        tags: body.tags && body.tags.length ? body.tags.map(String) : [],
        // 封面/设计 schema 同样过消毒闸口（管理端预览与前端模板库均需防 XSS）
        cover: body.cover ? safeMedia(body.cover) : project.cover ? safeMedia(project.cover) : null,
        schema: sanitizeSchema(rawSchema as any) as object,
        // asDraft=true → 落 DRAFT（待在属性页补全后提交审核）；否则直接 PENDING 送审
        status: body.asDraft ? 'DRAFT' : 'PENDING',
        price: typeof body.price === 'number' ? Math.round(body.price * 100) : 0,
        isOfficial: req.user.role === 'ADMIN' ? !!body.isOfficial : false,
      },
      select: { id: true, name: true, category: true, status: true, authorId: true },
    });
    return tpl;
  }

  /**
   * 模板管理：单条加载（含草稿字段），供运营端画布按 `draftSchema ?? schema` 加载。
   * ADMIN 带 ?subject=<服务商id> 时以被视察对象作用域查询。
   *
   * 返回：schema 已归一为「当前有效副本」(draftSchema ?? schema)，同时**保留**原始
   * draftSchema —— 画布宿主 SPTemplateEditor 需要用它判断"是否有未发布草稿"。
   */
  @Get('services/:id')
  @Roles('SERVICE_PROVIDER', 'ADMIN')
  @UseGuards(RolesGuard)
  async getService(
    @Req() req: ReqUser,
    @Param('id') id: string,
    @Query('subject') subject?: string,
  ) {
    const uid = subjectId(req, subject);
    const tpl = await this.prisma.template.findFirst({
      where: { id, authorId: uid },
      select: {
        id: true, name: true, category: true, status: true, useCount: true, price: true,
        tags: true, isOfficial: true, cover: true, schema: true, authorId: true,
        draftSchema: true, draftUpdatedAt: true, liveVersion: true,
        createdAt: true, updatedAt: true,
      },
    });
    if (!tpl) throw new NotFoundException('模板不存在或无权操作');
    return { ...tpl, schema: effectiveSchema(tpl) };
  }

  /** 模板管理：保存草稿（方案 A draft/live）—— 仅写 draftSchema，不动线上 schema */
  @Put('services/:id/draft')
  @Roles('SERVICE_PROVIDER', 'ADMIN')
  @UseGuards(RolesGuard)
  async saveServiceDraft(
    @Req() req: ReqUser,
    @Param('id') id: string,
    @Query('subject') subject?: string,
    @Body() body?: any,
  ) {
    const uid = subjectId(req, subject);
    const cur = await this.prisma.template.findFirst({ where: { id, authorId: uid } });
    if (!cur) throw new NotFoundException('模板不存在或无权操作');
    if (!body || !body.schema || typeof body.schema !== 'object') {
      throw new BadRequestException('草稿 schema 必填');
    }
    return this.prisma.template.update({
      where: { id },
      // 草稿闸口（模板侧）：写入 draftSchema 前统一消毒
      data: { draftSchema: sanitizeSchema(body.schema) as object, draftUpdatedAt: new Date() },
      select: { id: true, draftSchema: true, draftUpdatedAt: true, liveVersion: true, status: true },
    });
  }

  /**
   * 模板管理：发布（方案 A draft/live）—— 原子替换线上 schema + 清草稿 + liveVersion+1。
   * APPROVED 再发布免审直接替换；非 APPROVED（首次上架 / 下线后重新发布）走管理员审核置 PENDING。
   */
  @Post('services/:id/publish')
  @Roles('SERVICE_PROVIDER', 'ADMIN')
  @UseGuards(RolesGuard)
  async publishTemplate(
    @Req() req: ReqUser,
    @Param('id') id: string,
    @Query('subject') subject?: string,
  ) {
    const uid = subjectId(req, subject);
    const cur = await this.prisma.template.findFirst({ where: { id, authorId: uid } });
    if (!cur) throw new NotFoundException('模板不存在或无权操作');
    // 字体授权闸口（免费模板不得含付费字体，业务码 6001）
    // 付费模板则把用到的付费字体写回 Template.paidFonts，供作品侧授权溯源比对。
    const paidFonts = await assertTemplateFontRule(this.prisma, cur);
    // 发布闸口（模板侧）：原子替换前再次统一消毒，杜绝只读/预览页 XSS 与渲染崩。
    // 取稿 + 消毒统一走 core 的 buildPublishedSchema，与作品发布同源（方案 A 单点真源）。
    const nextSchema = buildPublishedSchema(cur.draftSchema, cur.schema) as object;
    const approved = cur.status === 'APPROVED';
    const status = approved ? 'APPROVED' : 'PENDING';
    const updated = await this.prisma.template.update({
      where: { id },
      data: {
        schema: nextSchema,
        // 封面同样走媒体消毒
        cover: cur.cover ? safeMedia(cur.cover) : cur.cover,
        draftSchema: Prisma.DbNull,
        draftUpdatedAt: null,
        // 冗余记录该模板使用的付费字体，作品侧据此判定字体是否来自本模板
        paidFonts,
        liveVersion: { increment: 1 },
        status,
        updatedAt: new Date(),
      },
      select: { id: true, status: true, liveVersion: true, draftSchema: true, updatedAt: true },
    });
    return { ...updated, published: approved, reviewRequired: !approved };
  }

  /** 模板管理：放弃草稿（方案 A draft/live）—— 仅清空 draftSchema / draftUpdatedAt */
  @Delete('services/:id/draft')
  @Roles('SERVICE_PROVIDER', 'ADMIN')
  @UseGuards(RolesGuard)
  async discardServiceDraft(
    @Req() req: ReqUser,
    @Param('id') id: string,
    @Query('subject') subject?: string,
  ) {
    const uid = subjectId(req, subject);
    const cur = await this.prisma.template.findFirst({ where: { id, authorId: uid } });
    if (!cur) throw new NotFoundException('模板不存在或无权操作');
    return this.prisma.template.update({
      where: { id },
      data: { draftSchema: Prisma.DbNull, draftUpdatedAt: null },
      select: { id: true, draftSchema: true, draftUpdatedAt: true, liveVersion: true, status: true },
    });
  }

  /** 作品管理：保存草稿（方案 A draft/live）—— 仅写 Project.draftSchema，不动线上 schema */
  @Put('works/:id/draft')
  @Roles('SERVICE_PROVIDER', 'ADMIN')
  @UseGuards(RolesGuard)
  async saveWorkDraft(
    @Req() req: ReqUser,
    @Param('id') id: string,
    @Query('subject') subject?: string,
    @Body() body?: any,
  ) {
    const uid = subjectId(req, subject);
    const cur = await this.prisma.project.findFirst({ where: { id, userId: uid } });
    if (!cur) throw new NotFoundException('作品不存在或无权操作');
    if (!body || !body.schema || typeof body.schema !== 'object') {
      throw new BadRequestException('草稿 schema 必填');
    }
    return this.prisma.project.update({
      where: { id },
      data: { draftSchema: sanitizeSchema(body.schema) as object },
      select: { id: true, draftSchema: true, status: true },
    });
  }

  /** 作品管理：发布（方案 A draft/live）—— 委托 PublishService 统一处理
   *  （归属校验 + 字体授权闸口 + 草稿原子替换线上 + 清草稿 + 首次发布生成 publishCode）。
   *  此处仅解析代理商/区域治理替身主体（subjectId），其余逻辑与 web 端 /api/publish 同源，避免双份实现漂移。 */
  @Post('works/:id/publish')
  @Roles('SERVICE_PROVIDER', 'ADMIN')
  @UseGuards(RolesGuard)
  async publishWork(
    @Req() req: ReqUser,
    @Param('id') id: string,
    @Query('subject') subject?: string,
  ) {
    const uid = subjectId(req, subject);
    return this.publishService.publish(id, uid);
  }

  /**
   * 作品管理：取消发布（与 web 端 DELETE /api/publish/:id 同源，委托 PublishService.unpublish）。
   * 代理商/区域治理替身语义同样通过 subjectId 解析。
   */
  @Delete('works/:id/publish')
  @Roles('SERVICE_PROVIDER', 'ADMIN')
  @UseGuards(RolesGuard)
  async unpublishWork(
    @Req() req: ReqUser,
    @Param('id') id: string,
    @Query('subject') subject?: string,
  ) {
    const uid = subjectId(req, subject);
    return this.publishService.unpublish(id, uid);
  }

  /**
   * 作品管理：删除作品（SELF 作用域）。
   * 之前运营端删除走 web 域 DELETE /api/projects/:id（仅认 req.user.id），
   * ADMIN 视察视角（服务商/用户视角代删）必然 404「作品不存在」；
   * 现补 provider 域端点，与 works 读/发布/取消发布同一套 subjectId 口径。
   */
  @Delete('works/:id')
  @Roles('SERVICE_PROVIDER', 'ADMIN')
  @UseGuards(RolesGuard)
  async deleteWork(
    @Req() req: ReqUser,
    @Param('id') id: string,
    @Query('subject') subject?: string,
  ) {
    const uid = subjectId(req, subject);
    const cur = await this.prisma.project.findFirst({ where: { id, userId: uid } });
    if (!cur) throw new NotFoundException('作品不存在或无权操作');
    await this.prisma.project.delete({ where: { id } });
    return { ok: true };
  }

  /** 订单处理：我提供的模板产生的订单 */
  @Get('orders')
  @Roles('SERVICE_PROVIDER', 'ADMIN')
  @UseGuards(RolesGuard)
  async orders(
    @Req() req: ReqUser,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: string,
  ) {
    const p = page ? Number(page) : 1;
    const ps = Math.min(pageSize ? Number(pageSize) : 10, 100);
    const where: any = { template: { authorId: req.user.id } };
    if (status) where.status = status;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.templateOrder.findMany({
        where,
        skip: (p - 1) * ps,
        take: ps,
        orderBy: { createdAt: 'desc' },
        include: {
          buyer: { select: { id: true, nickname: true, phone: true } },
          template: { select: { id: true, name: true, category: true, cover: true } },
        },
      }),
      this.prisma.templateOrder.count({ where }),
    ]);
    return { items, total, page: p, pageSize: ps };
  }

  /** 资质管理：当前服务商的资质状态与业务子角色 */
  @Get('qualification')
  @Roles('SERVICE_PROVIDER', 'ADMIN')
  @UseGuards(RolesGuard)
  async qualification(@Req() req: ReqUser) {
    const user = await this.prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        nickname: true,
        phone: true,
        realName: true,
        providerStatus: true,
        serviceRoles: true,
        pendingServiceRoles: true,
      },
    });
    return user;
  }

  // ===================== 服务商视角新增模块端点（SELF 作用域）=====================

  /** 档期管理 */
  @Get('schedules')
  @Roles('SERVICE_PROVIDER', 'ADMIN')
  @UseGuards(RolesGuard)
  async schedules(
    @Req() req: ReqUser,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: string,
  ) {
    const p = page ? Number(page) : 1;
    const ps = Math.min(pageSize ? Number(pageSize) : 20, 100);
    const where: any = { providerId: req.user.id };
    if (status) where.status = status;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.providerSchedule.findMany({
        where,
        skip: (p - 1) * ps,
        take: ps,
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      }),
      this.prisma.providerSchedule.count({ where }),
    ]);
    return { items, total, page: p, pageSize: ps };
  }

  /** 档期时段标签（用于冲突提示） */
  private static PERIOD_LABEL: Record<string, string> = {
    FULL: '全天',
    AM: '09:00-12:00',
    PM1: '12:00-15:00',
    PM2: '15:00-18:00',
    PM3: '18:00-21:00',
    NIGHT: '晚间21:00-23:00',
  };

  /**
   * 档期冲突检测（doc §10.4）：仅「已锁定」参与冲突；
   * 「全天」(FULL) 与任一时段互斥；同日同时段仅允许一个「已锁定」档期；
   * 「可接单 / 已完成」不参与冲突。
   */
  private async checkScheduleConflict(
    providerId: string,
    date: string,
    period: string,
    status: string,
    selfId?: string,
  ) {
    if (status !== 'locked') return null;
    const where: any = { providerId, date, status: 'locked' };
    if (selfId) where.NOT = { id: selfId };
    const ex = await this.prisma.providerSchedule.findMany({ where });
    const overlap = (a: string, b: string) => a === 'FULL' || b === 'FULL' || a === b;
    return ex.find((s: any) => overlap(s.period, period)) ?? null;
  }

  /** 新建档期（SELF 作用域 + 冲突检测） */
  @Post('schedules')
  @Roles('SERVICE_PROVIDER', 'ADMIN')
  @UseGuards(RolesGuard)
  async createSchedule(@Req() req: ReqUser, @Body() body: any, @Query('subject') subject?: string) {
    const providerId = subjectId(req, subject);
    const { date, period, serviceType, status, customer, orderId, note } = body;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date))
      throw new BadRequestException('日期必填且格式为 YYYY-MM-DD');
    if (!['FULL', 'AM', 'PM1', 'PM2', 'PM3', 'NIGHT'].includes(period))
      throw new BadRequestException('时段非法');
    if (!serviceType) throw new BadRequestException('服务类型必填');
    const st = status && ['available', 'locked', 'done'].includes(status) ? status : 'available';
    const conflict = await this.checkScheduleConflict(providerId, date, period, st);
    if (conflict)
      throw new BadRequestException(
        `档期冲突：同日同时段已有「已锁定」档期（${ProviderConsoleController.PERIOD_LABEL[conflict.period] ?? conflict.period}），不可重复锁定`,
      );
    const cnt = await this.prisma.providerSchedule.count({ where: { providerId } });
    const id = `SC-${String(cnt + 1).padStart(4, '0')}`;
    return this.prisma.providerSchedule.create({
      data: {
        id,
        providerId,
        date,
        period,
        serviceType,
        status: st,
        customer: customer || null,
        orderId: orderId || null,
        note: note || null,
      },
    });
  }

  /** 编辑档期（SELF 作用域 + 冲突检测） */
  @Patch('schedules/:id')
  @Roles('SERVICE_PROVIDER', 'ADMIN')
  @UseGuards(RolesGuard)
  async updateSchedule(@Req() req: ReqUser, @Param('id') id: string, @Body() body: any, @Query('subject') subject?: string) {
    const providerId = subjectId(req, subject);
    const cur = await this.prisma.providerSchedule.findFirst({ where: { id, providerId } });
    if (!cur) throw new NotFoundException('档期不存在');
    const nextDate = body.date ?? cur.date;
    const nextPeriod = body.period ?? cur.period;
    const nextStatus =
      body.status && ['available', 'locked', 'done'].includes(body.status) ? body.status : cur.status;
    if (body.date && !/^\d{4}-\d{2}-\d{2}$/.test(nextDate))
      throw new BadRequestException('日期格式应为 YYYY-MM-DD');
    if (body.period && !['FULL', 'AM', 'PM1', 'PM2', 'PM3', 'NIGHT'].includes(nextPeriod))
      throw new BadRequestException('时段非法');
    const conflict = await this.checkScheduleConflict(providerId, nextDate, nextPeriod, nextStatus, id);
    if (conflict)
      throw new BadRequestException(
        `档期冲突：同日同时段已有「已锁定」档期（${ProviderConsoleController.PERIOD_LABEL[conflict.period] ?? conflict.period}），不可重复锁定`,
      );
    return this.prisma.providerSchedule.update({
      where: { id },
      data: {
        date: nextDate,
        period: nextPeriod,
        status: nextStatus,
        serviceType: body.serviceType ?? cur.serviceType,
        customer: body.customer === undefined ? cur.customer : body.customer || null,
        orderId: body.orderId === undefined ? cur.orderId : body.orderId || null,
        note: body.note === undefined ? cur.note : body.note || null,
      },
    });
  }

  /** 删除档期（SELF 作用域） */
  @Delete('schedules/:id')
  @Roles('SERVICE_PROVIDER', 'ADMIN')
  @UseGuards(RolesGuard)
  async deleteSchedule(@Req() req: ReqUser, @Param('id') id: string, @Query('subject') subject?: string) {
    const cur = await this.prisma.providerSchedule.findFirst({ where: { id, providerId: subjectId(req, subject) } });
    if (!cur) throw new NotFoundException('档期不存在');
    await this.prisma.providerSchedule.delete({ where: { id } });
    return { ok: true };
  }

  /** 合同管理 */
  @Get('contracts')
  @Roles('SERVICE_PROVIDER', 'ADMIN')
  @UseGuards(RolesGuard)
  async contracts(
    @Req() req: ReqUser,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: string,
  ) {
    const p = page ? Number(page) : 1;
    const ps = Math.min(pageSize ? Number(pageSize) : 20, 100);
    const where: any = { providerId: req.user.id };
    if (status) where.signStage = status;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.providerContract.findMany({
        where,
        skip: (p - 1) * ps,
        take: ps,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.providerContract.count({ where }),
    ]);
    return { items, total, page: p, pageSize: ps };
  }

  /** 我的团队 */
  @Get('team')
  @Roles('SERVICE_PROVIDER', 'ADMIN')
  @UseGuards(RolesGuard)
  async team(
    @Req() req: ReqUser,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const p = page ? Number(page) : 1;
    const ps = Math.min(pageSize ? Number(pageSize) : 20, 100);
    const where = { providerId: req.user.id };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.providerTeamMember.findMany({
        where,
        skip: (p - 1) * ps,
        take: ps,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.providerTeamMember.count({ where }),
    ]);
    return { items, total, page: p, pageSize: ps };
  }

  @Post('team')
  @Roles('SERVICE_PROVIDER', 'ADMIN')
  @UseGuards(RolesGuard)
  async createTeamMember(@Req() req: ReqUser, @Body() body: any, @Query('subject') subject?: string) {
    const uid = subjectId(req, subject);
    const name = (body.name || '').toString().trim();
    const phone = (body.phone || '').toString().trim();
    if (!name) throw new BadRequestException('成员姓名必填');
    if (!/^\d{11}$/.test(phone)) throw new BadRequestException('手机号须为 11 位数字');
    const members = await this.prisma.providerTeamMember.findMany({
      where: { providerId: uid },
      select: { memberNo: true },
    });
    let max = 1000;
    for (const m of members) {
      const n = parseInt((m.memberNo || '').replace(/\D/g, ''), 10);
      if (!isNaN(n) && n > max) max = n;
    }
    const memberNo = 'MT-' + String(max + 1);
    const data: any = {
      providerId: uid,
      memberNo,
      name,
      phone,
      accountStatus: ['ACTIVE', 'PENDING', 'DISABLED'].includes(body.accountStatus) ? body.accountStatus : 'ACTIVE',
      serviceType: body.serviceType || '',
      teamRole: body.teamRole || '',
      duties: Array.isArray(body.duties) ? body.duties : [],
      personality: body.personality || null,
      dataScope: body.dataScope || 'self',
      funcPerms: Array.isArray(body.funcPerms) ? body.funcPerms : [],
    };
    const created = await this.prisma.providerTeamMember.create({ data });
    return created;
  }

  @Delete('team/:id')
  @Roles('SERVICE_PROVIDER', 'ADMIN')
  @UseGuards(RolesGuard)
  async deleteTeamMember(@Req() req: ReqUser, @Param('id') id: string, @Query('subject') subject?: string) {
    const cur = await this.prisma.providerTeamMember.findFirst({ where: { id, providerId: subjectId(req, subject) } });
    if (!cur) throw new NotFoundException('成员不存在或无权操作');
    await this.prisma.providerTeamMember.delete({ where: { id } });
    return { ok: true };
  }

  /** 我的客户 */
  @Get('clients')
  @Roles('SERVICE_PROVIDER', 'ADMIN')
  @UseGuards(RolesGuard)
  async clients(
    @Req() req: ReqUser,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const p = page ? Number(page) : 1;
    const ps = Math.min(pageSize ? Number(pageSize) : 20, 100);
    const where = { providerId: req.user.id };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.providerClient.findMany({
        where,
        skip: (p - 1) * ps,
        take: ps,
        orderBy: { totalSpend: 'desc' },
      }),
      this.prisma.providerClient.count({ where }),
    ]);
    return { items, total, page: p, pageSize: ps };
  }

  @Post('clients')
  @Roles('SERVICE_PROVIDER', 'ADMIN')
  @UseGuards(RolesGuard)
  async createClient(@Req() req: ReqUser, @Body() body: any, @Query('subject') subject?: string) {
    const uid = subjectId(req, subject);
    const name = (body.name || '').toString().trim();
    const phone = (body.phone || '').toString().trim();
    if (!name) throw new BadRequestException('客户姓名必填');
    if (!/^\d{11}$/.test(phone)) throw new BadRequestException('手机号须为 11 位数字');
    const clients = await this.prisma.providerClient.findMany({
      where: { providerId: uid },
      select: { clientNo: true },
    });
    let max = 1000;
    for (const c of clients) {
      const n = parseInt((c.clientNo || '').replace(/\D/g, ''), 10);
      if (!isNaN(n) && n > max) max = n;
    }
    const clientNo = 'PC-' + String(max + 1);
    const data: any = {
      providerId: uid,
      clientNo,
      name,
      phone,
      tags: Array.isArray(body.tags) ? body.tags : [],
      prefs: Array.isArray(body.prefs) ? body.prefs : [],
      channels: Array.isArray(body.channels) ? body.channels : [],
      totalSpend: 0,
      interactions: 0,
    };
    const created = await this.prisma.providerClient.create({ data });
    return created;
  }

  @Delete('clients/:id')
  @Roles('SERVICE_PROVIDER', 'ADMIN')
  @UseGuards(RolesGuard)
  async deleteClient(@Req() req: ReqUser, @Param('id') id: string, @Query('subject') subject?: string) {
    const cur = await this.prisma.providerClient.findFirst({ where: { id, providerId: subjectId(req, subject) } });
    if (!cur) throw new NotFoundException('客户不存在或无权操作');
    await this.prisma.providerClient.delete({ where: { id } });
    return { ok: true };
  }

  /** 客户精准维护 / 触达：服务商对名下客户发起一次维护任务并留痕 */
  @Post('clients/:id/maintain')
  @Roles('SERVICE_PROVIDER', 'ADMIN')
  @UseGuards(RolesGuard)
  async maintainClient(@Req() req: ReqUser, @Param('id') id: string, @Body() body: any, @Query('subject') inspectSubject?: string) {
    // ⚠️ body.subject 是「维护主题」业务字段，与 ?subject=（视察归属）同名而语义不同，
    // 故归属参数另命名为 inspectSubject，避免与业务字段互相覆盖。
    const uid = subjectId(req, inspectSubject);
    const client = await this.prisma.providerClient.findFirst({ where: { id, providerId: uid } });
    if (!client) throw new NotFoundException('客户不存在或无权操作');
    const TYPES = ['SERVICE_MSG', 'COUPON', 'ACTIVITY', 'REWARD'];
    const CHANNELS = ['INNER_SMS', 'SMS', 'WECHAT', 'PHONE'];
    const type = (body.type || '').toString().trim();
    const channel = (body.channel || '').toString().trim();
    const subject = (body.subject || '').toString().trim();
    const content = (body.content || '').toString().trim();
    if (!TYPES.includes(type)) throw new BadRequestException('维护类型不合法');
    if (!CHANNELS.includes(channel)) throw new BadRequestException('触达渠道不合法');
    if (!subject) throw new BadRequestException('维护主题必填');
    if (!content) throw new BadRequestException('维护内容必填');
    const isBenefit = type === 'COUPON' || type === 'REWARD';
    let amount: number | null = null;
    let validTo: Date | null = null;
    if (isBenefit) {
      amount = Math.max(0, Math.round(Number(body.amount)));
      if (!amount || amount <= 0) throw new BadRequestException('权益面额须为正整数（分）');
      validTo = body.validTo ? new Date(body.validTo) : null;
      if (!validTo || isNaN(validTo.getTime())) throw new BadRequestException('权益有效期必填');
    }
    const reach = await this.prisma.providerClientReach.create({
      data: {
        providerId: uid,
        clientId: client.id,
        clientNo: client.clientNo,
        type,
        channel,
        amount,
        validTo,
        subject,
        content,
      },
    });
    await this.prisma.providerClient.update({
      where: { id: client.id },
      data: { lastMaintain: new Date(), interactions: { increment: 1 } },
    });
    return reach;
  }

  /** 客户触达历史（时间轴），倒序 */
  @Get('clients/:id/reach')
  @Roles('SERVICE_PROVIDER', 'ADMIN')
  @UseGuards(RolesGuard)
  async clientReach(@Req() req: ReqUser, @Param('id') id: string) {
    const client = await this.prisma.providerClient.findFirst({ where: { id, providerId: req.user.id } });
    if (!client) throw new NotFoundException('客户不存在或无权操作');
    const items = await this.prisma.providerClientReach.findMany({
      where: { clientId: id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return { items, total: items.length };
  }

  /** 收入明细（订单结算入账 + 提现汇总） */
  @Get('income')
  @Roles('SERVICE_PROVIDER', 'ADMIN')
  @UseGuards(RolesGuard)
  async income(@Req() req: ReqUser) {
    const id = req.user.id;
    const [orders, withdrawals, wallet] = await this.prisma.$transaction([
      this.prisma.templateOrder.findMany({
        where: { template: { authorId: id }, status: 'paid' },
        orderBy: { createdAt: 'desc' },
        include: { buyer: { select: { nickname: true } }, template: { select: { name: true } } },
        take: 200,
      }),
      this.prisma.withdrawal.findMany({
        where: { providerId: id },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
      this.prisma.providerWallet.findUnique({ where: { providerId: id } }),
    ]);
    const incomeItems = orders.map((o: any) => ({
      id: o.id,
      no: o.orderNo,
      subject: '订单结算',
      relate: o.template?.name || '',
      buyer: o.buyer?.nickname || '',
      type: '入账',
      amountCents: o.designerIncome,
      date: o.createdAt,
      status: '已入账',
    }));
    const pendingCents = withdrawals
      .filter((w: any) => w.status === 'pending')
      .reduce((s: number, w: any) => s + w.amount, 0);
    return {
      items: incomeItems,
      totalIncomeCents: wallet?.totalIncome ?? 0,
      pendingCents,
      settleCycle: 'T+3 个工作日自动入账',
    };
  }

  /** 提现管理（列表） */
  @Get('withdrawals')
  @Roles('SERVICE_PROVIDER', 'ADMIN')
  @UseGuards(RolesGuard)
  async listWithdrawals(
    @Req() req: ReqUser,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: string,
  ) {
    const p = page ? Number(page) : 1;
    const ps = Math.min(pageSize ? Number(pageSize) : 20, 100);
    const where: any = { providerId: req.user.id };
    if (status) where.status = status;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.withdrawal.findMany({
        where,
        skip: (p - 1) * ps,
        take: ps,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.withdrawal.count({ where }),
    ]);
    const agg = await this.prisma.withdrawal.groupBy({
      by: ['status'],
      where: { providerId: req.user.id },
      _sum: { amount: true },
    });
    const sum = (s: string) => agg.find((a: any) => a.status === s)?._sum.amount ?? 0;
    return {
      items,
      total,
      page: p,
      pageSize: ps,
      summary: {
        appliedCents: sum('pending') + sum('paid') + sum('failed'),
        paidCents: sum('paid'),
        pendingCents: sum('pending'),
        failedCents: sum('failed'),
      },
    };
  }

  /** 提现申请（扣减可提现余额，状态 pending 待打款） */
  @Post('withdrawals')
  @Roles('SERVICE_PROVIDER', 'ADMIN')
  @UseGuards(RolesGuard)
  async createWithdrawal(
    @Req() req: ReqUser,
    @Body() body: { amount: number; account?: string },
    @Query('subject') subject?: string,
  ) {
    const uid = subjectId(req, subject);
    const wallet = await this.prisma.providerWallet.findUnique({
      where: { providerId: uid },
    });
    if (!wallet) throw new BadRequestException('钱包不存在');
    const amount = Math.round(Number(body.amount));
    if (!amount || amount <= 0) throw new BadRequestException('金额无效');
    if (amount > wallet.balance)
      throw new BadRequestException('提现金额不可超过可提现余额');
    const wd = await this.prisma.withdrawal.create({
      data: {
        providerId: uid,
        walletId: wallet.id,
        amount,
        status: 'pending',
        currency: 'CNY',
      },
    });
    await this.prisma.providerWallet.update({
      where: { id: wallet.id },
      data: { balance: { decrement: amount } },
    });
    return wd;
  }

  /** 通知公告（服务商可见的权威公告 / 通知），含编号与已读回执 */
  @Get('notices')
  @Roles('SERVICE_PROVIDER', 'ADMIN')
  @UseGuards(RolesGuard)
  async notices(@Req() req: ReqUser, @Query('subject') subject?: string) {
    const uid = subjectId(req, subject);
    const me = await this.prisma.user.findUnique({
      where: { id: uid },
      select: { regionPath: true },
    });
    const rp = me?.regionPath;
    const where: any = {
      status: 'PUBLISHED',
      OR: [{ scope: 'GLOBAL' }],
    };
    if (rp) {
      where.OR.push({ scope: 'REGION', regionPath: { startsWith: rp } });
    }
    where.OR.push({ scope: 'OWN', targetRole: 'SERVICE_PROVIDER' });
    const all = await this.prisma.message.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { author: { select: { id: true, nickname: true, realName: true, phone: true, role: true } } },
    });
    const reads = await this.prisma.messageRead.findMany({ where: { userId: uid } });
    const readSet = new Set(reads.map((r) => r.messageId));
    const items = all.map((m, i) => ({
      ...m,
      code: CODE.notice(i),
      read: readSet.has(m.id),
      status: readSet.has(m.id) ? '已读' : '未读',
    }));
    return { items, total: items.length };
  }

  /** 通知公告详情（服务端校验可见性） */
  @Get('notices/:id')
  @Roles('SERVICE_PROVIDER', 'ADMIN')
  @UseGuards(RolesGuard)
  async noticeDetail(
    @Req() req: ReqUser,
    @Param('id') id: string,
    @Query('subject') subject?: string,
  ) {
    const uid = subjectId(req, subject);
    const me = await this.prisma.user.findUnique({
      where: { id: uid },
      select: { regionPath: true },
    });
    const rp = me?.regionPath;
    const where: any = { status: 'PUBLISHED', OR: [{ scope: 'GLOBAL' }] };
    if (rp) where.OR.push({ scope: 'REGION', regionPath: { startsWith: rp } });
    where.OR.push({ scope: 'OWN', targetRole: 'SERVICE_PROVIDER' });
    const m = await this.prisma.message.findUnique({
      where: { id },
      include: { author: { select: { id: true, nickname: true, realName: true, phone: true, role: true } } },
    });
    if (!m || m.status !== 'PUBLISHED') throw new NotFoundException('公告不存在');
    const visible =
      m.scope === 'GLOBAL' ||
      (m.scope === 'REGION' && !!rp && !!m.regionPath && rp.startsWith(m.regionPath)) ||
      (m.scope === 'OWN' && m.targetRole === 'SERVICE_PROVIDER');
    if (!visible) throw new NotFoundException('无权查看该公告');
    const ordered = await this.prisma.message.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    const idx = ordered.findIndex((x) => x.id === id);
    const code = idx >= 0 ? CODE.notice(idx) : undefined;
    const read = await this.prisma.messageRead.findFirst({
      where: { messageId: id, userId: uid },
    });
    return { ...m, code, read: !!read, status: read ? '已读' : '未读' };
  }

  /** 通知公告标记已读 */
  @Post('notices/:id/read')
  @Roles('SERVICE_PROVIDER', 'ADMIN')
  @UseGuards(RolesGuard)
  async readNotice(
    @Req() req: ReqUser,
    @Param('id') id: string,
    @Query('subject') subject?: string,
  ) {
    const uid = subjectId(req, subject);
    await this.prisma.messageRead.upsert({
      where: { messageId_userId: { messageId: id, userId: uid } },
      create: { messageId: id, userId: uid },
      update: {},
    });
    return { ok: true };
  }

  /** 业务消息（服务商收件箱），含编号与已读回执 */
  @Get('messages')
  @Roles('SERVICE_PROVIDER', 'ADMIN')
  @UseGuards(RolesGuard)
  async messages(
    @Req() req: ReqUser,
    @Query('subject') subject?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const uid = subjectId(req, subject);
    const me = await this.prisma.user.findUnique({
      where: { id: uid },
      select: { regionPath: true },
    });
    const rp = me?.regionPath;
    const where: any = {
      status: 'PUBLISHED',
      OR: [{ scope: 'GLOBAL' }],
    };
    if (rp) {
      where.OR.push({ scope: 'REGION', regionPath: { startsWith: rp } });
    }
    where.OR.push({ scope: 'OWN', targetRole: 'SERVICE_PROVIDER' });
    const all = await this.prisma.message.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { author: { select: { id: true, nickname: true, phone: true, role: true } } },
    });
    const reads = await this.prisma.messageRead.findMany({ where: { userId: uid } });
    const readSet = new Set(reads.map((r) => r.messageId));
    const p = page ? Number(page) : 1;
    const ps = Math.min(pageSize ? Number(pageSize) : 15, 100);
    const start = (p - 1) * ps;
    const items = all.slice(start, start + ps).map((m, i) => ({
      ...m,
      code: CODE.message(start + i),
      read: readSet.has(m.id),
      status: readSet.has(m.id) ? '已读' : '未读',
    }));
    return { items, total: all.length, page: p, pageSize: ps };
  }

  /** 业务消息详情（服务端校验可见性） */
  @Get('messages/:id')
  @Roles('SERVICE_PROVIDER', 'ADMIN')
  @UseGuards(RolesGuard)
  async messageDetail(
    @Req() req: ReqUser,
    @Param('id') id: string,
    @Query('subject') subject?: string,
  ) {
    const uid = subjectId(req, subject);
    const me = await this.prisma.user.findUnique({
      where: { id: uid },
      select: { regionPath: true },
    });
    const rp = me?.regionPath;
    const where: any = { status: 'PUBLISHED', OR: [{ scope: 'GLOBAL' }] };
    if (rp) where.OR.push({ scope: 'REGION', regionPath: { startsWith: rp } });
    where.OR.push({ scope: 'OWN', targetRole: 'SERVICE_PROVIDER' });
    const m = await this.prisma.message.findUnique({
      where: { id },
      include: { author: { select: { id: true, nickname: true, phone: true, role: true } } },
    });
    if (!m || m.status !== 'PUBLISHED') throw new NotFoundException('消息不存在');
    const visible =
      m.scope === 'GLOBAL' ||
      (m.scope === 'REGION' && !!rp && !!m.regionPath && rp.startsWith(m.regionPath)) ||
      (m.scope === 'OWN' && m.targetRole === 'SERVICE_PROVIDER');
    if (!visible) throw new NotFoundException('无权查看该消息');
    const ordered = await this.prisma.message.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    const idx = ordered.findIndex((x) => x.id === id);
    const code = idx >= 0 ? CODE.message(idx) : undefined;
    const read = await this.prisma.messageRead.findFirst({
      where: { messageId: id, userId: uid },
    });
    return { ...m, code, read: !!read, status: read ? '已读' : '未读' };
  }

  /** 业务消息标记已读 */
  @Post('messages/:id/read')
  @Roles('SERVICE_PROVIDER', 'ADMIN')
  @UseGuards(RolesGuard)
  async readMessage(
    @Req() req: ReqUser,
    @Param('id') id: string,
    @Query('subject') subject?: string,
  ) {
    const uid = subjectId(req, subject);
    await this.prisma.messageRead.upsert({
      where: { messageId_userId: { messageId: id, userId: uid } },
      create: { messageId: id, userId: uid },
      update: {},
    });
    return { ok: true };
  }

  /** 意见反馈（服务商自己提交的反馈 / 申诉） */
  @Get('complaints')
  @Roles('SERVICE_PROVIDER', 'ADMIN')
  @UseGuards(RolesGuard)
  async complaints(@Req() req: ReqUser) {
    const items = await this.prisma.ticket.findMany({
      where: { reporterId: req.user.id },
      orderBy: { createdAt: 'desc' },
      include: { target: { select: { nickname: true } } },
      take: 100,
    });
    return { items, total: items.length };
  }

  @Post('complaints')
  @Roles('SERVICE_PROVIDER', 'ADMIN')
  @UseGuards(RolesGuard)
  async createComplaint(@Req() req: ReqUser, @Body() body: any, @Query('subject') subject?: string) {
    const uid = subjectId(req, subject);
    const title = (body.title || '').toString().trim();
    const content = (body.content || '').toString().trim();
    const ALLOWED = ['AFTERSALE', 'SUGGESTION', 'CONSULT', 'COMPLAINT', 'OTHER'];
    const type = ALLOWED.includes(body.type) ? body.type : 'OTHER';
    if (!title) throw new BadRequestException('反馈主题必填');
    if (title.length > 60) throw new BadRequestException('反馈主题不超过 60 字');
    if (!content) throw new BadRequestException('反馈内容必填');
    if (content.length > 1000) throw new BadRequestException('反馈内容不超过 1000 字');
    const data: any = {
      type,
      title,
      content,
      reporterId: uid,
      reporterRole: req.user.role,
      regionPath: req.user.regionPath || null,
      status: 'OPEN',
    };
    if (body.targetId) data.targetId = body.targetId;
    if (body.department === 'AGENT' || body.department === 'ADMIN') data.assigneeRole = body.department;
    const created = await this.prisma.ticket.create({ data });
    return created;
  }

  @Delete('complaints/:id')
  @Roles('SERVICE_PROVIDER', 'ADMIN')
  @UseGuards(RolesGuard)
  async deleteComplaint(@Req() req: ReqUser, @Param('id') id: string, @Query('subject') subject?: string) {
    const cur = await this.prisma.ticket.findFirst({ where: { id, reporterId: subjectId(req, subject) } });
    if (!cur) throw new NotFoundException('反馈不存在或无权操作');
    await this.prisma.ticket.delete({ where: { id } });
    return { ok: true };
  }

  /** 业务申请（服务商自己的入驻 / 资质申请） */
  @Get('applications')
  @Roles('SERVICE_PROVIDER', 'ADMIN')
  @UseGuards(RolesGuard)
  async applications(@Req() req: ReqUser) {
    const items = await this.prisma.qualificationApplication.findMany({
      where: { userId: req.user.id, kind: 'provider' },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return { items, total: items.length };
  }

  /** 业务申请：服务商提交入驻 / 资质申请（自身作用域，新建） */
  @Post('applications')
  @Roles('SERVICE_PROVIDER', 'ADMIN')
  @UseGuards(RolesGuard)
  async createApplication(@Req() req: ReqUser, @Body() body: any, @Query('subject') subject?: string) {
    const uid = subjectId(req, subject);
    const applicantName = (body.applicantName || '').toString().trim();
    if (!applicantName) throw new BadRequestException('申请主体名称必填');
    const phone = (body.phone || '').toString().trim();
    if (!/^\d{11}$/.test(phone)) throw new BadRequestException('手机号须为 11 位数字');
    const regionPath = (body.regionPath || '').toString().trim();
    if (!regionPath) throw new BadRequestException('请选择申请区域');
    const certNo = (body.certNo || '').toString().trim();
    if (!certNo) throw new BadRequestException('证件编号必填');
    const data: any = {
      userId: uid,
      kind: 'provider',
      status: 'FIRST_PENDING',
      applicantName,
      phone,
      regionPath,
      regionLabel: body.regionLabel || null,
      serviceScopes: Array.isArray(body.serviceScopes) ? body.serviceScopes.map((x: any) => String(x)) : [],
      certType: body.certType || null,
      certNo,
      certExpire: body.certExpire || null,
      certLongTerm: !!body.certLongTerm,
      issuer: body.issuer || null,
      reason: body.reason || '',
      attachments: Array.isArray(body.attachments) ? body.attachments : [],
    };
    return this.prisma.qualificationApplication.create({ data });
  }

  /** 业务申请：服务商补充 / 修改资料（SELF 作用域，仅可编辑态可改） */
  @Patch('applications/:id')
  @Roles('SERVICE_PROVIDER', 'ADMIN')
  @UseGuards(RolesGuard)
  async updateApplication(@Req() req: ReqUser, @Param('id') id: string, @Body() body: any, @Query('subject') subject?: string) {
    const cur = await this.prisma.qualificationApplication.findFirst({ where: { id, userId: subjectId(req, subject) } });
    if (!cur) throw new NotFoundException('申请不存在或无权操作');
    if (!['FIRST_PENDING', 'FIRST_PASSED'].includes(cur.status)) {
      throw new BadRequestException('当前申请状态不可修改');
    }
    const upd: any = {};
    if (typeof body.applicantName === 'string') upd.applicantName = body.applicantName.trim();
    if (typeof body.phone === 'string') {
      if (!/^\d{11}$/.test(body.phone.trim())) throw new BadRequestException('手机号须为 11 位数字');
      upd.phone = body.phone.trim();
    }
    if (typeof body.regionPath === 'string') { upd.regionPath = body.regionPath; upd.regionLabel = body.regionLabel || null; }
    if (Array.isArray(body.serviceScopes)) upd.serviceScopes = body.serviceScopes.map((x: any) => String(x));
    if (typeof body.certType === 'string') upd.certType = body.certType;
    if (typeof body.certNo === 'string') upd.certNo = body.certNo.trim();
    if (typeof body.certExpire === 'string') upd.certExpire = body.certExpire || null;
    if (typeof body.certLongTerm === 'boolean') upd.certLongTerm = body.certLongTerm;
    if (typeof body.issuer === 'string') upd.issuer = body.issuer || null;
    if (typeof body.reason === 'string') upd.reason = body.reason;
    if (Array.isArray(body.attachments)) upd.attachments = body.attachments;
    return this.prisma.qualificationApplication.update({ where: { id }, data: upd });
  }

  /** 业务申请：撤回 / 删除（SELF 作用域，仅可编辑态可删，便于幂等清理） */
  @Delete('applications/:id')
  @Roles('SERVICE_PROVIDER', 'ADMIN')
  @UseGuards(RolesGuard)
  async deleteApplication(@Req() req: ReqUser, @Param('id') id: string, @Query('subject') subject?: string) {
    const cur = await this.prisma.qualificationApplication.findFirst({ where: { id, userId: subjectId(req, subject) } });
    if (!cur) throw new NotFoundException('申请不存在或无权操作');
    if (!['FIRST_PENDING', 'FIRST_PASSED'].includes(cur.status)) {
      throw new BadRequestException('当前申请状态不可删除');
    }
    await this.prisma.qualificationApplication.delete({ where: { id } });
    return { ok: true };
  }

  /** 资质管理：服务商资质项（证照）列表（SELF 作用域） */
  @Get('qualifications')
  @Roles('SERVICE_PROVIDER', 'ADMIN')
  @UseGuards(RolesGuard)
  async qualifications(@Req() req: ReqUser) {
    const items = await this.prisma.providerLicense.findMany({
      where: { providerId: req.user.id },
      orderBy: { createdAt: 'desc' },
    });
    return { items, total: items.length };
  }

  /** 资质管理：新增资质项（SELF 作用域，编号 ZZ-NNNN 本服务商内自增） */
  @Post('qualifications')
  @Roles('SERVICE_PROVIDER', 'ADMIN')
  @UseGuards(RolesGuard)
  async createLicense(@Req() req: ReqUser, @Body() body: any, @Query('subject') subject?: string) {
    const uid = subjectId(req, subject);
    const name = (body.name || '').toString().trim();
    if (!name) throw new BadRequestException('资质名称必填');
    const type = (body.type || '').toString().trim();
    if (!type) throw new BadRequestException('资质类型必填');
    const certNo = (body.certNo || '').toString().trim();
    if (!certNo) throw new BadRequestException('证件编号必填');
    const longTerm = !!body.longTerm;
    if (!longTerm && !body.validTo) throw new BadRequestException('请填写有效期至，或勾选长期有效');
    const all = await this.prisma.providerLicense.findMany({
      where: { providerId: uid },
      select: { licNo: true },
    });
    let max = 1000;
    for (const l of all) {
      const n = parseInt((l.licNo || '').replace(/\D/g, ''), 10);
      if (!isNaN(n) && n > max) max = n;
    }
    const licNo = 'ZZ-' + String(max + 1);
    const data: any = {
      providerId: uid,
      licNo,
      name,
      type,
      certNo,
      issuer: body.issuer || null,
      validFrom: normDate(body.validFrom),
      validTo: longTerm ? null : normDate(body.validTo),
      longTerm,
      expireRemind: body.expireRemind || null,
      status: ['待审核', '有效', '已过期', '已驳回'].includes(body.status) ? body.status : '待审核',
      description: body.description || '',
      attachments: Array.isArray(body.attachments) ? body.attachments : [],
    };
    return this.prisma.providerLicense.create({ data });
  }

  /** 资质管理：更新资质项（SELF 作用域） */
  @Patch('qualifications/:id')
  @Roles('SERVICE_PROVIDER', 'ADMIN')
  @UseGuards(RolesGuard)
  async updateLicense(@Req() req: ReqUser, @Param('id') id: string, @Body() body: any, @Query('subject') subject?: string) {
    const cur = await this.prisma.providerLicense.findFirst({ where: { id, providerId: subjectId(req, subject) } });
    if (!cur) throw new NotFoundException('资质项不存在或无权操作');
    const upd: any = {};
    if (typeof body.name === 'string') upd.name = body.name.trim();
    if (typeof body.type === 'string') upd.type = body.type;
    if (typeof body.certNo === 'string') upd.certNo = body.certNo.trim();
    if (typeof body.issuer === 'string') upd.issuer = body.issuer || null;
    if (body.validFrom !== undefined) upd.validFrom = normDate(body.validFrom);
    if (typeof body.longTerm === 'boolean') upd.longTerm = body.longTerm;
    if (body.validTo !== undefined) upd.validTo = body.longTerm ? null : normDate(body.validTo);
    if (typeof body.expireRemind === 'string') upd.expireRemind = body.expireRemind || null;
    if (typeof body.status === 'string' && ['待审核', '有效', '已过期', '已驳回'].includes(body.status)) upd.status = body.status;
    if (typeof body.description === 'string') upd.description = body.description;
    if (Array.isArray(body.attachments)) upd.attachments = body.attachments;
    return this.prisma.providerLicense.update({ where: { id }, data: upd });
  }

  /** 资质管理：删除资质项（SELF 作用域） */
  @Delete('qualifications/:id')
  @Roles('SERVICE_PROVIDER', 'ADMIN')
  @UseGuards(RolesGuard)
  async deleteLicense(@Req() req: ReqUser, @Param('id') id: string, @Query('subject') subject?: string) {
    const cur = await this.prisma.providerLicense.findFirst({ where: { id, providerId: subjectId(req, subject) } });
    if (!cur) throw new NotFoundException('资质项不存在或无权操作');
    await this.prisma.providerLicense.delete({ where: { id } });
    return { ok: true };
  }

  /** 订单履约动作：接单 / 完成交付 / 拒单 */
  @Patch('orders/:id/action')
  @Roles('SERVICE_PROVIDER', 'ADMIN')
  @UseGuards(RolesGuard)
  async orderAction(
    @Req() req: ReqUser,
    @Param('id') id: string,
    @Body() body: { action: string },
    @Query('subject') subject?: string,
  ) {
    const order = await this.prisma.templateOrder.findFirst({
      where: { id, template: { authorId: subjectId(req, subject) } },
    });
    if (!order) throw new NotFoundException('订单不存在或无权操作');
    const map: Record<string, string> = {
      accept: 'in_service',
      complete: 'completed',
      reject: 'refunded',
    };
    const next = map[body.action];
    if (!next) throw new BadRequestException('未知动作');
    return this.prisma.templateOrder.update({
      where: { id },
      data: { serviceStatus: next },
    });
  }

  /** 合同编辑（商务条款等，带校验；SELF 作用域） */
  @Patch('contracts/:id')
  @Roles('SERVICE_PROVIDER', 'ADMIN')
  @UseGuards(RolesGuard)
  async updateContract(
    @Req() req: ReqUser,
    @Param('id') id: string,
    @Body() body: any,
    @Query('subject') subject?: string,
  ) {
    const c = await this.prisma.providerContract.findFirst({
      where: { id, providerId: subjectId(req, subject) },
    });
    if (!c) throw new NotFoundException('合同不存在或无权操作');
    const data: any = {};
    if (body.name != null) {
      const name = String(body.name).trim();
      if (name.length < 8 || name.length > 24) {
        throw new BadRequestException('合同名称需为 8–24 字');
      }
      data.name = name;
    }
    if (body.partyA != null) {
      const p = String(body.partyA).trim();
      if (!p) throw new BadRequestException('签约甲方必填');
      data.partyA = p;
    }
    if (body.type != null) {
      const v = String(body.type);
      if (!['MAIN', 'SUPPLEMENT', 'RENEW', 'TERMINATE'].includes(v)) {
        throw new BadRequestException('合同类型非法');
      }
      data.type = v;
    }
    if (body.serviceType != null) data.serviceType = String(body.serviceType);
    if (body.businessMode != null) {
      const v = String(body.businessMode);
      if (!['REGION_EXCLUSIVE', 'ONLINE', 'ON_SITE', 'JOINT'].includes(v)) {
        throw new BadRequestException('业务开展方式非法');
      }
      data.businessMode = v;
    }
    if (body.region != null) data.region = String(body.region);
    if (body.exclusive != null) data.exclusive = !!body.exclusive;
    if (body.platformRate != null) {
      const r = Number(body.platformRate);
      if (!Number.isInteger(r) || r < 0 || r > 60) {
        throw new BadRequestException('平台抽成需为 0–60 的整数');
      }
      data.platformRate = r;
    }
    if (body.deposit != null) {
      const d = Number(body.deposit);
      if (!Number.isInteger(d) || d < 0) {
        throw new BadRequestException('服务保证金需为非负整数（分）');
      }
      data.deposit = d;
    }
    if (body.settlePeriod != null) {
      const v = String(body.settlePeriod);
      if (!['MONTH', 'HALF_MONTH', 'WEEK'].includes(v)) {
        throw new BadRequestException('结算周期非法');
      }
      data.settlePeriod = v;
    }
    if (body.expireDate != null) data.expireDate = new Date(body.expireDate);
    if (Object.keys(data).length === 0) throw new BadRequestException('无有效更新字段');
    return this.prisma.providerContract.update({ where: { id }, data });
  }

  /** 追加协商记录（按轮次留痕） */
  @Post('contracts/:id/negotiation')
  @Roles('SERVICE_PROVIDER', 'ADMIN')
  @UseGuards(RolesGuard)
  async addNegotiation(
    @Req() req: ReqUser,
    @Param('id') id: string,
    @Body() body: { text: string },
    @Query('subject') subject?: string,
  ) {
    const c = await this.prisma.providerContract.findFirst({
      where: { id, providerId: subjectId(req, subject) },
    });
    if (!c) throw new NotFoundException('合同不存在或无权操作');
    const text = (body.text || '').trim();
    if (!text) throw new BadRequestException('协商记录内容必填');
    const stamp = new Date().toLocaleString('zh-CN', { hour12: false });
    const next = [...(c.negotiation || []), `[${stamp}] 服务商：${text}`];
    return this.prisma.providerContract.update({
      where: { id },
      data: { negotiation: next },
    });
  }

  /** 发起在线签署（仅待服务商签署 / 已生效 阶段可发起） */
  @Post('contracts/:id/sign')
  @Roles('SERVICE_PROVIDER', 'ADMIN')
  @UseGuards(RolesGuard)
  async signContract(@Req() req: ReqUser, @Param('id') id: string, @Query('subject') subject?: string) {
    const c = await this.prisma.providerContract.findFirst({
      where: { id, providerId: subjectId(req, subject) },
    });
    if (!c) throw new NotFoundException('合同不存在或无权操作');
    if (c.signStage === 'AWAIT_PROVIDER_SIGN') {
      return this.prisma.providerContract.update({
        where: { id },
        data: { signStage: 'AWAIT_SENIOR_SIGN', signDate: new Date() },
      });
    }
    if (c.signStage === 'EFFECTIVE') {
      // 已生效合同重新签署（续签 / 条款变更后重签）
      return this.prisma.providerContract.update({
        where: { id },
        data: { signStage: 'AWAIT_SENIOR_SIGN' },
      });
    }
    throw new BadRequestException('当前签署阶段不可发起在线签署');
  }

  /** 我的评价：客户对我（服务商）的评价（含服务商回评字段） */
  @Get('reviews')
  @Roles('SERVICE_PROVIDER', 'ADMIN')
  @UseGuards(RolesGuard)
  async reviews(@Req() req: ReqUser) {
    const items = await this.prisma.review.findMany({
      where: { providerId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { user: { select: { id: true, nickname: true, phone: true } } },
    });
    return { items, total: items.length };
  }

  /** 服务商回评（互评）客户评价：星级 1–5 + 内容必填 */
  @Post('reviews/:id/reply')
  @Roles('SERVICE_PROVIDER', 'ADMIN')
  @UseGuards(RolesGuard)
  async replyReview(
    @Req() req: ReqUser,
    @Param('id') id: string,
    @Body() body: { replyRating: number; reply: string },
    @Query('subject') subject?: string,
  ) {
    const review = await this.prisma.review.findFirst({
      where: { id, providerId: subjectId(req, subject) },
    });
    if (!review) throw new NotFoundException('评价不存在或无权操作');
    const rating = Number(body.replyRating);
    if (!rating || rating < 1 || rating > 5) {
      throw new BadRequestException('回评星级需在 1–5 之间');
    }
    const content = (body.reply || '').trim();
    if (!content) throw new BadRequestException('回评内容必填');
    return this.prisma.review.update({
      where: { id },
      data: { reply: content, replyRating: rating, replyAt: new Date() },
    });
  }
}
