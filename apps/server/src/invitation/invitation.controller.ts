import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Response } from 'express';
import { InvitationService, type RenderMode } from './invitation.service';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import type { JwtUser } from '../common/types/jwt-user';

type AuthedRequest = Express.Request & { user: JwtUser };

/**
 * 视察视角作用域解析（对标 provider-console / asset 的 subjectId）：
 * ADMIN 在「用户视角」监督某终端用户时携带 ?subject=<被视察用户id>，
 * 此时以该用户的 SELF 作用域查询/操作（等价于该用户自己登录）；
 * 其余角色（USER / SERVICE_PROVIDER）忽略 subject，恒走自身 JWT 身份。
 *
 * 安全边界：仅 ADMIN 可被 subject 改写，AGENT 仍按 §16.6 的 PII 保护口径
 * 拒绝（@Roles 不含 AGENT），防止区域治理越权读取他人名单与渲染产物。
 */
const subjectId = (req: AuthedRequest, subject?: string) =>
  subject && req.user.role === 'ADMIN' ? subject : req.user.id;

/**
 * 批量请柬渲染接口（规范 §8 / §9.3 / §10）
 *
 * 权限边界（§16.6）：
 *  - `USER` 与 `SERVICE_PROVIDER`（含其员工）自身可用；
 *  - `ADMIN` 仅可在「用户视角」监督窗口携带 ?subject=<用户id> 时以该用户作用域读写，
 *    便于总台在用户视角工作台原生查看/代操作其请柬事务（不再依赖 iframe 嵌入 web）；
 *  - `AGENT` 无名单与渲染读写权（PII 保护），越权一律 404。
 */
