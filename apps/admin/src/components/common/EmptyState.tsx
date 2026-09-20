import { Empty } from 'antd';
import { t } from "../../i18n/t";

/** 空状态引导（文档 §11.5 / §6.2） */
export const EmptyState = ({ description }: { description?: string }) => {
  return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={description ?? t('common.empty')} />;
};

export default EmptyState;
