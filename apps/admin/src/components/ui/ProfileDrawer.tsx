import { Drawer, Spin } from 'antd';
import { useCustom } from '@refinedev/core';
import { getStoredUser } from '../../utility';
import { T } from '../../config/theme';
import { AccountDetailSections, type AccountProfile } from '../../pages/account/ProfilePage';

interface Props {
  open: boolean;
  /** 传入则为查看被监督对象(subject)；不传则查看登录者自身(operator) */
  userId?: string;
  title: string;
  onClose: () => void;
}

/**
 * 用户资料抽屉：与「账户详情」页共用同一套四分区布局（AccountDetailSections），
 * 保证 operator 自身与 subject（被监督对象）看到的口径一致。
 * - operator（自身）：直接读 getStoredUser()，所有角色可用。
 * - subject（被监督对象）：GET /api/admin/users/:id（ADMIN 全量 / AGENT 辖区内可见）。
 * 角色专属第四区块：ADMIN 职能与权限 / AGENT 辖区经营 / SP 服务与资质 / USER 会员与资产。
 */
export const ProfileDrawer = ({ open, userId, title, onClose }: Props) => {
  const stored = getStoredUser<AccountProfile>();
  const { data, isLoading } = useCustom({
    url: userId ? `admin/users/${userId}` : 'me',
    method: 'get',
    queryOptions: { enabled: !!userId && open },
  });

  const payload: any = (data as any)?.data;
  const subject = (payload?.data ?? payload) as AccountProfile | null | undefined;
  const profile = (userId ? subject : stored) ?? undefined;

  return (
    <Drawer title={title} open={open} onClose={onClose} width={560} styles={{ body: { padding: 16 } }}>
      {userId && isLoading ? (
        <div style={{ padding: 48, display: 'grid', placeItems: 'center' }}>
          <Spin />
        </div>
      ) : !profile ? (
        <span style={{ color: T.ink3 }}>暂无资料</span>
      ) : (
        <AccountDetailSections profile={profile} />
      )}
    </Drawer>
  );
};

export default ProfileDrawer;
