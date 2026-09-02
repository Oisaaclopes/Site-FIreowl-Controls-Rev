/* =====================================================================
 * Unidades de medida canônicas (comercial).
 *
 * FONTE ÚNICA para produtos E serviços. A interface e os documentos mostram
 * SOMENTE a sigla (ex.: "un", "m", "L") — nunca "Un - Unidade". Cada unidade
 * declara se aceita quantidade fracionada (allowDecimals).
 *
 * Módulo PURO (sem React / sem Supabase) e testável isoladamente.
 * ===================================================================== */

export type UnitCategory =
  | 'contagem'
  | 'comprimento'
  | 'area'
  | 'volume'
  | 'massa'
  | 'tempo'
  | 'servico';

export interface CommercialUnit {
  /** Sigla canônica exibida na UI e no PDF. */
  code: string;
  /** Descrição longa (uso interno/admin — NUNCA exibida junto da sigla). */
  label: string;
  category: UnitCategory;
  /** Se a quantidade pode ser fracionada (ex.: 150,5 m). */
  allowDecimals: boolean;
}

/** Catálogo central de unidades suportadas. */
export const COMMERCIAL_UNITS: CommercialUnit[] = [
  { code: 'un', label: 'Unidade', category: 'contagem', allowDecimals: false },
  { code: 'pç', label: 'Peça', category: 'contagem', allowDecimals: false },
  { code: 'cx', label: 'Caixa', category: 'contagem', allowDecimals: false },
  { code: 'pct', label: 'Pacote', category: 'contagem', allowDecimals: false },
  { code: 'rolo', label: 'Rolo', category: 'contagem', allowDecimals: false },
  { code: 'par', label: 'Par', category: 'contagem', allowDecimals: false },
  { code: 'kit', label: 'Kit', category: 'contagem', allowDecimals: false },
  { code: 'm', label: 'Metro', category: 'comprimento', allowDecimals: true },
  { code: 'cm', label: 'Centímetro', category: 'comprimento', allowDecimals: true },
  { code: 'mm', label: 'Milímetro', category: 'comprimento', allowDecimals: true },
  { code: 'km', label: 'Quilômetro', category: 'comprimento', allowDecimals: true },
  { code: 'm²', label: 'Metro quadrado', category: 'area', allowDecimals: true },
  { code: 'm³', label: 'Metro cúbico', category: 'volume', allowDecimals: true },
  { code: 'L', label: 'Litro', category: 'volume', allowDecimals: true },
  { code: 'mL', label: 'Mililitro', category: 'volume', allowDecimals: true },
  { code: 'kg', label: 'Quilograma', category: 'massa', allowDecimals: true },
  { code: 'g', label: 'Grama', category: 'massa', allowDecimals: true },
  { code: 'h', label: 'Hora', category: 'tempo', allowDecimals: true },
  { code: 'dia', label: 'Dia', category: 'tempo', allowDecimals: false },
  { code: 'visita', label: 'Visita', category: 'servico', allowDecimals: false },
  { code: 'vb', label: 'Verba', category: 'servico', allowDecimals: false },
];

const BY_CODE = new Map(COMMERCIAL_UNITS.map((u) => [u.code, u]));

/** Casa a sigla exatamente como cadastrada (respeita maiúsc./minúsc. canônica). */
export function unitByCode(code?: string | null): CommercialUnit | undefined {
  if (!code) return undefined;
  return BY_CODE.get(code.trim());
}

/**
 * Aliases previsíveis → sigla canônica. Chave normalizada (sem acento, minúscula,
 * sem espaços nas pontas). NÃO resolve ambiguidades — apenas casos seguros.
 */
