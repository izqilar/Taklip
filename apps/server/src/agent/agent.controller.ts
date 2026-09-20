import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { AgentService } from './agent.service';
import { CreateAgentDto, UpdateAgentDto, UpdateAgentRegionDto } from './dto/agent.dto';

@Controller('api/admin')
@UseGuards(AuthGuard('jwt'))
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  /** 代理商列表 */
  @Get('agents')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  listAgents() {
    return this.agentService.listAgents();
  }

  /** 单个代理商详情（供前台改辖区页回填） */
  @Get('agents/:id')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  getAgent(@Param('id') id: string) {
    return this.agentService.getAgent(id);
  }

  /** 新建代理商并绑定辖区 */
  @Post('agents')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  createAgent(@Body() dto: CreateAgentDto) {
    return this.agentService.createAgent(dto);
  }

  /** 修改代理商辖区 */
  @Patch('agents/:id/region')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  updateRegion(@Param('id') id: string, @Body() dto: UpdateAgentRegionDto) {
    return this.agentService.updateAgentRegion(id, dto);
  }

  /** 管理员全量编辑代理商（对齐 UI 原型「编辑」弹窗） */
  @Patch('agents/:id')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  updateAgent(@Param('id') id: string, @Body() dto: UpdateAgentDto) {
    return this.agentService.updateAgent(id, dto);
  }
}
