import { Pedido, CompanyProfile } from './types';

/**
 * P4 — Validação inteligente antes de gerar o PDF (§14, §35, §36).
 *
 * Regra de ouro: o sistema NUNCA corrige silenciosamente. Aqui só detectamos
 * problemas e devolvemos alertas; a decisão (corrigir, editar, ignorar) é do
 * usuário. Erros = dados obrigatórios ausentes; alertas = inconsistências.
 */

export type ValidationLevel = 'erro' | 'alerta';

export interface ValidationIssue {
  id: string;
  level: ValidationLevel;
  campo: string;
  mensagem: string;
}

const nv = (s?: string) => !!s && s.trim().length > 0;

// ---- Números por extenso (pt-BR) até 999 ---------------------------------
const UNIDADES: Record<string, number> = {
  zero: 0, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5,
  seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12, treze: 13,
  quatorze: 14, catorze: 14, quinze: 15, dezesseis: 16, dezessete: 17,
  dezoito: 18, dezenove: 19,
};
const DEZENAS: Record<string, number> = {
  vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60,
  setenta: 70, oitenta: 80, noventa: 90,
};
const CENTENAS: Record<string, number> = {
  cem: 100, cento: 100, duzentos: 200, trezentos: 300, quatrocentos: 400,
  quinhentos: 500, seiscentos: 600, setecentos: 700, oitocentos: 800,
  novecentos: 900,
};

/** Remove acentos e baixa a caixa (para casar "três" ~ "tres"). */
const norm = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/**
 * Converte um número por extenso (pt-BR, 0–999) em inteiro. Retorna null se
 * não reconhecer todas as palavras (evita falso positivo).
 */
export function extensoParaNumero(texto: string): number | null {
  const palavras = norm(texto)
    .replace(/\be\b/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (!palavras.length) return null;
  let total = 0;
  let reconheceu = false;
  for (const p of palavras) {
    if (p in CENTENAS) { total += CENTENAS[p]; reconheceu = true; }
    else if (p in DEZENAS) { total += DEZENAS[p]; reconheceu = true; }
    else if (p in UNIDADES) { total += UNIDADES[p]; reconheceu = true; }
    else return null; // palavra não numérica → não é um extenso puro
  }
  return reconheceu ? total : null;
}

/**
 * Procura padrões "N (por extenso) ..." e reporta divergência entre o dígito e
 * o texto — ex.: "24 (doze) meses" ou "12 (doze) meses" (ok).
 */
function checarNumeroExtenso(texto: string, ondeLabel: string, prefixo: string): ValidationIssue[] {
  if (!nv(texto)) return [];
  const out: ValidationIssue[] = [];
  const re = /(\d[\d.]*)\s*\(([^)]+)\)/g;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(texto)) !== null) {
    const digito = parseInt(m[1].replace(/\./g, ''), 10);
    const extenso = extensoParaNumero(m[2]);
    if (Number.isFinite(digito) && extenso !== null && digito !== extenso) {
      out.push({
        id: `${prefixo}-ext-${i++}`,
        level: 'alerta',
        campo: ondeLabel,
        mensagem: `Divergência: "${m[1]}" está escrito por extenso como "${m[2].trim()}" (=${extenso}). Confira o número e o texto.`,
      });
    }
  }
  return out;
}

/** Indício de condição de pagamento pontual (à vista/por etapas). */
function pagamentoPareceUnico(texto: string): boolean {
  if (!nv(texto)) return false;
  const t = norm(texto);
  return /\d+\s*%/.test(t) || /(no aceite|na entrega|contra entrega|laudo|na conclusao|apos a conclusao|30\/70|50\/50)/.test(t);
}

/**
 * Valida a proposta/orçamento de um pedido. Retorna a lista de problemas
 * (vazia = tudo certo). Ordena erros antes de alertas.
 */
