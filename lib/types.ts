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
  | 'relatorios'
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

export interface PdfPrefs {
  configBeforeGenerate: boolean;
  detailedSubtotal: boolean;
  showLogo: boolean;
  showBankData: boolean;
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
  /** Marcas/fabricantes que este fornecedor trabalha (por nome). */
  brands?: string[];
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
  // Cliente provisório criado em campo — requer migração 0028_clients_provisional
  pendenteValidacao?: boolean;
  createdByRole?: string;
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
  // Campos estendidos (opcionais) — requerem migração 0022_contracts_details.sql
  clientId?: string; // vínculo com a base de clientes
  startDate?: string; // início da vigência
  contractType?: string; // escopo (Preventiva SDAI, CFTV, Full...)
  paymentDay?: number; // dia de vencimento da mensalidade
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
  at?: number; // epoch ms do registro (para cálculos de jornada)
  accuracy?: number; // precisão do GPS em metros
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
  // Campos estendidos (opcionais) — requerem migração 0021_transactions_details.sql
  category?: string;
  dueDate?: string; // vencimento
  paymentMethod?: string; // PIX, Boleto, TED, Cartão...
  documentRef?: string; // NF / documento
  costCenter?: string; // centro de custo (despesas)
  clientId?: string; // vínculo com a base de clientes
  contractId?: string; // vínculo com um contrato
  osId?: string; // vínculo com uma OS
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
  subcategory?: string;
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
  /** Cadastro provisório iniciado em campo (relatório). O marcador persistido é
   * o código "PROV-…"; este flag é a conveniência em memória na sessão. */
  pendenteValidacao?: boolean;
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

/* =====================================================================
 * Subsistema de Relatórios Técnicos (Levantamento / Corretiva / Preventiva)
 * Requer migrações 0023–0028. Fase 1: fundação de dados.
 * ===================================================================== */

export type ReportTipo = 'LEVANTAMENTO' | 'CORRETIVA' | 'PREVENTIVA';
export type ReportStatus =
  | 'rascunho'
  | 'em_execucao'
  | 'aguardando_assinatura'
  | 'finalizado'
  | 'cancelado';
export type SyncStatus = 'local' | 'sincronizado' | 'conflito';
export type GeoPoint = { lat?: number; lng?: number; accuracy?: number; timestamp?: string };

export type AcaoRecomendada =
  | 'substituir'
  | 'instalar'
  | 'reposicionar'
  | 'reparar'
  | 'limpar'
  | 'desobstruir'
  | 'reprogramar'
  | 'investigar';

export type PendenciaStatus =
  | 'aberta'
  | 'orcada'
  | 'aprovada'
  | 'em_execucao'
  | 'corrigida'
  | 'cancelada'
  | 'recusada_cliente';

/** Dispositivo do parque instalado do cliente (inventário as-built, v2.0). */
export interface Device {
  id: string;
  clienteId: string;
  sistema: 'SDAI' | 'CFTV' | 'CONTROLE_ACESSO' | 'BMS';
  central?: string;
  laco?: string;
  endereco?: string;
  tipoDispositivo?: string;
  fabricante?: string;
  modelo?: string;
  localizacao?: string;
  pavimento?: string;
  dataInstalacao?: string;
  status: 'ativo' | 'inativo' | 'substituido' | 'removido';
  ultimaManutencao?: string;
  ultimoTesteFuncional?: string;
  cicloAmostragemId?: string;
  itemCatalogoId?: string;
}

/** Template de relatório (schema JSON consumido pelo motor de formulários). */
export interface ReportTemplate {
  id: string;
  codigo: string; // LEVANTAMENTO_SDAI, CORRETIVA_SDAI, PREVENTIVA_SDAI
  nome: string;
  tipo: ReportTipo;
  schema: any; // seções + campos (inclui repeater)
  ativo: boolean;
  versao: number;
}

/** Instância de relatório preenchido (v2.0). */
export interface ReportInstance {
  id: string;
  templateId?: string;
  templateCodigo: string;
  numero?: string; // LEV-2026-0142
  tipo: ReportTipo;
  clienteId?: string;
  osId?: string;
  contratoId?: string;
  tecnicoId?: string;
  tecnicoNome?: string;
  titulo?: string;
  local?: string;
  status: ReportStatus;
  // iniciadoEm/finalizadoEm mapeiam para data_inicio/data_fim no banco.
  iniciadoEm?: string;
  finalizadoEm?: string;
  geoInicio?: GeoPoint | null;
  geoFim?: GeoPoint | null;
  resumoExecucao?: Record<string, unknown> | null;
  observacoesGerais?: string;
  syncStatus?: SyncStatus;
  clientUuid?: string;
}

/** Resposta de um campo do relatório (campo_key = texto, não FK). */
export interface ReportAnswer {
  id: string;
  reportId: string;
  secao?: string;
  fieldKey: string; // -> coluna campo_key
  valor: any;
  deviceId?: string;
  observacao?: string;
  repeaterIdx?: number;
}

/** Mídia (foto) do relatório. answerId nulo = bandeja de não classificadas. */
export interface ReportMedia {
  id: string;
  reportId: string;
  answerId?: string;
  pendenciaId?: string;
  deviceId?: string;
  tipo: 'antes' | 'depois' | 'evidencia' | 'geral';
  storagePathOriginal: string; // nunca sobrescrito
  storagePathMarcado?: string; // versão com markup
  notaRapida?: string;
  legenda?: string;
  geo?: GeoPoint | null;
  ordem?: number;
  capturadoEm?: string;
}

/** Assinatura coletada no relatório. */
export interface ReportSignature {
  id: string;
  reportId: string;
  papel: 'cliente' | 'tecnico' | 'responsavel_tecnico';
  nome: string;
  documento?: string; // mascarado na exibição (LGPD)
  cargo?: string;
  storagePath?: string; // PNG
  assinadoEm?: string;
  geo?: GeoPoint | null;
}

/** Pendência — objeto central (vira linha de orçamento / registro de execução). */
export interface Pendencia {
  id: string;
  clienteId?: string;
  deviceId?: string;
  reportOrigemId?: string;
  grupo?: string;
  descricao?: string;
  acaoRecomendada?: AcaoRecomendada;
  normaReferencia?: string;
  local?: string;
  quantidade?: number;
  unidade?: string; // pç, m, vb, pt, h
  itemCatalogoId?: string;
  itemTextoLivre?: string;
  precisaCadastroCatalogo?: boolean;
  /** INTERNO (1–3). Ausente quando lido pelo perfil Técnico. */
  criticidadeOperacional?: number;
  status: PendenciaStatus;
  propostaId?: string;
  reportExecucaoId?: string;
  criadaEm?: string;
  resolvidaEm?: string;
}

export type OrdemServicoStatus = 'aberta' | 'agendada' | 'em_execucao' | 'concluida' | 'cancelada';

/** Ordem de Serviço — agrega pendências aprovadas e liga à corretiva de execução. */
export interface OrdemServico {
  id: string;
  numero?: string; // OS-2026-0091
  clienteId?: string;
  contratoId?: string;
  tipo: 'corretiva' | 'preventiva' | 'instalacao' | 'outro';
  titulo?: string;
  descricao?: string;
  status: OrdemServicoStatus;
  prioridade: 'baixa' | 'media' | 'alta' | 'critica';
  pendenciaIds: string[];
  reportId?: string; // relatório de execução vinculado
  dataAbertura?: string;
  dataPrevista?: string;
  dataConclusao?: string;
  criadoPor?: string;
}

/** Custos de logística versionados por vigência. */
export interface CustoLogistica {
  id: string;
  vigenciaInicio: string;
  vigenciaFim?: string;
  custoKm?: number;
  diariaAlimentacao?: number;
  diariaHospedagem?: number;
  horaTecnicaDeslocamento?: number;
  pedagioRota?: Record<string, number> | null;
}

/** Registro provisório criado em campo (cliente/marca/item), aguardando homologação. */
export interface CatalogoProvisorio {
  id: string;
  tipo: 'cliente' | 'marca' | 'item';
  dados: Record<string, unknown>;
  reportOrigemId?: string;
  criadoPor?: string;
  status: 'pendente' | 'aprovado' | 'mesclado' | 'rejeitado';
  registroFinalId?: string;
}

/** Ciclo de amostragem rotativa da preventiva. */
export interface CicloAmostragem {
  id: string;
  clienteId?: string;
  contratoId?: string;
  periodoInicio?: string;
  periodoFim?: string;
  percentualPorVisita?: number;
  dispositivosTotais?: number;
  dispositivosTestados?: number;
}

/** Serviço do catálogo (persistido). */
export interface Service {
  id: string;
  code?: string;
  title: string;
  category?: string;
  standardValue?: number;
  estimatedHours?: number;
  nbrNormRef?: string;
  active?: boolean;
}

/** Entrada persistida da trilha de auditoria. */
export interface AuditLogEntry {
  id: string;
  ts?: string;
  userName?: string;
  userRole?: string;
  action: string;
  module?: string;
  details?: string;
  ip?: string;
}
