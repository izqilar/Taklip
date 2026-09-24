import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { JwtUser } from '../common/types/jwt-user';
import { CreateStaffDto, UpdateStaffDto } from './dto/staff.dto';
import {
  checkFuncPerms,
  staffPermPool,
  staffRoleMetaOf,
  staffRolePool,
  teamRolesOf,
  validDataScope,
  type OrgType,
} from '@h5design/core';

/**
 * 组织内员工（OrgStaff）服务 —— 一表承载 服务商 / 代理商 / 总台 三层。
 *
 * 职责边界：
 *  - 归属隔离：所有查询都带 `{ id, orgType, orgId }`，跨组织 / 跨层拿不到数据
 *  - 白名单校验：`dataScope` 按层白名单、`funcPerms` 按层权限池 + 红线裁剪（文档 §9）
 *  - 契约兼容：`/api/provider/team` 的响应字段仍带 `teamRole`（= staffRole 别名），
 *    前端列表/详情零感知（文档 §4.2）
 *
 * 关联文档：`docs/平台角色边界规范化.md`
 */

/** 对外响应：补 teamRole 别名，与 OrgStaff.staffRole 同源，前端列表/详情零感知（文档 §4.2） */
export interface StaffView {
  id: string;
  orgType: string;
  orgId: string;
  userId: string | null;
  memberNo: string;
  name: string;
  phone: string;
  accountStatus: string;
  serviceType: string | null;
  staffRole: string;
  /** 契约别名 = staffRole（前端列表 / 详情沿用旧字段名） */
  teamRole: string;
  duties: string[];
  funcPerms: string[];
  dataScope: string;
  personality: string | null;
  createdAt: Date;
  updatedAt: Date;
}

