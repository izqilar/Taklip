import { Checkbox, Typography, Space, Divider } from 'antd';
import { layerDomains, type LayerKey } from '../../config/permGroups';
import { t } from "../../i18n/t";

const { Text } = Typography;

export interface PermCheckGroupProps {
  /** 当前角色所属层级（决定可见域） */
  layer: LayerKey;
  /** 已勾选的权限点 key（回显） */
  checkedKeys?: string[];
  /** 禁用（只读态 / 内置角色） */
  disabled?: boolean;
  /** 变更回调（角色编辑保存时写回 perms 数组） */
  onChange?: (keys: string[]) => void;
}

/**
 * 功能权限复选框组（文档 §9.2 / §9.5 / §5.4）。
 * 按 layerDomains() 分层过滤回显：代理 9 域 / 服务商 6 域 / 总台 10 域 / 用户 0 域。
 * 全局唯一实现，供角色与权限页（A 类只读复选框组、C/D 类编辑回写）复用。
 */
export const PermCheckGroup = ({ layer, checkedKeys, disabled, onChange }: PermCheckGroupProps) => {
  const domains = layerDomains(layer);
  const checked = new Set(checkedKeys ?? domains.flatMap((d) => d.points.map((p) => p.key)));

  const toggle = (key: string, next: boolean) => {
    const set = new Set(checked);
    if (next) set.add(key);
    else set.delete(key);
    onChange?.(Array.from(set));
  };

  if (domains.length === 0) {
    return <Text type="secondary">该层级无独立功能权限域。</Text>;
  }

  return (
    <div>
      {domains.map((d, i) => (
        <div key={d.id}>
          {i > 0 && <Divider style={{ margin: '12px 0' }} />}
          <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
            {d.label}
          </Text>
          <Space wrap>
            {d.points.map((p) => (
              <Checkbox
                key={p.key}
                checked={checked.has(p.key)}
                disabled={disabled}
                onChange={(e) => toggle(p.key, e.target.checked)}
              >
                {p.label}
              </Checkbox>
            ))}
          </Space>
        </div>
      ))}
    </div>
  );
};

export default PermCheckGroup;
