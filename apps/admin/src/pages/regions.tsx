import { useEffect, useState } from 'react';
import { Tree, message } from 'antd';
import { PageHead } from '../components/ui/PageHead';
import { Panel } from '../components/ui/Panel';
import { T } from '../config/theme';
import { API_URL, jsonHeaders } from '../utility';
import { t } from '../i18n/t';

interface RegionNode {
  id: string;
  code: string;
  name: string;
  level: number;
  children?: RegionNode[];
}

interface TreeNode {
  key: string;
  title: string;
  children?: TreeNode[];
}

function toTree(nodes: RegionNode[]): TreeNode[] {
  return nodes.map((n) => ({
    key: n.code,
    title: `${n.name}（${n.code}）`,
    children: n.children ? toTree(n.children) : undefined,
  }));
}

/** 区域管理（原型 总台 · 总览与治理）：只读展示国标三级行政区划树（省 / 市 / 区） */
export const RegionTreePage = () => {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/regions/tree`, { headers: jsonHeaders() })
      .then((r) => r.json())
      .then((b) => { if (!cancelled) setTree(toTree(Array.isArray(b) ? b : (b?.tree ?? []))); })
      .catch(() => { if (!cancelled) message.error(t("pages.toast.regionTreeFailed")); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <>
      <PageHead
        title={t("pages.col.regionManage")}
        sub="行政区划树 · 总台维护"
        chip="总台"
      />
      <Panel title="省 / 市 / 区 三级行政区划">
        <div style={{ padding: 16 }}>
          {loading ? (
            <span style={{ color: T.ink3, fontSize: 13 }}>{t("common.loading")}</span>
          ) : (
            <Tree treeData={tree} defaultExpandAll={false} showLine blockNode />
          )}
        </div>
      </Panel>
    </>
  );
};

export default RegionTreePage;
