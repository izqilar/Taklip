import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  HttpException,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ExportService } from '../export/export.service';
import { GuestListService, type OwnerScope } from '../guest-list/guest-list.service';
import { personalizeSchema, collectBindingKeys, collectBindings, deriveColumnsFromRecords, applyElementBindings, type GuestData, type GuestFieldDef, type ElementBindings } from '@h5design/core';
import type { Project } from '@h5design/core';
import { buildFontCatalog } from '../console/font-catalog';
import { UYGHUR_SPECIFIC } from '../console/cmap';

/** 维吾尔文特定码位集合（供字体覆盖体检区分「设计预期的整段回退」与「真实缺字不一致」） */
const UYGHUR_SPECIFIC_SET = new Set<number>(UYGHUR_SPECIFIC);
import { mkdir, writeFile, readFile, unlink } from 'fs/promises';
import { join, relative, basename } from 'path';
import { createHash } from 'crypto';
import { zipStore } from '../common/minimal-zip';

/**
 * 批量请柬 · 配额/锁定/渲染服务（规范 §5 / §8 / FR-1~FR-5）
 *
 * 配额唯一口径（C1）：
 *   freeSampleCap   = 3                      // 赠样，独立，不计入 N
 *   paidCap         = purchasedHeadcount (N) // 付费部分上限
 *   totalRenderable = freeSampleCap + paidCap
 *   alreadyRendered <= totalRenderable       // 硬约束
 *
 * 并发一致性（E4/B8）：所有「校验额度 + 扣减 + 落快照」都在事务内先取
 * `pg_advisory_xact_lock(hashtext(projectId))`，事务级锁随提交/回滚自动释放。
 */

/** 免费赠样人次（C1：不占购额、不计入 N） */
export const FREE_SAMPLE_CAP = 3;

/** 渲染模式 */
export type RenderMode = 'FREE_SAMPLE' | 'PAID' | 'RERENDER';

/** 私有资产根目录（与图库一致：uploads/ 之外，不被公开静态服务暴露） */
const PRIVATE_ROOT = join(process.cwd(), 'private-assets');

/** 单批渲染并发度（限流，防 puppeteer 打爆）；可用环境变量 RENDER_CONCURRENCY 覆盖（T7） */
const RENDER_CONCURRENCY = Math.max(1, Number(process.env.RENDER_CONCURRENCY ?? 4));

/**
 * 全局渲染信号量上限（跨所有 job 的并发 puppeteer 渲染数，T7）。
 * 默认 8，可用环境变量 GLOBAL_RENDER_LIMIT 覆盖；单批并发上限 RENDER_CONCURRENCY
 * 与全局上限独立——前者限制「单 job 内」worker 数，后者限制「全站」同时渲染数。
 */
const GLOBAL_RENDER_LIMIT = Math.max(1, Number(process.env.GLOBAL_RENDER_LIMIT ?? 8));

/**
 * 全局渲染信号量：跨所有 job 限制同时进行的 puppeteer 渲染数，
 * 避免多用户/多 job 并发叠满把机器打爆（T7）。
 */
class RenderSemaphore {
  private available: number;
  private queue: Array<() => void> = [];
  constructor(limit: number) {
    this.available = Math.max(1, limit);
  }
  acquire(): Promise<void> {
    if (this.available > 0) {
      this.available -= 1;
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => this.queue.push(resolve));
  }
  release(): void {
    const next = this.queue.shift();
    if (next) next();
    else this.available += 1;
  }
}
const renderSemaphore = new RenderSemaphore(GLOBAL_RENDER_LIMIT);

/**
 * 单张渲染超时（毫秒）。
 * 规范 E3：渲染超时 / puppeteer 异常必须标记 FAILED 并**释放配额**，
 * 没有这道闸门的话，渲染页不可达（如 web dev server 未启动）会让任务永久停在 RUNNING，
 * 额度被占死、用户无法重试。
 */
const RENDER_PER_ITEM_TIMEOUT_MS = 90_000;

