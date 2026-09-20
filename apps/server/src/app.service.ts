import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getInfo() {
    return {
      name: 'TAKLIP 设计平台 API',
      version: '0.1.0',
      docs: '/docs',
    };
  }
}
