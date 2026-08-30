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
  | 'visualizado_cliente'
  | 'em_negociacao'
  | 'aceito'
  | 'concluido'
  | 'recusado'
  | 'expirado';

/** Recebimento de uma proposta concluída (à vista ou parcelado). */
export interface RecebimentoProposta {
  forma: 'avista' | 'parcelado';
  valor: number;
  paymentMethod?: string; // PIX, Boleto, TED, Cartão, Dinheiro...
  dataRecebimento?: string; // data em que foi marcada como recebida (à vista) ou da entrada
  entrada?: number; // valor pago à vista antes do parcelamento
  parcelas?: { numero: number; total: number; valor: number; vencimento: string }[];
}

export interface PedidoEquipmentItem {
  itemNumero: number;
  descricao: string;
  /** Descrição detalhada opcional (aparece abaixo do item no documento). */
  descricaoDetalhada?: string;
  marcaModelo: string;
  unidade: string;
  quantidade: number;
  /** Desconto em R$ aplicado sobre o total da linha (preço × qtd − desconto). */
  desconto?: number;
  vinculoEstoqueId?: string;
  /** Serviço vinculado ao catálogo de Serviços (quando tipo = 'servico'). */
  vinculoServicoId?: string;
  /** Classificação do item na proposta. Ausente = material (compatibilidade). */
  tipo?: 'material' | 'servico';
  precoUnitario?: number;
  /** Origem técnica preservada internamente quando o item veio de levantamento. */
  sourceOrigins?: TechnicalOrigin[];
  /** Fotografia do saldo no momento da preparação; não reserva nem baixa estoque. */
  stockSnapshot?: number;
}

export interface TechnicalOrigin {
  type: 'finding' | 'device_failure' | 'structural_issue' | 'measurement' | 'general' | 'pending';
  reportId: string;
  reference?: string;
  label: string;
  quantity: number;
}

export interface RequiredMaterial {
  id: string;
  reportId: string;
  catalogItemId?: string;
  descricao: string;
  marca?: string;
  modelo?: string;
  quantidade: number;
  unidade: string;
  observacao?: string;
  origem: TechnicalOrigin;
}

export interface RequiredService {
  id: string;
  reportId: string;
  serviceId?: string;
  descricao: string;
  quantidade: number;
  unidade: string;
  observacao?: string;
  origem: TechnicalOrigin;
}

export interface SurveyMeasurement {
  id: string;
  reportId: string;
  categoria: string;
  descricao: string;
  quantidade: number;
  unidade: string;
  local?: string;
  observacao?: string;
  catalogItemId?: string;
  incluirNoPedido: boolean;
  origem?: TechnicalOrigin;
}

export interface SurveyOrderLink {
  id: string;
  reportId: string;
  pedidoId: string;
  criadoEm?: string;
}

export interface PedidoBrand {
  marcaNome: string;
  marcaCategoria: string;
  marcaLogoUrl?: string;
  ordemExibicao: number;
}

