/**
 * WorkShareLinks — 作品卡片/列表内「访问 H5 / 复制链接」一键入口（仅已发布作品）。
 *
 * 链接基址走 resolveWebBase()（VITE_WEB_BASE > dev server 自动探测 > localhost），
 * 所以局域网直访/扫码也是动态本机 IP，无需手填。
 */
import { useEffect, useState } from 'react';
import { T } from '../../config/theme';
import { resolveWebBase } from '../../utility';

export const WorkShareLinks = ({ publishCode }: { publishCode: string }) => {
  const [url, setUrl] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    resolveWebBase().then((base) => {
      if (alive) setUrl(`${base}/p/${publishCode}`);
    });
    return () => {
      alive = false;
    };
  }, [publishCode]);

  const handleCopy = async () => {
    if (!url) return;
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

  if (!url) {
    return <span style={{ fontSize: 12, color: T.ink3 }}>分享链接生成中…</span>;
  }

  const a: React.CSSProperties = {
    color: T.accent,
    cursor: 'pointer',
    fontSize: 12.5,
    whiteSpace: 'nowrap',
  };

  return (
    <span style={{ display: 'inline-flex', gap: 12, alignItems: 'center' }}>
      <a href={url} target="_blank" rel="noreferrer" style={a}>
        访问 H5
      </a>
      <span onClick={handleCopy} style={a} role="button">
        {copied ? '已复制' : '复制链接'}
      </span>
    </span>
  );
};

export default WorkShareLinks;
