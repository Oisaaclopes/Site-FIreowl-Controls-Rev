import { getSupabaseClient } from './supabaseClient';
import { ReportTemplate } from './types';

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

/** Upsert por `codigo` (garante um template por código). */
export async function upsertTemplate(t: ReportTemplate): Promise<ReportTemplate> {
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase.from(TABLE).upsert(templateToRow(t), { onConflict: 'codigo' }).select().single();
  if (error) throw error;
  return rowToTemplate(data);
}
