'use client';
import { showToast, requestConfirm } from '@/components/ui/Feedback';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { TimePunch, UserRole } from '@/lib/types';
import { fetchCompanyProfile } from '@/lib/companyProfile';
import { resolveLogoDataUrls } from '@/lib/institucional';
import { DataListRow, Badge } from '@/components/DataListRow';
import { WorkSchedule, DEFAULT_SCHEDULE, normalizeSchedule, hmToMinutes, WEEKDAY_SHORT } from '@/lib/schedule';
import { fetchAdjustments, createAdjustment, updateAdjustmentStatus, hasRequestedTime, PunchAdjustment } from '@/lib/adjustments';
import { isSupabaseConfigured } from '@/lib/inventory';
import { fetchHolidays, Holiday } from '@/lib/holidays';
import { fetchDayEntries, createDayEntry, deleteDayEntry, DayEntry, DayEntryKind } from '@/lib/dayentries';
import { uploadCertificate, signedDocUrl } from '@/lib/storage';
import { useDomainRefresh } from '@/lib/realtime/RealtimeProvider';
import { fetchTimeClockParticipants } from '@/lib/users';
import { TimecardPDFView } from '@/components/documentos/TimecardPDFView';
import { derivePunchState, buildPunch, PUNCH_SHORT } from '@/lib/pontoActions';
import { effectivePunchLabel } from '@/lib/effectivePunches';
import type { TimecardBlock } from '@/components/documentos/TimecardDocument';
import {
  buildDailyTimeRecords,
  computePeriodSummary,
  consolidateDay,
  dayStatusLabel,
  fmtHoursShort,
} from '@/lib/timecard';

interface PontoViewProps {
  punches: TimePunch[];
  onAddPunch: (punch: TimePunch) => void;
  onReloadPunches?: () => void | Promise<void>;
  currentUser?: string;
  userRole?: UserRole;
  schedule?: WorkSchedule;
  usesTimeClock?: boolean;
}

// Escala fixa (poderia vir do cadastro do funcionário)

type PunchType = TimePunch['type'];

const NEXT_INFO: Record<PunchType, { label: string; icon: string; classes: string }> = {
  ENTRADA: { label: 'Registrar Entrada', icon: 'login', classes: 'bg-emerald-600 hover:bg-emerald-700' },
  PAUSA: { label: 'Registrar Saída para Almoço', icon: 'restaurant', classes: 'bg-amber-500 hover:bg-amber-600' },
  RETORNO: { label: 'Registrar Retorno', icon: 'login', classes: 'bg-navy hover:bg-navy-3' },
  SAIDA: { label: 'Registrar Saída', icon: 'logout', classes: 'bg-danger hover:bg-danger-hover' },
};

const FEEDBACK_LABEL: Record<PunchType, string> = {
  ENTRADA: 'Entrada registrada',
  PAUSA: 'Saída para almoço registrada',
  RETORNO: 'Retorno registrado',
  SAIDA: 'Saída registrada',
};

const pad2 = (n: number) => n.toString().padStart(2, '0');
const fmtClock = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
const fmtHM = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
const fmtDuration = (ms: number) => {
  const totalMin = Math.max(0, Math.floor(ms / 60000));
  return `${pad2(Math.floor(totalMin / 60))}h${pad2(totalMin % 60)}min`;
};
const inputCls =
  'w-full border border-border rounded-lg p-2.5 text-fg bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40';
const labelCls = 'block text-fg-secondary mb-1 font-semibold uppercase text-[11px]';

const friendlyDate = (d: Date) =>
  d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' });

const MONTH_NAMES_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