const ALIASES: Record<string, string> = {
  // contagem
  un: 'un', und: 'un', unid: 'un', unidade: 'un', unidades: 'un', uni: 'un', pc: 'pç', pca: 'pç',
  peca: 'pç', pecas: 'pç', pç: 'pç', cx: 'cx', caixa: 'cx', caixas: 'cx',
  pct: 'pct', pacote: 'pct', pacotes: 'pct', rolo: 'rolo', rolos: 'rolo', rl: 'rolo',
  par: 'par', pares: 'par', kit: 'kit', kits: 'kit', conj: 'kit', conjunto: 'kit',
  // comprimento
  m: 'm', metro: 'm', metros: 'm', mt: 'm', mts: 'm',
  cm: 'cm', centimetro: 'cm', centimetros: 'cm',
  mm: 'mm', milimetro: 'mm', milimetros: 'mm',
  km: 'km', quilometro: 'km', quilometros: 'km',
  // area
  'm2': 'm²', 'm²': 'm²', metroquadrado: 'm²', 'metro2': 'm²', mq: 'm²',
  // volume
  'm3': 'm³', 'm³': 'm³', metrocubico: 'm³',
  l: 'L', litro: 'L', litros: 'L', lt: 'L', lts: 'L',
  ml: 'mL', mililitro: 'mL', mililitros: 'mL',
  // massa
  kg: 'kg', quilo: 'kg', quilos: 'kg', quilograma: 'kg', quilogramas: 'kg', kgs: 'kg', kilo: 'kg',
  g: 'g', grama: 'g', gramas: 'g', gr: 'g',
  // tempo / serviço
  h: 'h', hora: 'h', horas: 'h', hr: 'h', hrs: 'h',
  dia: 'dia', dias: 'dia', diaria: 'dia', diarias: 'dia',
  visita: 'visita', visitas: 'visita', vst: 'visita',
  vb: 'vb', verba: 'vb', verbas: 'vb',
};

const stripKey = (raw: string) =>
  // Remove só marcas combinantes (U+0300–U+036F); ² e ³ (U+00B2/B3) não são
  // combinantes e sobrevivem, então "m²"/"m³" continuam distinguíveis.
  raw.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().trim().replace(/[\s._-]+/g, '');

/**
 * Devolve a sigla canônica para um valor de unidade qualquer.
 * - alias conhecido → sigla canônica (ex.: "UN - Unidade" nunca chega aqui, mas
 *   "unidade", "Un", "M", "metros" → "un"/"m").
 * - já-canônico → o próprio code.
 * - desconhecido → o valor original preservado (trim). NÃO inventa nem descarta.
 */
export function normalizeUnitCode(raw?: string | null): string {
  if (raw == null) return 'un';
  const original = String(raw).trim();
  if (original === '') return 'un';
  if (BY_CODE.has(original)) return original; // já canônico (respeita 'L', 'm²', 'm³')
  const key = stripKey(original);
  if (ALIASES[key]) return ALIASES[key];
  // Padrão "SIGLA - Descrição" / "SIGLA — Descrição" → tenta a sigla antes do traço.
  const head = original.split(/[-–—:]/)[0].trim();
  if (head && head !== original) {
    if (BY_CODE.has(head)) return head;
    const hk = stripKey(head);
    if (ALIASES[hk]) return ALIASES[hk];
  }
  return original; // desconhecido: preserva (documentado na migração)
}

/** true se a sigla é reconhecida no catálogo canônico. */
export function isCanonicalUnit(code?: string | null): boolean {
  return !!code && BY_CODE.has(code.trim());
}

/** Uma unidade aceita decimais? Desconhecida → permissivo (true) p/ não bloquear. */
export function unitAllowsDecimals(code?: string | null): boolean {
  const u = unitByCode(normalizeUnitCode(code));
  return u ? u.allowDecimals : true;
}

/**
 * Normaliza uma quantidade conforme a unidade:
 * - unidade sem decimais → inteiro (arredonda p/ o mais próximo, mínimo 1);
 * - unidade com decimais → até 3 casas;
 * - sempre > 0.
 */
export function normalizeQuantity(qty: number, unitCode?: string | null): number {
  const n = Number(qty);
  if (!Number.isFinite(n) || n <= 0) return unitAllowsDecimals(unitCode) ? 0.001 : 1;
  if (!unitAllowsDecimals(unitCode)) return Math.max(1, Math.round(n));
  return Math.max(0.001, Math.round(n * 1000) / 1000);
}

/** Formatação da sigla para exibição (canônica). Presentation-only. */
export function formatUnitDisplay(code?: string | null): string {
  return normalizeUnitCode(code);
}
