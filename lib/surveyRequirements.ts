import { getSupabaseClient } from './supabaseClient';
import { RequiredMaterial, RequiredService, SurveyMeasurement, SurveyOrderLink, TechnicalOrigin } from './types';

const originFromRow = (r: any, reportId: string): TechnicalOrigin => ({ type: r.source_type || 'general', reportId, reference: r.source_reference || undefined, label: r.source_label || 'Necessidade geral', quantity: Number(r.quantidade || 0) });

export async function fetchSurveyRequirements(reportId: string): Promise<{ materials: RequiredMaterial[]; services: RequiredService[]; measurements: SurveyMeasurement[] }> {
  const sb = getSupabaseClient() as any;
  const [m, s, med] = await Promise.all([
    sb.from('report_required_materials').select('*').eq('report_id', reportId),
    sb.from('report_required_services').select('*').eq('report_id', reportId),
    sb.from('report_measurements').select('*').eq('report_id', reportId),
  ]);
  if (m.error) throw m.error; if (s.error) throw s.error; if (med.error) throw med.error;
  return {
    materials: (m.data || []).map((r: any) => ({ id: r.id, reportId, catalogItemId: r.catalog_item_id || undefined, descricao: r.descricao, marca: r.marca || undefined, modelo: r.modelo || undefined, quantidade: Number(r.quantidade), unidade: r.unidade, observacao: r.observacao || undefined, origem: originFromRow(r, reportId) })),
    services: (s.data || []).map((r: any) => ({ id: r.id, reportId, serviceId: r.service_id || undefined, descricao: r.descricao, quantidade: Number(r.quantidade), unidade: r.unidade, observacao: r.observacao || undefined, origem: originFromRow(r, reportId) })),
    measurements: (med.data || []).map((r: any) => ({ id: r.id, reportId, categoria: r.categoria, descricao: r.descricao, quantidade: Number(r.quantidade), unidade: r.unidade, local: r.local || undefined, observacao: r.observacao || undefined, catalogItemId: r.catalog_item_id || undefined, incluirNoPedido: !!r.incluir_no_pedido, origem: r.source_label ? originFromRow(r, reportId) : undefined })),
  };
}

export async function fetchSurveyOrderLinks(reportId: string): Promise<SurveyOrderLink[]> {
  const sb = getSupabaseClient() as any; const { data, error } = await sb.from('report_order_links').select('*').eq('report_id', reportId);
  if (error) throw error;
  return (data || []).map((r: any) => ({ id: r.id, reportId: r.report_id, pedidoId: r.pedido_id, criadoEm: r.created_at }));
}

/** Materializa as respostas estruturadas do FormEngine. Não toca estoque. */
export async function replaceSurveyRequirements(reportId: string, answers: { fieldKey: string; valor: unknown }[]): Promise<void> {
  const sb = getSupabaseClient() as any;
  const cards = (key: string) => answers.find((a) => a.fieldKey === key)?.valor;
  const materials = Array.isArray(cards('materiais_necessarios')) ? cards('materiais_necessarios') as Record<string, unknown>[] : [];
  const services = Array.isArray(cards('servicos_necessarios')) ? cards('servicos_necessarios') as Record<string, unknown>[] : [];
  const measurements = Array.isArray(cards('medicoes')) ? cards('medicoes') as Record<string, unknown>[] : [];
  await Promise.all(['report_required_materials', 'report_required_services', 'report_measurements'].map((table) => sb.from(table).delete().eq('report_id', reportId)));
  if (materials.length) await sb.from('report_required_materials').insert(materials.map((c) => ({ report_id: reportId, catalog_item_id: c.item_catalogo_id || null, descricao: String(c.item || c.descricao || 'Material'), marca: c.marca || null, modelo: c.modelo || null, quantidade: Number(c.quantidade) || 1, unidade: c.unidade || 'un', observacao: c.observacao || null, source_type: c.source_type || 'general', source_reference: c.source_reference || null, source_label: c.source_label || 'Necessidade geral' })));
  if (services.length) await sb.from('report_required_services').insert(services.map((c) => ({ report_id: reportId, service_id: c.service_id || null, descricao: String(c.servico || c.descricao || 'Serviço'), quantidade: Number(c.quantidade) || 1, unidade: c.unidade || 'un', observacao: c.observacao || null, source_type: c.source_type || 'general', source_reference: c.source_reference || null, source_label: c.source_label || 'Necessidade geral' })));
  if (measurements.length) await sb.from('report_measurements').insert(measurements.map((c) => ({ report_id: reportId, categoria: c.categoria || 'outro', descricao: String(c.descricao || 'Medição'), quantidade: Number(c.quantidade) || 0, unidade: c.unidade || 'm', local: c.local || null, observacao: c.observacao || null, catalog_item_id: c.item_catalogo_id || null, incluir_no_pedido: c.incluir_no_pedido === true || c.incluir_no_pedido === 'Sim', source_type: c.source_type || null, source_reference: c.source_reference || null, source_label: c.source_label || null })));
}
