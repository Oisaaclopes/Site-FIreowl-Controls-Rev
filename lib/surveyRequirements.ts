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
