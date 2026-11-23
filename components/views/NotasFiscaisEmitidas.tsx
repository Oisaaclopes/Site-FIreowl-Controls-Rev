import React, { useMemo, useState } from 'react';
import { BadgeCheck, ChevronDown, ChevronUp, Pencil, Search } from 'lucide-react';
import { NotaFiscalRegistroModal, abrirAnexoNotaFiscal } from '@/components/views/NotaFiscalRegistroModal';
import type { NotaFiscalTipo, Pedido, UserRole } from '@/lib/types';
import {
  NOTA_TIPO_LABEL,
  NOTA_TIPO_SIGLA,
  canManageNotaFiscal,
  linhasNotasEmitidas,
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
 * Uma linha por NOTA (um pedido pode ter várias: serviço/NFS-e e material/NF-e).
 * KPIs do mês/total por tipo, notas incompletas (sem nº/XML), busca, filtro
 * por mês e por tipo; "Editar" abre as notas do pedido. Role-gated igual à
 * pendência — o TÉCNICO nunca vê. Estado em `proposal.notaFiscal.notas` (JSONB).
 */
export const NotasFiscaisEmitidas: React.FC<Props> = ({ pedidos, userRole, currentUserName, onSavePedido }) => {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const [mes, setMes] = useState<string>('TODOS');
  const [tipo, setTipo] = useState<NotaFiscalTipo | 'TODOS'>('TODOS');
  const [editando, setEditando] = useState<Pedido | null>(null);

  const linhas = useMemo(() => linhasNotasEmitidas(pedidos), [pedidos]);
  const resumo = useMemo(() => resumoNotasEmitidas(pedidos), [pedidos]);
  const meses = useMemo(
    () => Array.from(new Set(linhas.map((l) => l.data.slice(0, 7)).filter(Boolean))),
    [linhas],
  );
  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return linhas.filter((l) => {
      if (mes !== 'TODOS' && l.data.slice(0, 7) !== mes) return false;
      if (tipo !== 'TODOS' && l.nota.tipo !== tipo) return false;
      if (!q) return true;
      return [l.pedido.clienteNome, l.pedido.numeroPedido, l.pedido.referencia, l.nota.numero, l.nota.chaveAcesso]
        .some((v) => (v || '').toLowerCase().includes(q));
    });
  }, [linhas, busca, mes, tipo]);
  const valorFiltrado = filtradas.reduce((acc, l) => acc + l.valor, 0);

  if (!canManageNotaFiscal(userRole)) return null;

  const autor = currentUserName || undefined;

  const kpis: { label: string; value: string; detail: string; tone: string }[] = [
    { label: 'Emitidas no mês', value: String(resumo.mes), detail: `${resumo.servicoMes} serviço · ${resumo.materialMes} material`, tone: 'text-emerald-700' },
    { label: 'Faturado no mês', value: brl(resumo.valorMes), detail: fmtMes(new Date().toISOString().slice(0, 7)), tone: 'text-emerald-700' },
    { label: 'Total emitidas', value: String(resumo.total), detail: `${brl(resumo.valorTotal)} · ${resumo.servico} serv. · ${resumo.material} mat.`, tone: 'text-fg' },
    {
      label: 'Controle incompleto',
      value: String(resumo.incompletas),
      detail: resumo.semNumero || resumo.semXml
        ? `${resumo.semNumero} sem nº · ${resumo.semXml} sem XML`
        : 'Todas com nº e XML',
      tone: resumo.semNumero || resumo.semXml ? 'text-amber-700' : 'text-fg-secondary',
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
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as NotaFiscalTipo | 'TODOS')}
              className="text-xs bg-surface text-fg border border-border rounded-lg px-2 py-1.5 focus:outline-none"
              aria-label="Filtrar por tipo de nota"
            >
              <option value="TODOS">Serviço e material</option>
              <option value="servico">Só serviço (NFS-e)</option>
              <option value="material">Só material (NF-e)</option>
            </select>
            <p className="sm:ml-auto text-[11px] text-fg-secondary">
              {filtradas.length} nota(s) · <span className="font-data-mono font-semibold text-emerald-700">{brl(valorFiltrado)}</span>
            </p>
          </div>

          {filtradas.length === 0 ? (
            <p className="px-4 pb-6 pt-2 text-center text-xs text-fg-muted">
              {linhas.length === 0
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
                    <th className="px-4 py-2 font-semibold">Tipo</th>
                    <th className="px-4 py-2 font-semibold">Nº NF</th>
                    <th className="px-4 py-2 font-semibold">Emissão</th>
                    <th className="px-4 py-2 font-semibold text-right">Valor</th>
                    <th className="px-4 py-2 font-semibold">Arquivos</th>
                    <th className="px-4 py-2 font-semibold">Registrado por</th>
                    <th className="px-4 py-2 font-semibold text-right">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {filtradas.map(({ pedido: ped, nota: nf, valor, data }) => (
                    <tr key={`${ped.id}:${nf.id}`} className="border-b border-border/60 last:border-0 hover:bg-surface-2">
                      <td className="px-4 py-2.5 font-medium text-fg">{ped.clienteNome || '—'}</td>
                      <td className="px-4 py-2.5 text-fg-secondary font-data-mono">{ped.numeroPedido}</td>
                      <td className="px-4 py-2.5">
                        <span
                          title={NOTA_TIPO_SIGLA[nf.tipo]}
                          className={`text-[10px] font-bold rounded px-1.5 py-0.5 ${nf.tipo === 'material' ? 'bg-sky-50 text-sky-700' : 'bg-emerald-50 text-emerald-700'}`}
                        >
                          {NOTA_TIPO_LABEL[nf.tipo]}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        {nf.numero ? (
                          <span className="font-data-mono font-semibold text-fg">{nf.numero}</span>
                        ) : (
                          <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 rounded px-1.5 py-0.5">sem número</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-fg-secondary">{fmtData(data)}</td>
                      <td className="px-4 py-2.5 text-right font-data-mono text-fg">{valor ? brl(valor) : '—'}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1">
                          {nf.anexos?.xml && (
                            <button type="button" onClick={() => abrirAnexoNotaFiscal(nf.anexos!.xml!)} title={`Abrir ${nf.anexos.xml.nome}`} className="rounded border border-border px-1.5 py-0.5 text-[10px] font-bold text-fg-secondary hover:text-primary hover:border-primary">XML</button>
                          )}
                          {nf.anexos?.pdf && (
                            <button type="button" onClick={() => abrirAnexoNotaFiscal(nf.anexos!.pdf!)} title={`Abrir ${nf.anexos.pdf.nome}`} className="rounded border border-border px-1.5 py-0.5 text-[10px] font-bold text-fg-secondary hover:text-red-600 hover:border-red-400">PDF</button>
                          )}
                          {!nf.anexos?.xml && !nf.anexos?.pdf && <span className="text-[10px] text-fg-muted">—</span>}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-fg-secondary">{nf.registradaPor || ped.proposal?.notaFiscal?.atualizadaPor || '—'}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end">
                          <button
                            type="button"
                            onClick={() => setEditando(ped)}
                            title="Editar, adicionar ou remover notas deste pedido"
                            className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-[11px] font-semibold text-fg-secondary hover:bg-surface-3 transition-colors"
                          >
                            <Pencil className="w-3 h-3" /> Editar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
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
