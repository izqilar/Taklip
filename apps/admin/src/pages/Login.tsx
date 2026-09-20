import { useState } from 'react';
import { Form, Input, Button, Alert } from 'antd';
import { useLogin } from '@refinedev/core';
import { T } from '../config/theme';
import { BRAND } from '../config/theme';
import { t } from '../i18n/t';
import { roleText } from '../config/labels';

/**
 * 登录页（原型 .login 基调：暖石底 + 单栏面板）。
 *
 * 统一登录入口：
 * - ADMIN / AGENT / SERVICE_PROVIDER —— 按服务端 ROLE_HOME 给的落点进入各自视角工作台；
 * - 终端用户（USER）—— 账号密码没错，只是走错了门：**不提示、不留运营端会话**，
 *   直接把登录态桥接给 web 端（:5173）并立即前往其个人中心。
 * - 其余无运营端权限的账号 —— 保留错误提示（err）。
 */
export function Login() {
  const [form] = Form.useForm();
  const { mutate: login, isLoading } = useLogin();
  /** 仅在需要用户知晓时展示（终端用户已直接桥接，不会走到这里） */
  const [err, setErr] = useState<string | null>(null);

  const onFinish = (values: { phone: string; password: string }) => {
    setErr(null);
    login(values, {
      // 注意：authProvider 返回 { success:false, error } 时 mutation 仍然 resolve，
      // Refine 走 onSuccess 分支（onError 仅在抛错时触发），故失败态需在此判定。
      onSuccess: (data: any) => {
        // 终端用户：带登录态静默前往 web 端个人中心（replace 避免回退再触发一次登录）
        const bridge: string | undefined = data?.error?.bridge;
        if (bridge) {
          window.location.replace(bridge);
          return;
        }
        if (data?.success === false) {
          setErr(data?.error?.message || t('pages.toast.loginFailed'));
        }
      },
      onError: (e: any) => {
        const bridge: string | undefined = e?.error?.bridge;
        if (bridge) {
          window.location.replace(bridge);
          return;
        }
        setErr(e?.error?.message || e?.message || t('pages.toast.loginFailed'));
      },
    });
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: T.page,
        padding: 24,
      }}
    >
      <div
        style={{
          width: 380,
          background: T.bg,
          border: '1px solid ' + T.border,
          borderRadius: 14,
          padding: '28px 28px 24px',
        }}
      >
        {/* 品牌区：与侧栏同款渐变 mark + 分色字 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 9,
              background: `linear-gradient(135deg, ${BRAND.markFrom}, ${BRAND.markTo})`,
              color: T.onAccent,
              fontSize: 15,
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 'none',
            }}
          >
            庆
          </div>
          <div style={{ fontSize: 20, fontWeight: 750, color: T.ink1, letterSpacing: 0.5 }}>
            庆柬
            <span style={{ color: BRAND.gold }}>云</span>
          </div>
        </div>
        <div style={{ fontSize: 13, color: T.ink3, marginBottom: 22 }}>
          {t('pages.login.subtitle', '运营管理平台 · 管理员 / 代理商 / 服务商')}
        </div>

        {err && (
          <Alert
            type="error"
            message={err}
            style={{ marginBottom: 16 }}
            showIcon
            closable
            onClose={() => setErr(null)}
          />
        )}

        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          initialValues={{ phone: '13800000002', password: 'dev123456' }}
          requiredMark={false}
        >
          <Form.Item
            label={t('pages.col.phone')}
            name="phone"
            rules={[{ required: true, message: '请输入手机号' }]}
            style={{ marginBottom: 16 }}
          >
            <Input size="large" placeholder={t('pages.col.adminPhone')} />
          </Form.Item>
          <Form.Item
            label={t('pages.field.password')}
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
            style={{ marginBottom: 20 }}
          >
            <Input.Password size="large" placeholder={t('pages.field.password')} />
          </Form.Item>
          <Button type="primary" htmlType="submit" block size="large" loading={isLoading}>
            {t('pages.login.submit', '登录')}
          </Button>
        </Form>

        <div
          style={{
            marginTop: 18,
            paddingTop: 14,
            borderTop: '1px solid ' + T.border,
            fontSize: 12,
            color: T.ink3,
            lineHeight: 1.9,
          }}
        >
          <div>{t('pages.login.hint', '演示账号')}</div>
          <div>{roleText('ADMIN')} 13800000002 / dev123456</div>
          <div>{roleText('AGENT')} 13900003001 / Test123456</div>
          <div>{roleText('SERVICE_PROVIDER')} 13800000001 / dev123456</div>
        </div>
      </div>
    </div>
  );
}