export interface CommercialProposalData {
  /** P1 — áreas de atuação da proposta (ids de AREAS_PROPOSTA). Compõe o título. */
  areaPrincipal?: string[];
  /** P1 — tipo de serviço (id de TIPOS_SERVICO). Compõe o título dinâmico. */
  tipoServico?: string;
  /** §37 — nível de apresentação: simples (enxuto), técnica (padrão), corporativa. */
  nivelProposta?: 'simples' | 'tecnica' | 'corporativa';
  /** §12 — ordem das seções do corpo (chaves). Vazio/ausente = ordem padrão. */
  ordemSecoes?: string[];
  /** Página "Experiência e Capacidade Técnica": true/false força; undefined = automático (por nível). */
  incluirExperiencia?: boolean;
  /** §14 — false = seleção manual das empresas/marcas; undefined/true = automática. */
  experienciaAuto?: boolean;
  /** §14 — ids das empresas escolhidas manualmente (na ordem). */
  experienciaEmpresasIds?: string[];
  /** §14 — ids das marcas escolhidas manualmente (na ordem). */
  experienciaMarcasIds?: string[];
  objetivo: string;
  /** Carta de apresentação (opcional). Vazio → usa o texto institucional padrão. */
  cartaApresentacao?: string;
  /** Histórico de revisões da proposta (aparece na seção "Histórico de Propostas"). */
  revisoes?: { numero: string; data: string; elaborador: string; motivo?: string; status?: string; alteracoes?: string[]; snapshot?: { referencia: string; valorTotal: number; objetivo: string; escopoServico: string; prazoExecucao: string; garantia: string; validadeDias: number; itens: string; pagamento: string } }[];
  /** Motivo comercial registrado quando a proposta é recusada ou expira. */
  motivoRecusa?: string;
  /** Caminho no Storage (bucket report-media) da imagem opcional da capa do PDF. */
  capaImagemPath?: string;
  /**
   * Tipo do pedido (Fase 1: guardado no JSONB da proposta para não exigir
   * migração de coluna). Usado para escolher o documento padrão ao gerar PDF.
   */
  pedidoTipo?: PedidoTipo;
  /** Rastreabilidade do levantamento que originou este pedido (uso interno). */
  surveyOrigin?: {
    reportId: string;
    reportNumber?: string;
    reportArea?: string;
    createdAt: string;
  };
  /** Dados do recebimento quando a proposta é concluída (à vista/parcelado). */
  recebimento?: RecebimentoProposta;
  /** Documento Personalizado: título e campos livres (rótulo + valor). */
  tituloPersonalizado?: string;
  camposPersonalizados?: { rotulo: string; valor: string }[];
  diretrizesNormativas: string[];
  escopoServico: string;
  entregaveis: string[];
  premissas: string[];
  /** §16 — itens incluídos no escopo (bloco visual "Incluso / Não incluso"). */
  incluso?: string[];
  /** §16 — itens explicitamente fora do escopo. */
  naoIncluso?: string[];
  /** §18/§28 — nº de unidades/pontos atendidos (card de indicador). */
  unidadesAtendidas?: number;
  /** §18/§28 — frequência de manutenção/atendimento (ex.: "Trimestral"). */
  frequenciaManutencao?: string;
  /** §17/§18 — SLA para falhas críticas (ex.: "48 horas"). */
  slaCritico?: string;
  /** §17 — tabela de SLA (situação → prazo). Só aparece se preenchida. */
  slaTabela?: { situacao: string; prazo: string }[];
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
  /** Contrato recorrente (mensal): quando true, o PDF destaca "R$ X / mês". */
  recorrente?: boolean;
  /** Valor mensal do contrato recorrente. */
  valorMensal?: number;
  /** Vigência do contrato em meses (para valor anual/estimado total). */
  vigenciaMeses?: number;
  /** Valor de mão de obra / serviços (aparece como linha "Serviços" no PDF). */
  maoDeObra?: number;
  composicaoValor: string;
  formaPagamento: string;
  /** Formas de pagamento selecionadas (tags): Pix, Boleto, TED/DOC, Cartão. */
  formasPagamento?: string[];
  /** Condições de pagamento selecionadas (tags pré-formatadas). */
  condicoesPagamento?: string[];
  faturamento: string;
  impostos: string;
  /** Chaves de ativação dos blocos jurídicos (undefined = incluído por padrão). */
  incluirMultas?: boolean;
  incluirLimitacao?: boolean;
  incluirConfidencialidade?: boolean;
  incluirCondicoesGerais?: boolean;
  incluirSeguranca?: boolean;
  incluirTermoAceite?: boolean;

  /* ===== ETAPA 2 — Materialização de textos-padrão =====================
   * Estes campos guardam, NO PRÓPRIO REGISTRO da proposta, os textos que
   * antes eram injetados apenas na renderização do PDF (propostaTextos.ts).
   * Ao criar uma proposta NOVA eles são preenchidos ("materializados") a
   * partir do template atual; o PDF passa a ler daqui. Um campo `undefined`
   * numa proposta materializada = seção removida; um array vazio = o usuário
   * apagou de propósito (respeitar, não reinjetar). Propostas históricas
   * (textosMaterializados falsy) continuam usando o fallback do renderer.
   * =================================================================== */
  /** Carta de Apresentação em parágrafos (materializada). */
  cartaApresentacaoParas?: string[];
  /** Descrição dos Serviços Ofertados (subitens). */
  servicosOfertados?: { titulo: string; itens: string[] }[];
  /** Embalagem, Transporte e Armazenamento. */
  embalagemTransporteTexto?: string[];
  /** Segurança do Trabalho. */
  segurancaTrabalhoTexto?: string[];
  /** Observações de Preços (reajuste etc.). */
  precosObsTexto?: string[];
  /** Observações de Impostos e Taxas. */
  impostosObsTexto?: string[];
  /** Multas por Atraso de Pagamento. */
  multasAtrasoTexto?: string[];
  /** Limitação de Responsabilidade. */
  limitacaoRespTexto?: string[];
  /** Confidencialidade. */
  confidencialidadeTexto?: string[];
  /** Termo de Aceite da Proposta. */
  termoAceiteTexto?: string[];
  /** Condições Gerais. */
  condicoesGeraisTexto?: string[];
  /** Marca que os textos-padrão já foram materializados neste registro. */
  textosMaterializados?: boolean;
  /** Origem por seção: 'padrao' (igual ao template) | 'personalizado' (editado). */
  secaoFonte?: Record<string, 'padrao' | 'personalizado'>;
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
  /** Segmento/mercado atendido pela marca (ex.: incêndio, CFTV, automação). */
  segment?: string;
}

