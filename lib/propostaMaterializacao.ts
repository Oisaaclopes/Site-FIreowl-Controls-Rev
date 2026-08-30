/* =====================================================================
 * ETAPA 2 — Materialização de textos-padrão da Proposta.
 *
 * Regra central: o EDITOR é a fonte de verdade do conteúdo textual. Ao criar
 * uma proposta NOVA, os textos que antes eram injetados só na renderização
 * (propostaTextos.ts) são copiados para o próprio registro. O PDF passa a ler
 * do registro; o fallback só sobrevive para propostas históricas.
 *
 * Este módulo é PURO (sem React / sem Supabase) e testável isoladamente.
 * ===================================================================== */
import { CommercialProposalData } from './types';
import {
  SERVICOS_OFERTADOS,
  EMBALAGEM_TRANSPORTE,
  SEGURANCA_TRABALHO,
  MULTAS_ATRASO,
  LIMITACAO_RESPONSABILIDADE,
  CONFIDENCIALIDADE,
  TERMO_ACEITE,
  CONDICOES_GERAIS,
  PRECOS_OBS,
  IMPOSTOS_OBS,
} from './propostaTextos';

/** Seção materializável do tipo "lista de parágrafos/itens" (string[]). */
type CampoLista =
  | 'embalagemTransporteTexto'
  | 'segurancaTrabalhoTexto'
  | 'precosObsTexto'
  | 'impostosObsTexto'
  | 'multasAtrasoTexto'
  | 'limitacaoRespTexto'
  | 'confidencialidadeTexto'
  | 'termoAceiteTexto'
  | 'condicoesGeraisTexto';

/** Descritor de uma seção de texto materializável (lista de strings). */
export interface SecaoTextoDescriptor {
  /** Chave da seção (alinhada com propostaEstrutura). */
  key: string;
  /** Rótulo amigável (editor). */
  titulo: string;
  /** Campo em CommercialProposalData que guarda o conteúdo materializado. */
  campo: CampoLista;
  /** Provedor do texto-padrão ATUAL do template. */
  padrao: () => string[];
}

/**
 * Catálogo das seções que antes eram injetadas silenciosamente pelo renderer.
 * A "Descrição dos Serviços Ofertados" (servicosOfertados) é tratada à parte por
 * ter estrutura própria (título + itens).
 */
export const SECOES_TEXTO: SecaoTextoDescriptor[] = [
  { key: 'embalagem', titulo: 'Embalagem, Transporte e Armazenamento', campo: 'embalagemTransporteTexto', padrao: () => [...EMBALAGEM_TRANSPORTE] },
  { key: 'seguranca', titulo: 'Segurança do Trabalho', campo: 'segurancaTrabalhoTexto', padrao: () => [...SEGURANCA_TRABALHO] },
  { key: 'precos', titulo: 'Preços — Observações', campo: 'precosObsTexto', padrao: () => [...PRECOS_OBS] },
  { key: 'impostos', titulo: 'Impostos e Taxas — Observações', campo: 'impostosObsTexto', padrao: () => [...IMPOSTOS_OBS] },
  { key: 'multas', titulo: 'Multas por Atraso de Pagamento', campo: 'multasAtrasoTexto', padrao: () => [...MULTAS_ATRASO] },
  { key: 'limitacao', titulo: 'Limitação de Responsabilidade', campo: 'limitacaoRespTexto', padrao: () => [...LIMITACAO_RESPONSABILIDADE] },
  { key: 'confidencialidade', titulo: 'Confidencialidade', campo: 'confidencialidadeTexto', padrao: () => [...CONFIDENCIALIDADE] },
  { key: 'termoAceite', titulo: 'Termo de Aceite da Proposta', campo: 'termoAceiteTexto', padrao: () => [...TERMO_ACEITE] },
  { key: 'condicoesGerais', titulo: 'Condições Gerais', campo: 'condicoesGeraisTexto', padrao: () => [...CONDICOES_GERAIS] },
];

/** Snapshot padrão ATUAL da Descrição dos Serviços Ofertados. */
export const servicosOfertadosPadrao = (): { titulo: string; itens: string[] }[] =>
  SERVICOS_OFERTADOS.map((s) => ({ titulo: s.titulo, itens: [...s.itens] }));

