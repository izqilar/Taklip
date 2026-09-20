import { useCustom } from '@refinedev/core';
import { Row, Col, Card, Statistic, Descriptions, Spin, Typography } from 'antd';
import { type ReactNode } from 'react';
import { formatCents } from '../utility';
import { StatusTag } from './common/StatusTag';
import { EmptyState } from './common/EmptyState';
import { ErrorState } from './common/ErrorState';
import { DonutShare, type DonutDatum } from './charts/DonutShare';
import { BarCompare, type BarDatum } from './charts/BarCompare';
import { boolText, serviceRolesText, msgTypeText, msgScopeText, categoryText } from '../config/labels';
import { t } from "../i18n/t";

export interface CardDef {
  label: string;
  path: string;
  format?: 'cents' | 'number';
  color?: string;
}
export interface FieldDef {
  label: string;
  path: string;
  format?: 'cents' | 'array' | 'text' | 'status' | 'date' | 'bool' | 'roles' | 'category' | 'type' | 'scope';
}

/** 看板图表声明（M3-①）：从 payload 指定路径取数组，渲染环形/条形图 */
export interface ChartDef {
  title: string;
  type: 'donut' | 'bar';
  /** payload 中数组字段路径，如 'serviceCategoryShare' */
  dataPath: string;
  /** 数组元素的标签键（默认 label） */
  labelKey?: string;
  /** 数组元素的值键（默认 value） */
  valueKey?: string;
  /** 值缩放（如 0.01 将分转元用于展示） */
  valueScale?: number;
  unit?: string;
  color?: string;
}

export interface ConsoleViewProps {
  title: ReactNode;
  /** 后端资源路径，如 'agent/dashboard'（dataProvider 拼为 /api/agent/dashboard） */
  url: string;
  cards?: CardDef[];
  fields?: FieldDef[];
  charts?: ChartDef[];
}

const getByPath = (obj: any, path: string): any =>
  path.split('.').reduce((acc, k) => (acc == null ? acc : acc[k]), obj);

/**
 * 通用单对象视图：用于代理商/服务商中心的看板、结算、资质、钱包等
 * 「一个对象」型页面（区别于 GenericListPage 的列表型）。
 */
export const ConsoleView = ({ title, url, cards, fields, charts }: ConsoleViewProps) => {
  const { data, isLoading, isError, refetch } = useCustom({ url, method: 'get' });
  const payload: any = (data as any)?.data ?? data;

  if (isLoading) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <Spin tip={t('common.loading')} />
      </div>
    );
  }
  if (isError) {
    return <ErrorState onRetry={() => refetch?.()} />;
  }
  if (!payload) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <EmptyState />
      </div>
    );
  }

  const renderCard = (c: CardDef) => {
    const v = getByPath(payload, c.path);
    const value =
      c.format === 'cents' ? (
        <span style={{ color: c.color }}>{formatCents(v ?? 0)}</span>
      ) : (
        <span style={{ color: c.color }}>{v ?? 0}</span>
      );
    return (
      <Col xs={24} sm={12} md={8} lg={6} key={c.path}>
        <Card>
          <Statistic title={c.label} value={value as any} />
        </Card>
      </Col>
    );
  };

  const renderField = (f: FieldDef) => {
    const v = getByPath(payload, f.path);
    let node: ReactNode = '—';
    if (f.format === 'cents') node = formatCents(v ?? 0);
    else if (f.format === 'date')
      node = v ? new Date(v).toLocaleString('zh-CN', { hour12: false }) : '—';
    else if (f.format === 'array') node = Array.isArray(v) && v.length ? v.join('、') : '—';
    else if (f.format === 'roles') node = serviceRolesText(v);
    else if (f.format === 'category') node = categoryText(v);
    else if (f.format === 'type') node = msgTypeText(v);
    else if (f.format === 'scope') node = msgScopeText(v);
    else if (f.format === 'status') node = <StatusTag value={v} />;
    else if (f.format === 'bool') node = boolText(v);
    else if (v != null) node = String(v);
    return <Descriptions.Item label={f.label} key={f.path}>{node}</Descriptions.Item>;
  };

  const renderChart = (c: ChartDef) => {
    const raw: any[] = getByPath(payload, c.dataPath) ?? [];
    const labelKey = c.labelKey ?? 'label';
    const valueKey = c.valueKey ?? 'value';
    const scale = c.valueScale ?? 1;
    const mapped = raw.map((d) => ({
      label: String(d[labelKey] ?? ''),
      value: Number(d[valueKey] ?? 0) * scale,
    })) as DonutDatum[] & BarDatum[];
    return c.type === 'donut' ? (
      <DonutShare title={c.title} data={mapped} />
    ) : (
      <BarCompare title={c.title} data={mapped} unit={c.unit} color={c.color} />
    );
  };

  return (
    <div style={{ padding: 8 }}>
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      {cards && (
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          {cards.map(renderCard)}
        </Row>
      )}
      {charts && charts.length > 0 && (
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          {charts.map((c) => (
            <Col xs={24} md={12} key={c.title}>
              {renderChart(c)}
            </Col>
          ))}
        </Row>
      )}
      {fields && (
        <Card>
          <Descriptions column={1} bordered size="small">
            {fields.map(renderField)}
          </Descriptions>
        </Card>
      )}
    </div>
  );
};
