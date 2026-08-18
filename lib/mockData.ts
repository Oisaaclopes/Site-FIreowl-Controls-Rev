import {
  Client,
  PedidoOS,
  Contract,
  ClientEquipment,
  TimePunch,
  TechnicalReportSDAI,
  AuditSDAI,
  CustomQuote,
  FinancialTransaction,
  InventoryItem,
  SystemAuditLog,
  Supplier,
  ServiceCatalogItem,
  Pedido,
  PartnerBrand,
  CompanyProfile,
  PedidoTemplate
} from './types';

export const INITIAL_CLIENTS: Client[] = [
  {
    id: 'c1',
    code: '#F0-8842',
    name: 'Logística Integrada S.A.',
    cnpj: '12.345.678/0001-90',
    segment: 'Logística & Galpões',
    contractStatus: 'EM DIA',
    lastOSDate: '18 MAI 2024',
    lastOSType: 'MANUTENÇÃO PREVENTIVA',
    address: 'Av. Tiradentes, 4200 - Londrina/PR',
    contacts: [{ name: 'Marcos Oliveira', role: 'Gerente de Facilidades', phone: '(43) 3371-9000', email: 'marcos@logistica.com.br' }],
    totalContractsValue: 34500
  },
  {
    id: 'c2',
    code: '#F0-7721',
    name: 'Condomínio Solar das Águias',
    cnpj: '98.765.432/0001-11',
    segment: 'Condomínio Residencial',
    contractStatus: 'PENDENTE',
    lastOSDate: '12 ABR 2024',
    lastOSType: 'VENCIDA EM 10 DIAS',
    address: 'Rua Ayrton Senna, 800 - Gleba Palhano - Londrina/PR',
    contacts: [{ name: 'Regina Célia', role: 'Síndica', phone: '(43) 99122-3344', email: 'sindico@solardasaguias.com' }],
    totalContractsValue: 14500
  },
  {
    id: 'c3',
    code: '#F0-1092',
    name: 'Indústria Mecânica Fireowl',
    cnpj: '55.444.333/0001-44',
    segment: 'Indústria Pesada',
    contractStatus: 'ATRASADO',
    lastOSDate: '- - -',
    lastOSType: 'SEM REGISTRO RECENTE',
    address: 'Rodovia Celso Garcia Cid, km 376 - Londrina/PR',
    contacts: [{ name: 'Eng. Roberto Lima', role: 'Chefe de Manutenção', phone: '(43) 3328-1122', email: 'roberto@mecanicafireowl.com.br' }],
    totalContractsValue: 52000
  },
  {
    id: 'c4',
    code: '#F0-9981',
    name: 'Catuaí Shopping Londrina',
    cnpj: '78.112.334/0001-05',
    segment: 'Shopping Center',
    contractStatus: 'EM DIA',
    lastOSDate: '24 MAI 2024',
    lastOSType: 'INSPEÇÃO DIÁRIA SDAI',
    address: 'Rod. Celso Garcia Cid, 5600 - Gleba Fazenda Palhano - Londrina/PR',
    contacts: [{ name: 'Fernando Souza', role: 'Gestor de Segurança Contra Incêndio', phone: '(43) 3315-5000', email: 'seguranca@catuailondrina.com.br' }],
    totalContractsValue: 28500
  },
  {
    id: 'c5',
    code: '#F0-6632',
    name: 'Londrina Norte Shopping',
    cnpj: '44.555.666/0001-88',
    segment: 'Shopping Center',
    contractStatus: 'EM DIA',
    lastOSDate: '22 MAI 2024',
    lastOSType: 'PREVENTIVA DE LAÇOS',
    address: 'R. Américo Deolindo Garla, 224 - Pacaembu - Londrina/PR',
    contacts: [{ name: 'Patrícia Mendes', role: 'Coord. Operações', phone: '(43) 3372-8000', email: 'patricia@londrinanorteshopping.com.br' }],
    totalContractsValue: 18200
  },
  {
    id: 'c6',
    code: '#F0-5541',
    name: 'Grupo Muffato (Málagoli)',
    cnpj: '22.888.999/0001-33',
    segment: 'Supermercado / Varejo',
    contractStatus: 'EM DIA',
    lastOSDate: '20 MAI 2024',
    lastOSType: 'CORRETIVA BOTOEIRA',
    address: 'Av. Duque de Caxias, 1200 - Londrina/PR',
    contacts: [{ name: 'Cláudio Duarte', role: 'Gerente da Loja', phone: '(43) 3339-4000', email: 'claudio@muffato.com.br' }],
    totalContractsValue: 9800
  }
];