// ===== Módulo "Experiência, Clientes e Marcas" (apresentação institucional) =====

export type AutorizacaoMarca = 'nao_informado' | 'autorizado' | 'nao_autorizado';

/** Empresa/cliente de destaque já atendido (para a página institucional). */
export interface EmpresaAtendida {
  id: string;
  nome: string;
  nomeFantasia?: string;
  /** storage_path do logo (PNG rasterizado). */
  logoPath?: string;
  descricao?: string;
  segmentos: string[];
  /** ids de área (sdai, cftv, acesso, alarme, bms, integracao, seguranca, engenharia). */
  areas: string[];
  destaque: boolean;
  ativo: boolean;
  exibirProposta: boolean;
  autorizacao: AutorizacaoMarca;
  ordem: number;
}

/** Marca/fabricante/tecnologia com que a Fireowl trabalha (institucional). */
export interface MarcaTecnologia {
  id: string;
  nome: string;
  logoPath?: string;
  descricao?: string;
  categoria?: string;
  areas: string[];
  tecnologias: string[];
  ativo: boolean;
  exibirProposta: boolean;
  ordem: number;
}

export interface PdfPrefs {
  configBeforeGenerate: boolean;
  detailedSubtotal: boolean;
  showLogo: boolean;
  showBankData: boolean;
}

/**
 * Tipos de documento que o sistema pode gerar (as 8 opções do modal
 * "Qual documento gerar?"). Hoje só 'proposta_comercial' tem gerador real;
 * os demais são construídos em fases seguintes.
 */
export type DocumentType =
  | 'orcamento'
  | 'proposta_comercial'
  | 'ordem_servico'
  | 'lista_produtos'
  | 'nota_servico'
  | 'nota_produtos'
  | 'laudo_tecnico'
  | 'personalizado';

/** Classificação do pedido, usada para decidir o documento padrão. */
export type PedidoTipo = 'orcamento' | 'proposta' | 'servico' | 'fornecimento' | 'laudo';

/**
 * Config nível-empresa: documento padrão para cada tipo de pedido.
 * Ausência da chave (ou 'nenhum') = comportamento atual (perguntar no modal).
 */
export type DocumentosPadrao = Partial<Record<PedidoTipo, DocumentType | 'nenhum'>>;

export interface CompanyProfile {
  razaoSocial: string;
  /** Nome fantasia / marca (exibido no cabeçalho dos documentos). */
  nomeFantasia?: string;
  cnpj: string;
  endereco: string;
  telefone: string;
  email: string;
  regimeTributario: string;
  logoUrl?: string;
  /** §8 — biblioteca de textos institucionais (editável em Conta). */
  apresentacaoGeral?: string;
  /** §8 — apresentação por área (ids: sdai, cftv, acesso, alarme, bms, integracao). */
  apresentacaoAreas?: Record<string, string>;
  /** §20 — capa (storage_path) por área; usada quando a proposta não tem capa própria. */
  capaAreas?: Record<string, string>;
  // ===== Identidade visual (logos oficiais — storage_path PNG) =====
  logoPrincipalPath?: string;
  logoClaroPath?: string;
  logoEscuroPath?: string;
  logoIconePath?: string;
  // ===== Textos institucionais da página "Experiência e Capacidade Técnica" =====
  expIntro?: string;
  techIntro?: string;
  // ===== Limites de logos por proposta (config) =====
  expMaxEmpresas?: number;
  expMaxMarcas?: number;
}