export function validateProposal(pedido: Pedido, companyProfile?: CompanyProfile): ValidationIssue[] {
  const p = pedido.proposal;
  const issues: ValidationIssue[] = [];
  if (!p) return issues;

  // ---- Dados obrigatórios (erro) ----
  if (!nv(pedido.clienteNome)) issues.push({ id: 'req-cliente', level: 'erro', campo: 'Cliente', mensagem: 'Cliente/contratante não informado.' });
  if (!nv(pedido.numeroPedido)) issues.push({ id: 'req-numero', level: 'erro', campo: 'Número', mensagem: 'Número da proposta ausente.' });
  if (!nv(pedido.dataEmissao)) issues.push({ id: 'req-data', level: 'erro', campo: 'Data', mensagem: 'Data de emissão ausente.' });

  const recorrente = !!p.recorrente && (p.valorMensal || 0) > 0;
  if (recorrente) {
    if ((p.valorMensal || 0) <= 0) issues.push({ id: 'req-mensal', level: 'erro', campo: 'Valor mensal', mensagem: 'Contrato recorrente sem valor mensal.' });
  } else if ((p.valorTotal || 0) <= 0) {
    issues.push({ id: 'req-valor', level: 'erro', campo: 'Valor', mensagem: 'Valor total não informado (ou zerado).' });
  }

  const temPagamento = (p.formasPagamento?.length || 0) > 0 || (p.condicoesPagamento?.length || 0) > 0 || nv(p.formaPagamento);
  if (!temPagamento) issues.push({ id: 'req-pagamento', level: 'erro', campo: 'Pagamento', mensagem: 'Condição de pagamento não informada.' });

  if (!(p.validadePropostaDias > 0)) issues.push({ id: 'req-validade', level: 'erro', campo: 'Validade', mensagem: 'Validade da proposta não informada.' });

  if (companyProfile && !nv(companyProfile.cnpj)) {
    issues.push({ id: 'req-cnpj', level: 'alerta', campo: 'CNPJ', mensagem: 'CNPJ da empresa não cadastrado (Conta → Perfil da empresa).' });
  }

  // ---- Consistência (alerta) ----
  // Número x extenso nos campos de texto mais sujeitos a isso.
  issues.push(...checarNumeroExtenso(p.validadePropostaComplemento || '', 'Validade', 'validade'));
  issues.push(...checarNumeroExtenso(p.garantia || '', 'Garantia', 'garantia'));
  issues.push(...checarNumeroExtenso(p.prazoExecucao || '', 'Prazo', 'prazo'));
  issues.push(...checarNumeroExtenso(p.objetivo || '', 'Objetivo', 'objetivo'));
  issues.push(...checarNumeroExtenso(p.escopoServico || '', 'Escopo', 'escopo'));

  // Vigência numérica x texto (ex.: vigenciaMeses=24 mas texto diz "12 meses").
  if (recorrente && (p.vigenciaMeses || 0) > 0) {
    const campos = [p.validadePropostaComplemento, p.prazoExecucao, p.garantia].filter(nv).join('  ');
    const mm = norm(campos).match(/(\d+)\s*(meses|mes)/);
    if (mm) {
      const nTexto = parseInt(mm[1], 10);
      if (Number.isFinite(nTexto) && nTexto !== p.vigenciaMeses) {
        issues.push({
          id: 'vig-num',
          level: 'alerta',
          campo: 'Vigência',
          mensagem: `Vigência cadastrada em ${p.vigenciaMeses} meses, mas um texto menciona "${nTexto} meses". Confira.`,
        });
      }
    }
  }

  // Valor mensal x condição de pagamento (§36).
  if (recorrente) {
    const pagTxt = [p.formaPagamento, ...(p.condicoesPagamento || []), ...(p.formasPagamento || [])].filter(Boolean).join(' — ');
    if (pagamentoPareceUnico(pagTxt)) {
      issues.push({
        id: 'pag-recorrente',
        level: 'alerta',
        campo: 'Pagamento',
        mensagem: 'A proposta é um contrato recorrente (mensal), mas a condição de pagamento parece pontual (ex.: por etapas/percentuais). Deseja revisar?',
      });
    }
  }

  // Erros primeiro, depois alertas.
  return issues.sort((a, b) => (a.level === b.level ? 0 : a.level === 'erro' ? -1 : 1));
}
