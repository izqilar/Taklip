import { useEffect, useMemo, useRef, useState } from 'react';
import { message } from 'antd';
import { T } from '../../config/theme';
import { t } from '../../i18n/t';
import { layerDomains, type LayerKey } from '../../config/permGroups';
import { STAFF_FORBIDDEN_PERMS } from '@h5design/core';
import { type OrgType } from '../../config/staffRoles';

/** 各层内置角色的根节点文案 */
const ROLE_META: Record<LayerKey, { name: string; scope: string }> = {
  console: { name: t('pages.col.consoleAdmin', '总台管理员'), scope: t('pages.lbl.full', '全量') },
  agent: { name: t('pages.col.agent', '代理商'), scope: t('pages.field.jurisdiction', '辖区') },
  provider: { name: t('pages.col.provider', '服务商'), scope: t('pages.col.self', '自身') },
  user: { name: t('pages.col.normalUser', '普通用户'), scope: t('pages.col.self', '自身') },
};

/* 径向布局（角色居中 · 业务域环绕）配色 */
const PASTELS = ['#fdeeba', '#eef7c8', '#d1f0d1', '#b9ecd4', '#c2eefa', '#cfe3fb', '#dbe0fb', '#ead9fb', '#fbd9ee', '#fce3cc'];
const LINES = ['#cdb83f', '#9db84a', '#6fbe6f', '#54bd90', '#5fbcd4', '#7ba4e4', '#968fe4', '#b884dc', '#dc84b6', '#e59f60'];
const INK = '#26303f';
const EDGE = '#7f8aa3';

const EASE = 'cubic-bezier(0.34, 1.25, 0.64, 1)';
const DUR = 360;

/* 简单连线（旋转 div，支持 left/top/width/transform 平滑过渡） */
function LineDiv({ x1, y1, x2, y2, delay = 0, fadeIn = false }: { x1: number; y1: number; x2: number; y2: number; delay?: number; fadeIn?: boolean }) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
  return (
    <div
      style={{
        position: 'absolute',
        left: x1,
        top: y1 - 0.75,
        width: len,
        height: 1.5,
        background: EDGE,
        opacity: 0.75,
        transformOrigin: '0 50%',
        transform: `rotate(${ang}deg)`,
        transition: `left ${DUR}ms ${EASE}, top ${DUR}ms ${EASE}, width ${DUR}ms ${EASE}, transform ${DUR}ms ${EASE}`,
        zIndex: 0,
        ...(fadeIn ? { animation: `pgFade 320ms ease both`, animationDelay: `${delay}ms` } : {}),
      }}
    />
  );
}

