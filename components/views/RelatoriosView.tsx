'use client';

import React, { useEffect, useMemo, useState } from 'react';
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
} from '@/lib/types';
import { ALL_TEMPLATES, seedReportTemplates } from '@/lib/reportTemplatesData';
import { TemplateSchema } from '@/lib/reportSchema';
import { CatalogSources } from '@/components/reports/FormEngine';
import { ReportForm } from '@/components/reports/ReportForm';
import { isSupabaseConfigured } from '@/lib/inventory';
import { fetchReports, updateReport, deleteReport } from '@/lib/reports';
import { fetchPendencias } from '@/lib/pendencias';
import { fetchDevices } from '@/lib/devices';
import { fetchOrdensServico } from '@/lib/ordensServico';
import { fetchCicloAtivo, quotaPorVisita } from '@/lib/ciclos';
import { flushOutbox, pendingCount, isOnline } from '@/lib/offline/reportSync';
import { EmptyState } from '@/components/EmptyState';
import { GRUPOS_FALHA, falhasPorArea, AreaFalha } from '@/lib/catalogoFalhas';
import { fetchTemplates } from '@/lib/reportTemplates';
import { gerarPdfExecucao } from '@/lib/reportPdf';
import { ReportTechnicalPDFView } from '@/components/documentos/ReportTechnicalPDFView';
import { NovaProposta } from '@/components/reports/NovaProposta';
import { PendenciasBoard } from '@/components/reports/PendenciasBoard';

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
    stockManaged: true,
    salePrice: 0,
    costPrice: undefined,
    pendenteValidacao: true,
  };
}
const olderThan15d = (iso?: string) => !!iso && Date.now() - new Date(iso).getTime() > 15 * 864e5;
const shortId = (id: string) => `#${id.slice(0, 8)}`;
const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '—');

