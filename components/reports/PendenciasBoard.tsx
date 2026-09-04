'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Client, OrdemServico, OrdemServicoStatus, Pendencia, PendenciaStatus, UserRole } from '@/lib/types';
import { updatePendenciaStatus } from '@/lib/pendencias';
import { createOrdemServico, fetchOrdensServico, nextOsNumero } from '@/lib/ordensServico';
import { fetchAssignableTechnicians, ManagedUser } from '@/lib/users';
import { getClientOperationalName } from '@/lib/utils';
import { useToast, showToast } from '@/components/ui/Feedback';

interface PendenciasBoardProps {
  pendencias: Pendencia[];
  clients: Client[];
  userRole: UserRole;
  onChanged: () => void;
  onCreateProposal?: () => void;
}

const STATUS_ORDER: PendenciaStatus[] = ['aberta', 'orcada', 'aprovada', 'em_execucao', 'corrigida', 'cancelada', 'recusada_cliente'];
const STATUS_LABEL: Record<PendenciaStatus, string> = {
  aberta: 'Aberta',
  orcada: 'Orçada',
  aprovada: 'Aprovada',
  em_execucao: 'Em execução',
  corrigida: 'Corrigida',
  cancelada: 'Cancelada',
  recusada_cliente: 'Recusada',
};
const STATUS_COLOR: Record<PendenciaStatus, string> = {
  aberta: 'bg-red-100 text-red-700',
  orcada: 'bg-amber-100 text-amber-800',
  aprovada: 'bg-blue-100 text-blue-800',
  em_execucao: 'bg-indigo-100 text-indigo-800',
  corrigida: 'bg-emerald-100 text-emerald-800',
  cancelada: 'bg-surface-3 text-fg-secondary',
  recusada_cliente: 'bg-surface-3 text-fg-secondary',
};
const TERMINAIS: PendenciaStatus[] = ['corrigida', 'cancelada', 'recusada_cliente'];
const OS_STATUS_LABEL: Record<OrdemServicoStatus, string> = {
  aberta: 'Aberta',
  agendada: 'Agendada',
  em_execucao: 'Em execução',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
};

