export type TabPath = 
  | 'painel' 
  | 'pedidos'
  | 'contratos' 
  | 'receitas'
  | 'despesas'
  | 'financas'
  | 'agenda' 
  | 'clientes'
  | 'fornecedores'
  | 'estoque'
  | 'servicos'
  | 'ponto'
  | 'conta';

export type UserRole = 'ADMINISTRATIVO' | 'TECNICO' | 'GESTOR' | 'FINANCEIRO';

export type PedidoStatus =
  | 'rascunho'
  | 'em_revisao'
  | 'aprovado_interno'
  | 'enviado_ao_cliente'
  | 'aceito'
  | 'recusado'
  | 'expirado';

export interface PedidoEquipmentItem {
  itemNumero: number;
  descricao: string;
  marcaModelo: string;
  unidade: string;
  quantidade: number;
  vinculoEstoqueId?: string;
  precoUnitario?: number;
}

export interface PedidoBrand {
  marcaNome: string;
  marcaCategoria: string;
  marcaLogoUrl?: string;
  ordemExibicao: number;
}

export interface CommercialProposalData {
  objetivo: string;
  diretrizesNormativas: string[];
  escopoServico: string;
  entregaveis: string[];
  premissas: string[];
  prazoExecucao: string;
  garantia: string;
  validadePropostaDias: number;
  validadePropostaComplemento?: string;
  conclusao: string;
  equipmentItems: PedidoEquipmentItem[];
  marcas: PedidoBrand[];
  responsabilidadesContratada: string[];
  responsabilidadesContratante: string[];
  valorTotal: number;
  composicaoValor: string;
  formaPagamento: string;
  faturamento: string;
  impostos: string;
}

export interface Pedido {
  id: string; // Internal id or number, e.g. ped-001
  numeroPedido: string; // PED-2026-014
  referencia: string;
  clienteId: string;
  clienteNome: string;
  fornecedor: string; // "Fireowl Controls Ltda."
  dataEmissao: string;
  responsavelComercialId: string;
  responsavelComercialNome: string;
  status: PedidoStatus;
  proposal: CommercialProposalData;
  createdAt: string;
  updatedAt: string;
}

export interface PartnerBrand {
  id: string;
  name: string;
  category: string;
  logoUrl?: string;
}

export interface CompanyProfile {
  razaoSocial: string;
  cnpj: string;
  endereco: string;
  telefone: string;
  email: string;
  regimeTributario: string;
  logoUrl?: string;
}

export interface PedidoTemplate {
  id: string;
  name: string;
  objetivo: string;
  diretrizesNormativas: string[];
  escopoServico: string;
  entregaveis: string[];
  premissas: string[];
  responsabilidadesContratada: string[];
  responsabilidadesContratante: string[];
  garantia: string;
  conclusao: string;
}

export interface Supplier {
  id: string;
  code: string;
  name: string;
  cnpj: string;
  category: string;
  contactName: string;
  phone: string;
  email: string;
  city: string;
  rating: number;
  leadTimeDays: number;
  activeStatus: 'HOMOLOGADO' | 'EM AVALIACAO' | 'SUSPENSO';
}

export interface ServiceCatalogItem {
  id: string;
  code: string;
  title: string;
  category: string;
  standardValue: number;
  estimatedHours: number;
  nbrNormRef: string;
  active: boolean;
}

export interface User {
  id: string;
  name: string;
  role: UserRole;
  roleLabel: string;
  email: string;
  avatar?: string;
}

export interface Client {
  id: string;
  code: string; // e.g. #F0-8842
  name: string;
  cnpj: string;
  segment: string; // 'Shopping', 'Indústria', 'Condomínio', 'Logística'
  contractStatus: 'EM DIA' | 'PENDENTE' | 'ATRASADO';
  lastOSDate: string;
  lastOSType: string;
  address: string;
  contacts: { name: string; role: string; phone: string; email: string }[];
  totalContractsValue: number;
}

export interface PedidoOS {
  id: string; // OS-2024-001
  pedidoId: string; // PED-8812
  clientId: string;
  clientName: string;
  title: string;
  type: 'Preventiva SDAI' | 'Corretiva Urgente' | 'Instalação CFTV' | 'Inspeção NBR 17240';
  technicianName: string;
  scheduledDate: string;
  status: 'ABERTA' | 'EM ANDAMENTO' | 'CONCLUIDA' | 'ATRASADA';
  priority: 'ALTA' | 'CRITICA' | 'NORMAL';
  value: number;
}

