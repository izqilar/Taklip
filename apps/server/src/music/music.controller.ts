import { Controller, Get, NotFoundException } from '@nestjs/common';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/** 系统收集的背景音乐（随仓库内置，存放于 public/music/） */
interface SystemMusic {
  name: string;
  url: string;
  icon: string;
}

@Controller('api/music')
export class MusicController {
  /** 返回平台预置的背景音乐列表（无需登录，公开访问） */
  @Get('system')
  getSystemMusic(): SystemMusic[] {
    const filePath = join(process.cwd(), 'public', 'music', 'system-music.json');
    if (!existsSync(filePath)) {
      throw new NotFoundException('System music list not found');
    }
    const raw = readFileSync(filePath, 'utf-8');
    try {
      return JSON.parse(raw) as SystemMusic[];
    } catch {
      return [];
    }
  }
}
