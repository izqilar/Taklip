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
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { GuestListService } from './guest-list.service';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import type { JwtUser } from '../common/types/jwt-user';

type AuthedRequest = Express.Request & { user: JwtUser };

/** 视察视角作用域解析（对标 invitation / provider-console 的 subjectId）：
 *  ADMIN 在「用户视角」监督某终端用户时携带 subject=<被视察用户id>，以该用户 SELF 作用域读写；
 *  其余角色忽略 subject 走自身 JWT 身份。AGENT 仍按 §16.6 的 PII 保护口径拒绝（@Roles 不含 AGENT）。 */
const subjectId = (req: AuthedRequest, subject?: string) =>
  subject && req.user.role === 'ADMIN' ? subject : req.user.id;

/** 名单导入单文件上限 8MB（名单体积远小于此，留足余量） */
const MAX_IMPORT_BYTES = 8 * 1024 * 1024;

/**
 * 人员名单接口（规范 §9 / §10）
 *
 * 权限边界（§16.6）：仅 `USER`（自营）与 `SERVICE_PROVIDER`（代客/自营，含其员工）可用；
 * AGENT/ADMIN 无名单读写权（PII 保护，仅见聚合计数）。
 * 越权与不存在一律 404，不暴露存在/归属。
 */
@Controller('api/guest-lists')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class GuestListController {
  constructor(private readonly svc: GuestListService) {}

  /** 归属作用域解析：SP 可带 ?ownerType=CLIENT|ORG&clientId=xxx 进入组织/客户域；
   *  ADMIN 监督窗口携带 subject 时把 userId 改写为被视察用户，使其 SELF 作用域等价该用户登录。 */
  private scope(req: AuthedRequest, ownerType?: string, clientId?: string, subject?: string) {
    return this.svc.resolveScope(this.effUser(req, subject), ownerType, clientId, subject);
  }

  /** 作用域主体：ADMIN 持 subject 时等价于该用户自己登录（模板等按用户维度归属的接口用） */
  private effUser(req: AuthedRequest, subject?: string): JwtUser {
    return subject && req.user.role === 'ADMIN' ? { ...req.user, id: subject } : req.user;
  }

  /* ────────── §9.1 模板下载（必须在 :id 路由之前声明） ────────── */

  @Get('template/schema')
  @Roles('USER', 'SERVICE_PROVIDER')
  templateSchema() {
    return this.svc.templateSchema();
  }

  @Get('template')
  @Roles('USER', 'SERVICE_PROVIDER', 'ADMIN')
  async downloadTemplate(
    @Req() req: AuthedRequest,
    @Res() res: Response,
    @Query('format') format: string,
    @Query('templateId') templateId?: string,
    @Query('ownerType') ownerType?: string,
    @Query('clientId') clientId?: string,
    @Query('subject') subject?: string,
  ) {
    const defs = templateId
      ? await this.svc.templateFieldsById(this.effUser(req, subject), templateId)
      : await this.svc.getFieldDesign(this.scope(req, ownerType, clientId, subject));
    const fmt = (format || 'xlsx').toLowerCase();
    if (fmt === 'csv') {
      const buf = this.svc.buildTemplateCsv(defs);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="guest-template.csv"');
      res.setHeader('Content-Length', String(buf.length));
      res.end(buf);
      return;
    }
    if (fmt === 'xlsx') {
      const buf = this.svc.buildTemplateXlsx(defs);
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader('Content-Disposition', 'attachment; filename="guest-template.xlsx"');
      res.setHeader('Content-Length', String(buf.length));
      res.end(buf);
      return;
    }
    throw new BadRequestException({ code: 'BAD_FORMAT', message: '仅支持 csv|xlsx' });
  }

  /* ────────── §9.1b 字段设计（可填写字段的增删改 + 保存） ────────── */

  @Get('field-design')
  @Roles('USER', 'SERVICE_PROVIDER', 'ADMIN')
  async getFieldDesign(
    @Req() req: AuthedRequest,
    @Query('ownerType') ownerType?: string,
    @Query('clientId') clientId?: string,
    @Query('subject') subject?: string,
  ) {
    return { fields: await this.svc.getFieldDesign(this.scope(req, ownerType, clientId, subject)) };
  }

  @Put('field-design')
  @Roles('USER', 'SERVICE_PROVIDER', 'ADMIN')
  async saveFieldDesign(
    @Req() req: AuthedRequest,
    @Body() body: { fields?: unknown },
    @Query('ownerType') ownerType?: string,
    @Query('clientId') clientId?: string,
    @Query('subject') subject?: string,
  ) {
    const fields = await this.svc.saveFieldDesign(
      this.scope(req, ownerType, clientId, subject),
      body?.fields,
    );
    return { fields };
  }

  /* ────────── §17 多模板管理（GuestTemplate） ────────── */

  @Get('templates')
  @Roles('USER', 'SERVICE_PROVIDER', 'ADMIN')
  async listTemplates(@Req() req: AuthedRequest, @Query('subject') subject?: string) {
    return { templates: await this.svc.listTemplates(this.effUser(req, subject)) };
  }

  @Post('templates')
  @Roles('USER', 'SERVICE_PROVIDER', 'ADMIN')
  async createTemplate(
    @Req() req: AuthedRequest,
    @Body() body: { name?: string; fields?: unknown; subject?: string },
    @Query('subject') qSubject?: string,
  ) {
    return {
      template: await this.svc.createTemplate(
        this.effUser(req, body?.subject ?? qSubject),
        body?.name ?? '',
        body?.fields,
      ),
    };
  }

  @Get('templates/:id')
  @Roles('USER', 'SERVICE_PROVIDER', 'ADMIN')
  async getTemplate(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Query('subject') subject?: string,
  ) {
    return { template: await this.svc.getTemplate(this.effUser(req, subject), id) };
  }

  @Put('templates/:id')
  @Roles('USER', 'SERVICE_PROVIDER', 'ADMIN')
  async updateTemplate(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() body: { fields?: unknown; subject?: string },
    @Query('subject') qSubject?: string,
  ) {
    return {
      template: await this.svc.updateTemplate(
        this.effUser(req, body?.subject ?? qSubject),
        id,
        body?.fields,
      ),
    };
  }

  @Delete('templates/:id')
  @Roles('USER', 'SERVICE_PROVIDER', 'ADMIN')
  async deleteTemplate(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Query('subject') subject?: string,
  ) {
    await this.svc.deleteTemplate(this.effUser(req, subject), id);
    return { ok: true };
  }

  /* ────────── §9.2 名单 CRUD ────────── */

  @Post()
  @Roles('USER', 'SERVICE_PROVIDER', 'ADMIN')
  async create(
    @Req() req: AuthedRequest,
    @Body() body: { name?: string; ownerType?: string; clientId?: string; templateId?: string; subject?: string },
    @Query('ownerType') qOwnerType?: string,
    @Query('clientId') qClientId?: string,
  ) {
    const scope = this.scope(req, body?.ownerType ?? qOwnerType, body?.clientId ?? qClientId, body?.subject);
    return this.svc.createList(scope, body?.name ?? '', body?.templateId);
  }

  @Get()
  @Roles('USER', 'SERVICE_PROVIDER', 'ADMIN')
  async list(
    @Req() req: AuthedRequest,
    @Query('ownerType') ownerType?: string,
    @Query('clientId') clientId?: string,
    @Query('subject') subject?: string,
  ) {
    return this.svc.listLists(this.scope(req, ownerType, clientId, subject));
  }

  /** 文件导入（可新建名单，也可写入既有名单） */
  @Post('import')
  @Roles('USER', 'SERVICE_PROVIDER', 'ADMIN')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_IMPORT_BYTES, files: 1 },
    }),
  )
  async import(
    @Req() req: AuthedRequest,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { listId?: string; name?: string; mode?: 'append' | 'overwrite'; templateId?: string; ownerType?: string; clientId?: string; subject?: string },
  ) {
    if (!file?.buffer?.length) throw new BadRequestException({ code: 'NO_FILE', message: '请上传名单文件' });
    const scope = this.scope(req, body?.ownerType, body?.clientId, body?.subject);
    return this.svc.importFile(scope, file, {
      listId: body?.listId,
      name: body?.name,
      mode: body?.mode === 'overwrite' ? 'overwrite' : 'append',
      templateId: body?.templateId,
    });
  }

  @Get(':id/records')
  @Roles('USER', 'SERVICE_PROVIDER', 'ADMIN')
  async records(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('size') size?: string,
    @Query('ownerType') ownerType?: string,
    @Query('clientId') clientId?: string,
    @Query('subject') subject?: string,
  ) {
    return this.svc.listRecords(
      this.scope(req, ownerType, clientId, subject),
      id,
      Number(page) || 1,
      Number(size) || 50,
    );
  }

  @Post(':id/records')
  @Roles('USER', 'SERVICE_PROVIDER', 'ADMIN')
  async addRecord(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() body: { data?: unknown; subject?: string },
    @Query('ownerType') ownerType?: string,
    @Query('clientId') clientId?: string,
  ) {
    return this.svc.createRecord(this.scope(req, ownerType, clientId, body?.subject), id, body?.data);
  }

  @Post(':id/records/batch')
  @Roles('USER', 'SERVICE_PROVIDER', 'ADMIN')
  async batch(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() body: { records?: unknown[]; mode?: 'append' | 'overwrite'; subject?: string },
    @Query('ownerType') ownerType?: string,
    @Query('clientId') clientId?: string,
  ) {
    return this.svc.batchRecords(
      this.scope(req, ownerType, clientId, body?.subject),
      id,
      body?.records ?? [],
      body?.mode === 'overwrite' ? 'overwrite' : 'append',
    );
  }

  @Put(':id/records/:rid')
  @Roles('USER', 'SERVICE_PROVIDER', 'ADMIN')
  async updateRecord(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Param('rid') rid: string,
    @Body() body: { data?: unknown; seq?: number; updatedAt?: string; subject?: string },
    @Query('ownerType') ownerType?: string,
    @Query('clientId') clientId?: string,
  ) {
    return this.svc.updateRecord(
      this.scope(req, ownerType, clientId, body?.subject),
      id,
      rid,
      { data: body?.data, seq: body?.seq },
      body?.updatedAt,
    );
  }

  @Delete(':id/records/:rid')
  @Roles('USER', 'SERVICE_PROVIDER', 'ADMIN')
  async removeRecord(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Param('rid') rid: string,
    @Query('ownerType') ownerType?: string,
    @Query('clientId') clientId?: string,
    @Query('subject') subject?: string,
  ) {
    await this.svc.deleteRecord(this.scope(req, ownerType, clientId, subject), id, rid);
  }

  @Get(':id')
  @Roles('USER', 'SERVICE_PROVIDER', 'ADMIN')
  async getOne(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Query('ownerType') ownerType?: string,
    @Query('clientId') clientId?: string,
    @Query('subject') subject?: string,
  ) {
    return this.svc.getList(this.scope(req, ownerType, clientId, subject), id);
  }

  @Put(':id')
  @Roles('USER', 'SERVICE_PROVIDER', 'ADMIN')
  async update(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() body: { name?: string; reorder?: string[]; subject?: string },
    @Query('ownerType') ownerType?: string,
    @Query('clientId') clientId?: string,
  ) {
    return this.svc.updateList(this.scope(req, ownerType, clientId, body?.subject), id, body ?? {});
  }

  @Delete(':id')
  @Roles('USER', 'SERVICE_PROVIDER', 'ADMIN')
  async remove(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Query('ownerType') ownerType?: string,
    @Query('clientId') clientId?: string,
    @Query('subject') subject?: string,
  ) {
    await this.svc.deleteList(this.scope(req, ownerType, clientId, subject), id);
  }
}
