import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Modal, Form, Input, InputNumber, Select, Tag, message } from 'antd';
import { PageHead } from '../components/ui/PageHead';
import { Panel } from '../components/ui/Panel';
import { EmptyState } from '../components/common/EmptyState';
import { T } from '../config/theme';
import { useSubjectScope } from './user/invitationShared';
import {
  listGroups,
  getGroup,
  createGroup,
  updateGroup,
  deleteGroup,
  addMembers,
  removeMembers,
  listCandidates,
  type MarketingGroup,
  type GroupMember,
  type MemberType,
  type Candidate,
} from './marketingGroupApi';

const SCENE_OPTIONS = [
  { label: '婚礼', value: 'wedding' },
  { label: '满月', value: 'baby' },
  { label: '周年', value: 'anniversary' },
  { label: '其他', value: 'custom' },
];

const MEMBER_TYPE_OPTIONS = [
  { label: '客户', value: 'CLIENT' },
  { label: '名单', value: 'GUEST_LIST' },
  { label: '请柬项目', value: 'BATCH_PROJECT' },
];

const cell: React.CSSProperties = { padding: '8px 12px', borderBottom: `1px solid ${T.border}` };

const sceneColor: Record<string, string> = {
  wedding: T.accent,
  baby: T.accent2,
  anniversary: T.up,
  custom: T.ink3,
};

const MEMBER_TYPE_LABEL: Record<MemberType, string> = {
  CLIENT: '客户',
  GUEST_LIST: '名单',
  BATCH_PROJECT: '请柬项目',
};

const MEMBER_TYPE_COLOR: Record<MemberType, string> = {
  CLIENT: T.accent,
  GUEST_LIST: T.accent2,
  BATCH_PROJECT: T.ink3,
};

function fmt(ts?: string) {
  return ts ? new Date(ts).toLocaleString() : '—';
}

/* ───────────────────────── 列表页 ───────────────────────── */

