import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ProjectService } from './project.service';
import { CreateProjectDto, UpdateProjectDto } from './dto/create-project.dto';

type AuthedRequest = Express.Request & {
  user: { id: string };
};

@Controller('api/projects')
@UseGuards(AuthGuard('jwt'))
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  @Post()
  create(@Body() dto: CreateProjectDto, @Req() req: AuthedRequest) {
    return this.projectService.create(req.user.id, dto);
  }

  @Get()
  findAll(@Req() req: AuthedRequest) {
    return this.projectService.findAll(req.user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.projectService.findOne(id, req.user.id);
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