export interface Contract {
  id: string;
  clientName: string;
  unit: string;
  monthlyValue: number;
  renewalDate: string;
  readjustmentIndex: string; // IPCA
  contractedHours: number;
  usedHours: number;
  status: 'ATIVO' | 'A VENCER' | 'SUSPENSO';
  responsibleTech: string;
  artDocumentRef: string;
}

export interface ClientEquipment {
  id: string; // EQ-SDAI-091
  clientName: string;
  unit?: string;
  location: string; // 'Bloco A - Central Notifier'
  centralModel: string; // 'FX-9000-B'
  loopNumber: string; // 'Laço 02'
  detectorPoint: string; // 'Ponto 142'
  serialBP: string; // 'BP-2024-9912'
  installationDate: string;
  lastMaintenance: string;
  nextMaintenance: string;
  status: 'OPERACIONAL' | 'ALERTA' | 'DEFEITO';
}

export interface TimePunch {
  id: string;
  employeeName: string;
  timestamp: string;
  type: 'ENTRADA' | 'PAUSA' | 'RETORNO' | 'SAIDA';
  locationStr: string;
  lat: number;
  lng: number;
  status: 'APROVADO' | 'PENDENTE' | 'AJUSTADO';
  photoUrl?: string;
  notes?: string;
}

export interface TechnicalReportSDAI {
  id: string; // REF: SDAI-2024-0892
  osNumber: string;
  clientName: string;
  centralCode: string;
  coordStr: string;
  occurrenceDesc: string;
  status: 'EM PROGRESSO' | 'FINALIZADO' | 'APROVADO';
  devicesCount: number;
  criticalFailures: number;
  photos: {
    id: string;
    label: string;
    tag: string;
    url: string;
  }[];
  checklist: {
    item: string;
    status: 'OK' | '100%' | 'FALHA' | 'PENDENTE';
    isCritical?: boolean;
  }[];
  specs: {
    model: string;
    capacity: string;
    protocol: string;
  };
  inspectorName: string;
  creaRegister: string;
  updatedAt: string;
}

export interface AuditSDAI {
  id: string;
  clientName: string;
  unit: string;
  auditDate: string;
  compliancePercentage: number;
  riskCount: { r1: number; r2: number; r3: number; r4: number };
  items: {
    id: string;
    category: string;
    requirement: string;
    status: 'CONFORME' | 'NAO_CONFORME' | 'NAO_APLICAVEL';
    riskLevel?: 1 | 2 | 3 | 4;
    observation?: string;
  }[];
}

export interface CustomQuote {
  id: string; // ORC-2024-118
  clientName: string;
  description: string;
  laborValue: number; // 70%
  materialValue: number; // 30%
  totalValue: number;
  discountApplied: number; // %
  finalValue: number;
  validityDays: number;
  status: 'RASCUNHO' | 'ENVIADO' | 'APROVADO' | 'RECUSADO';
  createdAt: string;
}

export interface FinancialTransaction {
  id: string; // #FOWL-0091
  type: 'RECEITA' | 'DESPESA';
  clientOrVendor: string;
  description: string;
  date: string;
  status: 'CONFIRMADO' | 'PENDENTE' | 'ATRASADO';
  amount: number;
}

export interface InventoryItem {
  id: string;
  code: string;
  serialBP?: string;
  name: string;
  category: string;
  quantity: number;
  minQuantity: number;
  unitPrice: number;
  supplier: string;
  location: string;
  // Campos estendidos do cadastro de produto (todos opcionais)
  imageUrl?: string;
  unit?: string;
  salePrice?: number;
  costPrice?: number;
  profitMargin?: number;
  markup?: number;
  stockManaged?: boolean;
  idealQuantity?: number;
  reservedQuantity?: number;
  brand?: string;
  model?: string;
  description?: string;
}

export interface StockMovement {
  id: string;
  itemId?: string;
  itemCode?: string;
  itemName?: string;
  type: 'entrada' | 'saida';
  quantity: number;
  resultingBalance?: number;
  note?: string;
  createdAt?: string;
}

export interface SystemAuditLog {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  module: string;
  details: string;
  ip: string;
}
