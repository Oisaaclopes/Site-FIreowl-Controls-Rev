'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Client,
  InventoryItem,
  ServiceCatalogItem,
  Contract,
  UserRole,
  ReportInstance,
  Pendencia,
  Device,
  OrdemServico,
  CicloAmostragem,
  CompanyProfile,
  Supplier,
  Pedido,
  TimePunch,
} from '@/lib/types';
import { ALL_TEMPLATES, seedReportTemplates } from '@/lib/reportTemplatesData';
import { TemplateSchema } from '@/lib/reportSchema';
import { CatalogSources } from '@/components/reports/FormEngine';
import { ReportForm } from '@/components/reports/ReportForm';
import { isSupabaseConfigured } from '@/lib/inventory';
import { fetchReports, updateReport, safelyDeleteReport } from '@/lib/reports';
import { fetchPendencias, updatePendenciaStatus } from '@/lib/pendencias';
import { fetchDevices } from '@/lib/devices';
import { fetchOrdensServico, updateOrdemServico } from '@/lib/ordensServico';
import { fetchAssignableTechnicians, ManagedUser } from '@/lib/users';
import { ResponsibleSelect } from '@/components/ui/ResponsibleSelect';
import { OsAttendanceCta } from '@/components/operacoes/ServiceAttendanceFlow';
import { useToast, useConfirm, showToast, requestConfirm } from '@/components/ui/Feedback';
import { ClientSelector } from '@/components/clients/ClientSelector';
import { TechnicalSurveyFlow } from '@/components/clients/TechnicalSurveyFlow';
import { fetchTechnicalCatalog, TechnicalCatalogItem } from '@/lib/technicalCatalog';
import { TechArea } from '@/lib/technicalBase';
import { fetchCicloAtivo, quotaPorVisita } from '@/lib/ciclos';
import { cancelReportBundle, flushOutbox, pendingCount, isOnline, purgeDeletedLegacyReportBundles } from '@/lib/offline/reportSync';
import { removeReportPhoto } from '@/lib/reportMedia';
import { EmptyState } from '@/components/EmptyState';
import { GRUPOS_FALHA, falhasPorArea, AreaFalha } from '@/lib/catalogoFalhas';
import { fetchTemplates } from '@/lib/reportTemplates';
import { gerarPdfExecucao } from '@/lib/reportPdf';
import { ReportTechnicalPDFView } from '@/components/documentos/ReportTechnicalPDFView';
import { PendenciasBoard } from '@/components/reports/PendenciasBoard';
import { createOrderFromSurvey } from '@/lib/surveyOrderConversion';
import { fetchPedidos } from '@/lib/pedidos';
import { useDomainRefresh } from '@/lib/realtime/RealtimeProvider';
import { centralModelsForBrand, centralType, manufacturersForArea } from '@/lib/technicalCatalogSelection';
import { canHardDeleteReport, filterReports, isLatestReportRefresh } from '@/lib/reportList';
import { getClientOperationalName } from '@/lib/utils';
import { resolveLogoDataUrls } from '@/lib/institucional';
import { ClientLogo } from '@/components/ClientLogo';

/** Template disponível ao motor: o schema + o id no banco (quando veio do DB). */
interface LoadedTemplate {
  id?: string;
  schema: TemplateSchema;
}

interface RelatoriosViewProps {
  clients: Client[];
  inventory: InventoryItem[];
  services: ServiceCatalogItem[];
  contracts: Contract[];
  brands: { id?: string; name: string; category?: string }[];
  userRole: UserRole;
  companyProfile?: CompanyProfile;
  currentUserName?: string;
  /** UUID autenticado — CTA operacional de atendimento em "Meus Atendimentos". */
  userId?: string;
  /** profiles.uses_time_clock — aviso de jornada ao iniciar atendimento (§6). */
  usesTimeClock?: boolean;
  /** Ponto do usuário — usado no aviso de jornada. */
  currentUserPunches?: TimePunch[];
  /** Atalho vindo do Dashboard: 'wizard' abre o Novo Relatório direto. */
  initialAction?: 'wizard' | null;
  onInitialActionConsumed?: () => void;
  onAddClient?: (newClient: Client) => void;
  /** Cadastra uma nova marca (usado pelo "Cadastrar nova marca" dos comboboxes). */
  onAddBrand?: (name: string, category?: string) => void;
  /** Cadastra um produto (usado pelo cadastro provisório de produto em campo). */
  onAddInventoryItem?: (item: InventoryItem) => void | Promise<void>;
  /** Fornecedores (para vincular uma marca a um fornecedor no cadastro). */
  suppliers?: Supplier[];
  /** Atualiza um fornecedor (usado ao vincular a marca ao fornecedor). */
  onUpdateSupplier?: (s: Supplier) => void | Promise<void>;
  /** Remove uma marca do catálogo (usado pelo botão "remover" na janela). */
  onDeletePartnerBrand?: (id: string) => void;
  /** Baixa de estoque dos materiais aplicados ao finalizar o relatório. */
  onConsumeMaterials?: (
    materials: { nome: string; quantidade: number }[],
    contexto?: { numero?: string; clienteNome?: string }
  ) => void | Promise<void>;
  /** Navega para a aba comercial ao consultar o Pedido originado no levantamento. */
  onNavigateToPedidos?: () => void;
}

const uniq = (arr: string[]) => Array.from(new Set(arr.filter(Boolean)));
// Deduplica ignorando maiúsc./minúsc. e espaços nas pontas (evita "Tecnohold"
// aparecer duas vezes por diferença de digitação). Mantém a 1ª grafia vista.
const uniqCI = (arr: string[]): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of arr) {
    const v = (raw || '').trim();
    if (!v) continue;
    const k = v.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(v);
  }
  return out;
};

// Categoria de estoque sugerida a partir da área/disciplina do relatório.
const AREA_TO_CATEGORY: Record<string, string> = {
  SDAI: 'SDAI',
  CFTV: 'CFTV',
  CONTROLE_ACESSO: 'Controle de Acesso',
  ALARME: 'Alarme de Intrusão',
  BMS: '',
};

// Monta um produto PROVISÓRIO a partir do cadastro em campo. Vai para o Estoque
// já visível, mesmo sem fornecedor/custo — o código "PROV-…" e a descrição
// sinalizam que o cadastro precisa ser finalizado depois. Não exige migração:
// o marcador viaja no próprio código (persiste no banco e sobrevive ao reload).
function buildProvisionalInventory(data: {
  name: string;
  brand?: string;
  model?: string;
  unit?: string;
  description?: string;
  area?: string;
}): InventoryItem {
  const rand = Math.floor(1000 + Math.random() * 9000);
  const note = 'Cadastro iniciado em campo (relatório). Finalize no Estoque: informe fornecedor, custo e preço de venda.';
  return {
    id: `inv_prov_${Date.now()}`,
    code: `PROV-${rand}`,
    name: data.name,
    category: AREA_TO_CATEGORY[data.area || 'SDAI'] ?? '',
    quantity: 0,
    minQuantity: 0,
    unitPrice: 0,
    supplier: '',
    location: '',
    unit: data.unit || undefined,
    brand: data.brand || undefined,
    model: data.model || undefined,
    description: data.description ? `${note} — ${data.description}` : note,
    stockManaged: false,
    // Cadastro iniciado em campo é catálogo técnico, não saldo físico.
    catalogOnly: true,
    catalogStatus: 'A_VALIDAR',
    salePrice: undefined,
    costPrice: undefined,
    pendenteValidacao: true,
  };
}
const shortId = (id: string) => `#${id.slice(0, 8)}`;
const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '—');

const STATUS_COLOR: Record<string, string> = {
  rascunho: 'bg-surface-3 text-fg-secondary',
  finalizado: 'bg-emerald-100 text-emerald-800',
  cancelado: 'bg-red-100 text-red-700',
};
const TIPO_LABEL: Record<string, string> = {
  LEVANTAMENTO_TECNICO: 'Levantamento Técnico', // motor 3D (não gera 'reports')
  LEVANTAMENTO: 'Levantamento (legado)', // só rótulo de fallback p/ eventuais registros históricos
  CORRETIVA: 'Corretiva',
  PREVENTIVA: 'Preventiva',
};

