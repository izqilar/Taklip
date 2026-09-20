import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface RegionNode {
  id: string;
  code: string;
  name: string;
  level: number;
  parentId: string | null;
  regionPath: string | null;
  children: RegionNode[];
}

@Injectable()
export class RegionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 构建省/市/区三级行政区划树（国标 GB/T 2260，P0 已种子）。
   * 返回嵌套结构，供管理后台 Cascader / TreeSelect 选择代理商辖区使用。
   * 数据量约 3351 条，单次全量构建可接受；如需分页可后续加按需接口。
   */
  async getTree(): Promise<RegionNode[]> {
    const rows = await this.prisma.region.findMany({
      select: { id: true, code: true, name: true, level: true, parentId: true, regionPath: true },
      orderBy: [{ level: 'asc' }, { code: 'asc' }],
    });

    const map = new Map<string, RegionNode>();
    for (const r of rows) {
      map.set(r.id, { ...r, children: [] });
    }

    const roots: RegionNode[] = [];
    for (const node of map.values()) {
      if (node.parentId && map.has(node.parentId)) {
        map.get(node.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }
    return roots;
  }

  /** 按 id 取单条区域（含 name/regionPath），用于校验代理商辖区合法性 */
  async getById(id: string) {
    return this.prisma.region.findUnique({
      where: { id },
      select: { id: true, code: true, name: true, level: true, regionPath: true },
    });
  }

  /**
   * 根据 regionPath（code 链，如 65/6501/650103）解析为区域名称路径
   * 用于管理后台列表直接展示“省 / 市 / 区”名称，避免前端再次查树。
   */
  async getNamePathByCodePath(regionPath: string | null): Promise<string | null> {
    if (!regionPath) return null;
    const codes = regionPath.split('/').filter(Boolean);
    if (!codes.length) return null;
    const rows = await this.prisma.region.findMany({
      where: { code: { in: codes } },
      select: { code: true, name: true, level: true },
      orderBy: { level: 'asc' },
    });
    if (!rows.length) return null;
    return rows.map((r) => r.name).join(' / ');
  }
}