export const INITIAL_PEDIDOS_OS: PedidoOS[] = [
  {
    id: 'OS-2024-0892',
    pedidoId: 'PED-2024-411',
    clientId: 'c1',
    clientName: 'Logística Integrada S.A.',
    title: 'Inspeção Periódica de Detectores e Laço 02',
    type: 'Inspeção NBR 17240',
    technicianName: 'Isaac Lopes',
    scheduledDate: '24 MAI 2024 | 14:30',
    status: 'EM ANDAMENTO',
    priority: 'ALTA',
    value: 3800
  },
  {
    id: 'OS-2024-0889',
    pedidoId: 'PED-2024-399',
    clientId: 'c4',
    clientName: 'Catuaí Shopping Londrina',
    title: 'Troca de Botoeira Quebrada Praça de Alimentação',
    type: 'Corretiva Urgente',
    technicianName: 'Carlos Silva',
    scheduledDate: '24 MAI 2024 | 09:00',
    status: 'CONCLUIDA',
    priority: 'CRITICA',
    value: 1450
  },
  {
    id: 'OS-2024-0885',
    pedidoId: 'PED-2024-380',
    clientId: 'c2',
    clientName: 'Condomínio Solar das Águias',
    title: 'Aferição de Baterias 24V Central de Alarme',
    type: 'Preventiva SDAI',
    technicianName: 'Amanda Souza',
    scheduledDate: '22 MAI 2024 | 15:00',
    status: 'ATRASADA',
    priority: 'NORMAL',
    value: 950
  },
  {
    id: 'OS-2024-0870',
    pedidoId: 'PED-2024-350',
    clientId: 'c5',
    clientName: 'Londrina Norte Shopping',
    title: 'Manutenção de Sistema de Detecção Contínua',
    type: 'Preventiva SDAI',
    technicianName: 'Carlos Silva',
    scheduledDate: '20 MAI 2024 | 10:00',
    status: 'CONCLUIDA',
    priority: 'NORMAL',
    value: 4200
  }
];

export const INITIAL_CONTRACTS: Contract[] = [
  {
    id: 'CTR-FOWL-001',
    clientName: 'Catuaí Shopping Londrina',
    unit: 'Gleba Palhano - Praça & Lojas',
    monthlyValue: 28500,
    renewalDate: '15 NOV 2026',
    readjustmentIndex: 'IPCA (+4.8%)',
    contractedHours: 120,
    usedHours: 94,
    status: 'ATIVO',
    responsibleTech: 'Isaac Lopes',
    artDocumentRef: 'ART-PR-2024-9981'
  },
  {
    id: 'CTR-FOWL-002',
    clientName: 'Londrina Norte Shopping',
    unit: 'Blocos A, B e C',
    monthlyValue: 18200,
    renewalDate: '10 OUT 2026',
    readjustmentIndex: 'IPCA',
    contractedHours: 80,
    usedHours: 62,
    status: 'ATIVO',
    responsibleTech: 'Carlos Silva',
    artDocumentRef: 'ART-PR-2024-7712'
  },
  {
    id: 'CTR-FOWL-003',
    clientName: 'Grupo Muffato (Málagoli)',
    unit: 'Loja Duque de Caxias',
    monthlyValue: 9800,
    renewalDate: '01 SET 2026',
    readjustmentIndex: 'IGP-M',
    contractedHours: 40,
    usedHours: 38,
    status: 'ATIVO',
    responsibleTech: 'Amanda Souza',
    artDocumentRef: 'ART-PR-2024-5541'
  },
  {
    id: 'CTR-FOWL-004',
    clientName: 'Logística Integrada S.A.',
    unit: 'Galpões 01 a 04',
    monthlyValue: 34500,
    renewalDate: '28 AGO 2026',
    readjustmentIndex: 'IPCA',
    contractedHours: 150,
    usedHours: 148,
    status: 'A VENCER',
    responsibleTech: 'Isaac Lopes',
    artDocumentRef: 'ART-PR-2024-8842'
  }
];

