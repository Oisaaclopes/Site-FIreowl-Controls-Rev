/* ===================================================================
 * ETAPA 3D.3 — Gerador XLSX mínimo, SEM dependência externa (npm audit limpo).
 * Escreve um .xlsx (Office Open XML) empacotado em ZIP com entradas STORED (sem
 * compressão) — evita precisar de encoder de deflate. Suporta múltiplas abas com
 * células de texto (inlineStr) e número. Usado só para o MODELO de importação
 * (arquivos pequenos); leitura é feita pelo parser da 3D.2 (lib/technicalImport).
 * =================================================================== */

export interface SheetSpec {
  name: string;                    // nome da aba
  rows: (string | number | null | undefined)[][];
}

const enc = new TextEncoder();

function crc32(buf: Uint8Array): number {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1));
  }
  return (~c) >>> 0;
}

function xmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function colLetter(index: number): string {
  let n = index + 1, s = '';
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

function sheetXml(rows: SheetSpec['rows']): string {
  const parts: string[] = ['<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'];
  rows.forEach((row, r) => {
    parts.push(`<row r="${r + 1}">`);
    row.forEach((cell, c) => {
      if (cell == null || cell === '') return;
      const ref = `${colLetter(c)}${r + 1}`;
      if (typeof cell === 'number' && Number.isFinite(cell)) {
        parts.push(`<c r="${ref}"><v>${cell}</v></c>`);
      } else {
        parts.push(`<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(String(cell))}</t></is></c>`);
      }
    });
    parts.push('</row>');
  });
  parts.push('</sheetData></worksheet>');
  return parts.join('');
}

function contentTypesXml(count: number): string {
  const overrides = Array.from({ length: count }, (_, i) =>
    `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('');
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    overrides + '</Types>';
}

function workbookXml(sheets: SheetSpec[]): string {
  const s = sheets.map((sh, i) => `<sheet name="${xmlEscape(sh.name).slice(0, 31)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('');
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' + s + '</sheets></workbook>';
}

function workbookRelsXml(count: number): string {
  const rels = Array.from({ length: count }, (_, i) =>
    `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('');
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + rels + '</Relationships>';
}

const ROOT_RELS =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
  '</Relationships>';

interface Entry { name: string; data: Uint8Array }

function pushU16(arr: number[], v: number) { arr.push(v & 0xff, (v >>> 8) & 0xff); }
function pushU32(arr: number[], v: number) { arr.push(v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff); }

/** Empacota as entradas num ZIP (STORED) e devolve os bytes do .xlsx. */
function zip(entries: Entry[]): Uint8Array {
  const local: number[] = [];
  const central: number[] = [];
  const offsets: number[] = [];
  for (const e of entries) {
    const nameBytes = enc.encode(e.name);
    const crc = crc32(e.data);
    offsets.push(local.length);
    // local file header
    pushU32(local, 0x04034b50); pushU16(local, 20); pushU16(local, 0); pushU16(local, 0);
    pushU16(local, 0); pushU16(local, 0);            // time, date
    pushU32(local, crc); pushU32(local, e.data.length); pushU32(local, e.data.length);
    pushU16(local, nameBytes.length); pushU16(local, 0);
    for (const b of nameBytes) local.push(b);
    for (const b of e.data) local.push(b);
  }
  const cdStart = local.length;
  entries.forEach((e, i) => {
    const nameBytes = enc.encode(e.name);
    const crc = crc32(e.data);
    pushU32(central, 0x02014b50); pushU16(central, 20); pushU16(central, 20); pushU16(central, 0); pushU16(central, 0);
    pushU16(central, 0); pushU16(central, 0);         // time, date
    pushU32(central, crc); pushU32(central, e.data.length); pushU32(central, e.data.length);
    pushU16(central, nameBytes.length); pushU16(central, 0); pushU16(central, 0);
    pushU16(central, 0); pushU16(central, 0); pushU32(central, 0);
    pushU32(central, offsets[i]);
    for (const b of nameBytes) central.push(b);
  });
  const cdSize = central.length;
  const eocd: number[] = [];
  pushU32(eocd, 0x06054b50); pushU16(eocd, 0); pushU16(eocd, 0);
  pushU16(eocd, entries.length); pushU16(eocd, entries.length);
  pushU32(eocd, cdSize); pushU32(eocd, cdStart); pushU16(eocd, 0);
  return Uint8Array.from([...local, ...central, ...eocd]);
}

/** Gera um .xlsx com as abas informadas. Retorna os bytes (para Blob/download). */
export function buildXlsx(sheets: SheetSpec[]): Uint8Array {
  const entries: Entry[] = [
    { name: '[Content_Types].xml', data: enc.encode(contentTypesXml(sheets.length)) },
    { name: '_rels/.rels', data: enc.encode(ROOT_RELS) },
    { name: 'xl/workbook.xml', data: enc.encode(workbookXml(sheets)) },
    { name: 'xl/_rels/workbook.xml.rels', data: enc.encode(workbookRelsXml(sheets.length)) },
    ...sheets.map((sh, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: enc.encode(sheetXml(sh.rows)) })),
  ];
  return zip(entries);
}

/** Conveniência: Blob pronto para download. */
export function buildXlsxBlob(sheets: SheetSpec[]): Blob {
  return new Blob([buildXlsx(sheets) as any], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
