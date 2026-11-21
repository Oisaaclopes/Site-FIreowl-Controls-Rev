import React, { useRef, useState } from 'react';
import { AlertTriangle, BadgeCheck, FileCode2, FileText, Loader2, Paperclip, X } from 'lucide-react';
import type { NotaFiscalAnexo, Pedido } from '@/lib/types';
import { showToast } from '@/components/ui/Feedback';
import { isNotaFiscalEmitida, pedidoValorNota, registrarNotaFiscalEmitida } from '@/lib/notaFiscal';
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

/** Abre um anexo da NF (bucket privado → URL assinada de curta duração). */
export async function abrirAnexoNotaFiscal(anexo: NotaFiscalAnexo) {
  try {
    window.open(await signedNotaFiscalUrl(anexo.path), '_blank', 'noopener,noreferrer');
  } catch (e: any) {
    showToast(e?.message || 'Não foi possível abrir o arquivo da nota.', 'error');
  }
}

interface Props {
  pedido: Pedido;
  autor?: string;
  onSave: (pedido: Pedido) => void;
  onClose: () => void;
}

/**
 * Registrar/editar a NF emitida de um pedido: nº, data, observação e os
 * arquivos da nota (XML recomendado + PDF/DANFE). O XML preenche nº, data e
 * chave sozinho. Usado na linha do pedido (a partir de ACEITO), na pendência
 * "Emitir nota fiscal" e no card de emitidas.
 */