export const PendenciasBoard: React.FC<PendenciasBoardProps> = ({ pendencias, clients, userRole, onChanged, onCreateProposal }) => {
  const podeEditar = userRole === 'ADMINISTRATIVO' || userRole === 'GESTOR';
  const toast = useToast();
  const [technicians, setTechnicians] = useState<ManagedUser[]>([]);
  const [tecnicoSel, setTecnicoSel] = useState<string>(''); // '' = Não atribuído
  useEffect(() => {
    if (podeEditar) fetchAssignableTechnicians().then(setTechnicians).catch(() => setTechnicians([]));
  }, [podeEditar]);
  const [fStatus, setFStatus] = useState<string>('TODOS');
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [gerandoOs, setGerandoOs] = useState(false);
  const [ordens, setOrdens] = useState<OrdemServico[]>([]);

  const carregarOrdens = async () => {
    try {
      setOrdens(await fetchOrdensServico());
    } catch (err) {
      // A lista de pendências segue utilizável mesmo se a tabela de OS ainda
      // não estiver disponível em uma instalação antiga.
      console.warn('Não foi possível carregar vínculos de OS:', err);
    }
  };

  useEffect(() => {
    void carregarOrdens();
  }, []);

  // Pendências é interface operacional: nome fantasia (fallback razão). §8/§9
  const clientName = (id?: string) => getClientOperationalName(clients.find((c) => c.id === id), '—');

  const osPorPendencia = useMemo(() => {
    const mapa = new Map<string, OrdemServico>();
    // A consulta vem da OS mais recente para a mais antiga. Preservamos a
    // primeira associação caso exista histórico de reabertura da pendência.
    ordens.forEach((os) => os.pendenciaIds.forEach((pendenciaId) => {
      if (!mapa.has(pendenciaId)) mapa.set(pendenciaId, os);
    }));
    return mapa;
  }, [ordens]);

  const toggleSelected = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return pendencias
      .filter((p) => (fStatus === 'TODOS' ? true : p.status === fStatus))
      .filter((p) => {
        if (!s) return true;
        return (
          (p.descricao || '').toLowerCase().includes(s) ||
          (p.grupo || '').toLowerCase().includes(s) ||
          clientName(p.clienteId).toLowerCase().includes(s)
        );
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendencias, fStatus, search, clients]);

  const changeStatus = async (p: Pendencia, novo: PendenciaStatus) => {
    if (!podeEditar || novo === p.status) return;
    setBusyId(p.id);
    try {
      await updatePendenciaStatus(p.id, novo, TERMINAIS.includes(novo) ? { resolvidaEm: new Date().toISOString() } : undefined);
      onChanged();
    } catch (err) {
      console.error('Falha ao mudar status da pendência:', err);
      showToast('Não foi possível alterar o status.');
    } finally {
      setBusyId(null);
    }
  };

  // Pendências selecionadas (só faz sentido agrupar 'aprovada' do mesmo cliente).
  const selecionadas = pendencias.filter((p) => selected.has(p.id));
  const clientesSelecionados = new Set(selecionadas.map((p) => p.clienteId || ''));
  const podeGerarOs =
    podeEditar &&
    selecionadas.length > 0 &&
    clientesSelecionados.size === 1 &&
    selecionadas.every((p) => p.status === 'aprovada');

  const gerarOs = async () => {
    if (!podeGerarOs || gerandoOs) return;
    const clienteId = selecionadas[0].clienteId;
    setGerandoOs(true);
    try {
      const numero = await nextOsNumero();
      await createOrdemServico({
        id: '',
        numero,
        clienteId,
        tipo: 'corretiva',
        titulo: `${selecionadas.length} pendência(s) — ${clientName(clienteId)}`,
        status: 'aberta',
        prioridade: 'media',
        pendenciaIds: selecionadas.map((p) => p.id),
        tecnicoResponsavelId: tecnicoSel || undefined,
      });
      // As pendências entram em execução (vinculadas à OS aberta).
      for (const p of selecionadas) {
        await updatePendenciaStatus(p.id, 'em_execucao');
      }
      setSelected(new Set());
      setTecnicoSel('');
      await carregarOrdens();
      onChanged();
      toast.success(`OS ${numero} gerada com ${selecionadas.length} pendência(s).`);
    } catch (err) {
      console.error('Falha ao gerar OS:', err);
      toast.error('Não foi possível gerar a Ordem de Serviço.');
    } finally {
      setGerandoOs(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Barra de ação da seleção (gerar OS a partir de pendências aprovadas) */}
      {podeEditar && selecionadas.length > 0 && (
        <div className="sticky top-2 z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-navy text-white p-3 rounded-xl shadow-lg">
          <div className="text-xs">
            <strong>{selecionadas.length}</strong> selecionada(s)
            {clientesSelecionados.size > 1 && (
              <span className="ml-2 text-amber-200">· selecione pendências de um único cliente</span>
            )}
            {clientesSelecionados.size === 1 && !selecionadas.every((p) => p.status === 'aprovada') && (
              <span className="ml-2 text-amber-200">· só pendências aprovadas viram OS</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelected(new Set())}
              className="px-3 py-1.5 rounded-lg text-[11px] font-semibold uppercase bg-white/15 hover:bg-white/25"
            >
              Limpar
            </button>
            <select
              aria-label="Responsável técnico"
              title="Responsável técnico da OS"
              value={tecnicoSel}
              onChange={(e) => setTecnicoSel(e.target.value)}
              className="px-2 py-1.5 rounded-lg text-[11px] font-semibold text-fg-secondary bg-surface border border-white/30 focus:outline-none max-w-[180px]"
            >
              <option value="">Não atribuído</option>
              {/* §11 — contexto operacional: só o nome (sem cargo/role). */}
              {technicians.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <button
              onClick={gerarOs}
              disabled={!podeGerarOs || gerandoOs}
              className="px-4 py-1.5 rounded-lg text-[11px] font-bold uppercase bg-surface text-primary hover:bg-surface-3 disabled:opacity-40"
            >
              {gerandoOs ? 'Gerando…' : 'Gerar OS'}
            </button>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center bg-surface p-3 rounded-xl border border-border shadow-sm">
        <div className="relative w-full sm:w-72">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted text-lg">search</span>
          <input
            type="text"
            placeholder="Buscar por descrição, grupo ou cliente…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto">
          {['TODOS', ...STATUS_ORDER].map((st) => (
            <button
              key={st}
              onClick={() => setFStatus(st)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold uppercase whitespace-nowrap transition-colors ${
                fStatus === st ? 'bg-slate-900 text-white' : 'bg-surface-3 text-fg-secondary hover:bg-surface-3'
              }`}
            >
              {st === 'TODOS' ? 'Todas' : STATUS_LABEL[st as PendenciaStatus]}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-surface rounded-xl shadow-sm py-16 text-center text-fg-muted">
          <span className="material-symbols-outlined text-4xl text-fg-muted">assignment_turned_in</span>
          <p className="mt-2 text-sm font-bold text-fg-secondary uppercase tracking-wider">Nenhuma pendência</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((p) => {
            const os = osPorPendencia.get(p.id);
            const proximoPasso = p.status === 'aberta' && !p.propostaId
              ? 'Próximo passo: criar proposta'
              : p.status === 'orcada'
                ? 'Aguardando aprovação comercial'
                : p.status === 'aprovada' && !os
                  ? 'Selecione para gerar a OS'
                  : p.status === 'em_execucao' && os
                    ? `Em atendimento pela ${os.numero || 'OS vinculada'}`
                    : null;

            return (
            <div key={p.id} className="bg-surface rounded-xl border border-border shadow-sm p-3 flex flex-col md:flex-row md:items-center gap-3">
              {podeEditar && p.status === 'aprovada' && (
                <input
                  type="checkbox"
                  checked={selected.has(p.id)}
                  onChange={() => toggleSelected(p.id)}
                  className="mt-1 md:mt-0 h-4 w-4 shrink-0 accent-[#1A1A72] cursor-pointer"
                  title="Selecionar para gerar Ordem de Serviço"
                />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {p.grupo && <span className="text-[10px] font-bold text-danger uppercase">{p.grupo}</span>}
                  <span className="text-xs font-semibold text-fg uppercase">{clientName(p.clienteId)}</span>
                  {podeEditar && p.criticidadeOperacional && (
                    <span className="text-[9px] font-bold bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded" title="Criticidade operacional (interno)">
                      C{p.criticidadeOperacional}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-fg-secondary truncate">{p.descricao}</p>
                <p className="text-[10px] text-fg-muted">
                  {p.local ? `${p.local} · ` : ''}
                  {p.acaoRecomendada ? `${p.acaoRecomendada} · ` : ''}
                  {p.quantidade ? `${p.quantidade} ${p.unidade || ''}` : ''}
                </p>
                {(p.propostaId || os || p.reportExecucaoId || proximoPasso) && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[9px] font-semibold">
                    {p.propostaId && (
                      <span className="rounded bg-amber-50 px-1.5 py-0.5 text-amber-800">Proposta {p.propostaId}</span>
                    )}
                    {os && (
                      <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-indigo-800">
                        {os.numero || 'OS vinculada'} · {OS_STATUS_LABEL[os.status]}
                      </span>
                    )}
                    {p.reportExecucaoId && (
                      <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-800">Execução registrada</span>
                    )}
                    {proximoPasso && (
                      <span className="text-fg-muted">{proximoPasso}</span>
                    )}
                    {p.status === 'aberta' && !p.propostaId && onCreateProposal && podeEditar && (
                      <button
                        type="button"
                        onClick={onCreateProposal}
                        className="rounded px-1.5 py-0.5 text-primary hover:bg-indigo-50"
                      >
                        Criar proposta
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${STATUS_COLOR[p.status]}`}>
                  {STATUS_LABEL[p.status]}
                </span>
                {podeEditar && (
                  <select
                    value={p.status}
                    disabled={busyId === p.id}
                    onChange={(e) => changeStatus(p, e.target.value as PendenciaStatus)}
                    className="text-[11px] border border-border rounded-lg px-2 py-1.5 bg-surface disabled:opacity-50"
                    title="Alterar status"
                  >
                    {STATUS_ORDER.map((s) => (
                      <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>
            );
          })}
          <p className="text-xs text-fg-secondary px-1 pt-1">{filtered.length} pendência(s)</p>
        </div>
      )}
    </div>
  );
};