const descritorPorKey = new Map(SECOES_TEXTO.map((s) => [s.key, s]));
const descritorPorCampo = new Map(SECOES_TEXTO.map((s) => [s.campo, s]));

/** Iguala listas (comparação rasa, ignorando espaços nas pontas). */
function listasIguais(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((v, i) => (v || '').trim() === (b[i] || '').trim());
}
function servicosIguais(a: { titulo: string; itens: string[] }[], b: { titulo: string; itens: string[] }[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((s, i) => (s.titulo || '').trim() === (b[i].titulo || '').trim() && listasIguais(s.itens, b[i].itens));
}

/**
 * Materializa os textos-padrão numa proposta NOVA. Idempotente: se já
 * materializada, devolve o mesmo objeto sem tocar em conteúdo do usuário.
 * Só preenche campos AUSENTES (undefined) — nunca sobrescreve o que já existe
 * (inclusive um array vazio, que representa "apagado de propósito").
 */
export function materializarTextosProposta(data: CommercialProposalData): CommercialProposalData {
  if (data.textosMaterializados) return data;
  const secaoFonte: Record<string, 'padrao' | 'personalizado'> = { ...(data.secaoFonte || {}) };
  const patch: Partial<CommercialProposalData> = {};

  for (const s of SECOES_TEXTO) {
    if (data[s.campo] === undefined) {
      (patch as Record<string, unknown>)[s.campo] = s.padrao();
      if (secaoFonte[s.key] === undefined) secaoFonte[s.key] = 'padrao';
    }
  }
  if (data.servicosOfertados === undefined) {
    patch.servicosOfertados = servicosOfertadosPadrao();
    if (secaoFonte['servicos'] === undefined) secaoFonte['servicos'] = 'padrao';
  }
  return { ...data, ...patch, secaoFonte, textosMaterializados: true };
}

/** Texto-padrão atual de uma seção-lista (para "Restaurar padrão"). */
export function padraoDaSecao(key: string): string[] | null {
  const d = descritorPorKey.get(key);
  return d ? d.padrao() : null;
}

/** Marca a origem de uma seção conforme o valor confere ou não com o padrão. */
export function fonteDaSecaoLista(campo: CampoLista, valor: string[] | undefined): 'padrao' | 'personalizado' {
  const d = descritorPorCampo.get(campo);
  if (!d || valor === undefined) return 'personalizado';
  return listasIguais(valor, d.padrao()) ? 'padrao' : 'personalizado';
}

export function fonteServicos(valor: { titulo: string; itens: string[] }[] | undefined): 'padrao' | 'personalizado' {
  if (valor === undefined) return 'personalizado';
  return servicosIguais(valor, servicosOfertadosPadrao()) ? 'padrao' : 'personalizado';
}

/**
 * Aplica "Restaurar padrão" a uma seção-lista: devolve o patch (campo + fonte).
 * Só substitui a seção pedida — nunca as demais.
 */
export function restaurarSecaoLista(campo: CampoLista): { campo: CampoLista; valor: string[]; key: string } | null {
  const d = descritorPorCampo.get(campo);
  if (!d) return null;
  return { campo, valor: d.padrao(), key: d.key };
}

/**
 * Duplicação (item 8): copia o snapshot textual, garantindo que a cópia carregue
 * exatamente o conteúdo da origem e NÃO reaplique os templates atuais.
 * Mantém `textosMaterializados` verdadeiro e clona arrays para não compartilhar
 * referência com o original.
 */
export function clonarSnapshotTextual(data: CommercialProposalData): Partial<CommercialProposalData> {
  const out: Partial<CommercialProposalData> = {};
  for (const s of SECOES_TEXTO) {
    const v = data[s.campo];
    if (v !== undefined) (out as Record<string, unknown>)[s.campo] = [...(v as string[])];
  }
  if (data.servicosOfertados !== undefined) {
    out.servicosOfertados = data.servicosOfertados.map((x) => ({ titulo: x.titulo, itens: [...x.itens] }));
  }
  if (data.secaoFonte) out.secaoFonte = { ...data.secaoFonte };
  out.textosMaterializados = data.textosMaterializados;
  return out;
}
