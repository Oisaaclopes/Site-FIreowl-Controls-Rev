import React from 'react';
import { FileText, Check, Ban } from 'lucide-react';
import type { Pedido, UserRole } from '@/lib/types';
import { requestConfirm, showToast } from '@/components/ui/Feedback';
import {
  aplicarNotaFiscal,
  canManageNotaFiscal,
  notaFiscalPendencias,
  pedidoValorNota,
} from '@/lib/notaFiscal';

const brl = (v: number) => `R$ ${(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
const fmtData = (iso?: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR');
};

interface Props {
  pedidos: Pedido[];
  userRole: UserRole;
  currentUserName?: string;
  onSavePedido: (pedido: Pedido) => void;
}

/**
 * Pendência administrativa — "Emitir nota fiscal".
 *
 * Lembrete simples (NÃO é emissão de NF-e): lista os pedidos concluídos e
 * faturáveis cuja NF ainda está pendente, para ADMINISTRATIVO/FINANCEIRO/GESTOR.
 * O TÉCNICO nunca vê este bloco. Marcar "Emitida"/"Não aplicável" fecha a
 * pendência (o histórico fica no próprio pedido). Ver [[lib/notaFiscal]].
 */
export const NotaFiscalPendencias: React.FC<Props> = ({ pedidos, userRole, currentUserName, onSavePedido }) => {
  if (!canManageNotaFiscal(userRole)) return null;

  const abertas = notaFiscalPendencias(pedidos);
  if (abertas.length === 0) return null;

  const marcarEmitida = async (ped: Pedido) => {
    const ok = await requestConfirm({
      title: `Nota fiscal — ${ped.numeroPedido}`,
      message: `Marcar a NF de ${ped.clienteNome} (${brl(pedidoValorNota(ped))}) como emitida? A data de hoje fica registrada e a pendência sai da lista.`,
      confirmLabel: 'Marcar emitida',
    });
    if (!ok) return;
    onSavePedido(
      aplicarNotaFiscal(
        ped,
        { status: 'emitida', dataEmissao: new Date().toISOString().slice(0, 10) },
        currentUserName || undefined,
      ),
    );
    showToast(`NF do pedido ${ped.numeroPedido} marcada como emitida.`, 'success');
  };

  const marcarNaoAplicavel = async (ped: Pedido) => {
    const ok = await requestConfirm({
      title: `Sem nota fiscal — ${ped.numeroPedido}`,
      message: 'Marcar como "Não aplicável"? Use para garantia, retorno técnico ou serviço não faturável. A pendência sai da lista.',
      confirmLabel: 'Não aplicável',
    });
    if (!ok) return;
    onSavePedido(
      aplicarNotaFiscal(ped, { status: 'nao_aplicavel' }, currentUserName || undefined),
    );
    showToast(`Pedido ${ped.numeroPedido} marcado como sem NF.`, 'success');
  };

  return (
    <section className="bg-surface border border-amber-300/60 rounded-xl shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-amber-50/60">
        <FileText className="w-4 h-4 text-amber-700" />
        <h3 className="text-xs font-bold uppercase tracking-wider text-amber-800">
          Pendência administrativa — Emitir nota fiscal
        </h3>
        <span className="ml-auto text-[11px] font-semibold text-amber-800 bg-amber-100 rounded-full px-2 py-0.5">
          {abertas.length}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-fg-secondary border-b border-border">
              <th className="px-4 py-2 font-semibold">Cliente</th>
              <th className="px-4 py-2 font-semibold">Pedido</th>
              <th className="px-4 py-2 font-semibold text-right">Valor</th>
              <th className="px-4 py-2 font-semibold">Conclusão</th>
              <th className="px-4 py-2 font-semibold text-right">Ação</th>
            </tr>
          </thead>
          <tbody>
            {abertas.map((ped) => (
              <tr key={ped.id} className="border-b border-border/60 last:border-0 hover:bg-surface-2">
                <td className="px-4 py-2.5 font-medium text-fg">{ped.clienteNome || '—'}</td>
                <td className="px-4 py-2.5 text-fg-secondary">{ped.numeroPedido}</td>
                <td className="px-4 py-2.5 text-right font-data-mono text-fg">{brl(pedidoValorNota(ped))}</td>
                <td className="px-4 py-2.5 text-fg-secondary">{fmtData(ped.updatedAt)}</td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => marcarEmitida(ped)}
                      className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors"
                    >
                      <Check className="w-3 h-3" /> Emitida
                    </button>
                    <button
                      type="button"
                      onClick={() => marcarNaoAplicavel(ped)}
                      className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-[11px] font-semibold text-fg-secondary hover:bg-surface-3 transition-colors"
                    >
                      <Ban className="w-3 h-3" /> Não aplicável
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};
