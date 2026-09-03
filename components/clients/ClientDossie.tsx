'use client';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Client,
  OrdemServico,
  Pedido,
  Contract,
  FinancialTransaction,
  InventoryItem,
  PartnerBrand,
  Supplier,
  UserRole,
  ReportInstance,
  Pendencia,
  ClientEvent,
  Device,
  TabPath,
} from '@/lib/types';
import { Badge } from '@/components/DataListRow';
import { EmptyState } from '@/components/EmptyState';
import { usePrivacy } from '@/lib/privacy';
import { showToast, requestConfirm } from '@/components/ui/Feedback';
import { isSupabaseConfigured } from '@/lib/inventory';
import { fetchReports } from '@/lib/reports';
import { fetchPendencias } from '@/lib/pendencias';
import { fetchDevices } from '@/lib/devices';
import { fetchClientEvents, insertClientEvent } from '@/lib/clientEvents';
import { fetchAssignableTechnicians, ManagedUser } from '@/lib/users';
import { OS_STATUS_ATIVOS } from '@/lib/ordensServico';
import {
  GalleryPhoto,
  FieldPhotoFilters,
  listRemoteFieldPhotos,
  applyFieldPhotoFilters,
  sortByCapturadoDesc,
} from '@/lib/fieldPhotosGallery';
import { signedFieldPhotoUrls } from '@/lib/fieldPhotoStorage';
import { nomeFantasiaCliente } from '@/lib/utils';
import { DevicesManager } from '@/components/reports/DevicesManager';

/* ==========================================================================
 * CLIENT 360 — Dossiê operacional do cliente (página cheia).
 * Consolida, em abas com carregamento sob demanda, tudo que a operação precisa
 * ver de UM cliente: visão geral, OS, relatórios, pendências, fotos de campo,
 * dispositivos instalados, contratos e histórico. Reaproveita as MESMAS fontes
 * de dados canônicas do sistema (nada de mocks nem segunda fonte de verdade) e
 * respeita RBAC/RLS — todas as queries passam pela sessão autenticada.
 * ========================================================================== */

type DossieTab =
  | 'overview'
  | 'os'
  | 'relatorios'
  | 'pendencias'
  | 'fotos'
  | 'dispositivos'
  | 'contratos'
  | 'historico';

interface ClientDossieProps {
  client: Client;
  contracts: Contract[];
  pedidos: Pedido[];
  ordensServico: OrdemServico[];
  transactions: FinancialTransaction[];
  inventory: InventoryItem[];
  suppliers: Supplier[];
  fabricantes: PartnerBrand[];
  onAddFabricante: (name: string) => void;
  onClose: () => void;
  onEditClient?: (c: Client) => void;
  onDeleteClient: (client: Client) => Promise<void>;
  onOpenReport: (name: string) => void;
  onNavigateToTab: (tab: TabPath) => void;
  userRole: UserRole;
}

