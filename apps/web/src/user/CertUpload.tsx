/**
 * 资质附件上传组件（身份证 / 营业执照等）
 *
 * 用途：替代原「证件 URL 地址」文本域 —— 注册即入驻（/onboarding）、
 * 入驻申请（/user/apply）、初审通过后填写资料（/user/notices/fill）三处统一使用。
 *
 * 实现：复用既有素材上传通道 `api.uploadAsset` → `POST /api/assets/upload`（带 JWT），
 * 上传成功回填 `/uploads/xxx` URL 数组，与 `QualificationApplication.attachments` 同结构，
 * 后端与本组件均无需改动接口契约。
 */
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '@/api/client';

/** 图片类附件用缩略图预览，非图片（如 PDF）用文件卡片 */
const IMAGE_EXT = /\.(jpe?g|png|gif|webp|bmp|svg|avif|tiff?|ico)$/i;
const isImage = (url: string) => IMAGE_EXT.test(url);
/** 从 URL 取展示文件名（去掉历史命名的时间戳前缀，保持可读） */
const nameOf = (url: string) => {
  const raw = decodeURIComponent(url.split('/').pop() ?? url);
  return raw.replace(/^\d{10,}-\d+/, '') || raw;
};

/**
 * 配色皮肤：
 *  - light —— 暖白运营端风格（#fffefb / 朱砂 #D24830），用于个人中心的暖白卡片
 *  - dark  —— 深色表单风格（gray-700/800 + 蓝 #3b82f6），用于 Register / Onboarding 深色卡
 */
const SKIN = {
  light: {
    border: 'rgba(74,60,42,0.18)',
    bg: '#faf7f1',
    bgDrag: 'rgba(210,72,48,0.05)',
    borderDrag: '#D24830',
    text1: '#4c4236',
    text2: '#6e5f4a',
    itemBg: '#fffefb',
    itemBorder: 'rgba(74,60,42,0.12)',
    itemText: '#4c4236',
    thumbBg: '#f3eee7',
    danger: '#8f1d24',
  },
  dark: {
    border: '#4b5563',
    bg: 'rgba(55,65,81,0.45)',
    bgDrag: 'rgba(59,130,246,0.15)',
    borderDrag: '#3b82f6',
    text1: '#d1d5db',
    text2: '#9ca3af',
    itemBg: '#374151',
    itemBorder: '#4b5563',
    itemText: '#d1d5db',
    thumbBg: '#4b5563',
    danger: '#fca5a5',
  },
} as const;

export interface CertUploadProps {
  /** 已上传附件 URL 列表（受控） */
  value: string[];
  onChange: (next: string[]) => void;
  /** input accept，默认图片；如需 PDF 传 '.jpg,.jpeg,.png,.pdf' */
  accept?: string;
  maxCount?: number;
  maxSizeMB?: number;
  disabled?: boolean;
  hint?: string;
  tone?: keyof typeof SKIN;
}

export function CertUpload({
  value,
  onChange,
  accept = 'image/*',
  maxCount = 6,
  maxSizeMB = 10,
  disabled = false,
  hint,
  tone = 'light',
}: CertUploadProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [drag, setDrag] = useState(false);

  const sk = SKIN[tone];

  async function handleFiles(files: FileList | File[] | null) {
    if (!files) return;
    const list = Array.from(files);
    if (list.length === 0) return;
    if (value.length >= maxCount) {
      setErr(t('common:userCenter.upload.maxCount', { defaultValue: '最多上传 {{n}} 个附件', n: maxCount }));
      return;
    }
    const picked = list.slice(0, maxCount - value.length);
    setErr('');
    setBusy(true);
    const added: string[] = [];
    try {
      for (const f of picked) {
        if (f.size > maxSizeMB * 1024 * 1024) {
          setErr(
            t('common:userCenter.upload.tooLarge', {
              defaultValue: '{{name}} 超过 {{mb}}MB，已跳过',
              name: f.name,
              mb: maxSizeMB,
            }),
          );
          continue;
        }
        const asset = await api.uploadAsset(f);
        if (asset?.url) added.push(asset.url);
      }
      if (added.length) onChange([...value, ...added]);
    } catch (e: any) {
      setErr(e?.message ?? t('common:userCenter.upload.failed', { defaultValue: '上传失败，请重试' }));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  const open = () => {
    if (!disabled && !busy) inputRef.current?.click();
  };

  const remove = (url: string) => onChange(value.filter((u) => u !== url));

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        aria-disabled={disabled || busy}
        onClick={open}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            open();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled && !busy) setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          if (!disabled && !busy) handleFiles(e.dataTransfer?.files ?? null);
        }}
        className="rounded-[10px] border border-dashed px-4 py-5 text-center transition"
        style={{
          borderColor: drag ? sk.borderDrag : sk.border,
          background: drag ? sk.bgDrag : sk.bg,
          cursor: disabled || busy ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple
          className="hidden"
          disabled={disabled || busy}
          onChange={(e) => handleFiles(e.target.files)}
        />
        <div className="text-[20px] leading-none">{busy ? '⏳' : '📤'}</div>
        <div className="mt-1.5 text-[13px]" style={{ color: sk.text1 }}>
          {busy
            ? t('common:userCenter.upload.uploading', { defaultValue: '上传中…' })
            : t('common:userCenter.upload.pick', { defaultValue: '点击或拖拽身份证 / 证件照片到此处上传' })}
        </div>
        <div className="mt-0.5 text-[11.5px]" style={{ color: sk.text2 }}>
          {t('common:userCenter.upload.tip', {
            defaultValue: '支持 JPG / PNG / PDF · 单个文件 ≤ {{mb}}MB · 最多 {{n}} 个',
            mb: maxSizeMB,
            n: maxCount,
          })}
        </div>
      </div>

      {value.length > 0 && (
        <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {value.map((url) => (
            <li
              key={url}
              className="relative flex items-center gap-2 rounded-[8px] border p-2"
              style={{ background: sk.itemBg, borderColor: sk.itemBorder }}
            >
              {isImage(url) ? (
                <img
                  src={url}
                  alt=""
                  className="h-10 w-10 flex-none rounded object-cover"
                  style={{ boxShadow: `0 0 0 1px ${sk.itemBorder}` }}
                />
              ) : (
                <span
                  className="flex h-10 w-10 flex-none items-center justify-center rounded text-[16px]"
                  style={{ background: sk.thumbBg }}
                >
                  📄
                </span>
              )}
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="min-w-0 flex-1 truncate text-[12px] hover:underline"
                style={{ color: sk.itemText }}
                title={nameOf(url)}
              >
                {nameOf(url)}
              </a>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => remove(url)}
                  title={t('common:button.delete', { defaultValue: '删除' })}
                  className="flex-none rounded px-1 text-[13px] transition hover:opacity-70"
                  style={{ color: sk.text2 }}
                >
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {err && (
        <p className="mt-1.5 text-[12px]" style={{ color: sk.danger }}>
          {err}
        </p>
      )}
      {hint && (
        <p className="mt-1 text-[11.5px]" style={{ color: sk.text2 }}>
          {hint}
        </p>
      )}
    </div>
  );
}

export default CertUpload;
