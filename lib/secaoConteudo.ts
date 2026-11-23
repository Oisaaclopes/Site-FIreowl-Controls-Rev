import { CommercialProposalData, PedidoEquipmentItem } from './types';
import { SecaoDocKey } from './documentoSecoes';
import { renderWarranty } from './commercialWarranty';
import { resolverNormasReferencia } from './normasReferencia';
import {
  SERVICOS_OFERTADOS,
  EMBALAGEM_TRANSPORTE,
  SEGURANCA_TRABALHO,
  MULTAS_ATRASO,
  LIMITACAO_RESPONSABILIDADE,
  CONFIDENCIALIDADE,
  TERMO_ACEITE,
  CONDICOES_GERAIS,
  IMPOSTOS_OBS,
} from './propostaTextos';

/**
 * "A seção tem algo para mostrar?" — regra pura usada pelos geradores de PDF
 * (Orçamento, Laudo, seções genéricas) para não gerar título vazio e para numerar.
 * Fica em lib/ (sem @react-pdf) para o editor calcular a MESMA numeração.
 * Movida sem alteração de [[components/documentos/SecoesDocumentoPdf]], que a reexporta.
 */

const nv = (s?: string) => !!s && s.trim().length > 0;
const lnv = (a?: string[]) => Array.isArray(a) && a.filter((x) => nv(x)).length > 0;

/** Contexto mínimo (SecoesCtx do PDF é compatível). */
export interface ConteudoCtx {
  p: CommercialProposalData;
  verMateriais?: boolean;
  verServicos?: boolean;
}

const txtSec = (p: CommercialProposalData, stored: string[] | undefined, fallback: string[]) =>
  stored !== undefined ? stored : p.textosMaterializados ? [] : fallback;

function servicosSec(p: CommercialProposalData) {
  return p.servicosOfertados !== undefined ? p.servicosOfertados : p.textosMaterializados ? [] : SERVICOS_OFERTADOS;
}

/** Itens que a seção "itens" mostra, conforme as listas ligadas. */
function itensVisiveis(ctx: ConteudoCtx): PedidoEquipmentItem[] {
  return (ctx.p.equipmentItems || []).filter((e) => (e.tipo === 'servico' ? ctx.verServicos !== false : ctx.verMateriais !== false));
}

/** A seção tem algo para mostrar? (seção sem conteúdo não gera título vazio). */
export function secaoTemConteudo(key: SecaoDocKey, ctx: ConteudoCtx): boolean {
  const { p } = ctx;
  switch (key) {
    case 'carta': return nv(p.cartaApresentacao) || p.cartaApresentacao === undefined;
    case 'historico': return true;
    case 'visao': return nv(p.objetivo);
    case 'normas': return lnv(resolverNormasReferencia(p));
    case 'escopo': return nv(p.escopoServico) || (p.slaTabela || []).length > 0 || nv(p.slaCritico);
    case 'itens': return itensVisiveis(ctx).length > 0;
    case 'itensServicos': return false; // sai dentro de "itens"
    case 'premissas': return lnv(p.premissas);
    case 'incluso': return lnv(p.incluso) || lnv(p.naoIncluso);
    case 'servicos': return servicosSec(p).some((g) => nv(g.titulo) || lnv(g.itens));
    case 'responsabilidades': return lnv(p.responsabilidadesContratada);
    case 'entregaveis': return lnv(p.entregaveis);
    case 'embalagem': return lnv(txtSec(p, p.embalagemTransporteTexto, EMBALAGEM_TRANSPORTE));
    case 'seguranca': return lnv(txtSec(p, p.segurancaTrabalhoTexto, SEGURANCA_TRABALHO));
    case 'obrigacoes': return lnv(p.responsabilidadesContratante);
    case 'precos': return true;
    case 'infoCompra': return true;
    case 'impostos': return nv(p.impostos) || lnv(txtSec(p, p.impostosObsTexto, IMPOSTOS_OBS));
    case 'pagamento': return true;
    case 'multas': return lnv(txtSec(p, p.multasAtrasoTexto, MULTAS_ATRASO));
    case 'limitacao': return lnv(txtSec(p, p.limitacaoRespTexto, LIMITACAO_RESPONSABILIDADE));
    case 'prazo': return nv(p.prazoExecucao);
    case 'garantia': return renderWarranty(p.warranty).hasAny;
    case 'confidencialidade': return lnv(txtSec(p, p.confidencialidadeTexto, CONFIDENCIALIDADE));
    case 'termoAceite': return lnv(txtSec(p, p.termoAceiteTexto, TERMO_ACEITE));
    case 'condicoesGerais': return lnv(txtSec(p, p.condicoesGeraisTexto, CONDICOES_GERAIS));
    case 'validade': return true;
    case 'conclusao': return nv(p.conclusao);
    case 'aceite': return true;
    default: return false;
  }
}
