import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  GUEST_FIELD_DEFS,
  GUEST_FIELDS_VERSION,
  normalizeGuestData,
  validateGuestData,
  type GuestData,
  type GuestFieldDef,
} from '@h5design/core';
import { buildCsv, parseCsv, normalizeCellValue } from '../common/minimal-csv';
import { buildXlsx, readXlsxFirstSheet } from '../common/minimal-xlsx';
import type { JwtUser } from '../common/types/jwt-user';

/** 名单归属类型（决策 D1） */
export type OwnerType = 'SELF' | 'CLIENT' | 'ORG';

/** 当前请求的归属作用域：决定「能看哪些名单」 */
export interface OwnerScope {
  userId: string;
  role: string;
  ownerType: OwnerType;
  /** SP 场景组织 id；SELF 为 null */
  orgId: string | null;
  /** 代客场景客户 id；其余为 null */
  clientId: string | null;
}

/** 统一错误体（所有接口一致：`{ code, message, field? }`） */
export interface ApiErrorBody {
  code: string;
  message: string;
  field?: string;
}

/** 模板列表视图（不含字段明细，列表页用） */
export interface GuestTemplateView {
  id: string;
  name: string;
  ownerType: string;
  isSystem: boolean;
  seq: number;
  version: string;
  fieldCount: number;
  createdAt: Date;
  updatedAt: Date;
}

/** 模板详情视图（含字段明细，查看/编辑页用） */
export interface GuestTemplateDetail extends GuestTemplateView {
  fields: GuestFieldDef[];
}

const err422 = (body: ApiErrorBody) => new UnprocessableEntityException(body);
const err400 = (body: ApiErrorBody) => new BadRequestException(body);
const err404 = () => new NotFoundException({ code: 'NOT_FOUND', message: '资源不存在' });
const err409 = (code: string, message: string) => new ConflictException({ code, message });
const err403 = (code: string, message: string) => new ForbiddenException({ code, message });

/** 名单名长度上限 */
const MAX_LIST_NAME = 60;
/** 单次批量写入上限（防超大 payload 打爆事务） */
const MAX_BATCH_ROWS = 5000;
/** 创建名单时的默认系统模板 id（简易宾客模板） */
const DEFAULT_TEMPLATE_ID = 'sys_simple_guest';

/**
 * 人员名单服务（规范 §9）
 *
 * 隔离纪律（§13）：
 *  - `SELF` 行级 `WHERE ownerId = 当前 userId`
 *  - `CLIENT`/`ORG` 组织域 `WHERE orgId = 当前组织`（+ clientId 精确匹配）
 *  - 查不到 / 越权一律 404，**不暴露存在与归属**
 */
@Injectable()
export class GuestListService {
  constructor(private readonly prisma: PrismaService) {}

  /* ────────────────── 归属作用域 ────────────────── */

  /**
   * 解析归属作用域。
   * - `USER`：恒为 SELF（行级隔离）
   * - `SERVICE_PROVIDER`：orgId = 自身 id；可通过 `clientId` 进入代客(CLIENT)域
   * - SP 员工（USER + staff{PROVIDER} 成员关系）：orgId 取雇佣组织
   */
  resolveScope(user: JwtUser, ownerType?: string, clientId?: string, subject?: string): OwnerScope {
    const role = user.role as string;
    let orgId: string | null = null;
    // ★ ADMIN 监督某服务商（subject=被视察 SP id）+ 组织/客户归属：必须以被视察 SP 身份作用域化。
    //   必须放在 staff 判断之前——ADMIN 的 user.staff 常为 []（Array.isArray 为真），
    //   若排在其后用 else if，会被 L97 的 staff 分支短路，orgId 恒为 null → 仍抛 FORBIDDEN_OWNER_TYPE 400。
    if (role === 'ADMIN' && subject && (ownerType === 'ORG' || ownerType === 'CLIENT')) {
      // 作用域锁定在 subject SP，不弱化隔离
      orgId = subject;
    } else if (role === 'SERVICE_PROVIDER') {
      orgId = user.id;
    } else if (Array.isArray(user.staff)) {
      const m = user.staff.find((s) => s.orgType === 'PROVIDER' && s.accountStatus === 'ACTIVE');
      if (m) orgId = m.orgId;
    }

    const isSp = !!orgId;
    let type: OwnerType = 'SELF';
    if (ownerType === 'CLIENT' || ownerType === 'ORG') {
      if (!isSp) throw err400({ code: 'FORBIDDEN_OWNER_TYPE', message: '仅服务商可使用代客/组织归属' });
      type = ownerType;
    }
    if (!isSp && clientId) throw err400({ code: 'FORBIDDEN_CLIENT_SCOPE', message: '无权访问该客户域' });

    return { userId: user.id, role, ownerType: type, orgId, clientId: clientId ?? null };
  }

  /** 按作用域构造名单查询条件（隔离唯一入口，禁止各处手写 where） */
  private listWhere(scope: OwnerScope): Record<string, unknown> {
    const base: Record<string, unknown> = { deletedAt: null };
    if (scope.ownerType === 'SELF') return { ...base, ownerId: scope.userId, ownerType: 'SELF' };
    return {
      ...base,
      ownerType: scope.ownerType,
      orgId: scope.orgId,
      ...(scope.ownerType === 'CLIENT'
        ? { clientId: scope.clientId }
        : { clientId: null }),
    };
  }