export const INITIAL_EQUIPMENT: ClientEquipment[] = [
  {
    id: 'EQ-SDAI-001',
    clientName: 'Logística Integrada S.A.',
    location: 'Galpão Central - Sala de Comando',
    centralModel: 'FX-9000-B Fireowl',
    loopNumber: 'Laço 02',
    detectorPoint: 'Detector Óptico #142',
    serialBP: 'BP-2024-8842-1',
    installationDate: '10 JAN 2023',
    lastMaintenance: '18 MAI 2024',
    nextMaintenance: '18 AGO 2024',
    status: 'ALERTA'
  },
  {
    id: 'EQ-SDAI-002',
    clientName: 'Catuaí Shopping Londrina',
    unit: 'Praça de Alimentação',
    location: 'Sótão Técnico Nível 2',
    centralModel: 'Notifier AFP-3030',
    loopNumber: 'Laço 01',
    detectorPoint: 'Botoeira Endereçável #088',
    serialBP: 'BP-2024-9981-88',
    installationDate: '15 MAR 2022',
    lastMaintenance: '24 MAI 2024',
    nextMaintenance: '24 AGO 2024',
    status: 'OPERACIONAL'
  },
  {
    id: 'EQ-SDAI-003',
    clientName: 'Londrina Norte Shopping',
    location: 'Subsolo Garagem A',
    centralModel: 'Bosch FPA-5000',
    loopNumber: 'Laço 03',
    detectorPoint: 'Detector Térmico #019',
    serialBP: 'BP-2024-6632-19',
    installationDate: '20 JUL 2023',
    lastMaintenance: '20 MAI 2024',
    nextMaintenance: '20 AGO 2024',
    status: 'OPERACIONAL'
  }
];

export const INITIAL_PUNCH_LOGS: TimePunch[] = [
  {
    id: 'p1',
    employeeName: 'Isaac Lopes',
    timestamp: '24 MAI 2024 | 07:58:12',
    type: 'ENTRADA',
    locationStr: 'Catuaí Shopping Londrina (-23.5505, -46.6333)',
    lat: -23.5505,
    lng: -46.6333,
    status: 'APROVADO'
  },
  {
    id: 'p2',
    employeeName: 'Carlos Silva',
    timestamp: '24 MAI 2024 | 08:02:45',
    type: 'ENTRADA',
    locationStr: 'Londrina Norte Shopping (-23.5301, -46.6120)',
    lat: -23.5301,
    lng: -46.6120,
    status: 'APROVADO'
  },
  {
    id: 'p3',
    employeeName: 'Amanda Souza',
    timestamp: '24 MAI 2024 | 12:01:00',
    type: 'PAUSA',
    locationStr: 'Sede Fireowl Controls (-23.5510, -46.6320)',
    lat: -23.5510,
    lng: -46.6320,
    status: 'APROVADO'
  }
];

