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
  /**
   * 子集白名单：只渲染这些权限点，其余域/点整体隐藏。
   * 用途：员工岗位只应看到「岗位池权限」而非该层全部权限点
   * （如服务商员工对齐原型 TEAM_FUNCS 8 项，而非 provider 层 6 域 12 点）。
   * 不传则渲染该层全部可见域。
   */
  keys?: readonly string[];
}

/**
 * 功能权限复选框组（文档 §9.2 / §9.5 / §5.4）。
 * 按 layerDomains() 分层过滤回显：代理 9 域 / 服务商 6 域 / 总台 10 域 / 用户 0 域。
 * 全局唯一实现，供角色与权限页（A 类只读复选框组、C/D 类编辑回写）复用。
 */
export const PermCheckGroup = ({ layer, checkedKeys, disabled, onChange, keys }: PermCheckGroupProps) => {
  // 子集过滤：按 keys 白名单裁剪域与点；过滤后为空域的域整体不渲染
  const allow = keys ? new Set<string>(keys) : null;
  const domains = layerDomains(layer)
    .map((d) => (allow ? { ...d, points: d.points.filter((p) => allow.has(p.key)) } : d))
    .filter((d) => d.points.length > 0);
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
                {/*
                  员工岗位场景用 `pages.team.perm.<key>` 覆写标签：
                  原型 TEAM_FUNCS 的叫法是「订单查询 / 站内信收发」，
                  而 permGroups 的通用标签是「查看订单 / 消息发送」，两者不一致。
                  有翻译就用翻译，没有则回退到 permGroups 原标签。

                  ⚠️ 权限 key 自带冒号（如 `order:view`），而 i18next 默认
                  nsSeparator=':'，会把 `…perm.order:view` 解析成 ns=`…perm.order`
                  + key=`view` 而查不到。这里逐调用覆写 nsSeparator=false，
                  不去改全局配置（会影响其它 `common:xxx` 形式的命名空间用法）。
                */}
                {t(`pages.team.perm.${p.key}`, { defaultValue: p.label, nsSeparator: false })}
              </Checkbox>
            ))}
          </Space>
        </div>
      ))}
    </div>
  );
};

export default PermCheckGroup;