  private async mustGetList(scope: OwnerScope, listId: string) {
    const list = await this.prisma.guestList.findFirst({ where: { id: listId, ...this.listWhere(scope) } });
    if (!list) throw err404();
    return list;
  }

  /* ────────────────── §9.1 标准化模板下载 ────────────────── */

  /** 字段定义 JSON（供前端字段说明浮层与导入列自动映射；随字段设计变化） */
  templateSchema(defs: readonly GuestFieldDef[] = GUEST_FIELD_DEFS) {
    return {
      version: GUEST_FIELDS_VERSION,
      fields: defs.map((d) => ({
        key: d.key,
        label: d.label,
        type: d.type,
        required: d.required,
        maxLen: d.maxLen,
        enum: d.enum,
        values: d.values,
        pattern: d.pattern,
        example: d.example,
      })),
    };
  }

  /**
   * 模板行：
   *  - CSV：首行字段 key，第二行中文说明（含必填标记），第三行为空行占位
   *  - XLSX：首行中文表头，第二行示例，另附「字段说明」工作表
   * defs 为当前作用域的字段设计（缺省回退标准定义）。
   */
  private templateHeaderRow(defs: readonly GuestFieldDef[]): string[] {
    return defs.map((d) => (d.required ? `${d.key}*` : d.key));
  }
  private templateHintRow(defs: readonly GuestFieldDef[]): string[] {
    return defs.map((d) => {
      const bits: string[] = [d.label];
      if (d.required) bits.push('必填');
      if (d.maxLen) bits.push(`≤${d.maxLen}字`);
      if (d.values) bits.push(d.values.join('/'));
      return bits.join('，');
    });
  }
  private templateExampleRow(defs: readonly GuestFieldDef[]): (string | null)[] {
    return defs.map((d) => d.example || null);
  }

  buildTemplateCsv(defs: readonly GuestFieldDef[] = GUEST_FIELD_DEFS): Buffer {
    return buildCsv([this.templateHeaderRow(defs), this.templateHintRow(defs), this.templateExampleRow(defs)]);
  }

  buildTemplateXlsx(defs: readonly GuestFieldDef[] = GUEST_FIELD_DEFS): Buffer {
    return buildXlsx([
      { name: '名单', rows: [defs.map((d) => (d.required ? `${d.label}*` : d.label)), this.templateExampleRow(defs)] },
      {
        name: '字段说明',
        rows: [
          ['字段名(key)', '中文表头', '类型', '必填', '约束', '说明/示例'],
          ...defs.map((d) => [
            d.key,
            d.label,
            d.type === 'enum' ? '枚举' : '文本',
            d.required ? '是' : '否',
            [
              d.maxLen ? `≤${d.maxLen}字` : '',
              d.values ? d.values.join('/') : '',
              d.enum ? `建议：${d.enum.join('/')}` : '',
              d.pattern ? `正则 ${d.pattern}` : '',
            ]
              .filter(Boolean)
              .join('；'),
            d.example || '（可留空）',
          ]),
        ],
      },
    ]);
  }

  /* ────────────────── §9.1b 字段设计（可填写字段的增删改 + 保存） ────────────────── */

  /** 字段设计归属键：SELF(userId) / ORG(orgId，代客与自营共用组织级设计) */
  private fieldDesignKey(scope: OwnerScope): { ownerType: 'SELF' | 'ORG'; ownerId: string } {
    if (scope.ownerType === 'SELF') return { ownerType: 'SELF', ownerId: scope.userId };
    return { ownerType: 'ORG', ownerId: scope.orgId as string };
  }

  /** 读取当前作用域的字段设计；无存档则回退标准字段定义 */
  async getFieldDesign(scope: OwnerScope): Promise<GuestFieldDef[]> {
    const key = this.fieldDesignKey(scope);
    const row = await this.prisma.guestListFieldDesign.findUnique({
      where: { ownerType_ownerId: { ownerType: key.ownerType, ownerId: key.ownerId } },
    });
    const fields = (row?.fields as unknown as GuestFieldDef[] | undefined) ?? [];
    return Array.isArray(fields) && fields.length ? fields : ([...GUEST_FIELD_DEFS] as GuestFieldDef[]);
  }

  /**
   * 解析某名单用于「校验 / 渲染列」的字段定义：
   * 优先用名单在创建时快照的模板字段（columnDefs，模板联动）；
   * 否则回落当前作用域的字段设计（GUEST_FIELD_DEFS 或自定义字段设计）。
   */
  private async resolveListDefs(scope: OwnerScope, list: { columnDefs?: unknown }): Promise<GuestFieldDef[]> {
    const cd = list.columnDefs as unknown as GuestFieldDef[] | undefined;
    if (Array.isArray(cd) && cd.length) return cd;
    return this.getFieldDesign(scope);
  }

