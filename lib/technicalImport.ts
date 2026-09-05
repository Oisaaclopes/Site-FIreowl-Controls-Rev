/* ===================================================================
 * ETAPA 3D.2 — Importação assistida de Base Técnica (XLSX/CSV), SEM dependências.
 * Fluxo: upload → detectar colunas → mapear (assistido) → pré-visualizar →
 * validar → importar. Converge para o MESMO modelo canônico de ativo (devices),
 * com source=IMPORTACAO. Importado NUNCA é "verificado em campo" (§12).
 * O parser NÃO interpreta conteúdo como programação (§17): só lê linhas/colunas.
 * XLSX é lido com um leitor ZIP mínimo + DecompressionStream (deflate-raw),
 * disponível no browser e no Node 18+ — sem lib externa (npm audit limpo).
 * =================================================================== */
import { TechArea, identifierFields, assetIdentityKey, validateIdentifier, AssetLike } from './technicalBase';

/* ------------------------- Normalização ------------------------- */
export function normalizeHeader(s: string): string {
  return (s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().trim().replace(/[^a-z0-9]+/g, ' ').trim();
}

/* ------------------------- CSV ------------------------- */
/** Detecta o delimitador mais provável na primeira linha não-vazia. */
export function detectDelimiter(text: string): string {
  const line = (text.split(/\r?\n/).find((l) => l.trim().length > 0) || '');
  const counts: Record<string, number> = { ',': 0, ';': 0, '\t': 0 };
  let inQ = false;
  for (const ch of line) {
    if (ch === '"') inQ = !inQ;
    else if (!inQ && ch in counts) counts[ch]++;
  }
  return (Object.entries(counts).sort((a, b) => b[1] - a[1])[0] || [','])[0];
}

/** Parser CSV tolerante: aspas, aspas escapadas ("") e quebras de linha em campo. */
export function parseCsv(text: string, delimiter?: string): string[][] {
  const clean = text.replace(/^﻿/, '');
  const delim = delimiter || detectDelimiter(clean);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQ = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (inQ) {
      if (c === '"') {
        if (clean[i + 1] === '"') { field += '"'; i++; }
        else inQ = false;
      } else field += c;
    } else if (c === '"') inQ = true;
    else if (c === delim) { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c === '\r') { /* ignora; \n fecha a linha */ }
    else field += c;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((cell) => (cell || '').trim().length > 0));
}

/* ------------------------- XLSX (ZIP + XML) ------------------------- */
const dv = (u: Uint8Array) => new DataView(u.buffer, u.byteOffset, u.byteLength);

async function inflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  const ds = new (globalThis as any).DecompressionStream('deflate-raw');
  const stream = new Blob([bytes as any]).stream().pipeThrough(ds);
  const buf = await new Response(stream).arrayBuffer();
  return new Uint8Array(buf);
}