const STATUS_COLOR: Record<string, string> = {
  rascunho: 'bg-slate-100 text-slate-700',
  finalizado: 'bg-emerald-100 text-emerald-800',
  cancelado: 'bg-red-100 text-red-700',
};
const TIPO_LABEL: Record<string, string> = {
  LEVANTAMENTO: 'Levantamento',
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
  onAddClient,
  onAddBrand,
  onAddInventoryItem,
  suppliers = [],
  onUpdateSupplier,
  onDeletePartnerBrand,
  onConsumeMaterials,
}) => {
  const isTecnico = userRole === 'TECNICO';
  const isFinanceiro = userRole === 'FINANCEIRO';
  const canCreate = !isFinanceiro; // §6.1 RBAC: criar relatório — admin/gestor/técnico
  const canManage = userRole === 'ADMINISTRATIVO' || userRole === 'GESTOR'; // editar/excluir relatório

  const [mode, setMode] = useState<'index' | 'form'>('index');
  const [board, setBoard] = useState<'relatorios' | 'pendencias'>('relatorios');
  // Pré-visualização do PDF técnico (react-pdf). Fallback = método HTML antigo.
  const [reportPreview, setReportPreview] = useState<ReportInstance | null>(null);
  const [showProposta, setShowProposta] = useState(false);
  const [reports, setReports] = useState<ReportInstance[]>([]);
  const [pendencias, setPendencias] = useState<Pendencia[]>([]);
  const [ordens, setOrdens] = useState<OrdemServico[]>([]);
  const [loading, setLoading] = useState(false);
  // Templates: "template é dado, não código" — carregados do banco, com
  // fallback aos empacotados e seed automático (admin) na primeira vez.
  const [templates, setTemplates] = useState<LoadedTemplate[]>(ALL_TEMPLATES.map((s) => ({ schema: s })));

  // Filtros da lista
  const [fTipo, setFTipo] = useState<string>('TODOS');
  const [fStatus, setFStatus] = useState<string>('TODOS');
  const [search, setSearch] = useState('');

  // Wizard "+ Novo relatório"
  const [wizardStep, setWizardStep] = useState<0 | 1 | 2 | 3>(0);
  const [wTipo, setWTipo] = useState<string>(''); // LEVANTAMENTO | CORRETIVA | PREVENTIVA
  const [wArea, setWArea] = useState<string>(''); // disciplina (SDAI, CFTV, ...)
  const [wClienteId, setWClienteId] = useState<string>('');
  const [wContratoId, setWContratoId] = useState<string>('');
  const [wOsId, setWOsId] = useState<string>('');

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
    alert(`Cliente provisório "${nome}" cadastrado com sucesso! Selecionado para este relatório.`);
  };

  // Config do formulário aberto
  const [formTemplate, setFormTemplate] = useState<TemplateSchema | null>(null);
  const [formTemplateId, setFormTemplateId] = useState<string | undefined>(undefined);
  const [formCliente, setFormCliente] = useState<Client | undefined>(undefined);
  const [formContext, setFormContext] = useState<{ osId?: string; contratoId?: string }>({});
  const [formDevices, setFormDevices] = useState<Device[] | undefined>(undefined);
  const [formCiclo, setFormCiclo] = useState<CicloAmostragem | undefined>(undefined);
  const [formAreaDevices, setFormAreaDevices] = useState<Device[]>([]); // corretiva: dispositivos da área
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
      alert('Não foi possível enviar o produto ao Estoque. Tente novamente.');
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
  const handleRemoveBrand = (id: string, nome: string) => {
    if (!onDeletePartnerBrand) return;
    if (!window.confirm(`Remover a marca "${nome}" do catálogo?`)) return;
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
      alert('Não foi possível salvar as alterações do relatório.');
    } finally {
      setErSaving(false);
    }
  };

  const handleDeleteReport = async (r: ReportInstance) => {
    if (!window.confirm(`Excluir o relatório ${r.numero || shortId(r.id)}?\n\nEsta ação não pode ser desfeita.`)) return;
    try {
      if (isSupabaseConfigured()) await deleteReport(r.id);
      setReports((prev) => prev.filter((x) => x.id !== r.id));
    } catch (e) {
      console.error('Falha ao excluir relatório:', e);
      alert('Não foi possível excluir o relatório. Tente novamente.');
    }
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
      alert('Não foi possível cadastrar a marca. Tente novamente.');
    } finally {
      setBSaving(false);
    }
  };

  const clientName = (id?: string) => clients.find((c) => c.id === id)?.name || '—';

  const refresh = () => {
    if (!isSupabaseConfigured()) return;
    setLoading(true);
    Promise.all([fetchReports(), fetchPendencias(userRole), fetchOrdensServico()])
      .then(([rs, ps, os]) => {
        setReports(rs);
        setPendencias(ps);
        setOrdens(os);
      })
      .catch((err) => console.warn('Relatórios: falha ao carregar.', err))
      .finally(() => setLoading(false));
    pendingCount().then(setOfflinePend).catch(() => {});
  };

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
        setTemplates(rows.map((r) => ({ id: r.id, schema: r.schema as TemplateSchema })));
      }
    } catch (err) {
      console.warn('Templates: falha ao carregar do banco (usando empacotados).', err);
    }
  };

  useEffect(() => {
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

  // ---- Indicadores Bloco A (ação necessária) ----
  const indA = useMemo(() => {
    const rascunhos = reports.filter((r) => r.status === 'rascunho').length;
    const pendAbertas15 = pendencias.filter((p) => p.status === 'aberta' && !p.propostaId && olderThan15d(p.criadaEm)).length;
    const pendAprovadasSemExec = pendencias.filter((p) => p.status === 'aprovada' && !p.reportExecucaoId).length;
    const provisorios = clients.filter((c) => c.pendenteValidacao).length;
    return { rascunhos, pendAbertas15, pendAprovadasSemExec, provisorios };
  }, [reports, pendencias, clients]);

  // ---- Indicadores Bloco B (volume do mês) — oculto para técnico ----
  const indB = useMemo(() => {
    const now = new Date();
    const noMes = reports.filter((r) => {
      const d = r.finalizadoEm || r.iniciadoEm;
      if (!d) return false;
      const dt = new Date(d);
      return dt.getFullYear() === now.getFullYear() && dt.getMonth() === now.getMonth();
    });
    const porTipo: Record<string, number> = { LEVANTAMENTO: 0, CORRETIVA: 0, PREVENTIVA: 0 };
    noMes.forEach((r) => (porTipo[r.tipo] = (porTipo[r.tipo] || 0) + 1));
    const detectadas = pendencias.length;
    const convertidas = pendencias.filter((p) => p.propostaId).length;
    return { totalMes: noMes.length, porTipo, detectadas, convertidas };
  }, [reports, pendencias]);

  // ---- Lista filtrada ----
  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return reports
      .filter((r) => (fTipo === 'TODOS' ? true : r.tipo === fTipo))
      .filter((r) => (fStatus === 'TODOS' ? true : r.status === fStatus))
      .filter((r) => {
        if (!s) return true;
        return (
          r.id.toLowerCase().includes(s) ||
          clientName(r.clienteId).toLowerCase().includes(s) ||
          (r.local || '').toLowerCase().includes(s)
        );
      })
      .sort((a, b) => {
        if (a.status === 'rascunho' && b.status !== 'rascunho') return -1;
        if (b.status === 'rascunho' && a.status !== 'rascunho') return 1;
        const da = new Date(a.finalizadoEm || a.iniciadoEm || 0).getTime();
        const db = new Date(b.finalizadoEm || b.iniciadoEm || 0).getTime();
        return db - da;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reports, fTipo, fStatus, search, clients]);

  // ---- Wizard ----
  const openWizard = () => {
    setWTipo('');
    setWArea('');
    setWClienteId(clients[0]?.id || '');
    setWContratoId('');
    setWOsId('');
    setWizardStep(1);
  };
  const closeWizard = () => setWizardStep(0);

  const startForm = () => {
    // Resolve o template pela combinação Tipo + Área.
    const loaded =
      templates.find((t) => t.schema.tipo === wTipo && (t.schema.area || 'SDAI') === wArea) || null;
    if (!loaded) return;
    const areaTemplate = (loaded.schema.area as Device['sistema']) || 'SDAI';
    setFormTemplate(loaded.schema);
    setFormTemplateId(loaded.id);
    setFormCliente(clients.find((c) => c.id === wClienteId));
    setFormContext({ osId: wOsId || undefined, contratoId: wContratoId || undefined });
    // Preventiva: carrega o inventário do cliente, garante o ciclo de amostragem
    // vigente e semeia apenas a fatia da visita (dispositivos há mais tempo sem
    // teste). Outros tipos não usam devices/ciclo.
    setFormDevices(undefined);
    setFormCiclo(undefined);
    setFormAreaDevices([]);
    // Corretiva: carrega os dispositivos da ÁREA escolhida (filtro por sistema),
    // que alimentam "dispositivos afetados". Ativos apenas.
    if (loaded.schema.tipo === 'CORRETIVA' && wClienteId) {
      fetchDevices(wClienteId)
        .then((ds) => setFormAreaDevices(ds.filter((d) => d.status === 'ativo' && d.sistema === areaTemplate)))
        .catch(() => setFormAreaDevices([]));
    }
    if (loaded.schema.tipo === 'PREVENTIVA' && wClienteId) {
      (async () => {
        try {
          const ativos = (await fetchDevices(wClienteId)).filter((d) => d.status === 'ativo');
          if (ativos.length === 0) return;
          // Periodicidade/amostragem só quando há contrato COM ciclo já definido.
          // Preventiva avulsa (sem contrato) não impõe periodicidade: lista todos
          // os dispositivos ativos, sem amostragem.
          const ciclo = wContratoId ? await fetchCicloAtivo(wClienteId) : null;
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
    categorias: uniq([...gruposDaArea, ...inventory.map((i) => i.category), ...services.map((s) => s.category)]),
    dispositivosPadrao,
    // Dispositivos da área escolhida (Corretiva) — alimenta "dispositivos afetados".
    devices: formAreaDevices.map((d) => ({
      id: d.id,
      label: `${d.tipoDispositivo || 'Dispositivo'} · ${[d.central, d.laco, d.endereco].filter(Boolean).join('/')}`,
    })),
    pendenciasAprovadas: pendencias
      .filter((p) => p.status === 'aprovada' && p.clienteId === formCliente?.id)
      .map((p) => ({ id: p.id, label: `${p.grupo || 'Pendência'} — ${p.descricao || ''}`.slice(0, 60) })),
  };

  // Pendências aprovadas do cliente do formulário — semeiam o checklist da Corretiva.
  const formPendAprovadas = pendencias
    .filter((p) => p.status === 'aprovada' && p.clienteId === formCliente?.id)
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
      <div className="bg-white w-full max-w-md rounded-xl shadow-2xl border border-slate-200 max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#E63946]">inventory_2</span>
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase">Cadastro rápido de produto</h3>
              <p className="text-[11px] text-slate-500">Vai para o Estoque como pendente</p>
            </div>
          </div>
          <button onClick={() => setProvProdOpen(false)} className="text-slate-400 hover:text-slate-700 font-bold text-lg leading-none">✕</button>
        </div>

        {ppDone ? (
          <div className="p-6 text-center">
            <span className="material-symbols-outlined text-5xl text-emerald-500">task_alt</span>
            <h4 className="text-base font-bold text-slate-900 mt-2">Produto enviado ao Estoque</h4>
            <p className="text-xs text-slate-500 mt-1">
              <b>{ppDone}</b> foi criado como <b>cadastro pendente</b>. Abra a aba <b>Estoque</b> quando puder para
              informar fornecedor, custo e preço de venda e finalizar o cadastro.
            </p>
            <button
              onClick={() => setProvProdOpen(false)}
              className="mt-4 px-6 py-2.5 rounded-lg bg-[#1A1A72] text-white text-xs font-semibold uppercase tracking-wide"
            >
              Continuar relatório
            </button>
          </div>
        ) : (
          <>
            <div className="p-4 overflow-y-auto space-y-3">
              <div>
                <label className="block text-slate-600 mb-1 font-semibold uppercase text-[11px]">Nome do produto *</label>
                <input
                  autoFocus
                  type="text"
                  value={ppName}
                  onChange={(e) => setPpName(e.target.value)}
                  placeholder="Ex.: Detector óptico endereçável"
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-slate-900 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-[#1A1A72]/20"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 mb-1 font-semibold uppercase text-[11px]">Marca</label>
                  <input
                    type="text"
                    list="prov-marcas"
                    value={ppBrand}
                    onChange={(e) => setPpBrand(e.target.value)}
                    placeholder="Ex.: Tecnohold"
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-slate-900 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-[#1A1A72]/20"
                  />
                  <datalist id="prov-marcas">
                    {marcaOptions.map((m) => (
                      <option key={m} value={m} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block text-slate-600 mb-1 font-semibold uppercase text-[11px]">Modelo</label>
                  <input
                    type="text"
                    value={ppModel}
                    onChange={(e) => setPpModel(e.target.value)}
                    placeholder="Ex.: TH-2000"
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-slate-900 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-[#1A1A72]/20"
                  />
                </div>
              </div>
              <div>
                <label className="block text-slate-600 mb-1 font-semibold uppercase text-[11px]">Unidade (opcional)</label>
                <input
                  type="text"
                  value={ppUnit}
                  onChange={(e) => setPpUnit(e.target.value)}
                  placeholder="Ex.: UN, PC, M"
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-slate-900 bg-white text-xs font-data-mono focus:outline-none focus:ring-2 focus:ring-[#1A1A72]/20"
                />
              </div>
              <div>
                <label className="block text-slate-600 mb-1 font-semibold uppercase text-[11px]">Observação (opcional)</label>
                <textarea
                  rows={2}
                  value={ppDesc}
                  onChange={(e) => setPpDesc(e.target.value)}
                  placeholder="Detalhe técnico que ajude a finalizar o cadastro depois…"
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-slate-900 bg-white text-xs resize-none focus:outline-none focus:ring-2 focus:ring-[#1A1A72]/20"
                />
              </div>
              <p className="text-[10px] text-slate-500 flex items-start gap-1 bg-amber-50 border border-amber-200 rounded-lg p-2">
                <span className="material-symbols-outlined text-sm text-amber-600">info</span>
                <span>Você não precisa do fornecedor nem do preço agora. O produto vai para o Estoque marcado como <b>pendente</b> para você finalizar com calma.</span>
              </p>
            </div>
            <div className="flex items-center justify-between p-4 border-t border-slate-100">
              <button onClick={() => setProvProdOpen(false)} className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 uppercase">
                Cancelar
              </button>
              <button
                onClick={confirmProvProduct}
                disabled={!(ppName.trim() || ppModel.trim()) || ppSaving}
                className="px-5 py-2 rounded-lg bg-[#E63946] hover:bg-[#a51515] disabled:opacity-50 text-white text-xs font-semibold uppercase tracking-wide flex items-center gap-1.5"
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
      <div className="bg-white w-full max-w-md rounded-xl shadow-2xl border border-slate-200 max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#1A1A72]">verified</span>
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase">Cadastro de marca</h3>
              <p className="text-[11px] text-slate-500">Fabricante / marca parceira</p>
            </div>
          </div>
          <button onClick={() => setBrandOpen(false)} className="text-slate-400 hover:text-slate-700 font-bold text-lg leading-none">✕</button>
        </div>

        {bDone ? (
          <div className="p-6 text-center">
            <span className="material-symbols-outlined text-5xl text-emerald-500">task_alt</span>
            <h4 className="text-base font-bold text-slate-900 mt-2">Marca cadastrada</h4>
            <p className="text-xs text-slate-500 mt-1">
              <b>{bDone}</b> está disponível no campo de fabricante. Você pode gerenciar as marcas em{' '}
              <b>Conta → Marcas Parceiras</b>.
            </p>
            <button
              onClick={() => setBrandOpen(false)}
              className="mt-4 px-6 py-2.5 rounded-lg bg-[#1A1A72] text-white text-xs font-semibold uppercase tracking-wide"
            >
              Continuar relatório
            </button>
          </div>
        ) : (
          <>
            <div className="p-4 overflow-y-auto space-y-3">
              <div>
                <label className="block text-slate-600 mb-1 font-semibold uppercase text-[11px]">Nome da marca *</label>
                <input
                  autoFocus
                  type="text"
                  value={bName}
                  onChange={(e) => setBName(e.target.value)}
                  placeholder="Ex.: Tecnohold"
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-slate-900 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-[#1A1A72]/20"
                />
                {bName.trim() && brandJaExiste(bName) && (
                  <p className="mt-1 text-[10px] font-semibold text-amber-600 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[13px]">info</span>
                    Marca já cadastrada — será usada a existente (sem duplicar).
                  </p>
                )}
              </div>
              <div>
                <label className="block text-slate-600 mb-1 font-semibold uppercase text-[11px]">Categoria / segmento</label>
                <input
                  type="text"
                  value={bCategoria}
                  onChange={(e) => setBCategoria(e.target.value)}
                  placeholder="Ex.: SDAI"
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-slate-900 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-[#1A1A72]/20"
                />
              </div>
              <div>
                <label className="block text-slate-600 mb-1 font-semibold uppercase text-[11px]">Fornecedor (opcional)</label>
                <select
                  value={bFornecedor}
                  onChange={(e) => setBFornecedor(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-slate-900 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-[#1A1A72]/20"
                >
                  <option value="">— Sem vínculo —</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[10px] text-slate-400">Vincular a um fornecedor deixa a marca ligada a quem você compra.</p>
              </div>

              {/* Marcas já cadastradas — permite remover marcas soltas/duplicadas */}
              {onDeletePartnerBrand && removableBrands.length > 0 && (
                <div className="pt-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Marcas cadastradas</p>
                  <div className="max-h-40 overflow-y-auto flex flex-col gap-1 border border-slate-100 rounded-lg p-1.5">
                    {removableBrands
                      .slice()
                      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
                      .map((b) => (
                        <div key={b.id} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-md hover:bg-slate-50">
                          <span className="text-xs text-slate-700 truncate">
                            {b.name}
                            {b.category ? <span className="text-slate-400"> · {b.category}</span> : null}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveBrand(b.id, b.name)}
                            title="Remover marca"
                            className="shrink-0 w-7 h-7 rounded-lg inline-flex items-center justify-center text-slate-400 hover:text-[#E63946] hover:bg-red-50 transition-colors"
                          >
                            <span className="material-symbols-outlined text-base">delete</span>
                          </button>
                        </div>
                      ))}
                  </div>
                  <p className="mt-1 text-[10px] text-slate-400">Remova aqui marcas duplicadas ou criadas por engano.</p>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between p-4 border-t border-slate-100">
              <button onClick={() => setBrandOpen(false)} className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 uppercase">
                Cancelar
              </button>
              <button
                onClick={confirmBrand}
                disabled={!bName.trim() || bSaving}
                className="px-5 py-2 rounded-lg bg-[#1A1A72] hover:bg-[#12124f] disabled:opacity-50 text-white text-xs font-semibold uppercase tracking-wide flex items-center gap-1.5"
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
              alert('Falha ao gerar o PDF.');
            });
          }}
        />
      )}
      {/* Header */}
      <div className="flex flex-row items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="min-w-0">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Relatórios de Campo — SDAI</span>
          <h1 className="text-lg md:text-2xl font-bold text-slate-900 tracking-tight truncate">
            {isTecnico ? 'Meu trabalho pendente' : 'Acompanhamento de Relatórios'}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {/* Proposta: comercial (admin/gestor/financeiro), nunca técnico (§3 RBAC) */}
          {!isTecnico && (
            <button
              onClick={() => setShowProposta(true)}
              className="border border-[#1A1A72] text-[#1A1A72] hover:bg-[#1A1A72] hover:text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5 uppercase tracking-wide"
            >
              <span className="material-symbols-outlined text-base">request_quote</span> Nova proposta
            </button>
          )}
          {canCreate && (
            <button
              onClick={openWizard}
              className="bg-[#E63946] hover:bg-[#a51515] text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors shadow-sm flex items-center gap-1.5 uppercase tracking-wide"
            >
              <span className="material-symbols-outlined text-base">add</span> Novo relatório
            </button>
          )}
        </div>
      </div>

      {/* Fila de sincronização offline (relatórios finalizados sem conexão) */}
      {(offlinePend > 0 || !online) && (
        <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border px-4 py-3 ${offlinePend > 0 ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
          <div className="flex items-center gap-2 text-xs">
            <span className={`material-symbols-outlined text-lg ${online ? 'text-amber-600' : 'text-slate-500'}`}>
              {online ? 'cloud_upload' : 'cloud_off'}
            </span>
            <span className="text-slate-700">
              {!online && <strong className="text-slate-900">Sem conexão. </strong>}
              {offlinePend > 0
                ? `${offlinePend} relatório(s) aguardando envio ao servidor.`
                : 'Você está offline — relatórios finalizados ficam guardados no aparelho.'}
            </span>
          </div>
          {offlinePend > 0 && online && (
            <button
              onClick={sincronizar}
              disabled={syncing}
              className="shrink-0 px-4 py-1.5 rounded-lg bg-[#1A1A72] hover:bg-[#12124f] text-white text-[11px] font-bold uppercase tracking-wide disabled:opacity-50"
            >
              {syncing ? 'Sincronizando…' : 'Sincronizar agora'}
            </button>
          )}
        </div>
      )}

      <NovaProposta
        open={showProposta}
        onClose={() => setShowProposta(false)}
        clients={clients}
        inventory={inventory}
        services={services}
        pendencias={pendencias}
        onGenerated={refresh}
      />

      {/* Alternância Relatórios / Pendências */}
      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 w-fit">
        {(['relatorios', 'pendencias'] as const).map((b) => (
          <button
            key={b}
            onClick={() => setBoard(b)}
            className={`px-4 py-1.5 rounded-md text-xs font-semibold uppercase transition-colors ${
              board === b ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {b === 'relatorios' ? 'Relatórios' : 'Pendências'}
          </button>
        ))}
      </div>

      {board === 'pendencias' && (
        <PendenciasBoard pendencias={pendencias} clients={clients} userRole={userRole} onChanged={refresh} />
      )}

      {board === 'relatorios' && (
      <>
      {/* Bloco A — Ação necessária (chips clicáveis) */}
      <div className="flex gap-3 overflow-x-auto pb-1">
        <IndChip label="Rascunhos" value={indA.rascunhos} tone="slate" onClick={() => setFStatus('rascunho')} />
        {!isTecnico && (
          <>
            <IndChip label="Pendências >15 dias" value={indA.pendAbertas15} tone="red" />
            <IndChip label="Aprovadas sem execução" value={indA.pendAprovadasSemExec} tone="amber" />
            <IndChip label="Cadastros provisórios" value={indA.provisorios} tone="brand" />
          </>
        )}
      </div>

      {/* Bloco B — Volume do mês (oculto para técnico) */}
      {!isTecnico && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <VolCard label="Relatórios no mês" value={indB.totalMes} />
          <VolCard label="Levantamentos" value={indB.porTipo.LEVANTAMENTO} />
          <VolCard label="Corretivas" value={indB.porTipo.CORRETIVA} />
          <VolCard label="Preventivas" value={indB.porTipo.PREVENTIVA} />
          <VolCard label="Pendências detectadas" value={indB.detectadas} />
          <VolCard label="Convertidas em proposta" value={indB.convertidas} />
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative w-full sm:w-72">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
          <input
            type="text"
            placeholder="Buscar por nº, cliente ou local…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A1A72]/20"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto">
          {['TODOS', 'LEVANTAMENTO', 'CORRETIVA', 'PREVENTIVA'].map((t) => (
            <button
              key={t}
              onClick={() => setFTipo(t)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold uppercase whitespace-nowrap transition-colors ${
                fTipo === t ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {t === 'TODOS' ? 'Todos' : TIPO_LABEL[t]}
            </button>
          ))}
          {['TODOS', 'rascunho', 'finalizado'].map((st) => (
            <button
              key={st}
              onClick={() => setFStatus(st)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold uppercase whitespace-nowrap transition-colors ${
                fStatus === st ? 'bg-[#1A1A72] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st === 'TODOS' ? 'Status' : st}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="bg-white rounded-xl shadow-sm py-16 text-center text-slate-400 text-sm">Carregando relatórios…</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          variant="relatorio"
          title="Nenhum relatório"
          description={canCreate ? 'Abra um novo relatório de campo para começar.' : 'Sem relatórios para exibir com os filtros atuais.'}
          actionLabel={canCreate ? 'Novo relatório' : undefined}
          onAction={canCreate ? openWizard : undefined}
        />
      ) : (
        <>
        {/* Desktop: tabela; Mobile: cards compactos (mais intuitivo no celular) */}
        <div className="hidden md:block bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-200">
                <th className="py-3 px-4">Nº</th>
                <th className="py-3 px-4">Tipo</th>
                <th className="py-3 px-4">Cliente</th>
                {!isTecnico && <th className="py-3 px-4">Técnico</th>}
                <th className="py-3 px-4">Data</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-center">Pend.</th>
                <th className="py-3 px-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4 font-data-mono font-bold text-slate-500">{r.numero || shortId(r.id)}</td>
                  <td className="py-3 px-4">{TIPO_LABEL[r.tipo] || r.tipo}</td>
                  <td className="py-3 px-4 font-bold text-slate-900 uppercase">{clientName(r.clienteId)}</td>
                  {!isTecnico && <td className="py-3 px-4 text-slate-500">{r.tecnicoNome || '—'}</td>}
                  <td className="py-3 px-4 font-data-mono text-slate-500">{fmtDate(r.finalizadoEm || r.iniciadoEm)}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${STATUS_COLOR[r.status] || 'bg-slate-100 text-slate-700'}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center font-data-mono font-bold text-[#E63946]">{pendCountByReport[r.id] || 0}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-center gap-1">
                      {r.status === 'finalizado' && (
                        <button
                          onClick={() => setReportPreview(r)}
                          title="Gerar PDF do relatório"
                          className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-slate-400 hover:text-[#E63946] hover:bg-red-50 transition-colors"
                        >
                          <span className="material-symbols-outlined text-lg">picture_as_pdf</span>
                        </button>
                      )}
                      {canManage && (
                        <>
                          <button
                            onClick={() => openEditReport(r)}
                            title="Editar dados do relatório"
                            className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-slate-400 hover:text-[#1A1A72] hover:bg-slate-100 transition-colors"
                          >
                            <span className="material-symbols-outlined text-lg">edit</span>
                          </button>
                          <button
                            onClick={() => handleDeleteReport(r)}
                            title="Excluir relatório"
                            className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-slate-400 hover:text-[#E63946] hover:bg-red-50 transition-colors"
                          >
                            <span className="material-symbols-outlined text-lg">delete</span>
                          </button>
                        </>
                      )}
                      {r.status !== 'finalizado' && !canManage && <span className="text-slate-300">—</span>}
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
            <div key={r.id} className="bg-white rounded-lg border border-slate-200 shadow-sm p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-data-mono text-[11px] font-bold text-slate-500">{r.numero || shortId(r.id)}</span>
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${STATUS_COLOR[r.status] || 'bg-slate-100 text-slate-700'}`}>
                  {r.status}
                </span>
              </div>
              <p className="font-bold text-slate-900 text-sm uppercase truncate mt-1">{clientName(r.clienteId)}</p>
              <div className="flex items-center justify-between gap-2 mt-1.5">
                <span className="text-[11px] text-slate-500 font-data-mono truncate">
                  {TIPO_LABEL[r.tipo] || r.tipo} · {fmtDate(r.finalizadoEm || r.iniciadoEm)}
                </span>
                <div className="flex items-center gap-3 shrink-0">
                  {(pendCountByReport[r.id] || 0) > 0 && (
                    <span className="font-data-mono text-[11px] font-bold text-[#E63946]">{pendCountByReport[r.id]} pend.</span>
                  )}
                  {r.status === 'finalizado' && (
                    <button
                      onClick={() => setReportPreview(r)}
                      title="Gerar PDF do relatório"
                      className="w-8 h-8 -my-1 rounded-lg inline-flex items-center justify-center text-slate-400 hover:text-[#E63946] hover:bg-red-50 transition-colors"
                    >
                      <span className="material-symbols-outlined text-lg">picture_as_pdf</span>
                    </button>
                  )}
                  {canManage && (
                    <>
                      <button
                        onClick={() => openEditReport(r)}
                        title="Editar dados do relatório"
                        className="w-8 h-8 -my-1 rounded-lg inline-flex items-center justify-center text-slate-400 hover:text-[#1A1A72] hover:bg-slate-100 transition-colors"
                      >
                        <span className="material-symbols-outlined text-lg">edit</span>
                      </button>
                      <button
                        onClick={() => handleDeleteReport(r)}
                        title="Excluir relatório"
                        className="w-8 h-8 -my-1 rounded-lg inline-flex items-center justify-center text-slate-400 hover:text-[#E63946] hover:bg-red-50 transition-colors"
                      >
                        <span className="material-symbols-outlined text-lg">delete</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
        </>
      )}

      {!isSupabaseConfigured() && (
        <p className="text-[10px] text-slate-400">Supabase não configurado: a lista fica vazia; o formulário funciona em modo protótipo.</p>
      )}
      </>
      )}

      {/* ===== Wizard "+ Novo relatório" (3 passos) ===== */}
      {wizardStep > 0 && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-xl shadow-2xl border border-slate-200 max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900 uppercase">Novo relatório</h3>
                <p className="text-[11px] text-slate-500">Passo {wizardStep} de 3</p>
              </div>
              <button onClick={closeWizard} className="text-slate-400 hover:text-slate-700 font-bold text-lg leading-none">✕</button>
            </div>

            <div className="p-5 overflow-y-auto">
              {/* Passo 1 — Tipo (cartões) + Área (chips) */}
              {wizardStep === 1 && (
                <div className="space-y-5">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">1. Tipo de relatório</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {[
                        { id: 'CORRETIVA', label: 'Manutenção Corretiva', icon: 'build' },
                        { id: 'LEVANTAMENTO', label: 'Levantamento (Orçamento)', icon: 'search' },
                        { id: 'PREVENTIVA', label: 'Manutenção Preventiva', icon: 'fact_check' },
                      ].map((t) => {
                        const on = wTipo === t.id;
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setWTipo(t.id)}
                            aria-pressed={on}
                            className={`border-2 rounded-xl p-4 text-left transition-colors ${
                              on ? 'border-[#1A1A72] bg-[#1A1A72]/5' : 'border-slate-200 hover:border-[#1A1A72]/50'
                            }`}
                          >
                            <span className={`material-symbols-outlined text-2xl ${on ? 'text-[#1A1A72]' : 'text-slate-400'}`}>{t.icon}</span>
                            <p className="font-bold text-slate-900 text-[13px] mt-2 leading-tight">{t.label}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">2. Selecione a área</p>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { id: 'SDAI', label: 'SDAI' },
                        { id: 'CFTV', label: 'CFTV' },
                        { id: 'ALARME', label: 'Alarme' },
                        { id: 'CONTROLE_ACESSO', label: 'Controle de Acesso' },
                        { id: 'BMS', label: 'BMS (Automação)' },
                      ].map((a) => {
                        const on = wArea === a.id;
                        return (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() => setWArea(a.id)}
                            aria-pressed={on}
                            className={`px-4 py-2 rounded-full text-xs font-semibold border transition-colors ${
                              on ? 'bg-[#E63946] text-white border-[#E63946] shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:border-[#E63946]'
                            }`}
                          >
                            {a.label}
                          </button>
                        );
                      })}
                    </div>
                    {wTipo && wArea && (
                      <p className="text-[10px] text-slate-400 mt-2">
                        Selecionado: <b className="text-slate-600">{TIPO_LABEL[wTipo]} · {wArea === 'CONTROLE_ACESSO' ? 'Controle de Acesso' : wArea === 'BMS' ? 'BMS' : wArea === 'ALARME' ? 'Alarme' : wArea}</b>
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Passo 2 — Cliente */}
              {wizardStep === 2 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-slate-600 mb-1 font-semibold uppercase text-[11px]">Selecione um cliente existente</label>
                    <select
                      value={wClienteId}
                      onChange={(e) => setWClienteId(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg p-2.5 text-slate-900 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-[#1A1A72]/20"
                    >
                      {clients.length === 0 && <option value="">Nenhum cliente</option>}
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.cnpj ? `(${c.cnpj})` : ''}
                          {c.pendenteValidacao ? ' [PROVISÓRIO]' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Cadastro provisório em campo (§6.3 / §9.1) */}
                  <div className="border border-amber-200 bg-amber-50/60 rounded-xl p-3.5 space-y-3">
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
                        className="bg-white border border-amber-200 rounded p-2 text-xs text-slate-800"
                      />
                      <input
                        type="text"
                        placeholder="CNPJ (00.000.000/0000-00)"
                        value={provCnpj}
                        onChange={(e) => {
                          setProvCnpj(e.target.value);
                          setProvCnpjErr('');
                        }}
                        className="bg-white border border-amber-200 rounded p-2 text-xs font-data-mono text-slate-800"
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
                    <label className="block text-slate-600 mb-1 font-semibold uppercase text-[11px]">Contrato (opcional)</label>
                    <select
                      value={wContratoId}
                      onChange={(e) => setWContratoId(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg p-2.5 text-slate-900 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-[#1A1A72]/20"
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
                    <label className="block text-slate-600 mb-1 font-semibold uppercase text-[11px]">OS vinculada (opcional)</label>
                    {clienteOrdensAbertas.length > 0 ? (
                      <select
                        value={wOsId}
                        onChange={(e) => setWOsId(e.target.value)}
                        className="w-full border border-slate-200 rounded-lg p-2.5 text-slate-900 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-[#1A1A72]/20"
                      >
                        <option value="">Sem OS — abrir avulso</option>
                        {clienteOrdensAbertas.map((os) => (
                          <option key={os.id} value={os.id}>
                            {os.numero || os.id.slice(0, 8)} — {os.titulo || `${os.pendenciaIds.length} pendência(s)`} ({os.status})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="w-full border border-dashed border-slate-200 rounded-lg p-2.5 text-[11px] text-slate-400 italic">
                        Nenhuma OS aberta para este cliente. Gere uma no quadro de pendências.
                      </div>
                    )}
                  </div>
                  {wTipo === 'CORRETIVA' && (
                    <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/50">
                      <p className="text-[11px] font-bold text-slate-700 uppercase mb-1">Pendências aprovadas (viram checklist)</p>
                      {clientePendAprovadas.length === 0 ? (
                        <p className="text-[10px] text-slate-400 italic">Nenhuma pendência aprovada — a corretiva abre em branco.</p>
                      ) : (
                        <ul className="space-y-1 max-h-32 overflow-y-auto">
                          {clientePendAprovadas.map((p) => (
                            <li key={p.id} className="text-[10px] text-slate-600">• {p.grupo ? `${p.grupo}: ` : ''}{p.descricao}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Rodapé do wizard */}
            <div className="flex items-center justify-between p-4 border-t border-slate-100">
              <button
                onClick={() => (wizardStep > 1 ? setWizardStep((wizardStep - 1) as 1 | 2) : closeWizard())}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 uppercase"
              >
                {wizardStep > 1 ? 'Voltar' : 'Cancelar'}
              </button>
              {wizardStep === 1 && (
                <button
                  onClick={() => setWizardStep(2)}
                  disabled={!wTipo || !wArea}
                  className="px-5 py-2 rounded-lg bg-[#1A1A72] hover:bg-[#12124f] disabled:opacity-50 text-white text-xs font-semibold uppercase tracking-wide"
                >
                  Próximo
                </button>
              )}
              {wizardStep === 2 && (
                <button
                  onClick={() => setWizardStep(3)}
                  disabled={!wClienteId}
                  className="px-5 py-2 rounded-lg bg-[#1A1A72] hover:bg-[#12124f] disabled:opacity-50 text-white text-xs font-semibold uppercase tracking-wide"
                >
                  Próximo
                </button>
              )}
              {wizardStep === 3 && (
                <button
                  onClick={startForm}
                  className="px-5 py-2 rounded-lg bg-[#E63946] hover:bg-[#a51515] text-white text-xs font-semibold uppercase tracking-wide"
                >
                  Iniciar relatório
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== Editar dados do relatório ===== */}
      {editRep && (
        <div className="fixed inset-0 z-[80] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-xl shadow-2xl border border-slate-200 max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#1A1A72]">edit_document</span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 uppercase">Editar relatório</h3>
                  <p className="text-[11px] text-slate-500 font-data-mono">{editRep.numero || shortId(editRep.id)}</p>
                </div>
              </div>
              <button onClick={() => setEditRep(null)} className="text-slate-400 hover:text-slate-700 font-bold text-lg leading-none">✕</button>
            </div>
            <div className="p-4 overflow-y-auto space-y-3">
              <div>
                <label className="block text-slate-600 mb-1 font-semibold uppercase text-[11px]">Título</label>
                <input
                  type="text"
                  value={erTitulo}
                  onChange={(e) => setErTitulo(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-slate-900 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-[#1A1A72]/20"
                />
              </div>
              <div>
                <label className="block text-slate-600 mb-1 font-semibold uppercase text-[11px]">Local</label>
                <input
                  type="text"
                  value={erLocal}
                  onChange={(e) => setErLocal(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-slate-900 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-[#1A1A72]/20"
                />
              </div>
              <div>
                <label className="block text-slate-600 mb-1 font-semibold uppercase text-[11px]">Técnico responsável</label>
                <input
                  type="text"
                  value={erTecnico}
                  onChange={(e) => setErTecnico(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-slate-900 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-[#1A1A72]/20"
                />
              </div>
              <div>
                <label className="block text-slate-600 mb-1 font-semibold uppercase text-[11px]">Status</label>
                <select
                  value={erStatus}
                  onChange={(e) => setErStatus(e.target.value as ReportInstance['status'])}
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-slate-900 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-[#1A1A72]/20"
                >
                  <option value="rascunho">Rascunho</option>
                  <option value="finalizado">Finalizado</option>
                  <option value="cancelado">Cancelado</option>
                </select>
              </div>
              <p className="text-[10px] text-slate-500 flex items-start gap-1 bg-slate-50 border border-slate-200 rounded-lg p-2">
                <span className="material-symbols-outlined text-sm text-slate-400">info</span>
                <span>Aqui você ajusta os dados do relatório. As respostas e fotos de campo não são reabertas por esta tela.</span>
              </p>
            </div>
            <div className="flex items-center justify-between p-4 border-t border-slate-100">
              <button onClick={() => setEditRep(null)} className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 uppercase">
                Cancelar
              </button>
              <button
                onClick={saveEditReport}
                disabled={erSaving}
                className="px-5 py-2 rounded-lg bg-[#1A1A72] hover:bg-[#12124f] disabled:opacity-50 text-white text-xs font-semibold uppercase tracking-wide flex items-center gap-1.5"
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

const IndChip: React.FC<{ label: string; value: number; tone: 'slate' | 'red' | 'amber' | 'brand'; onClick?: () => void }> = ({ label, value, tone, onClick }) => {
  const toneCls =
    tone === 'red' ? 'text-[#E63946]' : tone === 'amber' ? 'text-amber-600' : tone === 'brand' ? 'text-[#1A1A72]' : 'text-slate-900';
  return (
    <button
      onClick={onClick}
      className={`shrink-0 bg-white border border-slate-200 rounded-lg px-3 py-2 text-left shadow-sm ${onClick ? 'hover:border-slate-300' : 'cursor-default'}`}
    >
      <p className={`font-data-mono text-lg font-bold leading-none ${toneCls}`}>{value}</p>
      <p className="text-[9px] text-slate-500 uppercase tracking-wider whitespace-nowrap mt-0.5">{label}</p>
    </button>
  );
};

const VolCard: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-sm">
    <p className="font-data-mono text-lg font-bold text-slate-900 leading-none">{value}</p>
    <p className="text-[9px] text-slate-500 uppercase tracking-wider mt-0.5">{label}</p>
  </div>
);
