'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AttendanceResult, Client, OrdemServico, ServiceAttendance, TimePunch } from '@/lib/types';
import {
  ActiveAttendanceExistsError,
  fetchActiveAttendanceForTechnician,
  fetchServiceAttendances,
  finishServiceAttendance,
  saveAttendanceProgress,
  startServiceAttendance,
} from '@/lib/serviceAttendances';
import { fetchTimeClockParticipants } from '@/lib/users';
import {
  ATTENDANCE_RESULT_LABEL,
  ATTENDANCE_RESULT_TONE,
  canConcludeOsFromResult,
  formatAttendanceElapsed,
  formatStartedAt,
  resultNeedsObservation,
  shouldWarnNoJourney,
} from '@/lib/attendanceFlow';
import { fetchOrdensServico, updateOrdemServicoStatus } from '@/lib/ordensServico';
import { capturePosition } from '@/lib/fieldPhotoGeo';
import { fetchOsMission, missionHasContent, OsMission } from '@/lib/osMission';
import { resolveLogoDataUrls } from '@/lib/institucional';
import { nomeFantasiaCliente } from '@/lib/utils';
import { useDomainRefresh } from '@/lib/realtime/RealtimeProvider';
import { useConfirm, useToast } from '@/components/ui/Feedback';
import { QuickFieldPhotoModal } from '@/components/field-photos/QuickFieldPhotoModal';
import { ClientLogo } from '@/components/ClientLogo';

/* ===================================================================
 * ETAPA 3B — Fluxo operacional REAL de atendimento de OS.
 *   OS ≠ ATENDIMENTO. Uma OS tem 0..N atendimentos. O técnico só fica
 *   "EM ATENDIMENTO" enquanto existir service_attendance EM_EXECUCAO seu.
 * Este arquivo centraliza a experiência mobile-first: iniciar, continuar,
 * salvar diagnóstico/execução, anexar evidências, finalizar com resultado e
 * (só quando RESOLVIDO) oferecer a conclusão da OS — nunca silenciosamente.
 * =================================================================== */

/** Nome operacional do cliente: nome fantasia com fallback à razão (§8/§9). */
const clientNameOf = (clients: Client[], id?: string) =>
  nomeFantasiaCliente(clients.find((c) => c.id === id)?.name) || 'Cliente';

/** Hook: resolve a logo (data URI) do cliente de uma OS, quando cadastrada. */
function useClientLogo(clients: Client[], clientId?: string): string | undefined {
  const [url, setUrl] = useState<string | undefined>(undefined);
  const path = clients.find((c) => c.id === clientId)?.logoPath;
  useEffect(() => {
    if (!path) { setUrl(undefined); return; }
    let alive = true;
    resolveLogoDataUrls([path]).then((m) => { if (alive) setUrl(m[path]); }).catch(() => {});
    return () => { alive = false; };
  }, [path]);
  return url;
}

/** Logo do cliente (real quando cadastrada, senão fallback) para os cards (§10). */
const AttendanceClientLogo: React.FC<{ clients: Client[]; clientId?: string; name: string; sizeClass?: string }> = ({ clients, clientId, name, sizeClass = 'w-11 h-11' }) => {
  const logo = useClientLogo(clients, clientId);
  return <ClientLogo src={logo} name={name} sizeClass={sizeClass} rounded="rounded-lg" />;
};