const brl = (n: number) => `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
const norm = (s: string) => (s || '').trim().toLowerCase();
const razaoSocialCliente = (name: string) => name.replace(/\s*\([^)]*\)\s*$/, '').trim();

const OS_STATUS_UI: Record<OrdemServico['status'], { label: string; color: 'emerald' | 'amber' | 'blue' | 'red' | 'slate' }> = {
  aberta: { label: 'Aberta', color: 'amber' },
  agendada: { label: 'Agendada', color: 'blue' },
  em_execucao: { label: 'Em execução', color: 'amber' },
  concluida: { label: 'Concluída', color: 'emerald' },
  cancelada: { label: 'Cancelada', color: 'red' },
};

const OS_TIPO_LABEL: Record<OrdemServico['tipo'], string> = {
  corretiva: 'Corretiva',
  preventiva: 'Preventiva',
  instalacao: 'Instalação',
  outro: 'Outro',
};

const PROPOSAL_ACEITO: Pedido['status'][] = ['aceito'];
const PROPOSAL_ABERTO: Pedido['status'][] = ['rascunho', 'em_revisao', 'aprovado_interno', 'enviado_ao_cliente', 'visualizado_cliente', 'em_negociacao'];

const REPORT_STATUS_COLOR: Record<string, 'emerald' | 'amber' | 'blue' | 'red' | 'slate'> = {
  finalizado: 'emerald',
  em_execucao: 'amber',
  aguardando_assinatura: 'blue',
  rascunho: 'slate',
  cancelado: 'red',
};

const PEND_STATUS_COLOR: Record<string, 'emerald' | 'amber' | 'blue' | 'red' | 'slate'> = {
  aberta: 'amber',
  orcada: 'blue',
  aprovada: 'blue',
  em_execucao: 'amber',
  corrigida: 'emerald',
  cancelada: 'red',
  recusada_cliente: 'red',
};

const DEVICE_STATUS_COLOR: Record<Device['status'], 'emerald' | 'amber' | 'red' | 'slate'> = {
  ativo: 'emerald',
  inativo: 'slate',
  substituido: 'amber',
  removido: 'red',
};

// Status de pendência considerados "em aberto" (ainda no lifecycle, não encerrados).
const PEND_ABERTAS = (p: Pendencia) => !['corrigida', 'cancelada', 'recusada_cliente'].includes(String(p.status));

const toTime = (value?: string) => {
  if (!value) return 0;
  const parsed = Date.parse(value);
  if (!Number.isNaN(parsed)) return parsed;
  const br = value.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return br ? new Date(Number(br[3]), Number(br[2]) - 1, Number(br[1])).getTime() : 0;
};

const fmtDate = (value?: string) => {
  if (!value) return '—';
  const t = toTime(value);
  if (!t) return value;
  return new Date(t).toLocaleDateString('pt-BR');
};

export const ClientDossie: React.FC<ClientDossieProps> = ({
  client,
  contracts,
  pedidos,
  ordensServico,
  transactions,
  inventory,
  suppliers,
  fabricantes,
  onAddFabricante,
  onClose,
  onEditClient,
  onDeleteClient,
  onOpenReport,
  onNavigateToTab,
  userRole,
}) => {
  const { maskMoney } = usePrivacy();
  const brlM = (n: number) => maskMoney(brl(n));
  const [tab, setTab] = useState<DossieTab>('overview');

  // ------- Dados vindos das props (já em memória, sem nova query) -------
  const clientContracts = useMemo(
    () => contracts.filter((c) => norm(c.clientName) === norm(client.name)),
    [contracts, client.name]
  );
  const clientPedidos = useMemo(
    () => pedidos.filter((p) => p.clienteId === client.id || norm(p.clienteNome) === norm(client.name)),
    [pedidos, client.id, client.name]
  );
  const clientOS = useMemo(
    () => ordensServico.filter((o) => o.clienteId === client.id),
    [ordensServico, client.id]
  );
  const clientReceitas = useMemo(
    () => transactions.filter((t) => t.type === 'RECEITA' && norm(t.clientOrVendor) === norm(client.name)),
    [transactions, client.name]
  );

  // ------- Dados carregados sob demanda (por cliente, RLS-safe) -------
  const [reports, setReports] = useState<ReportInstance[] | null>(null);
  const [pendencias, setPendencias] = useState<Pendencia[] | null>(null);
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [events, setEvents] = useState<ClientEvent[] | null>(null);
  const [photos, setPhotos] = useState<GalleryPhoto[] | null>(null);
  const [photosLoading, setPhotosLoading] = useState(false);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [techs, setTechs] = useState<ManagedUser[]>([]);
  const [showDevicesManager, setShowDevicesManager] = useState(false);

  // Carga leve inicial: relatórios, pendências, dispositivos e eventos são
  // queries filtradas por cliente no servidor (baratas) e alimentam a Visão Geral.
  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setReports([]); setPendencias([]); setDevices([]); setEvents([]);
      return;
    }
    let alive = true;
    Promise.all([
      fetchReports({ clienteId: client.id }).catch(() => [] as ReportInstance[]),
      fetchPendencias(userRole, { clienteId: client.id }).catch(() => [] as Pendencia[]),
      fetchDevices(client.id).catch(() => [] as Device[]),
      fetchClientEvents(client.id).catch(() => [] as ClientEvent[]),
    ]).then(([r, p, d, e]) => {
      if (!alive) return;
      setReports(r); setPendencias(p); setDevices(d); setEvents(e);
    });
    return () => { alive = false; };
  }, [client.id, userRole]);

  // Técnicos: só para resolver o responsável da OS (perfis gestores).
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let alive = true;
    fetchAssignableTechnicians().then((list) => { if (alive) setTechs(list); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  const techName = (id?: string) => (id ? techs.find((t) => t.id === id)?.name || 'Responsável atribuído' : 'Não atribuído');

  // Fotos: carregamento tardio (a listagem remota é global e só é filtrada por
  // cliente no cliente). Dispara ao abrir a aba Fotos ou o card de fotos.
  const loadPhotos = React.useCallback(() => {
    if (photos !== null || photosLoading || !isSupabaseConfigured()) return;
    setPhotosLoading(true);
    listRemoteFieldPhotos()
      .then((all) => {
        const mine = sortByCapturadoDesc(applyFieldPhotoFilters(all, { clientId: client.id }));
        setPhotos(mine);
      })
      .catch(() => setPhotos([]))
      .finally(() => setPhotosLoading(false));
  }, [photos, photosLoading, client.id]);

  // Miniaturas assinadas para as fotos já carregadas (bucket privado).
  useEffect(() => {
    if (!photos || photos.length === 0) return;
    const paths = photos
      .map((p) => p.storagePathEvidencia || p.storagePathOriginal)
      .filter(Boolean) as string[];
    if (paths.length === 0) return;
    let alive = true;
    signedFieldPhotoUrls(paths).then((signed) => {
      if (!alive) return;
      const map: Record<string, string> = {};
      for (const p of photos) {
        const path = p.storagePathEvidencia || p.storagePathOriginal;
        if (path && signed[path]) map[p.id] = signed[path];
      }
      setThumbs(map);
    }).catch(() => {});
    return () => { alive = false; };
  }, [photos]);

  const goTab = (t: DossieTab) => {
    setTab(t);
    if (t === 'fotos') loadPhotos();
  };

  // ------- Derivados -------
  const osAbertas = clientOS.filter((o) => o.status === 'aberta');
  const osExecucao = clientOS.filter((o) => o.status === 'em_execucao');
  const osAtivas = clientOS.filter((o) => OS_STATUS_ATIVOS.includes(o.status));
  const osConcluidas = clientOS.filter((o) => o.status === 'concluida');
  const contratosAtivos = clientContracts.filter((c) => c.status === 'ATIVO');
  const pendAbertas = (pendencias || []).filter(PEND_ABERTAS);
  const propostasAbertas = clientPedidos.filter((p) => PROPOSAL_ABERTO.includes(p.status));
  const propostasAceitas = clientPedidos.filter((p) => PROPOSAL_ACEITO.includes(p.status));

  const mrr = clientContracts.reduce((acc, c) => acc + (c.monthlyValue || 0), 0);
  const totalRecebido = clientReceitas.filter((t) => t.status === 'CONFIRMADO').reduce((acc, t) => acc + t.amount, 0);
  const volumeAberto = propostasAbertas.reduce((acc, p) => acc + (p.proposal?.valorTotal || 0), 0);

  // Timeline consolidada (histórico) — eventos reais já existentes.
  const timeline = useMemo(() => {
    const entries: { id: string; date?: string; type: string; icon: string; title: string; detail: string; tone: string }[] = [
      ...clientPedidos.map((p) => ({ id: `ped-${p.id}`, date: p.dataEmissao, type: 'Proposta', icon: 'description', title: p.numeroPedido, detail: `${p.referencia || 'Proposta'} · ${p.status}`, tone: 'text-[#1A1A72] bg-[#1A1A72]/10' })),
      ...clientContracts.map((c) => ({ id: `contract-${c.id}`, date: c.startDate || c.renewalDate, type: 'Contrato', icon: 'handshake', title: c.contractType || c.id, detail: `${c.status} · renovação ${c.renewalDate || 'não informada'}`, tone: 'text-emerald-700 bg-emerald-50' })),
      ...clientOS.map((o) => ({ id: `os-${o.id}`, date: o.dataConclusao || o.dataPrevista || o.dataAbertura, type: 'OS', icon: 'engineering', title: o.numero || o.titulo || o.id, detail: `${OS_STATUS_UI[o.status].label}${o.titulo ? ` · ${o.titulo}` : ''}`, tone: 'text-amber-700 bg-amber-50' })),
      ...(reports || []).map((r) => ({ id: `report-${r.id}`, date: r.finalizadoEm || r.iniciadoEm, type: 'Relatório', icon: 'assignment', title: r.numero || r.titulo || r.tipo, detail: `${r.tipo} · ${r.status}`, tone: 'text-violet-700 bg-violet-50' })),
      ...(pendencias || []).map((p) => ({ id: `pend-${p.id}`, date: p.criadaEm || p.resolvidaEm, type: 'Pendência', icon: 'flag', title: p.descricao || p.grupo || 'Pendência técnica', detail: String(p.status), tone: 'text-rose-700 bg-rose-50' })),
      ...clientReceitas.map((t) => ({ id: `income-${t.id}`, date: t.date, type: 'Receita', icon: 'payments', title: t.description || t.id, detail: `${brlM(t.amount)} · ${t.status}`, tone: 'text-emerald-700 bg-emerald-50' })),
      ...(events || []).map((ev) => ({ id: `event-${ev.id}`, date: ev.createdAt, type: ev.type === 'contato' ? 'Contato' : ev.type === 'negociacao' ? 'Negociação' : ev.type === 'visita' ? 'Visita' : 'Nota', icon: ev.type === 'contato' ? 'phone_in_talk' : ev.type === 'visita' ? 'location_on' : 'sticky_note_2', title: ev.content, detail: ev.authorName ? `Registrado por ${ev.authorName}` : 'Registro manual', tone: 'text-sky-700 bg-sky-50' })),
    ];
    return entries.sort((a, b) => toTime(b.date) - toTime(a.date));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientPedidos, clientContracts, clientOS, clientReceitas, reports, pendencias, events]);

  const hasLinkedHistory =
    clientContracts.length > 0 || clientPedidos.length > 0 || clientOS.length > 0 ||
    (reports?.length || 0) > 0 || (pendencias?.length || 0) > 0 || (devices?.length || 0) > 0;

  const handleDelete = async () => {
    if (hasLinkedHistory) {
      showToast('Este cliente possui histórico vinculado. Para preservar contratos, propostas, OS, relatórios, pendências e dispositivos, a exclusão não é permitida.');
      return;
    }
    if (!await requestConfirm(`Excluir o cliente "${client.name}"? Esta ação não pode ser desfeita.`)) return;
    await onDeleteClient(client);
    onClose();
  };

  const statusTone =
    client.contractStatus === 'EM DIA' ? 'text-emerald-600' :
    client.contractStatus === 'PENDENTE' ? 'text-amber-600' : 'text-red-600';

  const cidade = (client.address || '').split(/[-–]/).pop()?.trim() || client.address || '';

  const TABS: { id: DossieTab; label: string; icon: string; badge?: number }[] = [
    { id: 'overview', label: 'Visão Geral', icon: 'dashboard' },
    { id: 'os', label: 'OS', icon: 'engineering', badge: osAtivas.length || undefined },
    { id: 'relatorios', label: 'Relatórios', icon: 'assignment', badge: reports?.length || undefined },
    { id: 'pendencias', label: 'Pendências', icon: 'flag', badge: pendAbertas.length || undefined },
    { id: 'fotos', label: 'Fotos', icon: 'photo_library', badge: photos?.length || undefined },
    { id: 'dispositivos', label: 'Dispositivos', icon: 'memory', badge: devices?.length || undefined },
    { id: 'contratos', label: 'Contratos', icon: 'handshake', badge: contratosAtivos.length || undefined },
    { id: 'historico', label: 'Histórico', icon: 'history' },
  ];

  return (
    // In-flow dentro do container do CRM (o <main> já compensa a sidebar via
    // padding). Nada de fixed/100vw/margin-left aqui: largura = 100% do container,
    // min-w-0 permite o conteúdo encolher junto com a abertura/recolhimento da
    // sidebar sem estourar o viewport.
    <div className="flex min-h-[calc(100vh-56px)] w-full min-w-0 flex-col bg-slate-50">
      {/* ============================ Cabeçalho do cliente ============================ */}
      {/* Sticky logo abaixo do header fixo do app. O top casa com a altura do
          .fireowl-header (3.5rem + safe-area em telas com notch). z abaixo da
          sidebar (z-50) e do header (z-40) para nunca sobrepô-los. */}
      <header className="sticky z-30 border-b border-slate-200 bg-white" style={{ top: 'calc(3.5rem + env(safe-area-inset-top))' }}>
        <div className="flex flex-wrap items-start gap-x-3 gap-y-3 px-4 py-3 md:px-8 md:py-4">
          <button
            onClick={onClose}
            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            title="Voltar ao diretório de clientes"
            aria-label="Voltar"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div className="min-w-0 flex-1 basis-64">
            <span className="font-data-mono text-xs font-bold text-[#E63946]">{client.code}</span>
            <h1 className="mt-0.5 truncate text-lg font-bold uppercase tracking-tight text-slate-900 md:text-2xl">
              {nomeFantasiaCliente(client.name)}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 md:text-xs">
              {razaoSocialCliente(client.name) !== nomeFantasiaCliente(client.name) && (
                <span className="truncate">{razaoSocialCliente(client.name)}</span>
              )}
              {client.cnpj && <span className="font-data-mono">{client.cnpj}</span>}
              {client.segment && <span>· {client.segment}</span>}
              {cidade && <span className="flex items-center gap-0.5"><span className="material-symbols-outlined text-sm">location_on</span>{cidade}</span>}
              <span className={`font-semibold ${statusTone}`}>· {client.contractStatus}</span>
            </div>
            {client.contacts && client.contacts.length > 0 && (
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
                {client.contacts.slice(0, 2).map((ct, i) => (
                  <span key={i} className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm text-slate-400">person</span>
                    <span className="font-semibold text-slate-700">{ct.name}</span>
                    {ct.role && <span className="text-slate-400">· {ct.role}</span>}
                    {ct.phone && <span className="font-data-mono">· {ct.phone}</span>}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="ml-auto flex shrink-0 flex-wrap items-center gap-2">
            <button
              onClick={() => onOpenReport(client.name)}
              className="flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-slate-800"
              title="Iniciar um novo relatório técnico SDAI para este cliente"
            >
              <span className="material-symbols-outlined text-sm">assignment_add</span> Novo relatório
            </button>
            {onEditClient && (
              <button
                onClick={() => onEditClient(client)}
                className="flex items-center gap-1 rounded-lg bg-[#1A1A72]/10 px-3 py-1.5 text-xs font-bold text-[#1A1A72] transition-colors hover:bg-[#1A1A72] hover:text-white"
              >
                <span className="material-symbols-outlined text-sm">edit</span> Editar dados
              </button>
            )}
            {(userRole === 'ADMINISTRATIVO' || userRole === 'GESTOR') && (
              <button
                onClick={() => void handleDelete()}
                className="flex items-center gap-1 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-bold text-[#E63946] transition-colors hover:bg-[#E63946] hover:text-white"
                title={hasLinkedHistory ? 'Clientes com histórico não podem ser excluídos' : 'Excluir cliente sem vínculos'}
              >
                <span className="material-symbols-outlined text-sm">delete</span> Excluir
              </button>
            )}
          </div>
        </div>

        {/* Navegação por abas */}
        <nav className="flex gap-1 overflow-x-auto px-2 md:px-6" aria-label="Seções do dossiê">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => goTab(t.id)}
                className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-semibold transition-colors ${
                  active ? 'border-[#E63946] text-[#1A1A72]' : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
                aria-current={active ? 'page' : undefined}
              >
                <span className="material-symbols-outlined text-base">{t.icon}</span>
                {t.label}
                {t.badge ? (
                  <span className={`ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${active ? 'bg-[#E63946] text-white' : 'bg-slate-200 text-slate-600'}`}>
                    {t.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>
      </header>

      {/* ============================ Conteúdo das abas ============================ */}
      {/* Sem scroll interno: quem rola é a página (respeita o BottomNav mobile e a
          largura do container). */}
      <div className="min-w-0 flex-1 p-4 md:p-8">
        {tab === 'overview' && (
          <div className="mx-auto flex w-full min-w-0 max-w-[1600px] flex-col gap-6">
            {/* Cards clicáveis com números reais. O grid responde à LARGURA DO
                CONTAINER (auto-fit/minmax), então redistribui sozinho quando a
                sidebar abre/recolhe — sem depender do viewport. */}
            <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(10.5rem,1fr))]">
              <OverviewCard icon="assignment_late" label="OS abertas" value={osAbertas.length} tone="amber" onClick={() => goTab('os')} />
              <OverviewCard icon="engineering" label="OS em execução" value={osExecucao.length} tone="blue" onClick={() => goTab('os')} />
              <OverviewCard icon="flag" label="Pendências abertas" value={pendencias === null ? '…' : pendAbertas.length} tone="rose" onClick={() => goTab('pendencias')} />
              <OverviewCard icon="assignment" label="Relatórios" value={reports === null ? '…' : reports.length} tone="violet" onClick={() => goTab('relatorios')} />
              <OverviewCard icon="photo_library" label="Fotos de campo" value={photos === null ? (photosLoading ? '…' : '·') : photos.length} tone="sky" onClick={() => goTab('fotos')} />
              <OverviewCard icon="handshake" label="Contratos ativos" value={contratosAtivos.length} tone="emerald" onClick={() => goTab('contratos')} />
              <OverviewCard icon="memory" label="Dispositivos" value={devices === null ? '…' : devices.length} tone="brand" onClick={() => goTab('dispositivos')} />
              <OverviewCard icon="history" label="Eventos no histórico" value={timeline.length} tone="slate" onClick={() => goTab('historico')} />
            </div>

            {/* Resumo financeiro */}
            <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(12rem,1fr))]">
              <MoneyTile label="MRR (contratos)" value={brlM(mrr)} tone="brand" />
              <MoneyTile label="Recebido (confirmado)" value={brlM(totalRecebido)} tone="emerald" />
              <MoneyTile label="Propostas em aberto" value={brlM(volumeAberto)} tone="amber" />
              <MoneyTile label="Propostas aceitas" value={String(propostasAceitas.length)} tone="slate" />
            </div>

            {/* Atalhos recentes */}
            <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(20rem,1fr))]">
              <PanelCard title="OS em andamento" icon="engineering" actionLabel="Ver todas" onAction={() => goTab('os')}>
                {osAtivas.length === 0 ? <EmptyLine text="Nenhuma OS em andamento." /> : osAtivas.slice(0, 4).map((o) => (
                  <RowLine key={o.id} title={o.numero || o.titulo || o.id} subtitle={`${OS_TIPO_LABEL[o.tipo]}${o.dataPrevista ? ` · ${fmtDate(o.dataPrevista)}` : ''}`} badge={<Badge color={OS_STATUS_UI[o.status].color === 'blue' ? 'slate' : OS_STATUS_UI[o.status].color}>{OS_STATUS_UI[o.status].label}</Badge>} />
                ))}
              </PanelCard>
              <PanelCard title="Relatórios recentes" icon="assignment" actionLabel="Ver todos" onAction={() => goTab('relatorios')}>
                {reports === null ? <EmptyLine text="Carregando…" /> : reports.length === 0 ? <EmptyLine text="Nenhum relatório." /> : [...reports].sort((a, b) => toTime(b.finalizadoEm || b.iniciadoEm) - toTime(a.finalizadoEm || a.iniciadoEm)).slice(0, 4).map((r) => (
                  <RowLine key={r.id} title={r.numero || r.titulo || r.tipo} subtitle={`${r.tipo}${r.tecnicoNome ? ` · ${r.tecnicoNome}` : ''}`} badge={<Badge color={REPORT_STATUS_COLOR[String(r.status)] || 'slate'}>{r.status}</Badge>} />
                ))}
              </PanelCard>
            </div>
          </div>
        )}

        {tab === 'os' && (
          <SectionWrap
            title={`Ordens de Serviço (${clientOS.length})`}
            actionLabel="Abrir módulo de OS"
            onAction={() => onNavigateToTab('pedidos')}
          >
            {clientOS.length === 0 ? (
              <EmptyState variant="generico" title="Nenhuma ordem de serviço" description="Este cliente ainda não possui OS registradas." />
            ) : (
              <div className="flex flex-col gap-2">
                {[...clientOS].sort((a, b) => toTime(b.dataAbertura) - toTime(a.dataAbertura)).map((o) => (
                  <div key={o.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-data-mono text-xs font-bold text-slate-900">{o.numero || o.id}</span>
                        <Badge color={OS_STATUS_UI[o.status].color === 'blue' ? 'slate' : OS_STATUS_UI[o.status].color}>{OS_STATUS_UI[o.status].label}</Badge>
                      </div>
                      <p className="mt-0.5 truncate text-sm font-semibold text-slate-800">{o.titulo || OS_TIPO_LABEL[o.tipo]}</p>
                      <p className="mt-0.5 flex flex-wrap gap-x-3 text-[11px] text-slate-500">
                        <span>{OS_TIPO_LABEL[o.tipo]}</span>
                        <span>Abertura: {fmtDate(o.dataAbertura)}</span>
                        {o.dataPrevista && <span>Prevista: {fmtDate(o.dataPrevista)}</span>}
                        <span>Resp.: {techName(o.tecnicoResponsavelId)}</span>
                        {o.contratoId && <span>Contrato: {o.contratoId}</span>}
                      </p>
                    </div>
                    <button
                      onClick={() => onNavigateToTab('pedidos')}
                      className="shrink-0 rounded-lg border border-[#1A1A72] px-3 py-1.5 text-xs font-bold text-[#1A1A72] transition-colors hover:bg-[#1A1A72] hover:text-white"
                    >
                      Abrir
                    </button>
                  </div>
                ))}
              </div>
            )}
          </SectionWrap>
        )}

        {tab === 'relatorios' && (
          <SectionWrap
            title={`Relatórios (${reports?.length ?? '…'})`}
            actionLabel="Abrir módulo de Relatórios"
            onAction={() => onNavigateToTab('relatorios')}
          >
            {reports === null ? <EmptyLine text="Carregando relatórios…" /> : reports.length === 0 ? (
              <EmptyState variant="relatorio" title="Nenhum relatório" description="Este cliente ainda não possui relatórios técnicos." />
            ) : (
              <div className="flex flex-col gap-2">
                {[...reports].sort((a, b) => toTime(b.finalizadoEm || b.iniciadoEm) - toTime(a.finalizadoEm || a.iniciadoEm)).map((r) => {
                  const pendVinc = (pendencias || []).filter((p) => p.reportOrigemId === r.id || p.reportExecucaoId === r.id).length;
                  return (
                    <div key={r.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-data-mono text-xs font-bold text-slate-900">{r.numero || r.id}</span>
                          <Badge color={REPORT_STATUS_COLOR[String(r.status)] || 'slate'}>{r.status}</Badge>
                        </div>
                        <p className="mt-0.5 truncate text-sm font-semibold text-slate-800">{r.titulo || r.tipo}</p>
                        <p className="mt-0.5 flex flex-wrap gap-x-3 text-[11px] text-slate-500">
                          <span>{r.tipo}</span>
                          {r.local && <span>Área: {r.local}</span>}
                          <span>{fmtDate(r.finalizadoEm || r.iniciadoEm)}</span>
                          {r.tecnicoNome && <span>Téc.: {r.tecnicoNome}</span>}
                          {pendVinc > 0 && <span className="font-semibold text-rose-600">{pendVinc} pendência(s)</span>}
                        </p>
                      </div>
                      <button
                        onClick={() => onNavigateToTab('relatorios')}
                        className="shrink-0 rounded-lg border border-[#1A1A72] px-3 py-1.5 text-xs font-bold text-[#1A1A72] transition-colors hover:bg-[#1A1A72] hover:text-white"
                      >
                        Abrir
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionWrap>
        )}

        {tab === 'pendencias' && (
          <SectionWrap
            title={`Pendências (${pendAbertas.length} abertas · ${pendencias?.length ?? '…'} no total)`}
            actionLabel="Abrir Relatórios & Pendências"
            onAction={() => onNavigateToTab('relatorios')}
          >
            {pendencias === null ? <EmptyLine text="Carregando pendências…" /> : pendencias.length === 0 ? (
              <EmptyState variant="generico" title="Nenhuma pendência" description="Nenhuma pendência técnica registrada para este cliente." />
            ) : (
              <div className="flex flex-col gap-4">
                <PendenciaGroup title="Abertas / em lifecycle" list={pendAbertas} onNavigateToTab={onNavigateToTab} />
                <PendenciaGroup title="Encerradas / histórico" list={pendencias.filter((p) => !PEND_ABERTAS(p))} onNavigateToTab={onNavigateToTab} muted />
              </div>
            )}
          </SectionWrap>
        )}

        {tab === 'fotos' && (
          <SectionWrap
            title={`Fotos de campo (${photos?.length ?? (photosLoading ? '…' : 0)})`}
            actionLabel="Abrir Fotos de Campo"
            onAction={() => onNavigateToTab('fotos-de-campo')}
          >
            <PhotosTab
              photos={photos}
              loading={photosLoading}
              thumbs={thumbs}
              reports={reports || []}
              ordensServico={clientOS}
            />
          </SectionWrap>
        )}

        {tab === 'dispositivos' && (
          <SectionWrap
            title={`Dispositivos instalados (${devices?.length ?? '…'})`}
            actionLabel="Gerenciar dispositivos"
            onAction={() => setShowDevicesManager(true)}
          >
            <DevicesTab devices={devices} inventory={inventory} onManage={() => setShowDevicesManager(true)} />
          </SectionWrap>
        )}

        {tab === 'contratos' && (
          <SectionWrap
            title={`Contratos (${clientContracts.length})`}
            actionLabel="Abrir módulo de Contratos"
            onAction={() => onNavigateToTab('contratos')}
          >
            {clientContracts.length === 0 ? (
              <EmptyState variant="generico" title="Nenhum contrato" description="Este cliente não possui contratos vinculados." />
            ) : (
              <div className="flex flex-col gap-2">
                {clientContracts.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-data-mono text-xs font-bold text-slate-900">{c.id}</span>
                        <Badge color={c.status === 'ATIVO' ? 'emerald' : c.status === 'A VENCER' ? 'amber' : 'red'}>{c.status}</Badge>
                      </div>
                      <p className="mt-0.5 truncate text-sm font-semibold text-slate-800">{c.contractType || c.unit || 'Contrato'}</p>
                      <p className="mt-0.5 flex flex-wrap gap-x-3 text-[11px] text-slate-500">
                        {(c.startDate || c.renewalDate) && <span>Vigência: {fmtDate(c.startDate)} → {c.renewalDate ? fmtDate(c.renewalDate) : '—'}</span>}
                        {Array.isArray(c.tiposAtendimento) && c.tiposAtendimento.length > 0 && <span>{c.tiposAtendimento.join(', ')}</span>}
                        {typeof c.contractedHours === 'number' && c.contractedHours > 0 && <span>{c.contractedHours}h contratadas</span>}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-data-mono text-sm font-bold text-emerald-600">{brlM(c.monthlyValue || 0)}<span className="text-[10px] text-slate-400">/mês</span></p>
                      <button
                        onClick={() => onNavigateToTab('contratos')}
                        className="mt-1 rounded-lg border border-[#1A1A72] px-3 py-1 text-xs font-bold text-[#1A1A72] transition-colors hover:bg-[#1A1A72] hover:text-white"
                      >
                        Abrir
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionWrap>
        )}

        {tab === 'historico' && (
          <SectionWrap title={`Histórico (${timeline.length} eventos)`}>
            {timeline.length === 0 ? (
              <EmptyState variant="generico" title="Sem histórico" description="Ainda não há eventos vinculados a este cliente." />
            ) : (
              <div className="relative ml-2 space-y-3 border-l border-slate-200 pl-5">
                {timeline.map((ev) => (
                  <div key={ev.id} className="relative min-w-0">
                    <span className={`absolute -left-[1.85rem] top-0.5 flex h-6 w-6 items-center justify-center rounded-full ${ev.tone}`}>
                      <span className="material-symbols-outlined text-[14px]">{ev.icon}</span>
                    </span>
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="truncate text-sm font-semibold text-slate-800">{ev.title}</p>
                      <span className="shrink-0 font-data-mono text-[10px] text-slate-400">{fmtDate(ev.date)}</span>
                    </div>
                    <p className="mt-0.5 text-[10px] uppercase tracking-wide text-slate-400">{ev.type}</p>
                    <p className="truncate text-[11px] text-slate-500">{ev.detail}</p>
                  </div>
                ))}
              </div>
            )}
          </SectionWrap>
        )}
      </div>

      {/* CRUD de dispositivos: reaproveita o gerenciador existente (fonte única). */}
      <DevicesManager
        open={showDevicesManager}
        onClose={() => {
          setShowDevicesManager(false);
          // Recarrega a lista após edições (mantém a Visão Geral coerente).
          if (isSupabaseConfigured()) fetchDevices(client.id).then(setDevices).catch(() => {});
        }}
        clienteId={client.id}
        clienteNome={client.name}
        fabricantes={fabricantes}
        suppliers={suppliers}
        inventory={inventory}
        onAddFabricante={onAddFabricante}
      />
    </div>
  );
};

/* ============================ Subcomponentes ============================ */

const TONE_TEXT: Record<string, string> = {
  brand: 'text-[#1A1A72]', emerald: 'text-emerald-600', amber: 'text-amber-600',
  rose: 'text-rose-600', violet: 'text-violet-600', sky: 'text-sky-600', blue: 'text-blue-600', slate: 'text-slate-700',
};

const OverviewCard: React.FC<{ icon: string; label: string; value: number | string; tone: string; onClick: () => void }> = ({ icon, label, value, tone, onClick }) => (
  <button
    onClick={onClick}
    className="group flex flex-col items-start rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#1A1A72]/40 hover:shadow-md"
  >
    <span className={`material-symbols-outlined text-2xl ${TONE_TEXT[tone] || 'text-slate-500'}`}>{icon}</span>
    <span className={`mt-2 font-data-mono text-2xl font-bold ${TONE_TEXT[tone] || 'text-slate-900'}`}>{value}</span>
    <span className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
  </button>
);

const MoneyTile: React.FC<{ label: string; value: string; tone: string }> = ({ label, value, tone }) => (
  <div className="rounded-xl border border-slate-200 bg-white p-4">
    <p className="text-[10px] uppercase tracking-wider text-slate-400">{label}</p>
    <p className={`mt-1 font-data-mono text-base font-bold ${TONE_TEXT[tone] || 'text-slate-900'}`}>{value}</p>
  </div>
);

const SectionWrap: React.FC<{ title: string; children: React.ReactNode; actionLabel?: string; onAction?: () => void }> = ({ title, children, actionLabel, onAction }) => (
  <div className="mx-auto flex w-full min-w-0 max-w-[1600px] flex-col gap-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">{title}</h2>
      {actionLabel && onAction && (
        <button onClick={onAction} className="shrink-0 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-[#1A1A72] transition-colors hover:border-[#1A1A72] hover:bg-[#1A1A72] hover:text-white">
          {actionLabel} →
        </button>
      )}
    </div>
    {children}
  </div>
);

const PanelCard: React.FC<{ title: string; icon: string; children: React.ReactNode; actionLabel?: string; onAction?: () => void }> = ({ title, icon, children, actionLabel, onAction }) => (
  <div className="rounded-xl border border-slate-200 bg-white p-4">
    <div className="mb-3 flex items-center justify-between">
      <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700">
        <span className="material-symbols-outlined text-base text-slate-400">{icon}</span>{title}
      </h3>
      {actionLabel && onAction && (
        <button onClick={onAction} className="text-[10px] font-semibold uppercase tracking-wider text-[#1A1A72] hover:text-[#E63946]">{actionLabel} →</button>
      )}
    </div>
    <div className="flex flex-col gap-2">{children}</div>
  </div>
);

const RowLine: React.FC<{ title: string; subtitle: string; badge?: React.ReactNode }> = ({ title, subtitle, badge }) => (
  <div className="flex items-center justify-between gap-3 border-b border-slate-50 pb-2 last:border-0 last:pb-0">
    <div className="min-w-0">
      <p className="truncate text-sm font-semibold text-slate-800">{title}</p>
      <p className="truncate text-[11px] text-slate-500">{subtitle}</p>
    </div>
    {badge}
  </div>
);

const EmptyLine: React.FC<{ text: string }> = ({ text }) => (
  <p className="px-1 py-2 text-[11px] italic text-slate-400">{text}</p>
);

const PendenciaGroup: React.FC<{ title: string; list: Pendencia[]; onNavigateToTab: (t: TabPath) => void; muted?: boolean }> = ({ title, list, onNavigateToTab, muted }) => {
  if (list.length === 0) return null;
  return (
    <div>
      <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">{title} · {list.length}</p>
      <div className="flex flex-col gap-2">
        {list.map((p) => (
          <div key={p.id} className={`rounded-xl border px-4 py-3 ${muted ? 'border-slate-100 bg-slate-50' : 'border-slate-200 bg-white'}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-800">{p.descricao || p.grupo || 'Pendência técnica'}</p>
                <p className="mt-0.5 flex flex-wrap gap-x-3 text-[11px] text-slate-500">
                  {p.local && <span>Local: {p.local}</span>}
                  {p.acaoRecomendada && <span>{p.acaoRecomendada}</span>}
                  {p.quantidade ? <span>{p.quantidade} {p.unidade || 'un'}</span> : null}
                  {p.criadaEm && <span>{fmtDate(p.criadaEm)}</span>}
                </p>
                {/* Lifecycle: relatório → pendência → orçamento/pedido → OS */}
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {p.reportOrigemId && <LinkChip icon="assignment" label="Relatório de origem" onClick={() => onNavigateToTab('relatorios')} />}
                  {p.propostaId && <LinkChip icon="receipt_long" label="Orçamento / pedido" onClick={() => onNavigateToTab('pedidos')} />}
                  {p.reportExecucaoId && <LinkChip icon="engineering" label="Execução" onClick={() => onNavigateToTab('relatorios')} />}
                </div>
              </div>
              <Badge color={PEND_STATUS_COLOR[String(p.status)] || 'slate'}>{p.status}</Badge>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const LinkChip: React.FC<{ icon: string; label: string; onClick: () => void }> = ({ icon, label, onClick }) => (
  <button onClick={onClick} className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600 transition-colors hover:bg-[#1A1A72] hover:text-white">
    <span className="material-symbols-outlined text-[13px]">{icon}</span>{label}
  </button>
);

/* ----------------------------- Aba Fotos ----------------------------- */

const PhotosTab: React.FC<{
  photos: GalleryPhoto[] | null;
  loading: boolean;
  thumbs: Record<string, string>;
  reports: ReportInstance[];
  ordensServico: OrdemServico[];
}> = ({ photos, loading, thumbs, reports, ordensServico }) => {
  const [filters, setFilters] = useState<FieldPhotoFilters>({});
  const filtered = useMemo(() => {
    if (!photos) return [];
    // clientId já foi aplicado na carga; aqui só refinamos (data/categoria/vínculo).
    return applyFieldPhotoFilters(photos, filters);
  }, [photos, filters]);

  if (loading || photos === null) return <EmptyLine text="Carregando fotos…" />;
  if (photos.length === 0) return <EmptyState variant="generico" title="Nenhuma foto de campo" description="Este cliente ainda não possui fotos sincronizadas." />;

  const set = (patch: Partial<FieldPhotoFilters>) => setFilters((f) => ({ ...f, ...patch }));
  const reportById = (id?: string) => (id ? reports.find((r) => r.id === id)?.numero || 'Relatório' : undefined);
  const osById = (id?: string) => (id ? ordensServico.find((o) => o.id === id)?.numero || 'OS' : undefined);

  return (
    <div className="flex flex-col gap-4">
      {/* Filtros úteis */}
      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-white p-3">
        <label className="flex flex-col text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          De
          <input type="date" value={filters.from || ''} onChange={(e) => set({ from: e.target.value || undefined })} className="mt-1 rounded-lg border border-slate-300 px-2 py-1.5 text-xs normal-case text-slate-800" />
        </label>
        <label className="flex flex-col text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Até
          <input type="date" value={filters.to || ''} onChange={(e) => set({ to: e.target.value || undefined })} className="mt-1 rounded-lg border border-slate-300 px-2 py-1.5 text-xs normal-case text-slate-800" />
        </label>
        <label className="flex flex-col text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Categoria
          <select value={filters.marcador || ''} onChange={(e) => set({ marcador: (e.target.value || undefined) as FieldPhotoFilters['marcador'] })} className="mt-1 rounded-lg border border-slate-300 px-2 py-1.5 text-xs normal-case text-slate-800">
            <option value="">Todas</option>
            <option value="pendente">Pendência</option>
            <option value="falha">Falha</option>
            <option value="corrigido">Corrigido</option>
            <option value="antes">Antes</option>
            <option value="depois">Depois</option>
          </select>
        </label>
        <label className="flex min-w-[10rem] flex-1 flex-col text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Buscar (local, nota, técnico)
          <input value={filters.search || ''} onChange={(e) => set({ search: e.target.value || undefined })} placeholder="Ex.: subsolo, sirene…" className="mt-1 rounded-lg border border-slate-300 px-2 py-1.5 text-xs normal-case text-slate-800" />
        </label>
        {(filters.from || filters.to || filters.marcador || filters.search) && (
          <button onClick={() => setFilters({})} className="rounded-lg px-2 py-1.5 text-xs font-semibold text-[#1A1A72] hover:underline">Limpar</button>
        )}
      </div>

      {filtered.length === 0 ? <EmptyLine text="Nenhuma foto para os filtros selecionados." /> : (
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(9rem,1fr))]">
          {filtered.map((p) => (
            <div key={p.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="aspect-square bg-slate-100">
                {thumbs[p.id] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumbs[p.id]} alt={p.notaRapida || 'Evidência de campo'} className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <div className="flex h-full items-center justify-center text-slate-300"><span className="material-symbols-outlined text-3xl">image</span></div>
                )}
              </div>
              <div className="p-2">
                <p className="truncate text-[11px] font-semibold text-slate-700">{p.localSetor || p.notaRapida || 'Foto de campo'}</p>
                <p className="mt-0.5 font-data-mono text-[10px] text-slate-400">{fmtDate(p.capturadoEm)}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {p.marcador && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-slate-500">{p.marcador}</span>}
                  {reportById(p.reportId) && <span className="rounded bg-violet-50 px-1.5 py-0.5 text-[9px] font-bold uppercase text-violet-600">{reportById(p.reportId)}</span>}
                  {osById(p.osId) && <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-600">{osById(p.osId)}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/* ----------------------------- Aba Dispositivos ----------------------------- */

const DevicesTab: React.FC<{ devices: Device[] | null; inventory: InventoryItem[]; onManage: () => void }> = ({ devices, inventory, onManage }) => {
  if (devices === null) return <EmptyLine text="Carregando dispositivos…" />;
  if (devices.length === 0) {
    return (
      <EmptyState
        variant="estoque"
        title="Nenhum dispositivo instalado"
        description="Cadastre os dispositivos físicos instalados neste cliente."
        actionLabel="Gerenciar dispositivos"
        onAction={onManage}
      />
    );
  }

  const catalogById = (id?: string) => (id ? inventory.find((i) => i.id === id) : undefined);

  // Agrupa por sistema → central (hierarquia: cliente → sistema → central → dispositivo).
  const bySistema = new Map<string, Device[]>();
  for (const d of devices) {
    const key = d.sistema || 'SDAI';
    if (!bySistema.has(key)) bySistema.set(key, []);
    bySistema.get(key)!.push(d);
  }

  return (
    <div className="flex flex-col gap-5">
      {Array.from(bySistema.entries()).map(([sistema, list]) => (
        <div key={sistema}>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">{sistema} · {list.length} dispositivo(s)</p>
          <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(20rem,1fr))]">
            {list.map((d) => {
              const cat = catalogById(d.itemCatalogoId);
              const identificado = !!cat || !!(d.fabricante || d.modelo);
              return (
                <div key={d.id} className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">
                        {d.tipoDispositivo || cat?.category || 'Dispositivo'}
                      </p>
                      <p className="truncate text-[11px] text-slate-500">
                        {cat ? `${cat.brand || d.fabricante || ''} ${cat.model || d.modelo || ''}`.trim() : `${d.fabricante || ''} ${d.modelo || ''}`.trim() || 'Produto não identificado'}
                      </p>
                    </div>
                    <Badge color={DEVICE_STATUS_COLOR[d.status]}>{d.status}</Badge>
                  </div>

                  {/* Atributos do produto canônico (catálogo) */}
                  {cat && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {cat.productLine && <span className="rounded bg-[#1A1A72]/5 px-1.5 py-0.5 text-[9px] font-semibold text-[#1A1A72]">{cat.productLine}</span>}
                      {cat.productType && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold text-slate-500">{cat.productType}</span>}
                      {(cat.technologies || []).slice(0, 2).map((t) => <span key={t} className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold text-slate-500">{t}</span>)}
                    </div>
                  )}
                  {!identificado && (
                    <p className="mt-2 flex items-center gap-1 text-[10px] font-semibold text-amber-600">
                      <span className="material-symbols-outlined text-[13px]">help</span> Produto não identificado — vincular ao catálogo depois
                    </p>
                  )}

                  {/* Atributos físicos da unidade instalada */}
                  <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 font-data-mono text-[10px] text-slate-500">
                    {d.central && <span>Central: {d.central}</span>}
                    {d.laco && <span>Laço: {d.laco}</span>}
                    {d.endereco && <span>Endereço: {d.endereco}</span>}
                    {d.pavimento && <span>Pavimento: {d.pavimento}</span>}
                    {d.localizacao && <span className="col-span-2">Local: {d.localizacao}</span>}
                    {d.dataInstalacao && <span>Instalado: {fmtDate(d.dataInstalacao)}</span>}
                    {d.ultimoTesteFuncional && <span>Últ. teste: {fmtDate(d.ultimoTesteFuncional)}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};
