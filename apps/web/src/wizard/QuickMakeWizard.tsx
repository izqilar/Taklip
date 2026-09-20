/**
 * QuickMakeWizard — 一键制作三步向导
 *  Step 1 选类型 → Step 2 选模板 → Step 3 填表单（文本 + 图片上传）
 *  完成后：未登录跳登录；已登录则 useTemplate 克隆模板 → applyFormData 注入表单值
 *          → updateProject 回写 → 进入编辑器继续精修。
 */
import { useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api, type TemplateListItem } from '@/api/client';
import { useAuthStore } from '@/store/authStore';
import { QUICK_MAKE_TYPES, getQuickMakeType, type QuickMakeType, type QuickMakeField } from './quickMakeConfig';
import { applyFormData } from './applyFormData';
import type { Project } from '@h5design/core';
import { SchemaThumbnail } from '@/components/SchemaThumbnail';

const STEP_TITLES = ['selectType', 'selectTemplate', 'fillForm'] as const;

export default function QuickMakeWizard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [type, setType] = useState<QuickMakeType | null>(null);
  const [templates, setTemplates] = useState<TemplateListItem[]>([]);
  const [template, setTemplate] = useState<TemplateListItem | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const loadTemplates = useCallback(
    async (cat: string) => {
      try {
        const list = await api.listTemplates(cat);
        setTemplates(list);
      } catch {
        setError(t('quickMake.messages.fail'));
      }
    },
    [t],
  );

  const onPickType = (tp: QuickMakeType) => {
    setType(tp);
    setTemplate(null);
    setValues({});
    setError('');
    setStep(2);
    void loadTemplates(tp.category);
  };

  const onPickTemplate = (tp: TemplateListItem) => {
    setTemplate(tp);
    setError('');
    setStep(3);
  };

  const onImageChange = async (bind: string, file: File | null) => {
    if (!file) return;
    setUploading(bind);
    setError('');
    try {
      const asset = await api.uploadAsset(file);
      setValues((v) => ({ ...v, [bind]: asset.url }));
    } catch {
      setError(t('quickMake.messages.fail'));
    } finally {
      setUploading(null);
    }
  };

  const isRequiredOk = () => {
    if (!type) return false;
    return type.fields.filter((f) => f.required).every((f) => (values[f.bind] || '').trim() !== '');
  };

  const onFinish = async () => {
    if (!template || !type) return;
    if (!isAuthenticated) {
      navigate('/login', { state: { from: '/quick-make' } });
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const project = await api.useTemplate(template.id, values.title || template.name);
      const patched = applyFormData(project.schema as Project, values);
      await api.updateProject(project.id, { schema: patched });
      navigate(`/editor/${project.id}`);
    } catch {
      setError(t('quickMake.messages.fail'));
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-gray-800">{t('quickMake.title')}</h1>
        <p className="mt-1 text-sm text-gray-500">{t('quickMake.subtitle')}</p>
      </div>

      {/* Stepper */}
      <ol className="mx-auto mb-8 flex max-w-2xl items-center justify-center gap-2 text-sm">
        {STEP_TITLES.map((key, idx) => {
          const n = (idx + 1) as 1 | 2 | 3;
          const active = step === n;
          const done = step > n;
          return (
            <li key={key} className="flex items-center gap-2">
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full font-semibold ${
                  active ? 'bg-[#D24830] text-white' : done ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'
                }`}
              >
                {done ? '✓' : n}
              </span>
              <span className={active ? 'font-medium text-[#D24830]' : 'text-gray-500'}>
                {t(`quickMake.steps.${key}`)}
              </span>
              {idx < STEP_TITLES.length - 1 && <span className="mx-1 h-px w-8 bg-gray-300" />}
            </li>
          );
        })}
      </ol>

      {error && (
        <div className="mx-auto mb-4 max-w-2xl rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Step 1 — 选类型 */}
      {step === 1 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {QUICK_MAKE_TYPES.map((tp) => (
            <button
              key={tp.id}
              type="button"
              onClick={() => onPickType(tp)}
              className="flex flex-col items-center gap-2 rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-[#D24830] hover:shadow-md"
            >
              <span className="text-4xl">{tp.icon}</span>
              <span className="text-sm font-medium text-gray-700">{t(`quickMake.types.${tp.id}`)}</span>
            </button>
          ))}
        </div>
      )}

      {/* Step 2 — 选模板 */}
      {step === 2 && type && (
        <>
          {templates.length === 0 ? (
            <div className="py-12 text-center text-gray-600">{t('status.loading')}</div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
              {templates.map((tp) => (
                <button
                  key={tp.id}
                  type="button"
                  onClick={() => onPickTemplate(tp)}
                  className="group overflow-hidden rounded-xl border border-gray-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#D24830] hover:shadow-md"
                >
                  <div className="relative aspect-[375/667] w-full overflow-hidden bg-gray-50">
                    <SchemaThumbnail schema={tp.schema} />
                  </div>
                  <div className="p-3">
                    <div className="truncate text-sm font-medium text-gray-800">{tp.name}</div>
                    {tp.isOfficial && (
                      <span className="mt-1 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700">
                        {t('badge.official')}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
          <div className="mt-6 flex justify-start">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="rounded-full border border-gray-300 px-5 py-2 text-sm text-gray-600 transition hover:bg-gray-50"
            >
              {t('quickMake.buttons.prev')}
            </button>
          </div>
        </>
      )}

      {/* Step 3 — 填表单 */}
      {step === 3 && type && (
        <div className="mx-auto max-w-2xl rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">
              {t('quickMake.steps.fillForm')} · {t(`quickMake.types.${type.id}`)}
            </h2>
            <span className="text-xs text-gray-600">{template?.name}</span>
          </div>

          <div className="space-y-4">
            {type.fields.map((f: QuickMakeField) => (
              <div key={f.bind}>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t(`quickMake.fields.${f.bind}`)}
                  {f.required && <span className="ml-1 text-red-500">*</span>}
                </label>

                {f.type === 'textarea' ? (
                  <textarea
                    value={values[f.bind] || ''}
                    onChange={(e) => setValues((v) => ({ ...v, [f.bind]: e.target.value }))}
                    rows={3}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#D24830]"
                    placeholder={t(`quickMake.fields.${f.bind}`)}
                  />
                ) : f.type === 'image' ? (
                  <ImageField
                    bind={f.bind}
                    value={values[f.bind] || ''}
                    uploading={uploading === f.bind}
                    hint={t('quickMake.form.uploadHint')}
                    uploadingText={t('quickMake.form.uploading')}
                    onChange={(file) => onImageChange(f.bind, file)}
                  />
                ) : (
                  <input
                    type="text"
                    value={values[f.bind] || ''}
                    onChange={(e) => setValues((v) => ({ ...v, [f.bind]: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#D24830]"
                    placeholder={t(`quickMake.fields.${f.bind}`)}
                  />
                )}
              </div>
            ))}
          </div>

          <div className="mt-6 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="rounded-full border border-gray-300 px-5 py-2 text-sm text-gray-600 transition hover:bg-gray-50"
            >
              {t('quickMake.buttons.prev')}
            </button>
            <button
              type="button"
              onClick={onFinish}
              disabled={!isRequiredOk() || submitting}
              className="rounded-full bg-[#D24830] px-6 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#B23A22] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? t('quickMake.messages.creating') : t('quickMake.buttons.finish')}
            </button>
          </div>

          {!isAuthenticated && (
            <p className="mt-3 text-center text-xs text-gray-600">{t('quickMake.messages.needLogin')}</p>
          )}
        </div>
      )}

      <div className="mt-8 text-center">
        <Link to="/" className="text-sm text-gray-600 underline-offset-2 hover:text-gray-600 hover:underline">
          {t('quickMake.buttons.backHome')}
        </Link>
      </div>
    </div>
  );
}

/** 图片上传字段（含预览 + 更换） */
function ImageField({
  value,
  uploading,
  hint,
  uploadingText,
  onChange,
}: {
  bind: string;
  value: string;
  uploading: boolean;
  hint: string;
  uploadingText: string;
  onChange: (file: File | null) => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-4">
        <label className="relative flex h-24 w-24 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed border-gray-300 bg-gray-50 text-xs text-gray-600 hover:border-[#D24830]">
          {value ? (
            <img src={value} alt="cover" className="h-full w-full object-cover" />
          ) : uploading ? (
            <span>{uploadingText}</span>
          ) : (
            <span className="px-2 text-center">{hint}</span>
          )}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onChange(e.target.files?.[0] ?? null)}
          />
        </label>
        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-xs text-gray-600 hover:text-red-500"
          >
            {hint}
          </button>
        )}
      </div>
    </div>
  );
}