/* -------------------------------------------------------------------------- */
/* Missão da OS (§14–§22) — o que foi contratado, SEM preços                    */
/* -------------------------------------------------------------------------- */
export const OsMissionPanel: React.FC<{ osId: string; osDescricao?: string }> = ({ osId, osDescricao }) => {
  const [mission, setMission] = useState<OsMission | null>(null);
  useEffect(() => {
    let alive = true;
    fetchOsMission(osId).then((m) => { if (alive) setMission(m); }).catch(() => { if (alive) setMission(null); });
    return () => { alive = false; };
  }, [osId]);

  const Item = ({ i }: { i: { descricao: string; quantidade?: number; unidade?: string; marcaModelo?: string } }) => (
    <div className="flex gap-2 text-[12px] text-fg">
      <span className="text-primary shrink-0">•</span>
      <span className="min-w-0">
        {i.quantidade ? <span className="font-data-mono font-bold">{i.quantidade}{i.unidade ? ` ${i.unidade}` : ''} · </span> : null}
        {i.descricao}
        {i.marcaModelo ? <span className="text-fg-secondary"> — {i.marcaModelo}</span> : null}
      </span>
    </div>
  );

  const hasStructured = mission ? missionHasContent(mission) : false;
  const fallback = (mission?.osDescricao || osDescricao || mission?.osTitulo || '').trim();

  return (
    <div className="rounded-xl border border-border bg-surface-2 p-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-primary mb-2 flex items-center gap-1">
        <span className="material-symbols-outlined text-base">flag</span> Missão da OS
      </p>

      {mission === null ? (
        <p className="text-[11px] text-fg-muted">Carregando o que foi contratado…</p>
      ) : hasStructured ? (
        <div className="flex flex-col gap-3">
          {mission.services.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase text-fg-secondary mb-1">Serviços previstos</p>
              <div className="flex flex-col gap-1">{mission.services.map((s, i) => <Item key={i} i={s} />)}</div>
            </div>
          )}
          {mission.responsibilities.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase text-fg-secondary mb-1">Responsabilidades da Fireowl</p>
              <div className="flex flex-col gap-1">
                {mission.responsibilities.map((r, i) => (
                  <div key={i} className="flex gap-2 text-[12px] text-fg"><span className="text-primary shrink-0">•</span><span className="min-w-0">{r}</span></div>
                ))}
              </div>
            </div>
          )}
          {mission.materials.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase text-fg-secondary mb-1">Materiais previstos</p>
              <div className="flex flex-col gap-1">{mission.materials.map((m, i) => <Item key={i} i={m} />)}</div>
            </div>
          )}
        </div>
      ) : fallback ? (
        <div>
          <p className="text-[10px] font-bold uppercase text-fg-secondary mb-1">Descrição da OS</p>
          <p className="text-[12px] text-fg whitespace-pre-wrap">{fallback}</p>
        </div>
      ) : (
        <p className="text-[11px] text-fg-muted">Sem escopo estruturado. Confirme o serviço com o gestor.</p>
      )}
    </div>
  );
};

/** Lê o atendimento ATIVO do técnico e mantém sincronizado via realtime (§32). */
export function useActiveAttendance(technicianId?: string) {
  const [attendance, setAttendance] = useState<ServiceAttendance | null>(null);
  const [loading, setLoading] = useState(false);
  const refresh = useCallback(() => {
    if (!technicianId) { setAttendance(null); return; }
    setLoading(true);
    fetchActiveAttendanceForTechnician(technicianId)
      .then(setAttendance)
      .catch(() => setAttendance(null))
      .finally(() => setLoading(false));
  }, [technicianId]);
  useEffect(() => { refresh(); }, [refresh]);
  useDomainRefresh('fieldOps', refresh);
  return { attendance, loading, refresh };
}

