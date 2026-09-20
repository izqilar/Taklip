import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';

@Injectable()
export class AssetService {
  constructor(private readonly prisma: PrismaService) {}

  async upload(
    file: Express.Multer.File,
    userId: string,
    meta?: { width?: number; height?: number },
  ) {
    const fileType = this.getFileType(file.mimetype);

    // 优先使用前端读取到的真实图片尺寸（随上传请求携带）。
    // 后端若后续安装 sharp / image-size 等库，可在此兜底二次校验。
    const dimensions: { width?: number; height?: number } = {};
    if (meta?.width && meta.width > 0) dimensions.width = Math.round(meta.width);
    if (meta?.height && meta.height > 0) dimensions.height = Math.round(meta.height);

    const url = `/uploads/${file.filename}`;

    return this.prisma.asset.create({
      data: {
        userId,
        url,
        type: fileType,
        size: file.size,
        ...dimensions,
      },
    });
  }

  async findAll(userId: string, type?: string) {
    return this.prisma.asset.findMany({
      where: {
        userId,
        ...(type ? { type } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async remove(id: string, userId: string) {
    const asset = await this.prisma.asset.findUnique({ where: { id } });
    if (!asset) throw new NotFoundException('Asset not found');
    if (asset.userId !== userId) throw new ForbiddenException('Not your asset');

    // Delete file from disk
    const filePath = join(process.cwd(), 'uploads', asset.url.replace('/uploads/', ''));
    if (existsSync(filePath)) {
      try {
        unlinkSync(filePath);
      } catch {
        // Ignore file deletion errors
      }
    }

    return this.prisma.asset.delete({ where: { id } });
  }

  private getFileType(mimetype: string): string {
    if (mimetype.startsWith('image/')) return 'image';
    if (mimetype.startsWith('video/')) return 'video';
    if (mimetype.startsWith('audio/')) return 'audio';
    return 'file';
  }
}