  /**
   * 保存字段设计（校验 + upsert）。
   * 不变量：guest_name 必须保留、为首项、必填（导入身份列 + 渲染绑定依赖）。
   */
  async saveFieldDesign(scope: OwnerScope, input: unknown): Promise<GuestFieldDef[]> {
    if (!Array.isArray(input)) throw err400({ code: 'BAD_FIELDS', message: '字段设计必须为数组' });
    if (input.length === 0) throw err422({ code: 'EMPTY_FIELDS', message: '至少保留一个字段' });
    if (input.length > 50) throw err400({ code: 'TOO_MANY_FIELDS', message: '字段数量不得超过 50' });

    const defs: GuestFieldDef[] = [];
    const seen = new Set<string>();
    input.forEach((raw, i) => {
      const f = (raw ?? {}) as Record<string, unknown>;
      const key = typeof f.key === 'string' ? (f.key as string).trim() : '';
      const label = typeof f.label === 'string' ? (f.label as string).trim() : '';
      const type: GuestFieldDef['type'] = f.type === 'enum' ? 'enum' : 'string';
      if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(key)) {
        throw err422({ code: 'INVALID_FIELD_KEY', field: `#${i}`, message: `第 ${i + 1} 行字段 key 须以字母开头、仅含字母数字下划线` });
      }
      if (seen.has(key)) throw err422({ code: 'DUP_FIELD_KEY', field: key, message: `字段 key「${key}」重复` });
      if (!label) throw err422({ code: 'INVALID_FIELD_LABEL', field: key, message: `字段「${key}」中文表头必填` });
      const required = f.required === true;
      const maxLen = typeof f.maxLen === 'number' && f.maxLen > 0 ? Math.floor(f.maxLen) : undefined;
      const values = Array.isArray(f.values) ? (f.values as unknown[]).filter((v) => typeof v === 'string').map(String) : undefined;
      const enumVals = Array.isArray(f.enum) ? (f.enum as unknown[]).filter((v) => typeof v === 'string').map(String) : undefined;
      const pattern = typeof f.pattern === 'string' && (f.pattern as string).trim() ? (f.pattern as string).trim() : undefined;
      if (pattern) {
        try {
          new RegExp(pattern);
        } catch {
          throw err422({ code: 'BAD_PATTERN', field: key, message: `字段「${key}」正则非法` });
        }
      }
      const example = typeof f.example === 'string' ? f.example : '';
      if (type === 'enum' && !values?.length) {
        throw err422({ code: 'NO_ENUM_VALUES', field: key, message: `枚举字段「${key}」须提供可选值` });
      }
      defs.push({ key, label, type, required, maxLen, values, enum: enumVals, pattern, example });
      seen.add(key);
    });

    // 锁定不变量：guest_name 必须保留、为首项、必填
    if (defs[0].key !== 'guest_name') {
      throw err422({ code: 'GUEST_NAME_FIRST', message: '「姓名(guest_name)」必须为首个字段且不可删除/改名' });
    }
    const nameDef = defs.find((d) => d.key === 'guest_name')!;
    if (!nameDef.required) throw err422({ code: 'GUEST_NAME_REQUIRED', message: '「姓名(guest_name)」必须为必填' });

