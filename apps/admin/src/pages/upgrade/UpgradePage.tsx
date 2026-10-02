import { Card, Tag, Button } from 'antd';
import { useNavigate } from 'react-router-dom';
import { t } from '../../i18n/t';

type Kind = 'provider' | 'agent' | 'user';

/** 图库扩容套餐（占位）：文档要求「达到上限后跳转独立扩容套餐页」。
 *  套餐内容与后端 getLimit 档位口径一致：服务商/代理商按牌级，终端用户按卡级。
 *  支付/下单能力尚未实现，统一以「该功能即将上线」占位，避免给出虚假下单入口。 */
export function UpgradePage({ kind = 'provider' }: { kind?: Kind }) {
  const nav = useNavigate();

  const packages: { name: string; limit: number; highlight?: boolean }[] =
    kind === 'user'
      ? [
          { name: '免费用户', limit: 4 },
          { name: '银卡用户', limit: 6 },
          { name: '金卡用户', limit: 10 },
          { name: '黑金用户', limit: 16, highlight: true },
        ]
      : [
          { name: kind === 'agent' ? '见习代理' : '新锐服务商', limit: 10 },
          { name: kind === 'agent' ? '铜牌代理' : '铜牌服务商', limit: 16 },
          { name: kind === 'agent' ? '银牌代理' : '银牌服务商', limit: 20, highlight: true },
          { name: kind === 'agent' ? '金牌代理' : '金牌服务商', limit: 26 },
          { name: kind === 'agent' ? '钻石代理' : '钻石服务商', limit: 30 },
        ];

  const title =
    kind === 'user'
      ? t('upgrade.userTitle', { defaultValue: '图库扩容套餐' })
      : t('upgrade.title', { defaultValue: '图库扩容套餐' });

  return (
    <div style={{ padding: 16, maxWidth: 920, margin: '0 auto' }}>
      <h2 style={{ margin: '0 0 4px' }}>{title}</h2>
      <div style={{ color: '#888', fontSize: 13, marginBottom: 16 }}>
        {t('upgrade.sub', {
          defaultValue: '当前图库已达上限，升级档位可提升图片存储上限。以下为各档位权益概览。',
        })}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
          gap: 12,
        }}
      >
        {packages.map((p) => (
          <Card
            key={p.name}
            size="small"
            style={{
              borderColor: p.highlight ? '#c24b2e' : undefined,
              boxShadow: p.highlight ? '0 0 0 1px #c24b2e' : undefined,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <b>{p.name}</b>
              {p.highlight && <Tag color="red">推荐</Tag>}
            </div>
            <div style={{ marginTop: 8, fontSize: 22, fontWeight: 700, color: '#c24b2e' }}>
              {p.limit}
              <span style={{ fontSize: 13, fontWeight: 400, color: '#888' }}> 张</span>
            </div>
            <div style={{ marginTop: 4, color: '#999', fontSize: 12 }}>
              {t('upgrade.cap', { defaultValue: '图片存储上限' })}
            </div>
            <Button type="link" disabled block style={{ paddingLeft: 0, marginTop: 4 }}>
              {t('upgrade.soon', { defaultValue: '即将上线' })}
            </Button>
          </Card>
        ))}
      </div>

      <div
        style={{
          marginTop: 20,
          padding: 16,
          background: '#fff7f5',
          border: '1px solid #f3d6cd',
          borderRadius: 8,
          color: '#8f1d24',
          fontSize: 13,
        }}
      >
        {t('upgrade.notice', {
          defaultValue: '扩容下单能力即将上线，如需立即扩容请联系您的专属服务商或代理商。',
        })}{' '}
        <a onClick={() => nav(-1)} style={{ color: '#c24b2e', cursor: 'pointer' }}>
          {t('upgrade.back', { defaultValue: '返回图库' })}
        </a>
      </div>
    </div>
  );
}
