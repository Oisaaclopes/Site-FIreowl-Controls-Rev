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
} from '@/lib/types';
import { ALL_TEMPLATES, seedReportTemplates } from '@/lib/reportTemplatesData';
import { TemplateSchema } from '@/lib/reportSchema';
import { CatalogSources } from '@/components/reports/FormEngine';
import { ReportForm } from '@/components/reports/ReportForm';
import { isSupabaseConfigured } from '@/lib/inventory';
import { fetchReports } from '@/lib/reports';
import { fetchPendencias } from '@/lib/pendencias';
import { fetchTemplates } from '@/lib/reportTemplates';
import { gerarPdfExecucao } from '@/lib/reportPdf';
import { NovaProposta } from '@/components/reports/NovaProposta';

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
  brands: { name: string }[];
  userRole: UserRole;
  currentUserName?: string;
  onAddClient?: (newClient: Client) => void;
}

const uniq = (arr: string[]) => Array.from(new Set(arr.filter(Boolean)));
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
  currentUserName = '',
  onAddClient,
}) => {
  const isTecnico = userRole === 'TECNICO';
  const isFinanceiro = userRole === 'FINANCEIRO';
  const canCreate = !isFinanceiro; // §6.1 RBAC: criar relatório — admin/gestor/técnico

  const [mode, setMode] = useState<'index' | 'form'>('index');
  const [showProposta, setShowProposta] = useState(false);
  const [reports, setReports] = useState<ReportInstance[]>([]);
  const [pendencias, setPendencias] = useState<Pendencia[]>([]);
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
  const [wTipo, setWTipo] = useState<string>('');
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

  const clientName = (id?: string) => clients.find((c) => c.id === id)?.name || '—';

  const refresh = () => {
    if (!isSupabaseConfigured()) return;
    setLoading(true);
    Promise.all([fetchReports(), fetchPendencias(userRole)])
      .then(([rs, ps]) => {
        setReports(rs);
        setPendencias(ps);
      })
      .catch((err) => console.warn('Relatórios: falha ao carregar.', err))
      .finally(() => setLoading(false));
  };

  // Carrega templates do banco; se vazio e admin, semeia os empacotados.
  const loadTemplates = async () => {
    if (!isSupabaseConfigured()) return;
    try {
      let rows = await fetchTemplates();
      if (rows.length === 0 && userRole === 'ADMINISTRATIVO') {
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

  const catalog: CatalogSources = useMemo(
    () => ({
      categorias: uniq([...inventory.map((i) => i.category), ...services.map((s) => s.category)]),
      itens: uniq([...inventory.map((i) => i.name), ...services.map((s) => s.title)]),
      marcas: uniq([...brands.map((b) => b.name), ...inventory.map((i) => i.brand || '')]),
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
    setWClienteId(clients[0]?.id || '');
    setWContratoId('');
    setWOsId('');
    setWizardStep(1);
  };
  const closeWizard = () => setWizardStep(0);

  const startForm = () => {
    const loaded = templates.find((t) => t.schema.tipo === wTipo) || null;
    if (!loaded) return;
    setFormTemplate(loaded.schema);
    setFormTemplateId(loaded.id);
    setFormCliente(clients.find((c) => c.id === wClienteId));
    setFormContext({ osId: wOsId || undefined, contratoId: wContratoId || undefined });
    setWizardStep(0);
    setMode('form');
  };

  // Catálogo do formulário: base + pendências aprovadas do cliente escolhido
  // (para a Corretiva). Derivado sem mutar o catalog memoizado.
  const formCatalog: CatalogSources = {
    ...catalog,
    pendenciasAprovadas: pendencias
      .filter((p) => p.status === 'aprovada' && p.clienteId === formCliente?.id)
      .map((p) => ({ id: p.id, label: `${p.grupo || 'Pendência'} — ${p.descricao || ''}`.slice(0, 60) })),
  };

  const clienteContratos = contracts.filter((c) => clientName(wClienteId) === c.clientName);
  const clientePendAprovadas = pendencias.filter((p) => p.status === 'aprovada' && p.clienteId === wClienteId);

  // ===== Formulário aberto =====
  if (mode === 'form' && formTemplate) {
    return (
      <ReportForm
        template={formTemplate}
        templateId={formTemplateId}
        cliente={formCliente}
        catalog={formCatalog}
        userRole={userRole}
        currentUserName={currentUserName}
        contexto={formContext}
        onBack={() => setMode('index')}
        onSaved={refresh}
      />
    );
  }

  // ===== Índice =====
  return (
    <div className="flex flex-col w-full p-4 md:p-8 gap-5 md:gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-5">
        <div>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Relatórios Técnicos de Campo — SDAI</span>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-0.5">
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

      <NovaProposta
        open={showProposta}
        onClose={() => setShowProposta(false)}
        clients={clients}
        inventory={inventory}
        services={services}
        pendencias={pendencias}
      />

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
        <div className="bg-white rounded-xl shadow-sm py-16 text-center text-slate-400">
          <span className="material-symbols-outlined text-4xl text-slate-300">assignment</span>
          <p className="mt-2 text-sm font-bold text-slate-500 uppercase tracking-wider">Nenhum relatório</p>
          <p className="text-xs text-slate-400 mt-1">
            {canCreate ? 'Clique em "Novo relatório" para começar.' : 'Sem relatórios para exibir.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
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
                <th className="py-3 px-4 text-center">PDF</th>
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
                  <td className="py-3 px-4 text-center">
                    {r.status === 'finalizado' ? (
                      <button
                        onClick={() =>
                          gerarPdfExecucao(r, clientName(r.clienteId), userRole).catch((e) => {
                            console.error(e);
                            alert('Falha ao gerar o PDF.');
                          })
                        }
                        title="Gerar PDF de execução"
                        className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-slate-400 hover:text-[#E63946] hover:bg-red-50 transition-colors"
                      >
                        <span className="material-symbols-outlined text-lg">picture_as_pdf</span>
                      </button>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!isSupabaseConfigured() && (
        <p className="text-[10px] text-slate-400">Supabase não configurado: a lista fica vazia; o formulário funciona em modo protótipo.</p>
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
              {/* Passo 1 — Tipo */}
              {wizardStep === 1 && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {templates.map(({ schema: t }) => (
                    <button
                      key={t.codigo}
                      onClick={() => {
                        setWTipo(t.tipo);
                        setWizardStep(2);
                      }}
                      className="border-2 border-slate-200 rounded-xl p-4 text-left hover:border-[#1A1A72] hover:bg-[#1A1A72]/5 transition-colors"
                    >
                      <span className="material-symbols-outlined text-2xl text-[#1A1A72]">
                        {t.tipo === 'LEVANTAMENTO' ? 'search' : t.tipo === 'CORRETIVA' ? 'build' : 'fact_check'}
                      </span>
                      <p className="font-bold text-slate-900 text-sm mt-2">{TIPO_LABEL[t.tipo]}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">{t.nome}</p>
                    </button>
                  ))}
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
                    <input
                      type="text"
                      value={wOsId}
                      onChange={(e) => setWOsId(e.target.value)}
                      placeholder="Ex.: OS-2026-091"
                      className="w-full border border-slate-200 rounded-lg p-2.5 text-slate-900 bg-white text-xs font-data-mono focus:outline-none focus:ring-2 focus:ring-[#1A1A72]/20"
                    />
                  </div>
                  {wTipo === 'CORRETIVA' && (
                    <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/50">
                      <p className="text-[11px] font-bold text-slate-700 uppercase mb-1">Pendências aprovadas deste cliente</p>
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
      className={`shrink-0 bg-white border border-slate-200 rounded-xl px-4 py-3 text-left shadow-sm ${onClick ? 'hover:border-slate-300' : 'cursor-default'}`}
    >
      <p className={`font-data-mono text-2xl font-bold ${toneCls}`}>{value}</p>
      <p className="text-[10px] text-slate-500 uppercase tracking-wider whitespace-nowrap">{label}</p>
    </button>
  );
};

const VolCard: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
    <p className="font-data-mono text-xl font-bold text-slate-900">{value}</p>
    <p className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</p>
  </div>
);