export const INITIAL_TECHNICAL_REPORT: TechnicalReportSDAI = {
  id: 'SDAI-2024-0892',
  osNumber: '#F0-8842',
  clientName: 'Logística Intermodal S.A.',
  centralCode: 'FX-9000-B',
  coordStr: '-23.5505, -46.6333',
  occurrenceDesc: 'Verificação periódica de detectores de fumaça e acionadores manuais. Identificada instabilidade no laço 02.',
  status: 'EM PROGRESSO',
  devicesCount: 142,
  criticalFailures: 3,
  photos: [
    {
      id: 'p1',
      label: 'CENTRAL DE COMANDO - VISTA FRONTAL',
      tag: 'IMG_SDAI_01',
      url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBGHHX2EqOKqhnFgz0gpV2Gmo3Q3i3nG657fE-vp1JwFEDunaMCO6HBMZWK_FiKkUffcnf26trV5dKXprW9Jp14brVw87kx87YyOW1ktdsmy9ZI_9Vq0MG2ryxmQWbwH-p3vgM3CzHEa25Ok6PGWA__u3r50LTJlRPxN5auSNpETRvmN8PtMTRmzjzE5SWddCTDwKNV5OUYqPkkjDMobCBfnfy4cP8MVZKfCEqEXsJo59nu5Epyp62z4g'
    },
    {
      id: 'p2',
      label: 'DETECTOR ÓPTICO - ZONA 04',
      tag: 'IMG_SDAI_02',
      url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAqh1NLndGJVa8pLkAgp3UiGXFGgNBsirKVJnuCiP03Oo96ZnxrGg9-Nc0EUZdp1xDeUpZQlU5a4Knn65k1Dg10W0TzZFjcgWie0qFlaK2hu623dsJDrxAtux4rCJO0fQtuZ0cuG_y6Tdri30H95upvZ0p6FPbO6UPgEPYU9EiqiG8VD-peEP3a83ffeNf96ie1l-qzuEj9m-Jaw8NIb4C9GPr3EEbRI_Dc8Fd9MFu-a4p5Ph7BZR5pgw'
    }
  ],
  checklist: [
    { item: 'FONTE PRINCIPAL', status: 'OK' },
    { item: 'BATERIAS [24V]', status: '100%' },
    { item: 'ISOLAMENTO LAÇO 2', status: 'FALHA', isCritical: true },
    { item: 'SINALIZAÇÃO VISUAL', status: 'PENDENTE' }
  ],
  specs: {
    model: 'FIREOWL-PRO-X',
    capacity: '250 DISP/LAÇO',
    protocol: 'XP95 / DISCOVERY'
  },
  inspectorName: 'Isaac Lopes',
  creaRegister: 'CREA-PR 4289/D',
  updatedAt: '14:42:05'
};

export const INITIAL_AUDIT_SDAI: AuditSDAI = {
  id: 'AUD-NBR-17240-01',
  clientName: 'Catuaí Shopping Londrina',
  unit: 'Setor Praça & Galeria Leste',
  auditDate: '24 MAI 2024',
  compliancePercentage: 94.2,
  riskCount: { r1: 12, r2: 3, r3: 1, r4: 0 },
  items: [
    { id: 'i1', category: 'Centrais de Alarme', requirement: 'Sinalização sonora e visual em local com supervisão humana 24h', status: 'CONFORME' },
    { id: 'i2', category: 'Baterias & Autonomia', requirement: 'Autonomia mínima de 24 horas em supervisão + 15 min de alarme geral', status: 'CONFORME' },
    { id: 'i3', category: 'Laços & Cabeamento', requirement: 'Cabo blindado resistente a fogo e identificação nas caixas de passagem', status: 'NAO_CONFORME', riskLevel: 3, observation: 'Caixa de passagem 14 sem lacre de vedação corta-fogo.' },
    { id: 'i4', category: 'Acionadores Manuais', requirement: 'Distância máxima de caminhada de 30 metros até a botoeira mais próxima', status: 'CONFORME' }
  ]
};

export const INITIAL_CUSTOM_QUOTES: CustomQuote[] = [
  {
    id: 'ORC-2024-118',
    clientName: 'Catuaí Shopping Londrina',
    description: 'Modernização do Sistema SDAI - Expansão Asa Oeste (Regra 70% Mão de Obra / 30% Materiais)',
    laborValue: 29540,
    materialValue: 12660,
    totalValue: 42200,
    discountApplied: 5,
    finalValue: 40090,
    validityDays: 15,
    status: 'ENVIADO',
    createdAt: '22 MAI 2024'
  },
  {
    id: 'ORC-2024-115',
    clientName: 'Indústria Mecânica Fireowl',
    description: 'Instalação de Barreira Infravermelha & CFTV de Alta Resolução',
    laborValue: 18200,
    materialValue: 7800,
    totalValue: 26000,
    discountApplied: 0,
    finalValue: 26000,
    validityDays: 30,
    status: 'RASCUNHO',
    createdAt: '20 MAI 2024'
  }
];

