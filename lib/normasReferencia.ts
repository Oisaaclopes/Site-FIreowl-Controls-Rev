import type { CommercialProposalData } from './types';
import { areaById } from './propostaTitulo';

/**
 * Fonte única das "Normas de referência" do escopo comercial (editor, Orçamento,
 * Proposta e Laudo). Deriva de Área(s) + Tipo de Serviço + Modalidade — nunca de
 * um padrão fixo de SDAI. A página institucional "Áreas de Atuação" é à parte.
 */
type Contexto = Pick<CommercialProposalData, 'areaPrincipal' | 'tipoServico' | 'modalidade'>;

const NBR_17240 = 'ABNT NBR 17240 — Sistemas de detecção e alarme de incêndio';
const NPT_019 = 'NPT 019 — Sistema de Detecção e Alarme de Incêndio (Corpo de Bombeiros Militar do Paraná)';
const NBR_5410 = 'ABNT NBR 5410 — Instalações elétricas de baixa tensão, quando aplicável aos serviços previstos neste escopo.';

/** Normas técnicas próprias de cada área. Áreas sem entrada não têm norma
 * específica cadastrada no sistema (CFTV, ACESSO, ALARME, BMS…): não inventar. */
const NORMAS_POR_AREA: Record<string, string[]> = {
  sdai: [NBR_17240, NPT_019],
};

/** Tipos que claramente implicam intervenção/implantação elétrica (NBR 5410).
 * Projeto, manutenções e demais: o usuário adiciona manualmente se o escopo justificar. */
const TIPOS_COM_EXECUCAO_ELETRICA = new Set(['instalacao', 'implantacao', 'retrofit', 'adequacao', 'integracao_serv']);

const codigoNorma = (s: string) => (s.match(/(NBR|NPT|IT)\s*\d+/i)?.[0] || s).replace(/\s+/g, ' ').toUpperCase();

export function getNormativeReferences(ctx: Contexto): string[] {
  // Fornecimento sem execução: não afirma projeto/instalação conforme norma.
  if (ctx.modalidade === 'somente_material' || ctx.tipoServico === 'fornecimento') return [];
  const areas = [...new Set(ctx.areaPrincipal || [])].filter((id) => !!areaById(id));
  const normas = areas.flatMap((id) => NORMAS_POR_AREA[id] || []);
  if (areas.length > 0 && ctx.tipoServico && TIPOS_COM_EXECUCAO_ELETRICA.has(ctx.tipoServico)) normas.push(NBR_5410);
  const vistos = new Set<string>();
  return normas.filter((n) => {
    const k = codigoNorma(n);
    if (vistos.has(k)) return false;
    vistos.add(k);
    return true;
  });
}

/** Padrão fixo antigo do editor (sempre SDAI, nunca escolhido pelo usuário).
 * Snapshot igual a ele, sem flag de edição manual, é tratado como automático —
 * corrige pedidos como o PED-2026-286; sem área, vira lista vazia. */
const PADRAO_FIXO_LEGADO = [
  'ABNT NBR 17240:2010 — Sistemas de detecção e alarme de incêndio',
  'NPT 019 — Sistema de Detecção e Alarme de Incêndio (Corpo de Bombeiros Militar do Paraná)',
  'ABNT NBR 5410:2004 — Instalações elétricas de baixa tensão',
];
const mesmaLista = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x.trim() === b[i].trim());

export function normasForamPersonalizadas(p: Partial<CommercialProposalData>): boolean {
  if (p.diretrizesEditadasManualmente !== undefined) return p.diretrizesEditadasManualmente;
  const salvas = p.diretrizesNormativas || [];
  return !mesmaLista(salvas, PADRAO_FIXO_LEGADO) && !mesmaLista(salvas, getNormativeReferences(p));
}

/** O que editor e PDFs exibem: edição manual preservada; senão, a sugestão do contexto. */
export function resolverNormasReferencia(p: Partial<CommercialProposalData>): string[] {
  return normasForamPersonalizadas(p) ? p.diretrizesNormativas || [] : getNormativeReferences(p);
}
