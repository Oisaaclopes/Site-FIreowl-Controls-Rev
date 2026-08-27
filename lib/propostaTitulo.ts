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

/** §9 — título dinâmico da seção "Escopo" conforme o tipo de serviço. */
const ESCOPO_POR_TIPO: Record<string, string> = {
  manut_corretiva: 'Escopo dos Serviços de Manutenção Corretiva',
  manut_preventiva: 'Escopo dos Serviços de Manutenção Preventiva',
  contrato_manut: 'Escopo dos Serviços de Manutenção',
  contrato_inspecao: 'Escopo da Inspeção',
  inspecao: 'Escopo da Inspeção Técnica',
  instalacao: 'Escopo de Instalação e Comissionamento',
  implantacao: 'Escopo da Implantação',
  retrofit: 'Escopo do Retrofit',
  adequacao: 'Escopo da Adequação Normativa',
  projeto: 'Escopo do Projeto',
  comissionamento: 'Escopo do Comissionamento',
  integracao_serv: 'Escopo da Integração',
  fornecimento: 'Escopo de Fornecimento',
};
export function tituloEscopo(tipoId?: string): string {
  return (tipoId && ESCOPO_POR_TIPO[tipoId]) || 'Escopo da Proposta';
}

/** §30 — conclusão dinâmica (texto do sistema) conforme o tipo de serviço. */
const CONCLUSAO_GENERICA =
  'Reiteramos nosso compromisso com a qualidade e a segurança, permanecendo à disposição para eventuais esclarecimentos e negociações. Aguardamos sua análise e retorno.';
const CONCLUSAO_POR_TIPO: Record<string, string> = {
  contrato_manut:
    'Este contrato assegura a continuidade operacional e a previsibilidade de custos, com manutenção preventiva planejada, atendimento conforme SLA e suporte técnico especializado — reduzindo riscos e prolongando a vida útil do sistema. Permanecemos à disposição para os ajustes necessários.',
  manut_preventiva:
    'A manutenção preventiva proposta preserva a confiabilidade do sistema, antecipando falhas e mantendo a conformidade normativa. Colocamo-nos à disposição para alinhar o plano à rotina da sua operação.',
  manut_corretiva:
    'A correção proposta restabelece a plena operação do sistema com agilidade e segurança. Permanecemos à disposição para esclarecimentos e para a execução no menor prazo possível.',
  retrofit:
    'O retrofit proposto moderniza a infraestrutura existente, elevando a confiabilidade, atualizando tecnologicamente os equipamentos e preparando o sistema para expansões futuras, em conformidade com as normas vigentes. Ficamos à disposição para detalhar o plano de transição.',
  inspecao:
    'A inspeção técnica proposta oferece um diagnóstico preciso, identifica não conformidades com rastreabilidade e embasa a tomada de decisão sobre a segurança do sistema. Permanecemos à disposição para apresentar o relatório e os próximos passos.',
  contrato_inspecao:
    'O programa de inspeção proposto garante avaliações periódicas com rastreabilidade, sustentando a segurança e a conformidade do sistema ao longo do tempo. Ficamos à disposição para alinhar a periodicidade às suas necessidades.',
  instalacao:
    'A instalação proposta entrega um sistema comissionado, testado e pronto para operação, com garantia e suporte. Permanecemos à disposição para alinhar cronograma e liberar as frentes de trabalho.',
  implantacao:
    'A implantação proposta entrega a solução completa, integrada e comissionada, pronta para operação. Ficamos à disposição para detalhar as etapas e o cronograma.',
  projeto:
    'O projeto proposto fornece a base técnica e normativa para uma execução segura e eficiente, com responsabilidade técnica e rastreabilidade. Permanecemos à disposição para esclarecimentos.',
  comissionamento:
    'O comissionamento proposto valida o desempenho do sistema por meio de testes funcionais documentados, assegurando a entrega em plena conformidade. Ficamos à disposição para agendar as atividades.',
  integracao_serv:
    'A integração proposta unifica os sistemas em uma plataforma coordenada, ampliando a supervisão, a rastreabilidade e a resposta a eventos. Permanecemos à disposição para detalhar a arquitetura da solução.',
  fornecimento:
    'O fornecimento proposto contempla equipamentos homologados, com garantia de fábrica e suporte. Ficamos à disposição para confirmar prazos e condições de entrega.',
};
export function conclusaoPorTipo(tipoId?: string): string {
  return (tipoId && CONCLUSAO_POR_TIPO[tipoId]) || CONCLUSAO_GENERICA;
}

/** §6 — texto institucional (do sistema) da página de Áreas, por área. */
const APRESENTACAO_GENERICA =
  'Engenharia especializada em segurança eletrônica e proteção contra incêndio. Projetamos, instalamos, comissionamos e mantemos soluções integradas — do sensor de campo à central de supervisão.';
const APRESENTACAO_POR_AREA: Record<string, string> = {
  sdai: 'Especialistas em proteção contra incêndio: projeto, instalação, comissionamento, manutenção e retrofit de sistemas de detecção e alarme, com responsabilidade técnica e em conformidade com a NBR 17240 e a NPT 019.',
  cftv: 'Videomonitoramento de ponta a ponta: câmeras IP, gravação, analíticos de vídeo e supervisão integrada para a segurança patrimonial, com projeto, instalação e manutenção.',
  acesso: 'Controle de acesso completo: portas, catracas, biometria e credenciais com níveis de acesso e trilha de auditoria — projeto, instalação e manutenção.',
  alarme: 'Alarme de intrusão e proteção perimetral: sensores, centrais e comunicação com notificação em tempo real, projetados, instalados e mantidos pela nossa equipe.',
  bms: 'Automação predial (BMS): supervisão e integração de climatização, energia e iluminação em uma central, com engenharia própria e suporte contínuo.',
  integracao: 'Integração de sistemas de segurança e proteção contra incêndio em uma plataforma unificada, com supervisão centralizada, dashboards e resposta coordenada a eventos.',
};

export function apresentacaoAreas(areaIds: string[]): string {
  const ids = areaIds.filter((id) => id in APRESENTACAO_POR_AREA);
  if (ids.length === 0) return APRESENTACAO_GENERICA;
  // Múltiplas áreas (ou integração explícita) → texto integrado.
  if (ids.length > 1 || ids.includes('integracao')) {
    return 'Integramos proteção contra incêndio e segurança eletrônica em uma única solução de engenharia — do projeto e instalação ao comissionamento, à manutenção e à supervisão centralizada, com responsabilidade técnica e rastreabilidade.';
  }
  return APRESENTACAO_POR_AREA[ids[0]];
}

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
