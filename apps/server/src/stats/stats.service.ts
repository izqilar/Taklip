import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface ProjectStat {
  id: string;
  title: string;
  status: string;
  viewCount: number;
  publishCode: string | null;
  updatedAt: Date;
}

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  /** 数据看板总览：浏览量 / 作品数 / 发布数 / 模板数 */
  async overview(userId: string) {
    const [totalProjects, publishedProjects, totalTemplates, viewsAgg] =
      await Promise.all([
        this.prisma.project.count({ where: { userId } }),
        this.prisma.project.count({ where: { userId, status: 'published' } }),
        this.prisma.template.count(),
        this.prisma.project.aggregate({
          where: { userId, status: 'published' },
          _sum: { viewCount: true },
        }),
      ]);

    return {
      totalProjects,
      publishedProjects,
      totalTemplates,
      totalViews: viewsAgg._sum.viewCount ?? 0,
    };
  }

  /** 当前用户每个作品的访问量明细 */
  async projects(userId: string): Promise<ProjectStat[]> {
    return this.prisma.project.findMany({
      where: { userId },
      select: {
        id: true,
        title: true,
        status: true,
        viewCount: true,
        publishCode: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
    });
  }
}
