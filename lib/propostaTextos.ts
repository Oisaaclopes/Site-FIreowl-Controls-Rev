/* =====================================================================
 * Textos-padrão da Proposta Técnico-Comercial (Fireowl Controls).
 * Usados como default no PDF quando a proposta não traz um texto próprio.
 * Editáveis no futuro pelo modal — por ora servem como conteúdo institucional
 * padrão para as cláusulas do documento no "padrão completo".
 * ===================================================================== */

/** Parágrafos da Carta de Apresentação (institucional). */
export const CARTA_APRESENTACAO: string[] = [
  'A Fireowl Controls é uma empresa de engenharia especializada em sistemas de segurança eletrônica e proteção contra incêndio, atuando no fornecimento, instalação, manutenção e comissionamento de Sistemas de Detecção e Alarme de Incêndio (SDAI), CFTV, Controle de Acesso, Alarme e Automação Predial.',
  'Nosso compromisso é entregar soluções tecnicamente corretas, aderentes às normas vigentes (em especial a ABNT NBR 17240) e às Instruções Técnicas do Corpo de Bombeiros, com rastreabilidade, responsabilidade técnica registrada (ART) e foco na segurança de pessoas e do patrimônio.',
  'Contamos com equipe qualificada, certificações NR-10 e NR-35 e processos padronizados de execução, testes e documentação, garantindo previsibilidade de prazo e qualidade na entrega.',
  'É com satisfação que a Fireowl Controls apresenta sua proposta técnica e comercial para o fornecimento e execução dos serviços do empreendimento em referência.',
  'Desde já, colocamo-nos à sua inteira disposição para prestar quaisquer esclarecimentos que se façam necessários.',
];

/** Descrição dos Serviços Ofertados (subitens padrão). */
export const SERVICOS_OFERTADOS: { titulo: string; itens: string[] }[] = [
  {
    titulo: 'Instalação e Montagem',
    itens: [
      'Instalação física dos dispositivos, centrais e infraestrutura conforme projeto e normas aplicáveis.',
      'Lançamento e conexão de cabeamento específico de detecção e alarme, com identificação dos circuitos.',
    ],
  },
  {
    titulo: 'Programação e Configuração',
    itens: [
      'Programação da central, endereçamento dos dispositivos e parametrização dos laços/zonas.',
      'Configuração de intertravamentos e integrações previstas no escopo.',
    ],
  },
  {
    titulo: 'Comissionamento e Testes',
    itens: [
      'Verificação visual da instalação e da fixação dos dispositivos.',
      'Testes funcionais de detectores, acionadores, sinalizadores e da central.',
      'Energização e verificação das funções do sistema, com registro em relatório.',
    ],
  },
];

/** Embalagem, Transporte e Armazenamento. */
export const EMBALAGEM_TRANSPORTE: string[] = [
  'Todos os equipamentos, materiais e componentes fornecidos são embalados de forma a garantir a integridade do conteúdo em todas as fases do transporte, desde a origem até o local de instalação.',
  'Os volumes são dimensionados conforme as características de cada equipamento, identificados e acompanhados das recomendações de manuseio, transporte e armazenagem.',
  'As embalagens são adequadas para armazenagem por um período de até 12 (doze) meses em local seco e protegido, sob responsabilidade da Contratante após a entrega.',
];

/** Segurança do Trabalho. */
export const SEGURANCA_TRABALHO: string[] = [
  'Por exigência legal e de responsabilidade social, os serviços somente serão executados em locais que ofereçam condições de segurança adequadas à natureza das atividades.',
  'A execução dos trabalhos considera que os equipamentos que possam oferecer risco estarão mecânica e eletricamente desenergizados durante a intervenção.',
  'Trabalhos em altura superior a 2 (dois) metros pressupõem a existência de pontos de ancoragem adequados para os cintos de segurança da equipe de campo.',
  'Atrasos ou interrupções decorrentes da ausência total ou parcial de condições de segurança não serão utilizados como razão para penalidades à Fireowl Controls.',
];

/** Limitação de Responsabilidade. */
export const LIMITACAO_RESPONSABILIDADE: string[] = [
  'A Fireowl Controls responderá pelos danos diretos comprovadamente causados por sua culpa exclusiva, até o limite de 10% (dez por cento) do valor desta proposta, incluindo eventuais multas, penalidades, indenizações e ressarcimentos devidos ao Cliente e/ou a terceiros.',
  'Fica expressamente excluída qualquer responsabilidade por perdas e danos indiretos, tais como, mas não se limitando a, perda de receita, de produção e/ou lucros cessantes, inclusive perante terceiros.',
];

/** Confidencialidade. */
export const CONFIDENCIALIDADE: string[] = [
  'Todas as informações contidas nesta proposta técnica e comercial, de natureza negocial, operacional e/ou financeira, devem ser tratadas como confidenciais e mantidas em sigilo pelo Cliente, seus funcionários, diretores, parceiros, agentes e/ou subcontratados, evitando-se, por qualquer meio, o seu conhecimento por pessoas alheias a esta relação.',
];

/** Termo de Aceite da Proposta (texto introdutório). */
export const TERMO_ACEITE: string[] = [
  'O pedido de compra da Contratante deverá seguir as condições estabelecidas nesta Proposta Técnica e Comercial. Em caso de divergência entre esta e quaisquer outros documentos, prevalecem os termos e condições desta Proposta.',
];

/** Condições Gerais. */
export const CONDICOES_GERAIS: string[] = [
  'Os preços constantes desta proposta foram estabelecidos conforme a política econômica vigente na data de sua apresentação. Em caso de alterações relevantes de cenário econômico (planos econômicos, variações elevadas de câmbio ou modificação de alíquotas de tributos, entre outras), os preços e as condições comerciais poderão ser revistos para adequação à nova realidade, válido tanto para a contratada quanto para a contratante.',
  'Eventuais variações relevantes na base de preços de fabricantes, entre a data desta proposta e a data do pedido, poderão ensejar revisão dos valores apresentados.',
];

/** Texto padrão de Preços (reajuste). */
export const PRECOS_OBS: string[] = [
  'Os preços serão reajustados automaticamente após o interregno de 12 (doze) meses, contados a partir da data desta proposta, de acordo com a variação do IGP-M/FGV.',
  'O preço desta proposta não inclui taxas de condomínio, aluguéis ou custos de estadia não previstos no escopo.',
];

/** Texto padrão de Impostos e Taxas. */
export const IMPOSTOS_OBS: string[] = [
  'Os impostos incidentes neste fornecimento encontram-se inclusos nos preços ofertados, calculados com base nas alíquotas vigentes na data de elaboração desta proposta.',
  'Caso ocorra alteração na legislação que modifique as alíquotas incidentes, a Fireowl Controls reserva-se o direito de revisar os preços para adequá-los à nova legislação.',
];
