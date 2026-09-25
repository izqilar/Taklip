/**
 * 填写资料页（路由 /user/notices/fill?kind=&id=）
 *
 * 承接通知公告「填写资料」入口：服务商 / 代理商入驻申请代理商初审通过（FIRST_PASSED）
 * 后，用户在此补充完整主体资质材料，提交后进入管理总台终审（FINAL_PENDING）。
 * 复用既有 POST /api/user/qualifications/:id/fill 端点（后端零改动）。
 * 页面呈现与用户中心一致的暖白风格，并复用 CertUpload 上传身份证 / 营业执照。
 */
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '@/api/client';
import { PageHead, Panel, StatusBadge } from './shared';
import { CertUpload } from './CertUpload';

/** 证件类型（与运营端 / Onboarding / Apply 同一枚举语义） */
const CERT_TYPES: { value: string; key: string }[] = [
  { value: 'ID_CARD', key: 'userCenter.apply.material.cert.idCard' },
  { value: 'BUSINESS_LICENSE', key: 'userCenter.apply.material.cert.license' },
  { value: 'OTHER', key: 'userCenter.apply.material.cert.other' },
];

const inputCls =
  'h-[36px] w-full rounded-md border border-[rgba(74,60,42,0.16)] bg-[#fffefb] px-2.5 text-[13.5px] text-[#2a2118] outline-none focus:border-[#D24830]';
const selectCls =
  'h-[36px] w-full rounded-md border border-[rgba(74,60,42,0.16)] bg-[#fffefb] px-2.5 text-[13.5px] text-[#2a2118] outline-none focus:border-[#D24830]';