/** Mini-calendário do mês com feriados em evidência e marcação de batidas. */
const MiniCalendar: React.FC<{
  holidays: Record<string, Holiday>;
  punchDays: Set<string>;
  today: Date;
}> = ({ holidays, punchDays, today }) => {
  const [ref, setRef] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const y = ref.getFullYear();
  const m = ref.getMonth();

  const firstWeekday = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const key = (d: number) => `${y}-${pad2(m + 1)}-${pad2(d)}`;
  const isToday = (d: number) =>
    today.getFullYear() === y && today.getMonth() === m && today.getDate() === d;

  const monthHolidays = Object.entries(holidays)
    .filter(([k]) => k.startsWith(`${y}-${pad2(m + 1)}`))
    .map(([k, v]) => ({ day: parseInt(k.slice(-2), 10), name: v.name }))
    .sort((a, b) => a.day - b.day);

  return (
    <div className="bg-surface rounded-xl shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-bold text-fg-secondary uppercase tracking-wider">Calendário</h4>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setRef(new Date(y, m - 1, 1))}
            aria-label="Mês anterior"
            className="w-6 h-6 rounded flex items-center justify-center text-fg-muted hover:bg-surface-3 hover:text-fg-secondary"
          >
            <span className="material-symbols-outlined text-[18px]">chevron_left</span>
          </button>
          <span className="text-[11px] font-bold text-fg-secondary min-w-[92px] text-center">
            {MONTH_NAMES_PT[m]} {y}
          </span>
          <button
            onClick={() => setRef(new Date(y, m + 1, 1))}
            aria-label="Próximo mês"
            className="w-6 h-6 rounded flex items-center justify-center text-fg-muted hover:bg-surface-3 hover:text-fg-secondary"
          >
            <span className="material-symbols-outlined text-[18px]">chevron_right</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[9px] font-bold text-fg-muted mb-1">
        {WEEKDAY_SHORT.map((d, i) => (
          <div key={i}>{d.slice(0, 3)}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, idx) => {
          if (d === null) return <div key={`e${idx}`} className="h-7" />;
          const holiday = holidays[key(d)];
          const punched = punchDays.has(key(d));
          const todayFlag = isToday(d);
          return (
            <div
              key={d}
              title={holiday ? `Feriado: ${holiday.name}` : undefined}
              className={`h-7 rounded-md flex items-center justify-center text-[11px] font-data-mono relative ${
                holiday
                  ? 'bg-red-100 text-danger font-bold ring-1 ring-danger/40'
                  : 'text-fg-secondary'
              } ${todayFlag ? 'ring-2 ring-primary font-bold text-primary' : ''}`}
            >
              {pad2(d)}
              {punched && !holiday && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-emerald-500" />
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] text-fg-secondary">
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded bg-red-100 ring-1 ring-danger/40" /> Feriado
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded ring-2 ring-primary" /> Hoje
        </span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Batida
        </span>
      </div>

      {monthHolidays.length > 0 && (
        <div className="mt-2 space-y-1 border-t border-border pt-2">
          {monthHolidays.map((h) => (
            <div key={h.day} className="flex items-center gap-1.5 text-[10px] text-danger font-semibold">
              <span className="material-symbols-outlined text-[13px]">flag</span>
              <span className="font-data-mono">{pad2(h.day)}</span>
              <span className="truncate">{h.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const PontoView: React.FC<PontoViewProps> = (props) => {
  const isManager = props.userRole === 'ADMINISTRATIVO' || props.userRole === 'GESTOR';
  if (props.usesTimeClock === false && !isManager) return (
    <div className="p-6"><div className="rounded-xl border border-border bg-surface p-6 text-center">
      <span className="material-symbols-outlined text-3xl text-fg-muted">event_busy</span>
      <h2 className="mt-2 text-sm font-bold text-fg">Controle de ponto desativado</h2>
      <p className="mt-1 text-xs text-fg-secondary">Seu usuário não participa do registro de jornada nem do espelho de ponto.</p>
    </div></div>
  );
  return <PontoViewCore {...props} />;
};

const PontoViewCore: React.FC<PontoViewProps> = ({
  punches,
  onAddPunch,
  onReloadPunches,
  currentUser = 'Operador Fireowl',
  userRole = 'TECNICO',
  schedule,
}) => {
  const isManager = userRole === 'ADMINISTRATIVO' || userRole === 'GESTOR';
  const sched = useMemo(() => normalizeSchedule(schedule ?? DEFAULT_SCHEDULE), [schedule]);
  const scheduleLabel = `${sched[1].start} às ${sched[1].end} · intervalo ${sched[1].lunchMinutes} min`;
  const [now, setNow] = useState(() => new Date());
  const [punching, setPunching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [feedback, setFeedback] = useState<{ label: string; time: string } | null>(null);
  const [online, setOnline] = useState(true);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [timecardCfg, setTimecardCfg] = useState<{ blocks: TimecardBlock[]; periodLabel: string; fileLabel: string; logoUrl?: string } | null>(null);
  // Logo institucional (mesmo mecanismo dos demais PDFs: storage_path →
  // resolveLogoDataUrls → data URI). Ausente/sem storage → cai no vetor da marca.
  const [logoUrl, setLogoUrl] = useState<string | undefined>(undefined);
  const [recordPeriod, setRecordPeriod] = useState('');
  const [recordType, setRecordType] = useState<'TODOS' | PunchType>('TODOS');
  const [recordGps, setRecordGps] = useState<'TODOS' | 'COM_GPS' | 'SEM_GPS'>('TODOS');
  const [participantNames, setParticipantNames] = useState<Set<string> | null>(null);
  useEffect(() => {
    if (!isManager || !isSupabaseConfigured()) return;
    fetchTimeClockParticipants().then((rows) => setParticipantNames(new Set(rows.filter((r) => r.usesTimeClock).map((r) => r.name)))).catch(() => {});
  }, [isManager]);

  // Solicitações de ajuste de ponto
  const [adjustments, setAdjustments] = useState<PunchAdjustment[]>([]);
  const [showAdj, setShowAdj] = useState(false);
  const [adjSaving, setAdjSaving] = useState(false);
  const [adjForm, setAdjForm] = useState<{ refDate: string; type: TimePunch['type']; time: string; reason: string }>({
    refDate: '',
    type: 'SAIDA',
    time: '',
    reason: '',
  });

  const loadAdjustments = () => {
    if (!isSupabaseConfigured()) return;
    fetchAdjustments()
      .then(setAdjustments)
      .catch((err) => console.warn('Ajustes: falha ao carregar.', err));
  };

  // Feriados e ocorrências do dia (observação/atestado/feriado)
  const [holidays, setHolidays] = useState<Record<string, Holiday>>({});
  const [dayEntries, setDayEntries] = useState<DayEntry[]>([]);
  const [showDayModal, setShowDayModal] = useState(false);
  const [daySaving, setDaySaving] = useState(false);
  const [dayFile, setDayFile] = useState<File | null>(null);
  const [dayForm, setDayForm] = useState<{ refDate: string; kind: DayEntryKind; note: string }>({
    refDate: '',
    kind: 'OBSERVACAO',
    note: '',
  });

  const loadDayData = () => {
    if (!isSupabaseConfigured()) return;
    fetchHolidays()
      .then((list) => {
        const map: Record<string, Holiday> = {};
        list.forEach((h) => (map[h.date] = h));
        setHolidays(map);
      })
      .catch((err) => console.warn('Feriados: falha ao carregar.', err));
    fetchDayEntries()
      .then(setDayEntries)
      .catch((err) => console.warn('Ocorrências: falha ao carregar.', err));
  };

  useEffect(() => {
    loadAdjustments();
    loadDayData();
  }, []);
  useDomainRefresh('point', async () => { await onReloadPunches?.(); loadAdjustments(); loadDayData(); });

  // Resolve o logo institucional uma única vez (não bloqueia o PDF; se falhar,
  // o cabeçalho usa o vetor da marca — nunca quebra).
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let active = true;
    fetchCompanyProfile()
      .then(async (profile) => {
        const path = profile?.logoPrincipalPath || profile?.logoEscuroPath || profile?.logoClaroPath;
        if (!path) return;
        const map = await resolveLogoDataUrls([path]);
        if (active && map[path]) setLogoUrl(map[path]);
      })
      .catch((err) => console.warn('Logo institucional: não foi possível resolver.', err));
    return () => {
      active = false;
    };
  }, []);

  const closeTimecard = useCallback(() => setTimecardCfg(null), []);

  // Exportação da folha (admin/gestor)
  const [expEmployee, setExpEmployee] = useState('');
  const [expMonth, setExpMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
  });

  // Período do "Meu Espelho" do próprio usuário (mês corrente por padrão).
  const [myMonth, setMyMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
  });

  // Relógio em tempo real
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Indicador de sincronização (online/offline)
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  // Batidas de HOJE do usuário logado (estado canônico compartilhado com o
  // Painel do Técnico — mesma regra de sequência e mesmas batidas efetivas).
  const nowMs = now.getTime();
  const punchState = derivePunchState(punches, currentUser, nowMs);
  const { todays, entrada, almoco, retorno, saida, nextType } = punchState;

  // Horas trabalhadas (manhã + tarde)
  let workedMs = 0;
  if (entrada?.at) {
    const aEnd = almoco?.at ?? saida?.at ?? nowMs;
    workedMs += Math.max(0, aEnd - entrada.at);
  }
  if (retorno?.at) {
    const bEnd = saida?.at ?? nowMs;
    workedMs += Math.max(0, bEnd - retorno.at);
  }

  // Apresentação do status (cor/dot) a partir do estado canônico.
  const STATUS_UI = {
    FORA: { dot: 'bg-blue-500', badge: 'blue' as const },
    ALMOCO: { dot: 'bg-amber-500', badge: 'amber' as const },
    ENCERRADA: { dot: 'bg-slate-400', badge: 'slate' as const },
    TRABALHANDO: { dot: 'bg-emerald-500', badge: 'emerald' as const },
  } as const;
  const status = { label: punchState.statusLabel, ...STATUS_UI[punchState.statusKind] };

  const punchTime = (p?: TimePunch) => (p?.at ? fmtHM(new Date(p.at)) : '--');

  // ---- Alertas de escala (5 min antes) e batida faltante ----
  const todayCfg = sched[now.getDay()];
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const entryMin = hmToMinutes(todayCfg.start);
  const exitMin = hmToMinutes(todayCfg.end);
  // Alerta de entrada: a partir de 5 min antes até 90 min depois, enquanto não bater
  const entryDue = todayCfg.works && !entrada && nowMin >= entryMin - 5 && nowMin <= entryMin + 90;
  // Alerta de saída: a partir de 5 min antes, com entrada já batida e sem saída
  const exitDue = todayCfg.works && !!entrada && !saida && nowMin >= exitMin - 5;

  const dayKeyToday = new Date(nowMs).toDateString();
  const missingDay = useMemo(() => {
    const byDay = new Map<string, TimePunch[]>();
    punches
      .filter((p) => p.employeeName === currentUser && p.at)
      .forEach((p) => {
        const key = new Date(p.at!).toDateString();
        if (!byDay.has(key)) byDay.set(key, []);
        byDay.get(key)!.push(p);
      });
    let found: Date | null = null;
    byDay.forEach((list, key) => {
      if (key === dayKeyToday) return;
      const d = new Date(key);
      if (!sched[d.getDay()].works) return;
      const hasEntrada = list.some((p) => p.type === 'ENTRADA');
      const hasSaida = list.some((p) => p.type === 'SAIDA');
      if (hasEntrada && !hasSaida && (!found || d > found)) found = d as Date;
    });
    return found as Date | null;
  }, [punches, currentUser, sched, dayKeyToday]);

  // A permissão de GPS é solicitada APENAS aqui, no clique de bater ponto
  // (nunca no carregamento do site).
  const handleBaterPonto = () => {
    if (punching || locating || !nextType) return;
    if (!('geolocation' in navigator)) {
      registerPunch();
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        registerPunch(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
      },
      async (err) => {
        setLocating(false);
        console.warn('GPS indisponível:', err);
        if (err.code === err.PERMISSION_DENIED) {
          const ok = await requestConfirm(
            'Permissão de localização negada.\n\nPara registrar com GPS, permita a localização no navegador.\n\nDeseja registrar o ponto MESMO ASSIM (sem localização)?'
          );
          if (!ok) return;
        }
        registerPunch(); // registra sem GPS (não inventa localização)
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const registerPunch = (lat?: number, lng?: number, accuracy?: number) => {
    if (!nextType) {
      setPunching(false);
      return;
    }
    const hasGps = typeof lat === 'number' && typeof lng === 'number';
    const d = new Date();
    const newPunch = buildPunch(nextType, currentUser, hasGps ? { lat: lat!, lng: lng!, accuracy } : undefined);
    onAddPunch(newPunch);
    setLastSync(d);
    setFeedback({ label: FEEDBACK_LABEL[nextType], time: fmtClock(d) });
    setPunching(false);
    setTimeout(() => setFeedback(null), 2000);
  };

  const hasGps = (p: TimePunch) => !!(p.lat || p.lng);
  const mapsUrl = (p: TimePunch) => `https://www.google.com/maps?q=${p.lat},${p.lng}`;
  // Janela em que a resolução assíncrona de endereço ainda é plausível.
  const ADDRESS_RESOLUTION_WINDOW_MS = 24 * 60 * 60 * 1000;
  // Rótulo humano do local da batida (apresentação — sem geocoding aqui).
  const locationLabel = (p: TimePunch) => {
    if (p.locationAddress) return p.locationAddress;
    if (!hasGps(p)) return 'Localização não informada';
    const recent = typeof p.at === 'number' && Date.now() - p.at < ADDRESS_RESOLUTION_WINDOW_MS;
    return recent ? 'Endereço sendo identificado' : 'Localização registrada';
  };

  const shortcut = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const greeting = now.getHours() < 12 ? 'Bom dia' : now.getHours() < 18 ? 'Boa tarde' : 'Boa noite';

  const fmtDateInput = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

  // Dias (YYYY-MM-DD) com batida do usuário atual — para marcar no mini-calendário.
  const punchDaySet = useMemo(() => {
    const s = new Set<string>();
    punches.forEach((p) => {
      if (p.at && p.employeeName === currentUser) {
        s.add(`${new Date(p.at).getFullYear()}-${pad2(new Date(p.at).getMonth() + 1)}-${pad2(new Date(p.at).getDate())}`);
      }
    });
    return s;
  }, [punches, currentUser]);

  // Horário original (evidência) da batida que o ajuste corrige, quando há
  // exatamente uma batida compatível. Usado no formulário e na aprovação.
  const originalPunchTimeFor = (employeeName: string, refDate: string, type: TimePunch['type']): string | null => {
    const matching = punches.filter((p) => {
      const originalAt = p.originalAt ?? p.at;
      return p.employeeName === employeeName && p.type === type && originalAt != null
        && fmtDateInput(new Date(originalAt)) === refDate;
    });
    if (matching.length !== 1) return null;
    const originalAt = matching[0].originalAt ?? matching[0].at;
    return originalAt != null ? fmtClock(new Date(originalAt)) : null;
  };

  const openAdj = (prefill?: Date) => {
    setAdjForm({
      refDate: prefill ? fmtDateInput(prefill) : fmtDateInput(new Date()),
      type: 'SAIDA',
      time: '',
      reason: '',
    });
    setShowAdj(true);
  };
  const submitAdj = async () => {
    // Novo horário é obrigatório: sem ele o ajuste não pode ser aprovado nem
    // materializado como batida efetiva.
    if (adjSaving || !adjForm.refDate || !adjForm.reason.trim() || !hasRequestedTime(adjForm.time)) return;
    setAdjSaving(true);
    try {
      const matching = punches.filter((p) => {
        const originalAt = p.originalAt ?? p.at;
        return p.employeeName === currentUser && p.type === adjForm.type && originalAt != null
          && fmtDateInput(new Date(originalAt)) === adjForm.refDate;
      });
      if (matching.length > 1) {
        showToast('Há mais de uma batida desse tipo no dia. Selecione um registro específico antes de solicitar o ajuste.');
        return;
      }
      await createAdjustment({
        employeeName: currentUser,
        refDate: adjForm.refDate,
        type: adjForm.type,
        requestedTime: adjForm.time,
        reason: adjForm.reason.trim(),
        originalPunchId: matching[0]?.id,
      });
      setShowAdj(false);
      loadAdjustments();
    } catch (err) {
      console.error('Falha ao enviar solicitação de ajuste:', err);
      showToast('Não foi possível enviar a solicitação.');
    } finally {
      setAdjSaving(false);
    }
  };
  const [adjBusy, setAdjBusy] = useState<string | null>(null);
  const [selectedAdjustedPunch, setSelectedAdjustedPunch] = useState<TimePunch | null>(null);
  const reviewAdj = async (a: PunchAdjustment, status: 'APROVADO' | 'REJEITADO') => {
    if (adjBusy) return;
    setAdjBusy(a.id);
    try {
      // Bloqueio crítico: não é possível aprovar um ajuste de horário sem o
      // horário solicitado — isso geraria APROVADO + requested_time NULL.
      if (status === 'APROVADO' && !hasRequestedTime(a.requestedTime)) {
        showToast('Não é possível aprovar este ajuste porque o novo horário não foi informado.');
        return;
      }
      const matching = punches.filter((p) => {
        const originalAt = p.originalAt ?? p.at;
        return p.employeeName === a.employeeName && p.type === a.type && originalAt != null
          && fmtDateInput(new Date(originalAt)) === a.refDate;
      });
      const originalPunchId = a.originalPunchId || (matching.length === 1 ? matching[0].id : undefined);
      if (status === 'APROVADO' && matching.length > 1 && !originalPunchId) {
        showToast('Aprovação bloqueada: há mais de uma batida compatível e o ajuste não identifica a original.');
        return;
      }
      await updateAdjustmentStatus(a.id, status, undefined, { originalPunchId, reviewerName: currentUser });
      loadAdjustments();
      await onReloadPunches?.();
    } catch (err) {
      console.error('Falha ao revisar solicitação:', err);
      showToast('Não foi possível atualizar a solicitação. Verifique se as migrações do ponto foram aplicadas.');
    } finally {
      setAdjBusy(null);
    }
  };
  const adjStatusColor = (s: PunchAdjustment['status']) =>
    s === 'APROVADO' ? 'emerald' : s === 'REJEITADO' ? 'red' : 'amber';

  const todayHoliday = holidays[fmtDateInput(now)];

  const openDayModal = (prefill?: Date) => {
    setDayForm({ refDate: prefill ? fmtDateInput(prefill) : fmtDateInput(new Date()), kind: 'OBSERVACAO', note: '' });
    setDayFile(null);
    setShowDayModal(true);
  };
  const submitDayEntry = async () => {
    if (daySaving || !dayForm.refDate) return;
    if (dayForm.kind === 'OBSERVACAO' && !dayForm.note.trim()) return;
    setDaySaving(true);
    try {
      let certificatePath: string | undefined;
      if (dayForm.kind === 'ATESTADO' && dayFile) certificatePath = await uploadCertificate(dayFile);
      await createDayEntry({
        employeeName: currentUser,
        refDate: dayForm.refDate,
        kind: dayForm.kind,
        note: dayForm.note.trim(),
        certificatePath,
        authorName: currentUser,
        authorRole: userRole,
      });
      setShowDayModal(false);
      loadDayData();
    } catch (err) {
      console.error('Falha ao salvar ocorrência do dia:', err);
      showToast('Não foi possível salvar a ocorrência.');
    } finally {
      setDaySaving(false);
    }
  };
  const removeDayEntry = async (id: string) => {
    if (!await requestConfirm('Remover esta ocorrência?')) return;
    try {
      await deleteDayEntry(id);
      setDayEntries((prev) => prev.filter((x) => x.id !== id));
    } catch (err) {
      console.error('Falha ao remover ocorrência:', err);
      showToast('Não foi possível remover.');
    }
  };
  const openCertificate = async (path: string) => {
    try {
      window.open(await signedDocUrl(path), '_blank');
    } catch {
      showToast('Não foi possível abrir o atestado.');
    }
  };
  const dayKindColor = (k: DayEntryKind) =>
    k === 'ATESTADO' ? 'amber' : k === 'FERIADO' ? 'blue' : k === 'FOLGA' ? 'slate' : 'emerald';
  const dayKindLabel = (k: DayEntryKind) =>
    k === 'ATESTADO' ? 'Atestado' : k === 'FERIADO' ? 'Feriado' : k === 'FOLGA' ? 'Folga' : 'Observação';

  // ---- Exportação da folha de ponto (admin/gestor) ----
  const TYPE_LABEL: Record<PunchType, string> = {
    ENTRADA: 'Entrada',
    PAUSA: 'Saída Almoço',
    RETORNO: 'Retorno',
    SAIDA: 'Saída',
  };

  const employees = useMemo(
    () => Array.from(new Set(punches.map((p) => p.employeeName).filter((name) => Boolean(name) && (!participantNames || participantNames.has(name))))).sort(),
    [punches, participantNames]
  );
  const filteredRecentPunches = useMemo(() => punches.filter((p) => {
    const period = p.at ? new Date(p.at).toISOString().slice(0, 7) : '';
    return (!recordPeriod || period === recordPeriod)
      && (recordType === 'TODOS' || p.type === recordType)
      && (recordGps === 'TODOS' || (recordGps === 'COM_GPS' ? hasGps(p) : !hasGps(p)));
  }), [punches, recordGps, recordPeriod, recordType]);

  const monthPunches = punches
    .filter((p) => {
      if (!p.at) return false;
      const d = new Date(p.at);
      const key = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
      return key === expMonth && (!expEmployee || p.employeeName === expEmployee);
    })
    .sort((a, b) => (a.at || 0) - (b.at || 0));

  // Horas trabalhadas de um conjunto de batidas de um mesmo dia — via a fonte
  // de verdade única (lib/timecard). Retorna 0 quando não calculável, apenas
  // para somatórios; a classificação (incompleta/inconsistente) vem de
  // consolidateDay().status.
  const dayWorkedMs = (dayPunches: TimePunch[]): number => consolidateDay(dayPunches, nowMs).workedMs ?? 0;

  // ---- Banco de horas real (a partir das batidas + escala + feriados) ----
  // Jornada prevista para uma data: 0 em feriado, folga da escala ou dia
  // justificado por atestado/folga.
  const expectedMsForDate = (d: Date, emp: string = currentUser): number => {
    const dk = fmtDateInput(d);
    if (holidays[dk]) return 0;
    const cfg = sched[d.getDay()];
    if (!cfg.works) return 0;
    const justified = dayEntries.some(
      (e) => e.employeeName === emp && e.refDate === dk && (e.kind === 'ATESTADO' || e.kind === 'FOLGA')
    );
    if (justified) return 0;
    const mins = hmToMinutes(cfg.end) - hmToMinutes(cfg.start) - (cfg.lunchMinutes || 0);
    return Math.max(0, mins) * 60000;
  };

  // Banco de horas acumulado (all-time, apenas dias efetivamente trabalhados)
  // de UM funcionário, via a consolidação única.
  const bankMsFor = (emp: string): number => {
    const recs = buildDailyTimeRecords(punches.filter((p) => p.employeeName === emp && p.at), { nowMs });
    let bank = 0;
    for (const r of recs) {
      if (r.workedMs != null && r.workedMs > 0) {
        const [y, m, d] = r.dateKey.split('-').map(Number);
        bank += r.workedMs - expectedMsForDate(new Date(y, m - 1, d), emp);
      }
    }
    return bank;
  };

  // Ocorrências (feriado/atestado/folga/obs) de um mês para um funcionário,
  // como mapa YYYY-MM-DD → texto (usado no Espelho e para incluir dias sem batida).
  const occurrencesForMonth = (emp: string, month: string): Record<string, string> => {
    const map: Record<string, string> = {};
    Object.keys(holidays)
      .filter((dk) => dk.startsWith(month))
      .forEach((dk) => (map[dk] = `Feriado: ${holidays[dk].name}`));
    dayEntries
      .filter((e) => e.employeeName === emp && e.refDate.startsWith(month))
      .forEach((e) => {
        if (e.kind === 'FERIADO') return; // feriado tratado acima
        map[e.refDate] = `${dayKindLabel(e.kind)}${e.note ? `: ${e.note}` : ''}`;
      });
    return map;
  };

  const monthPeriodLabel = (month: string): string => {
    const [y, m] = month.split('-').map(Number);
    const last = new Date(y, m, 0).getDate();
    return `01/${pad2(m)}/${y} a ${pad2(last)}/${pad2(m)}/${y}`;
  };

  // Monta os blocos do Espelho de Ponto para o PDF canônico. Um bloco por
  // funcionário (admin "todos" gera vários; cada um em nova página no PDF).
  const buildTimecardBlocks = (month: string, employeeFilter?: string): TimecardBlock[] => {
    const inMonth = (p: TimePunch) =>
      p.at != null && `${new Date(p.at).getFullYear()}-${pad2(new Date(p.at).getMonth() + 1)}` === month;
    let emps: string[];
    if (employeeFilter) {
      emps = [employeeFilter];
    } else {
      const set = new Set<string>();
      punches.filter(inMonth).forEach((p) => p.employeeName && (!participantNames || participantNames.has(p.employeeName)) && set.add(p.employeeName));
      dayEntries.filter((e) => e.refDate.startsWith(month)).forEach((e) => e.employeeName && (!participantNames || participantNames.has(e.employeeName)) && set.add(e.employeeName));
      emps = Array.from(set).sort();
    }
    return emps.map((emp) => {
      const occ = occurrencesForMonth(emp, month);
      const empPunches = punches.filter((p) => p.employeeName === emp && inMonth(p));
      const records = buildDailyTimeRecords(empPunches, { extraDateKeys: Object.keys(occ), nowMs });
      const summary = computePeriodSummary(records, (dk) => {
        const [y, m, d] = dk.split('-').map(Number);
        return expectedMsForDate(new Date(y, m - 1, d), emp);
      });
      return {
        employee: emp,
        records,
        summary,
        occurrences: occ,
        scheduleLabel,
        bank: fmtHoursShort(bankMsFor(emp), true),
      };
    });
  };

  const openMyTimecard = () => {
    setTimecardCfg({
      blocks: buildTimecardBlocks(myMonth, currentUser),
      periodLabel: monthPeriodLabel(myMonth),
      fileLabel: `${currentUser}_${myMonth}`,
      logoUrl,
    });
  };

  const openAdminTimecard = () => {
    setTimecardCfg({
      blocks: buildTimecardBlocks(expMonth, expEmployee || undefined),
      periodLabel: monthPeriodLabel(expMonth),
      fileLabel: expEmployee || 'todos',
      logoUrl,
    });
  };

  const hoursStats = useMemo(() => {
    // Agrupa batidas do usuário logado por dia (YYYY-MM-DD)
    const byDay = new Map<string, TimePunch[]>();
    punches
      .filter((p) => p.employeeName === currentUser && p.at)
      .forEach((p) => {
        const dk = fmtDateInput(new Date(p.at!));
        if (!byDay.has(dk)) byDay.set(dk, []);
        byDay.get(dk)!.push(p);
      });

    // Banco acumulado: apenas sobre dias efetivamente trabalhados (com batida),
    // para não penalizar dias anteriores à adoção do sistema. Fonte única.
    const bankMs = bankMsFor(currentUser);

    // Semana atual (segunda a domingo)
    const base = new Date(nowMs);
    const dow = (base.getDay() + 6) % 7; // 0 = segunda
    const weekStart = new Date(base.getFullYear(), base.getMonth(), base.getDate() - dow);
    let prevMs = 0;
    let realMs = 0;
    let extraMs = 0;
    let atrasos = 0;
    for (let i = 0; i < 7; i++) {
      const day = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i);
      const dk = fmtDateInput(day);
      const exp = expectedMsForDate(day);
      prevMs += exp;
      const list = byDay.get(dk);
      if (list && list.length) {
        const worked = dayWorkedMs(list);
        realMs += worked;
        if (worked > exp) extraMs += worked - exp;
        const ent = list.find((p) => p.type === 'ENTRADA');
        if (ent?.at && sched[day.getDay()].works && !holidays[dk]) {
          const em = new Date(ent.at);
          const entMin = em.getHours() * 60 + em.getMinutes();
          if (entMin > hmToMinutes(sched[day.getDay()].start) + 5) atrasos++;
        }
      }
    }
    return { bankMs, prevMs, realMs, extraMs, atrasos };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [punches, currentUser, sched, holidays, dayEntries, new Date(nowMs).toDateString()]);

  const fmtShort = (ms: number) => {
    const sign = ms < 0 ? '-' : '';
    const totalMin = Math.round(Math.abs(ms) / 60000);
    return `${sign}${Math.floor(totalMin / 60)}h${pad2(totalMin % 60)}`;
  };
  const week = {
    previstas: fmtShort(hoursStats.prevMs),
    realizadas: fmtShort(hoursStats.realMs),
    extras: fmtShort(hoursStats.extraMs),
    banco: `${hoursStats.bankMs >= 0 ? '+' : ''}${fmtShort(hoursStats.bankMs)}`,
    atrasos: hoursStats.atrasos,
  };

  // dd/mm/aaaa a partir de uma chave YYYY-MM-DD
  const dayKeyToBr = (dk: string) => dk.split('-').reverse().join('/');

  // Ocorrência do dia (feriado tem prioridade; depois atestado/folga/observação)
  const occurrenceFor = (emp: string, dayKey: string): string => {
    if (holidays[dayKey]) return `Feriado: ${holidays[dayKey].name}`;
    const entries = dayEntries.filter((e) => e.employeeName === emp && e.refDate === dayKey);
    if (entries.some((e) => e.kind === 'ATESTADO')) return 'Atestado';
    if (entries.some((e) => e.kind === 'FOLGA')) return 'Folga';
    const fe = entries.find((e) => e.kind === 'FERIADO');
    if (fe) return `Feriado: ${fe.note || 'manual'}`;
    const ob = entries.find((e) => e.kind === 'OBSERVACAO');
    if (ob) return ob.note ? `Obs.: ${ob.note}` : 'Observação';
    return '';
  };

  // Agrupa por dia. Inclui feriados e ocorrências (atestado/folga) mesmo sem batidas.
  const buildData = () => {
    const detail: string[][] = [
      ['Funcionário', 'Data', 'Dia', 'Tipo', 'Hora', 'Latitude', 'Longitude', 'Precisão (m)'],
    ];
    const summary: string[][] = [
      ['Funcionário', 'Data', 'Entrada', 'Almoço', 'Retorno', 'Saída', 'Horas trabalhadas', 'Ocorrência'],
    ];

    // Agrupa batidas por funcionário + dia (chave YYYY-MM-DD)
    const groups = new Map<string, TimePunch[]>();
    monthPunches.forEach((p) => {
      const d = new Date(p.at!);
      const key = `${p.employeeName}||${fmtDateInput(d)}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(p);
      detail.push([
        p.employeeName,
        d.toLocaleDateString('pt-BR'),
        d.toLocaleDateString('pt-BR', { weekday: 'short' }),
        TYPE_LABEL[p.type],
        fmtClock(d),
        hasGps(p) ? p.lat.toFixed(6) : '',
        hasGps(p) ? p.lng.toFixed(6) : '',
        p.accuracy ? String(p.accuracy) : '',
      ]);
    });

    // Feriados e ocorrências (atestado/folga/obs) do período selecionado
    const monthHolidayDates = Object.keys(holidays).filter((dt) => dt.startsWith(expMonth));
    const monthEntries = dayEntries.filter(
      (e) => e.refDate.startsWith(expMonth) && (!expEmployee || e.employeeName === expEmployee)
    );

    // Funcionários no escopo (selecionado, ou todos com batida/ocorrência no mês)
    const empSet = new Set<string>();
    if (expEmployee) empSet.add(expEmployee);
    else {
      monthPunches.forEach((p) => p.employeeName && empSet.add(p.employeeName));
      monthEntries.forEach((e) => e.employeeName && empSet.add(e.employeeName));
      if (empSet.size === 0 && monthHolidayDates.length) empSet.add('(empresa)'); // só feriados, sem funcionário
    }

    let totalMs = 0;
    const rows: { emp: string; dk: string; line: string[] }[] = [];

    empSet.forEach((emp) => {
      const dayKeys = new Set<string>();
      groups.forEach((_, key) => {
        const [e, dk] = key.split('||');
        if (e === emp) dayKeys.add(dk);
      });
      monthEntries.forEach((e) => {
        if (e.employeeName === emp) dayKeys.add(e.refDate);
      });
      monthHolidayDates.forEach((dk) => dayKeys.add(dk));

      dayKeys.forEach((dk) => {
        const dayPunches = groups.get(`${emp}||${dk}`) || [];
        const t = (type: PunchType) => {
          const found =
            type === 'SAIDA'
              ? [...dayPunches].reverse().find((p) => p.type === type)
              : dayPunches.find((p) => p.type === type);
          return found?.at ? fmtHM(new Date(found.at)) : '--';
        };
        const cons = dayPunches.length ? consolidateDay(dayPunches, nowMs) : null;
        const ms = cons?.workedMs ?? 0;
        totalMs += ms;
        rows.push({
          emp,
          dk,
          line: [
            emp,
            dayKeyToBr(dk),
            t('ENTRADA'),
            t('PAUSA'),
            t('RETORNO'),
            t('SAIDA'),
            cons && cons.workedMs == null ? '—' : fmtDuration(ms),
            occurrenceFor(emp, dk) || (cons ? dayStatusLabel(cons.status) : '') || '—',
          ],
        });
      });
    });

    rows.sort((a, b) => a.dk.localeCompare(b.dk) || a.emp.localeCompare(b.emp));
    rows.forEach((r) => summary.push(r.line));

    const feriados = monthHolidayDates.length;
    const atestados = monthEntries.filter((e) => e.kind === 'ATESTADO').length;
    summary.push(['', '', '', '', '', '', 'TOTAL', fmtDuration(totalMs)]);

    return { detail, summary, totalMs, feriados, atestados };
  };

  const exportCSV = () => {
    const { detail, summary, feriados, atestados } = buildData();
    const toCsv = (rows: string[][]) =>
      rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n');
    const header = `Feriados no período;${feriados}\r\nAtestados no período;${atestados}\r\n\r\n`;
    const csv = `${header}RESUMO POR DIA\r\n${toCsv(summary)}\r\n\r\nDETALHAMENTO DAS BATIDAS\r\n${toCsv(detail)}`;
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `folha-ponto_${expEmployee || 'todos'}_${expMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col w-full p-3 md:p-6 gap-3 md:gap-4">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-3 border-b border-border pb-3">
        <div className="min-w-0">
          <span className="text-[10px] font-semibold text-fg-secondary uppercase tracking-wider">
            Portaria MTP 671/2021
          </span>
          <h1 className="text-lg md:text-2xl font-bold text-fg tracking-tight truncate">
            Ponto Eletrônico &amp; Frequência
          </h1>
        </div>

        {/* Relógio grande + sincronização */}
        <div className="text-right">
          <p className="font-data-mono text-2xl md:text-3xl font-bold text-fg tabular-nums leading-none">{fmtClock(now)}</p>
          <div className="flex items-center justify-end gap-3 mt-1.5">
            <span className="text-[10px] uppercase tracking-wider text-fg-muted">Horário oficial</span>
            <span
              className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase ${
                online ? 'text-emerald-600' : 'text-amber-600'
              }`}
              title={
                online
                  ? lastSync
                    ? `Última sincronização ${fmtClock(lastSync)}`
                    : 'Conectado'
                  : 'Sem conexão — registros ficam salvos localmente'
              }
            >
              <span className={`w-1.5 h-1.5 rounded-full ${online ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              {online ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>
      </div>

      {/* Atalhos rápidos */}
      <div className="flex flex-wrap gap-2">
        {[
          // "Registrar" é redundante no mobile (o botão principal de próxima
          // batida já está visível) — some abaixo de md.
          { id: 'card-jornada', label: 'Registrar', icon: 'touch_app', mobileHidden: true },
          { id: 'card-timeline', label: 'Histórico', icon: 'timeline' },
          { id: 'card-banco', label: 'Banco de Horas', icon: 'savings' },
          { id: 'card-registros', label: 'Registros', icon: 'fact_check' },
        ].map((s) => (
          <button
            key={s.id}
            onClick={() => shortcut(s.id)}
            className={`items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-surface text-fg-secondary hover:border-primary hover:text-primary text-xs font-semibold transition-colors ${s.mobileHidden ? 'hidden md:inline-flex' : 'inline-flex'}`}
          >
            <span className="material-symbols-outlined text-base">{s.icon}</span>
            {s.label}
          </button>
        ))}
        <div className="flex items-center gap-1.5 ml-auto">
          <label className="sr-only" htmlFor="my-espelho-month">Mês do espelho</label>
          <input
            id="my-espelho-month"
            type="month"
            value={myMonth}
            onChange={(e) => setMyMonth(e.target.value || myMonth)}
            title="Período do espelho de ponto"
            className="min-w-[9.5rem] border border-border rounded-lg px-2 py-1.5 text-xs text-fg-secondary bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <button
            onClick={openMyTimecard}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-navy text-white hover:bg-navy-3 text-xs font-semibold transition-colors"
          >
            <span className="material-symbols-outlined text-base">description</span>
            Meu Espelho
          </button>
        </div>
      </div>

      {/* ===== Alertas / lembretes ===== */}
      {(entryDue || exitDue || missingDay || todayHoliday) && (
        <div className="flex flex-col gap-2">
          {todayHoliday && (
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-800 rounded-xl px-4 py-3 text-xs font-semibold">
              <span className="material-symbols-outlined text-base">celebration</span>
              Hoje é feriado: {todayHoliday.name} ({todayHoliday.type}).
            </div>
          )}
          {entryDue && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-3 text-xs font-semibold">
              <span className="material-symbols-outlined text-base">notifications_active</span>
              {nowMin < entryMin
                ? `Faltam ${entryMin - nowMin} min para o horário de entrada (${todayCfg.start}). Não esqueça de bater o ponto.`
                : `Você ainda não registrou a entrada de hoje (previsto ${todayCfg.start}).`}
            </div>
          )}
          {exitDue && (
            <div className="flex items-center gap-2 bg-navy/5 border border-primary/20 text-primary rounded-xl px-4 py-3 text-xs font-semibold">
              <span className="material-symbols-outlined text-base">notifications_active</span>
              {nowMin < exitMin
                ? `Faltam ${exitMin - nowMin} min para o horário de saída (${todayCfg.end}).`
                : `Passou do horário de saída (${todayCfg.end}). Registre sua saída.`}
            </div>
          )}
          {missingDay && (
            <div className="flex items-center justify-between gap-2 bg-red-50 border border-danger/30 text-danger rounded-xl px-4 py-3 text-xs font-semibold">
              <span className="flex items-center gap-2">
                <span className="material-symbols-outlined text-base">error</span>
                Você não registrou a saída de {missingDay.toLocaleDateString('pt-BR')}.
              </span>
              <button
                onClick={() => openAdj(missingDay || undefined)}
                className="shrink-0 bg-danger hover:bg-danger-hover text-white px-3 py-1.5 rounded-lg text-[11px] uppercase tracking-wide"
              >
                Solicitar ajuste
              </button>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ===== Card da Jornada + Botão inteligente ===== */}
        <div id="card-jornada" className="lg:col-span-2 bg-surface rounded-xl shadow-sm p-6 relative overflow-hidden">
          {/* Feedback pós-batida */}
          {feedback && (
            <div className="absolute inset-0 z-20 bg-white/95 flex flex-col items-center justify-center gap-2 animate-[fadeIn_0.15s_ease-out]">
              <span className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-4xl">check</span>
              </span>
              <p className="font-bold text-fg">{feedback.label}</p>
              <p className="font-data-mono text-lg text-fg-secondary">{feedback.time}</p>
              <p className="text-xs text-emerald-600 font-semibold">Bom trabalho!</p>
            </div>
          )}

          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-lg font-bold text-fg">
                {greeting}, <span className="text-primary">{currentUser}</span> 👋
              </p>
              <p className="text-xs text-fg-secondary capitalize mt-0.5">{friendlyDate(now)}</p>
            </div>
            <Badge color={status.badge}>
              <span className={`w-1.5 h-1.5 rounded-full ${status.dot} inline-block mr-1`} />
              {status.label}
            </Badge>
          </div>

          {/* Marcos da jornada — grade completa apenas no desktop. No mobile a
              tela é orientada à próxima ação (bloco md:hidden abaixo). */}
          <div className="hidden md:grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
            {[
              { label: 'Entrada', p: entrada },
              { label: 'Almoço', p: almoco },
              { label: 'Retorno', p: retorno },
              { label: 'Saída', p: saida },
            ].map((slot) => (
              <div key={slot.label} className="bg-surface-2 border border-border rounded-lg p-3 text-center">
                <p className="text-[10px] uppercase tracking-wider text-fg-muted">{slot.label}</p>
                <p className={`font-data-mono text-lg font-bold mt-0.5 ${slot.p ? 'text-fg' : 'text-fg-muted'}`}>
                  {punchTime(slot.p)}
                </p>
              </div>
            ))}
          </div>

          {/* Mobile: última marca relevante + próxima batida (foco na ação) */}
          <div className="md:hidden mt-4 space-y-2.5">
            {punchState.lastRelevant && punchState.statusKind !== 'FORA' && (
              <div className="flex items-center justify-between rounded-lg bg-surface-2 border border-border px-3 py-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-fg-muted">
                  {PUNCH_SHORT[punchState.lastRelevant.type]}
                </span>
                <span className="font-data-mono text-base font-bold text-fg">{punchTime(punchState.lastRelevant)}</span>
              </div>
            )}
            <div className="text-center">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-fg-muted">Próxima batida</p>
              <p className="text-lg font-bold text-fg">{nextType ? PUNCH_SHORT[nextType] : 'Nenhuma batida pendente'}</p>
            </div>
          </div>

          {/* Previsto x trabalhado */}
          <div className="flex flex-wrap items-center justify-between gap-3 mt-4 text-xs">
            <span className="text-fg-secondary">
              Jornada prevista:{' '}
              <strong className="text-fg font-data-mono">
                {todayCfg.works ? `${todayCfg.start} às ${todayCfg.end}` : 'Folga hoje'}
              </strong>
            </span>
            <span className="text-fg-secondary">
              Horas trabalhadas: <strong className="text-primary font-data-mono">{fmtDuration(workedMs)}</strong>
            </span>
          </div>

          {/* Botão inteligente */}
          <button
            onClick={handleBaterPonto}
            disabled={punching || locating || !nextType}
            className={`mt-5 w-full rounded-2xl py-6 text-white font-bold uppercase tracking-wider text-sm transition-all shadow-md flex flex-col items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-70 ${
              nextType ? NEXT_INFO[nextType].classes : 'bg-slate-400'
            }`}
          >
            <span className={`material-symbols-outlined text-4xl ${punching || locating ? 'animate-spin' : ''}`}>
              {locating ? 'my_location' : punching ? 'progress_activity' : nextType ? NEXT_INFO[nextType].icon : 'task_alt'}
            </span>
            {locating
              ? 'Obtendo localização...'
              : punching
              ? 'Registrando...'
              : nextType
              ? NEXT_INFO[nextType].label
              : 'Jornada encerrada'}
          </button>

          <p className="text-[10px] text-fg-muted mt-3 text-center flex items-center justify-center gap-1">
            <span className="material-symbols-outlined text-sm">location_on</span>
            A localização é solicitada apenas ao registrar o ponto · MTP 671/2021
          </p>
        </div>

        {/* ===== Coluna lateral: Calendário + Escala + Semana + Banco ===== */}
        <div className="flex flex-col gap-6">
          {/* Mini-calendário com feriados em evidência */}
          <MiniCalendar holidays={holidays} punchDays={punchDaySet} today={now} />

          {/* Escala */}
          <div className="bg-surface rounded-xl shadow-sm p-5">
            <h4 className="text-xs font-bold text-fg-secondary uppercase tracking-wider mb-3">Sua escala</h4>
            <div className="space-y-1.5 text-xs">
              {sched.map((d, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between ${i === now.getDay() ? 'font-bold text-primary' : 'text-fg-secondary'}`}
                >
                  <span>{WEEKDAY_SHORT[i]}</span>
                  <span className="font-data-mono">
                    {d.works ? `${d.start}–${d.end} · ${d.lunchMinutes}min` : 'Folga'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Resumo da semana */}
          <div className="bg-surface rounded-xl shadow-sm p-5">
            <h4 className="text-xs font-bold text-fg-secondary uppercase tracking-wider mb-3">Esta semana</h4>
            <div className="space-y-2 text-xs">
              {[
                { k: 'Horas previstas', v: week.previstas, c: 'text-fg' },
                { k: 'Horas realizadas', v: week.realizadas, c: 'text-primary' },
                { k: 'Horas extras', v: week.extras, c: 'text-emerald-600' },
                { k: 'Atrasos', v: String(week.atrasos), c: 'text-fg' },
              ].map((r) => (
                <div key={r.k} className="flex items-center justify-between">
                  <span className="text-fg-secondary">{r.k}</span>
                  <span className={`font-data-mono font-bold ${r.c}`}>{r.v}</span>
                </div>
              ))}
            </div>
            <p className="text-[9px] text-fg-muted mt-2">
              Calculado das batidas × escala (feriados e atestados abatidos do previsto).
            </p>
          </div>

          {/* Banco de horas */}
          <div id="card-banco" className="bg-navy text-white rounded-xl shadow-sm p-5">
            <h4 className="text-[10px] font-bold text-white/60 uppercase tracking-wider">Banco de horas</h4>
            <p className={`font-data-mono text-3xl font-bold mt-1 ${hoursStats.bankMs >= 0 ? 'text-emerald-300' : 'text-amber-300'}`}>
              {week.banco}
            </p>
            <p className="text-[10px] text-white/60 mt-1">Saldo acumulado sobre dias trabalhados</p>
          </div>
        </div>
      </div>

      {/* ===== Timeline de hoje ===== */}
      <div id="card-timeline" className="bg-surface rounded-xl shadow-sm p-6">
        <h3 className="text-xs font-bold text-fg-secondary uppercase tracking-wider mb-4">Hoje</h3>
        {todays.length === 0 ? (
          <p className="text-xs text-fg-muted">Nenhuma batida registrada hoje.</p>
        ) : (
          <ol className="relative border-l-2 border-border ml-2 space-y-4">
            {todays.map((p) => (
              <li key={p.id} className="ml-4 relative">
                <span className="absolute -left-[1.42rem] top-1 w-3 h-3 rounded-full bg-navy ring-4 ring-white" />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-data-mono font-bold text-fg">{p.at ? fmtHM(new Date(p.at)) : '--'}</p>
                    <p className="text-[11px] text-fg-secondary">
                      {p.type === 'ENTRADA'
                        ? 'Entrada'
                        : p.type === 'PAUSA'
                        ? 'Saída para almoço'
                        : p.type === 'RETORNO'
                        ? 'Retorno'
                        : 'Saída'}
                    </p>
                  </div>
                  {hasGps(p) && (
                    <a
                      href={mapsUrl(p)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-primary font-semibold hover:underline flex items-center gap-0.5"
                    >
                      <span className="material-symbols-outlined text-sm">map</span> ver no mapa
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* ===== Exportar folha de ponto (admin/gestor) ===== */}
      {isManager && (
        <div className="bg-surface rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-8 h-8 rounded-lg bg-navy/10 text-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-lg">download</span>
            </span>
            <div>
              <h3 className="font-display text-sm font-bold uppercase tracking-wide text-primary">
                Folha de ponto mensal
              </h3>
              <p className="text-[11px] text-fg-muted">Exporte os registros por funcionário e mês.</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="flex-1">
              <label className="block text-fg-secondary mb-1 font-semibold uppercase text-[11px]">Funcionário</label>
              <select
                value={expEmployee}
                onChange={(e) => setExpEmployee(e.target.value)}
                className="w-full border border-border rounded-lg p-2.5 text-xs text-fg bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">Todos os funcionários</option>
                {employees.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-fg-secondary mb-1 font-semibold uppercase text-[11px]">Mês</label>
              <input
                type="month"
                value={expMonth}
                onChange={(e) => setExpMonth(e.target.value)}
                className="w-full border border-border rounded-lg p-2.5 text-xs text-fg bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={exportCSV}
                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-2.5 rounded-lg transition-colors"
              >
                <span className="material-symbols-outlined text-base">table_view</span> Excel
              </button>
              <button
                type="button"
                onClick={openAdminTimecard}
                className="flex items-center gap-1.5 bg-danger hover:bg-danger-hover text-white text-xs font-semibold px-4 py-2.5 rounded-lg transition-colors"
              >
                <span className="material-symbols-outlined text-base">picture_as_pdf</span> PDF
              </button>
            </div>
          </div>
          <p className="text-[11px] text-fg-secondary mt-2">
            {monthPunches.length} registro(s) no período selecionado.
          </p>
        </div>
      )}

      {/* ===== Ocorrências do dia (observação / atestado / feriado) ===== */}
      <div className="bg-surface rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-navy/10 text-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-lg">event_note</span>
            </span>
            <div>
              <h3 className="font-display text-sm font-bold uppercase tracking-wide text-primary">
                Ocorrências do dia
              </h3>
              <p className="text-[11px] text-fg-muted">Observação, atestado (com anexo) ou feriado.</p>
            </div>
          </div>
          <button
            onClick={() => openDayModal()}
            className="inline-flex items-center gap-1.5 bg-navy hover:bg-navy-3 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
          >
            <span className="material-symbols-outlined text-base">add</span> Registrar
          </button>
        </div>

        {dayEntries.length === 0 ? (
          <p className="text-xs text-fg-muted">Nenhuma ocorrência registrada.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {dayEntries.map((d) => (
              <div
                key={d.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border border-border rounded-lg p-3 text-xs"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-fg">
                    {isManager && <span className="text-fg-secondary">{d.employeeName} · </span>}
                    {d.refDate.split('-').reverse().join('/')}
                    {d.authorName ? <span className="text-fg-muted"> · por {d.authorName}</span> : null}
                  </p>
                  {d.note && <p className="text-fg-secondary truncate">{d.note}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge color={dayKindColor(d.kind)}>{dayKindLabel(d.kind)}</Badge>
                  {d.certificatePath && (
                    <button
                      onClick={() => openCertificate(d.certificatePath!)}
                      className="text-primary font-semibold hover:underline"
                    >
                      ver atestado
                    </button>
                  )}
                  <button
                    onClick={() => removeDayEntry(d.id)}
                    title="Remover"
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-fg-muted hover:text-danger hover:bg-red-50 transition-colors"
                  >
                    <span className="material-symbols-outlined text-base">delete</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ===== Solicitações de ajuste ===== */}
      <div className="bg-surface rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-navy/10 text-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-lg">edit_calendar</span>
            </span>
            <div>
              <h3 className="font-display text-sm font-bold uppercase tracking-wide text-primary">
                Solicitações de ajuste
              </h3>
              <p className="text-[11px] text-fg-muted">
                {isManager ? 'Aprove ou rejeite ajustes da equipe.' : 'Peça correção de uma batida.'}
              </p>
            </div>
          </div>
          <button
            onClick={() => openAdj()}
            className="inline-flex items-center gap-1.5 bg-navy hover:bg-navy-3 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
          >
            <span className="material-symbols-outlined text-base">add</span> Nova solicitação
          </button>
        </div>

        {adjustments.length === 0 ? (
          <p className="text-xs text-fg-muted">Nenhuma solicitação registrada.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {adjustments.map((a) => (
              <div
                key={a.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border border-border rounded-lg p-3 text-xs"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-fg">
                    {isManager && <span className="text-fg-secondary">{a.employeeName} · </span>}
                    {a.type} em {a.refDate.split('-').reverse().join('/')}
                  </p>
                  {(() => {
                    const orig = originalPunchTimeFor(a.employeeName, a.refDate, a.type);
                    return (
                      <p className="text-[11px] text-fg-secondary mt-0.5">
                        {orig && <>Original: <span className="font-data-mono font-semibold">{orig}</span> · </>}
                        Solicitado:{' '}
                        {a.requestedTime
                          ? <span className="font-data-mono font-semibold text-primary">{a.requestedTime}</span>
                          : <span className="text-danger font-semibold">não informado</span>}
                      </p>
                    );
                  })()}
                  <p className="text-fg-secondary truncate">{a.reason || '—'}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge color={adjStatusColor(a.status)}>{a.status}</Badge>
                  {isManager && a.status === 'PENDENTE' && (
                    <>
                      <button
                        onClick={() => reviewAdj(a, 'APROVADO')}
                        disabled={adjBusy === a.id || !hasRequestedTime(a.requestedTime)}
                        title={!hasRequestedTime(a.requestedTime) ? 'Não é possível aprovar sem o novo horário informado.' : undefined}
                        className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {adjBusy === a.id ? '...' : 'Aprovar'}
                      </button>
                      <button
                        onClick={() => reviewAdj(a, 'REJEITADO')}
                        disabled={adjBusy === a.id}
                        className="px-2.5 py-1 rounded-lg bg-danger hover:bg-danger-hover text-white text-[11px] font-semibold disabled:opacity-60"
                      >
                        Rejeitar
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ===== Registros recentes ===== */}
      <div id="card-registros">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-3">
          <h3 className="text-xs font-bold text-fg-secondary uppercase tracking-wider">Registros recentes de frequência</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 w-full sm:w-auto">
            <input aria-label="Mês dos registros" type="month" value={recordPeriod} onChange={(e) => setRecordPeriod(e.target.value)} className="col-span-2 sm:col-span-1 min-w-0 border border-border rounded-lg px-2 py-2 text-[11px]" />
            <select aria-label="Tipo de batida" value={recordType} onChange={(e) => setRecordType(e.target.value as 'TODOS' | PunchType)} className="min-w-0 border border-border rounded-lg px-2 py-2 text-[11px]"><option value="TODOS">Tipos</option><option value="ENTRADA">Entrada</option><option value="PAUSA">Almoço</option><option value="RETORNO">Retorno</option><option value="SAIDA">Saída</option></select>
            <select aria-label="Situação da localização" value={recordGps} onChange={(e) => setRecordGps(e.target.value as 'TODOS' | 'COM_GPS' | 'SEM_GPS')} className="min-w-0 border border-border rounded-lg px-2 py-2 text-[11px]"><option value="TODOS">Localização</option><option value="COM_GPS">Com GPS</option><option value="SEM_GPS">Sem GPS</option></select>
          </div>
        </div>
        {filteredRecentPunches.length === 0 ? (
          <div className="bg-surface rounded-xl shadow-sm py-16 text-center text-fg-muted">
            <span className="material-symbols-outlined text-4xl text-fg-muted">schedule</span>
            <p className="mt-2 text-sm font-bold text-fg-secondary uppercase tracking-wider">Nenhuma batida registrada</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredRecentPunches.map((p) => (
              <DataListRow
                key={p.id}
                onClick={p.effectiveSource === 'adjusted' && p.originalAt != null ? () => setSelectedAdjustedPunch(p) : undefined}
                leading={
                  <span className="w-10 h-10 rounded-full bg-navy/10 text-primary flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-lg">person</span>
                  </span>
                }
                title={p.employeeName}
                meta={
                  <>
                    <span
                      className="flex min-w-0 max-w-full items-start gap-1"
                      title={hasGps(p) ? `Coordenadas registradas para auditoria${p.accuracy ? ` · precisão ~${p.accuracy}m` : ''}` : undefined}
                    >
                      <span className="material-symbols-outlined shrink-0 text-sm text-fg-muted">location_on</span>
                      <span className="min-w-0 whitespace-normal break-words leading-snug">
                        {locationLabel(p)}
                      </span>
                    </span>
                    {hasGps(p) && (
                      <a
                        href={mapsUrl(p)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary font-semibold hover:underline"
                      >
                        Ver no mapa
                      </a>
                    )}
                  </>
                }
                center={
                  <div className="text-left md:text-center">
                    <p className="text-[10px] text-fg-muted uppercase tracking-wider">Data &amp; hora</p>
                    <p className="font-data-mono text-fg-secondary font-semibold">{p.timestamp}</p>
                  </div>
                }
                right={
                  <>
                    <Badge color={p.type === 'ENTRADA' ? 'emerald' : p.type === 'PAUSA' ? 'amber' : p.type === 'SAIDA' ? 'red' : 'blue'}>
                      {p.type}
                    </Badge>
                    <Badge color={p.effectiveSource === 'adjusted' ? 'blue' : p.status === 'PENDENTE' ? 'amber' : 'emerald'} outline>
                      {effectivePunchLabel(p)}
                    </Badge>
                  </>
                }
              />
            ))}
          </div>
        )}
      </div>

      {selectedAdjustedPunch && (
        <div className="fixed inset-0 z-50 bg-navy/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setSelectedAdjustedPunch(null)}>
          <div className="bg-surface max-w-md w-full rounded-xl border border-border shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="font-display text-base font-bold text-primary uppercase tracking-wide">Detalhes do registro ajustado</h3>
              <button onClick={() => setSelectedAdjustedPunch(null)} className="text-fg-muted hover:text-fg-secondary font-bold text-xl" aria-label="Fechar">✕</button>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 px-6 py-5 text-xs">
              <div><dt className={labelCls}>Horário original</dt><dd className="font-data-mono font-semibold">{selectedAdjustedPunch.originalAt ? fmtClock(new Date(selectedAdjustedPunch.originalAt)) : '—'}</dd></div>
              <div><dt className={labelCls}>Horário ajustado</dt><dd className="font-data-mono font-semibold text-primary">{selectedAdjustedPunch.at ? fmtClock(new Date(selectedAdjustedPunch.at)) : '—'}</dd></div>
              <div><dt className={labelCls}>Tipo da batida</dt><dd>{TYPE_LABEL[selectedAdjustedPunch.type]}</dd></div>
              <div><dt className={labelCls}>Quem solicitou</dt><dd>{selectedAdjustedPunch.employeeName}</dd></div>
              <div className="col-span-2"><dt className={labelCls}>Justificativa</dt><dd className="whitespace-pre-wrap">{selectedAdjustedPunch.adjustmentReason || '—'}</dd></div>
              <div><dt className={labelCls}>Solicitado em</dt><dd>{selectedAdjustedPunch.adjustmentRequestedAt ? new Date(selectedAdjustedPunch.adjustmentRequestedAt).toLocaleString('pt-BR') : '—'}</dd></div>
              <div><dt className={labelCls}>Aprovado por</dt><dd>{selectedAdjustedPunch.adjustmentApprovedBy || '—'}</dd></div>
              <div className="col-span-2"><dt className={labelCls}>Aprovado em</dt><dd>{selectedAdjustedPunch.adjustmentApprovedAt ? new Date(selectedAdjustedPunch.adjustmentApprovedAt).toLocaleString('pt-BR') : '—'}</dd></div>
            </dl>
          </div>
        </div>
      )}

      {/* Modal Nova ocorrência do dia */}
      {showDayModal && (
        <div className="fixed inset-0 z-50 bg-navy/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface max-w-md w-full rounded-xl border border-border shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="font-display text-base font-bold text-primary uppercase tracking-wide">
                Nova ocorrência do dia
              </h3>
              <button
                onClick={() => setShowDayModal(false)}
                className="text-fg-muted hover:text-fg-secondary font-bold text-xl"
              >
                ✕
              </button>
            </div>
            <div className="px-6 py-5 space-y-4 text-xs font-medium">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Data</label>
                  <input
                    type="date"
                    value={dayForm.refDate}
                    onChange={(e) => setDayForm({ ...dayForm, refDate: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Tipo</label>
                  <select
                    value={dayForm.kind}
                    onChange={(e) => setDayForm({ ...dayForm, kind: e.target.value as DayEntryKind })}
                    className={inputCls}
                  >
                    <option value="OBSERVACAO">Observação</option>
                    <option value="ATESTADO">Atestado</option>
                    <option value="FERIADO">Feriado</option>
                    <option value="FOLGA">Folga</option>
                  </select>
                </div>
              </div>

              <div>
                <label className={labelCls}>
                  {dayForm.kind === 'OBSERVACAO' ? 'Observação *' : 'Observação'}
                </label>
                <textarea
                  value={dayForm.note}
                  onChange={(e) => setDayForm({ ...dayForm, note: e.target.value })}
                  rows={3}
                  placeholder={
                    dayForm.kind === 'ATESTADO'
                      ? 'Ex.: Atestado médico de 1 dia (consulta).'
                      : dayForm.kind === 'FERIADO'
                      ? 'Ex.: Feriado municipal.'
                      : 'Ex.: Cliente remarcou a visita para a tarde.'
                  }
                  className={`${inputCls} resize-none`}
                />
              </div>

              {dayForm.kind === 'ATESTADO' && (
                <div>
                  <label className={labelCls}>Anexar atestado (PDF ou imagem)</label>
                  <input
                    type="file"
                    accept="application/pdf,image/*"
                    onChange={(e) => setDayFile(e.target.files?.[0] ?? null)}
                    className="w-full text-xs text-fg-secondary file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-navy/10 file:text-primary hover:file:bg-navy/20"
                  />
                  <p className="text-[10px] text-fg-muted mt-1">
                    Arquivo enviado para armazenamento privado (visível só a você e à gestão).
                  </p>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
              <button
                onClick={() => setShowDayModal(false)}
                className="px-4 py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider text-fg-secondary hover:bg-surface-3"
              >
                Cancelar
              </button>
              <button
                onClick={submitDayEntry}
                disabled={daySaving || (dayForm.kind === 'OBSERVACAO' && !dayForm.note.trim())}
                className="bg-navy hover:bg-navy-3 text-white px-5 py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 disabled:opacity-60"
              >
                <span className={`material-symbols-outlined text-base ${daySaving ? 'animate-spin' : ''}`}>
                  {daySaving ? 'progress_activity' : 'save'}
                </span>
                {daySaving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Solicitar ajuste de ponto */}
      {showAdj && (
        <div className="fixed inset-0 z-50 bg-navy/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface max-w-md w-full rounded-xl border border-border shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="font-display text-base font-bold text-primary uppercase tracking-wide">
                Solicitar ajuste de ponto
              </h3>
              <button onClick={() => setShowAdj(false)} className="text-fg-muted hover:text-fg-secondary font-bold text-xl">
                ✕
              </button>
            </div>
            <div className="px-6 py-5 space-y-4 text-xs font-medium">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Data</label>
                  <input
                    type="date"
                    value={adjForm.refDate}
                    onChange={(e) => setAdjForm({ ...adjForm, refDate: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Batida</label>
                  <select
                    value={adjForm.type}
                    onChange={(e) => setAdjForm({ ...adjForm, type: e.target.value as TimePunch['type'] })}
                    className={inputCls}
                  >
                    <option value="ENTRADA">Entrada</option>
                    <option value="PAUSA">Saída Almoço</option>
                    <option value="RETORNO">Retorno</option>
                    <option value="SAIDA">Saída</option>
                  </select>
                </div>
              </div>
              <div>
                <label className={labelCls}>Novo horário *</label>
                {(() => {
                  const orig = originalPunchTimeFor(currentUser, adjForm.refDate, adjForm.type);
                  return orig ? (
                    <p className="text-[11px] text-fg-secondary mb-1">
                      Horário original: <span className="font-data-mono font-semibold">{orig}</span>
                    </p>
                  ) : null;
                })()}
                <input
                  type="time"
                  value={adjForm.time}
                  onChange={(e) => setAdjForm({ ...adjForm, time: e.target.value })}
                  className={`${inputCls} font-data-mono`}
                />
                {!adjForm.time && (
                  <p className="text-[11px] text-danger mt-1">Informe o novo horário para enviar a solicitação.</p>
                )}
              </div>
              <div>
                <label className={labelCls}>Motivo *</label>
                <textarea
                  value={adjForm.reason}
                  onChange={(e) => setAdjForm({ ...adjForm, reason: e.target.value })}
                  rows={3}
                  placeholder="Ex.: Esqueci de registrar a saída às 19:00."
                  className={`${inputCls} resize-none`}
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
              <button
                onClick={() => setShowAdj(false)}
                className="px-4 py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider text-fg-secondary hover:bg-surface-3"
              >
                Cancelar
              </button>
              <button
                onClick={submitAdj}
                disabled={adjSaving || !adjForm.reason.trim() || !hasRequestedTime(adjForm.time)}
                className="bg-navy hover:bg-navy-3 text-white px-5 py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 disabled:opacity-60"
              >
                <span className={`material-symbols-outlined text-base ${adjSaving ? 'animate-spin' : ''}`}>
                  {adjSaving ? 'progress_activity' : 'send'}
                </span>
                {adjSaving ? 'Enviando...' : 'Enviar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {nextType && (
        <div className="md:hidden fixed bottom-[4.5rem] left-3 right-3 z-30 rounded-xl bg-white/95 backdrop-blur border border-border shadow-xl p-2 flex items-center gap-2">
          <div className="min-w-0 flex-1 pl-2"><p className="text-[10px] text-fg-secondary">Próxima batida</p><p className="text-xs font-bold text-fg truncate">{NEXT_INFO[nextType].label}</p></div>
          <button onClick={handleBaterPonto} disabled={punching || locating} className={`shrink-0 px-4 py-3 rounded-lg text-white text-xs font-bold ${NEXT_INFO[nextType].classes}`}>{locating ? 'GPS…' : 'Registrar'}</button>
        </div>
      )}
      {timecardCfg && (
        <TimecardPDFView
          blocks={timecardCfg.blocks}
          periodLabel={timecardCfg.periodLabel}
          fileLabel={timecardCfg.fileLabel}
          logoUrl={timecardCfg.logoUrl}
          onClose={closeTimecard}
        />
      )}
    </div>
  );
};
