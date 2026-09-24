import { useEffect, useState } from 'react';
import { Modal, Input, Checkbox, Tag, Typography, Divider, Alert, Button } from 'antd';
import { T } from '../../config/theme';

const { Text } = Typography;

/** 红线类别（与后端 REDLINE_CATEGORIES 固定分类法一致） */
export const REDLINE_CATEGORIES: { key: string; label: string }[] = [
  { key: 'political', label: '政治敏感' },
  { key: 'ideology', label: '意识形态' },
  { key: 'porn', label: '色情低俗' },
  { key: 'violence', label: '暴力恐怖' },
  { key: 'gambling', label: '赌博' },
  { key: 'drug', label: '毒品' },
  { key: 'fraud', label: '诈骗' },
  { key: 'infringement', label: '侵权' },
  { key: 'false_ad', label: '虚假宣传' },
  { key: 'other', label: '其他' },
];

const redlineLabel = (k?: string | null) =>
  REDLINE_CATEGORIES.find((c) => c.key === k)?.label ?? (k ? k : '—');

export interface KVField {
  label: string;
  value: React.ReactNode;
}

interface Props {
  open: boolean;
  title: string;
  tag?: string;
  readonly?: boolean;
  loading?: boolean;
  /** 详情字段（KV 列表） */
  fields?: KVField[];
  /** 已命中的机审红线词（若有），高亮提示 */
  machineHits?: { words: string[]; categories: string[] } | null;
  onApprove: (reason?: string) => void;
  onReject: (reason: string, redlineCategory: string) => void;
  onClose: () => void;
}

/**
 * 红线审核模态（v2 内容审核闸口专用）。
 * - 通过：可选填写审核意见。
 * - 驳回：必须填写意见，且必须从红线类别中勾选至少一项（落地 redlineCategory）。
 */
export const RedlineReviewModal = ({
  open,
  title,
  tag = '审核',
  readonly,
  loading,
  fields = [],
  machineHits,
  onApprove,
  onReject,
  onClose,
}: Props) => {
  const [mode, setMode] = useState<'view' | 'approve' | 'reject'>('view');
  const [reason, setReason] = useState('');
  const [cats, setCats] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setMode('view');
      setReason('');
      setCats([]);
    }
  }, [open]);

  const canSubmit = mode === 'approve'
    ? true
    : mode === 'reject'
      ? !!reason.trim() && cats.length > 0
      : false;

  const submit = () => {
    if (!canSubmit) return;
    if (mode === 'approve') onApprove(reason.trim() || undefined);
    else if (mode === 'reject') onReject(reason.trim(), cats[0]);
  };

  return (
    <Modal
      open={open}
      title={title}
      onCancel={onClose}
      width={620}
      maskClosable={false}
      footer={
        readonly ? (
          <Button onClick={onClose}>关闭</Button>
        ) : (
          <>
            <Button onClick={onClose}>取消</Button>
            <Button
              type="primary"
              style={{ background: T.upInk, borderColor: T.upInk }}
              loading={loading}
              disabled={mode !== 'approve' && mode !== 'reject'}
              onClick={submit}
            >
              提交审核决定
            </Button>
          </>
        )
      }
    >
      {tag && (
        <Tag color="purple" style={{ marginBottom: 12 }}>
          {tag}
        </Tag>
      )}

      {/* 机审命中提示 */}
      {machineHits && machineHits.words.length > 0 && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 12 }}
          message="机审命中红线词"
          description={
            <div style={{ fontSize: 13 }}>
              <div>命中词：{machineHits.words.join('、')}</div>
              <div style={{ marginTop: 4 }}>
                命中类别：
                {machineHits.categories.map((c) => (
                  <Tag key={c} color="red">
                    {redlineLabel(c)}
                  </Tag>
                ))}
              </div>
            </div>
          }
        />
      )}

      {/* 详情字段 */}
      {fields.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          {fields.map((f, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                gap: 10,
                padding: '7px 0',
                borderBottom: i < fields.length - 1 ? `1px solid ${T.border}` : 'none',
              }}
            >
              <Text style={{ width: 96, color: T.ink3, flex: 'none' }}>{f.label}</Text>
              <div style={{ flex: 1, color: T.ink1 }}>{f.value}</div>
            </div>
          ))}
        </div>
      )}

      <Divider style={{ margin: '14px 0' }} />

      {/* 审核操作 */}
      {!readonly && (
        <div>
          <div style={{ marginBottom: 10 }}>
            <Text strong>审核决定</Text>
            <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
              <Tag.CheckableTag
                checked={mode === 'approve'}
                onChange={() => setMode('approve')}
                style={mode === 'approve' ? { background: T.upInk, color: '#fff' } : {}}
              >
                通过（放行上架）
              </Tag.CheckableTag>
              <Tag.CheckableTag
                checked={mode === 'reject'}
                onChange={() => setMode('reject')}
                style={mode === 'reject' ? { background: T.downInk, color: '#fff' } : {}}
              >
                驳回（红线拦截）
              </Tag.CheckableTag>
            </div>
          </div>

          {mode === 'reject' && (
            <div style={{ marginBottom: 10 }}>
              <Text style={{ color: T.ink2 }}>
                红线类别（必选）<span style={{ color: T.downInk }}> *</span>
              </Text>
              <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {REDLINE_CATEGORIES.map((c) => (
                  <Checkbox
                    key={c.key}
                    checked={cats.includes(c.key)}
                    onChange={(e) =>
                      setCats((prev) =>
                        e.target.checked
                          ? [...prev, c.key]
                          : prev.filter((x) => x !== c.key),
                      )
                    }
                  >
                    {c.label}
                  </Checkbox>
                ))}
              </div>
            </div>
          )}

          <div>
            <Text style={{ color: T.ink2 }}>
              审核意见{mode === 'reject' ? '（必填）' : '（可选）'}
              <span style={{ color: T.downInk }}> *</span>
            </Text>
            <Input.TextArea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              style={{ marginTop: 6 }}
              placeholder={
                mode === 'reject'
                  ? '请说明驳回/红线拦截的具体原因，将反馈给服务商'
                  : '可填写放行说明（可选）'
              }
            />
          </div>
        </div>
      )}

      {readonly && (
        <Text type="secondary">当前为视察只读视图，不可执行审核操作。</Text>
      )}
    </Modal>
  );
};
