/**
 * 零依赖 CSV 解析（名单导入场景）
 *
 * 支持：UTF-8 BOM 剥离、CRLF/LF/CR 混排、双引号包裹、"" 转义、字段内换行。
 * 与 `minimal-xlsx` 同属「不引第三方库」的自研最小实现。
 */

/** 解析 CSV 文本 → 二维字符串数组 */
export function parseCsv(input: string): string[][] {
  // 剥离 UTF-8 BOM（Excel 导出的 CSV 必带，不剥会把首列表头污染成 "\uFEFF姓名"）
  let s = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  const endField = () => {
    row.push(field);
    field = '';
  };
  const endRow = () => {
    endField();
    // 纯空行（整行无任何字符）跳过，避免尾部换行产生空记录
    if (!(row.length === 1 && row[0] === '')) rows.push(row);
    row = [];
  };

  while (i < s.length) {
    const ch = s[i];

    if (inQuotes) {
      if (ch === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ',') {
      endField();
      i++;
      continue;
    }
    if (ch === '\r') {
      if (s[i + 1] === '\n') i += 2;
      else i++;
      endRow();
      continue;
    }
    if (ch === '\n') {
      i++;
      endRow();
      continue;
    }
    field += ch;
    i++;
  }
  // 收尾：最后一行可能没有换行符
  if (field !== '' || row.length) endRow();

  return rows;
}

/**
 * 导入单元格值归一化（T8）：把各类换行统一为 `\n`，剥离其它控制字符，
 * 去除行尾空白。避免 `\r\n` 在 `white-space:pre` 文本元素里渲染成双空白行。
 * 保留 `\n`（合法多行）与 `\t`（制表）。
 */
export function normalizeCellValue(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/\r\n?/g, '\n') // CRLF / CR → LF
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '') // 剥离非打印控制字符（保留 \n \t 与可见字符）
    .replace(/[ \t]+\n/g, '\n') // 去除行尾空格/制表
    .trim();
}

/** 生成 CSV（UTF-8 **含 BOM**，CRLF 换行，按需双引号包裹） */
export function buildCsv(rows: (string | number | null | undefined)[][]): Buffer {
  const lines = rows.map((cells) =>
    cells
      .map((v) => {
        if (v == null) return '';
        const s = String(v);
        return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      })
      .join(','),
  );
  // EF BB BF —— Excel 识别中文的必要 BOM（规范 §9.1）
  return Buffer.concat([
    Buffer.from([0xef, 0xbb, 0xbf]),
    Buffer.from(lines.join('\r\n'), 'utf8'),
  ]);
}
