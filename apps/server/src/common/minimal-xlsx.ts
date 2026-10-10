/**
 * 零依赖最小 XLSX 读写（仅覆盖名单模板/导入场景）
 *
 * 为何自研：仓库未引入 exceljs/xlsx 等表格库，为模板下载与名单导入新增重型依赖不划算；
 * 名单场景只需要「多工作表写 + 首表读」，用 zlib + 手写 ZIP 容器即可，
 * 且不引入任何第三方代码（避免供应链风险）。
 *
 * 写：STORE（不压缩）——模板极小，换取实现简单与结果稳定；Excel/WPS 均正常识别。
 * 读：同时支持 STORE(0) 与 DEFLATE(8) 两种压缩方式，兼容外部工具生成的 xlsx。
 */

import { zipStore, unzip, type ZipEntry } from './minimal-zip';

/* ────────────────── XML 工具 ────────────────── */

function esc(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '');
}

/** 0 → A，25 → Z，26 → AA */
export function colName(idx: number): string {
  let s = '';
  let n = idx;
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

function colIndex(ref: string): number {
  let n = 0;
  for (const ch of ref) {
    if (!/[A-Z]/.test(ch)) break;
    n = n * 26 + (ch.charCodeAt(0) - 64);
  }
  return n - 1;
}

/* ────────────────── XLSX 写入 ────────────────── */

export interface XlsxSheet {
  name: string;
  /** 每行一组单元格；null/undefined 写为空单元格 */
  rows: (string | number | null | undefined)[][];
}

const XML_DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';

function sheetXml(sheet: XlsxSheet): string {
  const rows = sheet.rows
    .map((cells, r) => {
      const cs = cells
        .map((v, c) => {
          if (v == null || v === '') return '';
          const ref = `${colName(c)}${r + 1}`;
          if (typeof v === 'number') return `<c r="${ref}"><v>${v}</v></c>`;
          return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
        })
        .join('');
      return `<row r="${r + 1}">${cs}</row>`;
    })
    .join('');
  return `${XML_DECL}<worksheet xmlns="${NS}"><sheetData>${rows}</sheetData></worksheet>`;
}

/** 生成最小合法 xlsx（多工作表） */
export function buildXlsx(sheets: XlsxSheet[]): Buffer {
  const list = sheets.length ? sheets : [{ name: 'Sheet1', rows: [] }];

  const contentTypes =
    `${XML_DECL}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
    `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
    list
      .map(
        (_s, i) =>
          `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
      )
      .join('') +
    `</Types>`;

  const rootRels =
    `${XML_DECL}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
    `</Relationships>`;

  const workbook =
    `${XML_DECL}<workbook xmlns="${NS}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>` +
    list
      .map(
        (s, i) => `<sheet name="${esc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`,
      )
      .join('') +
    `</sheets></workbook>`;

  const wbRels =
    `${XML_DECL}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    list
      .map(
        (_s, i) =>
          `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
      )
      .join('') +
    `<Relationship Id="rId${list.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
    `</Relationships>`;

  const styles =
    `${XML_DECL}<styleSheet xmlns="${NS}">` +
    `<fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>` +
    `<fills count="1"><fill><patternFill patternType="none"/></fill></fills>` +
    `<borders count="1"><border/></borders>` +
    `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
    `<cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>` +
    `</styleSheet>`;

  const entries: ZipEntry[] = [
    { name: '[Content_Types].xml', data: Buffer.from(contentTypes, 'utf8') },
    { name: '_rels/.rels', data: Buffer.from(rootRels, 'utf8') },
    { name: 'xl/workbook.xml', data: Buffer.from(workbook, 'utf8') },
    { name: 'xl/_rels/workbook.xml.rels', data: Buffer.from(wbRels, 'utf8') },
    { name: 'xl/styles.xml', data: Buffer.from(styles, 'utf8') },
    ...list.map((s, i) => ({
      name: `xl/worksheets/sheet${i + 1}.xml`,
      data: Buffer.from(sheetXml(s), 'utf8'),
    })),
  ];

  return zipStore(entries);
}

/* ────────────────── XLSX 读取（仅首个工作表） ────────────────── */

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_m, d) => String.fromCharCode(Number(d)))
    .replace(/&amp;/g, '&');
}

/** 行匹配：`r` 属性存在与否两种写法都覆盖 */
const ROW_RE = /<row([^>]*)>([\s\S]*?)<\/row>/g;
/** 单元格匹配：成对 `<c …>…</c>` 与自闭合 `<c …/>` 两种写法都覆盖 */
const CELL_RE = /<c([^>]*)>([\s\S]*?)<\/c>|<c([^>]*)\/>/g;

/**
 * 读取 xlsx 的第一个工作表，返回「行 → 单元格文本」二维数组。
 * 空尾部列会被裁剪；行内缺失列以空串补齐到本行最大列。
 */
export function readXlsxFirstSheet(buf: Buffer): string[][] {
  const files = unzip(buf);
  const sheetName =
    Object.keys(files).sort((a, b) => a.length - b.length || a.localeCompare(b)) // sheet1 → sheet10 的字典序坑由长度兜底
      .find((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)) ?? 'xl/worksheets/sheet1.xml';
  const xml = files[sheetName];
  if (!xml) throw new Error('xlsx 内未找到工作表');

  // 共享字符串（Excel 导出常用 inlineStr 之外的形式）
  let shared: string[] = [];
  const ss = files['xl/sharedStrings.xml'];
  if (ss) {
    shared = [...ss.toString('utf8').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
      decodeEntities(
        [...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join(''),
      ),
    );
  }

  const rows: Record<number, Record<number, string>> = {};
  let rowSeq = 0;
  for (const rm of xml.toString('utf8').matchAll(ROW_RE)) {
    // 行号优先取 r 属性；缺失时按出现顺序兜底（部分工具不写 r）
    const rM = /r="(\d+)"/.exec(rm[1] ?? '');
    const rIdx = rM ? Number(rM[1]) - 1 : rowSeq;
    rowSeq++;
    const cells: Record<number, string> = {};
    for (const cm of rm[2].matchAll(CELL_RE)) {
      const attrs = cm[1] ?? cm[3] ?? '';
      const inner = cm[2] ?? '';
      const refM = /r="([A-Z]+)(\d+)"/.exec(attrs);
      const cIdx = refM ? colIndex(refM[1]) : Object.keys(cells).length;
      const tM = /t="([^"]+)"/.exec(attrs);
      const vM = /<v>([\s\S]*?)<\/v>/.exec(inner);
      const isM = /<t[^>]*>([\s\S]*?)<\/t>/.exec(inner);

      let val = '';
      if (tM && tM[1] === 's' && vM) val = shared[Number(vM[1])] ?? '';
      else if (tM && tM[1] === 'inlineStr') val = isM ? decodeEntities(isM[1]) : '';
      else if (vM) val = decodeEntities(vM[1]);
      else if (isM) val = decodeEntities(isM[1]);
      cells[cIdx] = val;
    }
    rows[rIdx] = cells;
  }

  const maxRow = Math.max(-1, ...Object.keys(rows).map(Number));
  const out: string[][] = [];
  for (let r = 0; r <= maxRow; r++) {
    const cells = rows[r] ?? {};
    const maxCol = Math.max(-1, ...Object.keys(cells).map(Number));
    const line: string[] = [];
    for (let c = 0; c <= maxCol; c++) line.push(cells[c] ?? '');
    out.push(line);
  }
  return out;
}
