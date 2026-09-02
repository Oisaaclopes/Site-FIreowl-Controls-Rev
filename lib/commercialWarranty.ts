/* =====================================================================
 * Garantia comercial estruturada (mão de obra × materiais).
 *
 * Substitui, no fluxo VIVO, a garantia de texto livre único. Cada "perna"
 * (mão de obra / materiais) é independente: pode ser desativada, seguir um
 * prazo em dias/meses, "conforme fabricante" ou um texto personalizado.
 *
 * Compatibilidade: propostas antigas guardam `garantia: string`. O normalizador
 * as converte para o modo LEGADO ({ mode: 'legacy_text', text }) SEM tentar
 * interpretar semanticamente o texto — o PDF reproduz o histórico exatamente.
 *
 * Módulo PURO e testável isoladamente.
 * ===================================================================== */

export type WarrantyMode = 'dias' | 'meses' | 'fabricante' | 'personalizado';

export interface WarrantyLeg {
  enabled: boolean;
  mode: WarrantyMode;
  /** Prazo (usado em 'dias' / 'meses'). */
  value?: number;
  /** Texto exato (usado em 'personalizado'). */
  textoPersonalizado?: string;
}

export interface StructuredWarranty {
  maoDeObra: WarrantyLeg;
  materiais: WarrantyLeg;
  observacoes?: string;
}

/** Garantia herdada de propostas antigas (texto livre único). Não reinterpretar. */
export interface LegacyWarranty {
  mode: 'legacy_text';
  text: string;
}

export type CommercialWarranty = StructuredWarranty | LegacyWarranty;

/**
 * Default inicial (sugestão visível e editável — PARTE 4). Fonte ÚNICA do
 * "90 dias mão de obra / 12 meses materiais". Não repetir em outros lugares.
 */
export function defaultWarranty(): StructuredWarranty {
  return {
    maoDeObra: { enabled: true, mode: 'dias', value: 90 },
    materiais: { enabled: true, mode: 'meses', value: 12 },
  };
}

export function isLegacyWarranty(w: CommercialWarranty | undefined): w is LegacyWarranty {
  return !!w && (w as LegacyWarranty).mode === 'legacy_text';
}

export function isStructuredWarranty(w: CommercialWarranty | undefined): w is StructuredWarranty {
  return !!w && !isLegacyWarranty(w) && 'maoDeObra' in (w as StructuredWarranty);
}

const VALID_MODES: WarrantyMode[] = ['dias', 'meses', 'fabricante', 'personalizado'];

function normalizeLeg(raw: unknown): WarrantyLeg {
  const l = (raw || {}) as Partial<WarrantyLeg>;
  const mode = VALID_MODES.includes(l.mode as WarrantyMode) ? (l.mode as WarrantyMode) : 'meses';
  const value =
    l.value != null && Number.isFinite(Number(l.value)) ? Math.max(0, Math.floor(Number(l.value))) : undefined;
  return {
    enabled: l.enabled !== false,
    mode,
    value,
    textoPersonalizado: typeof l.textoPersonalizado === 'string' ? l.textoPersonalizado : undefined,
  };
}

/**
 * Normaliza qualquer forma de garantia para {@link CommercialWarranty}.
 * - string não vazia → modo legado (texto preservado exatamente);
 * - string vazia/ausente → modo legado com texto '' (NÃO injeta default:
 *   quem cria proposta nova aplica defaultWarranty() explicitamente);
 * - objeto legado → passthrough;
 * - objeto estruturado → coage as duas pernas + observações.
 */
export function normalizeCommercialWarranty(input: unknown): CommercialWarranty {
  if (input == null) return { mode: 'legacy_text', text: '' };
  if (typeof input === 'string') return { mode: 'legacy_text', text: input };
  const obj = input as Record<string, unknown>;
  if (obj.mode === 'legacy_text') {
    return { mode: 'legacy_text', text: typeof obj.text === 'string' ? obj.text : '' };
  }
  if ('maoDeObra' in obj || 'materiais' in obj) {
    return {
      maoDeObra: normalizeLeg(obj.maoDeObra),
      materiais: normalizeLeg(obj.materiais),
      observacoes: typeof obj.observacoes === 'string' && obj.observacoes.trim() ? obj.observacoes.trim() : undefined,
    };
  }
  // Formato irreconhecível → trata como legado vazio (seguro).
  return { mode: 'legacy_text', text: '' };
}

const mesesLabel = (n: number) => `${n} ${n === 1 ? 'mês' : 'meses'}`;
const diasLabel = (n: number) => `${n} ${n === 1 ? 'dia' : 'dias'}`;

/** Texto de uma perna, ou null se desativada/vazia (não deve aparecer no PDF). */
export function legText(leg: WarrantyLeg | undefined): string | null {
  if (!leg || !leg.enabled) return null;
  switch (leg.mode) {
    case 'dias':
      return leg.value && leg.value > 0 ? diasLabel(leg.value) : null;
    case 'meses':
      return leg.value && leg.value > 0 ? mesesLabel(leg.value) : null;
    case 'fabricante':
      return 'Conforme garantia do fabricante';
    case 'personalizado': {
      const t = (leg.textoPersonalizado || '').trim();
      return t.length ? t : null;
    }
    default:
      return null;
  }
}

export interface WarrantyRender {
  /** Modo legado: texto histórico único (reproduzir verbatim). */
  legacyText?: string;
  maoDeObra?: string;
  materiais?: string;
  observacoes?: string;
  /** Se false, a seção de garantia NÃO deve aparecer no documento. */
  hasAny: boolean;
}

/** Converte a garantia normalizada no que o PDF imprime. Renderer puro. */
export function renderWarranty(w: CommercialWarranty | undefined): WarrantyRender {
  const warranty = normalizeCommercialWarranty(w);
  if (isLegacyWarranty(warranty)) {
    const text = warranty.text.trim();
    return { legacyText: text || undefined, hasAny: text.length > 0 };
  }
  const mao = legText(warranty.maoDeObra);
  const mat = legText(warranty.materiais);
  const obs = (warranty.observacoes || '').trim() || undefined;
  return {
    maoDeObra: mao || undefined,
    materiais: mat || undefined,
    observacoes: obs,
    hasAny: !!(mao || mat || obs),
  };
}

/** true se a garantia estruturada tem alguma perna ativa mas sem condição válida. */
export function warrantyHasEnabledButEmptyLeg(w: CommercialWarranty | undefined): boolean {
  const warranty = normalizeCommercialWarranty(w);
  if (!isStructuredWarranty(warranty)) return false;
  const check = (leg: WarrantyLeg) => leg.enabled && legText(leg) === null;
  return check(warranty.maoDeObra) || check(warranty.materiais);
}
