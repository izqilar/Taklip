import { Table } from 'antd';
import type { TableProps } from 'antd';
import { T } from '../../config/theme';
import { EmptyState } from '../common/EmptyState';

export interface DataTableProps<T> extends Omit<TableProps<T>, 'pagination'> {
  /**
   * 预留：原型表格无紧凑变体，行高统一 46px（--row）。
   * 保留此属性仅为兼容既有调用点，当前不改变行高。
   */
  dense?: boolean;
}

/**
 * 统一数据表格（原型 table 规范）。
 * 行高 46 / 表头暖石底弱文 / nowrap + 省略号 / 行 hover #faf7f1 / 无阴影靠线。
 * 分页由外层 Pager 承担，此处固定关闭内置分页器。
 */
export function DataTable<T extends object>({ dense: _dense, ...rest }: DataTableProps<T>) {
  const rowH = T.row;
  return (
    <div style={{ overflow: 'auto' }}>
      <Table<T>
        {...rest}
        size="middle"
        pagination={false}
        locale={{ emptyText: <EmptyState /> }}
        style={{
          // 表头与单元格令牌（原型 th/td）
          ['--dt-row-h' as string]: `${rowH}px`,
        }}
        components={{
          header: {
            cell: (props: any) => (
              <th
                {...props}
                style={{
                  ...props.style,
                  background: T.panel2,
                  color: T.ink3,
                  fontWeight: 500,
                  fontSize: 12.5,
                  letterSpacing: '.02em',
                  height: rowH,
                  padding: '0 16px',
                  whiteSpace: 'nowrap',
                  borderBottom: `1px solid ${T.border}`,
                }}
              />
            ),
          },
          body: {
            cell: (props: any) => (
              <td
                {...props}
                style={{
                  ...props.style,
                  height: rowH,
                  padding: '0 16px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  borderBottom: `1px solid ${T.border}`,
                }}
              />
            ),
            row: (props: any) => (
              <tr
                {...props}
                style={{
                  ...props.style,
                  ['--dt-hover' as string]: T.hover,
                }}
                onMouseEnter={(e) => {
                  const tds = e.currentTarget.querySelectorAll('td');
                  tds.forEach((td: any) => (td.style.background = T.hover));
                }}
                onMouseLeave={(e) => {
                  const tds = e.currentTarget.querySelectorAll('td');
                  tds.forEach((td: any) => (td.style.background = ''));
                }}
              />
            ),
          },
        }}
      />
    </div>
  );
}

export default DataTable;
