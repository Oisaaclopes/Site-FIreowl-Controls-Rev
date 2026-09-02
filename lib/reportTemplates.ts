import { getSupabaseClient } from './supabaseClient';
import { ReportTemplate } from './types';
import { TemplateSchema } from './reportSchema';
import { canonicalSchemaHash, DEFAULT_TEMPLATE_VERSION } from './reportTemplateVersioning';

const TABLE = 'report_templates';

function rowToTemplate(r: any): ReportTemplate {
  return {
    id: String(r.id),
    codigo: r.codigo || '',
    nome: r.nome || '',
    tipo: (r.tipo || 'LEVANTAMENTO') as ReportTemplate['tipo'],
    schema: r.schema ?? {},
    ativo: r.ativo !== false,
    versao: Number(r.versao ?? 1),
  };
}

function templateToRow(t: ReportTemplate): Record<string, unknown> {
  const row: Record<string, unknown> = {
    codigo: t.codigo,
    nome: t.nome,
    tipo: t.tipo,
    schema: t.schema ?? {},
    ativo: t.ativo,
    versao: t.versao ?? 1,
    updated_at: new Date().toISOString(),
  };
  if (t.id) row.id = t.id;
  return row;
}

export async function fetchTemplates(): Promise<ReportTemplate[]> {
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase.from(TABLE).select('*').order('codigo', { ascending: true });
  if (error) throw error;
  return (data || []).map(rowToTemplate);
}

export async function fetchTemplateByCodigo(codigo: string): Promise<ReportTemplate | null> {
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase.from(TABLE).select('*').eq('codigo', codigo).maybeSingle();
  if (error) throw error;
  return data ? rowToTemplate(data) : null;
}

/** Upsert por `codigo` (LEGADO — pode sobrescrever o schema vigente). NÃO use no
 *  seed: prefira publishTemplate (versionado e não-destrutivo). */
export async function upsertTemplate(t: ReportTemplate): Promise<ReportTemplate> {
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase.from(TABLE).upsert(templateToRow(t), { onConflict: 'codigo' }).select().single();
  if (error) throw error;
  return rowToTemplate(data);
}

/** Capacidade: a coluna schema_hash existe (migration 0075 aplicada)? Se não,
 *  o seed versionado é PULADO (evita o upsert destrutivo antigo) — deploy seguro
 *  antes da migration. */
export async function reportTemplatesSupportsVersioning(): Promise<boolean> {
  const supabase = getSupabaseClient() as any;
  const { error } = await supabase.from(TABLE).select('schema_hash').limit(1);
  return !error;
}

export type PublishResult = 'unsupported' | 'inserted' | 'noop' | 'aligned' | 'advanced' | 'conflict' | 'behind';

/**
 * Publicação IDEMPOTENTE e NÃO-DESTRUTIVA de uma versão de template (FASE 8/18).
 * report_templates guarda a versão VIGENTE por código; o histórico fiel vive nos
 * snapshots dos relatórios. Regras:
 *  - coluna schema_hash ausente (0075 pendente) → 'unsupported' (não faz nada);
 *  - código inexistente → insere ('inserted');
 *  - mesma versão + mesmo hash → 'noop';
 *  - mesma versão + schema_hash NULL (linha pré-versionamento) → 'aligned':
 *    adota o schema/hash do código UMA VEZ (baseline); NÃO destrói histórico
 *    (que vive nos snapshots dos relatórios);
 *  - mesma versão + hash DIFERENTE (já com baseline) → 'conflict' (NÃO
 *    sobrescreve — exige bump de versão);
 *  - código com versão MENOR → 'advanced' (publica a nova vigente);
 *  - código com versão MAIOR no banco → 'behind' (código atrás; não mexe).
 */
export async function publishTemplate(schema: TemplateSchema): Promise<PublishResult> {
  const supabase = getSupabaseClient() as any;
  const versao = schema.versao ?? DEFAULT_TEMPLATE_VERSION;
  const hash = canonicalSchemaHash(schema);

  const { data: existing, error: selErr } = await supabase
    .from(TABLE).select('id, versao, schema_hash').eq('codigo', schema.codigo).maybeSingle();
  if (selErr) return 'unsupported'; // schema_hash ausente ou tabela indisponível

  const baseRow = {
    codigo: schema.codigo,
    nome: schema.nome,
    tipo: schema.tipo,
    schema: schema as unknown as Record<string, unknown>,
    schema_hash: hash,
    ativo: true,
    versao,
    updated_at: new Date().toISOString(),
  };

  if (!existing) {
    const { error } = await supabase.from(TABLE).insert(baseRow);
    if (error) throw error;
    return 'inserted';
  }
  if (existing.versao === versao) {
    if (existing.schema_hash === hash) return 'noop';
    if (existing.schema_hash == null) {
      // Linha pré-versionamento (sem baseline de hash): adota o schema do código
      // UMA vez para estabelecer o baseline. Não toca em snapshots históricos.
      const { error } = await supabase.from(TABLE).update(baseRow).eq('id', existing.id);
      if (error) throw error;
      return 'aligned';
    }
    return 'conflict'; // baseline já existe e schema mudou: exige bump de versão
  }
  if (existing.versao < versao) {
    const { error } = await supabase.from(TABLE).update(baseRow).eq('id', existing.id);
    if (error) throw error;
    return 'advanced';
  }
  return 'behind'; // banco à frente do código; não regride
}
