import { Typography } from 'antd';
import { GenericListPage } from '../components/GenericListPage';
import { Pill } from '../components/ui/Pill';
import { T } from '../config/theme';
import { formatCents } from '../utility';
import { t } from '../i18n/t';

interface WalletRow {
  id: string;
  balance: number;
  totalIncome: number;
  withdrawn: number;
  provider?: { id: string; nickname: string; phone?: string };
}

const num = (v: number) => (
  <span style={{ fontVariantNumeric: 'tabular-nums', fontFamily: T.fontNum }}>
    {formatCents(v)}
  </span>
);

/** 钱包总览（原型 总台 · 财务中心）：全量资金总账，只读 */
export const WalletList = () => (
  <GenericListPage
    title={t('menu.admin.wallets')}
    sub="全量资金总账"
    chip="总台 · 财务中心"
    resource="admin/wallets"
    pageSize={20}
    searchable
    searchField={['provider', 'nickname']}
    searchPlaceholder="搜索昵称 / 手机号…"
    columns={[
      {
        title: t('pages.col.provider'),
        dataIndex: ['provider', 'nickname'],
        width: 150,
        render: (v: string) => v || '—',
      },
      {
        title: t('pages.col.phone'),
        dataIndex: ['provider', 'phone'],
        width: 140,
        render: (v: string) => <span style={{ color: T.ink3 }}>{v || '—'}</span>,
      },
      {
        title: t('pages.col.withdrawable'),
        dataIndex: 'balance',
        align: 'right',
        width: 130,
        render: (v: number) => <span style={{ color: T.accent, fontWeight: 600 }}>{num(v)}</span>,
      },
      {
        title: t('pages.col.totalIncome'),
        dataIndex: 'totalIncome',
        align: 'right',
        width: 130,
        render: num,
      },
      {
        title: t('pages.col.withdrawn'),
        dataIndex: 'withdrawn',
        align: 'right',
        width: 130,
        render: num,
      },
      {
        title: t('pages.col.status'),
        dataIndex: 'balance',
        width: 100,
        render: (v: number) =>
          v > 0 ? <Pill tone="ok">有余额</Pill> : <Pill tone="mut">无余额</Pill>,
      },
    ]}
  />
);

export default WalletList;
