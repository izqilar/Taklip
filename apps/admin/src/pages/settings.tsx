import { PageHead } from '../components/ui/PageHead';
import { Panel } from '../components/ui/Panel';
import { FilterBar } from '../components/ui/FilterBar';
import { DataTable } from '../components/ui/DataTable';
import { Pill } from '../components/ui/Pill';
import { T } from '../config/theme';
import { useState } from 'react';
import { t } from '../i18n/t';

interface SettingRow {
  key: string;
  category: string;
  name: string;
  value: string;
  desc: string;
}

/**
 * 系统设置（原型 总台 · 系统设置）。
 * 当前值取自服务端真实运行时配置（平台名称 / 抽成比例等），
 * 尚无 SystemSetting 持久化模型，本表为只读镜像；在线编辑待该模型落地后开放。
 */
const SETTINGS: SettingRow[] = [
  { key: 'brand', category: '基础', name: '平台名称', value: '庆柬云', desc: '平台对外展示名称' },
  { key: 'fee', category: '费用', name: '平台抽成比例', value: '10%', desc: '总台流水抽成（服务商侧）' },
  { key: 'minWithdraw', category: '费用', name: '提现最低金额', value: '¥100', desc: '低于该金额不可提现' },
  { key: 'fbSla', category: '审核', name: '反馈协商时限', value: '48 小时', desc: '超时自动升级总台仲裁' },
  { key: 'noticeAudit', category: '审核', name: '公告审核', value: '开启', desc: '发布前需总台审核' },
  { key: 'sms', category: '通知', name: '短信通知', value: '开启', desc: '关键节点短信提醒' },
];

export const SettingsPage = () => {
  const [cat, setCat] = useState<string>('all');

  const filtered = cat === 'all' ? SETTINGS : SETTINGS.filter((s) => s.category === cat);

  return (
    <>
      <PageHead
        title={t("pages.sec.systemSettings")}
        sub="全局配置 · 仅超级管理员可改"
        chip="总台 · 系统"
      />

      <FilterBar
        filters={[
          { label: '全部', value: 'all' },
          { label: '基础', value: '基础' },
          { label: '费用', value: '费用' },
          { label: '审核', value: '审核' },
          { label: '通知', value: '通知' },
        ]}
        activeFilter={cat}
        onFilterChange={setCat}
      />

      <Panel
        title={<span>{t("pages.sec.systemSettings")}</span>}
        hint={
          <>
            共 <b style={{ color: T.accent }}>{filtered.length}</b> 项 · 在线编辑待系统配置模型落地
          </>
        }
      >
        <DataTable<SettingRow>
          rowKey="key"
          dataSource={filtered}
          columns={[
            {
              title: '分类',
              dataIndex: 'category',
              width: 100,
              render: (v: string) => <Pill tone="mut">{v}</Pill>,
            },
            {
              title: '配置项',
              dataIndex: 'name',
              width: 160,
              render: (v: string) => <span style={{ fontWeight: 600 }}>{v}</span>,
            },
            {
              title: '当前值',
              dataIndex: 'value',
              width: 140,
              render: (v: string) => (
                <span style={{ color: T.accent, fontWeight: 600 }}>{v}</span>
              ),
            },
            {
              title: '说明',
              dataIndex: 'desc',
              render: (v: string) => <span style={{ color: T.ink3 }}>{v}</span>,
            },
          ]}
        />
      </Panel>
    </>
  );
};

export default SettingsPage;