export function SPInvitationGroups() {
  const navigate = useNavigate();
  const { subject, canWrite } = useSubjectScope();

  const [rows, setRows] = useState<MarketingGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<MarketingGroup | null>(null);
  const [form] = Form.useForm<Partial<MarketingGroup>>();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listGroups(subject);
      setRows(Array.isArray(data) ? data : []);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [subject]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ sortOrder: 0, scene: 'wedding' });
    setModalOpen(true);
  };

  const openEdit = (r: MarketingGroup) => {
    setEditing(r);
    form.resetFields();
    form.setFieldsValue({
      name: r.name,
      scene: r.scene,
      description: r.description,
      sortOrder: r.sortOrder ?? 0,
    });
    setModalOpen(true);
  };

  const onOk = async () => {
    try {
      const values = await form.validateFields();
      if (editing) {
        await updateGroup(editing.id, values, subject);
        message.success('分组已更新');
      } else {
        await createGroup(values, subject);
        message.success('分组已创建');
      }
      setModalOpen(false);
      void load();
    } catch (e) {
      if (e instanceof Error) setError(e.message);
    }
  };

  const onDelete = async (r: MarketingGroup) => {
    if (!window.confirm(`确定删除分组「${r.name}」？分组及其成员关系将一并移除，且不可恢复。`)) return;
    try {
      await deleteGroup(r.id, subject);
      message.success('分组已删除');
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <>
      <PageHead title="请柬营销分组" chip="请柬营销" />
      <Panel title="分组列表" hint={canWrite ? undefined : '监督态只读'}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 12px 12px' }}>
          <Button type="primary" disabled={!canWrite} onClick={openCreate}>
            ＋ 新建分组
          </Button>
        </div>
        {error && (
          <div style={{ padding: '0 12px 12px', color: T.down, fontSize: 12 }}>{error}</div>
        )}

        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: T.ink3 }}>…</div>
        ) : !rows.length ? (
          <div style={{ padding: 32 }}>
            <EmptyState description="暂无营销分组，点击右上角「新建分组」开始" />
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: T.panel2, textAlign: 'left', color: T.ink2 }}>
                <th style={cell}>分组名称</th>
                <th style={cell}>投放场景</th>
                <th style={cell}>成员数</th>
                <th style={cell}>更新时间</th>
                <th style={cell}>操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td style={{ ...cell, color: T.ink1 }}>{r.name}</td>
                  <td style={cell}>
                    {r.scene ? (
                      <Tag color={sceneColor[r.scene] ?? T.ink3}>
                        {SCENE_OPTIONS.find((o) => o.value === r.scene)?.label ?? r.scene}
                      </Tag>
                    ) : (
                      <span style={{ color: T.ink3 }}>—</span>
                    )}
                  </td>
                  <td style={cell}>{r.memberCount}</td>
                  <td style={cell}>{fmt(r.updatedAt)}</td>
                  <td style={cell}>
                    <Button
                      type="link"
                      style={{ padding: 0, color: T.accent }}
                      onClick={() => navigate(`/sp/invitations/groups/${r.id}`)}
                    >
                      详情
                    </Button>
                    <Button
                      type="link"
                      style={{ padding: 0, color: T.accent }}
                      disabled={!canWrite}
                      onClick={() => openEdit(r)}
                    >
                      编辑
                    </Button>
                    <Button
                      type="link"
                      style={{ padding: 0, color: canWrite ? T.down : T.ink3 }}
                      disabled={!canWrite}
                      onClick={() => void onDelete(r)}
                    >
                      删除
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      <Modal
        open={modalOpen}
        title={editing ? '编辑分组' : '新建分组'}
        onCancel={() => setModalOpen(false)}
        onOk={onOk}
        okText="保存"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="分组名称" rules={[{ required: true, message: '请输入分组名称' }]}>
            <Input placeholder="如：婚礼高净值客户" />
          </Form.Item>
          <Form.Item name="scene" label="投放场景">
            <Select options={SCENE_OPTIONS} placeholder="选择投放场景" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} placeholder="可选，备注分组用途" />
          </Form.Item>
          <Form.Item name="sortOrder" label="排序（越小越靠前）">
            <InputNumber min={0} defaultValue={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

/* ───────────────────────── 详情页 ───────────────────────── */

export function SPInvitationGroupDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { subject, canWrite } = useSubjectScope();

  const [group, setGroup] = useState<MarketingGroup | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());

  const [addOpen, setAddOpen] = useState(false);
  const [addMemberType, setAddMemberType] = useState<MemberType | undefined>();
  const [addCandidates, setAddCandidates] = useState<Candidate[]>([]);
  const [addSelected, setAddSelected] = useState<string[]>([]);
  const [addLoading, setAddLoading] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const g = await getGroup(id, subject);
      setGroup({
        id: g.id,
        name: g.name,
        description: g.description,
        scene: g.scene,
        sortOrder: g.sortOrder,
        memberCount: g.memberCount,
        updatedAt: g.updatedAt,
      });
      setMembers(Array.isArray(g.members) ? g.members : []);
      setCheckedIds(new Set());
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [id, subject]);

  useEffect(() => {
    void load();
  }, [load]);

  // 切换成员类型时拉取候选列表
  const onMemberTypeChange = async (mt: MemberType) => {
    setAddMemberType(mt);
    setAddSelected([]);
    try {
      const c = await listCandidates(mt, subject);
      setAddCandidates(Array.isArray(c) ? c : []);
    } catch {
      setAddCandidates([]);
    }
  };

  const openAdd = () => {
    setAddMemberType(undefined);
    setAddCandidates([]);
    setAddSelected([]);
    setAddLoading(false);
    setAddOpen(true);
  };

  const confirmAdd = async () => {
    if (!addMemberType || !addSelected.length) {
      message.warning('请选择成员类型与至少一个成员');
      return;
    }
    setAddLoading(true);
    try {
      await addMembers(
        id,
        addSelected.map((memberId) => ({ memberType: addMemberType, memberId })),
        subject,
      );
      message.success(`已添加 ${addSelected.length} 个成员`);
      setAddOpen(false);
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setAddLoading(false);
    }
  };

  const removeOne = async (memberId: string) => {
    try {
      await removeMembers(id, [memberId], subject);
      message.success('已移除成员');
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const removeChecked = async () => {
    if (!checkedIds.size) return;
    try {
      await removeMembers(id, [...checkedIds], subject);
      message.success(`已移除 ${checkedIds.size} 个成员`);
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const toggleCheck = (memberId: string) =>
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) next.delete(memberId);
      else next.add(memberId);
      return next;
    });

  return (
    <>
      <PageHead
        title={group?.name ?? '分组详情'}
        chip="请柬营销"
        onBack={() => navigate('/sp/invitations/groups')}
      />

      {error && <div style={{ color: T.down, fontSize: 12, marginBottom: 12 }}>{error}</div>}

      {loading ? (
        <div style={{ padding: 32, textAlign: 'center', color: T.ink3 }}>…</div>
      ) : (
        <>
          <Panel title="分组信息">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px 32px', padding: 16, fontSize: 14 }}>
              <Info label="分组名称" value={group?.name ?? '—'} />
              <Info
                label="投放场景"
                value={
                  group?.scene ? (
                    <Tag color={sceneColor[group.scene] ?? T.ink3}>
                      {SCENE_OPTIONS.find((o) => o.value === group.scene)?.label ?? group.scene}
                    </Tag>
                  ) : (
                    '—'
                  )
                }
              />
              <Info label="成员数" value={String(group?.memberCount ?? 0)} />
              <Info label="更新时间" value={fmt(group?.updatedAt)} />
              <Info label="描述" value={group?.description || '—'} />
            </div>
          </Panel>

          <Panel title="成员管理" hint={canWrite ? undefined : '监督态只读'}>
            <div style={{ display: 'flex', gap: 8, padding: '0 12px 12px' }}>
              <Button type="primary" disabled={!canWrite} onClick={openAdd}>
                批量添加成员
              </Button>
              <Button danger disabled={!canWrite || checkedIds.size === 0} onClick={() => void removeChecked()}>
                批量移除{checkedIds.size ? ` (${checkedIds.size})` : ''}
              </Button>
            </div>
            {!members.length ? (
              <div style={{ padding: 32 }}>
                <EmptyState description="该分组暂无成员，点击「批量添加成员」" />
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ background: T.panel2, textAlign: 'left', color: T.ink2 }}>
                    <th style={{ ...cell, width: 40 }}></th>
                    <th style={cell}>成员</th>
                    <th style={cell}>类型</th>
                    <th style={cell}>排序</th>
                    <th style={cell}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => (
                    <tr key={m.id}>
                      <td style={cell}>
                        <input
                          type="checkbox"
                          checked={checkedIds.has(m.id)}
                          disabled={!canWrite}
                          onChange={() => toggleCheck(m.id)}
                          style={{ width: 16, height: 16, accentColor: T.accent }}
                        />
                      </td>
                      <td style={{ ...cell, color: T.ink1 }}>{m.label ?? m.memberId}</td>
                      <td style={cell}>
                        <Tag color={MEMBER_TYPE_COLOR[m.memberType]}>{MEMBER_TYPE_LABEL[m.memberType]}</Tag>
                      </td>
                      <td style={cell}>{m.sortOrder}</td>
                      <td style={cell}>
                        <Button
                          type="link"
                          style={{ padding: 0, color: canWrite ? T.down : T.ink3 }}
                          disabled={!canWrite}
                          onClick={() => void removeOne(m.id)}
                        >
                          移除
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        </>
      )}

      <Modal
        open={addOpen}
        title="批量添加成员"
        onCancel={() => setAddOpen(false)}
        onOk={confirmAdd}
        okText="确认添加"
        cancelText="取消"
        confirmLoading={addLoading}
        destroyOnClose
      >
        <Form layout="vertical">
          <Form.Item label="成员类型" required>
            <Select
              placeholder="选择成员类型"
              value={addMemberType}
              options={MEMBER_TYPE_OPTIONS}
              onChange={(v) => void onMemberTypeChange(v)}
            />
          </Form.Item>
          <Form.Item label="选择成员">
            <Select
              mode="multiple"
              placeholder={addMemberType ? '可多选' : '请先选择成员类型'}
              value={addSelected}
              disabled={!addMemberType}
              options={addCandidates.map((c) => ({ label: c.label, value: c.id }))}
              onChange={(v) => setAddSelected(v)}
              style={{ width: '100%' }}
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 12, color: T.ink3 }}>{label}</span>
      <span style={{ color: T.ink1, fontWeight: 600 }}>{value}</span>
    </div>
  );
}