/* -------------------------------------------------------------------------- */
/* Botão INICIAR ATENDIMENTO (§5/§6/§7/§34)                                    */
/* -------------------------------------------------------------------------- */
export const StartAttendanceButton: React.FC<{
  os: OrdemServico;
  technicianId?: string;
  technicianName?: string;
  clients: Client[];
  usesTimeClock?: boolean;
  punches?: TimePunch[];
  onStarted?: (a: ServiceAttendance) => void;
  className?: string;
}> = ({ os, technicianId, technicianName, clients, usesTimeClock = false, punches = [], onStarted, className }) => {
  const toast = useToast();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const [screen, setScreen] = useState<ServiceAttendance | null>(null);

  const osTerminal = os.status === 'concluida' || os.status === 'cancelada';

  const doStart = useCallback(async () => {
    if (!technicianId || busy) return;
    setBusy(true);
    try {
      // Aviso de jornada (§6) — soft, nunca bloqueia.
      if (shouldWarnNoJourney(usesTimeClock, punches)) {
        const go = await confirm({
          title: 'Sem entrada no Ponto',
          message: 'Você ainda não registrou entrada no Ponto hoje. Deseja iniciar o atendimento mesmo assim?',
          confirmLabel: 'Continuar mesmo assim',
        });
        if (!go) { setBusy(false); return; }
      }
      // GPS pontual best-effort (§21) — nunca impede o início.
      const geo = await capturePosition().catch(() => undefined);
      const started = await startServiceAttendance({
        workOrderId: os.id,
        technicianId,
        latitude: geo?.latitude,
        longitude: geo?.longitude,
      });
      toast.success('Atendimento iniciado.');
      onStarted?.(started);
      setScreen(started);
    } catch (e) {
      if (e instanceof ActiveAttendanceExistsError) {
        // Não contorna o índice do banco (§34): oferece continuar o atual.
        if (e.existing) {
          const go = await confirm({
            title: 'Atendimento em andamento',
            message: 'Você já possui um atendimento em andamento. Deseja continuá-lo?',
            confirmLabel: 'Continuar atendimento',
          });
          if (go) setScreen(e.existing);
        } else {
          toast.error(e.message);
        }
      } else {
        toast.error((e as Error)?.message || 'Não foi possível iniciar o atendimento.');
      }
    } finally {
      setBusy(false);
    }
  }, [busy, confirm, onStarted, os.id, punches, technicianId, toast, usesTimeClock]);

  if (!technicianId || osTerminal) return null;

  return (
    <>
      <button
        onClick={doStart}
        disabled={busy}
        className={
          className ||
          'w-full min-h-[52px] rounded-xl bg-primary hover:bg-primary-hover text-white text-sm font-bold uppercase tracking-wide flex items-center justify-center gap-2 disabled:opacity-60 transition-colors'
        }
      >
        <span className="material-symbols-outlined text-xl">play_circle</span>
        {busy ? 'Iniciando…' : 'Iniciar atendimento'}
      </button>
      {screen && (
        <AttendanceScreen
          attendance={screen}
          os={os}
          clients={clients}
          technicianId={technicianId}
          technicianName={technicianName}
          onClose={() => setScreen(null)}
        />
      )}
    </>
  );
};