export function PermGraph({
  layer,
  org,
  onCreateWithPerms,
}: {
  layer: LayerKey;
  org: OrgType;
  onCreateWithPerms: (perms: string[]) => void;
}) {
  const domains = useMemo(() => layerDomains(layer), [layer]);
  const forbidden = useMemo(() => new Set(STAFF_FORBIDDEN_PERMS[org] ?? []), [org]);
  const [hovered, setHovered] = useState<string | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 760, h: 520 });

  /* 切层时重置交互态 */
  useEffect(() => {
    setActive(null);
    setHovered(null);
  }, [layer]);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((es) => {
      const r = es[0].contentRect;
      setSize({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const activeIdx = domains.findIndex((d) => d.id === active);
  const activeDom = activeIdx >= 0 ? domains[activeIdx] : null;
  const others = useMemo(() => domains.filter((d) => d.id !== active), [domains, active]);

  /* ── 几何：枢纽（角色）与环（业务域） ──
   * 初始态：枢纽居中，业务域以小圆贴近环绕。
   * 激活态：枢纽与其余域聚在左侧，激活域弹出于集群正右侧、同一水平线且尽量贴近；
   * 子节点在激活域下方铺开；其余域压缩成小圆环绕枢纽，环半径加大保持间距（不与枢纽重叠）。 */
  const hub = activeDom
    ? { x: Math.max(size.w * 0.33, 200), y: size.h * 0.5 }
    : { x: size.w * 0.5, y: size.h * 0.5 };
  const ringRx = activeDom ? Math.min(size.w * 0.16, 140) : Math.min(size.w * 0.25, 235);
  const ringRy = activeDom ? Math.min(size.h * 0.22, 104) : Math.min(size.h * 0.24, 132);

  /* 激活域弹出位与集群的边界间距（px） */
  const ACT_GAP = 100;
  /* 激活域展开宽度 / 缩放（与下方节点样式保持一致） */
  const ACT_W = 146;
  const ACT_SCALE = 1.32;

  const posOf = (id: string): { x: number; y: number } => {
    if (activeDom && id === active) {
      /* 激活域：集群正右侧 + 与枢纽同一水平线，边界间距约 ACT_GAP
       * 集群右缘 = max(枢纽半宽≈98, 迷你域外缘 ringRx+14)；激活域视觉半宽 = (ACT_W/2)*ACT_SCALE */
      const clusterRight = Math.max(98, ringRx + 14);
      const actHalfW = (ACT_W / 2) * ACT_SCALE;
      const x = hub.x + clusterRight + ACT_GAP + actHalfW;
      /* 防溢出容器 */
      return { x: Math.min(x, size.w - actHalfW - 8), y: hub.y };
    }
    const list = activeDom ? others : domains;
    const i = Math.max(list.findIndex((d) => d.id === id), 0);
    const n = Math.max(list.length, 1);
    const ang = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return { x: hub.x + ringRx * Math.cos(ang), y: hub.y + ringRy * Math.sin(ang) };
  };

  /* ── 缩放语义：
   * 激活态下激活域恒定 1.32（不随 hover 变化，仅重新点击其他域或点空白才改变），
   * 其余域 hover 时轻微放大作反馈；初始态 hover 聚焦放大、其余缩小。 */
  const scaleOf = (id: string) => {
    if (active) {
      if (id === active) return ACT_SCALE;
      return hovered === id ? 0.8 : 0.55;
    }
    if (hovered) return hovered === id ? 1.32 : 0.6;
    return 1;
  };
  /* 面板展开（显示徽标+域名）：激活态仅激活域；初始态为 hover 域 */
  const expanded = (id: string) => (active ? id === active : hovered === id);

  /* ── 展开态：active 域的权限点（纵向胶囊 · 最多 4 列换行 · 统一高度） ── */
  const pts = activeDom?.points ?? [];
  const cols = Math.min(4, pts.length) || 1;
  const pillW = 48;
  const gapX = 14;
  const gapY = 16;
  const pillH = (label: string) => label.length * 15 + 22;
  /* 统一高度：以字数最多的子节点为标准，字少的内容上下分散对齐 */
  const pillHMax = pts.length ? Math.max(...pts.map((p) => pillH(p.label))) : 0;
  const activePos = activeDom ? posOf(activeDom.id) : { x: 0, y: 0 };
  const ptsTop = activePos.y + 44;
  const pillPos = pts.map((p, j) => {
    const r = Math.floor(j / cols);
    const countInRow = Math.min(cols, pts.length - r * cols);
    const c = j % cols;
    return {
      x: activePos.x + (c - (countInRow - 1) / 2) * (pillW + gapX),
      y: ptsTop + r * (pillHMax + gapY) + pillHMax / 2,
    };
  });

  const onPointClick = (key: string) => {
    if (forbidden.has(key)) {
      message.warning(t('pages.team.permForbidden', '该权限不可委派给员工'));
      return;
    }
    onCreateWithPerms([key]);
  };

  if (domains.length === 0) {
    return (
      <div style={{ padding: 16, color: T.ink3, fontSize: 13 }}>
        {t('pages.permGraph.empty', '该角色层不参与运营端功能权限体系（0 域 / 0 点）。')}
      </div>
    );
  }

  const meta = ROLE_META[layer];
  const totalPts = domains.reduce((n, d) => n + d.points.length, 0);

  return (
    <div
      ref={ref}
      onClick={() => { setActive(null); setHovered(null); }}
      style={{ position: 'relative', height: 520, overflow: 'hidden', background: T.panel2, borderRadius: T.rMd, border: `1px solid ${T.border}` }}
    >
      <style>{`@keyframes pgFade { from { opacity: 0; transform: translate(-50%,-50%) translateY(6px); } to { opacity: 1; transform: translate(-50%,-50%) translateY(0); } }`}</style>

      {/* 操作提示 */}
      <div
        style={{
          position: 'absolute', top: 10, left: 14, zIndex: 5,
          fontSize: 12, color: T.ink3, pointerEvents: 'none', userSelect: 'none',
        }}
      >
        {t('pages.permGraph.hint', '悬停放大业务域 · 点击展开权限点 · 点击空白处或其他业务域收起')}
      </div>

      {/* 连线：枢纽 → 各业务域 */}
      {domains.map((d) => {
        const p = posOf(d.id);
        return <LineDiv key={`e:${d.id}`} x1={hub.x} y1={hub.y} x2={p.x} y2={p.y} />;
      })}

      {/* 连线：active 域 → 权限点 */}
      {activeDom &&
        pts.map((p, j) => (
          <LineDiv
            key={`ep:${p.key}`}
            x1={activePos.x}
            y1={activePos.y + 20}
            x2={pillPos[j].x}
            y2={pillPos[j].y - pillHMax / 2 - 2}
            delay={80 + j * 50}
            fadeIn
          />
        ))}

      {/* 枢纽：角色节点 */}
      <div
        onClick={(e) => { e.stopPropagation(); setActive(null); }}
        style={{
          position: 'absolute',
          left: hub.x,
          top: hub.y,
          transform: `translate(-50%,-50%) scale(${activeDom ? 0.92 : 1})`,
          transition: `left ${DUR}ms ${EASE}, top ${DUR}ms ${EASE}, transform ${DUR}ms ${EASE}`,
          width: 212,
          borderRadius: 12,
          overflow: 'hidden',
          border: `1.5px solid ${T.border}`,
          boxShadow: '0 8px 22px rgba(0,0,0,.35)',
          zIndex: 2,
          userSelect: 'none',
        }}
      >
        <div style={{ background: T.accent, color: '#fff', textAlign: 'center', fontWeight: 700, fontSize: 15, padding: '8px 0', letterSpacing: 1 }}>
          {meta.name}
        </div>
        <div style={{ background: '#fff', color: INK, textAlign: 'center', fontSize: 12.5, padding: '7px 10px', lineHeight: 1.7 }}>
          <div>{t('pages.lbl.dataScope', '数据作用域')}：{meta.scope}</div>
          <div style={{ fontFamily: T.fontNum, fontWeight: 600 }}>[ {domains.length}域 / {totalPts}点 ]</div>
        </div>
      </div>

      {/* 业务域节点（环形分布） */}
      {domains.map((d, i) => {
        const p = posOf(d.id);
        const sc = scaleOf(d.id);
        const exp = expanded(d.id);
        return (
          <div
            key={d.id}
            onMouseEnter={() => setHovered(d.id)}
            onMouseLeave={() => setHovered(null)}
            onClick={(e) => {
              e.stopPropagation();
              setHovered(null);
              setActive(d.id);
            }}
            style={{
              position: 'absolute',
              left: p.x,
              top: p.y,
              transform: `translate(-50%,-50%) scale(${sc})`,
              transition: `left ${DUR}ms ${EASE}, top ${DUR}ms ${EASE}, transform ${DUR}ms ${EASE}, width ${DUR}ms ${EASE}, height ${DUR}ms ${EASE}, border-radius ${DUR}ms ${EASE}, box-shadow ${DUR}ms ${EASE}`,
              width: exp ? ACT_W : 52,
              height: 52,
              background: PASTELS[i % PASTELS.length],
              border: `1.5px solid ${LINES[i % LINES.length]}`,
              borderRadius: exp ? 24 : 26,
              overflow: 'hidden',
              boxShadow: exp ? '0 6px 18px rgba(0,0,0,.4)' : 'none',
              cursor: 'pointer',
              zIndex: 3,
              userSelect: 'none',
            }}
          >
            {/* 序号面（无前导零） */}
            <span
              style={{
                position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                opacity: exp ? 0 : 1, transition: `opacity 220ms ease`,
                fontWeight: 700, fontSize: 20, color: INK, fontFamily: T.fontNum,
              }}
            >
              {i + 1}
            </span>
            {/* 聚焦面：徽标 + 域名 */}
            <span
              style={{
                position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                opacity: exp ? 1 : 0, transition: `opacity 240ms ease`, pointerEvents: 'none',
              }}
            >
              <span
                style={{
                  width: 20, height: 20, borderRadius: '50%', background: INK, color: '#fff',
                  fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none',
                }}
              >
                {i + 1}
              </span>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: INK, whiteSpace: 'nowrap' }}>{d.label}</span>
            </span>
          </div>
        );
      })}

      {/* 权限点（active 域下方 · 纵向胶囊） */}
      {activeDom &&
        pts.map((p, j) => {
          const isForb = forbidden.has(p.key);
          return (
            <div
              key={p.key}
              onClick={(e) => { e.stopPropagation(); onPointClick(p.key); }}
              style={{
                position: 'absolute',
                left: pillPos[j].x,
                top: pillPos[j].y,
                transform: 'translate(-50%,-50%)',
                width: pillW,
                height: pillHMax,
                background: isForb ? T.downBg : PASTELS[activeIdx % PASTELS.length],
                border: `1.5px solid ${isForb ? T.down : LINES[activeIdx % LINES.length]}`,
                borderRadius: 10,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'space-evenly',
                padding: '6px 0',
                fontSize: 13,
                lineHeight: 1.2,
                fontWeight: 600,
                color: isForb ? T.down : INK,
                cursor: isForb ? 'not-allowed' : 'pointer',
                zIndex: 3,
                animation: 'pgFade 340ms ease both',
                animationDelay: `${60 + j * 50}ms`,
                boxShadow: '0 3px 10px rgba(0,0,0,.28)',
              }}
              title={isForb ? t('pages.team.permForbidden', '该权限不可委派给员工') : p.label}
            >
              {p.label.split('').map((ch, k) => (
                <span key={k}>{ch}</span>
              ))}
            </div>
          );
        })}
    </div>
  );
}
