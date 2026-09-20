import type { ReactNode } from 'react';
import { Input, Button } from 'antd';
import { T } from '../../config/theme';

export interface FilterOption {
  label: ReactNode;
  value: any;
}

export interface FilterBarProps {
  /** 胶囊筛选组（原型 .chip / .chip.on） */
  filters?: FilterOption[];
  activeFilter?: any;
  onFilterChange?: (v: any) => void;
  /** 搜索框（原型 .searchbox + .field） */
  searchable?: boolean;
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (v: string) => void;
  onSearch?: (v: string) => void;
  /** 右侧操作区（导出 / 新建 / 主操作） */
  actions?: ReactNode;
  children?: ReactNode;
}

/**
 * 列表页工具条（原型 .toolbar = .filters + 搜索 + 按钮组）。
 * 结构：筛选胶囊 | 弹性留白 | 搜索框 | 搜索 | 导出 | 新建
 */
export const FilterBar = ({
  filters,
  activeFilter,
  onFilterChange,
  searchable,
  searchPlaceholder = '搜索关键词…',
  searchValue,
  onSearchChange,
  onSearch,
  actions,
  children,
}: FilterBarProps) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
    {filters && filters.length > 0 && (
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          alignItems: 'center',
          background: T.bg,
          border: `1px solid ${T.border}`,
          borderRadius: T.rMd,
          padding: '10px 12px',
        }}
      >
        {filters.map((f, i) => {
          const on = activeFilter === f.value;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onFilterChange?.(f.value)}
              style={{
                border: `1px solid ${on ? T.accent : T.border}`,
                borderRadius: 999,
                padding: '4px 12px',
                color: on ? T.accent : T.ink2,
                background: on ? T.accentSoft : 'transparent',
                fontWeight: on ? 600 : 400,
                fontSize: 12.5,
                cursor: 'pointer',
                minHeight: 0,
                lineHeight: 1.6,
              }}
            >
              {f.label}
            </button>
          );
        })}
      </div>
    )}

    {children}

    <span style={{ marginLeft: 'auto' }} />

    {searchable && (
      <Input
        allowClear
        placeholder={searchPlaceholder}
        value={searchValue}
        style={{ width: 220 }}
        onChange={(e) => onSearchChange?.(e.target.value)}
        onPressEnter={(e) => onSearch?.((e.target as HTMLInputElement).value)}
      />
    )}
    {searchable && <Button onClick={() => onSearch?.(searchValue ?? '')}>搜索</Button>}
    {actions}
  </div>
);

export default FilterBar;
