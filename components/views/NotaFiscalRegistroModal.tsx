import React, { useRef, useState } from 'react';
import { AlertTriangle, BadgeCheck, FileCode2, FileText, Loader2, Paperclip, Plus, Trash2, X } from 'lucide-react';
import type { NotaFiscalAnexo, NotaFiscalItem, NotaFiscalTipo, Pedido } from '@/lib/types';
import { requestConfirm, showToast } from '@/components/ui/Feedback';
import {
  NOTA_TIPO_LABEL,
  NOTA_TIPO_SIGLA,
  isNotaFiscalEmitida,
  notasDoPedido,
  pedidoValorNota,
  salvarNotasDoPedido,
  tipoNotaPadrao,
} from '@/lib/notaFiscal';
import {
  lerXmlNotaFiscal,
  removerNotaFiscalAnexos,
  signedNotaFiscalUrl,
  uploadNotaFiscalAnexo,
  validarArquivoNf,
  type DadosXmlNf,
  type NfAnexoTipo,
} from '@/lib/notaFiscalArquivos';

const brl = (v: number) => `R$ ${(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
const hoje = () => new Date().toISOString().slice(0, 10);
const kb = (n?: number) => (n ? `${Math.max(1, Math.round(n / 1024))} KB` : '');
const novoId = () => `nf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
/** "1.234,56" | "1234.56" | "" → número ou undefined. */
const parseValor = (s: string): number | undefined => {
  const t = s.trim();
  if (!t) return undefined;
  const n = Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t);
  return Number.isFinite(n) ? n : undefined;
};
const fmtValorInput = (v?: number) => (typeof v === 'number' ? v.toFixed(2).replace('.', ',') : '');

/** Abre um anexo da NF (bucket privado → URL assinada de curta duração). */
export async function abrirAnexoNotaFiscal(anexo: NotaFiscalAnexo) {
  try {
    window.open(await signedNotaFiscalUrl(anexo.path), '_blank', 'noopener,noreferrer');
  } catch (e: any) {
    showToast(e?.message || 'Não foi possível abrir o arquivo da nota.', 'error');
  }
}

/** Rascunho editável de uma nota (campos como texto + arquivos novos). */
interface Rascunho {
  id: string;
  tipo: NotaFiscalTipo;
  numero: string;
  data: string;
  valor: string;
  chave: string;
  obs: string;
  /** Anexos já salvos; null = removido nesta edição. */
  atuais: { xml?: NotaFiscalAnexo | null; pdf?: NotaFiscalAnexo | null };
  novos: { xml?: File; pdf?: File };
  lido?: DadosXmlNf | null;
  original?: NotaFiscalItem;
}

const deNota = (n: NotaFiscalItem): Rascunho => ({
  id: n.id === 'legado' ? novoId() : n.id,
  tipo: n.tipo,
  numero: n.numero || '',
  data: n.dataEmissao?.slice(0, 10) || hoje(),
  valor: fmtValorInput(n.valor),
  chave: n.chaveAcesso || '',
  obs: n.observacao || '',
  atuais: { ...n.anexos },
  novos: {},
  original: n,
});

const vazio = (tipo: NotaFiscalTipo): Rascunho => ({
  id: novoId(), tipo, numero: '', data: hoje(), valor: '', chave: '', obs: '', atuais: {}, novos: {},
});

interface Props {
  pedido: Pedido;
  autor?: string;
  onSave: (pedido: Pedido) => void;
  onClose: () => void;
}

/**
 * Notas fiscais do pedido — uma ou várias, cada uma com TIPO (serviço/NFS-e ou
 * material/NF-e), nº, data, valor, chave, observação e arquivos (XML + PDF).
 * O XML preenche tudo e define o tipo sozinho. Usado na linha do pedido
 * (a partir de ACEITO), na pendência "Emitir nota fiscal" e no card de emitidas.
 */
