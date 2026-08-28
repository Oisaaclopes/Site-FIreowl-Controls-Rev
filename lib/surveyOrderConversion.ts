import { fetchClients } from './clients';
import { fetchInventory } from './inventory';
import { fetchPedidos, upsertPedido } from './pedidos';
import { fetchReports } from './reports';
import { createSurveyOrderLink, fetchSurveyOrderLinks, fetchSurveyRequirements } from './surveyRequirements';
import { CommercialProposalData, Pedido, PedidoEquipmentItem, TechnicalOrigin } from './types';

export type SurveyOrderConversionResult = { pedido: Pedido; alreadyExists: boolean; warnings: string[] };

const normalize = (value: string | undefined) => (value || '').trim().toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ');
const numeric = (value: unknown, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

function makeId(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `ped-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function nextNumber(existing: Pedido[]): string {
  const year = new Date().getFullYear();
  const prefix = `PED-${year}-`;
  const max = existing.reduce((highest, pedido) => {
    if (!pedido.numeroPedido.startsWith(prefix)) return highest;
    const value = Number(pedido.numeroPedido.slice(prefix.length));
    return Number.isFinite(value) ? Math.max(highest, value) : highest;
  }, 0);
  return `${prefix}${String(max + 1).padStart(4, '0')}`;
}

function appendGroupedItem(groups: Map<string, PedidoEquipmentItem>, key: string, item: Omit<PedidoEquipmentItem, 'itemNumero'>) {
  const existing = groups.get(key);
  if (existing) {
    existing.quantidade += item.quantidade;
    existing.sourceOrigins = [...(existing.sourceOrigins || []), ...(item.sourceOrigins || [])];
    return;
  }
  groups.set(key, { ...item, itemNumero: groups.size + 1 });
}

/**
 * Converte necessidades persistidas de um levantamento em pedido rascunho.
 * Não movimenta, reserva ou baixa saldo de estoque.
 */
export async function createOrderFromSurvey(reportId: string): Promise<SurveyOrderConversionResult> {
  const [reports, clients, existingOrders, inventory, existingLinks] = await Promise.all([
    fetchReports(), fetchClients(), fetchPedidos(), fetchInventory(), fetchSurveyOrderLinks(reportId),
  ]);
  const report = reports.find((candidate) => candidate.id === reportId);
  if (!report) throw new Error('Levantamento não encontrado.');
  if (report.tipo !== 'LEVANTAMENTO') throw new Error('Somente relatórios de levantamento podem gerar um Pedido.');
  if (report.status !== 'finalizado') throw new Error('Finalize o levantamento antes de criar o Pedido.');
  if (!report.clienteId) throw new Error('O levantamento precisa estar vinculado a um cliente.');
  const client = clients.find((candidate) => candidate.id === report.clienteId);
  if (!client) throw new Error('Cliente do levantamento não encontrado.');

  const existingLink = existingLinks[0];
  if (existingLink) {
    const pedido = existingOrders.find((candidate) => candidate.id === existingLink.pedidoId);
    if (pedido) return { pedido, alreadyExists: true, warnings: [] };
  }

  const requirements = await fetchSurveyRequirements(reportId);
  const stockById = new Map(inventory.map((item) => [item.id, item]));
  const warnings: string[] = [];
  const grouped = new Map<string, PedidoEquipmentItem>();

  for (const material of requirements.materials) {
    const inventoryItem = material.catalogItemId ? stockById.get(material.catalogItemId) : undefined;
    const brandModel = [material.marca || inventoryItem?.brand, material.modelo || inventoryItem?.model].filter(Boolean).join(' · ');
    const price = inventoryItem?.salePrice ?? inventoryItem?.unitPrice ?? 0;
    if (!inventoryItem) warnings.push(`Material sem vínculo com estoque: ${material.descricao}.`);
    if (!price) warnings.push(`Preço pendente para: ${material.descricao}.`);
    appendGroupedItem(grouped, `m:${material.catalogItemId || [material.descricao, brandModel, material.unidade].map(normalize).join('|')}`, {
      descricao: material.descricao,
      descricaoDetalhada: material.observacao,
      marcaModelo: brandModel,
      unidade: material.unidade || inventoryItem?.unit || 'un',
      quantidade: numeric(material.quantidade, 1),
      vinculoEstoqueId: material.catalogItemId,
      tipo: 'material',
      precoUnitario: price,
      stockSnapshot: inventoryItem?.quantity,
      sourceOrigins: [material.origem],
    });
  }

  for (const measurement of requirements.measurements.filter((item) => item.incluirNoPedido)) {
    const inventoryItem = measurement.catalogItemId ? stockById.get(measurement.catalogItemId) : undefined;
    const origin: TechnicalOrigin = measurement.origem || { type: 'measurement', reportId, label: measurement.local ? `Medição — ${measurement.local}` : 'Medição de levantamento', quantity: measurement.quantidade };
    const price = inventoryItem?.salePrice ?? inventoryItem?.unitPrice ?? 0;
    if (!inventoryItem) warnings.push(`Medição incluída sem vínculo com estoque: ${measurement.descricao}.`);
    if (!price) warnings.push(`Preço pendente para: ${measurement.descricao}.`);
    appendGroupedItem(grouped, `med:${measurement.catalogItemId || [measurement.descricao, measurement.unidade].map(normalize).join('|')}`, {
      descricao: measurement.descricao,
      descricaoDetalhada: [measurement.local, measurement.observacao].filter(Boolean).join(' — ') || undefined,
      marcaModelo: [inventoryItem?.brand, inventoryItem?.model].filter(Boolean).join(' · '),
      unidade: measurement.unidade || inventoryItem?.unit || 'un',
      quantidade: numeric(measurement.quantidade),
      vinculoEstoqueId: measurement.catalogItemId,
      tipo: 'material',
      precoUnitario: price,
      stockSnapshot: inventoryItem?.quantity,
      sourceOrigins: [origin],
    });
  }

  for (const service of requirements.services) {
    appendGroupedItem(grouped, `s:${service.serviceId || [service.descricao, service.unidade].map(normalize).join('|')}`, {
      descricao: service.descricao,
      descricaoDetalhada: service.observacao,
      marcaModelo: '',
      unidade: service.unidade || 'un',
      quantidade: numeric(service.quantidade, 1),
      vinculoServicoId: service.serviceId,
      tipo: 'servico',
      precoUnitario: 0,
      sourceOrigins: [service.origem],
    });
    warnings.push(`Preço pendente para serviço: ${service.descricao}.`);
  }

  const equipmentItems = [...grouped.values()].map((item, index) => ({ ...item, itemNumero: index + 1 }));
  if (!equipmentItems.length) warnings.push('Nenhuma necessidade foi incluída; o Pedido foi aberto vazio para revisão.');
  const now = new Date().toISOString();
  const proposal: CommercialProposalData = {
    pedidoTipo: 'orcamento',
    surveyOrigin: { reportId, reportNumber: report.numero, reportArea: report.templateCodigo, createdAt: now },
    objetivo: `Atender às necessidades identificadas no levantamento técnico ${report.numero || report.id}.`,
    diretrizesNormativas: [], escopoServico: '', entregaveis: [], premissas: [], prazoExecucao: '', garantia: '',
    validadePropostaDias: 30, conclusao: '', equipmentItems, marcas: [], responsabilidadesContratada: [], responsabilidadesContratante: [],
    valorTotal: equipmentItems.reduce((sum, item) => sum + item.quantidade * (item.precoUnitario || 0), 0),
    composicaoValor: '', formaPagamento: '', faturamento: '', impostos: '',
  };
  const pedido: Pedido = {
    id: makeId(), numeroPedido: nextNumber(existingOrders), referencia: `Levantamento ${report.numero || report.id}`,
    clienteId: client.id, clienteNome: client.name, fornecedor: 'Fireowl Controls Ltda.', dataEmissao: now.slice(0, 10),
    responsavelComercialId: '', responsavelComercialNome: report.tecnicoNome || '', status: 'rascunho', proposal, createdAt: now, updatedAt: now,
  };
  const saved = await upsertPedido(pedido);
  await createSurveyOrderLink(reportId, saved.id);
  return { pedido: saved, alreadyExists: false, warnings: [...new Set(warnings)] };
}