function withTimeout<T>(p: Promise<T>, ms: number, msg: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${msg}（超时 ${ms}ms）`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

const err404 = () => new NotFoundException({ code: 'NOT_FOUND', message: '资源不存在' });
const err400 = (code: string, message: string) => new BadRequestException({ code, message });

@Injectable()
export class InvitationService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly exportService: ExportService,
    private readonly guestLists: GuestListService,
  ) {}

  /** 生命周期：服务启动后回收运行超时的僵尸任务（详情见 recoverZombieJobs，T6） */
  async onModuleInit() {
    try {
      const r = await this.recoverZombieJobs();
      if (r.recovered > 0) {
        // 仅作轻量日志占位（避免引入未配置的 logger 依赖）
        // eslint-disable-next-line no-console
        console.warn(`[invitation] 启动回收：已将 ${r.recovered} 个超时 RUNNING 任务置为 FAILED`);
      }
    } catch {
      /* 启动回收失败不应阻断服务启动 */
    }
  }

  /* ────────── 项目 ────────── */

  /** 归属解析委托给名单模块（单一真值源），保证两模块角色判定不分叉 */
  resolveScope(user: Parameters<GuestListService['resolveScope']>[0], ownerType?: string, clientId?: string) {
    return this.guestLists.resolveScope(user, ownerType, clientId);
  }

  /** 按作用域构造项目查询条件（隔离唯一入口） */
  private projectWhere(scope: OwnerScope): Record<string, unknown> {
    if (scope.ownerType === 'SELF') return { ownerId: scope.userId, ownerType: 'SELF' };
    return {
      ownerType: scope.ownerType,
      orgId: scope.orgId,
      ...(scope.ownerType === 'CLIENT' ? { clientId: scope.clientId } : { clientId: null }),
    };
  }

  /** 渲染并发闸门键（T7）：SELF 按用户、ORG/CLIENT 按组织，保证「每账户 1 RUNNING」串行化 */
  private renderGateKey(scope: OwnerScope): string {
    return scope.ownerType === 'SELF' ? scope.userId : (scope.orgId ?? scope.userId);
  }

  async mustGetProject(scope: OwnerScope, projectId: string) {
    const p = await this.prisma.batchRenderProject.findFirst({
      where: { id: projectId, ...this.projectWhere(scope) },
    });
    if (!p) throw err404();
    return p;
  }

  /**
   * 模板（作品）归属校验 —— §16.6 硬要求：
   * 两个宿主的编辑器都可能拿到任意 work id，若只按 id 取 schema，就能拿别人作品批量出图。
   * 这里按「作品创建者 = 作用域用户」断言（ORG/CLIENT 域的作品同样挂在 SP 的 userId 下），
   * 越权一律 404（不暴露存在）。模板取用（渲染 / 变量读取）都必须先过这道闸。
   */
  private async mustGetOwnedTemplate(scope: OwnerScope, templateId: string) {
    const work = await this.prisma.project.findFirst({
      where: { id: templateId, userId: scope.userId },
      select: { id: true, schema: true, draftSchema: true },
    });
    if (!work) throw err404();
    return work;
  }

  /** 创建/复用项目（绑定模板 + 名单，此时尚未锁定，state=DRAFT） */
  async createProject(scope: OwnerScope, templateId: string, listId: string) {
    // 名单必须在本作用域内可见（复用名单模块的隔离，避免重复实现）
    await this.guestLists.listRecords(scope, listId, 1, 1);
    // 作品归属校验（§16.6）：防越权拿他人模板批量生成
    await this.mustGetOwnedTemplate(scope, templateId);

    const existing = await this.prisma.batchRenderProject.findFirst({
      where: { ...this.projectWhere(scope), templateId, listId },
    });
    if (existing) return this.projectView(existing);

    const p = await this.prisma.batchRenderProject.create({
      data: {
        ownerId: scope.userId,
        ownerType: scope.ownerType,
        orgId: scope.orgId,
        clientId: scope.ownerType === 'CLIENT' ? scope.clientId : null,
        listId,
        templateId,
        state: 'DRAFT',
      },
    });
    return this.projectView(p);
  }

  /** 项目视图：状态 + 配额 + 锁定信息（§10 GET /api/invitations/projects/:id） */
  private projectView(p: {
    id: string;
    listId: string;
    templateId: string;
    state: string;
    freeRendered: number;
    purchasedHeadcount: number;
    paidRendered: number;
    lockedAt: Date | null;
    clientId: string | null;
  }) {
    const totalRenderable = FREE_SAMPLE_CAP + p.purchasedHeadcount;
    const alreadyRendered = p.freeRendered + p.paidRendered;
    return {
      id: p.id,
      listId: p.listId,
      templateId: p.templateId,
      state: p.state,
      clientId: p.clientId,
      freeRendered: p.freeRendered,
      paidRendered: p.paidRendered,
      purchasedHeadcount: p.purchasedHeadcount,
      freeSampleCap: FREE_SAMPLE_CAP,
      totalRenderable,
      alreadyRendered,
      remaining: Math.max(0, totalRenderable - alreadyRendered),
      locked: p.state !== 'DRAFT',
      lockedAt: p.lockedAt,
    };
  }

  async getProject(scope: OwnerScope, projectId: string) {
    return this.projectView(await this.mustGetProject(scope, projectId));
  }

  async listProjects(scope: OwnerScope) {
    const rows = await this.prisma.batchRenderProject.findMany({
      where: this.projectWhere(scope),
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.projectView(r));
  }

  /* ────────── §9.3 勾选子集 ────────── */

  async getSelection(scope: OwnerScope, projectId: string) {
    const p = await this.mustGetProject(scope, projectId);
    const sel = await this.prisma.guestListSelection.findUnique({ where: { projectId: p.id } });
    return {
      projectId: p.id,
      listId: sel?.listId ?? p.listId,
      selectedRecordIds: ((sel?.selectedRecordIds ?? []) as unknown as string[]) ?? [],
      updatedAt: sel?.updatedAt ?? null,
    };
  }

  /** upsert 勾选：元素必须属于该项目绑定的名单（否则 422 INVALID_SELECTION） */
  async setSelection(scope: OwnerScope, projectId: string, listId: string, ids: string[]) {
    const p = await this.mustGetProject(scope, projectId);
    // 锁定后禁止更换名单（FR-2）：只能在同一份锁定名单内调整
    if (p.state !== 'DRAFT' && listId !== p.listId) {
      throw new HttpException({ code: 'LOCKED', message: '已锁定名单，不可更换批次' }, 409);
    }
    if (!Array.isArray(ids)) throw err400('INVALID_SELECTION', '勾选数据格式不正确');

    const uniq = [...new Set(ids.map((i) => String(i)))];
    if (uniq.length) {
      const owned = await this.prisma.guestRecord.findMany({
        where: { listId, deletedAt: null, id: { in: uniq } },
        select: { id: true },
      });
      if (owned.length !== uniq.length) {
        throw new HttpException(
          { code: 'INVALID_SELECTION', message: '勾选含不属于该名单的记录' },
          422,
        );
      }
    }

    const saved = await this.prisma.guestListSelection.upsert({
      where: { projectId: p.id },
      create: { projectId: p.id, listId, selectedRecordIds: uniq as never },
      update: { listId, selectedRecordIds: uniq as never },
    });
    return { projectId: p.id, listId, selectedRecordIds: uniq, count: uniq.length, updatedAt: saved.updatedAt };
  }

  /** 候选筛选辅助（§9.3）：按单位/桌号/性别过滤出 recordId 与姓名 */
  async candidates(
    scope: OwnerScope,
    projectId: string,
    q: { unit?: string; table_no?: string; gender?: string },
  ) {
    const sel = await this.getSelection(scope, projectId);
    const rows = await this.prisma.guestRecord.findMany({
      where: { listId: sel.listId, deletedAt: null },
      orderBy: { seq: 'asc' },
    });
    const matched: string[] = [];
    const names: Record<string, string> = {};
    for (const r of rows) {
      const d = (r.data ?? {}) as unknown as GuestData;
      if (q.unit && (d.unit ?? '') !== q.unit) continue;
      if (q.table_no && (d.table_no ?? '') !== q.table_no) continue;
      if (q.gender && (d.gender ?? '').toUpperCase() !== q.gender.toUpperCase()) continue;
      matched.push(r.id);
      names[r.id] = d.guest_name ?? '';
    }
    return { matched, names };
  }

  /* ────────── §8.2 / §8.3 / §8.4 渲染 ────────── */

  /**
   * 发起批量渲染（同步建任务 + 后台异步执行）。
   *
   * 配额与锁定在**同一事务 + 咨询锁**内完成，杜绝超卖与重复锁定（B8/E4）。
   * 渲染本身在事务外执行；失败则回滚额度与锁定（全有或全无，B9/E3）。
   */
  async batchGenerate(
    scope: OwnerScope,
    input: { projectId: string; mode?: RenderMode; targetRecordIds?: string[] },
  ) {
    const p = await this.mustGetProject(scope, input.projectId);
    let mode: RenderMode = input.mode ?? (p.state === 'DRAFT' ? 'FREE_SAMPLE' : 'PAID');
    // 注意：下方事务内可能把免费且已锁定的 PAID/FREE_SAMPLE 退化为 RERENDER，
    // 故此处用 let 以便回写（见 B5 分支）。

    // ——— 事务：咨询锁 + 校验 + 扣减 + 落快照 ———
    const planned = await this.prisma.$transaction(async (tx) => {
      // pg_advisory_xact_lock 返回 void，$queryRaw 无法反序列化 → 用 $executeRaw
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${p.id}::text))`;
      // 每用户 1 RUNNING 闸门（T7）：以用户级咨询锁串行化所有渲染发起，
      // 再查该用户名下是否已有「活跃」RUNNING 任务，有则直接拒绝，杜绝并发叠渲染。
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(('u:' || ${this.renderGateKey(scope)})::text))`;
      const liveRunning = await tx.batchRenderProject.findMany({
        where: this.projectWhere(scope),
        select: { id: true },
      });
      if (liveRunning.length) {
        const running = await tx.renderJob.count({
          where: {
            projectId: { in: liveRunning.map((x) => x.id) },
            status: 'RUNNING',
            updatedAt: { gte: new Date(Date.now() - 10 * 60 * 1000) },
          },
        });
        if (running > 0) {
          throw new ConflictException({ code: 'RENDER_IN_PROGRESS', message: '已有渲染任务进行中，请等待其完成后再发起' });
        }
      }

      const fresh = await tx.batchRenderProject.findUnique({ where: { id: p.id } });
      if (!fresh) throw err404();

      // 人员集合：**恒读快照**（FR-3）；首渲前读勾选子集
      let recordIds: string[];
      let dataByRecordId: Record<string, GuestData>;

      const snap = await tx.renderSnapshot.findUnique({ where: { projectId: p.id } });

      // B5：已锁定且未购买：续渲(PAID)/误用(FREE_SAMPLE)均退化为「重渲赠样前 3 条（带水印）」，
      // 既不让免费用户借重渲拿到去水印专属图，也允许其清空历史后重新生成赠样（修复缺陷3）。
      // 付费用户(paidCap>0)不受影响，续渲仍走 PAID 渲染已购的 N+1..N+K；
      // 显式 RERENDER 本就走 C4 不耗配额分支，不被此处改写。须在「目标人员」计算前完成，
      // 否则会按 PAID 口径把全部锁定名单纳入 targets（绕过前 3 条限制）。
      if (snap && fresh.purchasedHeadcount <= 0 && mode !== 'RERENDER') {
        mode = 'RERENDER';
      }

      if (snap) {
        // 已锁定：人员集合（recordIds）恒等于首渲锁定名单（FR-3），
        // 但「数据」回源实时名单 —— 使名单修改正确映射到重渲请柬（修复缺陷2）。
        // 仅纳入未删除记录；免费用户重渲范围/水印在下方 RERENDER 分支约束。
        recordIds = (snap.recordIds as unknown as string[]) ?? [];
        const liveRows = await tx.guestRecord.findMany({
          where: { listId: fresh.listId, deletedAt: null, id: { in: recordIds } },
        });
        dataByRecordId = {};
        for (const r of liveRows) dataByRecordId[r.id] = (r.data ?? {}) as unknown as GuestData;
        recordIds = recordIds.filter((id) => dataByRecordId[id]);
      } else {
        const sel = await tx.guestListSelection.findUnique({ where: { projectId: p.id } });
        const subset = ((sel?.selectedRecordIds as unknown as string[]) ?? []).filter(Boolean);
        if (!subset.length) throw err400('EMPTY_SELECTION', '请至少勾选 1 人'); // B2/B16
        //
        // ⚠️ 锁定的是**整个勾选子集**，不是首渲那 3 人：
        // C2 只决定"首渲先渲子集前 3 人"，C3 又要求"付费后可续渲同一锁定名单的其余人员"，
        // 若快照只存 3 人，续渲就永远取不到剩余人员 → 与 C3 冲突。
        // 因此快照记录整个子集（有序），首渲/续渲各取其中未渲部分。
        const rows = await tx.guestRecord.findMany({
          where: { listId: fresh.listId, deletedAt: null, id: { in: subset } },
        });
        dataByRecordId = {};
        for (const r of rows) dataByRecordId[r.id] = (r.data ?? {}) as unknown as GuestData;
        // 保持子集顺序（而非 DB 返回顺序）
        recordIds = subset.filter((id) => dataByRecordId[id]);
        if (!recordIds.length) throw err400('EMPTY_SELECTION', '勾选人员无有效姓名，无法渲染');
      }

      // 已成功出图的人员集合（用于续渲去重与重渲刷新范围）
      const done = await tx.renderJob.findMany({
        where: { projectId: p.id, status: 'SUCCESS' },
        select: { targetRecordIds: true },
      });
      const rendered = new Set<string>();
      for (const d of done) {
        for (const id of (d.targetRecordIds as unknown as string[]) ?? []) rendered.add(id);
      }

      // 重渲可渲范围 + 水印（安全约束）：免费用户仅前 3 条、且强制带水印，
      // 杜绝「改名单→RERENDER」绕过前 3 条/去水印闸门拿到专属图。
      const rerenderWatermark = fresh.purchasedHeadcount <= 0;
      const rerenderCap = fresh.purchasedHeadcount <= 0 ? FREE_SAMPLE_CAP : recordIds.length;
      const eligible = recordIds.slice(0, rerenderCap);

      // 本次实际要渲染的人
      let targets: string[];
      if (mode === 'RERENDER') {
        // C4：模板改版后重渲 —— 刷新而非新增、不消耗配额。
        // v1.4：允许携带 targetRecordIds 仅重渲锁定名单内的指定人（单条失败重做 / 整批刷新均可）；
        // 不传则退化为「重渲已成功出图的全员」（保持旧行为，避免把尚未付费的第 N+1 人渲出，绕过付费闸门）。
        if (input.targetRecordIds?.length) {
          const allow = new Set(eligible);
          const req = input.targetRecordIds.map(String);
          const bad = req.filter((id) => !allow.has(id));
          if (bad.length) {
            throw err400('INVALID_SELECTION', '目标人员不在可重渲范围内（免费用户仅限前 3 条）'); // FR-2
          }
          targets = req;
        } else {
          // 免费用户：重渲范围已限制在前 3 条（eligible），直接全量重渲其赠样
          //（清空历史后也能重做，仍带水印）；付费用户：仅重渲已成功出图者，
          // 避免把尚未付费的 N+1.. 渲出，绕过付费闸门。
          targets = fresh.purchasedHeadcount <= 0 ? eligible : eligible.filter((id) => rendered.has(id));
        }
      } else if (input.targetRecordIds?.length) {
        const allow = new Set(recordIds);
        const req = input.targetRecordIds.map(String);
        const bad = req.filter((id) => !allow.has(id));
        if (bad.length) {
          throw err400('INVALID_SELECTION', '目标人员不在锁定名单内，不可跨批次渲染'); // FR-2
        }
        targets = req;
      } else if (snap) {
        targets = recordIds.filter((id) => !rendered.has(id));
      } else {
        targets = recordIds;
      }

      // 水印决策（付费闸门 §13）：赠样带水印+低分辨率；付费/重渲(付费用户)去水印+2x
      const watermark = mode === 'FREE_SAMPLE' ? true : mode === 'RERENDER' ? rerenderWatermark : false;

      if (!targets.length) throw err400('NOTHING_TO_RENDER', '锁定名单内已无待渲染人员');

      // ——— 配额校验（C1 唯一口径）———
      const freeSampleCap = FREE_SAMPLE_CAP;
      const paidCap = fresh.purchasedHeadcount;
      let freeUsed = fresh.freeRendered;
      let paidUsed = fresh.paidRendered;

      // B5 分支已上移至快照读取之后、目标人员计算之前（见上方），此处不再重复。

      if (mode === 'FREE_SAMPLE') {
        const room = Math.max(0, freeSampleCap - freeUsed);
        const batch = Math.min(room, targets.length);
        if (batch <= 0) {
          throw new HttpException(
            { code: 'QUOTA_EXCEEDED', message: '免费赠样已用完，请购买人次', remaining: 0 },
            402,
          );
        }
        targets = targets.slice(0, batch);
        freeUsed += batch;
      } else if (mode === 'PAID') {
        const room = Math.max(0, paidCap - paidUsed);
        const batch = Math.min(room, targets.length);
        if (batch <= 0) {
          throw new HttpException(
            { code: 'QUOTA_EXCEEDED', message: '已购人次已用完', remaining: 0 },
            402,
          );
        }
        targets = targets.slice(0, batch);
        paidUsed += batch;
      }
      // RERENDER 不消耗配额（C4/B14）

      // ——— 落库：首渲快照（不可变）+ 额度扣减 + 置 LOCKED ———
      if (!snap) {
        await tx.renderSnapshot.create({
          data: {
            projectId: p.id,
            listId: fresh.listId,
            recordIds: recordIds as never,
            renderedData: dataByRecordId as never,
            templateId: fresh.templateId,
            templateVersion: String(Date.now()),
            lockedAt: new Date(),
            variableMapping: (fresh.variableMapping ?? {}) as never,
          },
        });
      }

      const nextState =
        fresh.state === 'DRAFT' ? 'LOCKED' : paidCap > 0 ? 'PAID' : fresh.state;

      await tx.batchRenderProject.update({
        where: { id: p.id },
        data: {
          freeRendered: freeUsed,
          paidRendered: paidUsed,
          state: nextState,
          lockedAt: fresh.lockedAt ?? new Date(),
        },
      });

      const job = await tx.renderJob.create({
        data: {
          projectId: p.id,
          status: 'RUNNING',
          mode,
          targetRecordIds: targets as never,
          total: targets.length,
          progress: 0,
          resultUrls: [] as never,
        },
      });

      return { jobId: job.id, projectId: p.id, mode, targets, dataByRecordId, watermark, listId: fresh.listId, templateId: fresh.templateId, mapping: (fresh.variableMapping ?? {}) as Record<string, string> };
    });

    // 事务外执行耗时渲染（不持锁），失败回滚额度与快照
    void this.runJob(planned, scope).catch(async (err) => {
      await this.rollbackJob(planned, err);
    });

    return { jobId: planned.jobId, projectId: planned.projectId, mode: planned.mode, total: planned.targets.length };
  }

  /** 渲染失败回滚：释放额度、删除快照（全有或全无，B9/E3） */
  private async rollbackJob(
    planned: { jobId: string; projectId: string; mode: RenderMode; targets: string[] },
    err: unknown,
  ) {
    const msg = err instanceof Error ? err.message : String(err);
    try {
      await this.prisma.renderJob.update({
        where: { id: planned.jobId },
        data: { status: 'FAILED', error: msg.slice(0, 500) },
      });
      const p = await this.prisma.batchRenderProject.findUnique({ where: { id: planned.projectId } });
      if (!p) return;
      const n = planned.targets.length;
      await this.prisma.batchRenderProject.update({
        where: { id: planned.projectId },
        data: {
          freeRendered:
            planned.mode === 'FREE_SAMPLE' ? Math.max(0, p.freeRendered - n) : p.freeRendered,
          paidRendered: planned.mode === 'PAID' ? Math.max(0, p.paidRendered - n) : p.paidRendered,
        },
      });
      // 首渲失败 → 快照与锁定一并撤销，项目回 DRAFT（可重新来过）
      const jobs = await this.prisma.renderJob.count({
        where: { projectId: planned.projectId, status: 'SUCCESS' },
      });
      if (jobs === 0) {
        await this.prisma.renderSnapshot.deleteMany({ where: { projectId: planned.projectId } });
        await this.prisma.batchRenderProject.update({
          where: { id: planned.projectId },
          data: { state: 'DRAFT', lockedAt: null, freeRendered: 0, paidRendered: 0 },
        });
      }
    } catch {
      /* 回滚失败不覆盖原始错误 */
    }
  }

  /** 执行渲染任务：个性化 → 服务端截图 → 落私有资产 */
  private async runJob(
    planned: {
      jobId: string;
      projectId: string;
      mode: RenderMode;
      targets: string[];
      dataByRecordId: Record<string, GuestData>;
      watermark: boolean;
      templateId: string;
      listId: string;
      mapping: Record<string, string>;
    },
    scope: OwnerScope,
  ) {
    await this.prisma.renderJob.update({ where: { id: planned.jobId }, data: { status: 'RUNNING' } });

    // 模板 schema（草稿优先，与全站读写口径一致）；归属校验同 §16.6
    const work = await this.mustGetOwnedTemplate(scope, planned.templateId);
    const base = ((work as { draftSchema?: unknown; schema?: unknown }).draftSchema ??
      (work as { schema?: unknown }).schema) as unknown as Project;
    if (!base || !Array.isArray(base.pages)) throw new Error('模板数据为空');

    // D 方案：将项目级「画布点选元素绑定」注入模板，使点选元素成为变量（不回写模板）
    const project = await this.prisma.batchRenderProject.findUnique({ where: { id: planned.projectId } });
    const effectiveBase = applyElementBindings(
      base,
      (project?.elementBindings as unknown as ElementBindings | undefined) ?? {},
    );

    // 映射来源：优先「实时项目映射」(planned.mapping === fresh.variableMapping)，
    // 保证「锁定后重新配对」(S4 / §2.1.1 D4 反转) 在重渲时生效；
    // 仅当实时映射为空才回退快照（兼容首渲前尚未落库的历史数据）。
    // ⚠️ 旧逻辑 `snap.variableMapping ?? planned.mapping` 会在「首渲后重新配对」场景
    // 用过期的快照空映射（{}）覆盖新鲜映射，导致重渲专属请柬空白（缺陷修复）。
    const snap = await this.prisma.renderSnapshot.findUnique({ where: { projectId: planned.projectId } });
    const mapping = ((planned.mapping && Object.keys(planned.mapping).length
      ? planned.mapping
      : snap?.variableMapping) ?? {}) as Record<string, string>;

    const dir = this.outputDir(scope, planned.projectId, planned.jobId);
    await mkdir(dir, { recursive: true });

    const urls: { recordId: string; name: string; status: 'ok' | 'failed'; storageKey?: string; error?: string }[] = [];
    let done = 0;
    let failed = 0;

    // 限并发（RENDER_CONCURRENCY），避免 puppeteer 并发打爆
    const queue = [...planned.targets];
    const workers = Array.from({ length: Math.min(RENDER_CONCURRENCY, queue.length) }, async () => {
      for (;;) {
        const rid = queue.shift();
        if (!rid) return;
        const data = planned.dataByRecordId[rid] ?? {};
        // 文件名安全化：去掉路径分隔符与 Windows 保留字符
        const name = (data.guest_name ?? 'guest').replace(/[\\/:*?"<>|]/g, '_').slice(0, 40) || 'guest';

        try {
          const schema = personalizeSchema(effectiveBase, { id: rid, data }, mapping);

          // 付费闸门（§13）：赠样带水印 + 低分辨率；付费/重渲去水印 + 2x
          // 水印决策在 batchGenerate 内按模式 + 是否付费用户统一计算后随 planned 下传，
          // 免费用户重渲强制带水印（安全约束，防止借 RERENDER 拿去水印专属图）。
          const watermark = planned.watermark;
          // 全局信号量（T7）：跨所有 job 限制同时进行的 puppeteer 渲染数，
          // 单条渲染（建会话 + 截图）整体占信号量，避免多 job 并发叠满打爆机器。
          await renderSemaphore.acquire();
          try {
            const { token } = await this.exportService.prepareSchema(schema, scope.userId, {
              watermark,
              scale: watermark ? 1 : 2,
            });
            // 超时闸门（E3）：渲染页不可达 / puppeteer 卡死时也必须失败并释放配额
            const { buffer } = await withTimeout(
              this.exportService.renderImage({ token, mode: 'current', page: 0, format: 'png' }),
              RENDER_PER_ITEM_TIMEOUT_MS,
              `渲染「${name}」超时`,
            );

            const fileName = `${String(done + 1).padStart(3, '0')}-${name}-${createHash('sha1').update(rid).digest('hex').slice(0, 8)}.png`;
            const abs = join(dir, fileName);
            await writeFile(abs, buffer);

            urls.push({
              recordId: rid,
              name: data.guest_name ?? '',
              status: 'ok',
              storageKey: relative(process.cwd(), abs).replace(/\\/g, '/'),
            });
          } finally {
            renderSemaphore.release();
          }
        } catch (e) {
          // 逐人隔离：单条失败仅标记该条 failed 并继续，整 job 不因个别失败而中断（v1.4）
          failed += 1;
          urls.push({
            recordId: rid,
            name: data.guest_name ?? '',
            status: 'failed',
            error: (e instanceof Error ? e.message : String(e)).slice(0, 300),
          });
        }
        done += 1;
        await this.prisma.renderJob.update({
          where: { id: planned.jobId },
          data: { progress: done, resultUrls: urls as never },
        });
      }
    });

    await Promise.all(workers);

    // 结果按目标顺序输出（并发完成后重排，保证出图顺序 == 名单顺序）
    const order = new Map(planned.targets.map((id, i) => [id, i]));
    urls.sort((a, b) => (order.get(a.recordId) ?? 0) - (order.get(b.recordId) ?? 0));

    // 终态：全部成功 → SUCCESS；部分失败 → PARTIAL（新增）；全部失败 → FAILED
    const okCount = urls.filter((u) => u.status === 'ok').length;
    const finalStatus = failed === 0 ? 'SUCCESS' : okCount === 0 ? 'FAILED' : 'PARTIAL';
    await this.prisma.renderJob.update({
      where: { id: planned.jobId },
      data: { status: finalStatus, progress: urls.length, resultUrls: urls as never },
    });

    // 配额（C1）：仅**成功条数**占用名额；失败条在收尾时回退对应桶，
    // 避免占用赠样 / 付费名额（RERENDER 本就不占配额，无需回退）。
    if (failed > 0 && planned.mode !== 'RERENDER') {
      const cur = await this.prisma.batchRenderProject.findUnique({ where: { id: planned.projectId } });
      if (cur) {
        const bucket = planned.mode === 'FREE_SAMPLE' ? cur.freeRendered : cur.paidRendered;
        const dec = Math.min(failed, bucket);
        if (dec > 0) {
          await this.prisma.batchRenderProject.update({
            where: { id: planned.projectId },
            data: planned.mode === 'FREE_SAMPLE' ? { freeRendered: cur.freeRendered - dec } : { paidRendered: cur.paidRendered - dec },
          });
        }
      }
    }
  }

  /**
   * 断点续跑（T6）：仅重渲某 job 内「未成功」（failed / 缺失）的记录。
   *
   * 设计要点：
   *  - 读取该 job 的 `resultUrls`，把 `status !== 'ok'` 的 recordId 从目标集剔除，
   *    仅对失败/缺失项开新 job 重渲（复用 runJob + rollbackJob 全部既有机制）。
   *  - 配额：失败记录此前已在 runJob 尾部被回退（failed>0 时按桶扣减），
   *    故此处重渲属「净新占用」——非 RERENDER 模式需重新占额，成功则计入、
   *    再失败则由 rollbackJob 再次回退，不会重复占用也不会漏计。
   *  - 不重渲已成功项，避免赠样/付费名额被成功记录二次消耗。
   *  - 越权一律 404（mustGetProject 走作用域隔离唯一入口）。
   */
  async resumeJob(scope: OwnerScope, jobId: string) {
    const job = await this.prisma.renderJob.findUnique({ where: { id: jobId } });
    if (!job) throw err404();
    await this.mustGetProject(scope, job.projectId); // 越权 404

    const allTargets = ((job.targetRecordIds as unknown as string[]) ?? []).map(String);
    const results = ((job.resultUrls as unknown as { recordId: string; status?: string }[]) ?? []);
    const okSet = new Set(results.filter((r) => r.status === 'ok').map((r) => r.recordId));
    let failedIds = allTargets.filter((id) => !okSet.has(id));
    if (!failedIds.length) {
      throw err400('NOTHING_TO_RESUME', '该任务已全部成功，无需续跑');
    }

    const mode = ((job.mode as RenderMode) ?? 'RERENDER') as RenderMode;

    const planned = await this.prisma.$transaction(async (tx) => {
      // pg_advisory_xact_lock 返回 void，$queryRaw 无法反序列化 → 用 $executeRaw
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${job.projectId}::text))`;
      // 每用户 1 RUNNING 闸门（T7）：与 batchGenerate 同口径，串行化发起并拒绝并发续跑
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(('u:' || ${this.renderGateKey(scope)})::text))`;
      const liveRunning = await tx.batchRenderProject.findMany({
        where: this.projectWhere(scope),
        select: { id: true },
      });
      if (liveRunning.length) {
        const running = await tx.renderJob.count({
          where: {
            projectId: { in: liveRunning.map((x) => x.id) },
            status: 'RUNNING',
            updatedAt: { gte: new Date(Date.now() - 10 * 60 * 1000) },
          },
        });
        if (running > 0) {
          throw new ConflictException({ code: 'RENDER_IN_PROGRESS', message: '已有渲染任务进行中，请等待其完成后再续跑' });
        }
      }

      const fresh = await tx.batchRenderProject.findUnique({ where: { id: job.projectId } });
      if (!fresh) throw err404();
      const snap = await tx.renderSnapshot.findUnique({ where: { projectId: job.projectId } });
      if (!snap) throw err400('NO_SNAPSHOT', '缺少渲染快照，无法续跑');

      // 续跑目标必须仍在锁定名单内（FR-2 防跨批次）
      const recordIds = (snap.recordIds as unknown as string[]) ?? [];
      const allow = new Set(recordIds);
      const bad = failedIds.filter((id) => !allow.has(id));
      if (bad.length) throw err400('INVALID_SELECTION', '续跑目标不在锁定名单内，不可跨批次渲染');

      // ——— 配额（C1 唯一口径），仅非 RERENDER 模式重新占用 ———
      let freeUsed = fresh.freeRendered;
      let paidUsed = fresh.paidRendered;
      if (mode === 'FREE_SAMPLE') {
        const room = Math.max(0, FREE_SAMPLE_CAP - freeUsed);
        const batch = Math.min(room, failedIds.length);
        if (batch <= 0) {
          throw new HttpException({ code: 'QUOTA_EXCEEDED', message: '免费赠样已用完，请购买人次', remaining: 0 }, 402);
        }
        failedIds = failedIds.slice(0, batch);
        freeUsed += batch;
      } else if (mode === 'PAID') {
        const room = Math.max(0, fresh.purchasedHeadcount - paidUsed);
        const batch = Math.min(room, failedIds.length);
        if (batch <= 0) {
          throw new HttpException({ code: 'QUOTA_EXCEEDED', message: '已购人次已用完', remaining: 0 }, 402);
        }
        failedIds = failedIds.slice(0, batch);
        paidUsed += batch;
      }
      // RERENDER 不占配额（C4/B14）

      if (!failedIds.length) throw err400('NOTHING_TO_RESUME', '无可用续跑额度');

      await tx.batchRenderProject.update({
        where: { id: job.projectId },
        data: { freeRendered: freeUsed, paidRendered: paidUsed },
      });

      const newJob = await tx.renderJob.create({
        data: {
          projectId: job.projectId,
          status: 'RUNNING',
          mode,
          targetRecordIds: failedIds as never,
          total: failedIds.length,
          progress: 0,
          resultUrls: [] as never,
        },
      });

      // 数据回源实时名单（与 batchGenerate 一致，修复缺陷2：名单修改能映射到续跑重渲）
      const liveRows = await tx.guestRecord.findMany({
        where: { listId: fresh.listId, deletedAt: null, id: { in: failedIds } },
      });
      const dataByRecordId: Record<string, GuestData> = {};
      for (const r of liveRows) dataByRecordId[r.id] = (r.data ?? {}) as unknown as GuestData;
      // 水印决策（付费闸门 §13）：赠样/免费重渲带水印；付费重渲去水印
      const watermark = mode === 'FREE_SAMPLE' ? true : mode === 'RERENDER' ? fresh.purchasedHeadcount <= 0 : false;

      return {
        jobId: newJob.id,
        projectId: job.projectId,
        mode,
        targets: failedIds,
        dataByRecordId,
        watermark,
        listId: fresh.listId,
        templateId: fresh.templateId,
        mapping: (fresh.variableMapping ?? {}) as Record<string, string>,
      };
    });

    // 事务外执行耗时渲染（不持锁），失败回滚额度与快照（复用 rollbackJob）
    void this.runJob(planned, scope).catch(async (err) => {
      await this.rollbackJob(planned, err);
    });

    return {
      jobId: planned.jobId,
      projectId: planned.projectId,
      mode: planned.mode,
      total: planned.targets.length,
      resumedFrom: jobId,
    };
  }

  /**
   * 僵尸任务回收（T6）：服务启动时扫描「运行超时」的 RUNNING 任务，
   * 置为 FAILED 并回退其「未成功部分」的配额，避免看门狗/进程崩溃后
   * 任务永久停在 RUNNING、额度被占死、用户无法重试。
   *
   * 回收口径：以该 job 的 `targetRecordIds` 总数减去 `resultUrls` 中 `status==='ok'`
   * 的条数 = 未成功条数，仅回退这部分配额（已成功项仍占额，符合 C1 口径）。
   * RERENDER 任务不占配额，无需回退。
   */
  async recoverZombieJobs(timeoutMs: number = 10 * 60 * 1000) {
    const cutoff = new Date(Date.now() - timeoutMs);
    const zombies = await this.prisma.renderJob.findMany({
      where: { status: 'RUNNING', updatedAt: { lt: cutoff } },
    });
    for (const z of zombies) {
      try {
        const targets = ((z.targetRecordIds as unknown as string[]) ?? []).length;
        const results = ((z.resultUrls as unknown as { recordId: string; status?: string }[]) ?? []);
        const okCount = results.filter((r) => r.status === 'ok').length;
        const failedCount = Math.max(0, targets - okCount);
        const mode = (z.mode as RenderMode) ?? 'RERENDER';

        await this.prisma.$transaction(async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${z.projectId}::text))`;
          const p = await tx.batchRenderProject.findUnique({ where: { id: z.projectId } });
          if (p && failedCount > 0 && mode !== 'RERENDER') {
            if (mode === 'FREE_SAMPLE') {
              await tx.batchRenderProject.update({
                where: { id: z.projectId },
                data: { freeRendered: Math.max(0, p.freeRendered - failedCount) },
              });
            } else {
              await tx.batchRenderProject.update({
                where: { id: z.projectId },
                data: { paidRendered: Math.max(0, p.paidRendered - failedCount) },
              });
            }
          }
          await tx.renderJob.update({
            where: { id: z.id },
            data: { status: 'FAILED', error: '运行超时，已由启动回收任务置为失败' },
          });
        });
      } catch {
        /* 单条回收失败不阻断其余 */
      }
    }
    return { recovered: zombies.length };
  }

  /** 私有资产输出目录（SELF 按用户，CLIENT/ORG 按组织，§13） */
  private outputDir(scope: OwnerScope, projectId: string, jobId: string): string {
    const base =
      scope.ownerType === 'SELF'
        ? join(PRIVATE_ROOT, 'users', scope.userId)
        : join(PRIVATE_ROOT, 'orgs', scope.orgId ?? scope.userId);
    return join(base, 'invitations', projectId, jobId);
  }

  /* ────────── 任务查询 ────────── */

  async getJob(scope: OwnerScope, jobId: string) {
    const job = await this.prisma.renderJob.findUnique({ where: { id: jobId } });
    if (!job) throw err404();
    await this.mustGetProject(scope, job.projectId); // 归属校验（越权 404）
    return {
      id: job.id,
      projectId: job.projectId,
      status: job.status,
      mode: job.mode,
      progress: job.progress,
      total: job.total,
      targetRecordIds: (job.targetRecordIds as unknown as string[]) ?? [],
      results: ((job.resultUrls as unknown as { recordId: string; name: string; storageKey?: string; status?: string; error?: string }[]) ?? []).map(
        (r) => ({
          recordId: r.recordId,
          name: r.name,
          status: r.status ?? 'ok',
          url: r.status === 'failed' ? null : `/api/invitations/jobs/${job.id}/files/${r.recordId}`,
          error: r.error ?? null,
        }),
      ),
      error: job.error,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    };
  }

  /** 取任务内某位受邀者的图（鉴权下载，不公开静态暴露） */
  async getJobFile(scope: OwnerScope, jobId: string, recordId: string) {
    const job = await this.prisma.renderJob.findUnique({ where: { id: jobId } });
    if (!job) throw err404();
    await this.mustGetProject(scope, job.projectId);
    const list = ((job.resultUrls as unknown as { recordId: string; storageKey: string }[]) ?? []);
    const hit = list.find((r) => r.recordId === recordId);
    if (!hit) throw err404();
    return { buffer: await readFile(join(process.cwd(), hit.storageKey)) };
  }

  /**
   * 构建邀请批次归档 Zip（T9，§7 分发模块）。
   * - 图片统一放在 `images/` 子目录（归档层级，避免与清单混在根）；
   * - 根目录附 `manifest.json`：记录 projectId / templateId / listId / 生成时间 / 逐人清单（文件名+状态），
   *   便于二次分发、溯源与跨端还原。
   * - 失败项不入档；同名文件按序号兜底防覆盖。
   */
  private async buildInvitationArchive(
    meta: { projectId: string; templateId?: string | null; listId?: string | null; mode?: string | null; title?: string | null },
    items: { recordId: string; name: string; storageKey: string; status: string }[],
  ): Promise<Buffer> {
    const entries: { name: string; data: Buffer }[] = [];
    const used = new Set<string>();
    const records: { recordId: string; name: string; file: string; status: string }[] = [];
    for (const it of items) {
      if (it.status === 'failed') continue;
      let fname = basename(it.storageKey);
      if (used.has(fname)) fname = `${String(entries.length + 1).padStart(3, '0')}-${fname}`;
      used.add(fname);
      const arcName = `images/${fname}`;
      entries.push({ name: arcName, data: await readFile(join(process.cwd(), it.storageKey)) });
      records.push({ recordId: it.recordId, name: it.name, file: arcName, status: 'ok' });
    }
    if (!entries.length) throw err400('NOTHING_TO_ZIP', '没有可打包的图片');
    const manifest = {
      app: 'TAKLIP-Cloud',
      type: 'invitation-batch',
      projectId: meta.projectId,
      templateId: meta.templateId ?? null,
      listId: meta.listId ?? null,
      mode: meta.mode ?? null,
      title: meta.title ?? null,
      generatedAt: new Date().toISOString(),
      total: records.length,
      records,
    };
    entries.push({ name: 'manifest.json', data: Buffer.from(JSON.stringify(manifest, null, 2), 'utf8') });
    return zipStore(entries);
  }

  /**
   * 打包整个任务的结果图为 Zip（§7 分发模块）。
   * 文件名按「序号-姓名.png」重名兜底，同名自动加序号避免互相覆盖。
   * v1.4：支持 `recordIds` 子集过滤（不传则打包全部成功图）。T9：统一 `images/` 目录 + manifest.json。
   */
  async zipJob(scope: OwnerScope, jobId: string, recordIds?: string[]) {
    const job = await this.prisma.renderJob.findUnique({ where: { id: jobId } });
    if (!job) throw err404();
    const p = await this.mustGetProject(scope, job.projectId);
    if (job.status !== 'SUCCESS' && job.status !== 'PARTIAL') throw err400('NOT_READY', '任务尚未完成，暂不可打包下载');

    const want = recordIds && recordIds.length ? new Set(recordIds.map(String)) : null;
    const list = ((job.resultUrls as unknown as { recordId: string; name: string; storageKey: string; status?: string }[]) ?? []);
    const items = list
      .filter((it) => it.status !== 'failed' && (!want || want.has(it.recordId)))
      .map((it) => ({ recordId: it.recordId, name: it.name, storageKey: it.storageKey, status: it.status ?? 'ok' }));
    return this.buildInvitationArchive(
      { projectId: p.id, templateId: p.templateId, listId: p.listId, mode: job.mode, title: null },
      items,
    );
  }

  /**
   * 聚合某项目下所有渲染任务的逐人状态（v1.4，§18.3）。
   * 跨 job 合并，按锁定快照 recordIds 顺序返回，供用户端「逐人任务表」统一展示。
   * 后生成的 job（如 RERENDER 重渲）覆盖先前的同人结果。
   */
  async projectResults(scope: OwnerScope, projectId: string) {
    const p = await this.mustGetProject(scope, projectId);
    const snap = await this.prisma.renderSnapshot.findUnique({ where: { projectId: p.id } });
    const recordIds = ((snap?.recordIds as unknown as string[]) ?? []).filter(Boolean);
    const renderedData = ((snap?.renderedData as unknown as Record<string, GuestData>) ?? {}) as Record<string, GuestData>;

    const jobs = await this.prisma.renderJob.findMany({
      where: { projectId: p.id },
      orderBy: { createdAt: 'asc' },
    });
    const byId = new Map<string, { recordId: string; name: string | null; status: string; url: string | null; error: string | null }>();
    for (const job of jobs) {
      const list = ((job.resultUrls as unknown as { recordId: string; name: string; storageKey?: string; status?: string; error?: string }[]) ?? []);
      for (const it of list) {
        byId.set(it.recordId, {
          recordId: it.recordId,
          name: it.name || null,
          status: it.status ?? 'ok',
          url: it.status === 'failed' ? null : `/api/invitations/jobs/${job.id}/files/${it.recordId}`,
          error: it.error ?? null,
        });
      }
    }

    const order = new Map(recordIds.map((id, i) => [id, i]));
    const rows = recordIds.map((id) => {
      const hit = byId.get(id);
      const name = hit?.name ?? renderedData[id]?.guest_name ?? null;
      return {
        recordId: id,
        name,
        status: hit?.status ?? 'pending',
        url: hit?.url ?? null,
        error: hit?.error ?? null,
      };
    });
    rows.sort((a, b) => (order.get(a.recordId) ?? 0) - (order.get(b.recordId) ?? 0));
    return { projectId: p.id, total: recordIds.length, results: rows };
  }

  /**
   * 跨 job 打包某项目的指定人员图片为 Zip（v1.4，§18.4）。
   * 不传 recordIds 则打包全部成功图。
   */
  async zipProject(scope: OwnerScope, projectId: string, recordIds?: string[]) {
    const p = await this.mustGetProject(scope, projectId);
    const jobs = await this.prisma.renderJob.findMany({ where: { projectId: p.id } });
    const want = recordIds && recordIds.length ? new Set(recordIds.map(String)) : null;
    const items: { recordId: string; name: string; storageKey: string; status: string }[] = [];
    for (const job of jobs) {
      const list = ((job.resultUrls as unknown as { recordId: string; name: string; storageKey: string; status?: string }[]) ?? []);
      for (const it of list) {
        if (it.status === 'failed') continue;
        if (want && !want.has(it.recordId)) continue;
        items.push({ recordId: it.recordId, name: it.name, storageKey: it.storageKey, status: it.status ?? 'ok' });
      }
    }
    return this.buildInvitationArchive(
      { projectId: p.id, templateId: p.templateId, listId: p.listId, mode: null, title: null },
      items,
    );
  }

  /**
   * 删除某项目指定人员的生成记录（v1.4，§18.4）。
   * 遍历项目下全部 job，移除匹配 recordIds 的 resultUrls 条目并**尽力删除**私有资产文件，同步各 job 进度；
   * **不退还已消耗配额**（删除 ≠ 释放名额，重渲走 RERENDER 免费）。
   */
  async deleteProjectResults(scope: OwnerScope, projectId: string, recordIds: string[]) {
    if (!Array.isArray(recordIds) || !recordIds.length) throw err400('INVALID_PARAMS', 'recordIds 必填');
    await this.mustGetProject(scope, projectId);
    const del = new Set(recordIds.map(String));
    const jobs = await this.prisma.renderJob.findMany({ where: { projectId } });
    let removed = 0;
    for (const job of jobs) {
      const list = ((job.resultUrls as unknown as { recordId: string; storageKey?: string; status?: string }[]) ?? []);
      const kept = list.filter((it) => !del.has(it.recordId));
      if (kept.length === list.length) continue;
      // 尽力删除已落盘的私有文件
      for (const it of list) {
        if (del.has(it.recordId) && it.storageKey) {
          try {
            await unlink(join(process.cwd(), it.storageKey));
          } catch {
            /* 文件可能已被清理，忽略 */
          }
        }
      }
      removed += list.length - kept.length;
      await this.prisma.renderJob.update({
        where: { id: job.id },
        data: { resultUrls: kept as never, progress: kept.length },
      });
    }
    return { removed, projectId };
  }

  async listJobs(scope: OwnerScope, projectId?: string) {
    const where: Record<string, unknown> = projectId
      ? { projectId }
      : { projectId: { in: (await this.prisma.batchRenderProject.findMany({ where: this.projectWhere(scope), select: { id: true } })).map((p) => p.id) } };
    const rows = await this.prisma.renderJob.findMany({ where, orderBy: { createdAt: 'desc' }, take: 50 });
    return rows.map((j) => ({
      id: j.id,
      projectId: j.projectId,
      status: j.status,
      mode: j.mode,
      progress: j.progress,
      total: j.total,
      createdAt: j.createdAt,
      updatedAt: j.updatedAt,
    }));
  }

  /* ────────── §8.3 购买人次（Slice H） ────────── */

  /**
   * 写入已购人次 `N`（支付成功后由订单回调调用）。
   * 额度挂在 **项目 / clientId 维度**（D2），与 SP 自身会员权益解耦。
   */
  async purchase(scope: OwnerScope, projectId: string, headcount: number) {
    const p = await this.mustGetProject(scope, projectId);
    const n = Math.floor(headcount);
    if (!Number.isFinite(n) || n <= 0) throw err400('INVALID_HEADCOUNT', '购买人次必须为正整数');
    if (n > 100000) throw err400('INVALID_HEADCOUNT', '单次购买人次过大');

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${p.id}::text))`;
      const fresh = await tx.batchRenderProject.findUnique({ where: { id: p.id } });
      if (!fresh) throw err404();
      // 新上限不得低于已渲染人数（B12：只累加，不回退）
      const next = fresh.purchasedHeadcount + n;
      return tx.batchRenderProject.update({
        where: { id: p.id },
        data: { purchasedHeadcount: next, state: 'PAID' },
      });
    });
    return this.projectView(updated);
  }

  /** 模板变量体检：列出模板用到的变量 key，提示缺失字段 */
  async templateBindings(scope: OwnerScope, projectId: string) {
    const p = await this.mustGetProject(scope, projectId);
    const work = await this.mustGetOwnedTemplate(scope, p.templateId);
    const base = ((work as { draftSchema?: unknown; schema?: unknown } | null)?.draftSchema ??
      (work as { schema?: unknown } | null)?.schema) as unknown as Project | undefined;
    return { projectId: p.id, templateId: p.templateId, keys: collectBindingKeys(base) };
  }

  /** 生成前变量匹配体检（D4 反转：含映射改指向） */
  async getHealth(scope: OwnerScope, projectId: string) {
    const p = await this.mustGetProject(scope, projectId);
    const work = await this.mustGetOwnedTemplate(scope, p.templateId);
    const base = ((work as { draftSchema?: unknown; schema?: unknown } | null)?.draftSchema ??
      (work as { schema?: unknown } | null)?.schema) as unknown as Project | undefined;
    const project = await this.prisma.batchRenderProject.findUnique({ where: { id: p.id } });
    const eb = (project?.elementBindings as unknown as ElementBindings | undefined) ?? {};
    const effectiveBase = applyElementBindings(base, eb);
    const vars = collectBindings(effectiveBase);

    const list = await this.prisma.guestList.findUnique({ where: { id: p.listId } });
    const defs = await this.resolveListColumnDefs(list, p.listId);
    const listKeys = new Set(defs.map((d) => d.key));

    const mapping = (p.variableMapping ?? {}) as Record<string, string>;

    const matched: { key: string; label: string; name?: string | null }[] = [];
    const missing: { key: string; label: string; name?: string | null; critical: boolean; remapTargets: string[] }[] = [];
    const usedSrc = new Set<string>();

    for (const v of vars) {
      const srcKey = mapping[v.key] ?? v.key;
      usedSrc.add(srcKey);
      if (listKeys.has(srcKey)) {
        matched.push({ key: v.key, label: v.label, name: v.name });
      } else {
        missing.push({
          key: v.key,
          label: v.label,
          name: v.name,
          critical: v.key === 'guest_name',
          remapTargets: defs.map((d) => d.key),
        });
      }
    }

    const blocked = missing.some((m) => m.critical);

    // 选中子集（§2.5 / D2）：仅统计被勾选人员，未选则统计全名单
    const sel = await this.prisma.guestListSelection.findUnique({ where: { projectId: p.id } });
    const subset = ((sel?.selectedRecordIds as unknown as string[]) ?? []).filter(Boolean);
    const recWhere = subset.length
      ? { listId: p.listId, deletedAt: null, id: { in: subset } }
      : { listId: p.listId, deletedAt: null };
    const rows = await this.prisma.guestRecord.findMany({ where: recWhere });
    const rowData = rows.map((r) => (r.data ?? {}) as unknown as GuestData);

    // 空值预警：按选中子集逐行统计（§2.5，D2 副作用）
    const emptyHits: { key: string; label: string; rows: number }[] = [];
    for (const v of matched) {
      const srcKey = mapping[v.key] ?? v.key;
      let empty = 0;
      for (const d of rowData) {
        const val = (d as Record<string, unknown>)[srcKey];
        if (val == null || val === '') empty += 1;
      }
      if (empty > 0) emptyHits.push({ key: v.key, label: v.label, rows: empty });
    }

    // 字体覆盖体检（T-续）：所选字体能否覆盖实际名单数据字符，缺字将静默回退系统字体、
    // 与模板设计观感不一致。非阻断，仅作琥珀色建议。
    const fontCoverage = this.checkFontCoverage(base, mapping, listKeys, rowData);

    const unusedFields = defs
      .filter((d) => !usedSrc.has(d.key))
      .map((d) => ({ key: d.key, label: d.label }));

    // D 方案体检：孤儿（绑定指向不存在元素）/ 覆盖（元素已有 C 绑定且 key 不同）
    const allElementIds = new Set(
      (effectiveBase?.pages ?? []).flatMap((pg) => (pg.elements ?? []).map((e) => e.id)),
    );
    const orphaned = Object.keys(eb).filter((id) => !allElementIds.has(id));
    const superseded = Object.entries(eb)
      .filter(([id, e]) => {
        const el = (effectiveBase?.pages ?? []).flatMap((pg) => pg.elements ?? []).find((x) => x.id === id);
        return !!el?.binding?.key && el.binding.key !== e.key;
      })
      .map(([id]) => id);

    return {
      projectId: p.id,
      templateId: p.templateId,
      listId: p.listId,
      mapping,
      vars: vars.map((v) => ({
        key: v.key,
        name: v.name,
        label: v.label,
        elementIds: v.elementIds,
        isStandard: v.isStandard,
      })),
      candidates: defs.map((d) => ({ key: d.key, label: d.label })),
      matched,
      missing,
      emptyHits,
      unusedFields,
      fontCoverage,
      blocked,
      orphaned,
      superseded,
    };
  }

  /** 生成期画布点选：返回模板可点选元素列表 + 预览 schema（D 方案） */
  async getProjectElements(scope: OwnerScope, projectId: string) {
    const p = await this.mustGetProject(scope, projectId);
    const work = await this.mustGetOwnedTemplate(scope, p.templateId);
    const base = ((work as { draftSchema?: unknown; schema?: unknown } | null)?.draftSchema ??
      (work as { schema?: unknown } | null)?.schema) as unknown as Project | undefined;
    const elements = (base?.pages ?? []).flatMap((pg, pi) =>
      (pg.elements ?? []).map((el) => ({
        id: el.id,
        type: el.type,
        pageIndex: pi,
        text: (el as { text?: string }).text,
        bindingKey: el.binding?.key,
      })),
    );
    return { projectId: p.id, templateId: p.templateId, previewSchema: base, elements };
  }

  /**
   * 字体覆盖体检（T-续）：对每个含字体（且字体在目录中可识别）的文本元素，
   * 校验其**实际渲染文本**所用字符是否被该字体覆盖。
   *
   * - 绑定元素：取「设计态样例 + 名单实际数据值（经映射）」的并集字符。
   * - 静态元素：取元素自身文案字符。
   * - 目录中不存在的 family（系统字体等）跳过——无法评估。
   * - 维吾尔文缺字：buildFontFamilyStack 已做「整段确定性回退」（设计预期、跨浏览器一致），
   *   故仅标记 `uyghurFallback` 而不计入缺陷；其余脚本缺字为真实不一致风险。
   */
  private checkFontCoverage(
    base: Project | null | undefined,
    mapping: Record<string, string>,
    listKeys: Set<string>,
    rowData: GuestData[],
  ): {
    elementId: string;
    fontFamily: string;
    bindingKey?: string;
    missingChars: string[];
    missingCodepoints: number[];
    affectedRecords: number;
    totalRecords: number;
    uyghurFallback: boolean;
  }[] {
    let catalog: { family: string; coverage?: { ranges: string[]; uyghur: boolean } }[] = [];
    try {
      catalog = buildFontCatalog();
    } catch {
      catalog = [];
    }
    const covByFamily = new Map<string, { ranges: string[]; uyghur: boolean }>();
    for (const f of catalog) if (f.coverage) covByFamily.set(f.family, f.coverage);

    const issues: {
      elementId: string;
      fontFamily: string;
      bindingKey?: string;
      missingChars: string[];
      missingCodepoints: number[];
      affectedRecords: number;
      totalRecords: number;
      uyghurFallback: boolean;
    }[] = [];

    const pages = (base as { pages?: { elements?: unknown[] }[] } | null)?.pages ?? [];
    for (const page of pages) {
      for (const el of (page.elements ?? []) as Array<Record<string, unknown>>) {
        if (el.type !== 'text') continue;
        const family = el.fontFamily as string | undefined;
        if (!family) continue;
        const cov = covByFamily.get(family);
        if (!cov) continue; // 系统字体 / 目录未收录 → 无法评估

        // 收集该元素实际会渲染的字符集合
        const chars = new Set<string>();
        const designText = (el.text as string | undefined) ?? '';
        for (const ch of designText) chars.add(ch);
        const bindingKey = (el.binding as { key?: string } | undefined)?.key;
        if (bindingKey) {
          const srcKey = mapping[bindingKey] ?? bindingKey;
          if (listKeys.has(srcKey)) {
            for (const d of rowData) {
              const val = (d as Record<string, unknown>)[srcKey];
              if (typeof val === 'string' && val) for (const ch of val) chars.add(ch);
            }
          }
        }

        if (chars.size === 0) continue;

        // 逐码位校验是否被字体覆盖
        const missing: number[] = [];
        let uyghurGap = false;
        for (const ch of chars) {
          const cp = ch.codePointAt(0);
          if (cp === undefined) continue;
          if (cp < 0x20) continue; // 控制字符不参与字形覆盖判定
          if (this.codepointInRanges(cp, cov.ranges)) continue;
          missing.push(cp);
          if (UYGHUR_SPECIFIC_SET.has(cp)) uyghurGap = true;
        }
        if (missing.length === 0) continue;

        // 受影响记录数（仅对绑定变量有意义）
        let affected = 0;
        if (bindingKey) {
          const srcKey = mapping[bindingKey] ?? bindingKey;
          if (listKeys.has(srcKey) && missing.length) {
            const missSet = new Set(missing);
            for (const d of rowData) {
              const val = (d as Record<string, unknown>)[srcKey];
              if (typeof val === 'string' && val) {
                for (const ch of val) {
                  const cp = ch.codePointAt(0);
                  if (cp !== undefined && missSet.has(cp)) {
                    affected += 1;
                    break;
                  }
                }
              }
            }
          }
        }

        const sample = missing
          .slice(0, 8)
          .map((cp) => (cp >= 0x20 && cp <= 0xffff ? String.fromCharCode(cp) : '?'))
          .filter((c) => c !== '?');
        issues.push({
          elementId: String(el.id),
          fontFamily: family,
          bindingKey,
          missingChars: sample,
          missingCodepoints: missing.slice(0, 32),
          affectedRecords: affected,
          totalRecords: rowData.length,
          uyghurFallback: uyghurGap && !cov.uyghur,
        });
      }
    }
    return issues;
  }

  /** 码位是否落在任一 unicode-range 区间内（coverage.ranges 形如 ["U+4E00-9FFF","U+FA0E"]） */
  private codepointInRanges(cp: number, ranges: string[]): boolean {
    for (const r of ranges) {
      const m = /^U\+([0-9A-Fa-f]+)(?:-([0-9A-Fa-f]+))?$/.exec(r.trim());
      if (!m) continue;
      const lo = parseInt(m[1], 16);
      const hi = m[2] ? parseInt(m[2], 16) : lo;
      if (cp >= lo && cp <= hi) return true;
    }
    return false;
  }

  /**
   * 取名单列定义：columnDefs 非空直接用；为空时从真实记录键推导兜底（S1 前置）。
   * 修复 43% 名单（有真实数据键但 columnDefs 为空）列定义缺失 → 全量变量判缺失、静默丢弃映射。
   */
  private async resolveListColumnDefs(
    list: { columnDefs?: unknown } | null,
    listId: string,
  ): Promise<GuestFieldDef[]> {
    const raw = (list?.columnDefs as unknown as GuestFieldDef[] | undefined) ?? [];
    if (Array.isArray(raw) && raw.length) return raw;
    const rows = await this.prisma.guestRecord.findMany({
      where: { listId, deletedAt: null },
      take: 200,
    });
    return deriveColumnsFromRecords(
      rows as unknown as { data?: Record<string, string | null> | null }[],
    );
  }

  /** 保存变量映射（D4 反转：variableMapping 持久化，仅 DRAFT 可改） */
  async saveMapping(scope: OwnerScope, projectId: string, mapping: Record<string, string>) {
    const p = await this.mustGetProject(scope, projectId);
    const list = await this.prisma.guestList.findUnique({ where: { id: p.listId } });
    const defs = await this.resolveListColumnDefs(list, p.listId);
    const listKeys = new Set(defs.map((d) => d.key));
    const cleaned: Record<string, string> = {};
    for (const [k, target] of Object.entries(mapping ?? {})) {
      if (typeof target === 'string' && target && listKeys.has(target)) cleaned[k] = target;
    }
    const updated = await this.prisma.batchRenderProject.update({
      where: { id: p.id },
      data: { variableMapping: cleaned as never },
    });
    return { projectId: p.id, variableMapping: updated.variableMapping };
  }

  /**
   * 保存生成期画布点选的元素级绑定（D 方案 / S3）。
   * 项目级，不回写模板；runJob 在 personalizeSchema 之前经 applyElementBindings 注入。
   * 与 saveMapping 同理：LOCKED 态仍可改（S4 放开 409），便于锁后重选元素重渲。
   */
  async saveElementBindings(
    scope: OwnerScope,
    projectId: string,
    elementBindings: ElementBindings,
  ) {
    const p = await this.mustGetProject(scope, projectId);
    const cleaned: ElementBindings = {};
    for (const [elId, e] of Object.entries(elementBindings ?? {})) {
      if (e && typeof e.key === 'string' && e.key) {
        const entry: { key: string; name?: string; listField?: string } = { key: e.key };
        if (typeof e.name === 'string' && e.name) entry.name = e.name;
        if (typeof e.listField === 'string' && e.listField) entry.listField = e.listField;
        cleaned[elId] = entry;
      }
    }
    const updated = await this.prisma.batchRenderProject.update({
      where: { id: p.id },
      data: { elementBindings: cleaned as never },
    });
    return { projectId: p.id, elementBindings: updated.elementBindings };
  }
}
