import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { join } from 'path';
import { mkdirSync } from 'fs';
import { PublishService } from './publish/publish.service';
import { buildOgHtml, CRAWLER_UA_RE } from './publish/og.util';
import { resolveFontsDir, FONTS_URL_PREFIX } from './common/font-dirs';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // 安全：在反向代理 / 负载均衡后部署时启用，使 req.ip 解析为真实客户端地址，
  // 否则限流守卫（rate-limit.guard）取到的 IP 失真，按真实客户端的限流将失效（审查 M4）。
  // 本地直连（无代理）时该设置无副作用；生产建议改为可信代理的精确 IP/网段。
  app.set('trust proxy', 1);

  // CORS：显式源白名单，禁止默认反射任意 Origin（审查 L1）。
  // 默认包含本地三端开发源；生产通过 CORS_ORIGINS 环境变量覆盖（逗号分隔）。
  const defaultOrigins = ['http://localhost:5173', 'http://localhost:5174'];
  const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean)
    : defaultOrigins;
  app.enableCors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  // 调高 JSON 请求体上限（默认 100kb）。模板提交会把 html-to-image 生成的封面 base64
  // 与完整作品 Schema 一并 POST，常规 H5 页面极易超过 100kb 触发 413，导致前端误报
  // “提交模板失败”。素材上传走独立 multer 通道（30MB），不受影响。
  app.useBodyParser('json', { limit: '10mb' });
  app.useBodyParser('urlencoded', { limit: '10mb', extended: true });

  // 安全响应头：防点击劫持（X-Frame-Options）、防 MIME 嗅探（nosniff）、
  // 限制资源加载来源（CSP）。前端（编辑器/发布页）由独立源提供，不受此 CSP 影响。
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; img-src 'self' data:; frame-ancestors 'none'",
    );
    next();
  });

  // 结构化访问日志：仅记录方法/路径/状态码/耗时，不记录请求体，避免敏感信息泄露
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      // eslint-disable-next-line no-console
      console.log(
        `[${req.method}] ${req.originalUrl} -> ${res.statusCode} (${Date.now() - start}ms)`,
      );
    });
    next();
  });

  // Ensure uploads directory exists
  // 服务端 OG 渲染：社交/IM 爬虫（微信/QQ/Telegram 等）访问 /p/:publishCode 时返回 OG HTML。
  // 浏览器请求由前端 SPA 处理，生产环境应由代理层按 UA 将爬虫请求分流到本服务。
  app.use(async (req, res, next) => {
    const match = req.method === 'GET' ? req.path.match(/^\/p\/([a-f0-9]{8})$/) : null;
    if (match && CRAWLER_UA_RE.test(req.get('user-agent') || '')) {
      try {
        const publishCode = match[1];
        const meta = await app.get(PublishService, { strict: false }).getOgMeta(publishCode);
        const origin = `${req.protocol}://${req.get('host')}`;
        const image = meta.image?.startsWith('http')
          ? meta.image
          : meta.image
            ? `${origin}${meta.image}`
            : undefined;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(
          buildOgHtml({
            title: meta.title,
            description: meta.description,
            image,
            url: `${origin}/p/${publishCode}`,
          }),
        );
        return;
      } catch {
        return next();
      }
    }
    next();
  });

  const uploadsDir = join(process.cwd(), 'uploads');
  try {
    mkdirSync(uploadsDir, { recursive: true });
  } catch {
    // Directory may already exist
  }
  app.useStaticAssets(uploadsDir, { prefix: '/uploads/' });

  // 字体目录单独挂一次：字体素材可能放在「项目根 uploads/fonts」（便于随仓库管理），
  // 而进程 cwd 是 apps/server，上面那条 /uploads/ 指向的是 apps/server/uploads，
  // 访问不到根目录的字体。这里把 resolveFontsDir() 命中的目录再挂到同一前缀下，
  // 使 /uploads/fonts/** 无论素材放哪都能取到。
  const fontsDir = resolveFontsDir();
  if (fontsDir !== join(uploadsDir, 'fonts')) {
    app.useStaticAssets(fontsDir, { prefix: FONTS_URL_PREFIX });
  }

  // 静态资源目录：系统预置的背景音乐等（public/music/*.wav 经 /public/ 访问）
  const publicDir = join(process.cwd(), 'public');
  try {
    mkdirSync(publicDir, { recursive: true });
  } catch {
    // Directory may already exist
  }
  app.useStaticAssets(publicDir, { prefix: '/public/' });

  // 注意：不可开启 whitelist/transform。
  // 作品 DTO（CreateProjectDto/UpdateProjectDto）的 schema 是编辑器的任意 JSON 工程数据，
  // 没有 class-validator 装饰器；若开启 whitelist 会被整体剥离，开启 transform 会被
  // class-transformer 递归改造导致嵌套结构（elements 等）丢失。鉴权 DTO 自带装饰器，
  // 关掉 transform 后仍能正常校验。
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: false,
      transform: false,
      forbidNonWhitelisted: false,
    }),
  );
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`🚀 H5 API server running on http://localhost:${port}`);
}
bootstrap();