export const INITIAL_FINANCIAL_TRANSACTIONS: FinancialTransaction[] = [
  {
    id: '#FOWL-0091',
    type: 'RECEITA',
    clientOrVendor: 'Condomínio Solar das Águias',
    description: 'Manutenção Preventiva Semestral',
    date: '24 MAI 2024',
    status: 'CONFIRMADO',
    amount: 14500
  },
  {
    id: '#FOWL-0090',
    type: 'RECEITA',
    clientOrVendor: 'Indústrias Metal-Tech LTDA',
    description: 'Upgrade de Sistema Contra Incêndio',
    date: '22 MAI 2024',
    status: 'PENDENTE',
    amount: 42180
  },
  {
    id: '#FOWL-0089',
    type: 'RECEITA',
    clientOrVendor: 'Shopping Center Norte',
    description: 'Inspeção Emergencial - Bloco C',
    date: '21 MAI 2024',
    status: 'CONFIRMADO',
    amount: 3400
  },
  {
    id: '#FOWL-0088',
    type: 'DESPESA',
    clientOrVendor: 'Bosch Security Systems',
    description: 'Aquisição de Lote de Detectores Ópticos',
    date: '19 MAI 2024',
    status: 'CONFIRMADO',
    amount: 18450
  }
];

export const INITIAL_INVENTORY: InventoryItem[] = [
  {
    id: 'inv-1',
    code: 'DET-OPT-01',
    serialBP: 'BP-SERIE-2024',
    name: 'Detector Óptico de Fumaça Endereçável',
    category: 'SDAI - Detectores',
    quantity: 48,
    minQuantity: 15,
    unitPrice: 280,
    supplier: 'Bosch Security',
    location: 'Prateleira A2 - Almoxarifado'
  },
  {
    id: 'inv-2',
    code: 'BOT-MAN-02',
    serialBP: 'BP-SERIE-8812',
    name: 'Acionador Manual Rearmável com Martelo',
    category: 'SDAI - Botoeiras',
    quantity: 12,
    minQuantity: 10,
    unitPrice: 195,
    supplier: 'Fireowl Controls',
    location: 'Prateleira B1'
  },
  {
    id: 'inv-3',
    code: 'CENT-FX-9000',
    serialBP: 'BP-SERIE-9000',
    name: 'Central de Alarme NFX-9000-B 2 Laços',
    category: 'SDAI - Centrais',
    quantity: 3,
    minQuantity: 2,
    unitPrice: 8900,
    supplier: 'Fireowl Systems',
    location: 'Armário Especial 01'
  }
];

export const INITIAL_AUDIT_LOGS: SystemAuditLog[] = [
  {
    id: 'log-1',
    timestamp: '24 MAI 2024 | 14:42:05',
    user: 'Admin Fireowl (SUPERUSUÁRIO)',
    action: 'Edição de Relatório Técnico',
    module: 'Técnico / Relatório SDAI',
    details: 'Atualizado parâmetro Isolamento Laço 2 para FALHA (Ref: SDAI-2024-0892)',
    ip: '189.34.120.4'
  },
  {
    id: 'log-2',
    timestamp: '24 MAI 2024 | 11:15:30',
    user: 'Carlos Silva (TÉCNICO)',
    action: 'Registro de Ponto Eletrônico',
    module: 'Ponto',
    details: 'Batida de entrada registrada com geolocalização (-23.5301, -46.6120)',
    ip: '177.92.10.88'
  },
  {
    id: 'log-3',
    timestamp: '23 MAI 2024 | 16:20:00',
    user: 'Admin Fireowl',
    action: 'Aprovação de Orçamento',
    module: 'Orçamentos',
    details: 'Aprovado desconto de 5% no Orçamento ORC-2024-118 para Catuaí Shopping',
    ip: '189.34.120.4'
  }
];