export const NotaFiscalRegistroModal: React.FC<Props> = ({ pedido, autor, onSave, onClose }) => {
  const existentes = notasDoPedido(pedido);
  const editando = isNotaFiscalEmitida(pedido);
  const valorPedido = pedidoValorNota(pedido);

  const [notas, setNotas] = useState<Rascunho[]>(() =>
    existentes.length ? existentes.map(deNota) : [vazio(tipoNotaPadrao(pedido))],
  );
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  const atualizar = (id: string, patch: Partial<Rascunho>) =>
    setNotas((ns) => ns.map((n) => (n.id === id ? { ...n, ...patch } : n)));

  const escolher = async (id: string, tipoArq: NfAnexoTipo, file?: File) => {
    if (!file) return;
    const invalido = validarArquivoNf(file, tipoArq);
    if (invalido) { setErro(invalido); return; }
    setErro(null);
    const atual = notas.find((n) => n.id === id);
    if (!atual) return;
    const patch: Partial<Rascunho> = { novos: { ...atual.novos, [tipoArq]: file } };
    if (tipoArq === 'xml') {
      const dados = lerXmlNotaFiscal(await file.text());
      patch.lido = dados;
      if (dados) {
        patch.tipo = dados.tipo === 'NFE' ? 'material' : 'servico';
        if (dados.numero) patch.numero = dados.numero;
        if (dados.dataEmissao && dados.dataEmissao <= hoje()) patch.data = dados.dataEmissao;
        if (dados.chaveAcesso) patch.chave = dados.chaveAcesso;
        if (dados.valor !== undefined) patch.valor = fmtValorInput(dados.valor);
      }
    }
    atualizar(id, patch);
  };

  const descartarNovo = (id: string, tipoArq: NfAnexoTipo) => {
    const atual = notas.find((n) => n.id === id);
    if (!atual) return;
    atualizar(id, { novos: { ...atual.novos, [tipoArq]: undefined }, ...(tipoArq === 'xml' ? { lido: undefined } : {}) });
    const el = inputs.current[`${id}:${tipoArq}`];
    if (el) el.value = '';
  };

  const remover = async (r: Rascunho) => {
    if (r.original) {
      const ok = await requestConfirm({
        title: 'Remover esta nota?',
        message: `A ${NOTA_TIPO_LABEL[r.tipo].toLowerCase()}${r.numero ? ` nº ${r.numero}` : ''} sai do pedido ao salvar, junto com os arquivos anexados.`,
        confirmLabel: 'Remover',
        danger: true,
      });
      if (!ok) return;
    }
    setNotas((ns) => ns.filter((n) => n.id !== r.id));
  };

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (notas.some((n) => !n.data)) { setErro('Informe a data de emissão de todas as notas.'); return; }
    if (notas.some((n) => n.valor.trim() && parseValor(n.valor) === undefined)) { setErro('Valor de nota inválido.'); return; }
    if (notas.length === 0 && editando) {
      const ok = await requestConfirm({
        title: 'Remover todas as notas?',
        message: 'O pedido volta a ficar sem nota fiscal (pendente) e o selo de emitida sai.',
        confirmLabel: 'Remover todas',
        danger: true,
      });
      if (!ok) return;
    }
    setBusy(true); setErro(null);
    const enviados: string[] = [];
    try {
      const descartados: string[] = [];
      const finais: NotaFiscalItem[] = [];
      for (const r of notas) {
        const anexos: { xml?: NotaFiscalAnexo; pdf?: NotaFiscalAnexo } = {};
        for (const t of ['xml', 'pdf'] as const) {
          const anterior = r.original?.anexos?.[t];
          if (r.novos[t]) {
            const up = await uploadNotaFiscalAnexo(pedido.id, r.novos[t]!, t);
            enviados.push(up.path);
            anexos[t] = up;
            if (anterior) descartados.push(anterior.path);
          } else if (r.atuais[t]) {
            anexos[t] = r.atuais[t]!;
          } else if (anterior) {
            descartados.push(anterior.path);
          }
        }
        finais.push({
          id: r.id,
          tipo: r.tipo,
          numero: r.numero,
          dataEmissao: r.data,
          valor: parseValor(r.valor),
          chaveAcesso: r.chave,
          observacao: r.obs,
          ...(anexos.xml || anexos.pdf ? { anexos } : {}),
          registradaEm: r.original?.registradaEm,
          registradaPor: r.original?.registradaPor,
        });
      }
      // Anexos de notas removidas inteiras.
      const mantidas = new Set(notas.map((n) => n.original?.id).filter(Boolean));
      for (const n of existentes) {
        if (!mantidas.has(n.id)) descartados.push(...[n.anexos?.xml?.path, n.anexos?.pdf?.path].filter(Boolean) as string[]);
      }
      onSave(salvarNotasDoPedido(pedido, finais, autor));
      void removerNotaFiscalAnexos(descartados);
      showToast(
        finais.length
          ? `${finais.length} nota(s) fiscal(is) salva(s) no pedido ${pedido.numeroPedido}${enviados.length ? ` · ${enviados.length} arquivo(s)` : ''}.`
          : `Notas removidas — pedido ${pedido.numeroPedido} voltou a pendente.`,
        'success',
      );
      onClose();
    } catch (err: any) {
      void removerNotaFiscalAnexos(enviados);
      setErro(err?.message || 'Não foi possível salvar as notas fiscais.');
      setBusy(false);
    }
  };

  const valoresInformados = notas.map((n) => parseValor(n.valor)).filter((v): v is number => v !== undefined);
  const somaNotas = valoresInformados.reduce((a, b) => a + b, 0);
  const somaDiverge = notas.length > 0 && valoresInformados.length === notas.length && valorPedido > 0 && Math.abs(somaNotas - valorPedido) > 0.01;

  const slot = (r: Rascunho, t: NfAnexoTipo) => {
    const novo = r.novos[t];
    const atual = r.atuais[t];
    const Icon = t === 'xml' ? FileCode2 : FileText;
    return (
      <div className="rounded-lg border border-border bg-surface-2 p-2.5 min-w-0">
        <div className="flex items-center gap-1.5">
          <Icon className="w-3.5 h-3.5 text-fg-secondary" />
          <span className="text-[10px] font-bold uppercase text-fg-secondary">{t === 'xml' ? 'XML' : 'PDF'}</span>
          {t === 'xml' && <span className="ml-auto text-[9px] font-bold uppercase text-emerald-700 bg-emerald-50 rounded px-1.5 py-0.5">Recomendado</span>}
        </div>
        <input
          ref={(el) => { inputs.current[`${r.id}:${t}`] = el; }}
          type="file"
          accept={t === 'xml' ? '.xml,application/xml,text/xml' : '.pdf,application/pdf'}
          className="hidden"
          onChange={(e) => escolher(r.id, t, e.target.files?.[0])}
        />
        {novo ? (
          <div className="mt-1.5 flex items-center gap-1.5 text-xs min-w-0">
            <Paperclip className="w-3 h-3 text-emerald-600 shrink-0" />
            <span className="truncate text-fg font-medium" title={novo.name}>{novo.name}</span>
            <span className="text-fg-muted shrink-0">{kb(novo.size)}</span>
            <button type="button" onClick={() => descartarNovo(r.id, t)} className="ml-auto shrink-0 text-fg-muted hover:text-red-600" aria-label="Descartar arquivo">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : atual ? (
          <div className="mt-1.5 flex items-center gap-1.5 text-xs min-w-0">
            <button type="button" onClick={() => abrirAnexoNotaFiscal(atual)} className="truncate text-primary font-medium hover:underline" title={`Abrir ${atual.nome}`}>
              {atual.nome}
            </button>
            <button type="button" onClick={() => inputs.current[`${r.id}:${t}`]?.click()} className="ml-auto shrink-0 text-[11px] font-semibold text-fg-secondary hover:text-primary">Trocar</button>
            <button type="button" onClick={() => atualizar(r.id, { atuais: { ...r.atuais, [t]: null } })} className="shrink-0 text-fg-muted hover:text-red-600" aria-label="Remover anexo">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputs.current[`${r.id}:${t}`]?.click()}
            className="mt-1.5 w-full rounded-md border border-dashed border-border px-2 py-1.5 text-[11px] font-semibold text-fg-secondary hover:border-emerald-400 hover:text-emerald-700 transition-colors"
          >
            Selecionar {t === 'xml' ? '.xml' : '.pdf'}
          </button>
        )}
      </div>
    );
  };

  const campo = 'w-full bg-surface text-fg border border-border rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30';
  const rotulo = 'block text-[10px] font-bold text-fg-secondary uppercase mb-1';

  return (
    <div
      className="fixed inset-0 z-[75] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}
      onKeyDown={(e) => { if (e.key === 'Escape' && !busy) onClose(); }}
    >
      <form
        onSubmit={salvar}
        role="dialog"
        aria-modal="true"
        aria-labelledby="nf-registro-title"
        className="bg-surface w-full max-w-2xl rounded-xl shadow-2xl flex flex-col max-h-[92vh]"
      >
        <div className="p-5 border-b border-border flex items-start gap-3">
          <BadgeCheck className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide">Notas fiscais do pedido</p>
            <h3 id="nf-registro-title" className="font-bold text-fg mt-1 truncate">{pedido.clienteNome || 'Cliente'}</h3>
            <p className="text-xs text-fg-secondary">
              Pedido <span className="font-data-mono">{pedido.numeroPedido}</span> ·{' '}
              <span className="font-data-mono font-semibold text-emerald-700">{brl(valorPedido)}</span>
            </p>
          </div>
        </div>

        <div className="p-5 space-y-3 overflow-y-auto">
          {notas.length === 0 && (
            <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-fg-muted">
              Nenhuma nota. Adicione uma nota de serviço ou de material.
            </p>
          )}

          {notas.map((r, i) => {
            const diverge = r.lido?.valor !== undefined && notas.length === 1 && valorPedido > 0 && Math.abs(r.lido.valor - valorPedido) > 0.01;
            return (
              <div key={r.id} className={`rounded-xl border p-3 ${r.tipo === 'material' ? 'border-sky-300/70' : 'border-emerald-300/70'}`}>
                <div className="flex items-center gap-2 mb-2.5">
                  <span className="text-[11px] font-bold text-fg-secondary">Nota {i + 1}</span>
                  <div className="inline-flex rounded-lg border border-border overflow-hidden" role="radiogroup" aria-label="Tipo da nota">
                    {(['servico', 'material'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        role="radio"
                        aria-checked={r.tipo === t}
                        onClick={() => atualizar(r.id, { tipo: t })}
                        className={`px-2.5 py-1 text-[11px] font-bold transition-colors ${
                          r.tipo === t
                            ? t === 'material' ? 'bg-sky-600 text-white' : 'bg-emerald-600 text-white'
                            : 'bg-surface text-fg-secondary hover:bg-surface-3'
                        }`}
                      >
                        {NOTA_TIPO_LABEL[t]} <span className="font-normal opacity-80">({NOTA_TIPO_SIGLA[t]})</span>
                      </button>
                    ))}
                  </div>
                  <button type="button" onClick={() => remover(r)} className="ml-auto text-fg-muted hover:text-red-600 p-1" aria-label={`Remover nota ${i + 1}`} title="Remover nota">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2.5">
                  {slot(r, 'xml')}
                  {slot(r, 'pdf')}
                </div>

                {r.lido === null && (
                  <p className="mb-2.5 flex items-start gap-1.5 rounded-lg bg-amber-50 border border-amber-200 px-3 py-1.5 text-[11px] text-amber-800">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    Não reconheci o layout deste XML. Ele será anexado; preencha os dados manualmente.
                  </p>
                )}
                {r.lido && (
                  <p className={`mb-2.5 rounded-lg border px-3 py-1.5 text-[11px] ${diverge ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
                    Lido do XML ({r.lido.tipo === 'NFE' ? 'NF-e · material' : 'NFS-e · serviço'}){r.lido.numero ? ` · nº ${r.lido.numero}` : ''}
                    {r.lido.valor !== undefined ? ` · ${brl(r.lido.valor)}` : ''}
                    {diverge && ` — diferente do pedido (${brl(valorPedido)}).`}
                  </p>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <label className="block">
                    <span className={rotulo}>Nº da NF</span>
                    <input value={r.numero} onChange={(e) => atualizar(r.id, { numero: e.target.value })} placeholder="001234" className={`${campo} font-data-mono`} />
                  </label>
                  <label className="block">
                    <span className={rotulo}>Emissão</span>
                    <input type="date" value={r.data} max={hoje()} required onChange={(e) => atualizar(r.id, { data: e.target.value })} className={campo} />
                  </label>
                  <label className="block col-span-2 sm:col-span-1">
                    <span className={rotulo}>Valor (R$)</span>
                    <input
                      value={r.valor}
                      onChange={(e) => atualizar(r.id, { valor: e.target.value })}
                      inputMode="decimal"
                      placeholder={notas.length === 1 ? fmtValorInput(valorPedido) || '0,00' : '0,00'}
                      className={`${campo} font-data-mono`}
                    />
                  </label>
                  <label className="block col-span-2 sm:col-span-3">
                    <span className={rotulo}>Chave de acesso / cód. verificação</span>
                    <input value={r.chave} onChange={(e) => atualizar(r.id, { chave: e.target.value })} placeholder="Preenchida pelo XML" className={`${campo} text-xs font-data-mono`} />
                  </label>
                  <label className="block col-span-2 sm:col-span-3">
                    <span className={rotulo}>Observação</span>
                    <input value={r.obs} onChange={(e) => atualizar(r.id, { obs: e.target.value })} placeholder="Ex.: 50% na aceitação" className={campo} />
                  </label>
                </div>
              </div>
            );
          })}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setNotas((ns) => [...ns, vazio('servico')])}
              className="inline-flex items-center gap-1 rounded-lg border border-emerald-400 px-3 py-1.5 text-[11px] font-bold text-emerald-700 hover:bg-emerald-50"
            >
              <Plus className="w-3.5 h-3.5" /> Nota de serviço
            </button>
            <button
              type="button"
              onClick={() => setNotas((ns) => [...ns, vazio('material')])}
              className="inline-flex items-center gap-1 rounded-lg border border-sky-400 px-3 py-1.5 text-[11px] font-bold text-sky-700 hover:bg-sky-50"
            >
              <Plus className="w-3.5 h-3.5" /> Nota de material
            </button>
            {notas.length > 1 && (
              <p className={`ml-auto self-center text-[11px] ${somaDiverge ? 'text-amber-700 font-semibold' : 'text-fg-secondary'}`}>
                Soma das notas: <span className="font-data-mono">{brl(somaNotas)}</span> de {brl(valorPedido)}
                {somaDiverge && ' — confira'}
              </p>
            )}
          </div>

          <p className="text-[11px] text-fg-muted">
            O XML define o tipo sozinho (NF-e = material, NFS-e = serviço). Arquivos e número podem ser adicionados depois. Registro administrativo — não emite NF-e.
          </p>
          {erro && <p className="text-xs text-red-600 font-semibold">{erro}</p>}
        </div>

        <div className="p-4 border-t border-border flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="px-3 py-2 rounded-lg text-xs font-semibold text-fg-secondary hover:bg-surface-3 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={busy || (notas.length === 0 && !editando)}
            className="px-3 py-2 rounded-lg text-xs font-bold uppercase bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white inline-flex items-center gap-1"
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BadgeCheck className="w-3.5 h-3.5" />}
            {busy ? 'Enviando…' : editando ? 'Salvar notas' : 'Marcar emitida'}
          </button>
        </div>
      </form>
    </div>
  );
};
