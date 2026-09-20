import { Result, Button } from 'antd';
import { t } from "../../i18n/t";
import { T } from '../../config/theme';

/** 异常态：错误提示 + 重试（文档 §11.5 / §6.2） */
export const ErrorState = ({ message, onRetry }: { message?: string; onRetry?: () => void }) => {
  return (
    <Result
      status="error"
      title={message ?? t('common.error')}
      extra={
        onRetry ? (
          <Button type="primary" style={{ background: T.accent }} onClick={onRetry}>
            {t('common.retry')}
          </Button>
        ) : undefined
      }
    />
  );
};

export default ErrorState;
