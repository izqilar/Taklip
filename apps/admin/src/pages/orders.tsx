import { Typography } from 'antd';
import { GenericListPage } from '../components/GenericListPage';
import { StatusTag } from '../components/common/StatusTag';
import { T } from '../config/theme';
import { formatCents } from '../utility';
import { cleanCode } from '../config/labels';
import { t } from '../i18n/t';

const { Text } = Typography;

interface OrderRow {
  id: string;
  amount: number;
  platformFee: number;
  designerIncome: number;
  status: string;
  createdAt: string;
  buyer?: { id: string; nickname: string; phone?: string };
  template?: { id: string; name: string; category: string };
}

// 模板一级分类 slug → 中文标签（与 apps/web/src/categories.ts 保持一致）
const CATEGORY_LABELS: Record<string, string> = {
  wedding: 'pages.cat.wedding',
  birth_celebration: 'pages.cat.birthCelebration',
  birthday: 'pages.cat.birthday',
  festival: 'pages.cat.festCard',
  housewarming: 'pages.cat.houseMove',
  school_promotion: 'pages.cat.promoStudy',
  social_gathering: 'pages.cat.socialParty',
  memorial: 'pages.cat.memorial',
  brand: 'pages.cat.bizPromo',
  recruitment: 'pages.cat.recruit',
  conference: 'pages.cat.meeting',
  opening: 'pages.cat.opening',
  education: 'pages.cat.edu',
  biz_social: 'pages.cat.bizSocial',
  marketing: 'pages.cat.productMkt',
};

/** 订单管理（原型 总台 · 运营监管）：全量订单履约监督，只读 */
export const OrderList = () => (
  <GenericListPage
    title={t('menu.admin.orders')}
    sub="全量订单 · 履约监督"
    chip="总台"
    resource="admin/orders"
    searchable
    searchField={['template', 'name']}
    searchPlaceholder="搜索买家 / 模板…"
    chipFilters={[
      { label: '全部', value: 'all' },
      { label: '已支付', value: 'paid', field: 'status' },
      { label: '已退款', value: 'refunded', field: 'status' },
    ]}
    columns={[
      {
        title: t('pages.col.orderNo'),
        dataIndex: 'id',
        width: 200,
        ellipsis: true,
        render: (v: string) => (
          <span style={{ fontVariantNumeric: 'tabular-nums', fontFamily: T.fontNum }}>
            {cleanCode(v)}
          </span>
        ),
      },
      {
        title: t('pages.col.buyer'),
        dataIndex: ['buyer', 'nickname'],
        width: 120,
        render: (v: string) => v || '—',
      },
      {
        title: t('pages.col.template'),
        dataIndex: ['template', 'name'],
        ellipsis: true,
        render: (v: string) => v || '—',
      },
      {
        title: t('pages.col.category'),
        dataIndex: ['template', 'category'],
        width: 110,
        render: (v: string) =>
          v ? (
            <span style={{ color: T.ink3 }}>{t(CATEGORY_LABELS[v] ?? v)}</span>
          ) : (
            <Text type="secondary">—</Text>
          ),
      },
      {
        title: t('pages.col.paidAmount'),
        dataIndex: 'amount',
        align: 'right',
        width: 110,
        render: (v: number) => (
          <span
            style={{
              color: T.accent,
              fontWeight: 600,
              fontVariantNumeric: 'tabular-nums',
              fontFamily: T.fontNum,
            }}
          >
            {formatCents(v)}
          </span>
        ),
      },
      {
        title: t('pages.col.platformCommission'),
        dataIndex: 'platformFee',
        align: 'right',
        width: 110,
        render: (v: number) => (
          <span style={{ fontVariantNumeric: 'tabular-nums', fontFamily: T.fontNum }}>
            {formatCents(v)}
          </span>
        ),
      },
      {
        title: t('pages.col.providerEarned'),
        dataIndex: 'designerIncome',
        align: 'right',
        width: 110,
        render: (v: number) => (
          <span style={{ fontVariantNumeric: 'tabular-nums', fontFamily: T.fontNum }}>
            {formatCents(v)}
          </span>
        ),
      },
      {
        title: t('pages.col.status'),
        dataIndex: 'status',
        width: 100,
        render: (v: string) => <StatusTag value={v} />,
      },
      {
        title: t('pages.col.orderAt'),
        dataIndex: 'createdAt',
        width: 170,
        render: (v: string) =>
          v ? new Date(v).toLocaleString('zh-CN', { hour12: false }) : '—',
      },
    ]}
  />
);

export default OrderList;
