/* =====================================================================
 * CAMPO 2B — Versionamento de templates e resolução do template de um
 * relatório (snapshot imutável). Puro; sem chamadas ao banco.
 *
 * PRINCÍPIO:
 *  - TEMPLATE  = definição reutilizável e evolutiva (report_templates, vigente).
 *  - RELATÓRIO = registro histórico IMUTÁVEL da estrutura usada no atendimento
 *    (reports.template_snapshot + reports.template_version).
 *
 * Evoluir o template NUNCA reinterpreta relatórios antigos: cada relatório
 * carrega seu próprio snapshot. Ver 0075 e docs/TEMPLATE_VERSIONING.md.
 * ===================================================================== */

import type { TemplateSchema } from './reportSchema';

export const DEFAULT_TEMPLATE_VERSION = 1;

/** De onde veio a definição usada para interpretar um relatório. */
export type TemplateSource =
  | 'snapshot'        // relatório com snapshot próprio (histórico fiel)
  | 'legacy_current'  // legado sem snapshot → fallback ao template vigente (runtime)
  | 'unknown';        // nem snapshot nem template vigente por código

export interface ResolvedReportTemplate {
  template: TemplateSchema | null;
  /** Versão real do snapshot; NULL em legado (não inventamos versão histórica). */
  version: number | null;
  source: TemplateSource;
}

/** Um snapshot é válido se parece um TemplateSchema (tem `secoes` em array). */
export function isValidSnapshot(snapshot: unknown): snapshot is TemplateSchema {
  return !!snapshot
    && typeof snapshot === 'object'
    && Array.isArray((snapshot as { secoes?: unknown }).secoes);
}

/**
 * Resolução CANÔNICA (FASE 15): NOVO/snapshot → usa o snapshot; LEGADO sem
 * snapshot → cai para o template vigente por código (fallback explícito, sem
 * inventar versão); desconhecido → unknown (a UI/PDF degradam sem crashar).
 * Snapshot inválido é tratado como ausente (não derruba o app).
 */
export function resolveReportTemplate(
  report: { templateCodigo?: string; templateSnapshot?: unknown; templateVersion?: number | null },
  currentTemplates: TemplateSchema[]
): ResolvedReportTemplate {
  if (isValidSnapshot(report.templateSnapshot)) {
    const snap = report.templateSnapshot;
    return {
      template: snap,
      version: report.templateVersion ?? snap.versao ?? DEFAULT_TEMPLATE_VERSION,
      source: 'snapshot',
    };
  }
  const vigente = currentTemplates.find((t) => t.codigo === report.templateCodigo) || null;
  if (vigente) {
    // Legado: usa a estrutura vigente só para conseguir abrir/ler; NÃO afirma
    // que o relatório foi feito nesta versão (version = null).
    return { template: vigente, version: null, source: 'legacy_current' };
  }
  return { template: null, version: null, source: 'unknown' };
}

/**
 * Hash canônico e determinístico de um schema (chaves ordenadas), para detectar
 * mudança de definição no seed (FASE 8) sem depender de igualdade de referência.
 * A `versao` é EXCLUÍDA do hash: ela identifica a versão, não faz parte do
 * "conteúdo" comparado. FNV-1a de 32 bits em hex — puro, sem dependências.
 */
export function canonicalSchemaHash(schema: TemplateSchema): string {
  const canonical = stableStringify(stripVersion(schema));
  return fnv1a(canonical);
}

function stripVersion(schema: TemplateSchema): Omit<TemplateSchema, 'versao'> {
  const { versao: _omit, ...rest } = schema;
  void _omit;
  return rest;
}

/** JSON com chaves ordenadas recursivamente (arrays preservam a ordem). */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

function fnv1a(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    // multiplicação FNV com wrap de 32 bits
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}
