import { useEffect, useMemo, useState } from 'react';
import { Cascader, Spin } from 'antd';
import type { CascaderProps } from 'antd';
import { API_URL, authHeaders } from '../utility';
import { t } from "../i18n/t";

interface RegionNode {
  id: string;
  code: string;
  name: string;
  level: number;
  children?: RegionNode[];
}

interface Option {
  value: string;
  label: string;
  isLeaf?: boolean;
  children?: Option[];
}

function toOptions(nodes: RegionNode[]): Option[] {
  return nodes.map((n) => ({
    // 用 Region 的 id（cuid）作为 value，与后端 User.regionId / getById 一致；
    // 之前用 n.code 会导致提交时按 id 查不到区域（400 "所选区域不存在"）。
    value: n.id,
    label: n.name,
    isLeaf: n.level === 3,
    children: n.children && n.children.length ? toOptions(n.children) : undefined,
  }));
}

/** 在完整树中查找某 id 的祖先路径（含自身），用于回填 Cascader 显示 */
function findPath(nodes: RegionNode[], id: string, trail: string[] = []): string[] | null {
  for (const n of nodes) {
    const next = [...trail, n.id];
    if (n.id === id) return next;
    if (n.children) {
      const r = findPath(n.children, id, next);
      if (r) return r;
    }
  }
  return null;
}

export interface RegionCascaderProps {
  value?: string;
  onChange?: (code: string) => void;
  placeholder?: string;
}

export function RegionCascader({ value, onChange, placeholder }: RegionCascaderProps) {
  const [tree, setTree] = useState<RegionNode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/regions/tree`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((b) => setTree(Array.isArray(b) ? b : (b?.tree ?? [])))
      .catch(() => setTree([]))
      .finally(() => setLoading(false));
  }, []);

  const options = useMemo(() => toOptions(tree), [tree]);
  const cascaderValue = useMemo(() => (value ? findPath(tree, value) ?? [] : []), [tree, value]);

  const handleChange: CascaderProps<string[]>['onChange'] = (vals) => {
    const arr = (vals as string[]) ?? [];
    const leaf = arr[arr.length - 1];
    if (leaf && onChange) onChange(leaf);
  };

  if (loading) return <Spin />;

  return (
    <Cascader
      options={options as any}
      value={cascaderValue}
      onChange={handleChange}
      placeholder={placeholder ?? '选择省 / 市 / 区'}
      changeOnSelect
      expandTrigger="hover"
      style={{ width: '100%' }}
    />
  );
}
