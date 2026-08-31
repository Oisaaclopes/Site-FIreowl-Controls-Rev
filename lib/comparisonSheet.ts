import type { ResolvedComparison } from './fieldPhotoComparisons';
import { RESULT_LABEL } from './fieldPhotoComparisons';

/* =====================================================================
 * Folha de Fotos — modo Antes × Depois (Fase 3.2, integração documental).
 * Usa as comparações persistentes (field_photo_comparisons) como fonte de
 * verdade — nunca reconstrói pares por marcador. Helpers puros e testáveis.
 * ===================================================================== */

/** Legenda de uma comparação no PDF (sem imagens; sem dados internos). */
export interface ComparisonLegend {
  id: string;
  numero: string;        // "01"
  titulo: string;        // "COMPARAÇÃO 01" quando sem título próprio
  localBefore?: string;
  localAfter?: string;
  localDiff: boolean;
  beforeDateHora: string;
  afterDateHora: string;
  beforeTecnico?: string;
  afterTecnico?: string;
  descricao?: string;
  resultado?: string;    // rótulo humano
}

/** Item pronto para o documento (legenda + as duas imagens já resolvidas). */
export interface ComparisonSheetItem extends ComparisonLegend {
  beforeDataUrl: string;
  afterDataUrl: string;
}

const fmtDateHora = (iso?: string): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
};

/** Validação §A4: todas as comparações devem ser do mesmo cliente. */
export function comparisonSheetClient(items: ResolvedComparison[]): { ok: boolean; clientId?: string; clientName?: string } {
  const ids = Array.from(new Set(items.map((r) => r.before.clientId)));
  if (ids.length === 0) return { ok: true };
  if (ids.length > 1) return { ok: false };
  const named = items.find((r) => r.before.clientName);
  return { ok: true, clientId: ids[0], clientName: named?.before.clientName || ids[0] };
}

const shared = (values: (string | undefined)[]): string | undefined => {
  if (values.length === 0 || values.some((v) => !v)) return undefined;
  return new Set(values).size === 1 ? values[0] : undefined;
};

/** Referência automática só quando TODAS as comparações compartilham (§A15). */
export function sharedComparisonReference(items: ResolvedComparison[]): { osId?: string; reportId?: string } {
  return {
    osId: shared(items.map((r) => r.comparison.osId)),
    reportId: shared(items.map((r) => r.comparison.reportId)),
  };
}

/** Numeração documental COMPARAÇÃO NN (não altera IDs, §A14). */
export function comparisonNumber(index: number): string {
  return String(index + 1).padStart(2, '0');
}

/** Legenda (campos seguros) de uma comparação; imagens são anexadas depois. */
export function comparisonLegend(r: ResolvedComparison, index: number): ComparisonLegend {
  const numero = comparisonNumber(index);
  const localBefore = r.before.localSetor || undefined;
  const localAfter = r.after.localSetor || undefined;
  return {
    id: r.comparison.id,
    numero,
    titulo: r.comparison.titulo?.trim() || `Comparação ${numero}`,
    localBefore,
    localAfter,
    localDiff: (localBefore || '') !== (localAfter || ''),
    beforeDateHora: fmtDateHora(r.before.capturadoEm),
    afterDateHora: fmtDateHora(r.after.capturadoEm),
    beforeTecnico: r.before.tecnicoNome || undefined,
    afterTecnico: r.after.tecnicoNome || undefined,
    descricao: r.comparison.descricao?.trim() || undefined,
    resultado: r.comparison.resultado ? RESULT_LABEL[r.comparison.resultado] : undefined,
  };
}