export const NotaFiscalRegistroModal: React.FC<Props> = ({ pedido, autor, onSave, onClose }) => {
  const nf = pedido.proposal?.notaFiscal;
  const editando = isNotaFiscalEmitida(pedido);
  const valorPedido = pedidoValorNota(pedido);

  const [numero, setNumero] = useState(nf?.numero || '');
  const [data, setData] = useState((editando && nf?.dataEmissao?.slice(0, 10)) || hoje());
  const [obs, setObs] = useState(nf?.observacao || '');
  const [chave, setChave] = useState(nf?.chaveAcesso || '');
  // Anexos já salvos (null = removido nesta edição) e novos arquivos escolhidos.
  const [atuais, setAtuais] = useState<{ xml?: NotaFiscalAnexo | null; pdf?: NotaFiscalAnexo | null }>({ ...nf?.anexos });
  const [novos, setNovos] = useState<{ xml?: File; pdf?: File }>({});
  const [lido, setLido] = useState<DadosXmlNf | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const inputs = { xml: useRef<HTMLInputElement>(null), pdf: useRef<HTMLInputElement>(null) };

  const escolher = async (tipo: NfAnexoTipo, file?: File) => {
    if (!file) return;
    const invalido = validarArquivoNf(file, tipo);
    if (invalido) { setErro(invalido); return; }
    setErro(null);
    setNovos((n) => ({ ...n, [tipo]: file }));
    if (tipo !== 'xml') return;
    const dados = lerXmlNotaFiscal(await file.text());
    setLido(dados);
    if (!dados) return;
    if (dados.numero) setNumero(dados.numero);
    if (dados.dataEmissao && dados.dataEmissao <= hoje()) setData(dados.dataEmissao);
    if (dados.chaveAcesso) setChave(dados.chaveAcesso);
  };

  const descartarNovo = (tipo: NfAnexoTipo) => {
    setNovos((n) => ({ ...n, [tipo]: undefined }));
    if (tipo === 'xml') setLido(undefined);
    const el = inputs[tipo].current;
    if (el) el.value = '';
  };

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data || busy) return;
    setBusy(true); setErro(null);
    const enviados: string[] = [];
    try {
      const anexos: { xml?: NotaFiscalAnexo; pdf?: NotaFiscalAnexo } = {};
      const substituidos: string[] = [];
      for (const tipo of ['xml', 'pdf'] as const) {
        const anterior = nf?.anexos?.[tipo];
        if (novos[tipo]) {
          const up = await uploadNotaFiscalAnexo(pedido.id, novos[tipo]!, tipo);
          enviados.push(up.path);
          anexos[tipo] = up;
          if (anterior) substituidos.push(anterior.path);
        } else if (atuais[tipo]) {
          anexos[tipo] = atuais[tipo]!;
        } else if (anterior) {
          substituidos.push(anterior.path);
        }
      }
      onSave(registrarNotaFiscalEmitida(pedido, { numero, dataEmissao: data, observacao: obs, chaveAcesso: chave, anexos }, autor));
      void removerNotaFiscalAnexos(substituidos);
      const qtd = enviados.length;
      showToast(
        `NF${numero.trim() ? ` nº ${numero.trim()}` : ''} ${editando ? 'atualizada' : 'registrada como emitida'}${qtd ? ` · ${qtd} arquivo(s) anexado(s)` : ''}.`,
        'success',
      );
      onClose();
    } catch (err: any) {
      void removerNotaFiscalAnexos(enviados);
      setErro(err?.message || 'Não foi possível salvar a nota fiscal.');
      setBusy(false);
    }
  };

  const divergente = lido?.valor !== undefined && valorPedido > 0 && Math.abs(lido.valor - valorPedido) > 0.01;

  const slot = (tipo: NfAnexoTipo) => {
    const novo = novos[tipo];
    const atual = atuais[tipo];
    const Icon = tipo === 'xml' ? FileCode2 : FileText;
    return (
      <div className="rounded-lg border border-border bg-surface-2 p-3 min-w-0">
        <div className="flex items-center gap-1.5">
          <Icon className="w-4 h-4 text-fg-secondary" />
          <span className="text-[11px] font-bold uppercase text-fg-secondary">{tipo === 'xml' ? 'XML da nota' : 'PDF (DANFE)'}</span>
          {tipo === 'xml' && <span className="ml-auto text-[9px] font-bold uppercase text-emerald-700 bg-emerald-50 rounded px-1.5 py-0.5">Recomendado</span>}
        </div>
        <input
          ref={inputs[tipo]}
          type="file"
          accept={tipo === 'xml' ? '.xml,application/xml,text/xml' : '.pdf,application/pdf'}
          className="hidden"
          onChange={(e) => escolher(tipo, e.target.files?.[0])}
        />
        {novo ? (
          <div className="mt-2 flex items-center gap-1.5 text-xs min-w-0">
            <Paperclip className="w-3 h-3 text-emerald-600 shrink-0" />
            <span className="truncate text-fg font-medium" title={novo.name}>{novo.name}</span>
            <span className="text-fg-muted shrink-0">{kb(novo.size)}</span>
            <button type="button" onClick={() => descartarNovo(tipo)} className="ml-auto shrink-0 text-fg-muted hover:text-red-600" aria-label="Descartar arquivo">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : atual ? (
          <div className="mt-2 flex items-center gap-1.5 text-xs min-w-0">
            <button type="button" onClick={() => abrirAnexoNotaFiscal(atual)} className="truncate text-primary font-medium hover:underline" title={`Abrir ${atual.nome}`}>
              {atual.nome}
            </button>
            <button type="button" onClick={() => inputs[tipo].current?.click()} className="ml-auto shrink-0 text-[11px] font-semibold text-fg-secondary hover:text-primary">Trocar</button>
            <button type="button" onClick={() => setAtuais((a) => ({ ...a, [tipo]: null }))} className="shrink-0 text-fg-muted hover:text-red-600" aria-label="Remover anexo">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputs[tipo].current?.click()}
            className="mt-2 w-full rounded-md border border-dashed border-border px-2 py-2 text-[11px] font-semibold text-fg-secondary hover:border-emerald-400 hover:text-emerald-700 transition-colors"
          >
            Selecionar {tipo === 'xml' ? '.xml' : '.pdf'}
          </button>
        )}
        {tipo === 'xml' && !novo && !atual && (
          <p className="mt-1.5 text-[10px] text-fg-muted">Preenche nº, data e chave automaticamente.</p>
        )}
      </div>
    );
  };

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
        className="bg-surface w-full max-w-lg rounded-xl shadow-2xl flex flex-col max-h-[92vh]"
      >
        <div className="p-5 border-b border-border flex items-start gap-3">
          <BadgeCheck className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide">
              {editando ? 'Editar nota fiscal' : 'Informar nota fiscal emitida'}
            </p>
            <h3 id="nf-registro-title" className="font-bold text-fg mt-1 truncate">{pedido.clienteNome || 'Cliente'}</h3>
            <p className="text-xs text-fg-secondary">
              Pedido <span className="font-data-mono">{pedido.numeroPedido}</span> ·{' '}
              <span className="font-data-mono font-semibold text-emerald-700">{brl(valorPedido)}</span>
            </p>
          </div>
        </div>

        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3 overflow-y-auto">
          <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {slot('xml')}
            {slot('pdf')}
          </div>

          {lido === null && (
            <p className="sm:col-span-2 flex items-start gap-1.5 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-[11px] text-amber-800">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              Não reconheci o layout deste XML. Ele será anexado; preencha o número e a data manualmente.
            </p>
          )}
          {lido && (
            <div className={`sm:col-span-2 rounded-lg border px-3 py-2 text-[11px] ${divergente ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
              <p className="font-semibold">
                Lido do XML ({lido.tipo === 'NFE' ? 'NF-e' : 'NFS-e'}){lido.numero ? ` · nº ${lido.numero}` : ''}
                {lido.valor !== undefined ? ` · ${brl(lido.valor)}` : ''}
              </p>
              {divergente && (
                <p className="mt-0.5 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Valor da nota diferente do pedido ({brl(valorPedido)}). Confira antes de salvar.
                </p>
              )}
            </div>
          )}

          <label className="block">
            <span className="block text-[11px] font-bold text-fg-secondary uppercase mb-1">Nº da NF</span>
            <input
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              placeholder="Ex.: 001234"
              className="w-full bg-surface text-fg border border-border rounded-lg px-2.5 py-2 text-sm font-data-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
          </label>
          <label className="block">
            <span className="block text-[11px] font-bold text-fg-secondary uppercase mb-1">Data de emissão</span>
            <input
              type="date"
              value={data}
              max={hoje()}
              required
              onChange={(e) => setData(e.target.value)}
              className="w-full bg-surface text-fg border border-border rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="block text-[11px] font-bold text-fg-secondary uppercase mb-1">Chave de acesso / cód. verificação (opcional)</span>
            <input
              value={chave}
              onChange={(e) => setChave(e.target.value)}
              placeholder="Preenchida pelo XML"
              className="w-full bg-surface text-fg border border-border rounded-lg px-2.5 py-2 text-xs font-data-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="block text-[11px] font-bold text-fg-secondary uppercase mb-1">Observação (opcional)</span>
            <textarea
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              rows={2}
              placeholder="Ex.: faturamento antecipado, 50% na aceitação…"
              className="w-full bg-surface text-fg border border-border rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
          </label>
          <p className="sm:col-span-2 text-[11px] text-fg-muted">
            Arquivos e número podem ser adicionados depois. Registro administrativo — não emite NF-e.
          </p>
          {erro && <p className="sm:col-span-2 text-xs text-red-600 font-semibold">{erro}</p>}
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
            disabled={busy}
            className="px-3 py-2 rounded-lg text-xs font-bold uppercase bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white inline-flex items-center gap-1"
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BadgeCheck className="w-3.5 h-3.5" />}
            {busy ? 'Enviando…' : editando ? 'Salvar' : 'Marcar emitida'}
          </button>
        </div>
      </form>
    </div>
  );
};