/** Lê um ZIP (EOCD → central directory) e devolve os arquivos como texto UTF-8. */
async function readZipEntries(data: Uint8Array, wanted: (name: string) => boolean): Promise<Record<string, string>> {
  const view = dv(data);
  // Localiza o End Of Central Directory (0x06054b50), varrendo do fim.
  let eocd = -1;
  for (let i = data.length - 22; i >= 0 && i >= data.length - 22 - 65536; i--) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Arquivo XLSX inválido (EOCD não encontrado)');
  const count = view.getUint16(eocd + 10, true);
  let off = view.getUint32(eocd + 16, true);
  const out: Record<string, string> = {};
  const dec = new TextDecoder('utf-8');
  for (let n = 0; n < count; n++) {
    if (view.getUint32(off, true) !== 0x02014b50) break;
    const method = view.getUint16(off + 10, true);
    const compSize = view.getUint32(off + 20, true);
    const nameLen = view.getUint16(off + 28, true);
    const extraLen = view.getUint16(off + 30, true);
    const commentLen = view.getUint16(off + 32, true);
    const localOff = view.getUint32(off + 42, true);
    const name = dec.decode(data.subarray(off + 46, off + 46 + nameLen));
    if (wanted(name)) {
      const lv = dv(data);
      const lNameLen = lv.getUint16(localOff + 26, true);
      const lExtraLen = lv.getUint16(localOff + 28, true);
      const start = localOff + 30 + lNameLen + lExtraLen;
      const raw = data.subarray(start, start + compSize);
      const bytes = method === 0 ? raw : await inflateRaw(raw);
      out[name] = dec.decode(bytes);
    }
    off += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

/** Extrai os textos de sharedStrings.xml (concatena runs <t> por <si>). */
export function sharedStringsFromXml(xml: string): string[] {
  const out: string[] = [];
  const siRe = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
  let m: RegExpExecArray | null;
  while ((m = siRe.exec(xml))) {
    const inner = m[1];
    const parts: string[] = [];
    const tRe = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
    let t: RegExpExecArray | null;
    while ((t = tRe.exec(inner))) parts.push(decodeXmlEntities(t[1]));
    out.push(parts.join(''));
  }
  return out;
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&amp;/g, '&');
}

/** Converte referência de coluna ("A", "AB") em índice 0-based. */
export function colRefToIndex(ref: string): number {
  const letters = (ref.match(/[A-Z]+/i) || [''])[0].toUpperCase();
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/** Converte a XML de uma planilha em matriz de strings, resolvendo shared strings. */
export function sheetXmlToMatrix(xml: string, shared: string[]): string[][] {
  const rows: string[][] = [];
  const rowRe = /<row\b[^>]*>([\s\S]*?)<\/row>/g;
  let rm: RegExpExecArray | null;
  while ((rm = rowRe.exec(xml))) {
    const cells: string[] = [];
    const cRe = /<c\b([^>]*)>([\s\S]*?)<\/c>|<c\b([^>]*)\/>/g;
    let cm: RegExpExecArray | null;
    while ((cm = cRe.exec(rm[1]))) {
      const attrs = cm[1] || cm[3] || '';
      const body = cm[2] || '';
      const ref = (attrs.match(/r="([A-Z]+)\d+"/i) || [])[1];
      const type = (attrs.match(/t="([^"]+)"/) || [])[1];
      let value = '';
      if (type === 's') {
        const v = (body.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
        value = v != null ? (shared[Number(v)] ?? '') : '';
      } else if (type === 'inlineStr') {
        const t = (body.match(/<t\b[^>]*>([\s\S]*?)<\/t>/) || [])[1];
        value = t != null ? decodeXmlEntities(t) : '';
      } else {
        const v = (body.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
        value = v != null ? decodeXmlEntities(v) : '';
      }
      const idx = ref ? colRefToIndex(ref) : cells.length;
      cells[idx] = value;
    }
    for (let i = 0; i < cells.length; i++) if (cells[i] == null) cells[i] = '';
    rows.push(cells);
  }
  return rows.filter((r) => r.some((c) => (c || '').trim().length > 0));
}

/** Lê a primeira planilha de um XLSX (ArrayBuffer) como matriz de strings. */
export async function parseXlsx(buffer: ArrayBuffer): Promise<string[][]> {
  const data = new Uint8Array(buffer);
  const files = await readZipEntries(data, (name) =>
    name === 'xl/sharedStrings.xml' || /^xl\/worksheets\/sheet1\.xml$/.test(name) || name === 'xl/workbook.xml');
  const shared = files['xl/sharedStrings.xml'] ? sharedStringsFromXml(files['xl/sharedStrings.xml']) : [];
  const sheet = files['xl/worksheets/sheet1.xml'];
  if (!sheet) {
    // fallback: qualquer worksheet
    const any = await readZipEntries(data, (name) => /^xl\/worksheets\/.*\.xml$/.test(name));
    const first = Object.values(any)[0];
    if (!first) throw new Error('Planilha não encontrada no XLSX');
    return sheetXmlToMatrix(first, shared);
  }
  return sheetXmlToMatrix(sheet, shared);
}

/** Detecta o tipo pelo nome e delega ao parser certo. */
export async function parseSpreadsheet(file: { name: string; arrayBuffer: () => Promise<ArrayBuffer>; text?: () => Promise<string> }): Promise<string[][]> {
  const name = (file.name || '').toLowerCase();
  if (name.endsWith('.xlsx')) return parseXlsx(await file.arrayBuffer());
  const text = file.text ? await file.text() : new TextDecoder('utf-8').decode(new Uint8Array(await file.arrayBuffer()));
  return parseCsv(text);
}

/* ------------------------- Alvos de mapeamento ------------------------- */
export type TargetStore = 'central' | 'laco' | 'endereco' | 'attr' | 'field';
export interface ImportTarget {
  key: string;
  label: string;
  store: TargetStore;
  deviceField?: 'tipoAtivo' | 'grupo' | 'localizacao' | 'fabricante' | 'modelo' | 'serial';
  attrKey?: string;
  aliases: string[];
  kind?: 'text' | 'number' | 'ip' | 'mac';
}

const COMMON_TARGETS: ImportTarget[] = [
  { key: 'tipoAtivo', label: 'Tipo do ativo', store: 'field', deviceField: 'tipoAtivo', aliases: ['tipo', 'tipo do ativo', 'type', 'categoria', 'equipamento', 'device', 'dispositivo'] },
  { key: 'grupo', label: 'Grupo', store: 'field', deviceField: 'grupo', aliases: ['grupo', 'familia', 'family', 'group'] },
  { key: 'localizacao', label: 'Localização', store: 'field', deviceField: 'localizacao', aliases: ['local', 'localizacao', 'location', 'ambiente', 'setor', 'area', 'sala', 'place', 'localidade'] },
  { key: 'fabricante', label: 'Fabricante', store: 'field', deviceField: 'fabricante', aliases: ['fabricante', 'marca', 'brand', 'manufacturer', 'maker', 'fornecedor'] },
  { key: 'modelo', label: 'Modelo', store: 'field', deviceField: 'modelo', aliases: ['modelo', 'model', 'mod'] },
  { key: 'serial', label: 'Nº de série', store: 'field', deviceField: 'serial', aliases: ['serial', 'serie', 'n serie', 'sn', 's n', 'numero de serie'] },
  { key: 'observacao', label: 'Observação', store: 'attr', attrKey: 'observacao', aliases: ['observacao', 'obs', 'nota', 'notas', 'comentario', 'comentarios'] },
];

/** Extras por área presentes no modelo oficial, sem ser identificador do motor. */
const EXTRA_TARGETS_BY_AREA: Partial<Record<TechArea, ImportTarget[]>> = {
  CFTV: [{ key: 'tecnologia', label: 'Tecnologia', store: 'attr', attrKey: 'tecnologia', aliases: ['tecnologia', 'technology', 'tech'] }],
  CONTROLE_ACESSO: [{ key: 'canal', label: 'Canal', store: 'attr', attrKey: 'canal', aliases: ['canal', 'channel', 'ch'] }],
};

const IDENT_ALIASES: Record<string, string[]> = {
  central: ['central', 'painel', 'panel'],
  laco: ['laco', 'loop', 'la'],
  endereco: ['endereco', 'end', 'address', 'addr', 'end nr', 'endereco nr'],
  descricao_programada: ['descricao', 'descricao programada', 'label', 'texto', 'description', 'desc'],
  nvr: ['nvr', 'dvr', 'xvr', 'gravador', 'recorder'],
  ip: ['ip', 'ip camera', 'ip cam', 'endereco ip', 'ip address'],
  canal: ['canal', 'channel', 'ch', 'cam'],
  mac: ['mac', 'mac address', 'endereco mac'],
  particao: ['particao', 'partition', 'part'],
  zona: ['zona', 'zone'],
  controlador: ['controlador', 'controller', 'clp', 'plc'],
  protocolo: ['protocolo', 'protocol'],
  device_instance: ['device instance', 'di', 'instance', 'instancia'],
  modbus_id: ['modbus', 'modbus id', 'slave', 'slave id'],
  ponto: ['ponto', 'point', 'tag'],
  controladora: ['controladora', 'controller'],
  porta: ['porta', 'door'],
  porta_controladora: ['porta controladora', 'door number', 'wiegand', 'porta ctrl'],
};

/** Alvos de importação para a área: identificadores do motor + campos comuns. */
export function importTargets(area: TechArea): ImportTarget[] {
  const idents: ImportTarget[] = identifierFields(area).map((f) => ({
    key: f.key,
    label: f.label,
    store: (f.store === 'attr' ? 'attr' : f.store) as TargetStore,
    attrKey: f.store === 'attr' ? f.key : undefined,
    kind: f.kind,
    aliases: IDENT_ALIASES[f.key] || [normalizeHeader(f.label)],
  }));
  return [...idents, ...(EXTRA_TARGETS_BY_AREA[area] || []), ...COMMON_TARGETS];
}

/** Auto-mapeia cabeçalhos → chaves de alvo (assistido; usuário confirma depois). */
export function guessMapping(headers: string[], area: TechArea): Record<number, string> {
  const targets = importTargets(area);
  const mapping: Record<number, string> = {};
  const used = new Set<string>();
  headers.forEach((h, i) => {
    const nh = normalizeHeader(h);
    if (!nh) return;
    const tokens = nh.split(' ');
    // 1) alias == cabeçalho inteiro; 2) alias é um TOKEN do cabeçalho; 3) alias
    // multi-palavra aparece como FRASE no cabeçalho. Sem substring solto (evita
    // "desc" casar com "desconhecido").
    let hit = targets.find((t) => !used.has(t.key) && t.aliases.some((a) => a === nh));
    if (!hit) hit = targets.find((t) => !used.has(t.key) && t.aliases.some((a) => tokens.includes(a)));
    if (!hit) hit = targets.find((t) => !used.has(t.key) && t.aliases.some((a) => a.includes(' ') && nh.includes(a)));
    if (hit) { mapping[i] = hit.key; used.add(hit.key); }
  });
  return mapping;
}

/* ------------------------- Draft + preview ------------------------- */
export interface DeviceDraft {
  tipoAtivo?: string; grupo?: string; localizacao?: string;
  fabricante?: string; modelo?: string; serial?: string;
  central?: string; laco?: string; endereco?: string;
  technicalAttributes: Record<string, string>;
}

function applyToDraft(draft: DeviceDraft, target: ImportTarget, value: string) {
  const v = (value || '').trim();
  if (!v) return;
  if (target.store === 'field' && target.deviceField) (draft as any)[target.deviceField] = v;
  else if (target.store === 'attr' && target.attrKey) draft.technicalAttributes[target.attrKey] = v;
  else if (target.store === 'central') draft.central = v;
  else if (target.store === 'laco') draft.laco = v;
  else if (target.store === 'endereco') draft.endereco = v;
}

export interface ImportRowResult {
  row: number;              // índice na planilha (0-based, sem cabeçalho)
  draft: DeviceDraft;
  identityKey: string | null;
  valid: boolean;
  errors: string[];
  duplicateInFile: boolean; // repete outra linha do arquivo
  duplicateInBase: boolean; // já existe na Base Técnica
}

export interface ImportPreview {
  headers: string[];
  total: number;
  valid: number;
  invalid: number;
  duplicatesInFile: number;
  duplicatesInBase: number;
  unmappedColumns: string[];
  results: ImportRowResult[];
}

/**
 * Constrói a prévia (§11): valida cada linha, calcula identidade e duplicidades
 * (no arquivo e contra a base existente). NÃO importa nada — só analisa.
 */
export function buildImportPreview(
  matrix: string[][],
  mapping: Record<number, string>,
  area: TechArea,
  existingAssets: AssetLike[] = [],
): ImportPreview {
  const targets = importTargets(area);
  const targetByKey = new Map(targets.map((t) => [t.key, t]));
  const headers = matrix[0] || [];
  const bodyRows = matrix.slice(1);
  const mappedKeys = new Set(Object.values(mapping));
  const unmappedColumns = headers.map((h, i) => (mapping[i] ? null : (h || `Coluna ${i + 1}`))).filter((x): x is string => !!x);

  const baseKeys = new Set(existingAssets.map((a) => assetIdentityKey(area, a)).filter((k): k is string => !!k));
  const seenInFile = new Map<string, number>();
  const results: ImportRowResult[] = [];

  bodyRows.forEach((cells, r) => {
    const draft: DeviceDraft = { technicalAttributes: {} };
    const errors: string[] = [];
    for (const [colStr, key] of Object.entries(mapping)) {
      const col = Number(colStr);
      const target = targetByKey.get(key);
      if (!target) continue;
      const value = (cells[col] || '').trim();
      if (value && target.kind && !validateIdentifier(target.kind, value)) {
        errors.push(`${target.label} inválido: "${value}"`);
      }
      applyToDraft(draft, target, value);
    }
    const asset: AssetLike = { central: draft.central, laco: draft.laco, endereco: draft.endereco, technicalAttributes: draft.technicalAttributes };
    const identityKey = assetIdentityKey(area, asset);
    const hasAnyIdentifier = identityKey != null;
    const hasAnyData = hasAnyIdentifier || !!(draft.tipoAtivo || draft.grupo || draft.fabricante || draft.modelo);
    if (!hasAnyData) errors.push('Linha sem dados aproveitáveis');
    if (!hasAnyIdentifier && !draft.tipoAtivo && !draft.grupo) errors.push('Sem identificador nem tipo/grupo');

    let duplicateInFile = false;
    if (identityKey) {
      if (seenInFile.has(identityKey)) duplicateInFile = true;
      else seenInFile.set(identityKey, r);
    }
    const duplicateInBase = identityKey ? baseKeys.has(identityKey) : false;

    results.push({
      row: r,
      draft,
      identityKey,
      valid: errors.length === 0,
      errors,
      duplicateInFile,
      duplicateInBase,
    });
  });

  return {
    headers,
    total: results.length,
    valid: results.filter((x) => x.valid).length,
    invalid: results.filter((x) => !x.valid).length,
    duplicatesInFile: results.filter((x) => x.duplicateInFile).length,
    duplicatesInBase: results.filter((x) => x.duplicateInBase).length,
    unmappedColumns,
    results,
  };
}

// Reexport para conveniência de quem só importa deste módulo.
export type { TechArea } from './technicalBase';
