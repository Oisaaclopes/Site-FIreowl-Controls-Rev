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
  | 'comercial'
  | 'personalizado';

export interface CommercialUnit {
  /** Sigla canônica exibida na UI e no PDF. */
  code: string;
  /** Descrição longa (uso interno/admin — NUNCA exibida junto da sigla). */
  label: string;
  category: UnitCategory;
  /** Se a quantidade pode ser fracionada (ex.: 150,5 m). */
  allowDecimals: boolean;
}

/** Ordem canônica dos grupos no seletor. */
export const UNIT_CATEGORY_ORDER: UnitCategory[] = [
  'contagem', 'comprimento', 'area', 'volume', 'massa', 'tempo', 'comercial', 'personalizado',
];

/** Rótulo PT-BR de cada grupo (cabeçalho do seletor). */
export const UNIT_CATEGORY_LABELS: Record<UnitCategory, string> = {
  contagem: 'Unidade / Contagem',
  comprimento: 'Comprimento',
  area: 'Área',
  volume: 'Volume / Capacidade',
  massa: 'Massa',
  tempo: 'Tempo / Serviço',
  comercial: 'Comercial',
  personalizado: 'Personalizado',
};

export interface UnitGroup {
  category: UnitCategory;
  label: string;
  units: CommercialUnit[];
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
  { code: 'visita', label: 'Visita', category: 'tempo', allowDecimals: false },
  { code: 'vb', label: 'Verba', category: 'comercial', allowDecimals: false },
];

const BY_CODE = new Map(COMMERCIAL_UNITS.map((u) => [u.code, u]));

/* ---------------------------------------------------------------------------
 * Unidades PERSONALIZADAS (registro em runtime).
 *
 * A SIGLA (code) é a fonte de verdade e persiste como texto normal em
 * inventory_items.unit / services.unit / proposal JSONB — sem migração.
 * O rótulo + allowDecimals são conveniências de UX; ficam no localStorage do
 * navegador (hidratados via hydrateCustomUnits, só no browser). Em Node/testes
 * o registro fica vazio, então as funções puras permanecem determinísticas.
 * ------------------------------------------------------------------------- */
const CUSTOM_BY_CODE = new Map<string, CommercialUnit>();
export const CUSTOM_UNITS_STORAGE_KEY = 'fireowl.customUnits.v1';

/** Registra (ou substitui) uma unidade personalizada em memória. */
export function registerCustomUnit(u: { code: string; label: string; allowDecimals: boolean }): CommercialUnit {
  const unit: CommercialUnit = {
    code: u.code.trim(),
    label: (u.label || u.code).trim(),
    category: 'personalizado',
    allowDecimals: !!u.allowDecimals,
  };
  CUSTOM_BY_CODE.set(unit.code, unit);
  return unit;
}

/** Unidades personalizadas atualmente conhecidas (na ordem de inserção). */
export function getCustomUnits(): CommercialUnit[] {
  return [...CUSTOM_BY_CODE.values()];
}

/** Base canônica + personalizadas. */
export function allUnits(): CommercialUnit[] {
  return [...COMMERCIAL_UNITS, ...getCustomUnits()];
}

/** Carrega personalizadas do localStorage (idempotente; no-op fora do browser). */
export function hydrateCustomUnits(): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(CUSTOM_UNITS_STORAGE_KEY);
    if (!raw) return;
    const list = JSON.parse(raw) as { code?: string; label?: string; allowDecimals?: boolean }[];
    if (!Array.isArray(list)) return;
    for (const u of list) {
      if (u && typeof u.code === 'string' && u.code.trim() && !BY_CODE.has(u.code.trim())) {
        registerCustomUnit({ code: u.code, label: u.label || u.code, allowDecimals: !!u.allowDecimals });
      }
    }
  } catch { /* storage indisponível → segue só com canônicas */ }
}

/** Persiste o registro atual de personalizadas (no-op fora do browser). */
export function persistCustomUnits(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CUSTOM_UNITS_STORAGE_KEY, JSON.stringify(getCustomUnits()));
  } catch { /* storage indisponível → mantém só em memória nesta sessão */ }
}

export interface CustomUnitValidation {
  ok: boolean;
  /** Sigla final a persistir (quando ok). */
  code?: string;
  label?: string;
  /** Mensagem de erro/orientação (quando !ok). */
  error?: string;
  /** Quando a sigla digitada já existe como canônica: a sigla canônica sugerida. */
  canonicalSuggestion?: string;
}

/**
 * Valida a criação de uma unidade personalizada (PARTE 12):
 * normaliza espaços, valida tamanho, impede duplicar canônica (orienta a usar a
 * existente) e impede duplicar outra personalizada.
 */
export function validateCustomUnit(nameRaw: string, siglaRaw: string): CustomUnitValidation {
  const label = (nameRaw || '').trim().replace(/\s+/g, ' ');
  const code = (siglaRaw || '').trim().replace(/\s+/g, '');
  if (!label) return { ok: false, error: 'Informe o nome da unidade.' };
  if (!code) return { ok: false, error: 'Informe a sigla da unidade.' };
  if (code.length > 8) return { ok: false, error: 'A sigla deve ter no máximo 8 caracteres.' };
  if (label.length > 40) return { ok: false, error: 'O nome deve ter no máximo 40 caracteres.' };
  // Já corresponde a uma unidade canônica (direto ou por alias)? → orientar.
  const canonical = normalizeUnitCode(code);
  if (isCanonicalUnit(canonical)) {
    const u = BY_CODE.get(canonical)!;
    return { ok: false, canonicalSuggestion: canonical, error: `Já existe a unidade canônica "${u.label} (${canonical})". Use-a em vez de criar uma personalizada.` };
  }
  if (isCanonicalUnit(code)) {
    return { ok: false, canonicalSuggestion: code, error: `"${code}" já é uma unidade padrão. Use-a em vez de criar uma personalizada.` };
  }
  if (CUSTOM_BY_CODE.has(code)) return { ok: false, error: `A unidade personalizada "${code}" já existe.` };
  return { ok: true, code, label };
}

/** Casa a sigla exatamente como cadastrada (canônica ou personalizada). */
export function unitByCode(code?: string | null): CommercialUnit | undefined {
  if (!code) return undefined;
  const c = code.trim();
  return BY_CODE.get(c) || CUSTOM_BY_CODE.get(c);
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

/** Busca tolerante a caixa, acentos e espaços, pelo nome ou pela sigla. */
export function searchCommercialUnits(query: string): CommercialUnit[] {
  const term = stripKey(query);
  const base = allUnits();
  if (!term) return base;
  return base.filter((unit) =>
    stripKey(unit.label).includes(term) || stripKey(unit.code).includes(term),
  );
}

/** Agrupa na ordem de apresentação oficial, omitindo grupos vazios. */
export function groupCommercialUnits(units: CommercialUnit[] = allUnits()): UnitGroup[] {
  return UNIT_CATEGORY_ORDER.map((category) => ({
    category,
    label: UNIT_CATEGORY_LABELS[category],
    units: units.filter((unit) => unit.category === category),
  })).filter((group) => group.units.length > 0);
}

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

/** Mensagem de validação sem alterar ou arredondar a quantidade informada. */
export function quantityUnitError(qty: number, unitCode?: string | null): string | null {
  const value = Number(qty);
  if (Number.isFinite(value) && !Number.isInteger(value) && !unitAllowsDecimals(unitCode)) {
    return `A unidade '${normalizeUnitCode(unitCode)}' aceita somente quantidades inteiras.`;
  }
  return null;
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