export default function NoticeFillPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const id = params.get('id') ?? '';
  const kind = params.get('kind') ?? '';

  const [applicantName, setApplicantName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [certType, setCertType] = useState('ID_CARD');
  const [certNo, setCertNo] = useState('');
  const [certExpire, setCertExpire] = useState('');
  const [certLongTerm, setCertLongTerm] = useState(false);
  const [issuer, setIssuer] = useState('');
  /** 资质附件：身份证 / 营业执照等，复用 CertUpload 上传 */
  const [attachments, setAttachments] = useState<string[]>([]);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  /** 预填：拉取本人全部申请，按 id 定位初审通过的那一条，回填主体材料 */
  useEffect(() => {
    let alive = true;
    setLoading(true);
    api
      .get<any[]>('/api/user/qualifications')
      .then((rows) => {
        if (!alive) return;
        const app = (rows ?? []).find((q) => q.id === id);
        if (app) {
          setApplicantName(app.applicantName ?? '');
          setContactPhone(app.phone ?? '');
          setCertType(app.certType ?? 'ID_CARD');
          setCertNo(app.certNo ?? '');
          setCertExpire(app.certExpire ?? '');
          setCertLongTerm(!!app.certLongTerm);
          setIssuer(app.issuer ?? '');
          setAttachments(Array.isArray(app.attachments) ? app.attachments : []);
        }
      })
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [id]);

  async function submit() {
    setError('');
    if (!applicantName.trim()) {
      setError(t('userCenter.apply.material.err.applicantName'));
      return;
    }
    if (!/^\d{11}$/.test(contactPhone.trim())) {
      setError(t('userCenter.apply.material.err.phone'));
      return;
    }
    if (!certNo.trim()) {
      setError(t('userCenter.apply.material.err.certNo'));
      return;
    }
    if (!certLongTerm && !certExpire) {
      setError(t('userCenter.apply.material.err.certExpire'));
      return;
    }
    if (attachments.length === 0) {
      setError(t('userCenter.apply.material.err.attachments'));
      return;
    }

    setSubmitting(true);
    try {
      await api.post(`/api/user/qualifications/${id}/fill`, {
        applicantName: applicantName.trim(),
        phone: contactPhone.trim(),
        certType,
        certNo: certNo.trim(),
        certExpire: certLongTerm ? '' : certExpire,
        certLongTerm,
        issuer: issuer.trim() || null,
        attachments,
      });
      setDone(true);
    } catch (e: any) {
      setError(e?.message || t('userCenter.apply.submitFailed'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/user/notices')}
          className="rounded-lg border border-[rgba(74,60,42,0.16)] px-3 py-1.5 text-[13px] text-[#4c4236] transition hover:border-[#D24830]/40 hover:text-[#D24830]"
        >
          ← {t('common:userCenter.notices.back', { defaultValue: '返回通知公告' })}
        </button>
      </div>

      <PageHead
        title={t('common:userCenter.notices.fillTitle', { defaultValue: '填写资料' })}
        sub={kind === 'agent' ? t('userCenter.apply.layer.agent') : t('userCenter.apply.layer.provider')}
        chip={
          <StatusBadge tone="warn">
            {t('common:userCenter.notices.fillStage', { defaultValue: '初审通过 · 待补资料' })}
          </StatusBadge>
        }
      />

      {done ? (
        <Panel title={t('common:userCenter.notices.fillDoneTitle', { defaultValue: '资料已提交' })}>
          <div className="px-4 py-6 text-center">
            <div className="text-[15px] font-semibold text-[#2a2118]">
              {t('common:userCenter.notices.fillDone', {
                defaultValue: '完整资料已提交，已进入管理总台终审，请耐心等待结果。',
              })}
            </div>
            <button
              type="button"
              onClick={() => navigate('/user/notices')}
              className="mt-4 rounded-lg bg-[#D24830] px-5 py-2 text-sm font-medium text-white transition hover:bg-[#B23A22]"
            >
              {t('common:userCenter.notices.back', { defaultValue: '返回通知公告' })}
            </button>
          </div>
        </Panel>
      ) : (
        <Panel title={t('userCenter.apply.material.title')}>
          <div className="px-4 py-4">
            {loading ? (
              <div className="py-6 text-center text-[13px] text-[#6e5f4a]">{t('common:userCenter.loading')}</div>
            ) : (
              <div className="space-y-3">
                <p className="text-[12px] leading-snug text-[#6e5f4a]">{t('userCenter.apply.material.hint')}</p>
                <div className="grid gap-2.5 md:grid-cols-3">
                  <div>
                    <div className="mb-1 text-[12px] text-[#6e5f4a]">{t('userCenter.apply.material.applicantNameLabel')}</div>
                    <input
                      className={inputCls}
                      value={applicantName}
                      onChange={(e) => setApplicantName(e.target.value)}
                      placeholder={t('userCenter.apply.material.applicantNamePh')}
                    />
                  </div>
                  <div>
                    <div className="mb-1 text-[12px] text-[#6e5f4a]">{t('userCenter.apply.material.phoneLabel')}</div>
                    <input
                      className={inputCls}
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      placeholder={t('userCenter.apply.material.phonePh')}
                    />
                  </div>
                  <div>
                    <div className="mb-1 text-[12px] text-[#6e5f4a]">{t('userCenter.apply.material.certTypeLabel')}</div>
                    <select className={selectCls} value={certType} onChange={(e) => setCertType(e.target.value)}>
                      {CERT_TYPES.map((c) => (
                        <option key={c.value} value={c.value}>
                          {t(c.key)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div className="mb-1 text-[12px] text-[#6e5f4a]">{t('userCenter.apply.material.certNoLabel')}</div>
                    <input
                      className={inputCls}
                      value={certNo}
                      onChange={(e) => setCertNo(e.target.value)}
                      placeholder={t('userCenter.apply.material.certNoPh')}
                    />
                  </div>
                  <div>
                    <div className="mb-1 text-[12px] text-[#6e5f4a]">{t('userCenter.apply.material.certExpireLabel')}</div>
                    <input
                      type="date"
                      className={inputCls}
                      value={certExpire}
                      disabled={certLongTerm}
                      onChange={(e) => setCertExpire(e.target.value)}
                    />
                  </div>
                  <div>
                    <div className="mb-1 text-[12px] text-[#6e5f4a]">{t('userCenter.apply.material.issuerLabel')}</div>
                    <input
                      className={inputCls}
                      value={issuer}
                      onChange={(e) => setIssuer(e.target.value)}
                      placeholder={t('userCenter.apply.material.issuerPh')}
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-[12.5px] text-[#4c4236]">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5"
                    checked={certLongTerm}
                    onChange={(e) => setCertLongTerm(e.target.checked)}
                  />
                  {t('userCenter.apply.material.certLongTerm')}
                </label>
                <div className="mt-2.5">
                  <div className="mb-1 text-[12px] text-[#6e5f4a]">{t('userCenter.apply.material.attachmentsLabel')}</div>
                  <CertUpload
                    value={attachments}
                    onChange={setAttachments}
                    tone="light"
                    accept="image/*,.pdf"
                    hint={t('userCenter.apply.material.attachmentsPh')}
                  />
                </div>
                {error && <p className="mt-2 text-[13px] text-[#8f1d24]">{error}</p>}
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={submit}
                    className="rounded-lg bg-[#D24830] px-5 py-2 text-sm font-medium text-white transition hover:bg-[#B23A22] disabled:opacity-50"
                  >
                    {submitting ? t('common:userCenter.loading') : t('userCenter.apply.submit')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </Panel>
      )}
    </div>
  );
}