export const INITIAL_SUPPLIERS: Supplier[] = [
  {
    id: 'forn-1',
    code: 'FORN-001',
    name: 'Bosch Security Systems Brasil',
    cnpj: '00.123.456/0001-89',
    category: 'Detectores & Centrais SDAI',
    contactName: 'Eduardo Martins',
    phone: '(11) 2123-4500',
    email: 'vendas.security@br.bosch.com',
    city: 'Campinas / SP',
    rating: 4.9,
    leadTimeDays: 3,
    activeStatus: 'HOMOLOGADO',
  },
  {
    id: 'forn-2',
    code: 'FORN-002',
    name: 'Notifier Honeywell Fire Systems',
    cnpj: '43.210.987/0001-12',
    category: 'Centrais Endereçáveis & Módulos',
    contactName: 'Luciana Ferreira',
    phone: '(11) 3345-8800',
    email: 'atendimento@notifier.com.br',
    city: 'São Paulo / SP',
    rating: 4.8,
    leadTimeDays: 5,
    activeStatus: 'HOMOLOGADO',
  },
  {
    id: 'forn-3',
    code: 'FORN-003',
    name: 'Intelbras Indústria de Telecomunicações',
    cnpj: '82.901.000/0001-23',
    category: 'Botoeiras, Baterias 24V & Sirenes',
    contactName: 'Renato Silveira',
    phone: '(48) 2106-0000',
    email: 'comercial.incendio@intelbras.com.br',
    city: 'São José / SC',
    rating: 4.7,
    leadTimeDays: 2,
    activeStatus: 'HOMOLOGADO',
  },
  {
    id: 'forn-4',
    code: 'FORN-004',
    name: 'Prysmian Cabos e Sistemas Brasil',
    cnpj: '61.156.111/0001-45',
    category: 'Cabeamento Blindado Fitolan 105ºC',
    contactName: 'Carlos Eduardo',
    phone: '(15) 3238-6000',
    email: 'vendas.cabos@prysmiangroup.com',
    city: 'Sorocaba / SP',
    rating: 4.6,
    leadTimeDays: 4,
    activeStatus: 'HOMOLOGADO',
  },
];

export const INITIAL_SERVICES: ServiceCatalogItem[] = [
  {
    id: 'srv-1',
    code: 'SERV-SDAI-01',
    title: 'Manutenção Preventiva Semestral SDAI (NBR 17240)',
    category: 'Manutenção Preventiva',
    standardValue: 3800,
    estimatedHours: 8,
    nbrNormRef: 'NBR 17240 / IT-22',
    active: true,
  },
  {
    id: 'srv-2',
    code: 'SERV-SDAI-02',
    title: 'Inspeção Normativa & Emissão de Laudo Técnico com ART',
    category: 'Laudo Técnico ART',
    standardValue: 4500,
    estimatedHours: 12,
    nbrNormRef: 'NBR 17240 / CREA-PR',
    active: true,
  },
  {
    id: 'srv-3',
    code: 'SERV-SDAI-03',
    title: 'Atendimento Emergencial Corretivo (Chamado 24h)',
    category: 'Corretiva Urgente',
    standardValue: 1450,
    estimatedHours: 4,
    nbrNormRef: 'Procedimento Interno Fireowl',
    active: true,
  },
  {
    id: 'srv-4',
    code: 'SERV-SDAI-04',
    title: 'Reprogramação e Endereçamento de Laço SDAI',
    category: 'Instalação & Configuração',
    standardValue: 2200,
    estimatedHours: 6,
    nbrNormRef: 'NBR 17240',
    active: true,
  },
];

export const INITIAL_COMPANY_PROFILE: CompanyProfile = {
  razaoSocial: 'Fireowl Controls Ltda.',
  cnpj: '57.372.721/0001-40',
  endereco: 'Av. Higienópolis, 70 - Centro, Londrina / PR',
  telefone: '(43) 98445-5979',
  email: 'comercial@fireowlcontrols.com.br',
  regimeTributario: 'Simples Nacional (Incluso Anexo III)',
  logoUrl: '',
};

// Sem marcas de exemplo: as marcas reais vêm do Estoque (marca do produto),
// dos Fornecedores e do "Cadastrar nova marca". Assim o relatório nunca mostra
// nome fictício (ex.: "Intelbras Fire Systems") que o usuário não cadastrou.
export const INITIAL_PARTNER_BRANDS: PartnerBrand[] = [];

