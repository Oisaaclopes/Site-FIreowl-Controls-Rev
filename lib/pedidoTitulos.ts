import type { CommercialProposalData, PedidoTipo } from './types';
import { areaById, tipoById, gerarTituloProposta } from './propostaTitulo';

type Contexto = Pick<CommercialProposalData, 'areaPrincipal' | 'tipoServico' | 'pedidoTipo' | 'modalidade'>;
const prefixos: Record<PedidoTipo, string> = {
  orcamento: 'Orçamento', proposta: 'Proposta Técnico-Comercial',
  servico: 'Proposta Técnico-Comercial', fornecimento: 'Orçamento', laudo: 'Laudo Técnico',
};
const juntar = (nomes: string[]) => nomes.length < 2 ? nomes[0] : `${nomes.slice(0, -1).join(', ')} e ${nomes.at(-1)}`;

export function gerarReferenciaPedido(p: Contexto): string {
  const areas = [...new Set(p.areaPrincipal || [])].map(areaById).filter((a) => !!a);
  if (!areas.length) return '';
  if (p.modalidade === 'somente_material') return `Fornecimento de Materiais para ${juntar(areas.map(a => a.sigla))}`;
  const tipo = tipoById(p.tipoServico);
  if (!tipo) return '';
  const nomes: Record<string, string> = { cftv: 'Sistema de CFTV', bms: 'Sistema de Automação/BMS' };
  const area = areas.length > 1 ? `Sistemas de ${juntar(areas.map(a => a.sigla))}` : nomes[areas[0].id] || areas[0].nome;
  const servicos: Record<string, string> = { retrofit: 'Retrofit', projeto: 'Projeto e Engenharia', outro: 'Serviços' };
  const novo = ['instalacao', 'implantacao', 'projeto', 'fornecimento', 'outro'].includes(tipo.id);
  const preposicao = novo ? 'de' : area.startsWith('Sistemas') ? 'dos' : area.startsWith('Sistema') ? 'do' : 'de';
  return `${servicos[tipo.id] || tipo.label} ${preposicao} ${area}`;
}

export function gerarTituloPedido(p: Contexto): string {
  const referencia = gerarReferenciaPedido(p);
  return p.pedidoTipo && referencia ? `${prefixos[p.pedidoTipo]} para ${referencia}` : '';
}

/** tituloManual também contém snapshots automáticos históricos. */
export function tituloFoiPersonalizado(p: Partial<CommercialProposalData>): boolean {
  if (p.tituloEditadoManualmente !== undefined) return p.tituloEditadoManualmente;
  const titulo = p.tituloManual?.trim();
  return !!titulo && titulo !== gerarTituloPedido(p) && titulo !== gerarTituloProposta(p.areaPrincipal || [], p.tipoServico);
}

export function resolverTituloPedido(p: Partial<CommercialProposalData>): string {
  return tituloFoiPersonalizado(p) ? p.tituloManual || '' : gerarTituloPedido(p);
}

export function resolverTextoSugerido(sugestao: string, manual: string | null): string {
  return manual === null ? sugestao : manual;
}