/* -------------------------------------------------------------------------- */
/* Card ATENDIMENTO ATUAL (§8/§23) — dashboards do técnico                     */
/* -------------------------------------------------------------------------- */
export const ActiveAttendanceCard: React.FC<{
  technicianId?: string;
  technicianName?: string;
  clients: Client[];
  orders?: OrdemServico[];
}> = ({ technicianId, technicianName, clients, orders = [] }) => {
  const { attendance } = useActiveAttendance(technicianId);
  const [open, setOpen] = useState(false);
  const [tick, setTick] = useState(0);
  const [fetchedOrders, setFetchedOrders] = useState<OrdemServico[]>([]);

  // Relógio derivado (§22): recalcula o "há Xmin" a cada minuto, sem persistir.
  useEffect(() => {
    if (!attendance) return;
    const t = window.setInterval(() => setTick((v) => v + 1), 60000);
    return () => window.clearInterval(t);
  }, [attendance]);
  void tick;

  const osFromProp = useMemo(
    () => orders.find((o) => o.id === attendance?.workOrderId),
    [orders, attendance?.workOrderId]
  );

  // Fallback (ex.: home mobile, sem `orders` em memória): busca as OS do técnico
  // uma vez para resolver cliente/número. A RLS restringe o técnico às suas OS.
  useEffect(() => {
    if (!attendance || osFromProp) return;
    fetchOrdensServico().then(setFetchedOrders).catch(() => setFetchedOrders([]));
  }, [attendance, osFromProp]);

  if (!attendance) return null;
  const os = osFromProp || fetchedOrders.find((o) => o.id === attendance.workOrderId);

  const cliente = clientNameOf(clients, os?.clienteId);
  const elapsed = formatAttendanceElapsed(attendance.startedAt);

  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wider text-primary mb-2">Atendimento atual</p>
      <div className="rounded-xl border border-primary/40 bg-primary-soft/40 shadow-sm p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2.5 min-w-0">
            {/* Logo real do cliente quando houver; senão, fallback genérico (§10). */}
            <AttendanceClientLogo clients={clients} clientId={os?.clienteId} name={cliente} />
            <div className="min-w-0">
              <p className="font-bold text-fg text-sm truncate">{cliente}</p>
              <p className="text-[11px] font-data-mono text-fg-secondary truncate">
                {os?.numero || attendance.workOrderId.slice(0, 8)}
                {os?.titulo ? ` · ${os.titulo}` : ''}
              </p>
            </div>
          </div>
          <span className="shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold bg-primary text-white uppercase">
            Em atendimento
          </span>
        </div>
        <p className="mt-1 text-[11px] text-fg-secondary">
          Iniciado {formatStartedAt(attendance.startedAt)}{elapsed ? ` · há ${elapsed}` : ''}
        </p>
        <button
          onClick={() => setOpen(true)}
          className="mt-2.5 w-full min-h-[44px] rounded-lg bg-primary hover:bg-primary-hover text-white text-xs font-bold uppercase tracking-wide flex items-center justify-center gap-2 transition-colors"
        >
          <span className="material-symbols-outlined text-lg">arrow_forward</span>
          Continuar atendimento
        </button>
      </div>
      {open && (
        <AttendanceScreen
          attendance={attendance}
          os={os}
          clients={clients}
          technicianId={technicianId}
          technicianName={technicianName}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* Tela ATENDIMENTO ATUAL (§9–§20) — mobile-first, progressiva                 */
/* -------------------------------------------------------------------------- */
const RESULT_OPTIONS: AttendanceResult[] = ['RESOLVIDO', 'PARCIALMENTE_RESOLVIDO', 'NAO_RESOLVIDO'];

export const AttendanceScreen: React.FC<{
  attendance: ServiceAttendance;
  os?: OrdemServico;
  clients: Client[];
  technicianId?: string;
  technicianName?: string;
  onClose: () => void;
}> = ({ attendance, os, clients, technicianId, technicianName = '', onClose }) => {
  const toast = useToast();
  const confirm = useConfirm();
  const [diagnosis, setDiagnosis] = useState(attendance.diagnosis || '');
  const [execution, setExecution] = useState(attendance.executionNotes || '');
  const [result, setResult] = useState<AttendanceResult | undefined>(attendance.result);
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [finishing, setFinishing] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [tick, setTick] = useState(0);
  const savedRef = useRef({ diagnosis: attendance.diagnosis || '', execution: attendance.executionNotes || '' });

  const cliente = clientNameOf(clients, os?.clienteId);

  useEffect(() => {
    const t = window.setInterval(() => setTick((v) => v + 1), 60000);
    return () => window.clearInterval(t);
  }, []);
  void tick;

  // Autosave com debounce (§12): grava diagnóstico/execução sem o técnico perder
  // trabalho ao sair da tela. Só dispara quando algo mudou de fato.
  useEffect(() => {
    if (diagnosis === savedRef.current.diagnosis && execution === savedRef.current.execution) return;
    setSaving('saving');
    const handle = window.setTimeout(async () => {
      try {
        await saveAttendanceProgress({ id: attendance.id, diagnosis, executionNotes: execution });
        savedRef.current = { diagnosis, execution };
        setSaving('saved');
      } catch {
        setSaving('idle'); // erro silencioso: mantém o texto na tela para nova tentativa
      }
    }, 1200);
    return () => window.clearTimeout(handle);
  }, [attendance.id, diagnosis, execution]);

  const flushSave = useCallback(async () => {
    if (diagnosis === savedRef.current.diagnosis && execution === savedRef.current.execution) return;
    try {
      await saveAttendanceProgress({ id: attendance.id, diagnosis, executionNotes: execution });
      savedRef.current = { diagnosis, execution };
    } catch { /* mantém em tela */ }
  }, [attendance.id, diagnosis, execution]);

  const handleClose = useCallback(async () => {
    await flushSave();
    onClose();
  }, [flushSave, onClose]);

  const finalize = useCallback(async () => {
    if (finishing) return;
    if (!result) { toast.error('Selecione o resultado do atendimento.'); return; }
    if (resultNeedsObservation(result) && !execution.trim() && !diagnosis.trim()) {
      const go = await confirm({
        title: 'Sem observação',
        message: 'Este resultado mantém a OS aberta. Recomendamos registrar o que ficou pendente antes de finalizar. Finalizar mesmo assim?',
        confirmLabel: 'Finalizar mesmo assim',
      });
      if (!go) return;
    }
    setFinishing(true);
    try {
      const geo = await capturePosition().catch(() => undefined);
      await finishServiceAttendance({
        id: attendance.id,
        result,
        diagnosis,
        executionNotes: execution,
        latitude: geo?.latitude,
        longitude: geo?.longitude,
      });
      savedRef.current = { diagnosis, execution };
      toast.success('Atendimento finalizado.');

      // Resultado ≠ status da OS (§16). Só RESOLVIDO oferece concluir a OS, e
      // NUNCA silenciosamente (§17). PARCIAL/NÃO mantêm a OS aberta (§18/§19).
      if (canConcludeOsFromResult(result) && os && os.status !== 'concluida' && os.status !== 'cancelada') {
        const concluir = await confirm({
          title: 'Concluir a Ordem de Serviço?',
          message: 'Este atendimento resolveu completamente a Ordem de Serviço?',
          confirmLabel: 'Sim, concluir OS',
        });
        if (concluir) {
          try {
            await updateOrdemServicoStatus(os.id, 'concluida', { dataConclusao: new Date().toISOString() });
            toast.success('Ordem de Serviço concluída.');
          } catch {
            toast.error('Atendimento finalizado, mas não foi possível concluir a OS. Tente pela tela da OS.');
          }
        }
      }
      onClose();
    } catch (e) {
      toast.error((e as Error)?.message || 'Não foi possível finalizar o atendimento.');
      setFinishing(false);
    }
  }, [attendance.id, confirm, diagnosis, execution, finishing, onClose, os, result, toast]);

  const elapsed = formatAttendanceElapsed(attendance.startedAt);

  return (
    <div className="fixed inset-0 z-[80] bg-slate-900/60 backdrop-blur-sm flex items-stretch sm:items-center justify-center sm:p-4">
      <div className="bg-surface w-full sm:max-w-lg sm:max-h-[92vh] sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Cabeçalho: cliente / OS / status / tempo (§9) */}
        <div className="p-4 sm:p-5 border-b border-border bg-navy text-white">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wide text-white/60">Atendimento em execução</p>
              <h3 className="font-bold text-base truncate mt-0.5">{cliente}</h3>
              <p className="text-[11px] font-data-mono text-white/70 truncate">
                {os?.numero || attendance.workOrderId.slice(0, 8)}{os?.titulo ? ` · ${os.titulo}` : ''}
              </p>
            </div>
            <button onClick={handleClose} className="text-white/70 hover:text-white text-2xl leading-none shrink-0">×</button>
          </div>
          <p className="mt-2 text-[11px] text-white/80">
            Iniciado {formatStartedAt(attendance.startedAt)}{elapsed ? ` · em atendimento há ${elapsed}` : ''}
          </p>
        </div>

        <div className="overflow-y-auto p-4 sm:p-5 flex flex-col gap-4">
          {/* SERVIÇO / MISSÃO DA OS (§14–§22) — o que veio fazer, sem preços */}
          <OsMissionPanel osId={attendance.workOrderId} osDescricao={os?.descricao} />

          {/* DIAGNÓSTICO (§10) */}
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wide text-fg-secondary">Diagnóstico</span>
            <textarea
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
              rows={3}
              placeholder="Ex.: Detector 125 apresenta falha de comunicação."
              className="mt-1 w-full rounded-lg border border-border bg-surface text-fg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/25"
            />
          </label>

          {/* EXECUÇÃO (§11) */}
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wide text-fg-secondary">Serviço executado</span>
            <textarea
              value={execution}
              onChange={(e) => setExecution(e.target.value)}
              rows={3}
              placeholder="Ex.: Substituição do detector e nova programação."
              className="mt-1 w-full rounded-lg border border-border bg-surface text-fg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/25"
            />
          </label>

          {/* Estado do autosave (§12) — discreto */}
          <p className="text-[10px] text-fg-muted -mt-2 h-3">
            {saving === 'saving' ? 'Salvando…' : saving === 'saved' ? 'Rascunho salvo' : ''}
          </p>

          {/* EVIDÊNCIAS (§13) — reutiliza Fotos de Campo, vinculando ao atendimento */}
          <div>
            <span className="text-xs font-bold uppercase tracking-wide text-fg-secondary">Evidências</span>
            <button
              onClick={() => setPhotoOpen(true)}
              className="mt-1 w-full min-h-[48px] rounded-lg border border-dashed border-border bg-surface-2 text-fg-secondary text-sm font-semibold flex items-center justify-center gap-2 hover:border-primary hover:text-primary transition-colors"
            >
              <span className="material-symbols-outlined text-xl">add_a_photo</span>
              Adicionar foto
            </button>
            <p className="mt-1 text-[10px] text-fg-muted">As fotos usam o fluxo de Fotos de Campo (Antes/Depois preservados) e ficam vinculadas a este atendimento.</p>
          </div>

          {/* RESULTADO (§15) */}
          <div>
            <span className="text-xs font-bold uppercase tracking-wide text-fg-secondary">Resultado</span>
            <div className="mt-1.5 flex flex-col gap-2">
              {RESULT_OPTIONS.map((opt) => {
                const active = result === opt;
                return (
                  <button
                    key={opt}
                    onClick={() => setResult(opt)}
                    className={`min-h-[48px] rounded-lg border px-3 text-sm font-bold text-left flex items-center gap-3 transition-colors ${active ? ATTENDANCE_RESULT_TONE[opt] : 'border-border bg-surface text-fg-secondary hover:border-border-strong'}`}
                  >
                    <span className={`material-symbols-outlined text-lg ${active ? '' : 'text-fg-muted'}`}>
                      {active ? 'radio_button_checked' : 'radio_button_unchecked'}
                    </span>
                    {ATTENDANCE_RESULT_LABEL[opt]}
                  </button>
                );
              })}
            </div>
            {result && resultNeedsObservation(result) && (
              <p className="mt-1.5 text-[11px] text-amber-700">A OS permanece aberta. Registre no diagnóstico/execução o que ficou pendente.</p>
            )}
          </div>
        </div>

        {/* FINALIZAÇÃO (§17–§20) */}
        <div className="p-4 border-t border-border flex items-center justify-between gap-2">
          <button onClick={handleClose} className="px-4 py-2.5 rounded-lg bg-surface-3 text-xs font-bold uppercase text-fg-secondary hover:bg-surface-2">
            Sair
          </button>
          <button
            onClick={finalize}
            disabled={finishing || !result}
            className="flex-1 min-h-[48px] rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold uppercase tracking-wide flex items-center justify-center gap-2 disabled:opacity-60 transition-colors"
          >
            <span className="material-symbols-outlined text-xl">check_circle</span>
            {finishing ? 'Finalizando…' : 'Finalizar atendimento'}
          </button>
        </div>
      </div>

      {photoOpen && (
        <QuickFieldPhotoModal
          isOpen={photoOpen}
          onClose={() => setPhotoOpen(false)}
          clients={clients}
          technicianId={technicianId}
          technicianName={technicianName}
          osId={os?.id}
          serviceAttendanceId={attendance.id}
        />
      )}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* Histórico de ATENDIMENTOS da OS (§26/§27/§38) — visão do gestor             */
/* -------------------------------------------------------------------------- */
export const AttendanceHistoryList: React.FC<{
  osId: string;
  technicianNames?: Record<string, string>;
}> = ({ osId, technicianNames }) => {
  const [items, setItems] = useState<ServiceAttendance[] | null>(null);
  const [names, setNames] = useState<Record<string, string>>(technicianNames || {});
  const [expanded, setExpanded] = useState<string | null>(null);

  const refresh = useCallback(() => {
    fetchServiceAttendances({ workOrderId: osId })
      .then(setItems)
      .catch(() => setItems([]));
  }, [osId]);
  useEffect(() => { refresh(); }, [refresh]);
  useDomainRefresh('fieldOps', refresh);

  // Resolve nomes de técnicos (id → nome) quando não fornecidos. A RLS de
  // profiles decide o que cada perfil enxerga; falha silenciosa vira "Técnico".
  useEffect(() => {
    if (technicianNames) { setNames(technicianNames); return; }
    fetchTimeClockParticipants()
      .then((ps) => setNames(Object.fromEntries(ps.map((p) => [p.id, p.name]))))
      .catch(() => setNames({}));
  }, [technicianNames]);

  if (items === null) {
    return <p className="text-[11px] text-fg-muted">Carregando atendimentos…</p>;
  }
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border py-4 text-center">
        <p className="text-[11px] text-fg-muted">Nenhum atendimento registrado nesta OS.</p>
      </div>
    );
  }

  const fmtDate = (s?: string) => (s ? new Date(s).toLocaleDateString('pt-BR') : '—');
  const fmtTime = (s?: string) => (s ? new Date(s).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—');

  return (
    <div className="flex flex-col gap-2">
      {items.map((a, idx) => {
        const isOpen = expanded === a.id;
        const tech = (a.technicianId && names[a.technicianId]) || 'Técnico';
        const num = String(items.length - idx).padStart(2, '0');
        return (
          <div key={a.id} className="rounded-lg border border-border bg-surface-2 overflow-hidden">
            <button
              onClick={() => setExpanded(isOpen ? null : a.id)}
              className="w-full p-3 text-left flex items-start justify-between gap-2"
            >
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-fg">
                  #{num} · {tech}
                </p>
                <p className="text-[11px] text-fg-secondary">
                  {fmtDate(a.startedAt)} · {fmtTime(a.startedAt)}
                  {a.finishedAt ? ` → ${fmtTime(a.finishedAt)}` : ''}
                </p>
              </div>
              <div className="shrink-0 flex items-center gap-1">
                {a.status === 'EM_EXECUCAO' ? (
                  <span className="rounded-full px-2 py-0.5 text-[9px] font-bold bg-primary text-white uppercase">Em execução</span>
                ) : a.result ? (
                  <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase border ${ATTENDANCE_RESULT_TONE[a.result]}`}>
                    {ATTENDANCE_RESULT_LABEL[a.result]}
                  </span>
                ) : (
                  <span className="rounded-full px-2 py-0.5 text-[9px] font-bold bg-surface-3 text-fg-secondary uppercase">Finalizado</span>
                )}
                <span className="material-symbols-outlined text-base text-fg-muted">{isOpen ? 'expand_less' : 'expand_more'}</span>
              </div>
            </button>
            {isOpen && (
              <div className="px-3 pb-3 border-t border-border text-[12px] text-fg-secondary flex flex-col gap-2">
                <div className="pt-2">
                  <p className="text-[10px] font-bold uppercase text-fg-muted">Diagnóstico</p>
                  <p className="whitespace-pre-wrap text-fg">{a.diagnosis || '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-fg-muted">Serviço executado</p>
                  <p className="whitespace-pre-wrap text-fg">{a.executionNotes || '—'}</p>
                </div>
                {(a.latitudeStart != null || a.latitudeEnd != null) && (
                  <p className="text-[10px] text-fg-muted">
                    <span className="material-symbols-outlined text-[12px] align-middle">location_on</span>{' '}
                    Localização registrada no {a.latitudeStart != null ? 'início' : ''}
                    {a.latitudeStart != null && a.latitudeEnd != null ? ' e ' : ''}
                    {a.latitudeEnd != null ? 'fim' : ''}.
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
