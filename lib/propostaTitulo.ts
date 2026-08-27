/**
 * P1 — Estrutura inteligente: Área principal + Tipo de Serviço + título dinâmico.
 *
 * A partir da combinação Área × Tipo, o sistema monta automaticamente o título
 * da proposta (§3/§9). O conteúdo escrito pelo usuário nunca é alterado — isto
 * gera apenas o título/estrutura.
 */

export interface AreaOpcao {
  id: string;
  label: string; // rótulo no formulário
  nome: string; // nome do sistema para compor o título
  sigla: string; // destaque (ex.: SDAI | CFTV)
}

export const AREAS_PROPOSTA: AreaOpcao[] = [
  { id: 'sdai', label: 'SDAI — Detecção e Alarme de Incêndio', nome: 'Sistema de Detecção e Alarme de Incêndio', sigla: 'SDAI' },
  { id: 'cftv', label: 'CFTV / Videomonitoramento', nome: 'Sistema de Videomonitoramento (CFTV)', sigla: 'CFTV' },
  { id: 'acesso', label: 'Controle de Acesso', nome: 'Sistema de Controle de Acesso', sigla: 'ACESSO' },
  { id: 'alarme', label: 'Alarme de Intrusão', nome: 'Sistema de Alarme de Intrusão', sigla: 'ALARME' },
  { id: 'bms', label: 'Automação Predial / BMS', nome: 'Automação Predial (BMS)', sigla: 'BMS' },
  { id: 'integracao', label: 'Integração de Sistemas', nome: 'Integração de Sistemas', sigla: 'INTEGRAÇÃO' },
  { id: 'seguranca', label: 'Segurança Eletrônica', nome: 'Sistemas de Segurança Eletrônica', sigla: 'SEGURANÇA' },
  { id: 'engenharia', label: 'Engenharia / Projetos', nome: 'Engenharia e Projetos', sigla: 'ENGENHARIA' },
  { id: 'outro', label: 'Outro', nome: 'Sistemas de Segurança e Proteção', sigla: 'OUTRO' },
];

export interface TipoServicoOpcao {
  id: string;
  label: string;
  /** Como o tipo entra no título. {area} é substituído pelo nome da área. */
  template: (area: string) => string;
}

export const TIPOS_SERVICO: TipoServicoOpcao[] = [
  { id: 'manut_corretiva', label: 'Manutenção Corretiva', template: (a) => `Proposta de Manutenção Corretiva de ${a}` },
  { id: 'manut_preventiva', label: 'Manutenção Preventiva', template: (a) => `Proposta de Manutenção Preventiva de ${a}` },
  { id: 'contrato_manut', label: 'Contrato de Manutenção', template: (a) => `Contrato de Manutenção de ${a}` },
  { id: 'contrato_inspecao', label: 'Contrato de Inspeção', template: (a) => `Contrato de Inspeção de ${a}` },
  { id: 'inspecao', label: 'Inspeção Técnica', template: (a) => `Proposta para Inspeção Técnica de ${a}` },
  { id: 'instalacao', label: 'Instalação', template: (a) => `Proposta Técnico-Comercial para Instalação de ${a}` },
  { id: 'implantacao', label: 'Implantação', template: (a) => `Proposta Técnico-Comercial para Implantação de ${a}` },
  { id: 'retrofit', label: 'Retrofit / Modernização', template: (a) => `Proposta Técnico-Comercial para Retrofit de ${a}` },
  { id: 'adequacao', label: 'Adequação Normativa', template: (a) => `Proposta para Adequação Normativa de ${a}` },
  { id: 'projeto', label: 'Projeto / Engenharia', template: (a) => `Proposta de Projeto e Engenharia de ${a}` },
  { id: 'comissionamento', label: 'Comissionamento', template: (a) => `Proposta de Comissionamento de ${a}` },
  { id: 'integracao_serv', label: 'Integração', template: () => `Proposta para Integração de Sistemas de Segurança e Proteção Contra Incêndio` },
  { id: 'fornecimento', label: 'Fornecimento de Equipamentos', template: (a) => `Proposta de Fornecimento de Equipamentos — ${a}` },
  { id: 'outro', label: 'Outro', template: (a) => `Proposta Técnico-Comercial — ${a}` },
];

export const areaById = (id?: string) => AREAS_PROPOSTA.find((a) => a.id === id);
export const tipoById = (id?: string) => TIPOS_SERVICO.find((t) => t.id === id);

/**
 * Compõe o nome da(s) área(s) para o título. Com várias áreas, junta os nomes;
 * com muitas, usa uma expressão integrada.
 */
export function nomeArea(areaIds: string[]): string {
  const nomes = areaIds.map((id) => areaById(id)?.nome).filter(Boolean) as string[];
  if (nomes.length === 0) return 'Sistemas de Segurança e Proteção';
  if (nomes.length === 1) return nomes[0];
  if (nomes.length === 2) return `${nomes[0]} e ${nomes[1]}`;
  return 'Sistemas Integrados de Segurança e Proteção Contra Incêndio';
}

/** Faixa de destaque com as siglas (§7): "SDAI | CFTV | INTEGRAÇÃO". */
export function faixaSiglas(areaIds: string[]): string {
  const siglas = areaIds.map((id) => areaById(id)?.sigla).filter(Boolean) as string[];
  return siglas.join('  |  ');
}

/**
 * Gera o título da proposta a partir da combinação Área × Tipo (§3).
 * Retorna null se faltar informação (o chamador usa o título padrão).
 */
export function gerarTituloProposta(areaIds: string[], tipoId?: string): string | null {
  const tipo = tipoById(tipoId);
  if (!tipo || areaIds.length === 0) return null;
  // Integração com múltiplas áreas → título integrado dedicado.
  if (tipo.id === 'integracao_serv') return tipo.template('');
  return tipo.template(nomeArea(areaIds));
}
