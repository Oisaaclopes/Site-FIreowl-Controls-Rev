'use client';

import React from 'react';
import { AlertTriangle, AlertCircle, Pencil, FileWarning, X } from 'lucide-react';
import { ValidationIssue } from '@/lib/proposalValidation';
import { Pedido } from '@/lib/types';

interface Props {
  numero: string;
  pedido: Pedido;
  docLabel: string;
  issues: ValidationIssue[];
  onClose: () => void;
  /** Gerar mesmo assim (ignorar os alertas). */
  onGenerate: () => void;
  /** Voltar e editar a proposta. */
  onRevisar: () => void;
}

export const ProposalValidationModal: React.FC<Props> = ({ numero, pedido, docLabel, issues, onClose, onGenerate, onRevisar }) => {
  const erros = issues.filter((i) => i.level === 'erro');
  const alertas = issues.filter((i) => i.level === 'alerta');
  const checklist = ['Objetivo', 'Escopo', 'Prazo', 'Garantia', 'SLA'].map((campo) => ({ campo, issue: issues.find((i) => i.campo === campo) }));
  const completos = checklist.filter((item) => !item.issue).length;

  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-surface w-full max-w-lg rounded-2xl border border-border shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Cabeçalho */}
        <div className="bg-navy-3 text-white p-5 flex items-start justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#F2A900] text-primary rounded-xl flex items-center justify-center shrink-0">
              <FileWarning className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold">Revisão antes de gerar</h3>
              <p className="text-[11px] text-fg-muted">{docLabel} · {numero}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-fg-muted hover:text-white p-1" title="Fechar">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo */}
        <div className="p-5 overflow-y-auto space-y-4">
          <div className="rounded-xl border border-primary/15 bg-navy/5 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-primary mb-2">Resumo executivo</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[11px]">
              <div><span className="block text-fg-muted uppercase text-[9px]">Cliente</span><strong className="text-fg">{pedido.clienteNome || 'Não informado'}</strong></div>
              <div><span className="block text-fg-muted uppercase text-[9px]">Valor</span><strong className="text-emerald-700">R$ {(pedido.proposal.valorTotal || pedido.proposal.valorMensal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></div>
              <div><span className="block text-fg-muted uppercase text-[9px]">Áreas</span><strong className="text-fg">{pedido.proposal.areaPrincipal?.join(', ') || 'Não informadas'}</strong></div>
              <div><span className="block text-fg-muted uppercase text-[9px]">Prazo</span><strong className="text-fg">{pedido.proposal.prazoExecucao || 'Não informado'}</strong></div>
              <div><span className="block text-fg-muted uppercase text-[9px]">SLA</span><strong className="text-fg">{pedido.proposal.slaCritico || (pedido.proposal.slaTabela?.length ? `${pedido.proposal.slaTabela.length} níveis definidos` : 'Não informado')}</strong></div>
              <div><span className="block text-fg-muted uppercase text-[9px]">Vigência / validade</span><strong className="text-fg">{pedido.proposal.recorrente ? `${pedido.proposal.vigenciaMeses || 0} meses` : `${pedido.proposal.validadePropostaDias || 0} dias`}</strong></div>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-surface-2 p-3">
            <div className="flex items-center justify-between mb-2"><span className="text-[10px] font-bold uppercase tracking-wider text-fg-secondary">Completude operacional</span><strong className="text-sm text-primary">{Math.round((completos / checklist.length) * 100)}%</strong></div>
            <div className="space-y-1.5">{checklist.map((item) => <div key={item.campo} className={`flex items-center gap-2 text-xs ${item.issue ? item.issue.level === 'erro' ? 'text-red-700' : 'text-amber-700' : 'text-emerald-700'}`}><span>{item.issue ? item.issue.level === 'erro' ? '🔴' : '🟡' : '🟢'}</span><span>{item.campo}{item.issue ? ` — ${item.issue.mensagem}` : ' preenchido'}</span></div>)}</div>
          </div>
          <p className="text-xs text-fg-secondary">
            Encontramos {issues.length} ponto{issues.length > 1 ? 's' : ''} para conferir. Nada foi alterado — a decisão é sua.
          </p>

          {erros.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-red-600">Dados obrigatórios ({erros.length})</p>
              {erros.map((i) => (
                <div key={i.id} className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[11px] font-bold text-red-800 uppercase">{i.campo}</p>
                    <p className="text-xs text-fg-secondary">{i.mensagem}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {alertas.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600">Inconsistências ({alertas.length})</p>
              {alertas.map((i) => (
                <div key={i.id} className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[11px] font-bold text-amber-800 uppercase">{i.campo}</p>
                    <p className="text-xs text-fg-secondary">{i.mensagem}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="p-4 border-t border-border bg-surface-2 flex flex-col sm:flex-row gap-2 shrink-0">
          <button
            onClick={onRevisar}
            className="flex-1 flex items-center justify-center gap-2 bg-navy-3 hover:bg-[#13315C] text-white py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors"
          >
            <Pencil className="w-4 h-4" /> Revisar proposta
          </button>
          <button
            onClick={onGenerate}
            className="flex-1 bg-surface hover:bg-surface-3 text-fg-secondary border border-border-strong py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors"
          >
            Gerar mesmo assim
          </button>
        </div>
      </div>
    </div>
  );
};