export const RelatoriosView: React.FC<RelatoriosViewProps> = ({
  clients,
  inventory,
  services,
  contracts,
  brands,
  userRole,
  companyProfile,
  currentUserName = '',
  userId,
  usesTimeClock = false,
  currentUserPunches = [],
  initialAction,
  onInitialActionConsumed,
  onAddClient,
  onAddBrand,
  onAddInventoryItem,
  suppliers = [],
  onUpdateSupplier,
  onDeletePartnerBrand,
  onConsumeMaterials,
  onNavigateToPedidos,
}) => {
  const isTecnico = userRole === 'TECNICO';
  const isFinanceiro = userRole === 'FINANCEIRO';
  const canCreate = !isFinanceiro; // §6.1 RBAC: criar relatório — admin/gestor/técnico
  const canManage = canHardDeleteReport(userRole); // editar/excluir relatório

  const [mode, setMode] = useState<'index' | 'form'>('index');
  const [board, setBoard] = useState<'atendimentos' | 'relatorios' | 'pendencias'>('atendimentos');
  // Pré-visualização do PDF técnico (react-pdf). Fallback = método HTML antigo.
  const [reportPreview, setReportPreview] = useState<ReportInstance | null>(null);
  const [creatingOrderFromReport, setCreatingOrderFromReport] = useState<string | null>(null);
  const [reports, setReports] = useState<ReportInstance[]>([]);
  const refreshGeneration = useRef(0);
  const [deletingReportId, setDeletingReportId] = useState<string | null>(null);
  const [surveyOrders, setSurveyOrders] = useState<Pedido[]>([]);
  const [pendencias, setPendencias] = useState<Pendencia[]>([]);
  const [ordens, setOrdens] = useState<OrdemServico[]>([]);
  const toast = useToast();
  const confirm = useConfirm();
  const podeAtribuir = userRole === 'ADMINISTRATIVO' || userRole === 'GESTOR';
  const [technicians, setTechnicians] = useState<ManagedUser[]>([]);
  useEffect(() => {
    // O RPC já restringe (FINANCEIRO/inativo → []); carregamos para resolver nomes.
    fetchAssignableTechnicians().then(setTechnicians).catch(() => setTechnicians([]));
  }, []);
  const tecById = (id?: string) => (id ? technicians.find((t) => t.id === id) : undefined);
  const responsavelLabel = (os: OrdemServico): string => {
    if (!os.tecnicoResponsavelId) return 'Não atribuído';
    const t = tecById(os.tecnicoResponsavelId);
    if (!t) return 'Responsável definido';
    return t.cargo ? `${t.name} · ${t.cargo}` : t.name;
  };
  const setOsResponsavel = async (os: OrdemServico, id: string) => {
    if ((os.tecnicoResponsavelId || '') === id) return;
    if (!id) {
      const ok = await confirm({ title: 'Remover responsável técnico desta OS?', confirmLabel: 'Remover', danger: true });
      if (!ok) return;
    }
    try {
      const saved = await updateOrdemServico({ ...os, tecnicoResponsavelId: id || undefined });
      setOrdens((prev) => prev.map((x) => (x.id === os.id ? saved : x)));
      toast.success('Responsável técnico atualizado.');
    } catch (err) {
      console.error('Falha ao atribuir responsável:', err);
      toast.error('Não foi possível atualizar o responsável.');
    }
  };
  const [loading, setLoading] = useState(false);
  // Templates: "template é dado, não código" — carregados do banco, com
  // fallback aos empacotados e seed automático (admin) na primeira vez.
  const [templates, setTemplates] = useState<LoadedTemplate[]>(ALL_TEMPLATES.map((s) => ({ schema: s })));

  // Filtros da lista
  const [fTipo, setFTipo] = useState<string>('TODOS');
  const [fStatus, setFStatus] = useState<string>('TODOS');
  const [search, setSearch] = useState('');

  const handleCreateOrderFromSurvey = async (report: ReportInstance) => {
    setCreatingOrderFromReport(report.id);
    try {
      const result = await createOrderFromSurvey(report.id);
      const warning = result.warnings.length
        ? `\n\nRevise antes de enviar:\n• ${result.warnings.join('\n• ')}`
        : '';
      showToast(result.alreadyExists
        ? `Este levantamento já está vinculado ao Pedido ${result.pedido.numeroPedido}.`
        : `Pedido ${result.pedido.numeroPedido} criado como rascunho.${warning}`);
      refresh();
    } catch (error) {
      console.error('Falha ao criar pedido a partir do levantamento:', error);
      showToast(error instanceof Error ? error.message : 'Não foi possível criar o Pedido.');
    } finally {
      setCreatingOrderFromReport(null);
    }
  };

  // Wizard "+ Novo Relatório". Auditoria continua usando PREVENTIVA/SDAI
  // internamente, mas conserva o contexto operacional apenas nesta sessão.
  const [wizardStep, setWizardStep] = useState<0 | 1 | 2 | 3>(0);
  const [wTipo, setWTipo] = useState<string>(''); // LEVANTAMENTO | CORRETIVA | PREVENTIVA
  const [wArea, setWArea] = useState<string>(''); // disciplina (SDAI, CFTV, ...)
  const [attendanceMode, setAttendanceMode] = useState<'NORMAL' | 'AUDITORIA'>('NORMAL');
  const [wClienteId, setWClienteId] = useState<string>('');
  const [wContratoId, setWContratoId] = useState<string>('');
  const [wOsId, setWOsId] = useState<string>('');
  // Levantamento Técnico (motor 3D) lançado do wizard — mesmo componente do Cliente 360.
  const [survey, setSurvey] = useState<{ area: TechArea; clienteId: string; clientName: string; devices: Device[]; catalog: TechnicalCatalogItem[] } | null>(null);

  // Estado do cadastro provisório em campo (§6.3 / §9.1)
  const [provNome, setProvNome] = useState('');
  const [provCnpj, setProvCnpj] = useState('');
  const [provCnpjErr, setProvCnpjErr] = useState('');

  const handleCreateProvisionalClient = () => {
    const nome = provNome.trim();
    const cnpj = provCnpj.trim();
    if (!nome) {
      setProvCnpjErr('Nome do cliente é obrigatório.');
      return;
    }
    if (cnpj) {
      const cleanCnpj = cnpj.replace(/\D/g, '');
      const existing = clients.find((c) => (c.cnpj || '').replace(/\D/g, '') === cleanCnpj);
      if (existing) {
        setProvCnpjErr(`CNPJ já cadastrado para: "${existing.name}". Selecione-o na lista acima.`);
        return;
      }
    }
    const newClient: Client = {
      id: `c_prov_${Date.now()}`,
      code: `#PROV-${Math.floor(1000 + Math.random() * 9000)}`,
      name: nome,
      cnpj: cnpj || '00.000.000/0000-00',
      segment: 'Campo (Provisório)',
      contractStatus: 'EM DIA',
      lastOSDate: new Date().toLocaleDateString('pt-BR'),
      lastOSType: 'Levantamento',
      address: 'Endereço registrado em campo',
      contacts: [{ name: 'Contato Local', role: 'Representante', phone: '', email: '' }],
      totalContractsValue: 0,
      pendenteValidacao: true,
      createdByRole: userRole,
    };
    if (onAddClient) {
      onAddClient(newClient);
    } else {
      clients.unshift(newClient);
    }
    setWClienteId(newClient.id);
    setProvNome('');
    setProvCnpj('');
    setProvCnpjErr('');
    showToast(`Cliente provisório "${nome}" cadastrado com sucesso! Selecionado para este relatório.`);
  };

  // Config do formulário aberto
  const [formTemplate, setFormTemplate] = useState<TemplateSchema | null>(null);
  const [formTemplateId, setFormTemplateId] = useState<string | undefined>(undefined);
  const [formCliente, setFormCliente] = useState<Client | undefined>(undefined);
  const [formContext, setFormContext] = useState<{ osId?: string; contratoId?: string }>({});
  const [formDevices, setFormDevices] = useState<Device[] | undefined>(undefined);
  const [formCiclo, setFormCiclo] = useState<CicloAmostragem | undefined>(undefined);
  const [formAreaDevices, setFormAreaDevices] = useState<Device[]>([]); // corretiva: dispositivos da área
  const [formOsPendenciaIds, setFormOsPendenciaIds] = useState<string[]>([]);
  const [offlinePend, setOfflinePend] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [online, setOnline] = useState(true);

  // Cadastro PROVISÓRIO de produto em campo (aba flutuante). Disparado ao
  // "Cadastrar novo item/modelo" nos comboboxes do relatório; salva um produto
  // pendente no Estoque para ser finalizado depois.
  const [lastBrand, setLastBrand] = useState('');
  const [provProdOpen, setProvProdOpen] = useState(false);
  const [ppName, setPpName] = useState('');
  const [ppBrand, setPpBrand] = useState('');
  const [ppModel, setPpModel] = useState('');
  const [ppUnit, setPpUnit] = useState('');
  const [ppDesc, setPpDesc] = useState('');
  const [ppSaving, setPpSaving] = useState(false);
  const [ppDone, setPpDone] = useState<string | null>(null);

  const openProvProduct = (name: string, origem: string) => {
    // origem 'modelos' → o texto é o modelo (nome fica pro usuário completar);
    // origem 'estoque_servicos' → o texto é o próprio nome do produto.
    setPpName(origem === 'modelos' ? '' : name);
    setPpModel(origem === 'modelos' ? name : '');
    setPpBrand(lastBrand || '');
    setPpUnit('');
    setPpDesc('');
    setPpDone(null);
    setProvProdOpen(true);
  };

  const confirmProvProduct = async () => {
    const nome = (ppName.trim() || ppModel.trim());
    if (!nome || ppSaving) return;
    const area = (formTemplate?.area as string) || 'SDAI';
    const item = buildProvisionalInventory({
      name: nome,
      brand: ppBrand.trim() || undefined,
      model: ppModel.trim() || undefined,
      unit: ppUnit.trim() || undefined,
      description: ppDesc.trim() || undefined,
      area,
    });
    setPpSaving(true);
    try {
      await onAddInventoryItem?.(item);
      setPpDone(nome);
    } catch (err) {
      console.error('Falha ao salvar produto provisório no Estoque:', err);
      showToast('Não foi possível enviar o produto ao Estoque. Tente novamente.');
    } finally {
      setPpSaving(false);
    }
  };

  // Marcas conhecidas (catálogo de marcas + marcas de produtos do Estoque),
  // deduplicadas ignorando maiúsc./minúsc. — base para evitar duplicatas.
  const marcaOptions = uniqCI([...(brands?.map((b) => b.name) || []), ...inventory.map((i) => i.brand || '')]);

  // Cadastro de MARCA (fabricante) — janela de verdade, disparada ao "Cadastrar
  // nova marca" no relatório. Evita marca solta/duplicada e permite vincular a
  // um fornecedor. Nada é criado se o usuário cancelar.
  const [brandOpen, setBrandOpen] = useState(false);
  const [bName, setBName] = useState('');
  const [bCategoria, setBCategoria] = useState('');
  const [bFornecedor, setBFornecedor] = useState('');
  const [bSaving, setBSaving] = useState(false);
  const [bDone, setBDone] = useState<string | null>(null);

  const openBrand = (name: string) => {
    setBName(name);
    setBCategoria((formTemplate?.area as string) || 'SDAI');
    setBFornecedor('');
    setBDone(null);
    setBrandOpen(true);
  };

  const brandJaExiste = (nome: string) => marcaOptions.some((m) => m.toLowerCase() === nome.trim().toLowerCase());

  // Marcas removíveis (as que têm id, ou seja, vindas do catálogo de marcas).
  const removableBrands = (brands || []).filter((b): b is { id: string; name: string; category?: string } => !!b.id);
  const handleRemoveBrand = async (id: string, nome: string) => {
    if (!onDeletePartnerBrand) return;
    if (!await requestConfirm(`Remover a marca "${nome}" do catálogo?`)) return;
    onDeletePartnerBrand(id);
  };

  // ---- Edição / exclusão de relatório ----
  const [editRep, setEditRep] = useState<ReportInstance | null>(null);
  const [erTitulo, setErTitulo] = useState('');
  const [erLocal, setErLocal] = useState('');
  const [erTecnico, setErTecnico] = useState('');
  const [erStatus, setErStatus] = useState<ReportInstance['status']>('rascunho');
  const [erSaving, setErSaving] = useState(false);

  const openEditReport = (r: ReportInstance) => {
    setEditRep(r);
    setErTitulo(r.titulo || '');
    setErLocal(r.local || '');
    setErTecnico(r.tecnicoNome || '');
    setErStatus(r.status);
  };

  const saveEditReport = async () => {
    if (!editRep || erSaving) return;
    const updated: ReportInstance = {
      ...editRep,
      titulo: erTitulo.trim() || undefined,
      local: erLocal.trim() || undefined,
      tecnicoNome: erTecnico.trim() || undefined,
      status: erStatus,
    };
    setErSaving(true);
    try {
      if (isSupabaseConfigured()) await updateReport(updated);
      setReports((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      setEditRep(null);
    } catch (e) {
      console.error('Falha ao atualizar relatório:', e);
      showToast('Não foi possível salvar as alterações do relatório.');
    } finally {
      setErSaving(false);
    }
  };

  const handleDeleteReport = async (r: ReportInstance) => {
    if (deletingReportId) return;
    const numero = r.numero || shortId(r.id);
    await requestConfirm({
      title: 'Excluir relatório?',
      message: `${numero}\n${clientName(r.clienteId)}\n${TIPO_LABEL[r.tipo] || r.tipo}\n\nEste relatório será excluído permanentemente. Esta ação só é permitida quando não existem vínculos operacionais que precisem ser preservados.`,
      confirmLabel: 'Excluir permanentemente',
      danger: true,
      action: async () => {
        try {
          setDeletingReportId(r.id);
          const result = isSupabaseConfigured()
            ? await safelyDeleteReport(r.id)
            : { clientUuid: r.clientUuid, storagePaths: [] };
          // Invalida qualquer resposta de refresh iniciada antes da confirmação.
          refreshGeneration.current += 1;
          await cancelReportBundle(result.clientUuid || r.clientUuid);
          try {
            window.localStorage.removeItem(`fireowl_atendimento_rascunho:${r.templateCodigo}:${r.clienteId || 'sem_cliente'}:${r.osId || 'avulso'}`);
          } catch { /* armazenamento local indisponível */ }
          // O registro já foi removido de forma atômica; limpeza de binários é
          // best-effort e não pode ressuscitar nem invalidar o delete confirmado.
          await Promise.allSettled(result.storagePaths.map((path) => removeReportPhoto(path)));
          setReports((prev) => prev.filter((x) => x.id !== r.id));
          showToast('Relatório excluído com sucesso.', 'success');
        } catch (e) {
          console.error('Falha ao excluir relatório:', e);
          const message = e instanceof Error && /vínculos operacionais|preservado/i.test(e.message)
            ? 'Este relatório possui vínculos operacionais e precisa ser preservado.'
            : 'Não foi possível excluir o relatório. O registro foi mantido.';
          showToast(message, 'error');
        } finally {
          setDeletingReportId(null);
        }
      },
    });
  };

  const confirmBrand = async () => {
    const nome = bName.trim();
    if (!nome || bSaving) return;
    const existe = brandJaExiste(nome);
    setBSaving(true);
    try {
      if (!existe) onAddBrand?.(nome, bCategoria.trim() || 'SDAI');
      // Vínculo opcional com fornecedor (via lista de marcas do fornecedor).
      if (bFornecedor && onUpdateSupplier) {
        const sup = suppliers.find((s) => s.id === bFornecedor);
        if (sup && !(sup.brands || []).some((b) => b.toLowerCase() === nome.toLowerCase())) {
          await onUpdateSupplier({ ...sup, brands: [...(sup.brands || []), nome] });
        }
      }
      setLastBrand(nome); // prefila a marca no cadastro de produto seguinte
      setBDone(existe ? `${nome} (já estava cadastrada)` : nome);
    } catch (err) {
      console.error('Falha ao cadastrar a marca:', err);
      showToast('Não foi possível cadastrar a marca. Tente novamente.');
    } finally {
      setBSaving(false);
    }
  };

  // Interface operacional: nome fantasia (fallback razão). Fonte canônica única.
  const clientName = (id?: string) => getClientOperationalName(clients.find((c) => c.id === id), '—');
  const surveyOrderFor = (reportId: string) => surveyOrders.find((pedido) => pedido.proposal?.surveyOrigin?.reportId === reportId);

  // Logos reais dos clientes (path → data URI) para os cards operacionais (§11).
  const [clientLogoUrls, setClientLogoUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    let alive = true;
    resolveLogoDataUrls(clients.map((c) => c.logoPath || '').filter(Boolean))
      .then((map) => { if (alive) setClientLogoUrls(map); })
      .catch(() => {});
    return () => { alive = false; };
  }, [clients]);
  const clientLogoUrl = (id?: string) => {
    const p = clients.find((c) => c.id === id)?.logoPath;
    return p ? clientLogoUrls[p] : undefined;
  };

  const refresh = () => {
    if (!isSupabaseConfigured()) return;
    const generation = ++refreshGeneration.current;
    setLoading(true);
    Promise.all([fetchReports(), fetchPendencias(userRole), fetchOrdensServico(), fetchPedidos().catch(() => [])])
      .then(([rs, ps, os, pedidos]) => {
        if (!isLatestReportRefresh(refreshGeneration.current, generation)) return;
        setReports(rs);
        setPendencias(ps);
        setOrdens(os);
        setSurveyOrders(pedidos);
      })
      .catch((err) => { if (isLatestReportRefresh(refreshGeneration.current, generation)) console.warn('Relatórios: falha ao carregar.', err); })
      .finally(() => { if (isLatestReportRefresh(refreshGeneration.current, generation)) setLoading(false); });
    pendingCount().then(setOfflinePend).catch(() => {});
  };

  useDomainRefresh('reports', refresh, mode === 'index');
  useDomainRefresh('pending', refresh, mode === 'index');
  useDomainRefresh('serviceOrders', refresh, mode === 'index');

  // Carrega templates do banco; se vazio e admin, semeia os empacotados.
  const loadTemplates = async () => {
    if (!isSupabaseConfigured()) return;
    try {
      let rows = await fetchTemplates();
      // Admin re-sincroniza os templates empacotados (upsert idempotente por
      // código): propaga tanto novas disciplinas quanto MUDANÇAS de schema
      // (ex.: split de campo). Enquanto os templates evoluem, isso mantém o
      // banco alinhado ao código. (Quando estabilizar, dá para trocar por
      // versionamento e semear só quando a versão mudar.)
      if (userRole === 'ADMINISTRATIVO') {
        await seedReportTemplates();
        rows = await fetchTemplates();
      }
      if (rows.length > 0) {
        // Propaga a versão vigente do banco para o schema (o ReportForm congela
        // essa versão no snapshot ao iniciar um novo relatório) — CAMPO 2B.
        setTemplates(rows.map((r) => ({ id: r.id, schema: { ...(r.schema as TemplateSchema), versao: r.versao } })));
      }
    } catch (err) {
      console.warn('Templates: falha ao carregar do banco (usando empacotados).', err);
    }
  };

  useEffect(() => {
    purgeDeletedLegacyReportBundles().catch((error) => console.warn('Não foi possível limpar bundles legados excluídos.', error));
    refresh();
    loadTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Worker de sincronização offline: esvazia a fila ao montar e sempre que a
  // conexão voltar; mantém o contador de pendentes atualizado.
  const sincronizar = async () => {
    setSyncing(true);
    try {
      const r = await flushOutbox();
      setOfflinePend(r.pending);
      if (r.synced > 0) refresh(); // relatórios enviados aparecem na lista
    } catch (e) {
      console.warn('Falha ao sincronizar a fila offline.', e);
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    setOnline(isOnline());
    pendingCount().then(setOfflinePend).catch(() => {});
    if (isOnline()) sincronizar();
    const onOnline = () => { setOnline(true); sincronizar(); };
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const catalog: CatalogSources = useMemo(
    () => ({
      categorias: uniq([...GRUPOS_FALHA, ...inventory.map((i) => i.category), ...services.map((s) => s.category)]),
      itens: uniq([...inventory.map((i) => i.name), ...services.map((s) => s.title)]),
      itensDetalhados: [
        ...inventory.map((i) => ({ id: i.id, label: i.name, tipo: 'material' as const, marca: i.brand, modelo: i.model, unidade: i.unit })),
        ...services.map((s) => ({ id: s.id, label: s.title, tipo: 'servico' as const, unidade: 'vb' })),
      ],
      marcas: uniqCI([...brands.map((b) => b.name), ...inventory.map((i) => i.brand || '')]),
      // Modelo do produto; quando o item não tem "modelo" preenchido (ex.: os
      // catálogos importados de Intelbras/Tecnohold), cai para o NOME — assim a
      // central/detector aparece no campo "modelo" mesmo sem coluna de modelo.
      modelos: uniqCI(inventory.map((i) => (i.model || i.name || '').trim())),
      // Agrupa modelos por marca (do estoque) para filtrar o campo modelo.
      modelosPorMarca: inventory.reduce<Record<string, string[]>>((acc, i) => {
        const marca = (i.brand || '').trim();
        const modelo = (i.model || '').trim() || (i.name || '').trim();
        if (!marca || !modelo) return acc;
        if (!acc[marca]) acc[marca] = [];
        if (!acc[marca].includes(modelo)) acc[marca].push(modelo);
        return acc;
      }, {}),
      modelosPorGrupo: {
        centrais_sdai: uniqCI(inventory.filter((i) => i.category === 'SDAI' && /central|painel/i.test(`${i.subcategory || ''} ${i.name}`)).map((i) => i.model || i.name)),
        gravadores_cftv: uniqCI(inventory.filter((i) => i.category === 'CFTV' && /gravador|nvr|dvr|nvd|mhdx|invd/i.test(`${i.subcategory || ''} ${i.name} ${i.model || ''}`)).map((i) => i.model || i.name)),
        controladoras_acesso: uniqCI(inventory.filter((i) => /controle de acesso/i.test(i.category) && /controladora|painel/i.test(`${i.subcategory || ''} ${i.name}`)).map((i) => i.model || i.name)),
        controladores_bms: uniqCI(inventory.filter((i) => i.category === 'BMS' && /controlador|clp|servidor/i.test(`${i.subcategory || ''} ${i.name}`)).map((i) => i.model || i.name)),
        centrais_alarme: uniqCI(inventory.filter((i) => i.category === 'ALARME' && /central/i.test(`${i.subcategory || ''} ${i.name}`)).map((i) => i.model || i.name)),
      },
      detalhesModelo: inventory.reduce<Record<string, { marca?: string; linha?: string; resumo?: string; tecnologias?: string[]; indicacao?: string }>>((acc, item) => {
        const model = (item.model || item.name || '').trim();
        if (model && !acc[model]) acc[model] = { marca: item.brand, linha: item.productLine, resumo: item.shortDescription || item.technicalDescription, tecnologias: item.technologies, indicacao: item.recommendedUse };
        return acc;
      }, {}),
      devices: [],
      contratos: contracts.map((c) => ({ id: c.id, label: `${c.contractType || c.unit} (${c.id})` })),
      pendenciasAprovadas: [],
      pendenciasAbertas: [],
    }),
    [inventory, services, brands, contracts]
  );

  // Contagem de pendências por relatório de origem
  const pendCountByReport = useMemo(() => {
    const m: Record<string, number> = {};
    pendencias.forEach((p) => {
      if (p.reportOrigemId) m[p.reportOrigemId] = (m[p.reportOrigemId] || 0) + 1;
    });
    return m;
  }, [pendencias]);

  // KPIs compactos da fonte canônica remota; não incluem drafts locais.
  const indB = useMemo(() => {
    const porTipo: Record<string, number> = { LEVANTAMENTO: 0, CORRETIVA: 0, PREVENTIVA: 0 };
    reports.forEach((r) => (porTipo[r.tipo] = (porTipo[r.tipo] || 0) + 1));
    const detectadas = pendencias.length;
    const convertidas = pendencias.filter((p) => p.propostaId).length;
    return { total: reports.length, porTipo, detectadas, convertidas };
  }, [reports, pendencias]);

  // ---- Lista filtrada ----
  const filtered = useMemo(() => {
    return filterReports(reports, { tipo: fTipo, status: fStatus, search }, clientName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reports, fTipo, fStatus, search, clients]);

  // ---- Wizard ----
  const openWizard = () => {
    setWTipo('');
    setWArea('');
    setAttendanceMode('NORMAL');
    setWClienteId(clients[0]?.id || '');
    setWContratoId('');
    setWOsId('');
    setWizardStep(1);
  };
  const closeWizard = () => setWizardStep(0);
  // Atalho do Dashboard: abre o wizard direto (uma ação → dentro do Novo Relatório).
  useEffect(() => {
    if (initialAction === 'wizard') {
      openWizard();
      onInitialActionConsumed?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialAction]);
  // Abre o Levantamento Técnico 3D (mesmo motor do Cliente 360) para o cliente/área.
  const launchTechnicalSurvey = async (area: TechArea, clienteId: string) => {
    if (!clienteId || !area) { showToast('Selecione o cliente e a área.'); return; }
    const clientName = clients.find((c) => c.id === clienteId)?.name || 'Cliente';
    let devices: Device[] = [];
    let catalog: TechnicalCatalogItem[] = [];
    try { [devices, catalog] = await Promise.all([fetchDevices(clienteId), fetchTechnicalCatalog().catch(() => [])]); }
    catch { /* segue com listas vazias — a Base carrega o que puder */ }
    setSurvey({ area, clienteId, clientName, devices, catalog });
    setWizardStep(0);
  };

  const startForm = (preset?: { tipo: string; area: string; clienteId: string; osId?: string; contratoId?: string }) => {
    const tipo = preset?.tipo || wTipo;
    const area = preset?.area || wArea;
    const clienteId = preset?.clienteId || wClienteId;
    // CORREÇÃO DEFINITIVA: "Levantamento Técnico" abre o motor 3D (TechnicalSurveyFlow),
    // nunca o ReportForm. O fluxo legado de relatório de levantamento foi removido.
    if (tipo === 'LEVANTAMENTO_TECNICO') {
      launchTechnicalSurvey(area as TechArea, clienteId);
      return;
    }
    const osId = preset?.osId || wOsId;
    const contratoId = preset?.contratoId || wContratoId;
    // Resolve o template pela combinação Tipo + Área.
    const loaded =
      templates.find((t) => t.schema.tipo === tipo && (t.schema.area || 'SDAI') === area) || null;
    if (!loaded) return;
    const areaTemplate = (loaded.schema.area as Device['sistema']) || 'SDAI';
    setFormTemplate(loaded.schema);
    setFormTemplateId(loaded.id);
    setFormCliente(clients.find((c) => c.id === clienteId));
    setFormContext({ osId: osId || undefined, contratoId: contratoId || undefined });
    setFormOsPendenciaIds(osId ? (ordens.find((os) => os.id === osId)?.pendenciaIds || []) : []);
    // Preventiva: carrega o inventário do cliente, garante o ciclo de amostragem
    // vigente e semeia apenas a fatia da visita (dispositivos há mais tempo sem
    // teste). Outros tipos não usam devices/ciclo.
    setFormDevices(undefined);
    setFormCiclo(undefined);
    setFormAreaDevices([]);
    // Corretiva: carrega os dispositivos da ÁREA escolhida (filtro por sistema),
    // que alimentam "dispositivos afetados". Ativos apenas.
    if (loaded.schema.tipo === 'CORRETIVA' && clienteId) {
      fetchDevices(clienteId)
        .then((ds) => setFormAreaDevices(ds.filter((d) => d.status === 'ativo' && d.sistema === areaTemplate)))
        .catch(() => setFormAreaDevices([]));
    }
    if (loaded.schema.tipo === 'PREVENTIVA' && clienteId) {
      (async () => {
        try {
          const ativos = (await fetchDevices(clienteId)).filter((d) => d.status === 'ativo');
          if (ativos.length === 0) return;
          // Periodicidade/amostragem só quando há contrato COM ciclo já definido.
          // Preventiva avulsa (sem contrato) não impõe periodicidade: lista todos
          // os dispositivos ativos, sem amostragem.
          const ciclo = contratoId ? await fetchCicloAtivo(clienteId) : null;
          if (ciclo) {
            const quota = quotaPorVisita(ciclo);
            const amostra = [...ativos]
              .sort((a, b) => (a.ultimoTesteFuncional || '').localeCompare(b.ultimoTesteFuncional || ''))
              .slice(0, quota);
            setFormCiclo(ciclo);
            setFormDevices(amostra);
          } else {
            setFormCiclo(undefined);
            setFormDevices(ativos);
          }
        } catch (e) {
          console.warn('Preventiva: falha ao carregar dispositivos.', e);
          setFormDevices(undefined);
        }
      })();
    }
    setWizardStep(0);
    setMode('form');
  };


  // Catálogo do formulário: base + pendências aprovadas do cliente escolhido
  // (para a Corretiva). Derivado sem mutar o catalog memoizado.
  //
  // Grupos de falha limitados à ÁREA do relatório (ex.: Levantamento SDAI só
  // mostra grupos "SDAI > ...", nunca CFTV/BMS/CA/Alarme). Os apontamentos e a
  // triagem de fotos passam a listar apenas a disciplina certa. As categorias
  // de estoque/serviços (genéricas, sem área) seguem disponíveis.
  const formArea = ((formTemplate?.area as AreaFalha) || 'SDAI') as AreaFalha;
  const gruposDaArea = uniq(falhasPorArea(formArea).map((f) => f.grupo));
  // Lista pré-pronta de dispositivos (preventiva): produtos do Estoque da mesma
  // disciplina do relatório, agrupados por subcategoria. Assim a preventiva SDAI
  // oferece os dispositivos SDAI cadastrados (ex.: catálogo Intelbras/Vision).
  const areaCategory = AREA_TO_CATEGORY[formArea] || '';
  const dispositivosPadrao = (() => {
    type DefaultDeviceItems = NonNullable<CatalogSources['dispositivosPadrao']>[number]['itens'];
    const grouped: Record<string, DefaultDeviceItems> = {};
    inventory
      .filter((i) => areaCategory && i.category === areaCategory)
      .forEach((i) => {
        const g = i.subcategory || 'Outros';
        if (!grouped[g]) grouped[g] = [];
        if (!grouped[g].some((item) => item.id === i.id)) {
          grouped[g].push({
            id: i.id,
            nome: i.name,
            marca: i.brand,
            modelo: i.model,
            quantidade: i.quantity,
            unidade: i.unit,
          });
        }
      });
    return Object.entries(grouped)
      .map(([grupo, itens]) => ({ grupo, itens: itens.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')) }))
      .sort((a, b) => a.grupo.localeCompare(b.grupo, 'pt-BR'));
  })();
  const formCatalog: CatalogSources = {
    ...catalog,
    marcas: manufacturersForArea(inventory, areaCategory),
    modelosPorMarca: Object.fromEntries(manufacturersForArea(inventory, areaCategory).map(brand=>[brand,centralModelsForBrand(inventory,areaCategory,brand).map(i=>i.model||i.name)])),
    modelosPorGrupo: {...catalog.modelosPorGrupo,centrais_sdai:inventory.filter(i=>i.category==='SDAI'&&/central/i.test(`${i.subcategory||''} ${i.name}`)).map(i=>i.model||i.name)},
    detalhesModelo: Object.fromEntries(inventory.map(i=>[i.model||i.name,{marca:i.brand,linha:i.productLine,resumo:i.shortDescription||i.technicalDescription,tecnologias:i.technologies,indicacao:i.recommendedUse,tipoCentral:centralType(i)}])),
    categorias: uniq([...gruposDaArea, ...inventory.map((i) => i.category), ...services.map((s) => s.category)]),
    dispositivosPadrao,
    // Dispositivos da área escolhida (Corretiva) — alimenta "dispositivos afetados".
    devices: formAreaDevices.map((d) => ({
      id: d.id,
      label: `${d.tipoDispositivo || 'Dispositivo'} · ${[d.central, d.laco, d.endereco].filter(Boolean).join('/')}`,
    })),
    pendenciasAprovadas: pendencias
      .filter((p) => formOsPendenciaIds.length ? formOsPendenciaIds.includes(p.id) : p.status === 'aprovada' && p.clienteId === formCliente?.id)
      .map((p) => ({ id: p.id, label: `${p.grupo || 'Pendência'} — ${p.descricao || ''}`.slice(0, 60) })),
  };

  // Pendências aprovadas do cliente do formulário — semeiam o checklist da Corretiva.
  const formPendAprovadas = pendencias
    .filter((p) => formOsPendenciaIds.length ? formOsPendenciaIds.includes(p.id) : p.status === 'aprovada' && p.clienteId === formCliente?.id)
    .map((p) => ({ id: p.id, descricao: p.descricao, grupo: p.grupo }));

  const clienteContratos = contracts.filter((c) => clientName(wClienteId) === c.clientName);
  const clientePendAprovadas = pendencias.filter((p) => p.status === 'aprovada' && p.clienteId === wClienteId);
  const clienteOrdensAbertas = ordens.filter(
    (o) => o.clienteId === wClienteId && ['aberta', 'agendada', 'em_execucao'].includes(o.status)
  );

  // Aba flutuante do cadastro provisório de produto (renderizada por cima do
  // formulário e do índice). Some fornecedor/custo: são preenchidos no Estoque.
  const provPanel = provProdOpen ? (
    <div className="fixed inset-0 z-[80] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface w-full max-w-md rounded-xl shadow-2xl border border-border max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-danger">inventory_2</span>
            <div>
              <h3 className="text-sm font-bold text-fg uppercase">Cadastro rápido de produto</h3>
              <p className="text-[11px] text-fg-secondary">Vai para o Estoque como pendente</p>
            </div>
          </div>
          <button onClick={() => setProvProdOpen(false)} className="text-fg-muted hover:text-fg-secondary font-bold text-lg leading-none">✕</button>
        </div>

        {ppDone ? (
          <div className="p-6 text-center">
            <span className="material-symbols-outlined text-5xl text-emerald-500">task_alt</span>
            <h4 className="text-base font-bold text-fg mt-2">Produto enviado ao Estoque</h4>
            <p className="text-xs text-fg-secondary mt-1">
              <b>{ppDone}</b> foi criado como <b>cadastro pendente</b>. Abra a aba <b>Estoque</b> quando puder para
              informar fornecedor, custo e preço de venda e finalizar o cadastro.
            </p>
            <button
              onClick={() => setProvProdOpen(false)}
              className="mt-4 px-6 py-2.5 rounded-lg bg-navy text-white text-xs font-semibold uppercase tracking-wide"
            >
              Continuar relatório
            </button>
          </div>
        ) : (
          <>
            <div className="p-4 overflow-y-auto space-y-3">
              <div>
                <label className="block text-fg-secondary mb-1 font-semibold uppercase text-[11px]">Nome do produto *</label>
                <input
                  autoFocus
                  type="text"
                  value={ppName}
                  onChange={(e) => setPpName(e.target.value)}
                  placeholder="Ex.: Detector óptico endereçável"
                  className="w-full border border-border rounded-lg p-2.5 text-fg bg-surface text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-fg-secondary mb-1 font-semibold uppercase text-[11px]">Marca</label>
                  <input
                    type="text"
                    list="prov-marcas"
                    value={ppBrand}
                    onChange={(e) => setPpBrand(e.target.value)}
                    placeholder="Ex.: Tecnohold"
                    className="w-full border border-border rounded-lg p-2.5 text-fg bg-surface text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <datalist id="prov-marcas">
                    {marcaOptions.map((m) => (
                      <option key={m} value={m} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block text-fg-secondary mb-1 font-semibold uppercase text-[11px]">Modelo</label>
                  <input
                    type="text"
                    value={ppModel}
                    onChange={(e) => setPpModel(e.target.value)}
                    placeholder="Ex.: TH-2000"
                    className="w-full border border-border rounded-lg p-2.5 text-fg bg-surface text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>
              <div>
                <label className="block text-fg-secondary mb-1 font-semibold uppercase text-[11px]">Unidade (opcional)</label>
                <input
                  type="text"
                  value={ppUnit}
                  onChange={(e) => setPpUnit(e.target.value)}
                  placeholder="Ex.: UN, PC, M"
                  className="w-full border border-border rounded-lg p-2.5 text-fg bg-surface text-xs font-data-mono focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label className="block text-fg-secondary mb-1 font-semibold uppercase text-[11px]">Observação (opcional)</label>
                <textarea
                  rows={2}
                  value={ppDesc}
                  onChange={(e) => setPpDesc(e.target.value)}
                  placeholder="Detalhe técnico que ajude a finalizar o cadastro depois…"
                  className="w-full border border-border rounded-lg p-2.5 text-fg bg-surface text-xs resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <p className="text-[10px] text-fg-secondary flex items-start gap-1 bg-amber-50 border border-amber-200 rounded-lg p-2">
                <span className="material-symbols-outlined text-sm text-amber-600">info</span>
                <span>Você não precisa do fornecedor nem do preço agora. O produto vai para o Estoque marcado como <b>pendente</b> para você finalizar com calma.</span>
              </p>
            </div>
            <div className="flex items-center justify-between p-4 border-t border-border">
              <button onClick={() => setProvProdOpen(false)} className="px-4 py-2 text-xs font-semibold text-fg-secondary hover:text-fg uppercase">
                Cancelar
              </button>
              <button
                onClick={confirmProvProduct}
                disabled={!(ppName.trim() || ppModel.trim()) || ppSaving}
                className="px-5 py-2 rounded-lg bg-danger hover:bg-danger-hover disabled:opacity-50 text-white text-xs font-semibold uppercase tracking-wide flex items-center gap-1.5"
              >
                {ppSaving && <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>}
                {ppSaving ? 'Enviando…' : 'Enviar ao Estoque'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  ) : null;

  // Janela de cadastro de MARCA (fabricante) — cadastro definitivo, com
  // categoria e vínculo opcional a um fornecedor. Evita marca solta/duplicada.
  const brandPanel = brandOpen ? (
    <div className="fixed inset-0 z-[80] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface w-full max-w-md rounded-xl shadow-2xl border border-border max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">verified</span>
            <div>
              <h3 className="text-sm font-bold text-fg uppercase">Cadastro de marca</h3>
              <p className="text-[11px] text-fg-secondary">Fabricante / marca parceira</p>
            </div>
          </div>
          <button onClick={() => setBrandOpen(false)} className="text-fg-muted hover:text-fg-secondary font-bold text-lg leading-none">✕</button>
        </div>

        {bDone ? (
          <div className="p-6 text-center">
            <span className="material-symbols-outlined text-5xl text-emerald-500">task_alt</span>
            <h4 className="text-base font-bold text-fg mt-2">Marca cadastrada</h4>
            <p className="text-xs text-fg-secondary mt-1">
              <b>{bDone}</b> está disponível no campo de fabricante. Você pode gerenciar as marcas em{' '}
              <b>Conta → Marcas Parceiras</b>.
            </p>
            <button
              onClick={() => setBrandOpen(false)}
              className="mt-4 px-6 py-2.5 rounded-lg bg-navy text-white text-xs font-semibold uppercase tracking-wide"
            >
              Continuar relatório
            </button>
          </div>
        ) : (
          <>
            <div className="p-4 overflow-y-auto space-y-3">
              <div>
                <label className="block text-fg-secondary mb-1 font-semibold uppercase text-[11px]">Nome da marca *</label>
                <input
                  autoFocus
                  type="text"
                  value={bName}
                  onChange={(e) => setBName(e.target.value)}
                  placeholder="Ex.: Tecnohold"
                  className="w-full border border-border rounded-lg p-2.5 text-fg bg-surface text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                {bName.trim() && brandJaExiste(bName) && (
                  <p className="mt-1 text-[10px] font-semibold text-amber-600 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[13px]">info</span>
                    Marca já cadastrada — será usada a existente (sem duplicar).
                  </p>
                )}
              </div>
              <div>
                <label className="block text-fg-secondary mb-1 font-semibold uppercase text-[11px]">Categoria / segmento</label>
                <input
                  type="text"
                  value={bCategoria}
                  onChange={(e) => setBCategoria(e.target.value)}
                  placeholder="Ex.: SDAI"
                  className="w-full border border-border rounded-lg p-2.5 text-fg bg-surface text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label className="block text-fg-secondary mb-1 font-semibold uppercase text-[11px]">Fornecedor (opcional)</label>
                <select
                  value={bFornecedor}
                  onChange={(e) => setBFornecedor(e.target.value)}
                  className="w-full border border-border rounded-lg p-2.5 text-fg bg-surface text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">— Sem vínculo —</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[10px] text-fg-muted">Vincular a um fornecedor deixa a marca ligada a quem você compra.</p>
              </div>

              {/* Marcas já cadastradas — permite remover marcas soltas/duplicadas */}
              {onDeletePartnerBrand && removableBrands.length > 0 && (
                <div className="pt-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-fg-muted mb-1.5">Marcas cadastradas</p>
                  <div className="max-h-40 overflow-y-auto flex flex-col gap-1 border border-border rounded-lg p-1.5">
                    {removableBrands
                      .slice()
                      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
                      .map((b) => (
                        <div key={b.id} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-md hover:bg-surface-2">
                          <span className="text-xs text-fg-secondary truncate">
                            {b.name}
                            {b.category ? <span className="text-fg-muted"> · {b.category}</span> : null}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveBrand(b.id, b.name)}
                            title="Remover marca"
                            className="shrink-0 w-7 h-7 rounded-lg inline-flex items-center justify-center text-fg-muted hover:text-danger hover:bg-red-50 transition-colors"
                          >
                            <span className="material-symbols-outlined text-base">delete</span>
                          </button>
                        </div>
                      ))}
                  </div>
                  <p className="mt-1 text-[10px] text-fg-muted">Remova aqui marcas duplicadas ou criadas por engano.</p>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between p-4 border-t border-border">
              <button onClick={() => setBrandOpen(false)} className="px-4 py-2 text-xs font-semibold text-fg-secondary hover:text-fg uppercase">
                Cancelar
              </button>
              <button
                onClick={confirmBrand}
                disabled={!bName.trim() || bSaving}
                className="px-5 py-2 rounded-lg bg-navy hover:bg-navy-3 disabled:opacity-50 text-white text-xs font-semibold uppercase tracking-wide flex items-center gap-1.5"
              >
                {bSaving && <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>}
                {bSaving ? 'Salvando…' : brandJaExiste(bName) ? 'Usar existente' : 'Cadastrar marca'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  ) : null;

  // ===== Formulário aberto =====
  if (mode === 'form' && formTemplate) {
    return (
      <>
      <ReportForm
        template={formTemplate}
        templateId={formTemplateId}
        cliente={formCliente}
        catalog={formCatalog}
        userRole={userRole}
        currentUserName={currentUserName}
        contexto={formContext}
        devices={formDevices}
        pendenciasAprovadas={formPendAprovadas}
        ciclo={formCiclo}
        fieldMode={formTemplate.tipo === 'PREVENTIVA' || formTemplate.tipo === 'LEVANTAMENTO' || (formContext.osId && formTemplate.tipo === 'CORRETIVA') ? 'rapido' : 'completo'}
        attendanceTitle={attendanceMode === 'AUDITORIA' ? 'Auditoria Técnica — SDAI' : undefined}
        onCreateCatalogo={(origem, name) => {
          // Marca nova → abre a janela de cadastro de marca (não cria nada solto).
          if (origem === 'marcas') {
            openBrand(name);
            return;
          }
          // Item/material ou modelo novo → abre o cadastro provisório de produto,
          // que persiste no Estoque como pendente para finalizar depois.
          if (origem === 'modelos' || origem === 'estoque_servicos') {
            openProvProduct(name, origem);
          }
        }}
        onBack={() => setMode('index')}
        onSaved={refresh}
        onConsumeMaterials={onConsumeMaterials}
      />
      {provPanel}
      {brandPanel}
      </>
    );
  }

  // ===== Índice =====
  return (
    <div className="flex flex-col w-full p-3 md:p-6 gap-3 md:gap-4">
      {/* Pré-visualização do PDF técnico (react-pdf) com fallback p/ impressão */}
      {reportPreview && (
        <ReportTechnicalPDFView
          report={reportPreview}
          cliente={clients.find((c) => c.id === reportPreview.clienteId)}
          companyProfile={companyProfile}
          userRole={userRole}
          onClose={() => setReportPreview(null)}
          onFallback={() => {
            const r = reportPreview;
            setReportPreview(null);
            gerarPdfExecucao(r, clientName(r.clienteId), userRole).catch((e) => {
              console.error(e);
              showToast('Falha ao gerar o PDF.');
            });
          }}
        />
      )}
      {/* Header */}
      <div className="flex flex-row items-center justify-between gap-3 border-b border-border pb-3">
        <div className="min-w-0">
          <h1 className="text-lg md:text-2xl font-bold text-fg tracking-tight truncate">
            Acompanhamento de Atendimentos
          </h1>
          <p className="mt-1 text-xs text-fg-secondary">Relatórios técnicos, levantamentos e atendimentos executados.</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Propostas comerciais são tratadas no módulo PEDIDOS. A partir de um
              levantamento, use "Gerar pedido" para levar as necessidades ao
              comercial — sem um gerador de proposta paralelo aqui. */}
          {canCreate && (
            <button
              onClick={openWizard}
              className="bg-danger hover:bg-danger-hover text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors shadow-sm flex items-center gap-1.5 uppercase tracking-wide"
            >
              <span className="material-symbols-outlined text-base">add</span> Novo relatório
            </button>
          )}
        </div>
      </div>

      {/* Fila de sincronização offline (relatórios finalizados sem conexão) */}
      {(offlinePend > 0 || !online) && (
        <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border px-4 py-3 ${offlinePend > 0 ? 'bg-amber-50 border-amber-200' : 'bg-surface-2 border-border'}`}>
          <div className="flex items-center gap-2 text-xs">
            <span className={`material-symbols-outlined text-lg ${online ? 'text-amber-600' : 'text-fg-secondary'}`}>
              {online ? 'cloud_upload' : 'cloud_off'}
            </span>
            <span className="text-fg-secondary">
              {!online && <strong className="text-fg">Sem conexão. </strong>}
              {offlinePend > 0
                ? `${offlinePend} relatório(s) aguardando envio ao servidor.`
                : 'Você está offline — relatórios finalizados ficam guardados no aparelho.'}
            </span>
          </div>
          {offlinePend > 0 && online && (
            <button
              onClick={sincronizar}
              disabled={syncing}
              className="shrink-0 px-4 py-1.5 rounded-lg bg-navy hover:bg-navy-3 text-white text-[11px] font-bold uppercase tracking-wide disabled:opacity-50"
            >
              {syncing ? 'Sincronizando…' : 'Sincronizar agora'}
            </button>
          )}
        </div>
      )}

      {/* Central de operação: o atendimento é o ponto de entrada principal em campo. */}
      <div className="flex items-center gap-1 bg-surface-3 p-1 rounded-lg border border-border w-fit">
        {(['atendimentos', 'relatorios', 'pendencias'] as const).map((b) => (
          <button
            key={b}
            onClick={() => setBoard(b)}
            className={`px-4 py-1.5 rounded-md text-xs font-semibold uppercase transition-colors ${
              board === b ? 'bg-slate-900 text-white shadow-sm' : 'text-fg-secondary hover:text-fg'
            }`}
          >
            {b === 'atendimentos' ? 'Meus atendimentos' : b === 'relatorios' ? 'Relatórios' : 'Pendências'}
          </button>
        ))}
      </div>

      {board === 'atendimentos' && (
        <div className="space-y-3">
          <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-xs text-indigo-900 flex items-center gap-2">
            <span className="material-symbols-outlined">engineering</span>
            <span><strong>Atendimento de campo.</strong> Escolha uma OS para abrir a corretiva já vinculada, sem redigitar cliente ou contexto.</span>
          </div>
          {ordens.filter((os) => ['aberta', 'agendada', 'em_execucao'].includes(os.status)).length === 0 ? (
            <EmptyState variant="relatorio" title="Nenhum atendimento aberto" description="As Ordens de Serviço abertas aparecerão aqui para início rápido." />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {ordens.filter((os) => ['aberta', 'agendada', 'em_execucao'].includes(os.status)).map((os) => {
                const cliente = clients.find((c) => c.id === os.clienteId);
                return (
                  <article key={os.id} className="rounded-xl bg-surface border border-border shadow-sm p-4 flex flex-col gap-3">
                    <div className="flex items-start gap-3">
                      {/* Interface operacional: logo real + NOME FANTASIA (§6/§11). */}
                      <ClientLogo src={clientLogoUrl(os.clienteId)} name={getClientOperationalName(cliente, 'Cliente')} sizeClass="w-11 h-11" rounded="rounded-xl" />
                      <div className="min-w-0 flex-1"><p className="font-bold text-fg truncate">{cliente ? getClientOperationalName(cliente, 'Cliente') : 'Cliente não identificado'}</p><p className="text-[11px] text-fg-secondary mt-0.5">{os.numero || os.id.slice(0, 8)} · Corretiva · {os.status.replace('_', ' ')}</p><p className="text-xs text-fg-secondary mt-1 line-clamp-2">{os.titulo || `${os.pendenciaIds.length} pendência(s) vinculada(s)`}</p></div>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] border-t border-border pt-2">
                      <span className="material-symbols-outlined text-[16px] text-fg-muted">engineering</span>
                      <span className="text-fg-secondary shrink-0">Responsável:</span>
                      {podeAtribuir ? (
                        <div className="flex-1 min-w-0">
                          <ResponsibleSelect
                            ariaLabel="Responsável técnico da OS"
                            value={os.tecnicoResponsavelId || ''}
                            onChange={(id) => setOsResponsavel(os, id)}
                            options={technicians.map((t) => ({ id: t.id, name: t.name }))}
                            triggerClassName="w-full flex items-center justify-between gap-2 border border-border rounded-lg px-2 py-1.5 text-[11px] font-semibold text-fg-secondary bg-surface"
                          />
                        </div>
                      ) : (
                        <span className="font-semibold text-fg-secondary truncate">{responsavelLabel(os)}</span>
                      )}
                    </div>
                    {/* CTA PRINCIPAL (§6/§8/§41): fluxo canônico OS → atendimento
                        operacional (ServiceAttendanceFlow). NÃO abre o relatório. */}
                    {userId ? (
                      <OsAttendanceCta
                        os={os}
                        technicianId={userId}
                        technicianName={currentUserName}
                        clients={clients}
                        usesTimeClock={usesTimeClock}
                        punches={currentUserPunches}
                      />
                    ) : null}
                    {/* Fechamento documental (pós-3B): o relatório corretivo legado
                        (FormEngine) foi REMOVIDO do fluxo de OS. O relatório da OS
                        agora é o próprio Atendimento (ServiceAttendanceFlow) e o PDF
                        sai pelo detalhe da OS. Relatórios históricos seguem na aba
                        Relatórios (§2/§46). */}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {board === 'pendencias' && (
        <PendenciasBoard
          pendencias={pendencias}
          clients={clients}
          userRole={userRole}
          onChanged={refresh}
          onCreateProposal={onNavigateToPedidos}
        />
      )}

      {board === 'relatorios' && (
      <>
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2" aria-label="Indicadores de relatórios">
        <VolCard label="Total" value={indB.total} />
        <VolCard label="Levantamentos" value={indB.porTipo.LEVANTAMENTO} />
        <VolCard label="Preventivas" value={indB.porTipo.PREVENTIVA} />
        <VolCard label="Corretivas" value={indB.porTipo.CORRETIVA} />
        <VolCard label="Pendências" value={indB.detectadas} />
        {!isTecnico && <VolCard label="Convertidas" value={indB.convertidas} />}
      </div>

      {/* Filtros */}
      <div className="flex flex-col gap-3 bg-surface p-3 rounded-xl border border-border shadow-sm">
        <div className="relative w-full">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted text-lg">search</span>
          <input
            type="text"
            placeholder="Buscar por nº, cliente ou local…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div className="grid gap-3 xl:grid-cols-2">
          <fieldset className="min-w-0">
            <legend className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-fg-secondary">Tipo</legend>
            <div className="flex gap-1.5 overflow-x-auto pb-1">
          {['TODOS', 'CORRETIVA', 'PREVENTIVA'].map((t) => (
            <button
              key={t}
              onClick={() => setFTipo(t)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold uppercase whitespace-nowrap transition-colors ${
                fTipo === t ? 'bg-slate-900 text-white' : 'bg-surface-3 text-fg-secondary hover:bg-surface-3'
              }`}
            >
              {t === 'TODOS' ? 'Todos' : TIPO_LABEL[t]}
            </button>
          ))}
            </div>
          </fieldset>
          <fieldset className="min-w-0">
            <legend className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-fg-secondary">Status</legend>
            <div className="flex gap-1.5 overflow-x-auto pb-1">
          {['TODOS', 'rascunho', 'finalizado'].map((st) => (
            <button
              key={st}
              onClick={() => setFStatus(st)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold uppercase whitespace-nowrap transition-colors ${
                fStatus === st ? 'bg-navy text-white' : 'bg-surface-3 text-fg-secondary hover:bg-surface-3'
              }`}
            >
              {st === 'TODOS' ? 'Todos' : st}
            </button>
          ))}
            </div>
          </fieldset>
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="rounded-xl border border-border bg-surface p-4 space-y-3" aria-label="Carregando relatórios" aria-busy="true">
          {[0, 1, 2].map((item) => <div key={item} className="h-12 animate-pulse rounded-lg bg-surface-3" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          variant="relatorio"
          title={(search || fTipo !== 'TODOS' || fStatus !== 'TODOS') ? 'Nenhum relatório corresponde aos filtros selecionados.' : 'Nenhum relatório finalizado ainda.'}
          description={(search || fTipo !== 'TODOS' || fStatus !== 'TODOS') ? 'Ajuste a busca ou limpe os filtros para ver outros resultados.' : 'Os relatórios aparecerão aqui após a conclusão e sincronização de um atendimento.'}
          actionLabel={(search || fTipo !== 'TODOS' || fStatus !== 'TODOS') ? 'Limpar filtros' : canCreate ? 'Novo relatório' : undefined}
          onAction={(search || fTipo !== 'TODOS' || fStatus !== 'TODOS')
            ? () => { setSearch(''); setFTipo('TODOS'); setFStatus('TODOS'); }
            : canCreate ? openWizard : undefined}
        />
      ) : (
        <>
        {/* Desktop: tabela; Mobile: cards compactos (mais intuitivo no celular) */}
        <div className="hidden md:block bg-surface rounded-xl border border-border shadow-sm overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-surface-2 text-fg-secondary font-semibold uppercase tracking-wider border-b border-border">
                <th className="py-3 px-4">Nº</th>
                <th className="py-3 px-4">Tipo</th>
                <th className="py-3 px-4">Cliente / Local</th>
                <th className="py-3 px-4">Técnico</th>
                <th className="py-3 px-4">Data</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-center">Pend.</th>
                <th className="py-3 px-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-fg-secondary font-medium">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-surface-2/80 transition-colors">
                  <td className="py-3 px-4 font-data-mono font-bold text-fg-secondary">{r.numero || shortId(r.id)}</td>
                  <td className="py-3 px-4"><span className="rounded-full bg-indigo-50 px-2 py-1 text-[10px] font-bold text-indigo-800">{TIPO_LABEL[r.tipo] || r.tipo}</span></td>
                  <td className="py-3 px-4"><p className="font-bold text-fg uppercase">{clientName(r.clienteId)}</p><p className="mt-0.5 max-w-xs truncate text-[11px] font-normal text-fg-secondary">{r.local || 'Local não informado'}</p></td>
                  <td className="py-3 px-4 text-fg-secondary">{r.tecnicoNome || '—'}</td>
                  <td className="py-3 px-4 font-data-mono text-fg-secondary">{fmtDate(r.finalizadoEm || r.iniciadoEm)}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${STATUS_COLOR[r.status] || 'bg-surface-3 text-fg-secondary'}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className={`py-3 px-4 text-center font-data-mono font-bold ${(pendCountByReport[r.id] || 0) > 0 ? 'text-danger' : 'text-fg-muted'}`}>{pendCountByReport[r.id] || 0}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => r.status === 'finalizado' ? setReportPreview(r) : openEditReport(r)} className="min-h-9 rounded-lg bg-navy px-3 text-[11px] font-bold text-white hover:bg-navy-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">Abrir</button>
                      <details className="relative">
                        <summary aria-label={`Mais ações para ${r.numero || shortId(r.id)}`} title="Mais ações" className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-lg border border-border text-fg-secondary hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"><span className="material-symbols-outlined">more_vert</span></summary>
                        <div className="absolute right-0 z-30 mt-1 w-48 rounded-lg border border-border bg-surface p-1 shadow-xl">
                          {r.status === 'finalizado' && <button onClick={() => setReportPreview(r)} className="w-full rounded-md px-3 py-2 text-left text-xs hover:bg-surface-2">Visualizar / gerar PDF</button>}
                          {surveyOrderFor(r.id) && <button onClick={onNavigateToPedidos} className="w-full rounded-md px-3 py-2 text-left text-xs hover:bg-surface-2">Abrir {surveyOrderFor(r.id)?.numeroPedido}</button>}
                          {canManage && r.tipo === 'LEVANTAMENTO' && r.status === 'finalizado' && <button onClick={() => handleCreateOrderFromSurvey(r)} disabled={creatingOrderFromReport === r.id} className="w-full rounded-md px-3 py-2 text-left text-xs hover:bg-surface-2 disabled:opacity-50">Gerar proposta</button>}
                          {canManage && <button onClick={() => openEditReport(r)} className="w-full rounded-md px-3 py-2 text-left text-xs hover:bg-surface-2">Editar dados</button>}
                          {canManage && <div className="mt-1 border-t border-border pt-1"><button onClick={() => handleDeleteReport(r)} disabled={deletingReportId === r.id} className="w-full rounded-md px-3 py-2 text-left text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">{deletingReportId === r.id ? 'Excluindo…' : 'Excluir permanentemente'}</button></div>}
                        </div>
                      </details>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile: lista de cards */}
        <div className="md:hidden flex flex-col gap-2">
          {filtered.map((r) => (
            <article key={r.id} className="bg-surface rounded-xl border border-border shadow-sm p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="font-data-mono text-[11px] font-bold text-fg-secondary">{r.numero || shortId(r.id)}</span>
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${STATUS_COLOR[r.status] || 'bg-surface-3 text-fg-secondary'}`}>
                  {r.status}
                </span>
              </div>
              <p className="mt-2 font-bold text-fg text-sm uppercase truncate">{clientName(r.clienteId)}</p>
              <p className="mt-0.5 truncate text-xs text-fg-secondary">{r.local || 'Local não informado'}</p>
              {surveyOrderFor(r.id) && <button onClick={onNavigateToPedidos} className="mt-1 rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700">Pedido: {surveyOrderFor(r.id)?.numeroPedido}</button>}
              <div className="flex items-center justify-between gap-2 mt-1.5">
                <span className="text-[11px] text-fg-secondary font-data-mono truncate">
                  {TIPO_LABEL[r.tipo] || r.tipo} · {fmtDate(r.finalizadoEm || r.iniciadoEm)}
                </span>
                <div className="flex items-center gap-3 shrink-0">
                  {(pendCountByReport[r.id] || 0) > 0 && (
                    <span className="font-data-mono text-[11px] font-bold text-danger">{pendCountByReport[r.id]} pend.</span>
                  )}
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2 border-t border-border pt-3">
                <button onClick={() => r.status === 'finalizado' ? setReportPreview(r) : openEditReport(r)} className="min-h-11 flex-1 rounded-lg bg-navy px-4 text-xs font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">Abrir</button>
                <details className="relative">
                  <summary aria-label={`Mais ações para ${r.numero || shortId(r.id)}`} className="flex min-h-11 min-w-11 cursor-pointer list-none items-center justify-center rounded-lg border border-border text-fg-secondary"><span className="material-symbols-outlined">more_vert</span></summary>
                  <div className="absolute bottom-12 right-0 z-30 w-52 rounded-lg border border-border bg-surface p-1 shadow-xl">
                    {r.status === 'finalizado' && <button onClick={() => setReportPreview(r)} className="w-full rounded-md px-3 py-2.5 text-left text-xs hover:bg-surface-2">Visualizar / gerar PDF</button>}
                    {canManage && r.tipo === 'LEVANTAMENTO' && r.status === 'finalizado' && <button onClick={() => handleCreateOrderFromSurvey(r)} className="w-full rounded-md px-3 py-2.5 text-left text-xs hover:bg-surface-2">Gerar proposta</button>}
                    {canManage && <button onClick={() => openEditReport(r)} className="w-full rounded-md px-3 py-2.5 text-left text-xs hover:bg-surface-2">Editar dados</button>}
                    {canManage && <div className="border-t border-border"><button onClick={() => handleDeleteReport(r)} disabled={deletingReportId === r.id} className="w-full rounded-md px-3 py-2.5 text-left text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">Excluir permanentemente</button></div>}
                  </div>
                </details>
              </div>
            </article>
          ))}
        </div>
        </>
      )}

      {!isSupabaseConfigured() && (
        <p className="text-[10px] text-fg-muted">Supabase não configurado: a lista fica vazia; o formulário funciona em modo protótipo.</p>
      )}
      </>
      )}

      {/* ===== Wizard "+ Novo Relatório" (3 passos) ===== */}
      {wizardStep > 0 && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface w-full max-w-lg rounded-xl shadow-2xl border border-border max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div>
                <h3 className="text-base font-bold text-fg uppercase">Novo relatório</h3>
                <p className="text-[11px] text-fg-secondary">Passo {wizardStep} de 3</p>
              </div>
              <button onClick={closeWizard} className="text-fg-muted hover:text-fg-secondary font-bold text-lg leading-none">✕</button>
            </div>

            <div className="p-5 overflow-y-auto">
              {/* Passo 1 — Tipo (cartões) + Área (chips) */}
              {wizardStep === 1 && (
                <div className="space-y-5">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-fg-secondary mb-2">1. Tipo de atendimento</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {[
                        { id: 'CORRETIVA', label: 'Manutenção Corretiva', icon: 'build' },
                        // CORREÇÃO DEFINITIVA: "Levantamento Técnico" abre o MOTOR 3D
                        // (TechnicalSurveyFlow → Base Técnica). O fluxo legado "Visita para
                        // Orçamento" (ReportForm/LEVANTAMENTO) foi REMOVIDO. Id próprio p/ não
                        // reutilizar o código legado LEVANTAMENTO (§12).
                        { id: 'LEVANTAMENTO_TECNICO', label: 'Levantamento Técnico', icon: 'lan' },
                        { id: 'PREVENTIVA', label: 'Manutenção Preventiva', icon: 'fact_check' },
                        { id: 'AUDITORIA', label: 'Auditoria Técnica', icon: 'policy' },
                      ].map((t) => {
                        const on = t.id === 'AUDITORIA' ? attendanceMode === 'AUDITORIA' : attendanceMode === 'NORMAL' && wTipo === t.id;
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => {
                              if (t.id === 'AUDITORIA') {
                                setAttendanceMode('AUDITORIA');
                                setWTipo('PREVENTIVA');
                                setWArea('SDAI');
                              } else {
                                setAttendanceMode('NORMAL');
                                setWTipo(t.id);
                              }
                            }}
                            aria-pressed={on}
                            className={`border-2 rounded-xl p-4 text-left transition-colors ${
                              on ? 'border-primary bg-navy/5' : 'border-border hover:border-primary/50'
                            }`}
                          >
                            <span className={`material-symbols-outlined text-2xl ${on ? 'text-primary' : 'text-fg-muted'}`}>{t.icon}</span>
                            <p className="font-bold text-fg text-[13px] mt-2 leading-tight">{t.label}</p>
                          </button>
                        );
                      })}
                    </div>
                    <p className="mt-2 text-[10px] text-fg-muted">
                      <b>Levantamento Técnico</b> abre a Base Técnica do cliente (motor 3D): registra ativos, infraestrutura e observações que alimentam o Cliente 360 em tempo real.
                    </p>
                  </div>

                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-fg-secondary mb-2">2. Selecione a área</p>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { id: 'SDAI', label: 'SDAI' },
                        { id: 'CFTV', label: 'CFTV' },
                        { id: 'ALARME', label: 'Alarme' },
                        { id: 'CONTROLE_ACESSO', label: 'Controle de Acesso' },
                        { id: 'BMS', label: 'BMS (Automação)' },
                      ].map((a) => {
                        const auditoriaIncompativel = attendanceMode === 'AUDITORIA' && a.id !== 'SDAI';
                        const on = wArea === a.id;
                        return (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() => !auditoriaIncompativel && setWArea(a.id)}
                            aria-pressed={on}
                            disabled={auditoriaIncompativel}
                            title={auditoriaIncompativel ? 'Checklist de auditoria ainda não disponível.' : undefined}
                            className={`px-4 py-2 rounded-full text-xs font-semibold border transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                              on ? 'bg-danger text-white border-danger shadow-sm' : 'bg-surface text-fg-secondary border-border hover:border-danger'
                            }`}
                          >
                            {a.label}
                          </button>
                        );
                      })}
                    </div>
                    {wTipo && wArea && (
                      <p className="text-[10px] text-fg-muted mt-2">
                        Selecionado: <b className="text-fg-secondary">{attendanceMode === 'AUDITORIA' ? 'Auditoria Técnica' : TIPO_LABEL[wTipo]} · {wArea === 'CONTROLE_ACESSO' ? 'Controle de Acesso' : wArea === 'BMS' ? 'BMS' : wArea === 'ALARME' ? 'Alarme' : wArea}</b>
                      </p>
                    )}
                    {attendanceMode === 'AUDITORIA' && <p className="text-[10px] text-indigo-700 mt-1">Auditoria de conformidade — ABNT NBR 17240</p>}
                  </div>
                </div>
              )}

              {/* Passo 2 — Cliente */}
              {wizardStep === 2 && (
                <div className="space-y-4">
                  <div>
                    <ClientSelector clients={clients} value={wClienteId} onChange={setWClienteId} label="Selecione um cliente existente" onCreate={() => document.getElementById('cadastro-rapido-cliente')?.scrollIntoView({ behavior: 'smooth', block: 'center' })} />
                  </div>

                  {/* Cadastro provisório em campo (§6.3 / §9.1) */}
                  <div id="cadastro-rapido-cliente" className="border border-amber-200 bg-amber-50/60 rounded-xl p-3.5 space-y-3">
                    <p className="text-[11px] font-bold text-amber-900 uppercase flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-base text-amber-600">person_add</span>
                      Cliente não encontrado? Cadastre em campo (Provisório)
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Nome / Razão Social"
                        value={provNome}
                        onChange={(e) => setProvNome(e.target.value)}
                        className="bg-surface border border-amber-200 rounded p-2 text-xs text-fg"
                      />
                      <input
                        type="text"
                        placeholder="CNPJ (00.000.000/0000-00)"
                        value={provCnpj}
                        onChange={(e) => {
                          setProvCnpj(e.target.value);
                          setProvCnpjErr('');
                        }}
                        className="bg-surface border border-amber-200 rounded p-2 text-xs font-data-mono text-fg"
                      />
                    </div>
                    {provCnpjErr && (
                      <p className="text-[10px] font-bold text-red-600 flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs">error</span> {provCnpjErr}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={handleCreateProvisionalClient}
                      className="w-full py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold uppercase tracking-wider transition-colors shadow-xs"
                    >
                      Cadastrar Cliente Provisório em Campo
                    </button>
                    <p className="text-[10px] text-amber-700 leading-relaxed">
                      O cadastro nasce com <code>pendente_validacao = true</code>. Permite emitir o relatório imediatamente em campo, mas exige homologação do administrativo antes da proposta.
                    </p>
                  </div>
                </div>
              )}


              {/* Passo 3 — Contexto */}
              {wizardStep === 3 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-fg-secondary mb-1 font-semibold uppercase text-[11px]">Contrato (opcional)</label>
                    <select
                      value={wContratoId}
                      onChange={(e) => setWContratoId(e.target.value)}
                      className="w-full border border-border rounded-lg p-2.5 text-fg bg-surface text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="">— Sem vínculo —</option>
                      {clienteContratos.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.contractType || c.unit} ({c.id})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-fg-secondary mb-1 font-semibold uppercase text-[11px]">OS vinculada (opcional)</label>
                    {clienteOrdensAbertas.length > 0 ? (
                      <select
                        value={wOsId}
                        onChange={(e) => setWOsId(e.target.value)}
                        className="w-full border border-border rounded-lg p-2.5 text-fg bg-surface text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                      >
                        <option value="">Sem OS — abrir avulso</option>
                        {clienteOrdensAbertas.map((os) => (
                          <option key={os.id} value={os.id}>
                            {os.numero || os.id.slice(0, 8)} — {os.titulo || `${os.pendenciaIds.length} pendência(s)`} ({os.status})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="w-full border border-dashed border-border rounded-lg p-2.5 text-[11px] text-fg-muted italic">
                        Nenhuma OS aberta para este cliente. Gere uma no quadro de pendências.
                      </div>
                    )}
                  </div>
                  {wTipo === 'CORRETIVA' && (
                    <div className="border border-border rounded-lg p-3 bg-surface-2/50">
                      <p className="text-[11px] font-bold text-fg-secondary uppercase mb-1">Pendências aprovadas (viram checklist)</p>
                      {clientePendAprovadas.length === 0 ? (
                        <p className="text-[10px] text-fg-muted italic">Nenhuma pendência aprovada — a corretiva abre em branco.</p>
                      ) : (
                        <ul className="space-y-1 max-h-32 overflow-y-auto">
                          {clientePendAprovadas.map((p) => (
                            <li key={p.id} className="text-[10px] text-fg-secondary">• {p.grupo ? `${p.grupo}: ` : ''}{p.descricao}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Rodapé do wizard */}
            <div className="flex items-center justify-between p-4 border-t border-border">
              <button
                onClick={() => (wizardStep > 1 ? setWizardStep((wizardStep - 1) as 1 | 2) : closeWizard())}
                className="px-4 py-2 text-xs font-semibold text-fg-secondary hover:text-fg uppercase"
              >
                {wizardStep > 1 ? 'Voltar' : 'Cancelar'}
              </button>
              {wizardStep === 1 && (
                <button
                  onClick={() => setWizardStep(2)}
                  disabled={!wTipo || !wArea}
                  className="px-5 py-2 rounded-lg bg-navy hover:bg-navy-3 disabled:opacity-50 text-white text-xs font-semibold uppercase tracking-wide"
                >
                  Próximo
                </button>
              )}
              {wizardStep === 2 && (
                <button
                  onClick={() => setWizardStep(3)}
                  disabled={!wClienteId}
                  className="px-5 py-2 rounded-lg bg-navy hover:bg-navy-3 disabled:opacity-50 text-white text-xs font-semibold uppercase tracking-wide"
                >
                  Próximo
                </button>
              )}
              {wizardStep === 3 && (
                <button
                  onClick={() => startForm()}
                  className="px-5 py-2 rounded-lg bg-danger hover:bg-danger-hover text-white text-xs font-semibold uppercase tracking-wide"
                >
                  Iniciar atendimento
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== Levantamento Técnico (motor 3D) — mesmo componente do Cliente 360 ===== */}
      {survey && (
        <TechnicalSurveyFlow
          area={survey.area}
          clienteId={survey.clienteId}
          clientName={survey.clientName}
          existingDevices={survey.devices}
          userRole={userRole}
          catalog={survey.catalog}
          onClose={() => setSurvey(null)}
          onChanged={() => { if (isSupabaseConfigured()) fetchDevices(survey.clienteId).then((d) => setSurvey((s) => (s ? { ...s, devices: d } : s))).catch(() => {}); }}
        />
      )}

      {/* ===== Editar dados do relatório ===== */}
      {editRep && (
        <div className="fixed inset-0 z-[80] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface w-full max-w-md rounded-xl shadow-2xl border border-border max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">edit_document</span>
                <div>
                  <h3 className="text-sm font-bold text-fg uppercase">Editar relatório</h3>
                  <p className="text-[11px] text-fg-secondary font-data-mono">{editRep.numero || shortId(editRep.id)}</p>
                </div>
              </div>
              <button onClick={() => setEditRep(null)} className="text-fg-muted hover:text-fg-secondary font-bold text-lg leading-none">✕</button>
            </div>
            <div className="p-4 overflow-y-auto space-y-3">
              <div>
                <label className="block text-fg-secondary mb-1 font-semibold uppercase text-[11px]">Título</label>
                <input
                  type="text"
                  value={erTitulo}
                  onChange={(e) => setErTitulo(e.target.value)}
                  className="w-full border border-border rounded-lg p-2.5 text-fg bg-surface text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label className="block text-fg-secondary mb-1 font-semibold uppercase text-[11px]">Local</label>
                <input
                  type="text"
                  value={erLocal}
                  onChange={(e) => setErLocal(e.target.value)}
                  className="w-full border border-border rounded-lg p-2.5 text-fg bg-surface text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label className="block text-fg-secondary mb-1 font-semibold uppercase text-[11px]">Técnico responsável</label>
                <input
                  type="text"
                  value={erTecnico}
                  onChange={(e) => setErTecnico(e.target.value)}
                  className="w-full border border-border rounded-lg p-2.5 text-fg bg-surface text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label className="block text-fg-secondary mb-1 font-semibold uppercase text-[11px]">Status</label>
                <select
                  value={erStatus}
                  onChange={(e) => setErStatus(e.target.value as ReportInstance['status'])}
                  className="w-full border border-border rounded-lg p-2.5 text-fg bg-surface text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="rascunho">Rascunho</option>
                  <option value="finalizado">Finalizado</option>
                  <option value="cancelado">Cancelado</option>
                </select>
              </div>
              <p className="text-[10px] text-fg-secondary flex items-start gap-1 bg-surface-2 border border-border rounded-lg p-2">
                <span className="material-symbols-outlined text-sm text-fg-muted">info</span>
                <span>Aqui você ajusta os dados do relatório. As respostas e fotos de campo não são reabertas por esta tela.</span>
              </p>
            </div>
            <div className="flex items-center justify-between p-4 border-t border-border">
              <button onClick={() => setEditRep(null)} className="px-4 py-2 text-xs font-semibold text-fg-secondary hover:text-fg uppercase">
                Cancelar
              </button>
              <button
                onClick={saveEditReport}
                disabled={erSaving}
                className="px-5 py-2 rounded-lg bg-navy hover:bg-navy-3 disabled:opacity-50 text-white text-xs font-semibold uppercase tracking-wide flex items-center gap-1.5"
              >
                {erSaving && <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>}
                {erSaving ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {provPanel}
      {brandPanel}
    </div>
  );
};

/* --------------------------- subcomponentes --------------------------- */

const VolCard: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className="bg-surface border border-border rounded-lg px-3 py-2 shadow-sm">
    <p className="font-data-mono text-lg font-bold text-fg leading-none">{value}</p>
    <p className="text-[9px] text-fg-secondary uppercase tracking-wider mt-0.5">{label}</p>
  </div>
);
