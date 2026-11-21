'use client';

import React from 'react';
import { PedidoTipo } from '@/lib/types';
import { PEDIDO_TIPO_LABELS } from '@/lib/documentos';
import { SECOES_DOCUMENTO, SecaoDocKey } from '@/lib/documentoSecoes';

interface Props {
  tipo: PedidoTipo | '';
  /** Seções que hoje aparecem no documento (seleção explícita ou padrão do tipo). */
  ativas: SecaoDocKey[];
  /** Seções pré-definidas do tipo (destacadas). */
  padrao: SecaoDocKey[];
  /** O pedido tem seleção própria (≠ padrão do tipo)? */
  personalizado: boolean;
  somenteMaterial?: boolean;
  onToggle: (key: SecaoDocKey, ligar: boolean) => void;
  onRestaurarPadrao: () => void;
  onDefinirTodas: (ligar: boolean) => void;
}

/**
 * Seções do documento — todas as seções do catálogo com interruptor
 * "aparece no documento: sim/não". As pré-definidas do Tipo de Pedido ficam
 * destacadas. Ver [[lib/documentoSecoes]].
 */
export function SecoesDocumentoEditor({ tipo, ativas, padrao, personalizado, somenteMaterial, onToggle, onRestaurarPadrao, onDefinirTodas }: Props) {
  const ativasSet = new Set(ativas);
  const padraoSet = new Set(padrao);
  const tipoLabel = tipo ? PEDIDO_TIPO_LABELS[tipo] : 'Sem tipo (proposta completa)';

  if (somenteMaterial) {
    return (
      <div className="rounded-xl border border-border bg-surface-2 px-4 py-3 text-[11px] text-fg-secondary">
        <b className="text-fg">Seções do documento:</b> em <b>Somente Material</b> o documento de fornecimento tem estrutura própria e enxuta — as seções não se aplicam.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wide text-primary">Seções do documento</h4>
          <p className="text-[11px] text-fg-muted mt-0.5">
            {tipo === 'personalizado'
              ? 'Personalizado começa vazio: ligue as seções que devem aparecer no documento.'
              : <>Destacadas = padrão de <b className="text-fg-secondary">{tipoLabel}</b>. Ligue ou desligue qualquer seção.</>}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${personalizado ? 'bg-warning-soft text-warning' : 'bg-surface-3 text-fg-muted'}`}>
            {personalizado ? 'Personalizado' : 'Padrão do tipo'}
          </span>
          <span className="text-[10px] font-data-mono font-bold text-fg-muted">{ativas.length}/{SECOES_DOCUMENTO.length}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-3">
        {personalizado && (
          <button type="button" onClick={onRestaurarPadrao} className="text-[10px] font-bold uppercase text-primary hover:text-danger">
            Restaurar padrão do tipo
          </button>
        )}
        <button type="button" onClick={() => onDefinirTodas(true)} className="text-[10px] font-bold uppercase text-fg-muted hover:text-primary">
          Ligar todas
        </button>
        <button type="button" onClick={() => onDefinirTodas(false)} className="text-[10px] font-bold uppercase text-fg-muted hover:text-primary">
          Desligar todas
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
        {SECOES_DOCUMENTO.map((s) => {
          const on = ativasSet.has(s.key);
          const ehPadrao = padraoSet.has(s.key);
          return (
            <button
              key={s.key}
              type="button"
              role="switch"
              aria-checked={on}
              aria-label={`${s.titulo}: aparece no documento ${on ? 'sim' : 'não'}`}
              title={s.descricao}
              onClick={() => onToggle(s.key, !on)}
              className={`flex items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors ${
                ehPadrao ? 'border-primary/50 bg-primary-soft' : 'border-border bg-surface hover:bg-surface-2'
              }`}
            >
              <span className={`relative inline-flex h-4 w-7 shrink-0 rounded-full transition-colors ${on ? 'bg-success' : 'bg-surface-3 border border-border-strong'}`}>
                <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-surface shadow-soft transition-all ${on ? 'left-3.5' : 'left-0.5'}`} />
              </span>
              <span className="flex-1 min-w-0">
                <span className={`block text-xs font-semibold truncate ${on ? 'text-fg' : 'text-fg-muted'}`}>{s.titulo}</span>
              </span>
              {ehPadrao && (
                <span className="shrink-0 text-[9px] font-bold uppercase tracking-wide text-primary">Padrão</span>
              )}
              <span className={`shrink-0 text-[9px] font-bold uppercase w-7 text-right ${on ? 'text-success' : 'text-fg-muted'}`}>{on ? 'Sim' : 'Não'}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
