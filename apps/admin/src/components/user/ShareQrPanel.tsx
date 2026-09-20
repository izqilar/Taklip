/**
 * ShareQrPanel — 运营端「发布后」分享面板（二维码 + 链接 + 复制 + 下载）。
 *
 * 复用于两处：
 *  1. WorkPreviewModal 已发布作品的「线上访问」区域；
 *  2. 作品发布成功后自动弹出的分享弹窗。
 *
 * 二维码编码的是 web 端公开页地址 `${WEB_BASE}/p/<publishCode>`，
 * 微信扫码即在手机端打开最终 H5 效果（生产环境须把 WEB_BASE 配成公网可访问域名）。
 */
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { resolveWebBase, fetchLanInfo } from '../../utility';

interface ShareQrPanelProps {
  publishCode: string;
  title?: string;
  /** 二维码边长（px），默认 200 */
  size?: number;
}

export const ShareQrPanel = ({ publishCode, title, size = 200 }: ShareQrPanelProps) => {
  const [url, setUrl] = useState('');
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [ips, setIps] = useState<string[]>([]);
  const [chosenIp, setChosenIp] = useState('');

  // 动态解析 web 基址：开发期向 admin dev server 的 /__lan_info 取候选 LAN IP；
  // 多网卡时让用户选（ips），否则自动跟随。每 30s 重新探测一次（IP 变化自动跟随）。
  useEffect(() => {
    let alive = true;
    const resolve = async () => {
      const info = await fetchLanInfo();
      if (!alive) return;
      setIps(info.ips);
      const base = await resolveWebBase(chosenIp || undefined);
      if (alive) setUrl(`${base}/p/${publishCode}`);
    };
    resolve();
    const timer = setInterval(resolve, 30000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [publishCode, chosenIp]);

  useEffect(() => {
    if (!url) return;
    let alive = true;
    QRCode.toDataURL(url, {
      width: size,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#ffffff' },
    })
      .then((d) => alive && setQr(d))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [url, size]);

  const handleCopy = async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(url);
      } else {
        const ta = document.createElement('textarea');
        ta.value = url;
        ta.style.position = 'fixed';
        ta.style.left = '-10000px';
        ta.style.top = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* 复制失败静默忽略 */
    }
  };

  const handleDownload = () => {
    if (!qr) return;
    const link = document.createElement('a');
    link.href = qr;
    link.download = `qrcode-${publishCode}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const btn = (bg: string): React.CSSProperties => ({
    fontSize: 12.5,
    padding: '6px 14px',
    borderRadius: 6,
    border: 'none',
    background: bg,
    color: '#fff',
    cursor: 'pointer',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 12, color: '#6b7280' }}>
        {title ? `「${title}」已发布 · ` : ''}微信扫码在手机端查看最终效果
      </div>
      {ips.length > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#6b7280' }}>
          <span>本机网卡：</span>
          <select
            value={chosenIp || ips[0]}
            onChange={(e) => setChosenIp(e.target.value)}
            style={{ fontSize: 12, padding: '2px 6px', borderRadius: 4 }}
          >
            {ips.map((ip) => (
              <option key={ip} value={ip}>
                {ip}
                {ip === ips[0] ? '（推荐）' : ''}
              </option>
            ))}
          </select>
        </div>
      )}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          wordBreak: 'break-all',
          fontFamily: 'monospace',
          fontSize: 12,
          color: '#374151',
          background: '#f3f4f6',
          padding: '8px 10px',
          borderRadius: 8,
        }}
      >
        {url || '探测本机地址中…'}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={handleCopy} style={btn('#D24830')}>
          {copied ? '已复制' : '复制链接'}
        </button>
        <button type="button" onClick={handleDownload} style={btn('#374151')}>
          下载二维码
        </button>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', padding: '6px 0' }}>
        {qr ? (
          <img
            src={qr}
            alt="分享二维码"
            width={size}
            height={size}
            style={{ borderRadius: 8, border: '1px solid #e5e7eb' }}
          />
        ) : (
          <div
            style={{
              width: size,
              height: size,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#9ca3af',
              fontSize: 12,
              border: '1px dashed #e5e7eb',
              borderRadius: 8,
            }}
          >
            二维码生成中…
          </div>
        )}
      </div>
      <a href={url || '#'} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: '#D24830', textAlign: 'center' }}>
        在浏览器打开 H5 →
      </a>
    </div>
  );
};

export default ShareQrPanel;
