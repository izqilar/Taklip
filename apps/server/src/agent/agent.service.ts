import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { RegionService } from '../region/region.service';
import {
  CreateAgentDto,
  UpdateAgentDto,
  UpdateAgentRegionDto,
} from './dto/agent.dto';
import type { Prisma } from '../../prisma/prisma-client';

const SALT_ROUNDS = 10;

const agentSelect = {
  id: true,
  phone: true,
  nickname: true,
  avatar: true,
  role: true,
  status: true,
  regionId: true,
  regionPath: true,
  createdAt: true,
  region: { select: { id: true, code: true, name: true, regionPath: true } },
} as const;

type AgentWithRegion = Prisma.UserGetPayload<{ select: typeof agentSelect }>;

export interface AgentOutput extends AgentWithRegion {
  regionNamePath?: string | null;
  providerCount?: number;
  monthlyTurnoverCents?: number;
}

@Injectable()
export class AgentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly regionService: RegionService,
  ) {}

  /** 为代理商对象附加 regionNamePath（省/市/区名称路径） */
  private async enrichNamePath(agent: AgentWithRegion): Promise<AgentOutput> {
    const regionNamePath = await this.regionService.getNamePathByCodePath(agent.regionPath);
    return { ...agent, regionNamePath };
  }

  /** 当前自然月起止（UTC+8） */
  private monthRange() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
    return { start, end };
  }

  /** 统计代理商辖区内的服务商数 + 当月流水 */
  private async enrichMetrics(agent: AgentOutput): Promise<AgentOutput> {
    if (!agent.regionPath) {
      return { ...agent, providerCount: 0, monthlyTurnoverCents: 0 };
    }
    const prefix = `${agent.regionPath}/%`;
    const exact = agent.regionPath;
    const { start, end } = this.monthRange();

    const [providerAgg, orderAgg] = await Promise.all([
      this.prisma.user.count({
        where: {
          role: 'SERVICE_PROVIDER',
          OR: [
            { regionPath: { startsWith: prefix } },
            { regionPath: exact },
          ],
        },
      }),
      this.prisma.templateOrder.aggregate({
        where: {
          status: 'paid',
          createdAt: { gte: start, lt: end },
          buyer: {
            OR: [
              { regionPath: { startsWith: prefix } },
              { regionPath: exact },
            ],
          },
        },
        _sum: { amount: true },
      }),
    ]);

    return {
      ...agent,
      providerCount: providerAgg,
      monthlyTurnoverCents: orderAgg._sum.amount ?? 0,
    };
  }

  /** 代理商列表（ADMIN 专用） */
  async listAgents() {
    const agents = await this.prisma.user.findMany({
      where: { role: 'AGENT' },
      select: agentSelect,
      orderBy: { createdAt: 'desc' },
    });
    const withPath = await Promise.all(agents.map((a) => this.enrichNamePath(a)));
    return Promise.all(withPath.map((a) => this.enrichMetrics(a)));
  }

  /** 单个代理商详情（ADMIN 专用，供前台弹窗回填） */
  async getAgent(id: string) {
    const agent = await this.prisma.user.findUnique({ where: { id }, select: agentSelect });
    if (!agent || agent.role !== 'AGENT') throw new NotFoundException('代理商不存在');
    const withPath = await this.enrichNamePath(agent);
    return this.enrichMetrics(withPath);
  }

  /** 创建代理商：新建账号并绑定辖区（regionPath 取自区域树） */
  async createAgent(dto: CreateAgentDto) {
    const exist = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
    if (exist) throw new ConflictException('该手机号已注册');

    const region = await this.regionService.getById(dto.regionId);
    if (!region) throw new BadRequestException('所选区域不存在');

    const hashed = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const agent = await this.prisma.user.create({
      data: {
        phone: dto.phone,
        password: hashed,
        nickname: dto.nickname ?? `代理商${dto.phone.slice(-4)}`,
        role: 'AGENT',
        regionId: region.id,
        regionPath: region.regionPath,
      },
      select: agentSelect,
    });
    const withPath = await this.enrichNamePath(agent);
    return this.enrichMetrics(withPath);
  }

  /** 修改代理商辖区（仅改自身 regionId/regionPath，不影响其名下用户） */
  async updateAgentRegion(id: string, dto: UpdateAgentRegionDto) {
    const agent = await this.prisma.user.findUnique({ where: { id } });
    if (!agent) throw new NotFoundException('代理商不存在');
    if (agent.role !== 'AGENT') throw new BadRequestException('该用户不是代理商');

    const region = await this.regionService.getById(dto.regionId);
    if (!region) throw new BadRequestException('所选区域不存在');

    const updated = await this.prisma.user.update({
      where: { id },
      data: { regionId: region.id, regionPath: region.regionPath },
      select: agentSelect,
    });
    const withPath = await this.enrichNamePath(updated);
    return this.enrichMetrics(withPath);
  }

  /** 管理员全量编辑代理商（对齐 UI 原型「编辑」弹窗） */
  async updateAgent(id: string, dto: UpdateAgentDto) {
    const agent = await this.prisma.user.findUnique({ where: { id } });
    if (!agent) throw new NotFoundException('代理商不存在');
    if (agent.role !== 'AGENT') throw new BadRequestException('该用户不是代理商');

    const data: Prisma.UserUpdateInput = {};
    if (dto.nickname !== undefined) data.nickname = dto.nickname;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.status !== undefined) data.status = dto.status;

    if (dto.regionId !== undefined) {
      const region = await this.regionService.getById(dto.regionId);
      if (!region) throw new BadRequestException('所选区域不存在');
      data.region = { connect: { id: region.id } };
      data.regionPath = region.regionPath;
    }

    // 手机号唯一性校验（排除自身）
    if (dto.phone !== undefined && dto.phone !== agent.phone) {
      const exist = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
      if (exist) throw new ConflictException('该手机号已注册');
    }

    const updated = await this.prisma.user.update({ where: { id }, data, select: agentSelect });
    const withPath = await this.enrichNamePath(updated);
    return this.enrichMetrics(withPath);
  }
}