    const key = this.fieldDesignKey(scope);
    const saved = await this.prisma.guestListFieldDesign.upsert({
      where: { ownerType_ownerId: { ownerType: key.ownerType, ownerId: key.ownerId } },
      create: { ownerType: key.ownerType, ownerId: key.ownerId, fields: defs as never, version: GUEST_FIELDS_VERSION },
      update: { fields: defs as never, version: GUEST_FIELDS_VERSION },
    });
    return saved.fields as unknown as GuestFieldDef[];
  }

  /* ────────────────── §17 多模板管理（GuestTemplate） ────────────────── */

  private toTemplateView(r: {
    id: string;
    name: string;
    ownerType: string;
    isSystem: boolean;
    seq: number;
    version: string;
    fields: unknown;
    createdAt: Date;
    updatedAt: Date;
  }): GuestTemplateView {
    const fields = (r.fields as unknown as GuestFieldDef[] | undefined) ?? [];
    return {
      id: r.id,
      name: r.name,
      ownerType: r.ownerType,
      isSystem: r.isSystem,
      seq: r.seq,
      version: r.version,
      fieldCount: Array.isArray(fields) ? fields.length : 0,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }

  /** 列出当前用户可见模板：系统模板（SYSTEM 全局可读）+ 自己的模板（SELF, ownerId） */
  async listTemplates(user: JwtUser): Promise<GuestTemplateView[]> {
    const rows = await this.prisma.guestTemplate.findMany({
      where: { OR: [{ ownerType: 'SYSTEM' }, { ownerType: 'SELF', ownerId: user.id }] },
      orderBy: [{ isSystem: 'desc' }, { seq: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map((r) => this.toTemplateView(r));
  }

  /** 读取模板详情；系统模板任意登录用户可读，用户模板须本人（否则 404） */
  async getTemplate(user: JwtUser, id: string): Promise<GuestTemplateDetail> {
    const r = await this.mustGetTemplate(user, id);
    const fields = (r.fields as unknown as GuestFieldDef[] | undefined) ?? [];
    return { ...this.toTemplateView(r), fields: Array.isArray(fields) ? fields : ([...GUEST_FIELD_DEFS] as GuestFieldDef[]) };
  }

  private async mustGetTemplate(
    user: JwtUser,
    id: string,
  ): Promise<{
    id: string;
    name: string;
    ownerType: string;
    ownerId: string | null;
    isSystem: boolean;
    seq: number;
    version: string;
    fields: unknown;
    createdAt: Date;
    updatedAt: Date;
  }> {
    const r = await this.prisma.guestTemplate.findUnique({ where: { id } });
    if (!r) throw err404();
    if (r.ownerType === 'SELF' && r.ownerId !== user.id) throw err404();
    return r as never;
  }

  /** 校验并归一化模板字段数组（复用单份字段设计的逐字段规则，但**不**强制 guest_name 为首/必填——各模板独立） */
  private parseTemplateFields(input: unknown): GuestFieldDef[] {
    if (!Array.isArray(input)) throw err400({ code: 'BAD_FIELDS', message: '字段必须为数组' });
    if (input.length === 0) throw err422({ code: 'EMPTY_FIELDS', message: '至少保留一个字段' });
    if (input.length > 50) throw err400({ code: 'TOO_MANY_FIELDS', message: '字段数量不得超过 50' });

    const defs: GuestFieldDef[] = [];
    const seen = new Set<string>();
    input.forEach((raw, i) => {
      const f = (raw ?? {}) as Record<string, unknown>;
      const key = typeof f.key === 'string' ? (f.key as string).trim() : '';
      const label = typeof f.label === 'string' ? (f.label as string).trim() : '';
      const type: GuestFieldDef['type'] = f.type === 'enum' ? 'enum' : 'string';
      if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(key)) {
        throw err422({ code: 'INVALID_FIELD_KEY', field: `#${i}`, message: `第 ${i + 1} 行字段 key 须以字母开头、仅含字母数字下划线` });
      }
      if (seen.has(key)) throw err422({ code: 'DUP_FIELD_KEY', field: key, message: `字段 key「${key}」重复` });
      if (!label) throw err422({ code: 'INVALID_FIELD_LABEL', field: key, message: `字段「${key}」中文表头必填` });
      const required = f.required === true;
      const maxLen = typeof f.maxLen === 'number' && f.maxLen > 0 ? Math.floor(f.maxLen) : undefined;
      const values = Array.isArray(f.values) ? (f.values as unknown[]).filter((v) => typeof v === 'string').map(String) : undefined;
      const enumVals = Array.isArray(f.enum) ? (f.enum as unknown[]).filter((v) => typeof v === 'string').map(String) : undefined;
      const pattern = typeof f.pattern === 'string' && (f.pattern as string).trim() ? (f.pattern as string).trim() : undefined;
      if (pattern) {
        try {
          new RegExp(pattern);
        } catch {
          throw err422({ code: 'BAD_PATTERN', field: key, message: `字段「${key}」正则非法` });
        }
      }
      const example = typeof f.example === 'string' ? f.example : '';
      if (type === 'enum' && !values?.length) {
        throw err422({ code: 'NO_ENUM_VALUES', field: key, message: `枚举字段「${key}」须提供可选值` });
      }
      defs.push({ key, label, type, required, maxLen, values, enum: enumVals, pattern, example });
      seen.add(key);
    });
    return defs;
  }

  /** 新建用户模板（ownerType=SELF, ownerId=userId, seq 递增） */
  async createTemplate(user: JwtUser, name: string, fields: unknown): Promise<GuestTemplateView> {
    const defs = this.parseTemplateFields(fields);
    const nm = (name ?? '').trim();
    if (!nm) throw err422({ code: 'INVALID_FIELD', field: 'name', message: '模板名称必填' });
    if ([...nm].length > 60) throw err422({ code: 'INVALID_FIELD', field: 'name', message: '模板名称不得超过 60 个字符' });
    const maxSeq = await this.prisma.guestTemplate.aggregate({
      where: { ownerType: 'SELF', ownerId: user.id },
      _max: { seq: true },
    });
    const t = await this.prisma.guestTemplate.create({
      data: {
        ownerType: 'SELF',
        ownerId: user.id,
        name: nm,
        fields: defs as never,
        isSystem: false,
        seq: (maxSeq._max.seq ?? 0) + 1,
        version: GUEST_FIELDS_VERSION,
      },
    });
    return this.toTemplateView(t);
  }

  /**
   * 编辑模板字段。
   * - 系统模板（isSystem=true）：仅平台超级管理员（role==='ADMIN'）可编辑，否则 403。
   * - 用户模板：须本人，否则 404。
   */
  async updateTemplate(user: JwtUser, id: string, fields: unknown): Promise<GuestTemplateView> {
    const t = await this.mustGetTemplate(user, id);
    if (t.isSystem && user.role !== 'ADMIN') {
      throw err403('FORBIDDEN', '仅平台超级管理员可设计或编辑系统模板字段');
    }
    const defs = this.parseTemplateFields(fields);
    const updated = await this.prisma.guestTemplate.update({
      where: { id },
      data: { fields: defs as never, version: GUEST_FIELDS_VERSION },
    });
    return this.toTemplateView(updated);
  }

  /**
   * 删除模板。
   * - 系统模板（isSystem=true）：禁止删除，403 SYSTEM_TEMPLATE_LOCKED。
   * - 用户模板：须本人，否则 404。
   */
  async deleteTemplate(user: JwtUser, id: string): Promise<void> {
    const t = await this.mustGetTemplate(user, id);
    if (t.isSystem) throw err403('SYSTEM_TEMPLATE_LOCKED', '系统默认模板不可删除');
    await this.prisma.guestTemplate.delete({ where: { id } });
  }

  /** 取某模板字段（供下载模板用）；系统模板任意登录用户可读，用户模板须本人（否则 404） */
  async templateFieldsById(user: JwtUser, id: string): Promise<GuestFieldDef[]> {
    const r = await this.mustGetTemplate(user, id);
    const fields = (r.fields as unknown as GuestFieldDef[] | undefined) ?? [];
    return Array.isArray(fields) && fields.length ? fields : ([...GUEST_FIELD_DEFS] as GuestFieldDef[]);
  }

  /**
   * 按作用域取模板字段（供「直接导入为新名单」时与下载模板保持一致）。
   * 权限：SYSTEM 模板任意登录用户可读，SELF 模板仅本人（否则 404）。
   * 与 `templateFieldsById` 等价，但入参为 `OwnerScope`（导入入口只有 scope，无完整 JwtUser）。
   */
  private async resolveTemplateFields(scope: OwnerScope, id: string): Promise<GuestFieldDef[]> {
    const r = await this.prisma.guestTemplate.findUnique({ where: { id } });
    if (!r) throw err404();
    if (r.ownerType === 'SELF' && r.ownerId !== scope.userId) throw err404();
    const fields = (r.fields as unknown as GuestFieldDef[] | undefined) ?? [];
    return Array.isArray(fields) && fields.length ? fields : ([...GUEST_FIELD_DEFS] as GuestFieldDef[]);
  }

  /* ────────────────── §9.2 名单 CRUD ────────────────── */

  async createList(scope: OwnerScope, name: string, templateId?: string) {
    const nm = (name ?? '').trim();
    if (!nm) throw err422({ code: 'INVALID_FIELD', field: 'name', message: '名单名称必填' });
    if ([...nm].length > MAX_LIST_NAME) {
      throw err422({ code: 'INVALID_FIELD', field: 'name', message: `名单名称不得超过 ${MAX_LIST_NAME} 个字符` });
    }
    // 代客(CLIENT)必须绑定客户：避免代客名单散落到组织域无法区分归属（D1）
    if (scope.ownerType === 'CLIENT' && !scope.clientId) {
      throw err422({ code: 'INVALID_FIELD', field: 'clientId', message: '代客名单必须指定客户' });
    }

    // 模板联动：选中模板则把其字段快照进 columnDefs，使新建名单按模板预设字段生成列。
    // 未显式选择时，自动套用系统默认模板「简易宾客模板」。
    let columnDefs: unknown = {};
    const effectiveTemplateId = templateId?.trim() || DEFAULT_TEMPLATE_ID;
    const tpl = await this.prisma.guestTemplate.findUnique({ where: { id: effectiveTemplateId } });
    if (!tpl) {
      // 默认模板不存在（seed 未执行）时才允许空模板兜底；否则未找到即 404
      if (!templateId?.trim()) columnDefs = {};
      else throw err404();
    } else {
      if (tpl.ownerType === 'SELF' && tpl.ownerId !== scope.userId) throw err404();
      const fields = (tpl.fields as unknown as GuestFieldDef[] | undefined) ?? [];
      columnDefs = Array.isArray(fields) && fields.length ? fields : {};
    }

    const list = await this.prisma.guestList.create({
      data: {
        ownerId: scope.userId,
        ownerType: scope.ownerType,
        orgId: scope.orgId,
        clientId: scope.ownerType === 'CLIENT' ? scope.clientId : null,
        name: nm,
        columnDefs: columnDefs as never,
      },
    });
    return { id: list.id, ownerId: list.ownerId, name: list.name, state: 'DRAFT', recordCount: 0, columnDefs: list.columnDefs };
  }

  async listLists(scope: OwnerScope) {
    const rows = await this.prisma.guestList.findMany({
      where: this.listWhere(scope),
      orderBy: { createdAt: 'desc' },
    });
    const counts = await this.prisma.guestRecord.groupBy({
      by: ['listId'],
      where: { listId: { in: rows.map((r) => r.id) }, deletedAt: null },
      _count: { _all: true },
    });
    const map = new Map(counts.map((c) => [c.listId, c._count._all]));
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      ownerType: r.ownerType,
      clientId: r.clientId,
      recordCount: map.get(r.id) ?? 0,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  /** 名单详情（编辑器顶部回填名称 / 列定义等用） */
  async getList(scope: OwnerScope, listId: string) {
    const list = await this.mustGetList(scope, listId);
    const count = await this.prisma.guestRecord.count({ where: { listId: list.id, deletedAt: null } });
    return {
      id: list.id,
      name: list.name,
      ownerType: list.ownerType,
      recordCount: count,
      columnDefs: (list.columnDefs as unknown) ?? {},
    };
  }

  async listRecords(scope: OwnerScope, listId: string, page = 1, size = 50) {
    const list = await this.mustGetList(scope, listId);
    const p = Math.max(1, Math.floor(page));
    const s = Math.min(200, Math.max(1, Math.floor(size)));
    const where = { listId, deletedAt: null };
    const [total, rows] = await Promise.all([
      this.prisma.guestRecord.count({ where }),
      this.prisma.guestRecord.findMany({
        where,
        orderBy: { seq: 'asc' },
        skip: (p - 1) * s,
        take: s,
      }),
    ]);
    return {
      listId,
      page: p,
      size: s,
      total,
      columnDefs: (list.columnDefs as unknown) ?? {},
      records: rows.map((r) => ({
        id: r.id,
        seq: r.seq,
        data: r.data as unknown as GuestData,
        updatedAt: r.updatedAt,
      })),
    };
  }

  /** 校验一行数据（统一出口：在线编辑与导入共用同一套约束，B15） */
  private assertValid(data: unknown, index?: number, defs: readonly GuestFieldDef[] = GUEST_FIELD_DEFS) {
    const normalized = normalizeGuestData((data ?? {}) as Record<string, unknown>, defs);
    const errors = validateGuestData(normalized, defs);
    if (errors.length) {
      const e = errors[0];
      throw err422({
        code: 'INVALID_FIELD',
        field: e.field,
        message: index == null ? e.message : `第 ${index + 1} 行：${e.message}`,
      });
    }
    return normalized;
  }

  async createRecord(scope: OwnerScope, listId: string, data: unknown) {
    const list = await this.mustGetList(scope, listId);
    const defs = await this.resolveListDefs(scope, list);
    const normalized = this.assertValid(data, undefined, defs);
    const maxSeq = await this.prisma.guestRecord.aggregate({
      where: { listId, deletedAt: null },
      _max: { seq: true },
    });
    const rec = await this.prisma.guestRecord.create({
      data: { listId, seq: (maxSeq._max.seq ?? 0) + 1, data: normalized as never },
    });
    return { id: rec.id, seq: rec.seq, data: rec.data as unknown as GuestData };
  }

  /**
   * 更新一行（含 `updatedAt` 乐观锁，E10）。
   * @param expectedUpdatedAt 传入则校验未被他人并发修改；不一致返回 409 CONFLICT
   */
  async updateRecord(
    scope: OwnerScope,
    listId: string,
    rid: string,
    patch: { data?: unknown; seq?: number },
    expectedUpdatedAt?: string,
  ) {
    const list = await this.mustGetList(scope, listId);
    const rec = await this.prisma.guestRecord.findFirst({ where: { id: rid, listId, deletedAt: null } });
    if (!rec) throw err404();
    // 名单人员信息冻结闸门（消息 F）：该记录已被任一非 DRAFT 批量项目首渲快照锁定 → 不可改
    if (await this.isRecordLocked(listId, rid)) {
      throw err409('IN_USE', '该人员已生成专属请柬，不可修改');
    }
    if (expectedUpdatedAt) {
      const expected = new Date(expectedUpdatedAt).getTime();
      if (Number.isFinite(expected) && Math.abs(rec.updatedAt.getTime() - expected) > 1000) {
        throw err409('CONFLICT', '数据已变更，请刷新后再编辑');
      }
    }

    const merged = patch.data == null ? (rec.data as unknown as GuestData) : this.assertValid(patch.data, undefined, await this.resolveListDefs(scope, list));
    const nextSeq = typeof patch.seq === 'number' ? Math.max(1, Math.floor(patch.seq)) : rec.seq;

    const updated = await this.prisma.guestRecord.update({
      where: { id: rid },
      data: { data: merged as never, seq: nextSeq },
    });
    return { id: updated.id, seq: updated.seq, data: updated.data as unknown as GuestData, updatedAt: updated.updatedAt };
  }

  /**
   * 删除一行（软删 + 重排后续 seq）。
   * 若该行已被首渲快照锁定引用 → 409 IN_USE（FR-4 / B11）
   */
  async deleteRecord(scope: OwnerScope, listId: string, rid: string) {
    await this.mustGetList(scope, listId);
    const rec = await this.prisma.guestRecord.findFirst({ where: { id: rid, listId, deletedAt: null } });
    if (!rec) throw err404();
    if (await this.isRecordLocked(listId, rid)) {
      throw err409('IN_USE', '该人员已生成专属请柬，不可删除');
    }
    await this.prisma.guestRecord.update({ where: { id: rid }, data: { deletedAt: new Date() } });
    await this.resequence(listId);
  }

  /** 重排 seq：按当前 seq 升序重新编号 1..N（软删行已排除） */
  private async resequence(listId: string) {
    const rows = await this.prisma.guestRecord.findMany({
      where: { listId, deletedAt: null },
      orderBy: { seq: 'asc' },
      select: { id: true },
    });
    await this.prisma.$transaction(
      rows.map((r, i) => this.prisma.guestRecord.update({ where: { id: r.id }, data: { seq: i + 1 } })),
    );
  }

  /**
   * 批量写入（粘贴 / 导入）。
   * - `append`：追加到末尾（默认，不删未包含行，B17）
   * - `overwrite`：先软删全部行再写入，**但保留被快照锁定的记录**（B17）
   */
  async batchRecords(
    scope: OwnerScope,
    listId: string,
    input: unknown[],
    mode: 'append' | 'overwrite' = 'append',
    defs?: readonly GuestFieldDef[],
  ) {
    const list = await this.mustGetList(scope, listId);
    // 名单锁定闸门（消息 F）：绑定态名单不允许整体覆盖（overwrite 会软删未锁定人员 = 拆解名单）。
    // append 不受影响（B17 追加是硬需求）。
    if (mode === 'overwrite') {
      const frozen = await this.prisma.batchRenderProject.findFirst({
        where: { listId, state: { not: 'DRAFT' } },
      });
      if (frozen) {
        throw err409('PROJECT_FROZEN', '名单已进入批量生成期，不可整体覆盖（如需调整请新建名单与批量任务）');
      }
    }
    if (!Array.isArray(input) || input.length === 0) {
      throw err422({ code: 'EMPTY_RECORDS', message: '请至少提供 1 条人员数据' });
    }
    if (input.length > MAX_BATCH_ROWS) {
      throw err400({ code: 'TOO_MANY_ROWS', message: `单次最多写入 ${MAX_BATCH_ROWS} 条` });
    }

    // ★ 与「下载模板」/文件导入保持同一字段真值：未显式传 defs 时，
    //   用名单创建时快照的模板字段（columnDefs，模板联动）校验粘贴写入，
    //   而非硬编码 GUEST_FIELD_DEFS —— 否则婚礼等「首列非 guest_name」的模板
    //   粘贴会被误判缺列（E2）。importFile 已显式传 defs 时沿用其解析结果。
    const effectiveDefs = defs && defs.length ? defs : await this.resolveListDefs(scope, list);

    const failed: { index: number; reason: string }[] = [];
    const ok: GuestData[] = [];
    input.forEach((row, i) => {
      // 兼容两种入参形态：
      //  - 文件导入（importFile）传入扁平对象 `{ husband_name: '...' }`；
      //  - 前端粘贴/批量写入传入与单条记录一致的 `{ data: { husband_name: '...' } }` 包裹（见 POST /records）。
      // 旧实现直接把 `{ data }` 当扁平对象传给 normalizeGuestData，导致 row[def.key] 恒为
      // undefined → 必填字段永远判空（粘贴写入对所有模板均失败）。
      const raw = (row && typeof row === 'object' ? (row as Record<string, unknown>).data : undefined) as
        | Record<string, unknown>
        | undefined;
      const src = raw && typeof raw === 'object' ? raw : (row ?? {});
      const normalized = normalizeGuestData(src as Record<string, unknown>, effectiveDefs);
      const errs = validateGuestData(normalized, effectiveDefs);
      if (errs.length) failed.push({ index: i, reason: `${errs[0].field}: ${errs[0].message}` });
      else ok.push(normalized);
    });

    if (mode === 'overwrite') {
      // 保住被锁定记录：快照里的 recordIds 不删（FR-4）
      const locked = await this.lockedRecordIds(listId);
      const victims = await this.prisma.guestRecord.findMany({
        where: { listId, deletedAt: null, id: { notIn: locked } },
        select: { id: true },
      });
      if (victims.length) {
        await this.prisma.guestRecord.updateMany({
          where: { id: { in: victims.map((v) => v.id) } },
          data: { deletedAt: new Date() },
        });
      }
    }

    let base = 0;
    if (ok.length) {
      const maxSeq = await this.prisma.guestRecord.aggregate({
        where: { listId, deletedAt: null },
        _max: { seq: true },
      });
      base = maxSeq._max.seq ?? 0;
      await this.prisma.guestRecord.createMany({
        data: ok.map((d, i) => ({ listId, seq: base + i + 1, data: d as never })),
      });
    }

    return { created: ok.length, failed };
  }

  /** 改名 / 重排（reorder 传 recordId 有序数组） */
  async updateList(
    scope: OwnerScope,
    listId: string,
    patch: { name?: string; reorder?: string[] },
  ) {
    const list = await this.mustGetList(scope, listId);
    if (patch.name != null) {
      const nm = patch.name.trim();
      if (!nm) throw err422({ code: 'INVALID_FIELD', field: 'name', message: '名单名称必填' });
      if ([...nm].length > MAX_LIST_NAME) {
        throw err422({ code: 'INVALID_FIELD', field: 'name', message: `名单名称不得超过 ${MAX_LIST_NAME} 个字符` });
      }
      await this.prisma.guestList.update({ where: { id: listId }, data: { name: nm } });
    }
    if (Array.isArray(patch.reorder) && patch.reorder.length) {
      const ids = patch.reorder;
      const owned = await this.prisma.guestRecord.findMany({
        where: { listId, deletedAt: null, id: { in: ids } },
        select: { id: true },
      });
      const ownedSet = new Set(owned.map((o) => o.id));
      if (ownedSet.size !== new Set(ids).size) {
        throw err422({ code: 'INVALID_SELECTION', message: '重排含不属于该名单的记录' });
      }
      await this.prisma.$transaction(
        ids.map((id, i) => this.prisma.guestRecord.update({ where: { id }, data: { seq: i + 1 } })),
      );
    }
    const count = await this.prisma.guestRecord.count({ where: { listId, deletedAt: null } });
    return { id: list.id, name: patch.name?.trim() ?? list.name, recordCount: count };
  }

  /** 软删名单；若已被快照锁定引用 → 409 IN_USE（B11） */
  async deleteList(scope: OwnerScope, listId: string) {
    await this.mustGetList(scope, listId);
    const snap = await this.prisma.renderSnapshot.findFirst({ where: { listId } });
    if (snap) throw err409('IN_USE', '该名单已生成专属请柬，不可删除');
    await this.prisma.guestList.update({ where: { id: listId }, data: { deletedAt: new Date() } });
  }

  /* ────────────────── §8.1 文件导入 ────────────────── */

  /**
   * 解析上传文件为行数据（CSV / XLSX / JSON）。
   * 首行视为表头：既接受字段 key，也接受中文表头（normalizeGuestData 兜底识别）。
   */
  parseImportFile(
    file: { mimetype?: string; originalname?: string; buffer: Buffer },
    defs: readonly GuestFieldDef[] = GUEST_FIELD_DEFS,
  ): Record<string, unknown>[] {
    const name = (file.originalname || '').toLowerCase();
    const isXlsx = name.endsWith('.xlsx') || name.endsWith('.xls') || /excel|spreadsheet/.test(file.mimetype || '');
    const isJson = name.endsWith('.json') || /json/.test(file.mimetype || '');

    let rows: string[][] = [];
    let header: string[] = [];

    if (isJson) {
      const parsed = JSON.parse(file.buffer.toString('utf8'));
      const arr = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.records) ? parsed.records : null;
      if (!arr) throw err400({ code: 'BAD_FORMAT', message: 'JSON 需为数组或 { records: [...] }' });
      return arr as Record<string, unknown>[];
    }

    if (isXlsx) {
      rows = readXlsxFirstSheet(file.buffer);
    } else {
      rows = parseCsv(file.buffer.toString('utf8'));
    }

    if (!rows.length) throw err400({ code: 'EMPTY_FILE', message: '文件内容为空' });
    header = rows[0].map((h) => (h ?? '').trim());

    // 表头必须能识别到姓名列（key 或中文表头），否则 E2 拒绝并引导映射
    const nameDef = defs[0];
    const hasName = header.some((h) => {
      const k = h.replace(/\*$/, '');
      return k === nameDef.key || k === nameDef.label;
    });
    if (!hasName) {
      throw err422({ code: 'MISSING_REQUIRED_COLUMN', field: 'guest_name', message: `缺少必填列「${nameDef.label}」（${nameDef.key}）` });
    }

    // 第二行若为「说明行」（含"必填"等提示语）则跳过——自家模板的 hint 行
    const body = rows.slice(1);
    const out: Record<string, unknown>[] = [];
    for (const cells of body) {
      if (!cells || cells.every((c) => (c ?? '') === '')) continue; // 空行跳过
      const obj: Record<string, unknown> = {};
      header.forEach((h, i) => {
        if (!h) return;
        obj[h.replace(/\*$/, '')] = normalizeCellValue(cells[i] ?? '');
      });
      out.push(obj);
    }
    return out;
  }

  /**
   * 文件导入：新建名单或写入既有名单。
   * @param mode append（默认，不删未包含行）/ overwrite（不删被锁定记录）
   */
  async importFile(
    scope: OwnerScope,
    file: { mimetype?: string; originalname?: string; buffer: Buffer },
    opts: { listId?: string; name?: string; mode?: 'append' | 'overwrite'; templateId?: string } = {},
  ) {
    const targetList = opts.listId ? await this.mustGetList(scope, opts.listId) : null;
    // ★ 与「下载模板」保持同一字段真值（修复 E2 误报「缺少必填列」）：
    //   导入校验优先用名单创建时快照的模板字段（columnDefs，模板联动），
    //   其次用导入时指定的 templateId（直接「导入为新名单」场景），最后回落全局字段设计。
    //   旧实现始终用 getFieldDesign（GUEST_FIELD_DEFS，首列 guest_name），
    //   导致婚礼等「首列非 guest_name」的系统模板下载后导入被误判缺列。
    const defs = targetList
      ? await this.resolveListDefs(scope, targetList)
      : opts.templateId
        ? await this.resolveTemplateFields(scope, opts.templateId)
        : await this.getFieldDesign(scope);
    const parsed = this.parseImportFile(file, defs);
    if (!parsed.length) throw err400({ code: 'EMPTY_FILE', message: '未解析到有效人员数据' });

    let listId = opts.listId;
    if (!listId) {
      const created = await this.createList(scope, opts.name || this.defaultListName(file.originalname));
      listId = created.id;
    } else {
      await this.mustGetList(scope, listId);
    }
    const res = await this.batchRecords(scope, listId, parsed, opts.mode ?? 'append', defs);
    const list = await this.mustGetList(scope, listId);
    return { listId, name: list.name, ...res };
  }

  private defaultListName(original?: string): string {
    const base = (original || '人员名单').replace(/\.(csv|xlsx|xls|json)$/i, '').trim();
    return base.slice(0, MAX_LIST_NAME) || '人员名单';
  }

  /* ────────────────── 锁定保护（FR-4 / B11） ────────────────── */

  /** 该名单下已被首渲快照引用的记录 id（不可删） */
  async lockedRecordIds(listId: string): Promise<string[]> {
    const snaps = await this.prisma.renderSnapshot.findMany({
      where: { listId },
      select: { recordIds: true },
    });
    const set = new Set<string>();
    for (const s of snaps) {
      const ids = (s.recordIds ?? []) as unknown;
      if (Array.isArray(ids)) ids.forEach((i) => set.add(String(i)));
    }
    return [...set];
  }

  private async isRecordLocked(listId: string, rid: string): Promise<boolean> {
    const locked = await this.lockedRecordIds(listId);
    return locked.includes(rid);
  }
}