@Controller('api/invitations')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class InvitationController {
  constructor(private readonly svc: InvitationService) {}

  private scope(req: AuthedRequest, ownerType?: string, clientId?: string, subject?: string) {
    // 复用名单模块的归属解析（单一真值），避免两套角色判定分叉。
    // ADMIN 监督窗口把 userId 改写为被视察对象，使其 SELF 作用域等价该用户登录。
    const effectiveUser = subject && req.user.role === 'ADMIN' ? { ...req.user, id: subject } : req.user;
    // ★ 必须透传 subject 给 resolveScope：guest-list 的 ADMIN+subject+ORG/CLIENT 分支依赖该参数
    //   判定作用域，缺失则 ADMIN 监督窗口对组织/客户域仍抛 FORBIDDEN_OWNER_TYPE 400。
    return this.svc.resolveScope(effectiveUser, ownerType, clientId, subject);
  }

  /* ────────── 项目 ────────── */

  @Post('projects')
  @Roles('USER', 'SERVICE_PROVIDER', 'ADMIN')
  async createProject(
    @Req() req: AuthedRequest,
    @Body()
    body: {
      templateId?: string;
      listId?: string;
      /** 可选：显式复用既有项目（换名单/追加名单场景，避免新建项目导致已购人次作废） */
      projectId?: string;
      ownerType?: string;
      clientId?: string;
      subject?: string;
    },
  ) {
    if (!body?.templateId || !body?.listId) {
      throw new BadRequestException({ code: 'INVALID_PARAMS', message: 'templateId 与 listId 必填' });
    }
    return this.svc.createProject(
      this.scope(req, body.ownerType, body.clientId, body.subject),
      body.templateId,
      body.listId,
      body.projectId,
    );
  }

  @Get('projects')
  @Roles('USER', 'SERVICE_PROVIDER', 'ADMIN')
  listProjects(
    @Req() req: AuthedRequest,
    @Query('ownerType') t?: string,
    @Query('clientId') c?: string,
    @Query('subject') subject?: string,
  ) {
    return this.svc.listProjects(this.scope(req, t, c, subject));
  }

  @Get('projects/:id')
  @Roles('USER', 'SERVICE_PROVIDER', 'ADMIN')
  getProject(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Query('ownerType') t?: string,
    @Query('clientId') c?: string,
    @Query('subject') subject?: string,
  ) {
    return this.svc.getProject(this.scope(req, t, c, subject), id);
  }

  /** 模板已绑定的变量 key（供勾选面板提示缺失字段） */
  @Get('projects/:id/bindings')
  @Roles('USER', 'SERVICE_PROVIDER', 'ADMIN')
  bindings(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Query('ownerType') t?: string,
    @Query('clientId') c?: string,
    @Query('subject') subject?: string,
  ) {
    return this.svc.templateBindings(this.scope(req, t, c, subject), id);
  }

  /** 生成期画布点选：返回模板可点选元素列表 + 预览 schema（D 方案） */
  @Get('projects/:id/elements')
  @Roles('USER', 'SERVICE_PROVIDER', 'ADMIN')
  elements(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Query('ownerType') t?: string,
    @Query('clientId') c?: string,
    @Query('subject') subject?: string,
  ) {
    return this.svc.getProjectElements(this.scope(req, t, c, subject), id);
  }

  /** 生成前变量匹配体检（D4 反转：含映射改指向） */
  @Get('projects/:id/health')
  @Roles('USER', 'SERVICE_PROVIDER', 'ADMIN')
  health(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Query('ownerType') t?: string,
    @Query('clientId') c?: string,
    @Query('subject') subject?: string,
  ) {
    return this.svc.getHealth(this.scope(req, t, c, subject), id);
  }

  /** 保存变量映射（D4 反转：variableMapping 持久化） */
  @Put('projects/:id/mapping')
  @Roles('USER', 'SERVICE_PROVIDER', 'ADMIN')
  saveMapping(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() body: { mapping?: Record<string, string>; ownerType?: string; clientId?: string; subject?: string },
  ) {
    return this.svc.saveMapping(this.scope(req, body.ownerType, body.clientId, body.subject), id, body.mapping ?? {});
  }

  @Put('projects/:id/element-bindings')
  @Roles('USER', 'SERVICE_PROVIDER', 'ADMIN')
  saveElementBindings(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body()
    body: {
      elementBindings?: Record<string, { key: string; name?: string; listField?: string }>;
      ownerType?: string;
      clientId?: string;
      subject?: string;
    },
  ) {
    return this.svc.saveElementBindings(
      this.scope(req, body.ownerType, body.clientId, body.subject),
      id,
      (body.elementBindings ?? {}) as never,
    );
  }

  /** 聚合该项目下全部渲染任务的逐人状态（v1.4，§18.3） */
  @Get('projects/:id/results')
  @Roles('USER', 'SERVICE_PROVIDER', 'ADMIN')
  projectResults(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Query('ownerType') t?: string,
    @Query('clientId') c?: string,
    @Query('subject') subject?: string,
  ) {
    return this.svc.projectResults(this.scope(req, t, c, subject), id);
  }

  /** 跨 job 打包该项目指定人员的图片为 Zip（v1.4，§18.4） */
  @Get('projects/:id/download')
  @Roles('USER', 'SERVICE_PROVIDER', 'ADMIN')
  async downloadProjectZip(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Res() res: Response,
    @Query('recordIds') recordIds?: string,
    @Query('ownerType') t?: string,
    @Query('clientId') c?: string,
    @Query('subject') subject?: string,
  ) {
    const ids = recordIds ? recordIds.split(',').map((s) => s.trim()).filter(Boolean) : undefined;
    const buf = await this.svc.zipProject(this.scope(req, t, c, subject), id, ids);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="invitations-${id}.zip"`);
    res.setHeader('Content-Length', String(buf.length));
    res.end(buf);
  }

  /** 删除该项目指定人员的生成记录（v1.4，§18.4） */
  @Delete('projects/:id/results')
  @Roles('USER', 'SERVICE_PROVIDER', 'ADMIN')
  deleteProjectResults(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() body: { recordIds?: string[]; ownerType?: string; clientId?: string; subject?: string },
  ) {
    return this.svc.deleteProjectResults(
      this.scope(req, body.ownerType, body.clientId, body.subject),
      id,
      body.recordIds ?? [],
    );
  }

  /* ────────── §9.3 勾选 ────────── */

  @Get('projects/:id/selection')
  @Roles('USER', 'SERVICE_PROVIDER', 'ADMIN')
  getSelection(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Query('ownerType') t?: string,
    @Query('clientId') c?: string,
    @Query('subject') subject?: string,
  ) {
    return this.svc.getSelection(this.scope(req, t, c, subject), id);
  }

  @Post('projects/:id/selection')
  @Roles('USER', 'SERVICE_PROVIDER', 'ADMIN')
  setSelection(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body()
    body: { listId?: string; selectedRecordIds?: string[]; ownerType?: string; clientId?: string; subject?: string },
  ) {
    if (!body?.listId) throw new BadRequestException({ code: 'INVALID_PARAMS', message: 'listId 必填' });
    return this.svc.setSelection(
      this.scope(req, body.ownerType, body.clientId, body.subject),
      id,
      body.listId,
      body.selectedRecordIds ?? [],
    );
  }

  /** 单独编辑某宾客记录（受「修改上限=总记录数×10%」闸门约束） */
  @Post('projects/:id/records/:recordId/edit')
  @Roles('USER', 'SERVICE_PROVIDER', 'ADMIN')
  editGuestRecord(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Param('recordId') recordId: string,
    @Body() body: { data?: Record<string, unknown>; ownerType?: string; clientId?: string; subject?: string },
  ) {
    return this.svc.editGuestRecordForProject(
      this.scope(req, body.ownerType, body.clientId, body.subject),
      id,
      recordId,
      body.data ?? {},
    );
  }

  /** 候选筛选辅助（按单位 / 桌号 / 性别） */
  @Get('projects/:id/selections/candidates')
  @Roles('USER', 'SERVICE_PROVIDER', 'ADMIN')
  candidates(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Query('unit') unit?: string,
    @Query('table_no') tableNo?: string,
    @Query('gender') gender?: string,
    @Query('ownerType') t?: string,
    @Query('clientId') c?: string,
    @Query('subject') subject?: string,
  ) {
    return this.svc.candidates(this.scope(req, t, c, subject), id, { unit, table_no: tableNo, gender });
  }

  /* ────────── §8 渲染 ────────── */

  @Post('batch-generate')
  @Roles('USER', 'SERVICE_PROVIDER', 'ADMIN')
  batchGenerate(
    @Req() req: AuthedRequest,
    @Body()
    body: {
      projectId?: string;
      mode?: RenderMode;
      targetRecordIds?: string[];
      ownerType?: string;
      clientId?: string;
      subject?: string;
    },
  ) {
    if (!body?.projectId) throw new BadRequestException({ code: 'INVALID_PARAMS', message: 'projectId 必填' });
    return this.svc.batchGenerate(this.scope(req, body.ownerType, body.clientId, body.subject), {
      projectId: body.projectId,
      mode: body.mode,
      targetRecordIds: body.targetRecordIds,
    });
  }

  @Get('jobs')
  @Roles('USER', 'SERVICE_PROVIDER', 'ADMIN')
  listJobs(
    @Req() req: AuthedRequest,
    @Query('projectId') projectId?: string,
    @Query('ownerType') t?: string,
    @Query('clientId') c?: string,
    @Query('subject') subject?: string,
  ) {
    return this.svc.listJobs(this.scope(req, t, c, subject), projectId);
  }

  @Get('jobs/:id')
  @Roles('USER', 'SERVICE_PROVIDER', 'ADMIN')
  getJob(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Query('ownerType') t?: string,
    @Query('clientId') c?: string,
    @Query('subject') subject?: string,
  ) {
    return this.svc.getJob(this.scope(req, t, c, subject), id);
  }

  /** 断点续跑：仅重渲该 job 内失败/缺失的记录（T6） */
  @Post('jobs/:id/resume')
  @Roles('USER', 'SERVICE_PROVIDER', 'ADMIN')
  resumeJob(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() body: { ownerType?: string; clientId?: string; subject?: string },
  ) {
    return this.svc.resumeJob(this.scope(req, body.ownerType, body.clientId, body.subject), id);
  }

  /** 逐人鉴权下载（图落 private-assets，不公开静态暴露） */
  @Get('jobs/:id/files/:recordId')
  @Roles('USER', 'SERVICE_PROVIDER', 'ADMIN')
  async jobFile(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Param('recordId') recordId: string,
    @Res() res: Response,
    @Query('ownerType') t?: string,
    @Query('clientId') c?: string,
    @Query('subject') subject?: string,
  ) {
    const { buffer } = await this.svc.getJobFile(this.scope(req, t, c, subject), id, recordId);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Length', String(buffer.length));
    res.end(buffer);
  }

  /** Zip 打包下载（§7 分发模块） */
  @Get('jobs/:id/download')
  @Roles('USER', 'SERVICE_PROVIDER', 'ADMIN')
  async downloadZip(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Res() res: Response,
    @Query('recordIds') recordIds?: string,
    @Query('ownerType') t?: string,
    @Query('clientId') c?: string,
    @Query('subject') subject?: string,
  ) {
    const ids = recordIds ? recordIds.split(',').map((s) => s.trim()).filter(Boolean) : undefined;
    const buf = await this.svc.zipJob(this.scope(req, t, c, subject), id, ids);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="invitations-${id}.zip"`);
    res.setHeader('Content-Length', String(buf.length));
    res.end(buf);
  }

  /* ────────── §8.3 购买人次（D2：挂项目/客户维度） ────────── */

  @Post('purchase')
  @Roles('USER', 'SERVICE_PROVIDER', 'ADMIN')
  purchase(
    @Req() req: AuthedRequest,
    @Body() body: { projectId?: string; headcount?: number; kind?: 'headcount' | 'rerender'; ownerType?: string; clientId?: string; subject?: string },
  ) {
    if (!body?.projectId) throw new BadRequestException({ code: 'INVALID_PARAMS', message: 'projectId 必填' });
    return this.svc.purchase(
      this.scope(req, body.ownerType, body.clientId, body.subject),
      body.projectId,
      Number(body.headcount) || 0,
      body.kind,
    );
  }

  /**
   * 解锁单条已达重渲上限的记录（小锁 / 「生成」按钮 → 确认解锁）：
   * 消耗 1 个全局剩余额度，把该记录重渲计数重置为 0（恢复满额 5 次机会），
   * **不创建渲染 job、不出图**（用户修正：解锁 ≠ 立即重渲）。
   * 与 RERENDER 超限路径（扣 1 币 + rc=1 + 顺带渲染）语义不同，见 service.unlockRecord。
   */
  @Post('projects/:id/unlock-record')
  @Roles('USER', 'SERVICE_PROVIDER', 'ADMIN')
  unlockRecord(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() body: { recordId?: string; ownerType?: string; clientId?: string; subject?: string },
  ) {
    if (!body?.recordId) throw new BadRequestException({ code: 'INVALID_PARAMS', message: 'recordId 必填' });
    return this.svc.unlockRecord(
      this.scope(req, body.ownerType, body.clientId, body.subject),
      id,
      body.recordId,
    );
  }
}
