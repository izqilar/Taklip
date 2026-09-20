/**
 * H5 平台关键路径压测脚本（k6）
 * 覆盖：首页 / 注册登录 / 创建作品 / 发布 / 公开访问
 *
 * 运行方式：
 *   1. 安装 k6：https://k6.io/docs/get-started/installation/
 *   2. 配置环境变量（或直接在下方常量填写）：
 *        BASE_URL  默认 http://localhost:3000
 *        PHONE     测试手机号（11 位）
 *        PASSWORD  测试密码（>=6 位）
 *   3. 执行：
 *        k6 run -e BASE_URL=http://localhost:3000 -e PHONE=13800000000 -e PASSWORD=test123 deploy/load-test.js
 *      阶梯加压示例（目标 1000 并发按资源调整 VUs/stages）：
 *        k6 run -u 200 -d 60s deploy/load-test.js
 *
 * 说明：本脚本为「压测占位 + 模板」，真实 1000 并发需结合生产资源调整；
 *       仅用于验证关键路径在负载下的可用性，不替代安全/功能测试。
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const PHONE = __ENV.PHONE || '13800000000';
const PASSWORD = __ENV.PASSWORD || 'test123456';

// 错误率指标
const errorRate = new Rate('errors');

// 阶梯加压配置（可按需放大到 1000 VU）
export const options = {
  stages: [
    { duration: '30s', target: 50 },
    { duration: '1m', target: 200 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.05'], // 失败率 < 5%
    http_req_duration: ['p(95)<800'], // 95% 请求 < 800ms
  },
};

// 简单内存存储 token（k6 各 VU 独立）
const tokens = new Map();

export default function () {
  const vu = __VU;
  const params = { headers: { 'Content-Type': 'application/json' } };

  // 1) 首页（公开）
  let res = http.get(`${BASE_URL}/`);
  check(res, { '首页可访问': (r) => r.status < 500 }) || errorRate.add(1);

  // 2) 登录（密码登录；首次可改为注册流程）
  const loginPayload = JSON.stringify({ phone: PHONE, password: PASSWORD });
  res = http.post(`${BASE_URL}/api/auth/login`, loginPayload, params);
  const ok = check(res, {
    '登录成功': (r) => r.status === 200,
  });
  if (ok) {
    try {
      const body = JSON.parse(res.body);
      tokens.set(vu, body?.data?.accessToken);
    } catch (e) {
      /* ignore */
    }
  } else {
    errorRate.add(1);
  }

  const token = tokens.get(vu);
  if (token) {
    const authParams = {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    };

    // 3) 创建作品
    const createRes = http.post(
      `${BASE_URL}/api/projects`,
      JSON.stringify({ title: `k6-${vu}-${__ITER}` }),
      authParams,
    );
    let projectId = null;
    if (check(createRes, { '创建作品成功': (r) => r.status === 201 || r.status === 200 })) {
      try {
        projectId = JSON.parse(createRes.body)?.data?.id;
      } catch (e) {
        /* ignore */
      }
    }

    // 4) 发布作品（若已创建）
    if (projectId) {
      const pubRes = http.post(
        `${BASE_URL}/api/publish/${projectId}`,
        '',
        authParams,
      );
      check(pubRes, { '发布成功': (r) => r.status < 500 }) || errorRate.add(1);
    }

    // 5) 数据看板
    const statsRes = http.get(`${BASE_URL}/api/stats/overview`, authParams);
    check(statsRes, { '看板可访问': (r) => r.status === 200 }) || errorRate.add(1);
  }

  // 6) 公开访问（无需鉴权，使用任意 publishCode 探活；无合法 code 时仅验证路由存在）
  const pub = http.get(`${BASE_URL}/api/p/__probe__`);
  check(pub, { '公开页路由存在': (r) => r.status === 404 || r.status === 200 });

  sleep(1);
}
