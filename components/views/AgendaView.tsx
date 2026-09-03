'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { OrdemServico, Contract, Client, ContractRoutineExecution, UserRole } from '@/lib/types';
import { fetchHolidays, Holiday } from '@/lib/holidays';
import { isSupabaseConfigured } from '@/lib/inventory';
import { fetchOrdensServico } from '@/lib/ordensServico';
import { fetchContracts } from '@/lib/contracts';
import { fetchClients } from '@/lib/clients';
import { fetchScheduledExecutions, generateOsFromExecution } from '@/lib/contractRoutines';
import { fetchAssignableTechnicians, ManagedUser } from '@/lib/users';
import { useDomainRefresh } from '@/lib/realtime/RealtimeProvider';
import { useConfirm } from '@/components/ui/Feedback';

interface AgendaViewProps {
  /** Abre a OS no módulo de Pedidos/OS quando o usuário clica num evento real. */
  onOpenOS?: (osId: string) => void;
  userRole?: UserRole;
  /** UUID do usuário logado — para o TÉCNICO abrir em "Minhas OS". */
  currentUserId?: string;
}

const WEEKDAYS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const pad2 = (n: number) => String(n).padStart(2, '0');
const dateKey = (y: number, m: number, d: number) => `${y}-${pad2(m + 1)}-${pad2(d)}`;

function fixedNationalHolidays(year: number): Record<string, { name: string; type: string }> {
  const fixed: [number, number, string][] = [
    [1, 1, 'Confraternização Universal'], [4, 21, 'Tiradentes'], [5, 1, 'Dia do Trabalho'],
    [9, 7, 'Independência do Brasil'], [10, 12, 'Nossa Senhora Aparecida'], [11, 2, 'Finados'],
    [11, 15, 'Proclamação da República'], [11, 20, 'Consciência Negra'], [12, 25, 'Natal'],
  ];
  const map: Record<string, { name: string; type: string }> = {};
  fixed.forEach(([mo, day, name]) => { map[`${year}-${pad2(mo)}-${pad2(day)}`] = { name, type: 'Nacional' }; });
  return map;
}

/** Status unificado do compromisso (OS real ou competência prevista). */
type AgendaStatus = 'previsto' | 'agendado' | 'os_aberta' | 'em_atendimento' | 'concluido' | 'cancelado';
interface AgendaEvent {
  id: string; kind: 'os' | 'competencia'; date: string; // yyyy-mm-dd
  cliente: string; sub: string; status: AgendaStatus; osId?: string; executionId?: string;
  tecnicoId?: string; // responsável técnico (só em OS)
}

