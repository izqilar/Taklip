import React, { useState, type ReactNode } from 'react';
import styles from './DesignGalleryCard.module.css';
import {
  resolveActionGroups,
  type DesignActionCaps,
  type DesignKind,
  type ActionGroup,
} from './resolveActions';

export type { DesignActionCaps, DesignKind } from './resolveActions';

export interface DesignGalleryCardProps {
  kind: DesignKind;
  /** 状态徽标文案（已本地化） */
  badgeLabel: string;
  capabilities: DesignActionCaps;
  /** 按钮文案，由 host 用各自 i18n 解析后传入，外壳零 i18n 耦合 */
  labels: Record<string, string>;
  /** 当前设计稿数据（id/title 等），透传给 on* */
  item: any;
  /** 封面区内容：host 用 SchemaThumbnail / 封面图渲染 */
  coverNode: ReactNode;
  /** 业务动作回调，外壳只触发，不实现 */
  on: Partial<Record<keyof DesignActionCaps, (item: any) => void>>;
  aspectRatio?: string;
  className?: string;
}

/**
 * 作品/模板卡片的统一 hover 操作外壳（@h5design/ui）。
 * 只负责「封面 + 状态徽标 + 三层操作栏 + scrim + 按 capabilities 渲染按钮」；
 * 预览弹窗 / 详情抽屉 / 导出弹窗 / 编辑跳转 / 删除 / 提交 等业务动作由 host 通过 on* 实现。
 * 触屏兜底：点击卡片切换 active，使浮层在 hover 不可用的设备上也可展开。
 */
export function DesignGalleryCard(props: DesignGalleryCardProps) {
  const { kind, badgeLabel, capabilities, labels, item, coverNode, on, aspectRatio, className } = props;
  const [active, setActive] = useState(false);

  const groups = resolveActionGroups(kind, capabilities, on);

  const fire = (k: keyof DesignActionCaps) => (e: React.MouseEvent) => {
    e.stopPropagation();
    on[k]?.(item);
  };

  return (
    <div
      className={`${styles.root} ${active ? styles.active : ''} ${className ?? ''}`}
      style={{ aspectRatio: aspectRatio ?? '375 / 667' }}
      onClick={() => setActive((v) => !v)}
    >
      <div className={styles.cover}>{coverNode}</div>
      {badgeLabel ? <div className={styles.badge}>{badgeLabel}</div> : null}
      <div className={styles.scrim} />
      {(['top', 'center', 'bottom'] as const).map((g: ActionGroup) => (
        <div key={g} className={styles[g]}>
          {groups[g].map((o) => (
            <button
              key={o.key}
              type="button"
              className={`${styles.btn} ${styles[o.variant]}`}
              onClick={fire(o.key)}
            >
              {labels[o.key] ?? o.key}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

export default DesignGalleryCard;
