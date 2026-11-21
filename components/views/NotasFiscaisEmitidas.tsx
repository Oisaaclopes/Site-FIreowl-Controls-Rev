import React, { useMemo, useState } from 'react';
import { BadgeCheck, ChevronDown, ChevronUp, Hash, RotateCcw, Search } from 'lucide-react';
import { NotaFiscalRegistroModal } from '@/components/views/NotaFiscalRegistroModal';
import type { Pedido, UserRole } from '@/lib/types';
import { requestConfirm, showToast } from '@/components/ui/Feedback';
import {
  aplicarNotaFiscal,
  canManageNotaFiscal,
  notaFiscalDataRef,
  notasFiscaisEmitidas,
  pedidoValorNota,
  resumoNotasEmitidas,
} from '@/lib/notaFiscal';

const brl = (v: number) => `R$ ${(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
const fmtData = (iso?: string) => {
  if (!iso) return '—';
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR');
};
const fmtMes = (ym: string) => {
  const d = new Date(`${ym}-15T12:00:00`);
  return Number.isNaN(d.getTime()) ? ym : d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
};

interface Props {
  pedidos: Pedido[];
  userRole: UserRole;
  currentUserName?: string;
  onSavePedido: (pedido: Pedido) => void;
}

/**
 * Card de controle — Notas fiscais emitidas.
 *
 * Complementa a pendência "Emitir nota fiscal": mostra o que JÁ foi emitido
 * (KPIs do mês/total, NFs sem número), com busca, filtro por mês, edição do
 * número da NF e "Reabrir" (volta para pendente). Role-gated igual à
 * pendência — o TÉCNICO nunca vê. Estado em `proposal.notaFiscal` (JSONB).
 */
export const NotasFiscaisEmitidas: React.FC<Props> = ({ pedidos, userRole, currentUserName, onSavePedido }) => {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const [mes, setMes] = useState<string>('TODOS');
  const [editando, setEditando] = useState<Pedido | null>(null);

  const emitidas = useMemo(() => notasFiscaisEmitidas(pedidos), [pedidos]);
  const resumo = useMemo(() => resumoNotasEmitidas(pedidos), [pedidos]);
  const meses = useMemo(
    () => Array.from(new Set(emitidas.map((p) => notaFiscalDataRef(p).slice(0, 7)).filter(Boolean))),
    [emitidas],
  );
  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return emitidas.filter((p) => {
      if (mes !== 'TODOS' && notaFiscalDataRef(p).slice(0, 7) !== mes) return false;
      if (!q) return true;
      return [p.clienteNome, p.numeroPedido, p.referencia, p.proposal?.notaFiscal?.numero]
        .some((v) => (v || '').toLowerCase().includes(q));
    });
  }, [emitidas, busca, mes]);
  const valorFiltrado = filtradas.reduce((acc, p) => acc + pedidoValorNota(p), 0);

  if (!canManageNotaFiscal(userRole)) return null;

  const autor = currentUserName || undefined;

  // Edita nº/data/observação no mesmo formulário da linha do pedido.
  const editarNumero = (ped: Pedido) => setEditando(ped);

  const reabrir = async (ped: Pedido) => {
    const ok = await requestConfirm({
      title: `Reabrir NF — ${ped.numeroPedido}`,
      message: 'A nota volta para "Pendente" (lista "Emitir nota fiscal") e o selo de emitida sai do pedido. Use só se a marcação foi feita por engano.',
      confirmLabel: 'Reabrir',
    });
    if (!ok) return;
    onSavePedido(aplicarNotaFiscal(ped, { status: 'pendente' }, autor));
    showToast(`NF do pedido ${ped.numeroPedido} reaberta como pendente.`, 'info');
  };

  const kpis: { label: string; value: string; detail: string; tone: string }[] = [
    { label: 'Emitidas no mês', value: String(resumo.mes), detail: fmtMes(new Date().toISOString().slice(0, 7)), tone: 'text-emerald-700' },
    { label: 'Faturado no mês', value: brl(resumo.valorMes), detail: 'Valor dos pedidos com NF', tone: 'text-emerald-700' },
    { label: 'Total emitidas', value: String(resumo.total), detail: brl(resumo.valorTotal), tone: 'text-fg' },
    {
      label: 'Sem nº de NF',
      value: String(resumo.semNumero),
      detail: resumo.semNumero ? 'Informe o número para controle' : 'Todas numeradas',
      tone: resumo.semNumero ? 'text-amber-700' : 'text-fg-secondary',
    },
  ];

  return (
    <section className="bg-surface border border-emerald-300/60 rounded-xl shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className="w-full flex items-center gap-2 px-4 py-3 border-b border-border bg-emerald-50/60 text-left"
      >
        <BadgeCheck className="w-4 h-4 text-emerald-700" />
        <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800">Notas fiscais emitidas</h3>
        <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-100 rounded-full px-2 py-0.5">{resumo.total}</span>
        <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800">
          {aberto ? 'Recolher' : 'Ver notas'}
          {aberto ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </span>
      </button>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-border">
        {kpis.map((k) => (
          <div key={k.label} className="bg-surface px-4 py-3 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wide text-fg-muted">{k.label}</p>
            <p className={`mt-0.5 font-data-mono text-lg font-bold truncate ${k.tone}`}>{k.value}</p>
            <p className="text-[10px] text-fg-secondary truncate" title={k.detail}>{k.detail}</p>
          </div>
        ))}
      </div>

      {aberto && (
        <div className="border-t border-border">
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center px-4 py-3">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-2.5 top-2 text-fg-muted w-3.5 h-3.5" />
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar cliente, pedido ou nº da NF..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-surface text-fg border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
            <select
              value={mes}
              onChange={(e) => setMes(e.target.value)}
              className="text-xs bg-surface text-fg border border-border rounded-lg px-2 py-1.5 focus:outline-none"
              aria-label="Filtrar por mês de emissão"
            >
              <option value="TODOS">Todos os meses</option>
              {meses.map((m) => (
                <option key={m} value={m}>{fmtMes(m)}</option>
              ))}
            </select>
            <p className="sm:ml-auto text-[11px] text-fg-secondary">
              {filtradas.length} nota(s) · <span className="font-data-mono font-semibold text-emerald-700">{brl(valorFiltrado)}</span>
            </p>
          </div>

          {filtradas.length === 0 ? (
            <p className="px-4 pb-6 pt-2 text-center text-xs text-fg-muted">
              {emitidas.length === 0
                ? 'Nenhuma nota fiscal marcada como emitida ainda. Use "Informar NF" na linha do pedido (a partir de Aceito) ou a pendência "Emitir nota fiscal".'
                : 'Nenhuma nota encontrada para esse filtro.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-fg-secondary border-y border-border">
                    <th className="px-4 py-2 font-semibold">Cliente</th>
                    <th className="px-4 py-2 font-semibold">Pedido</th>
                    <th className="px-4 py-2 font-semibold">Nº NF</th>
                    <th className="px-4 py-2 font-semibold">Emissão</th>
                    <th className="px-4 py-2 font-semibold text-right">Valor</th>
                    <th className="px-4 py-2 font-semibold">Registrado por</th>
                    <th className="px-4 py-2 font-semibold text-right">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {filtradas.map((ped) => {
                    const nf = ped.proposal?.notaFiscal;
                    return (
                      <tr key={ped.id} className="border-b border-border/60 last:border-0 hover:bg-surface-2">
                        <td className="px-4 py-2.5 font-medium text-fg">{ped.clienteNome || '—'}</td>
                        <td className="px-4 py-2.5 text-fg-secondary font-data-mono">{ped.numeroPedido}</td>
                        <td className="px-4 py-2.5">
                          {nf?.numero ? (
                            <span className="font-data-mono font-semibold text-fg">{nf.numero}</span>
                          ) : (
                            <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 rounded px-1.5 py-0.5">sem número</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-fg-secondary">{fmtData(nf?.dataEmissao || nf?.atualizadaEm)}</td>
                        <td className="px-4 py-2.5 text-right font-data-mono text-fg">{brl(pedidoValorNota(ped))}</td>
                        <td className="px-4 py-2.5 text-fg-secondary">{nf?.atualizadaPor || '—'}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => editarNumero(ped)}
                              title="Editar número, data ou observação da NF"
                              className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-[11px] font-semibold text-fg-secondary hover:bg-surface-3 transition-colors"
                            >
                              <Hash className="w-3 h-3" /> {nf?.numero ? 'Editar' : 'Informar nº'}
                            </button>
                            <button
                              type="button"
                              onClick={() => reabrir(ped)}
                              title="Voltar a NF para pendente"
                              className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-[11px] font-semibold text-fg-secondary hover:bg-surface-3 transition-colors"
                            >
                              <RotateCcw className="w-3 h-3" /> Reabrir
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      {editando && (
        <NotaFiscalRegistroModal
          pedido={editando}
          autor={autor}
          onSave={onSavePedido}
          onClose={() => setEditando(null)}
        />
      )}
    </section>
  );
};
