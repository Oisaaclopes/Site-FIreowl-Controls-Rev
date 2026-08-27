import { EmpresaAtendida, MarcaTecnologia } from './types';

/**
 * §9/§10/§13 — Seleção inteligente de empresas atendidas e marcas para a página
 * "Experiência e Capacidade Técnica". Nunca mostra tudo: filtra por relevância
 * (área da proposta, tipo, segmento, destaque) e limita a quantidade.
 */

/**
 * §16 — a página "Experiência e Capacidade Técnica" está ativa? true/false na
 * proposta força; undefined = automático: entra em Técnica/Corporativa, não em
 * Simples.
 */
export function experienciaAtiva(p: { incluirExperiencia?: boolean; nivelProposta?: string }): boolean {
  if (p.incluirExperiencia === true) return true;
  if (p.incluirExperiencia === false) return false;
  return (p.nivelProposta || 'tecnica') !== 'simples';
}

export interface SelecaoCtx {
  /** Áreas da proposta (proposal.areaPrincipal): sdai, cftv, ... */
  areas: string[];
  tipoServico?: string;
  /** Segmento do cliente da proposta (para casar com empresas do mesmo segmento). */
  segmentoCliente?: string;
}

const norm = (s: string) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

function scoreEmpresa(e: EmpresaAtendida, ctx: SelecaoCtx): number {
  let s = 0;
  const areaMatch = e.areas.filter((a) => ctx.areas.includes(a)).length;
  s += areaMatch * 3;
  if (ctx.segmentoCliente && e.segmentos.some((seg) => norm(seg) === norm(ctx.segmentoCliente!))) s += 4;
  if (e.destaque) s += 2;
  return s;
}

/**
 * Empresas atendidas relevantes, já ordenadas e limitadas. Descarta inativas,
 * não exibíveis e "não autorizadas". Quando a proposta tem áreas, prioriza as
 * que se relacionam; sem áreas, usa destaque + ordem.
 */
export function selecionarEmpresas(empresas: EmpresaAtendida[], ctx: SelecaoCtx, max = 8): EmpresaAtendida[] {
  const validas = empresas.filter((e) => e.ativo && e.exibirProposta && e.autorizacao !== 'nao_autorizado');
  const ranked = [...validas].sort((a, b) => {
    const sd = scoreEmpresa(b, ctx) - scoreEmpresa(a, ctx);
    if (sd !== 0) return sd;
    if (a.ordem !== b.ordem) return a.ordem - b.ordem;
    return norm(a.nome).localeCompare(norm(b.nome));
  });
  return ranked.slice(0, Math.max(0, max));
}

/**
 * Marcas relevantes ao contexto. §13: se a proposta tem áreas, mostra só marcas
 * que compartilham ao menos uma área; sem áreas, usa a ordem cadastrada.
 */
export function selecionarMarcas(marcas: MarcaTecnologia[], ctx: SelecaoCtx, max = 8): MarcaTecnologia[] {
  const validas = marcas.filter((m) => m.ativo && m.exibirProposta);
  const temAreas = ctx.areas.length > 0;
  const relevantes = temAreas
    ? validas.filter((m) => m.areas.some((a) => ctx.areas.includes(a)))
    : validas;
  const ranked = [...relevantes].sort((a, b) => {
    if (temAreas) {
      const am = b.areas.filter((x) => ctx.areas.includes(x)).length - a.areas.filter((x) => ctx.areas.includes(x)).length;
      if (am !== 0) return am;
    }
    if (a.ordem !== b.ordem) return a.ordem - b.ordem;
    return norm(a.nome).localeCompare(norm(b.nome));
  });
  return ranked.slice(0, Math.max(0, max));
}