export const INITIAL_TEMPLATES: PedidoTemplate[] = [
  {
    id: 'tmpl-1',
    name: 'Modelo — Manutenção Preventiva SDAI (NBR 17240)',
    objetivo: 'Prestação de serviços técnicos especializados de engenharia para manutenção preventiva periódica, testes operacionais e inspeção contínua dos sistemas de detecção e alarme de incêndio (SDAI).',
    diretrizesNormativas: [
      'ABNT NBR 17240:2010 — Sistemas de detecção e alarme de incêndio',
      'ABNT NBR 5410:2004 — Instalações elétricas de baixa tensão',
      'Instrução Técnica nº 22 do Corpo de Bombeiros Militar',
    ],
    escopoServico: 'Inspeção física e funcional de todos os detectores de fumaça e temperatura, testes de sensibilidade nos laços endereçáveis, verificação do banco de baterias de 24Vdc da central, simulação de falha de energia e emissão de relatório RDO com ART CREA-PR.',
    entregaveis: [
      'Relatório Diário de Obra (RDO) e Checklist de Testes Normativos',
      'Certificado de Inspeção Periódica com Anotação de Responsabilidade Técnica (ART)',
      'Plano Recomendado de Ações Corretivas e Substituição Preventiva de Peças',
    ],
    premissas: [
      'Acesso livre e desembaraçado às dependências do cliente nos horários agendados',
      'Disponibilização de acompanhante responsável do cliente durante as rotinas de teste e disparo de sirenes',
      'Disponibilidade de ponto de energia e sinal de rede telefônica/dados para módulos de comunicação',
    ],
    responsabilidadesContratada: [
      'Fornecer equipe técnica qualificada e com certificações NRs (NR-10, NR-35)',
      'Fornecer ferramentas calibradas e equipamentos de proteção individual (EPIs)',
      'Emitir laudo assinado por Engenheiro Responsável registrado no CREA',
    ],
    responsabilidadesContratante: [
      'Garantir autorização de entrada e desativação temporária de rotinas de alarme se necessário',
      'Avisar previamente os brigadistas e ocupantes sobre os testes sonoros de sirene',
      'Efetuar os pagamentos conforme cronograma das condições comerciais',
    ],
    garantia: 'Garantia de 90 (noventa) dias sobre os serviços de mão de obra prestados e garantia de 12 (doze) meses para peças e componentes novos fornecidos.',
    conclusao: 'Permanecemos à inteira disposição para quaisquer esclarecimentos técnicos ou comerciais necessários. Renovamos nossos protestos de elevada estima e consideração.',
  },
];

