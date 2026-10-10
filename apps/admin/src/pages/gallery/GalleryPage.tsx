import { UploadOutlined } from '@ant-design/icons';
import { Spin, Empty, Progress } from 'antd';
import { t } from '../../i18n/t';
import {
  GalleryCard,
  PreviewModal,
  CropModal,
  useGalleryData,
  useInspectSubject,
  tierLabel,
} from '../../gallery/galleryShared';
import type { GalleryLayer } from '../../gallery/galleryShared';

/**
 * 运营端「我的图库」整页（服务商 / 代理商 / 用户视角共用）。
 *
 * 图库数据 / 配额 / 上传 / 删除 / 裁剪逻辑已抽到 apps/admin/src/gallery/galleryShared.tsx，
 * 与编辑器内「选择图片」弹窗（GalleryPickerModal）共用同一套真值，保证两端行为完全一致。
 * 本页只负责把共享 hook 的数据/操作渲染成整页 UI。
 */
export function GalleryPage({ layer }: { layer?: GalleryLayer }) {
  const subject = useInspectSubject();
  const {
    list,
    quota,
    loading,
    uploading,
    uploadPct,
    previewId,
    setPreviewId,
    cropId,
    setCropId,
    full,
    upgradeHref,
    fetchUrl,
    upload,
    confirmRemove,
  } = useGalleryData(subject, layer);

  return (
    <div style={{ padding: 16 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h2 style={{ margin: 0 }}>{t('gallery.title', { defaultValue: '我的图库' })}</h2>
          <div style={{ color: '#888', fontSize: 13, marginTop: 4 }}>
            {quota
              ? `${t('gallery.used', { defaultValue: '已用' })} ${quota.used} / ${quota.limit} · ${
                  tierLabel(quota) || (quota.plan === 'PAID'
                    ? t('gallery.paid', { defaultValue: '会员' })
                    : t('gallery.free', { defaultValue: '免费' }))
                }`
              : t('gallery.loading', { defaultValue: '配额加载中…' })}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {full && (
            <>
              <span style={{ color: '#c0392b', fontSize: 12 }}>
                {t('gallery.fullHint', { defaultValue: `已达上限 ${quota?.limit ?? 0} 张，扩容后可继续上传` })}
              </span>
              <a href={upgradeHref} style={{ color: '#c24b2e' }}>
                {t('gallery.upgrade', { defaultValue: '去扩容' })}
              </a>
            </>
          )}
          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 12px',
              background: full ? '#d9d9d9' : '#c24b2e',
              color: '#fff',
              borderRadius: 6,
              cursor: full ? 'not-allowed' : 'pointer',
              opacity: full ? 0.7 : 1,
            }}
          >
            <UploadOutlined />
            {t('gallery.upload', { defaultValue: '上传图片' })}
            <input
              type="file"
              accept="image/*"
              disabled={full || uploading}
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) upload(f);
                e.target.value = '';
              }}
            />
          </label>
        </div>
      </div>

      {uploading && (
        <div style={{ marginBottom: 12, maxWidth: 320 }}>
          <Progress percent={uploadPct} />
        </div>
      )}

      {loading ? (
        <div style={{ padding: 48, textAlign: 'center' }}>
          <Spin />
        </div>
      ) : list.length === 0 ? (
        <Empty description={t('gallery.empty', { defaultValue: '暂无图片，点击右上角上传' })} />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
            gap: 12,
          }}
        >
          {list.map((a) => (
            <GalleryCard
              key={a.id}
              asset={a}
              fetchUrl={fetchUrl}
              onPreview={() => setPreviewId(a.id)}
              onDelete={() => confirmRemove(a)}
              onCrop={() => setCropId(a.id)}
              onSelect={() => setPreviewId(a.id)}
            />
          ))}
        </div>
      )}

      <PreviewModal id={previewId} fetchUrl={fetchUrl} onClose={() => setPreviewId(null)} />
      <CropModal
        id={cropId}
        fetchUrl={fetchUrl}
        subject={subject}
        quota={quota}
        onClose={() => setCropId(null)}
        onDone={() => {
          setCropId(null);
        }}
      />
    </div>
  );
}