const STATUS_META: Record<AgendaStatus, { label: string; dot: string; chip: string }> = {
  previsto: { label: 'Previsto', dot: 'bg-sky-400', chip: 'bg-sky-50 text-sky-700 border-sky-200' },
  agendado: { label: 'Agendado', dot: 'bg-indigo-500', chip: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  os_aberta: { label: 'OS aberta', dot: 'bg-slate-700', chip: 'bg-surface-3 text-fg-secondary border-border' },
  em_atendimento: { label: 'Em atendimento', dot: 'bg-amber-500', chip: 'bg-amber-50 text-amber-700 border-amber-200' },
  concluido: { label: 'Concluído', dot: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  cancelado: { label: 'Cancelado', dot: 'bg-slate-300', chip: 'bg-surface-3 text-fg-muted border-border' },
};

const osStatusToAgenda = (s: OrdemServico['status']): AgendaStatus =>
  s === 'aberta' ? 'os_aberta' : s === 'agendada' ? 'agendado' : s === 'em_execucao' ? 'em_atendimento' : s === 'concluida' ? 'concluido' : 'cancelado';

// Colunas do Kanban mapeadas a partir dos estados REAIS (sem 2º motor de status).
const KANBAN: { key: string; label: string; match: (e: AgendaEvent) => boolean }[] = [
  { key: 'a_programar', label: 'A programar', match: (e) => e.kind === 'competencia' && e.status === 'previsto' },
  { key: 'programado', label: 'Programado', match: (e) => e.status === 'agendado' },
  { key: 'os_aberta', label: 'OS aberta', match: (e) => e.status === 'os_aberta' },
  { key: 'em_atendimento', label: 'Em atendimento', match: (e) => e.status === 'em_atendimento' },
  { key: 'concluido', label: 'Concluído', match: (e) => e.status === 'concluido' },
];

export const AgendaView: React.FC<AgendaViewProps> = ({ onOpenOS, userRole, currentUserId }) => {
  const online = isSupabaseConfigured();
  const confirm = useConfirm();
  const isTecnico = userRole === 'TECNICO';
  const [viewMode, setViewMode] = useState<'calendar' | 'kanban' | 'map'>('calendar');
  const [technicians, setTechnicians] = useState<ManagedUser[]>([]);
  // Filtro por responsável: 'TODOS' | 'NAO' (não atribuídas) | <profileId>.
  // TÉCNICO abre em "Minhas OS" (seu próprio id) por padrão — UX sobre dados que
  // a RLS já restringe às OS dele.
  const [tecnicoFilter, setTecnicoFilter] = useState<string>(isTecnico && currentUserId ? currentUserId : 'TODOS');
  const today = new Date();
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [holidays, setHolidays] = useState<Record<string, { name: string; type: string }>>({});
  const [ordens, setOrdens] = useState<OrdemServico[]>([]);
  const [execs, setExecs] = useState<ContractRoutineExecution[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const load = async () => {
    if (!online) { setLoading(false); return; }
    setLoading(true);
    try {
      const [os, ex, ct, cl] = await Promise.all([
        fetchOrdensServico(),
        fetchScheduledExecutions(['previsto', 'agendado', 'os_gerada']),
        fetchContracts(),
        fetchClients(),
      ]);
      setOrdens(os); setExecs(ex); setContracts(ct); setClients(cl);
      // Diretório de técnicos (para nome/filtro). Vazio se a RLS não permitir ler
      // profiles (GESTOR/TECNICO hoje) — degrada para "Atribuído/Não atribuído".
      setTechnicians(await fetchAssignableTechnicians());
    } catch (e) { setAviso(e instanceof Error ? e.message : 'Falha ao carregar a agenda.'); } finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);
  useDomainRefresh('agenda', load);
  useDomainRefresh('serviceOrders', load);

  useEffect(() => {
    setHolidays((prev) => ({ ...fixedNationalHolidays(year), ...prev }));
    if (!online) return;
    fetchHolidays().then((rows: Holiday[]) => setHolidays((prev) => { const map = { ...prev }; rows.forEach((h) => { map[h.date] = { name: h.name, type: h.type }; }); return map; })).catch(() => {});
  }, [year, online]);

  const clientName = (id?: string) => clients.find((c) => c.id === id)?.name;
  const contractById = (id: string) => contracts.find((c) => c.id === id);

  // Resolve o responsável técnico pelo profile (sem texto duplicado). Se o
  // diretório não estiver acessível (RLS), mostra rótulo neutro.
  const tecMap = useMemo(() => new Map(technicians.map((t) => [t.id, t])), [technicians]);
  const tecnicoLabel = (id?: string): string => {
    if (!id) return 'Não atribuído';
    const t = tecMap.get(id);
    if (!t) return 'Atribuído';
    return t.cargo ? `${t.name} · ${t.cargo}` : t.name;
  };

  // Fonte única: OS reais + competências ainda sem OS (dedup — se a execução já
  // tem OS, ela é representada pela OS, não pela competência).
  const events = useMemo<AgendaEvent[]>(() => {
    const evs: AgendaEvent[] = [];
    ordens.forEach((os) => {
      if (!os.dataPrevista) return;
      evs.push({ id: `os_${os.id}`, kind: 'os', date: os.dataPrevista, cliente: clientName(os.clienteId) || os.titulo || 'OS', sub: os.numero || os.id.slice(0, 8), status: osStatusToAgenda(os.status), osId: os.id, tecnicoId: os.tecnicoResponsavelId });
    });
    execs.forEach((e) => {
      if (e.ordemServicoId) return; // já virou OS → dedup
      if (!e.dataProgramada) return;
      const ct = contractById(e.contractId);
      evs.push({ id: `ex_${e.id}`, kind: 'competencia', date: e.dataProgramada, cliente: ct?.clientName || 'Contrato', sub: `Competência ${e.competencia}`, status: e.status === 'agendado' ? 'agendado' : 'previsto', executionId: e.id });
    });
    return evs;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ordens, execs, contracts, clients]);

  const filteredEvents = useMemo(() => {
    if (tecnicoFilter === 'TODOS') return events;
    if (tecnicoFilter === 'NAO') return events.filter((e) => !e.tecnicoId);
    return events.filter((e) => e.tecnicoId === tecnicoFilter);
  }, [events, tecnicoFilter]);

  const eventsByDay = useMemo(() => {
    const map: Record<number, AgendaEvent[]> = {};
    filteredEvents.forEach((e) => {
      const [y, m, d] = e.date.split('-').map(Number);
      if (y !== year || m - 1 !== month) return;
      (map[d] = map[d] || []).push(e);
    });
    return map;
  }, [filteredEvents, year, month]);

  const grid = useMemo(() => {
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [year, month]);

  const isToday = (d: number) => today.getFullYear() === year && today.getMonth() === month && today.getDate() === d;

  const clickEvent = async (e: AgendaEvent) => {
    if (e.kind === 'os' && e.osId) { onOpenOS?.(e.osId); return; }
    if (e.kind === 'competencia' && e.executionId) {
      const ok = await confirm({
        title: 'Gerar Ordem de Serviço?',
        message: `Será aberta uma OS para ${e.cliente} — ${e.sub}.`,
        confirmLabel: 'Gerar OS',
      });
      if (!ok) return;
      setBusy(true); setAviso(null);
      try {
        const res = await generateOsFromExecution(e.executionId);
        setAviso(res.alreadyExisted ? `OS ${res.numero || ''} já existia — nada duplicado.` : `OS ${res.numero || ''} gerada.`);
        await load();
      } catch (err) { setAviso(err instanceof Error ? err.message : 'Falha ao gerar OS.'); } finally { setBusy(false); }
    }
  };

  const goPrevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const goNextMonth = () => setViewDate(new Date(year, month + 1, 1));
  const goToday = () => setViewDate(new Date(today.getFullYear(), today.getMonth(), 1));

  const emptyBox = (icon: string, msg: string) => (
    <div className="bg-surface rounded-xl border border-dashed border-border py-16 text-center text-fg-muted">
      <span className="material-symbols-outlined text-4xl text-fg-muted">{icon}</span>
      <p className="mt-2 text-sm font-bold text-fg-secondary uppercase tracking-wider">{msg}</p>
    </div>
  );

  return (
    <div className="flex flex-col w-full p-4 md:p-8 gap-5 md:gap-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border pb-5">
        <div>
          <span className="text-xs font-semibold text-fg-secondary uppercase tracking-wider">Despacho Técnico &amp; Escala de Campo</span>
          <h1 className="text-2xl font-bold text-fg tracking-tight mt-0.5">Agenda de Atendimentos &amp; Manutenções</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Filtro por responsável técnico (UX; a restrição real virá na RLS) */}
          <select
            aria-label="Filtrar por responsável técnico"
            value={tecnicoFilter}
            onChange={(e) => setTecnicoFilter(e.target.value)}
            className="border border-border rounded-lg px-2.5 py-1.5 text-xs font-semibold text-fg-secondary bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            {isTecnico && currentUserId ? (
              <>
                <option value={currentUserId}>Minhas OS</option>
                <option value="TODOS">Todas as minhas OS</option>
              </>
            ) : (
              <>
                <option value="TODOS">Todos os técnicos</option>
                <option value="NAO">Não atribuídas</option>
                {technicians.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}{t.cargo ? ` · ${t.cargo}` : ''}</option>
                ))}
              </>
            )}
          </select>
          <div className="flex items-center gap-1 bg-surface-3 p-1 rounded-lg border border-border">
            {(['calendar', 'kanban', 'map'] as const).map((m) => (
              <button key={m} onClick={() => setViewMode(m)} className={`px-3 py-1.5 rounded-md text-xs font-semibold uppercase transition-colors ${viewMode === m ? 'bg-slate-900 text-white shadow-sm' : 'text-fg-secondary hover:text-fg'}`}>
                {m === 'calendar' ? 'Calendário' : m === 'kanban' ? 'Kanban' : 'Mapa de Rota'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {aviso && <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">{aviso}</p>}
      {!online && emptyBox('cloud_off', 'Agenda disponível com o Supabase configurado')}

      {online && viewMode === 'calendar' && (
        <div className="bg-surface rounded-xl border border-border p-4 md:p-6 shadow-sm">
          <div className="flex flex-wrap justify-between items-center gap-3 mb-5">
            <div className="flex items-center gap-2">
              <button onClick={goPrevMonth} aria-label="Mês anterior" className="w-8 h-8 rounded-lg flex items-center justify-center text-fg-secondary hover:bg-surface-3"><span className="material-symbols-outlined text-[20px]">chevron_left</span></button>
              <h3 className="text-base font-bold text-fg uppercase min-w-[170px] text-center">{MONTH_NAMES[month]} {year}</h3>
              <button onClick={goNextMonth} aria-label="Próximo mês" className="w-8 h-8 rounded-lg flex items-center justify-center text-fg-secondary hover:bg-surface-3"><span className="material-symbols-outlined text-[20px]">chevron_right</span></button>
              <button onClick={goToday} className="ml-1 px-3 py-1.5 rounded-lg text-[11px] font-semibold uppercase tracking-wide bg-surface-3 text-fg-secondary hover:bg-surface-3">Hoje</button>
            </div>
            <div className="flex items-center flex-wrap gap-3 text-[11px] font-medium text-fg-secondary">
              {(['previsto', 'agendado', 'em_atendimento', 'concluido'] as AgendaStatus[]).map((s) => (
                <span key={s} className="flex items-center gap-1.5"><span className={`w-2.5 h-2.5 rounded-full ${STATUS_META[s].dot}`} /> {STATUS_META[s].label}</span>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1.5 md:gap-2 font-data-mono text-center mb-2 font-bold text-xs text-fg-secondary">
            {WEEKDAYS.map((d, i) => <div key={d} className={`py-2.5 rounded-lg border ${i === 0 || i === 6 ? 'bg-surface-3/80 border-border text-fg-secondary' : 'bg-surface-2 border-border'}`}>{d}</div>)}
          </div>

          <div className="grid grid-cols-7 gap-1.5 md:gap-2">
            {grid.map((day, idx) => {
              if (day === null) return <div key={`e-${idx}`} className="min-h-[70px] md:min-h-[92px] rounded-lg bg-surface-2/40" />;
              const key = dateKey(year, month, day);
              const holiday = holidays[key];
              const todayFlag = isToday(day);
              const dayEvents = eventsByDay[day] || [];
              const weekend = idx % 7 === 0 || idx % 7 === 6;
              return (
                <div key={day} title={holiday ? `Feriado: ${holiday.name}` : undefined} className={`min-h-[70px] md:min-h-[92px] rounded-lg p-1.5 md:p-2 flex flex-col gap-1 font-data-mono text-xs border ${holiday ? 'bg-red-50 border-2 border-danger/60' : weekend ? 'bg-surface-2/60 border-border' : 'bg-surface border-border'} ${todayFlag ? 'ring-2 ring-primary ring-offset-1' : ''}`}>
                  <div className="flex justify-between items-center">
                    <span className={`font-bold ${holiday ? 'text-danger' : todayFlag ? 'text-primary' : 'text-fg-secondary'}`}>{pad2(day)}</span>
                    {todayFlag && <span className="text-[9px] bg-navy text-white px-1.5 py-0.5 rounded font-bold">HOJE</span>}
                    {!todayFlag && holiday && <span className="material-symbols-outlined text-[14px] text-danger">flag</span>}
                  </div>
                  {holiday && <div className="bg-danger text-white px-1.5 py-0.5 rounded text-[9px] font-bold leading-tight truncate">{holiday.name}</div>}
                  {dayEvents.slice(0, 3).map((e) => (
                    <button key={e.id} onClick={() => clickEvent(e)} disabled={busy} title={`${e.cliente} · ${e.sub} · ${STATUS_META[e.status].label}${e.kind === 'os' ? ` · ${tecnicoLabel(e.tecnicoId)}` : ''}${e.kind === 'competencia' ? ' (clique p/ gerar OS)' : ''}`} className={`text-left px-1.5 py-0.5 rounded text-[9px] truncate font-medium border ${e.kind === 'competencia' ? 'border-dashed' : ''} ${STATUS_META[e.status].chip}`}>
                      <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${STATUS_META[e.status].dot}`} />{e.cliente}
                    </button>
                  ))}
                  {dayEvents.length > 3 && <span className="text-[9px] text-fg-muted font-semibold">+{dayEvents.length - 3}</span>}
                </div>
              );
            })}
          </div>
          {events.length === 0 && !loading && <p className="mt-4 text-center text-xs text-fg-muted">Nenhuma OS ou competência programada. Programe rotinas nos contratos ou abra uma OS.</p>}
        </div>
      )}

      {online && viewMode === 'kanban' && (
        filteredEvents.length === 0 && !loading ? emptyBox('view_kanban', 'Nenhuma OS programada') : (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {KANBAN.map((col) => {
              const items = filteredEvents.filter(col.match);
              return (
                <div key={col.key} className="bg-surface-2 p-3 rounded-xl border border-border flex flex-col gap-3">
                  <div className="flex justify-between items-center border-b border-border pb-2">
                    <h4 className="text-[11px] font-bold text-fg uppercase">{col.label}</h4>
                    <span className="font-data-mono text-[10px] bg-surface-3 px-2 py-0.5 rounded-full font-bold text-fg-secondary">{items.length}</span>
                  </div>
                  <div className="space-y-2 min-h-[40px]">
                    {items.length === 0 ? <p className="text-[10px] text-fg-muted italic px-1">—</p> : items.map((e) => (
                      <button key={e.id} onClick={() => clickEvent(e)} disabled={busy} className="w-full text-left bg-surface p-3 rounded-lg border border-border shadow-sm hover:border-border-strong">
                        <span className="font-data-mono text-[10px] text-danger font-bold">{e.sub}</span>
                        <h5 className="font-bold text-xs uppercase text-fg mt-1 truncate">{e.cliente}</h5>
                        <div className="mt-2 flex items-center justify-between">
                          <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full border ${STATUS_META[e.status].chip}`}>{STATUS_META[e.status].label}</span>
                          <span className="text-[9px] text-fg-muted font-data-mono">{e.date}</span>
                        </div>
                        {e.kind === 'os' && (
                          <p className="text-[9px] text-fg-secondary mt-1.5 flex items-center gap-1 truncate">
                            <span className="material-symbols-outlined text-[12px] text-fg-muted">engineering</span>
                            <span className="truncate">{tecnicoLabel(e.tecnicoId)}</span>
                          </p>
                        )}
                        {e.kind === 'competencia' && <p className="text-[9px] text-emerald-700 font-bold uppercase mt-1">clique p/ gerar OS</p>}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {online && viewMode === 'map' && (
        <div className="bg-surface rounded-xl border border-border shadow-sm min-h-[380px] flex flex-col items-center justify-center text-center gap-2 p-8">
          <span className="material-symbols-outlined text-5xl text-fg-muted">location_off</span>
          <p className="text-sm font-bold text-fg-secondary uppercase tracking-wider">Nenhuma localização disponível</p>
          <p className="text-xs text-fg-muted max-w-md">O mapa exibirá técnicos e rotas quando houver atribuição real de equipe e localização autorizada. Nenhuma posição é simulada.</p>
        </div>
      )}
    </div>
  );
};