type StaffRow = {
  id: string;
  orgType: string;
  orgId: string;
  userId: string | null;
  memberNo: string;
  name: string;
  phone: string;
  accountStatus: string;
  serviceType: string | null;
  staffRole: string;
  duties: string[];
  funcPerms: string[];
  dataScope: string;
  personality: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const toView = (r: StaffRow): StaffView => ({ ...r, teamRole: r.staffRole });

const ACCOUNT_STATUS = ['ACTIVE', 'PENDING', 'DISABLED'];

/**
 * 生成工号 MT-XXXX（本组织内按现有最大编号自增）。
 *
 * ⚠️ `OrgStaff.memberNo` 是**全局唯一**（@unique），而编号是按组织内最大值算的，
 * 因此不同组织会算出同一个号（如服务商已有 MT-1001，代理商新建也算出 MT-1001）
 * → Prisma P2002 → 500。这里在组织内基线之上继续递增，直到全局空闲。
 */
async function nextMemberNo(prisma: PrismaService, orgType: OrgType, orgId: string): Promise<string> {
  const rows = await prisma.orgStaff.findMany({
    where: { orgType, orgId },
    select: { memberNo: true },
  });
  let max = 1000;
  for (const m of rows) {
    const n = parseInt((m.memberNo || '').replace(/\D/g, ''), 10);
    if (!isNaN(n) && n > max) max = n;
  }
  let no = 'MT-' + String(max + 1);
  // 全局唯一兜底：被其它组织占用则继续 +1
  for (let guard = 0; guard < 1000; guard++) {
    const clash = await prisma.orgStaff.findUnique({ where: { memberNo: no }, select: { id: true } });
    if (!clash) return no;
    const n = parseInt(no.replace(/\D/g, ''), 10) || 0;
    no = 'MT-' + String(n + 1);
  }
  // 极端情况下（编号被大量占用）退化为时间戳后缀
  return 'MT-' + Date.now().toString().slice(-6);
}

@Injectable()
export class StaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** 列表（分页） */
  async list(orgType: OrgType, orgId: string, page = 1, pageSize = 20) {
    const p = Math.max(1, Number(page) || 1);
    const ps = Math.min(Math.max(1, Number(pageSize) || 20), 100);
    const where = { orgType, orgId };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.orgStaff.findMany({
        where,
        skip: (p - 1) * ps,
        take: ps,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.orgStaff.count({ where }),
    ]);
    return { items: (rows as StaffRow[]).map(toView), total, page: p, pageSize: ps };
  }

  /** 单条（受 orgType + orgId 双重约束） */
  async one(orgType: OrgType, orgId: string, id: string) {
    const row = (await this.prisma.orgStaff.findFirst({ where: { id, orgType, orgId } })) as StaffRow | null;
    if (!row) throw new NotFoundException('成员不存在或无权操作');
    return toView(row);
  }

  /**
   * 新建。
   * `dataScope` 非法 → 400；`funcPerms` 越权 → 400（不静默丢弃，
   * 否则调用方会误以为授权成功）。
   */
  async create(actor: JwtUser, orgType: OrgType, orgId: string, dto: CreateStaffDto) {
    const name = (dto.name ?? '').toString().trim();
    const phone = (dto.phone ?? '').toString().trim();
    if (!name) throw new BadRequestException('成员姓名必填');
    if (!/^\d{11}$/.test(phone)) throw new BadRequestException('手机号须为 11 位数字');

    const staffRole = ((dto.staffRole ?? dto.teamRole) ?? '').toString().trim();
    if (!staffRole) throw new BadRequestException('岗位必填');

    const accountStatus = ACCOUNT_STATUS.includes(dto.accountStatus ?? '') ? dto.accountStatus! : 'ACTIVE';

    // 数据范围白名单（按层）
    const dataScope = (dto.dataScope ?? '').toString().trim() || 'self';
    if (!validDataScope(orgType, dataScope)) {
      throw new BadRequestException(
        `数据范围不合法：${orgType} 层可选 ${this.scopeHint(orgType)}`,
      );
    }

    // 功能权限池 + 红线裁剪
    const chk = checkFuncPerms(orgType, dto.funcPerms);
    if (!chk.ok) {
      throw new BadRequestException(`功能权限越权：${chk.illegal.join('、')} 不在 ${orgType} 层可分配权限池内`);
    }

    const serviceType = orgType === 'PROVIDER' ? (dto.serviceType ?? '').toString().trim() || null : null;

    // P1（K-07）：邀请绑定已有账号 —— 按手机号匹配存量 User，命中则绑定 userId。
    // 不为员工新建 User（会撞 phone @unique）。未命中则 userId 留空（纯通讯录项，
    // 待对方注册后用 bindUser 补链，见下方 bindUser）。
    const existingUser = await this.prisma.user.findUnique({ where: { phone }, select: { id: true } });

    const baseData = {
      orgType,
      orgId,
      userId: existingUser?.id ?? null,
      name,
      phone,
      accountStatus,
      serviceType,
      staffRole,
      duties: Array.isArray(dto.duties) ? dto.duties.filter((d) => typeof d === 'string') : [],
      funcPerms: chk.value,
      dataScope,
      personality: dto.personality ?? null,
    };

    // 工号 member_no 全局唯一，但按组织内基线自增；历史残留成员可能占用同一编号 → P2002。
    // 对 member_no 冲突重算重试（最多 5 次），仅 phone 冲突为真实业务冲突（直接 400）。
    let created: StaffRow | undefined;
    for (let attempt = 0; attempt < 5; attempt++) {
      const memberNo = await nextMemberNo(this.prisma, orgType, orgId);
      try {
        created = (await this.prisma.orgStaff.create({ data: { ...baseData, memberNo } })) as StaffRow;
        break;
      } catch (e: any) {
        const target = Array.isArray(e?.meta?.target) ? e.meta.target.join(',') : String(e?.meta?.target ?? '');
        if (e?.code === 'P2002' && target.includes('phone')) {
          throw new BadRequestException('该手机号已存在于员工名录');
        }
        if (e?.code === 'P2002' && target.includes('member_no')) {
          continue; // 工号冲突：重算后重试
        }
        throw e;
      }
    }
    if (!created) throw new BadRequestException('工号生成冲突，请稍后重试');
    const view = toView(created);
    await this.audit.log({
      actor,
      action: 'STAFF_CREATE',
      targetType: 'ORG_STAFF',
      targetId: view.id,
      after: {
        name: view.name,
        phone: view.phone,
        accountStatus: view.accountStatus,
        staffRole: view.staffRole,
        dataScope: view.dataScope,
        funcPerms: view.funcPerms,
      },
    });
    return view;
  }

  /** 更新（含停用：accountStatus=DISABLED） */
  async update(actor: JwtUser, orgType: OrgType, orgId: string, id: string, dto: UpdateStaffDto) {
    const cur = (await this.prisma.orgStaff.findFirst({ where: { id, orgType, orgId } })) as StaffRow | null;
    if (!cur) throw new NotFoundException('成员不存在或无权操作');

    const data: Record<string, unknown> = {};

    if (dto.name !== undefined) {
      const v = (dto.name ?? '').toString().trim();
      if (!v) throw new BadRequestException('成员姓名不能为空');
      data.name = v;
    }
    if (dto.phone !== undefined) {
      const v = (dto.phone ?? '').toString().trim();
      if (!/^\d{11}$/.test(v)) throw new BadRequestException('手机号须为 11 位数字');
      data.phone = v;
    }
    if (dto.accountStatus !== undefined) {
      if (!ACCOUNT_STATUS.includes(dto.accountStatus)) throw new BadRequestException('账号状态不合法');
      data.accountStatus = dto.accountStatus;
    }
    if (dto.staffRole !== undefined || dto.teamRole !== undefined) {
      const v = ((dto.staffRole ?? dto.teamRole) ?? '').toString().trim();
      if (!v) throw new BadRequestException('岗位不能为空');
      data.staffRole = v;
    }
    if (dto.serviceType !== undefined && orgType === 'PROVIDER') {
      data.serviceType = (dto.serviceType ?? '').toString().trim() || null;
    }
    if (dto.duties !== undefined) {
      data.duties = Array.isArray(dto.duties) ? dto.duties.filter((d) => typeof d === 'string') : [];
    }
    if (dto.personality !== undefined) data.personality = dto.personality ?? null;

    if (dto.dataScope !== undefined) {
      const v = (dto.dataScope ?? '').toString().trim() || 'self';
      if (!validDataScope(orgType, v)) {
        throw new BadRequestException(`数据范围不合法：${orgType} 层可选 ${this.scopeHint(orgType)}`);
      }
      data.dataScope = v;
    }
    if (dto.funcPerms !== undefined) {
      const chk = checkFuncPerms(orgType, dto.funcPerms);
      if (!chk.ok) {
        throw new BadRequestException(`功能权限越权：${chk.illegal.join('、')} 不在 ${orgType} 层可分配权限池内`);
      }
      data.funcPerms = chk.value;
    }

    const updated = (await this.prisma.orgStaff.update({ where: { id }, data })) as StaffRow;
    const view = toView(updated);
    await this.audit.log({
      actor,
      action: 'STAFF_UPDATE',
      targetType: 'ORG_STAFF',
      targetId: id,
      before: {
        name: cur.name,
        phone: cur.phone,
        accountStatus: cur.accountStatus,
        staffRole: cur.staffRole,
        dataScope: cur.dataScope,
        funcPerms: cur.funcPerms,
      },
      after: {
        name: view.name,
        phone: view.phone,
        accountStatus: view.accountStatus,
        staffRole: view.staffRole,
        dataScope: view.dataScope,
        funcPerms: view.funcPerms,
      },
    });
    return view;
  }

  async remove(actor: JwtUser, orgType: OrgType, orgId: string, id: string) {
    const cur = await this.prisma.orgStaff.findFirst({ where: { id, orgType, orgId } });
    if (!cur) throw new NotFoundException('成员不存在或无权操作');
    await this.audit.log({
      actor,
      action: 'STAFF_REMOVE',
      targetType: 'ORG_STAFF',
      targetId: id,
      before: {
        name: cur.name,
        phone: cur.phone,
        accountStatus: cur.accountStatus,
        staffRole: cur.staffRole,
        orgType: cur.orgType,
        orgId: cur.orgId,
      },
    });
    await this.prisma.orgStaff.delete({ where: { id } });
    return { ok: true };
  }

  /**
   * P1（K-07）：邀请绑定已有账号。
   *
   * 场景：管理员先用手机号「邀请」一名员工（此时该手机号可能尚未注册，userId 为空）；
   * 员工随后自行注册 / 登录后，调用本方法按手机号把已存在的 User 绑到该成员关系上，
   * 使其登录即获得组织上下文（req.user.staff）。
   *
   * 若成员已绑定（userId 非空且匹配）则幂等返回；若目标手机号对应的 User 不存在则抛 400。
   */
  async bindUser(actor: JwtUser, orgType: OrgType, orgId: string, id: string) {
    const cur = (await this.prisma.orgStaff.findFirst({ where: { id, orgType, orgId } })) as StaffRow | null;
    if (!cur) throw new NotFoundException('成员不存在或无权操作');

    const user = await this.prisma.user.findUnique({ where: { phone: cur.phone }, select: { id: true, status: true } });
    if (!user) {
      throw new BadRequestException('该手机号尚未注册账号，无法绑定；请先让成员注册后再绑定');
    }
    // 若账号本身被停用，绑定也无意义（登录会被 jwt.strategy 拒绝），给出明确提示。
    if (user.status === 'DISABLED') {
      throw new BadRequestException('该账号已被停用，无法绑定为员工');
    }

    const updated = (await this.prisma.orgStaff.update({
      where: { id },
      data: { userId: user.id },
    })) as StaffRow;
    const view = toView(updated);
    await this.audit.log({
      actor,
      action: 'STAFF_BIND',
      targetType: 'ORG_STAFF',
      targetId: id,
      before: { userId: cur.userId },
      after: { userId: view.userId },
    });
    return view;
  }

  /**
   * 员工操作时间线（P3 可视化数据层）。
   * 按成员隔离：仅返回 targetType=ORG_STAFF 且 targetId=该成员的记录，
   * 由调用方（三台 console 的 OrgAccess 守卫）保证只查本组织成员。
   */
  async listAudit(id: string, take = 100) {
    return this.prisma.auditLog.findMany({
      where: { targetType: 'ORG_STAFF', targetId: id },
      orderBy: { createdAt: 'desc' },
      take,
    });
  }

  /**
   * 岗位池查询接口（供前端按需拉取，也便于 E2E 断言真值源一致）。
   * 服务商层随 serviceType 联动；代理/总台层为静态池。
   */
  rolePool(orgType: OrgType, serviceType?: string) {
    return {
      orgType,
      serviceType: serviceType ?? null,
      roles: staffRolePool(orgType, serviceType),
      permPool: staffPermPool(orgType),
      providerRoles: orgType === 'PROVIDER' ? teamRolesOf(serviceType) : undefined,
    };
  }

  private scopeHint(orgType: OrgType): string {
    return orgType === 'PROVIDER' ? 'self / service / provider'
      : orgType === 'AGENT' ? 'self / region / agent'
      : 'self / all';
  }

  /* ══════════════════ 加入申请（用户主动入职隧道 · JOIN）══════════════════
   *
   * 与「入驻」（QualificationApplication，由总台 ADMIN 审批、会变更 User.role）区分：
   * 本隧道的申请人**始终是普通用户**，只是获得组织内员工关系（OrgStaff）。
   *
   * 流程：用户 POST /api/user/join-applications → 本组织「团队管理」队列
   *      → 拥有者 accept（生成 OrgStaff，默认岗位来自岗位池首项，细粒度权限留待「员工角色」页编辑）
   *      → 拥有者 reject（填拒绝详情 → 原样投递到用户「业务消息」）
   *
   * 审批粒度：单人审批（目标团队拥有者）—— 决策 4。
   * ═══════════════════════════════════════════════════════════════════════ */

  /** 本组织的申请员工消息队列（默认仅 PENDING，status=ALL 查全部历史） */
  async listJoinQueue(orgType: OrgType, orgId: string, status = 'PENDING') {
    const where =
      status && status !== 'ALL' ? { orgType, orgId, status } : { orgType, orgId };
    const rows = await this.prisma.teamJoinApplication.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        user: { select: { id: true, nickname: true, realName: true, phone: true, avatar: true, role: true } },
      },
    });
    return {
      items: rows.map((r) => ({ ...r, code: joinAppCode(r.createdAt, r.id) })),
      total: rows.length,
    };
  }

  /** 单条申请（受组织归属约束） */
  async oneJoin(orgType: OrgType, orgId: string, id: string) {
    const app = await this.prisma.teamJoinApplication.findFirst({
      where: { id, orgType, orgId },
      include: {
        user: { select: { id: true, nickname: true, realName: true, phone: true, avatar: true, role: true } },
      },
    });
    if (!app) throw new NotFoundException('申请不存在或无权操作');
    return { ...app, code: joinAppCode(app.createdAt, app.id) };
  }

  /**
   * 接收：把申请转为团队成员档案。
   * 默认岗位 = 该层岗位池首项（服务商层随 serviceType 联动），并带出岗位模板的
   * 默认职责 / 功能权限 / 数据范围；拥有者可传 staffRole 覆盖，细粒度权限随后在
   * 「员工角色」页编辑 —— 决策 3（定岗在审批侧）。
   */
  async acceptJoin(
    actor: JwtUser,
    orgType: OrgType,
    orgId: string,
    orgName: string,
    id: string,
    opts?: { staffRole?: string; serviceType?: string },
  ) {
    const app = await this.prisma.teamJoinApplication.findFirst({ where: { id, orgType, orgId } });
    if (!app) throw new NotFoundException('申请不存在或无权操作');
    if (app.status !== 'PENDING') throw new BadRequestException('该申请已处理，无法重复操作');

    const applicant = await this.prisma.user.findUnique({
      where: { id: app.userId },
      select: { id: true, nickname: true, realName: true, phone: true, status: true, role: true },
    });
    if (!applicant) throw new NotFoundException('申请人账号不存在');
    if (applicant.status === 'DISABLED') throw new BadRequestException('该账号已被停用，无法接收');

    const existed = await this.prisma.orgStaff.findFirst({
      where: { orgType, orgId, userId: applicant.id },
      select: { id: true, memberNo: true },
    });
    if (existed) throw new BadRequestException('该用户已是本团队成员');

    const serviceType = orgType === 'PROVIDER' ? (opts?.serviceType ?? '').toString().trim() || null : null;
    const rolePool = staffRolePool(orgType, serviceType);
    // 默认岗位（决策 3：定岗在审批侧）。取「执行专员」这类最小权限内置岗位作为兜底，
    // 避免直接套用「负责人」（该岗位默认带全量权限 + provider 数据范围）造成默认越权；
    // 随后由拥有者在「员工角色」页按实际情况调整。
    const defaultRole = ['执行专员', '客服专员'].find((r) => rolePool.includes(r)) ?? rolePool[0] ?? '成员';
    const staffRole = (opts?.staffRole ?? '').toString().trim() || defaultRole;
    if (!staffRole) throw new BadRequestException('岗位不能为空');
    const meta = staffRoleMetaOf(orgType, staffRole);
    const chk = checkFuncPerms(orgType, meta?.perms ?? []);
    const dataScope =
      meta?.dataScope && validDataScope(orgType, meta.dataScope) ? meta.dataScope : 'self';

    let created: StaffRow | undefined;
    for (let attempt = 0; attempt < 5; attempt++) {
      const memberNo = await nextMemberNo(this.prisma, orgType, orgId);
      try {
        created = (await this.prisma.orgStaff.create({
          data: {
            orgType,
            orgId,
            userId: applicant.id,
            memberNo,
            name: applicant.realName || applicant.nickname || '未命名成员',
            phone: applicant.phone ?? '',
            accountStatus: 'ACTIVE',
            serviceType,
            staffRole,
            duties: meta?.duties ?? [],
            funcPerms: chk.value,
            dataScope,
            // 用户自述的申请说明落到「特长 / 画像」，便于拥有者后续调整岗位时参考
            personality: app.reason,
          },
        })) as StaffRow;
        break;
      } catch (e: any) {
        const target = Array.isArray(e?.meta?.target) ? e.meta.target.join(',') : String(e?.meta?.target ?? '');
        if (e?.code === 'P2002' && target.includes('member_no')) continue;
        throw e;
      }
    }
    if (!created) throw new BadRequestException('工号生成冲突，请稍后重试');

    await this.prisma.teamJoinApplication.update({
      where: { id: app.id },
      data: { status: 'APPROVED', reviewerId: actor.id, reviewedAt: new Date(), staffId: created.id },
    });

    await this.audit.log({
      actor,
      action: 'JOIN_ACCEPT',
      targetType: 'ORG_STAFF',
      targetId: created.id,
      after: {
        fromApplication: app.id,
        userId: applicant.id,
        staffRole,
        dataScope,
        accountStatus: 'ACTIVE',
      },
    });

    await this.notifyJoinResult(
      actor,
      applicant.id,
      '加入团队申请已通过',
      `您申请加入「${orgName}」已通过，当前岗位：${staffRole}。请登录后在个人中心查看团队信息。`,
    );

    return toView(created);
  }

  /** 拒绝：必填拒绝详情，内容原样以业务消息投递给申请人 */
  async rejectJoin(
    actor: JwtUser,
    orgType: OrgType,
    orgId: string,
    orgName: string,
    id: string,
    reviewNote: string,
  ) {
    const note = (reviewNote ?? '').toString().trim();
    if (!note) throw new BadRequestException('请填写拒绝详情');

    const app = await this.prisma.teamJoinApplication.findFirst({ where: { id, orgType, orgId } });
    if (!app) throw new NotFoundException('申请不存在或无权操作');
    if (app.status !== 'PENDING') throw new BadRequestException('该申请已处理，无法重复操作');

    const updated = await this.prisma.teamJoinApplication.update({
      where: { id: app.id },
      data: { status: 'REJECTED', reviewerId: actor.id, reviewedAt: new Date(), reviewNote: note },
    });

    await this.audit.log({
      actor,
      action: 'JOIN_REJECT',
      targetType: 'TEAM_JOIN_APPLICATION',
      targetId: app.id,
      after: { userId: app.userId, status: 'REJECTED', reviewNote: note },
    });

    await this.notifyJoinResult(
      actor,
      app.userId,
      '加入团队申请未通过',
      `您申请加入「${orgName}」未通过。拒绝详情：${note}`,
    );

    return updated;
  }

  /**
   * 申请回执：以「指定接收人」消息投递（MessageScope=USER），
   * 用户在 web 端「业务消息」详情页可见，且与 messagePending 角标口径一致。
   */
  private async notifyJoinResult(actor: JwtUser, userId: string, title: string, content: string) {
    await this.prisma.message.create({
      data: {
        type: 'NOTICE',
        scope: 'USER',
        title,
        content,
        status: 'PUBLISHED',
        authorId: actor.id,
        authorRole: actor.role as any,
        recipientId: userId,
      },
    });
  }
}

/** 加入申请业务编号 JA-YYYYMMDD-XXXX（沿用控制台编号风格，仅展示用） */
function joinAppCode(createdAt: Date, id: string): string {
  const d = new Date(createdAt);
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `JA-${ymd}-${(id || '').slice(-4).toUpperCase()}`;
}