export const INITIAL_PEDIDOS: Pedido[] = [
  {
    id: 'ped-1',
    numeroPedido: 'PED-2026-014',
    referencia: 'Retrofit & Manutenção Preventiva SDAI Laço 01 e 02',
    clienteId: 'c1',
    clienteNome: 'Catuaí Shopping Londrina',
    fornecedor: 'Fireowl Controls Ltda.',
    dataEmissao: '2026-08-01',
    responsavelComercialId: 'u1',
    responsavelComercialNome: 'Isaac Lopes',
    status: 'enviado_ao_cliente',
    createdAt: '01 AGO 2026',
    updatedAt: '01 AGO 2026',
    proposal: {
      objetivo: 'Fornecimento de equipamentos, materiais de infraestrutura e serviços de engenharia para adequação normativa e substituição de detectores no Shopping Catuaí.',
      diretrizesNormativas: [
        'ABNT NBR 17240:2010',
        'ABNT NBR 5410:2004',
        'Instrução Técnica nº 22 do Corpo de Bombeiros Militar do Paraná (CBMPR)',
      ],
      escopoServico: 'Substituição de 24 detectores ópticos de fumaça, instalação de 2 botoeiras endereçáveis rearmáveis, reconfiguração do laço 02 na central Notifier NFX e testes de isolamento de curto-circuito.',
      entregaveis: [
        'Relatório Técnico de Comissionamento e Testes',
        'Anotação de Responsabilidade Técnica (ART CREA-PR)',
        'As-Built atualizado dos pontos de detecção do Bloco B',
      ],
      premissas: [
        'Acesso permitido no período noturno (das 22:00 às 06:00)',
        'Disponibilização de PEMP (Plataforma Elevatória Móvel de Trabalho) pelo contratante',
      ],
      prazoExecucao: '10 (dez) dias úteis após a aprovação formal e liberação dos acessos às docas.',
      garantia: '12 (doze) meses para os equipamentos fornecidos e 90 (noventa) dias para a instalação.',
      validadePropostaDias: 15,
      validadePropostaComplemento: 'dias corridos a partir da data de emissão',
      conclusao: 'A Fireowl Controls coloca-se à disposição para esclarecer eventuais dúvidas sobre esta proposta técnica e comercial.',
      equipmentItems: [
        {
          itemNumero: 1,
          descricao: 'Detector Óptico de Fumaça Endereçável Inteligente',
          marcaModelo: 'Notifier FSP-951',
          unidade: 'un',
          quantidade: 24,
          precoUnitario: 340,
        },
        {
          itemNumero: 2,
          descricao: 'Acionador Manual Endereçável Rearmável com Quebre-o-Vidro',
          marcaModelo: 'Notifier NBG-12LX',
          unidade: 'un',
          quantidade: 2,
          precoUnitario: 480,
        },
        {
          itemNumero: 3,
          descricao: 'Cabo Blindado Drenado 2x1.5mm² 105ºC Fitolan (Rolo 100m)',
          marcaModelo: 'Prysmian Fire-Resist',
          unidade: 'rl',
          quantidade: 2,
          precoUnitario: 890,
        },
      ],
      marcas: [
        {
          marcaNome: 'Notifier Honeywell',
          marcaCategoria: 'Centrais Endereçáveis & Módulos',
          ordemExibicao: 1,
        },
        {
          marcaNome: 'Intelbras Fire Systems',
          marcaCategoria: 'Botoeiras & Sirenes',
          ordemExibicao: 2,
        },
      ],
      responsabilidadesContratada: [
        'Fornecer mão de obra especializada com registros NR-10 e NR-35 em dia.',
        'Manter o local limpo e organizado durante e após a execução dos trabalhos.',
        'Emitir ART CREA-PR quitada referente aos serviços executados.',
      ],
      responsabilidadesContratante: [
        'Garantir ponto de energia elétrica 220V no local de trabalho.',
        'Liberar os acessos das equipes identificadas com crachá e EPIs.',
      ],
      valorTotal: 18500,
      composicaoValor: '65% equipamentos e materiais / 35% mão de obra de engenharia',
      formaPagamento: '30% no aceite / 70% na entrega e emissão de laudo técnico',
      faturamento: 'Faturamento direto via Nota Fiscal de Serviços',
      impostos: 'Inclusos (Simples Nacional - Anexo III)',
    },
  },
  {
    id: 'ped-2',
    numeroPedido: 'PED-2026-015',
    referencia: 'Inspeção Normativa Geral e Laudo Técnico Anual',
    clienteId: 'c2',
    clienteNome: 'Ambev Fabrica Curitiba',
    fornecedor: 'Fireowl Controls Ltda.',
    dataEmissao: '2026-08-02',
    responsavelComercialId: 'u1',
    responsavelComercialNome: 'Isaac Lopes',
    status: 'aceito',
    createdAt: '02 AGO 2026',
    updatedAt: '02 AGO 2026',
    proposal: {
      objetivo: 'Auditoria de conformidade NBR 17240 nas centrais EST3X das linhas de envasamento.',
      diretrizesNormativas: [
        'ABNT NBR 17240:2010',
        'ABNT NBR 5410:2004',
      ],
      escopoServico: 'Inspeção de 180 detectores, verificação dos isoladores de laço e teste de disparo das válvulas solenóides de dilúvio.',
      entregaveis: [
        'Laudo Técnico com Selo CREA-PR',
        'Relatório Fotográfico de Anomalias',
      ],
      premissas: [
        'Acompanhamento do técnico de segurança da fábrica durante toda a auditoria.',
      ],
      prazoExecucao: '5 (cinco) dias úteis.',
      garantia: '90 (noventa) dias.',
      validadePropostaDias: 15,
      validadePropostaComplemento: 'dias corridos',
      conclusao: 'Atenciosamente, Equipe Comercial Fireowl Controls.',
      equipmentItems: [
        {
          itemNumero: 1,
          descricao: 'Módulo de Isolamento de Laço ISO-X',
          marcaModelo: 'Edwards EST3-ISO',
          unidade: 'un',
          quantidade: 6,
          precoUnitario: 520,
        },
      ],
      marcas: [
        {
          marcaNome: 'Edwards EST3X',
          marcaCategoria: 'Central de detecção e alarme',
          ordemExibicao: 1,
        },
      ],
      responsabilidadesContratada: [
        'Cumprir rigorosamente todas as normas internas de EHS da planta.',
      ],
      responsabilidadesContratante: [
        'Autorizar bloqueio temporário do sistema de alarme durante simulações.',
      ],
      valorTotal: 12400,
      composicaoValor: '100% serviços e laudo de engenharia',
      formaPagamento: 'Faturamento 28 dias após emissão da NF-e',
      faturamento: 'Faturamento único ao final',
      impostos: 'Inclusos (Simples Nacional)',
    },
  },
];

