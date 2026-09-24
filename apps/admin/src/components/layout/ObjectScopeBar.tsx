import { AutoComplete, Button } from 'antd';
import { useEffect, useState } from 'react';
import { useLayer } from '../../providers/layerContext';
import { T } from '../../config/theme';
import { t } from '../../i18n/t';
import { roleText } from '../../config/labels';
import { API_URL, authHeaders } from '../../utility';

export interface ObjectScopeBarProps {
  placeholder?: string;
}

/**
 * 对象视角检索条（原型 .objpick）。
 * 管理员在代理商 / 服务商 / 用户视角下，按 ID / 用户名(昵称) / 姓名 / 手机号检索具体对象，
 * 选中后写入 layerContext.objectScope，整页联动到该对象名下数据。
 * 检索按当前视角限定对象类型（服务商视角只出服务商、用户视角只出用户……），避免选错角色导致模块空数据。
 * 真实检索走 /api/user/resolve，后端回落种子演示用户，页面始终有数据。
 *
 * 视角隔离：objectScope 按视角各自记忆（见 layerContext）。切换视角时输入框立即回落到
 * 「当前视角」自己槽位的对象（或空），不会把其它视角的选中账号带进本视角检索框。
 */
export const ObjectScopeBar = ({ placeholder }: ObjectScopeBarProps) => {
  const { view, objectScope, setObjectScope } = useLayer();
  const [options, setOptions] = useState<{ value: string; label: string; id: string }[]>([]);
  const [value, setValue] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  /**
   * 切换视角时：输入框回落到「当前视角」自己选中的对象文案（或空），
   * 清空下拉与展开态，避免前一视角的检索内容穿插进本视角检索框。
   * 若当前视角此前已选过对象，则回落显示该视角自己的对象（保留各视角独立状态）。
   */
  useEffect(() => {
    setValue(objectScope?.label ?? '');
    setOptions([]);
    setOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  /** 当前视角对应的被视察对象角色（与后端 @Roles / 作用域对齐） */
  const targetRole =
    view === 'agent' ? 'AGENT' : view === 'provider' ? 'SERVICE_PROVIDER' : 'USER';

  /**
   * 对象检索：直接 fetch /api/user/resolve（带鉴权）。
   * 注意：不能用 useCustom 包 URL —— 其 url 在挂载时定格，refetch() 仍用旧 key，
   * 导致输入关键字后永远拿不到新结果。这里每次输入实时请求，选项随之更新。
   */
  const runSearch = async (v: string) => {
    if (!v) {
      setOptions([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    try {
      const url = `${API_URL}/user/resolve?keyword=${encodeURIComponent(v)}&role=${encodeURIComponent(
        targetRole,
      )}`;
      const res = await fetch(url, { headers: authHeaders() });
      if (!res.ok) {
        setOptions([]);
        return;
      }
      const body: any = await res.json();
      const items: any[] = body?.items ?? [];
      setOptions(
        items.map((u) => {
          const label = `${u.nickname || u.realName || u.phone || u.id}（${roleText(u.role)}·${
            u.phone ?? ''
          }）`;
          return {
            // value 用展示文案：AutoComplete 选中后会把 option.value 回填进输入框，
            // 若用原始 id 会显示英文键值；真实 id 挂在自定义字段 onSelect 里取。
            value: label,
            label,
            id: u.id,
          };
        }),
      );
      setOpen(true);
    } catch {
      setOptions([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 24px',
        borderBottom: `1px solid ${T.border}`,
        background: `color-mix(in srgb, ${T.warn} 7%, ${T.bg})`,
        flexWrap: 'wrap',
      }}
    >
      <span
        style={{
          fontSize: 12.5,
          fontWeight: 700,
          color: T.warnInk,
          whiteSpace: 'nowrap',
        }}
      >
        搜索
      </span>

      <div style={{ position: 'relative', minWidth: 320, flex: '0 1 320px' }}>
        <AutoComplete
          value={value}
          options={options}
          open={open}
          data-testid="objscope-search"
          onOpenChange={(v) => setOpen(v)}
          onChange={(v) => setValue(v)}
          onSearch={(v) => {
            setValue(v);
            runSearch(v);
          }}
          onSelect={(_v, opt) => {
            setObjectScope({ type: view, id: (opt as any).id, label: (opt as any).label });
            setOpen(false);
          }}
          placeholder={placeholder ?? '输入 ID / 用户名 / 昵称 / 手机号 后点「检索」'}
          style={{ width: '100%' }}
          allowClear
          onClear={() => {
            setValue('');
            setObjectScope(null);
            setOpen(false);
          }}
        />
      </div>

      <Button
        type="primary"
        loading={loading}
        onClick={() => runSearch(value)}
        style={{
          background: T.accent,
          borderColor: T.accent,
          whiteSpace: 'nowrap',
          minHeight: 0,
        }}
      >
        检索
      </Button>

      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 12,
          padding: '3px 10px',
          borderRadius: 999,
          background: T.warnBg,
          color: T.warnInk,
          fontWeight: 600,
          whiteSpace: 'nowrap',
        }}
      >
        {objectScope ? objectScope.label : '未选定对象 · 展示默认样例'}
      </span>
    </div>
  );
};

export default ObjectScopeBar;
