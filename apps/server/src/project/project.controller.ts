import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ProjectService } from './project.service';
import { CreateProjectDto, UpdateProjectDto } from './dto/create-project.dto';

type AuthedRequest = Express.Request & {
  user: { id: string; role?: string };
};

/** 视察视角作用域解析（与 invitation / guest-list 的 subjectId 口径一致）：
 *  ADMIN 在「用户视角」监督某终端用户时携带 ?subject=<被视察用户id>，以该用户身份读其作品；
 *  其余角色忽略 subject 走自身 JWT 身份。 */
const subjectId = (req: AuthedRequest, subject?: string) =>
  subject && req.user.role === 'ADMIN' ? subject : req.user.id;

@Controller('api/projects')
@UseGuards(AuthGuard('jwt'))
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  @Post()
  create(@Body() dto: CreateProjectDto, @Req() req: AuthedRequest) {
    return this.projectService.create(req.user.id, dto);
  }

  @Get()
  findAll(@Req() req: AuthedRequest, @Query('subject') subject?: string) {
    return this.projectService.findAll(subjectId(req, subject));
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: AuthedRequest, @Query('subject') subject?: string) {
    return this.projectService.findOne(id, subjectId(req, subject));
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
    @Req() req: AuthedRequest,
  ) {
    return this.projectService.update(id, req.user.id, dto);
  }

  /** 保存草稿（方案 A draft/live）—— 仅写 draftSchema，不动线上 schema */
  @Put(':id/draft')
  saveDraft(
    @Param('id') id: string,
    @Body() dto: { schema?: any; title?: string; snapshot?: boolean },
    @Req() req: AuthedRequest,
  ) {
    return this.projectService.saveDraft(id, req.user.id, dto);
  }

  @Get(':id/versions')
  listVersions(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.projectService.listVersions(id, req.user.id);
  }

  @Post(':id/versions/:versionId/rollback')
  rollback(
    @Param('id') id: string,
    @Param('versionId') versionId: string,
    @Req() req: AuthedRequest,
  ) {
    return this.projectService.rollback(id, req.user.id, versionId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.projectService.remove(id, req.user.id);
  }
}