export interface PedidoTemplate {
  id: string;
  name: string;
  /** Ausente = modelo geral. Preenchido = modelo favorito daquele cliente. */
  clientId?: string;
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
  /** Foto da fachada (storage_path); usada como capa padrão das propostas do cliente. */
  fachadaPath?: string;
  /** Logo do cliente (storage_path, PNG rasterizado). Distinta da fachada. */
  logoPath?: string;
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

/** Pedido interno de fornecimento, rastreável até a proposta aceita. */
export interface SupplyOrder {
  id: string;
  sourcePedidoId: string;
  clientId?: string;
  clientName: string;
  title: string;
  status:
    | 'ABERTO'
    | 'EM_COTACAO'
    | 'AGUARDANDO_COMPRA'
    | 'COMPRADO'
    | 'RECEBIMENTO_PARCIAL'
    | 'RECEBIDO'
    | 'ENTRADA_PARCIAL_ESTOQUE'
    | 'CONCLUIDO'
    | 'CANCELADO';
  supplier?: string;
  purchaseDate?: string;
  receivedAt?: string;
  /** @deprecated fluxo simples antigo (0051). A verdade agora é supply_receipts + supply_receipt_items.stock_movement_id. Não usar como fonte de verdade. */
  stockReceivedAt?: string;
  items: PedidoEquipmentItem[];
  totalValue: number;
  createdAt: string;
}

// ===== Compra (subetapa opcional: pedido -> compra -> recebimento) =====
export type SupplyPurchaseStatus = 'registrada' | 'recebida_parcial' | 'recebida' | 'cancelada';

export interface SupplyPurchaseItem {
  id: string;
  purchaseId: string;
  orderItemKey?: string;
  inventoryItemId?: string;
  descricao?: string;
  quantity: number;
  unitCost?: number;
  total?: number;
}

export interface SupplyPurchase {
  id: string;
  supplyOrderId: string;
  supplierId?: string;
  supplier?: string;
  status: SupplyPurchaseStatus;
  purchaseDate?: string;
  expectedDate?: string;
  notes?: string;
  totalValue?: number;
  createdAt?: string;
  items?: SupplyPurchaseItem[];
}

// ===== Recebimento de fornecimento (parcial) + conferência + entrada no estoque =====
export type SupplyReceiptStatus = 'recebido' | 'conferido' | 'lancado' | 'cancelado';
export type RejectionReason =
  | 'avariado'
  | 'produto_incorreto'
  | 'quantidade_divergente'
  | 'modelo_divergente'
  | 'embalagem_comprometida'
  | 'faltante'
  | 'outro';

/** Item de um recebimento: recebido / aceito / rejeitado; lançado no estoque via RPC idempotente. */
export interface SupplyReceiptItem {
  id: string;
  receiptId: string;
  /** Chave estável do item do pedido (vinculoEstoqueId ou índice). */
  orderItemKey?: string;
  /** inventory_items.id (quando o item está vinculado ao Estoque). */
  inventoryItemId?: string;
  /** Link opcional ao item da compra (rastreabilidade compra -> recebimento). */
  purchaseItemId?: string;
  descricao?: string;
  quantityReceived: number;
  quantityAccepted: number;
  quantityRejected: number;
  rejectionReason?: RejectionReason;
  unitCost?: number;
  /** Preenchido quando lançado no estoque — impede lançar duas vezes. */
  stockMovementId?: string;
  postedAt?: string;
  /** Estorno (0054): quando a entrada deste item foi estornada por completo. */
  reversedAt?: string;
  reversalMovementId?: string;
  /** Estorno parcial (0055): total já estornado deste item. */
  quantityReversed?: number;
}

/** Recebimento (pode haver vários por pedido de fornecimento — entrega parcial). */
export interface SupplyReceipt {
  id: string;
  supplyOrderId: string;
  supplier?: string;
  supplierId?: string;
  purchaseId?: string;
  receivedAt: string;
  receivedBy?: string;
  notes?: string;
  status: SupplyReceiptStatus;
  stockPostedAt?: string;
  stockPostedBy?: string;
  createdAt?: string;
  items?: SupplyReceiptItem[];
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
  /** Pedido/proposta que originou este contrato por conversão comercial. */
  sourcePedidoId?: string;
}

/** Evento manual do relacionamento com o cliente (nota, contato ou decisão). */
export interface ClientEvent {
  id: string;
  clientId: string;
  type: 'nota' | 'contato' | 'negociacao' | 'visita';
  content: string;
  authorName?: string;
  createdAt: string;
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
  /** Metadados do catálogo técnico; não significam saldo físico. */
  productLine?: string;
  technologies?: string[];
  catalogStatus?: 'ATIVO' | 'LEGADO' | 'DESCONTINUADO' | 'A_VALIDAR';
  productType?: 'EQUIPMENT' | 'MATERIAL' | 'ACCESSORY' | 'SOFTWARE' | 'LICENSE' | 'CONSUMABLE' | 'INFRASTRUCTURE';
  catalogOnly?: boolean;
  notes?: string;
  datasheetUrl?: string;
  /** Ficha técnica estruturada; campos ausentes permanecem ausentes, nunca estimados. */
  technicalSpecs?: Record<string, string | number | boolean | string[] | null>;
  shortDescription?: string;
  commercialDescription?: string;
  technicalDescription?: string;
  recommendedUse?: string;
  technicalNotes?: string;
  manufacturerUrl?: string;
  specSourceUrl?: string;
  specLastVerifiedAt?: string;
  systemType?: string;
  marketSegment?: 'PROFESSIONAL' | 'RESIDENTIAL' | 'SMART_HOME';
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
  /** Origem do movimento (rastreabilidade): pedido de fornecimento. */
  supplyOrderId?: string;
  unitCost?: number;
  /** Estorno: movimento que este movimento reverte + motivo/usuário. */
  reversesMovementId?: string;
  reversalReason?: string;
  createdBy?: string;
  /** Semântica do movimento: ex. 'SUPPLY_REVERSAL' (estorno) — distingue de saída operacional. */
  originType?: string;
  /** Estorno parcial (0055): entrada original relacionada. */
  relatedMovementId?: string;
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
