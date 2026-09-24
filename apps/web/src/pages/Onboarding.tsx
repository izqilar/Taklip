/**
 * 入驻资料填写页（注册即入驻的第二步）
 *
 * 前置：注册页选择了「入驻服务商 / 入驻代理商」，此时已是登录态（role 仍为 USER）。
 * 本页只做「提交入驻申请」，**不变更身份** —— 身份落地由总台终审 APPROVED 执行
 * （入驻管线单一真源：申请 → 代理一审 → 总台终审）。
 *
 * 接口：POST /api/user/qualifications（与用户中心「入驻申请」同一端点同一模型）
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '@/api/client';
import { useAuthStore } from '@/store/authStore';

type Intent = 'provider' | 'agent';
type RegionNode = {
  id: string;
  name: string;
  level: number;
  regionPath?: string | null;
  children?: RegionNode[];
};

const SERVICE_SCOPES: { value: string; key: string }[] = [
  { value: 'DESIGN', key: 'userCenter.svc.design' },
  { value: 'PHOTO', key: 'userCenter.svc.photo' },
  { value: 'VENUE', key: 'userCenter.svc.venue' },
  { value: 'FLORAL', key: 'userCenter.svc.floral' },
  { value: 'STEWARD', key: 'userCenter.svc.steward' },
  { value: 'PERFORM', key: 'userCenter.svc.perform' },
];

const CERT_TYPES = [
  { value: 'ID_CARD', key: 'onboarding.cert.idCard' },
  { value: 'BUSINESS_LICENSE', key: 'onboarding.cert.license' },
  { value: 'OTHER', key: 'onboarding.cert.other' },
];

export default function Onboarding() {
  const { t } = useTranslation(['common', 'errors']);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const user = useAuthStore((s) => s.user);

  const intent: Intent = params.get('intent') === 'agent' ? 'agent' : 'provider';
  const isAgent = intent === 'agent';

  const [tree, setTree] = useState<RegionNode[]>([]);
  const [provinceId, setProvinceId] = useState('');
  const [cityId, setCityId] = useState('');
  const [districtId, setDistrictId] = useState('');

  const [applicantName, setApplicantName] = useState(user?.realName ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [certType, setCertType] = useState('ID_CARD');
  const [certNo, setCertNo] = useState('');
  const [certExpire, setCertExpire] = useState('');
  const [certLongTerm, setCertLongTerm] = useState(false);
  const [issuer, setIssuer] = useState('');
  const [attachText, setAttachText] = useState('');
  const [scopes, setScopes] = useState<string[]>([]);
  const [reason, setReason] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const provinces = tree.filter((r) => r.level === 1);
  const cities = useMemo(
    () => provinces.find((p) => p.id === provinceId)?.children ?? [],
    [provinces, provinceId],
  );
  const districts = useMemo(
    () => cities.find((c) => c.id === cityId)?.children ?? [],
    [cities, cityId],
  );

  /** 已选区域取最末一级（代理商必须选到区县，服务端会校验 regionPath 三级） */
  const selectedRegion = useMemo(() => {
    const p = provinces.find((x) => x.id === provinceId);
    if (!p) return null;
    const c = cities.find((x) => x.id === cityId);
    const d = districts.find((x) => x.id === districtId);
    const last = d ?? c ?? p;
    const names = [p.name, c?.name, d?.name].filter(Boolean) as string[];
    return { id: last.id, label: names.join(' / '), regionPath: last.regionPath ?? null };
  }, [provinces, cities, districts, provinceId, cityId, districtId]);

  useEffect(() => {
    api.get<RegionNode[]>('/api/regions/tree').then((r) => setTree(r ?? [])).catch(() => setTree([]));
  }, []);

  const toggleScope = (v: string) =>
    setScopes((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));

  const submit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      setNotice('');

      if (!applicantName.trim()) return setError(t('onboarding.err.applicantName'));
      if (!phone.trim()) return setError(t('onboarding.err.phone'));
      if (!certNo.trim()) return setError(t('onboarding.err.certNo'));
      if (!certLongTerm && !certExpire) return setError(t('onboarding.err.certExpire'));
      if (!attachText.trim()) return setError(t('onboarding.err.attachments'));
      if (!selectedRegion) return setError(t('onboarding.err.region'));
      if (isAgent && !districtId) return setError(t('onboarding.err.regionDistrict'));
      if (!isAgent && scopes.length === 0) return setError(t('onboarding.err.scopes'));
      if (!reason.trim()) return setError(t('onboarding.err.reason'));

      const attachments = attachText
        .split('\n')
        .map((x) => x.trim())
        .filter(Boolean);

      setSubmitting(true);
      try {
        const res: any = await api.post('/api/user/qualifications', {
          kind: isAgent ? 'agent' : 'provider',
          reason: reason.trim(),
          serviceScopes: isAgent ? [] : scopes,
          regionPath: selectedRegion.regionPath ?? null,
          regionLabel: selectedRegion.label,
          applicantName: applicantName.trim(),
          phone: phone.trim(),
          certType,
          certNo: certNo.trim(),
          certExpire: certLongTerm ? '' : certExpire,
          certLongTerm,
          issuer: issuer.trim() || null,
          attachments,
        });
        if (res?.duplicated) {
          setNotice(t('onboarding.duplicated'));
          setSubmitting(false);
          return;
        }
        const flags: string[] = res?.riskFlags ?? [];
        if (flags.includes('NO_AGENT_COVERAGE')) setNotice(t('onboarding.warn.noAgentCoverage'));
        else if (flags.includes('DUPLICATE_CERT_NO')) setNotice(t('onboarding.warn.dupCertNo'));
        navigate('/user/apply', { replace: true });
      } catch (err: any) {
        setError(err?.message ?? t('errors:error.requestFailed'));
      } finally {
        setSubmitting(false);
      }
    },
    [
      applicantName, phone, certNo, certExpire, certLongTerm, attachText, selectedRegion,
      districtId, scopes, reason, isAgent, certType, issuer, navigate, t,
    ],
  );

  const inputCls =
    'w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-white focus:border-blue-500 focus:outline-none';
  const labelCls = 'mb-1 block text-sm text-gray-600';

  return (
    <div className="min-h-full bg-gray-900 px-4 py-8">
      <div className="mx-auto w-full max-w-2xl rounded-2xl border border-gray-700 bg-gray-800 p-6">
        <h1 className="mb-1 text-xl font-bold text-white">
          {isAgent ? t('onboarding.title.agent') : t('onboarding.title.provider')}
        </h1>
        <p className="mb-5 text-sm text-gray-400">{t('onboarding.subtitle')}</p>

        {error && (
          <div className="mb-4 rounded-lg bg-red-900/40 px-4 py-2 text-sm text-red-300">{error}</div>
        )}
        {notice && (
          <div className="mb-4 rounded-lg bg-yellow-900/40 px-4 py-2 text-sm text-yellow-300">{notice}</div>
        )}

        <form onSubmit={submit} className="space-y-4">
          {/* 区域 */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>{t('onboarding.province')}</label>
              <select
                value={provinceId}
                onChange={(e) => { setProvinceId(e.target.value); setCityId(''); setDistrictId(''); }}
                className={inputCls}
              >
                <option value="">{t('onboarding.pleaseSelect')}</option>
                {provinces.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>{t('onboarding.city')}</label>
              <select
                value={cityId}
                onChange={(e) => { setCityId(e.target.value); setDistrictId(''); }}
                className={inputCls}
                disabled={!provinceId}
              >
                <option value="">{t('onboarding.pleaseSelect')}</option>
                {cities.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>
                {t('onboarding.district')}
                {isAgent && <span className="ml-1 text-red-400">*</span>}
              </label>
              <select
                value={districtId}
                onChange={(e) => setDistrictId(e.target.value)}
                className={inputCls}
                disabled={!cityId}
              >
                <option value="">{t('onboarding.pleaseSelect')}</option>
                {districts.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 服务类型（服务商） */}
          {!isAgent && (
            <div>
              <label className={labelCls}>{t('onboarding.scopes')}</label>
              <div className="flex flex-wrap gap-2">
                {SERVICE_SCOPES.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => toggleScope(s.value)}
                    className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                      scopes.includes(s.value)
                        ? 'border-blue-500 bg-blue-600/20 text-white'
                        : 'border-gray-600 bg-gray-700 text-gray-300 hover:border-gray-500'
                    }`}
                  >
                    {t(s.key)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 主体资料 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>{t('onboarding.applicantName')}</label>
              <input value={applicantName} onChange={(e) => setApplicantName(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>{t('onboarding.phone')}</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>{t('onboarding.certType')}</label>
              <select value={certType} onChange={(e) => setCertType(e.target.value)} className={inputCls}>
                {CERT_TYPES.map((c) => (
                  <option key={c.value} value={c.value}>{t(c.key)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>{t('onboarding.certNo')}</label>
              <input value={certNo} onChange={(e) => setCertNo(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>{t('onboarding.certExpire')}</label>
              <input
                type="date"
                value={certExpire}
                onChange={(e) => setCertExpire(e.target.value)}
                disabled={certLongTerm}
                className={inputCls}
              />
            </div>
            <div className="flex items-end gap-2 pb-2">
              <label className="flex items-center gap-2 text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={certLongTerm}
                  onChange={(e) => setCertLongTerm(e.target.checked)}
                  className="h-4 w-4"
                />
                {t('onboarding.certLongTerm')}
              </label>
            </div>
            <div className="col-span-2">
              <label className={labelCls}>{t('onboarding.issuer')}</label>
              <input value={issuer} onChange={(e) => setIssuer(e.target.value)} className={inputCls} />
            </div>
          </div>

          <div>
            <label className={labelCls}>{t('onboarding.attachments')}</label>
            <textarea
              value={attachText}
              onChange={(e) => setAttachText(e.target.value)}
              rows={3}
              placeholder={t('onboarding.attachmentsPh')}
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>{t('onboarding.reason')}</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className={inputCls}
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-blue-600 py-2.5 font-medium text-white transition hover:bg-blue-500 disabled:opacity-50"
          >
            {submitting ? t('common:status.loading') : t('onboarding.submit')}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-500">
          <Link to="/user/apply" className="text-blue-400 hover:text-blue-300">
            {t('onboarding.viewMine')}
          </Link>
        </p>
      </div>
    </div>
  );
}
