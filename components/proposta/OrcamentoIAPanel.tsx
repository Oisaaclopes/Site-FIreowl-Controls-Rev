'use client';
/**
 * Orçamento com IA — Fase 1: texto livre → plano revisável → rascunho no editor.
 * A IA só PROPÕE (Edge Function gerar-orcamento). Esta tela mostra o plano,
 * confere os totais com a conta oficial e, após a aprovação, grava produtos e o
 * pedido em RASCUNHO pelos mesmos handlers do restante do sistema.
 */
import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Sparkles, ArrowLeft, Download, Upload, FileText, UserPlus } from 'lucide-react';
import { GUIA_IA, MODELOS_IA, baixarTxt, limparTextoParaIA } from '@/lib/orcamentoIAModelos';
import { PEDIDO_TIPO_LABELS } from '@/lib/documentos';
import { fetchCnpjData } from '@/lib/cnpj';
import { DEFAULT_CLIENT_SEGMENT } from '@/lib/clients';
import type { Client, InventoryItem, Pedido } from '@/lib/types';
import { clientDisplayName } from '@/lib/clientSelection';
import { showToast, requestConfirm } from '@/components/ui/Feedback';
import { CODIGOS_ESCALAVEIS, ErroOrcamentoIA, ModoIA, gerarPlanoOrcamento } from '@/lib/orcamentoIAClient';
import {
  PlanoOrcamentoIA,
  clienteNovoDoPlano,
  conferirPlano,
  formatarCnpj,
  montarClienteNovo,
  montarPedidoDoPlano,
  resolverCliente,
  motivoParaEscalar,
  produtoAtualizadoParaEstoque,
  produtoNovoParaEstoque,
  proximoNumeroPedido,
  resolverAcoesProdutos,
  validarPlano,
} from '@/lib/orcamentoIA';
import { lineTotal, roundMoney } from '@/lib/commercialTotals';

interface Props {
  clients: Client[];
  inventory: InventoryItem[];
  pedidos: Pedido[];
  nextProposalNumber?: number;
  currentUserName?: string;
  onCreateInventoryItem?: (item: InventoryItem) => Promise<InventoryItem>;
  onEditInventoryCatalog?: (item: InventoryItem) => Promise<void>;
  onSavePedido: (pedido: Pedido) => void | Promise<void>;
  /** Cadastro de cliente (mesmo handler da tela Clientes) — cliente novo do plano. */
  onAddClient?: (client: Client) => void | Promise<void>;
  /** Abre o pedido recém-criado no editor de Pedidos. */
  onOpenPedido: (pedido: Pedido) => void;
}

const brl = (v: number | null | undefined) =>
  v == null ? '—' : `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const EXEMPLO = `Exemplo:
Orçamento para o cliente ATLAS — Sistema de alarme sem fio da academia.
Validade 15 dias. Pagamento 50% na aprovação e 50% na entrega.
Equipamentos Intelbras (margem 30% sobre o custo):
- AMT 8000 PRO, central de alarme, cód. 4543589, custo 686,34, qtd 1
- IVP 8000 EX, sensor externo, cód. 4541041, custo 414,90, qtd 8
Serviços:
- Instalação e fixação dos equipamentos — R$ 3.200,00
Opcional (não somar): instalação do repetidor — R$ 450,00
Responsabilidades da Atlas: ponto elétrico na guarita...`;

const ACAO_LABEL: Record<string, { label: string; cls: string }> = {
  criar: { label: 'Criar', cls: 'bg-emerald-600/15 text-emerald-700 dark:text-emerald-400' },
  atualizar: { label: 'Atualizar preço', cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-400' },
  usar: { label: 'Já cadastrado', cls: 'bg-surface-3 text-fg-secondary' },
};

const Lista: React.FC<{ titulo: string; itens: string[] }> = ({ titulo, itens }) =>
  itens.length ? (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wide text-fg-muted mb-1">{titulo}</p>
      <ul className="list-disc pl-5 text-xs text-fg-secondary space-y-0.5">{itens.map((t, i) => <li key={i}>{t}</li>)}</ul>
    </div>
  ) : null;

export const OrcamentoIAPanel: React.FC<Props> = ({
  clients,
  inventory,
  pedidos,
  nextProposalNumber = 0,
  currentUserName = '',
  onCreateInventoryItem,
  onEditInventoryCatalog,
  onSavePedido,
  onAddClient,
  onOpenPedido,
}) => {
  const [texto, setTexto] = useState('');
  const [gerando, setGerando] = useState('');
  /** Qual IA gerou o plano em tela e, se houve, por que subiu para a avançada. */
  const [origem, setOrigem] = useState<{ modo: ModoIA; motivo?: string } | null>(null);
  const [aplicando, setAplicando] = useState('');
  const [plano, setPlano] = useState<PlanoOrcamentoIA | null>(null);
  const [errosPlano, setErrosPlano] = useState<string[]>([]);
  const [clienteEscolhido, setClienteEscolhido] = useState('');

  const clienteId = clienteEscolhido || plano?.cliente.clienteId || '';
  const cliente = clients.find((c) => c.id === clienteId) || null;
  const conferencia = useMemo(
    () => (plano ? conferirPlano({ ...plano, cliente: { ...plano.cliente, clienteId: cliente?.id || null } }, inventory, clients) : null),
    [plano, cliente, inventory, clients]
  );
  const numeroPedido = proximoNumeroPedido(pedidos, new Date().getFullYear(), nextProposalNumber);
  const invPorId = useMemo(() => new Map(inventory.map((i) => [i.id, i])), [inventory]);
  const candidatos = plano?.cliente.candidatosIds.map((id) => clients.find((c) => c.id === id)).filter(Boolean) as Client[] | undefined;

  // Só o que tem conteúdo vai para a IA (sem comentários "#" e campos vazios).
  const textoLimpo = useMemo(() => limparTextoParaIA(texto), [texto]);
  const clienteNovo = plano && !cliente ? clienteNovoDoPlano(plano) : null;

  const exibir = (p: PlanoOrcamentoIA, erros: string[], modo: ModoIA, motivo?: string) => {
    setPlano(resolverCliente(resolverAcoesProdutos(p, inventory), clients));
    setErrosPlano(erros);
    setClienteEscolhido('');
    setOrigem({ modo, motivo });
  };

  const carregarArquivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const arq = e.target.files?.[0];
    e.target.value = '';
    if (!arq) return;
    if (arq.size > 200_000) { showToast('Arquivo grande demais (máx. 200 KB).'); return; }
    setTexto(await arq.text());
  };

  /** Gera com a IA avançada (Opus) — automática após falha da rápida ou pelo botão. */
  const gerarAvancado = async (motivo: string) => {
    setGerando('Refazendo com a IA avançada… (até 2 min)');
    const r = await gerarPlanoOrcamento(textoLimpo, 'avancado');
    const { plano: p, erros } = validarPlano(r.plano);
    if (!p) throw new Error(erros[0] || 'Plano inválido.');
    exibir(p, erros, 'avancado', motivo);
  };

  // Fase 1.1: começa SEMPRE na IA rápida (Haiku, custo baixo). Só sobe para a
  // avançada quando o plano vem com defeito de estrutura (ver motivoParaEscalar).
  const gerar = async () => {
    setGerando('Montando o plano…');
    try {
      let r;
      try {
        r = await gerarPlanoOrcamento(textoLimpo, 'rapido');
      } catch (err) {
        if (err instanceof ErroOrcamentoIA && CODIGOS_ESCALAVEIS.has(err.codigo)) {
          await gerarAvancado('a IA rápida não conseguiu montar o plano');
          return;
        }
        throw err;
      }
      const { plano: p, erros } = validarPlano(r.plano);
      const motivo = motivoParaEscalar(p, erros);
      if (motivo) {
        try {
          await gerarAvancado(motivo);
          return;
        } catch (err) {
          // Avançada falhou: mostra o plano da rápida (se existir) para revisão.
          if (!p) throw err;
          showToast(`A IA avançada não respondeu; mostrando o plano da IA rápida. ${err instanceof Error ? err.message : ''}`);
        }
      }
      if (!p) throw new Error(erros[0] || 'Plano inválido.');
      exibir(p, erros, 'rapido');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Falha ao gerar o plano.');
    } finally {
      setGerando('');
    }
  };

  const refazerAvancado = async () => {
    try {
      await gerarAvancado('pedido manual');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Falha ao gerar o plano.');
    } finally {
      setGerando('');
    }
  };

  const aprovar = async () => {
    if (!plano || (!cliente && !clienteNovo)) return;
    if (clienteNovo && !onAddClient) { showToast('Cadastro de cliente indisponível nesta tela.'); return; }
    const novos = plano.produtos.filter((p) => p.acao === 'criar').length;
    const atualizados = plano.produtos.filter((p) => p.acao === 'atualizar').length;
    const tipoDoc = PEDIDO_TIPO_LABELS[plano.dados.tipoDocumento];
    const ok = await requestConfirm(
      `Criar o rascunho ${numeroPedido} (${tipoDoc}) para ${cliente ? clientDisplayName(cliente) : `${clienteNovo!.nome} — cliente NOVO`}?\n\n` +
        (clienteNovo ? `• cadastrar o cliente ${clienteNovo.nome} (CNPJ ${formatarCnpj(clienteNovo.cnpj)})\n` : '') +
        `• ${novos} produto(s) novo(s) no estoque (saldo 0)\n• ${atualizados} produto(s) com preço atualizado\n\n` +
        'O documento NÃO será enviado ao cliente.'
    );
    if (!ok) return;
    const idsPorChave: Record<string, string> = {};
    try {
      let clienteFinal: Client | null = cliente;
      if (!clienteFinal && clienteNovo) {
        setAplicando('Consultando o CNPJ na Receita…');
        const receita = await fetchCnpjData(clienteNovo.cnpj).catch(() => null);
        setAplicando(`Cadastrando o cliente ${clienteNovo.nome}…`);
        clienteFinal = montarClienteNovo(clienteNovo, receita, DEFAULT_CLIENT_SEGMENT, new Date());
        await onAddClient!(clienteFinal);
      }
      if (!clienteFinal) throw new Error('cliente não definido');
      for (const p of plano.produtos) {
        const atual = p.inventoryItemId ? invPorId.get(p.inventoryItemId) : undefined;
        if (p.acao === 'criar' || !atual) {
          if (!onCreateInventoryItem) throw new Error('Cadastro de produto indisponível nesta tela.');
          setAplicando(`Cadastrando ${p.modelo}…`);
          const salvo = await onCreateInventoryItem(produtoNovoParaEstoque(p));
          idsPorChave[p.chave] = salvo.id;
        } else {
          if (p.acao === 'atualizar') {
            if (!onEditInventoryCatalog) throw new Error('Edição de produto indisponível nesta tela.');
            setAplicando(`Atualizando preço de ${p.modelo}…`);
            await onEditInventoryCatalog(produtoAtualizadoParaEstoque(atual, p));
          }
          idsPorChave[p.chave] = atual.id;
        }
      }
      setAplicando('Criando o rascunho…');
      const agora = new Date();
      const pedido = montarPedidoDoPlano(plano, {
        cliente: { id: clienteFinal.id, name: clienteFinal.name },
        idsPorChave,
        numeroPedido,
        responsavelNome: currentUserName,
        agora: agora.toISOString(),
        hoje: agora.toISOString().slice(0, 10),
      });
      await onSavePedido(pedido);
      showToast(`Rascunho ${pedido.numeroPedido} criado. Revise no editor antes de emitir.`, 'success');
      setPlano(null);
      setTexto('');
      onOpenPedido(pedido);
    } catch (err) {
      console.error('Falha ao aplicar o plano de orçamento:', err);
      showToast(`Parou no meio: ${err instanceof Error ? err.message : 'erro ao gravar'}. O que já foi gravado (cliente/produtos) fica no cadastro; o rascunho não foi criado.`);
    } finally {
      setAplicando('');
    }
  };

  // ------------------------------- ENTRADA -------------------------------
  if (!plano) {
    return (
      <div className="bg-surface rounded-xl border border-border shadow-sm p-5 space-y-4">
        <div className="flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-primary mt-0.5 shrink-0" />
          <div>
            <h2 className="text-base font-bold text-fg">Orçamento com IA</h2>
            <p className="text-xs text-fg-secondary mt-0.5">
              Descreva o orçamento (cliente, equipamentos com custo, serviços, condições e textos). A IA monta um plano; você revisa e só então o
              sistema cria os produtos e o rascunho. Nada é enviado ao cliente. Usa a IA rápida (baixo custo); se o plano vier com
              problema, refaz sozinha na IA avançada.
            </p>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-surface-3/50 p-3 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] font-bold uppercase tracking-wide text-fg-muted flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" /> Modelos prontos (.txt) — preencha e envie; comentários “#” e campos vazios não gastam tokens
            </p>
            <button type="button" onClick={() => baixarTxt(GUIA_IA.arquivo, GUIA_IA.conteudo)} className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1">
              <Download className="w-3.5 h-3.5" /> Guia: o que a IA faz
            </button>
          </div>
          <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-2">
            {MODELOS_IA.map((m) => (
              <div key={m.id} className="rounded-lg border border-border bg-surface p-2.5 flex flex-col gap-1.5">
                <p className="text-xs font-bold text-fg">{m.titulo}</p>
                <p className="text-[11px] text-fg-muted flex-1">{m.descricao}</p>
                <div className="flex gap-3">
                  <button type="button" onClick={() => baixarTxt(m.arquivo, m.conteudo)} className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1">
                    <Download className="w-3.5 h-3.5" /> Baixar .txt
                  </button>
                  <button
                    type="button"
                    disabled={!!gerando}
                    onClick={async () => {
                      if (texto.trim() && !(await requestConfirm('Substituir o texto atual pelo modelo?'))) return;
                      setTexto(m.conteudo);
                    }}
                    className="text-[11px] font-bold text-fg-secondary hover:text-fg"
                  >
                    Usar aqui
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={EXEMPLO}
          rows={18}
          disabled={!!gerando}
          className="w-full rounded-lg border border-border bg-surface p-3 text-sm text-fg font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-4">
            <label className={`text-xs font-bold text-fg-secondary hover:text-fg flex items-center gap-1.5 cursor-pointer ${gerando ? 'pointer-events-none opacity-50' : ''}`}>
              <Upload className="w-4 h-4" /> Carregar .txt
              <input type="file" accept=".txt,text/plain" className="hidden" onChange={carregarArquivo} />
            </label>
            <p className="text-[11px] text-fg-muted">
              Vai para a IA: <b className="text-fg">{textoLimpo.length.toLocaleString('pt-BR')}</b> de {texto.length.toLocaleString('pt-BR')} caracteres (máx. 30.000)
            </p>
          </div>
          <button
            type="button"
            onClick={gerar}
            disabled={!!gerando || textoLimpo.length < 20 || textoLimpo.length > 30000}
            className="bg-primary hover:opacity-90 text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-2 uppercase tracking-wide disabled:opacity-50"
          >
            {gerando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {gerando || 'Gerar plano com IA'}
          </button>
        </div>
      </div>
    );
  }

  // ------------------------------- REVISÃO -------------------------------
  const alertas = [...(conferencia?.alertas || []), ...plano.alertas];
  const bloqueado = (!cliente && !clienteNovo) || errosPlano.length > 0 || !!aplicando || !!gerando;
  const itensBase = plano.itens.filter((i) => !i.opcional);
  const opcionais = plano.itens.filter((i) => i.opcional);
  const margem = conferencia ? roundMoney(conferencia.equipamentos - conferencia.custoEquipamentos) : 0;

  return (
    <div className="space-y-4">
      <div className="bg-surface rounded-xl border border-border shadow-sm p-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-fg-muted">Plano de revisão · {numeroPedido} · {PEDIDO_TIPO_LABELS[plano.dados.tipoDocumento]} · Rascunho</p>
          <h2 className="text-lg font-bold text-fg mt-0.5">{plano.dados.titulo || 'Sem título'}</h2>
          <p className="text-xs text-fg-secondary mt-1">
            {[plano.dados.local && `Local: ${plano.dados.local}`, plano.dados.dataEmissao && `Data: ${plano.dados.dataEmissao.split('-').reverse().join('/')}`, plano.dados.validadeDias && `Validade: ${plano.dados.validadeDias} dias`]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <button type="button" onClick={() => setPlano(null)} disabled={!!aplicando || !!gerando} className="text-xs font-bold text-fg-secondary hover:text-fg flex items-center gap-1.5">
            <ArrowLeft className="w-4 h-4" /> Voltar e ajustar o texto
          </button>
          {origem && (
            <p className="text-[11px] text-fg-muted text-right">
              Gerado pela <b className="text-fg">{origem.modo === 'avancado' ? 'IA avançada' : 'IA rápida'}</b>
              {origem.motivo && origem.motivo !== 'pedido manual' && <> (subiu automaticamente: {origem.motivo})</>}
            </p>
          )}
          {origem?.modo === 'rapido' && (
            <button
              type="button"
              onClick={refazerAvancado}
              disabled={!!gerando || !!aplicando}
              title="Usa o modelo mais capaz (custa mais). Útil quando o plano veio fraco."
              className="text-xs font-bold text-primary hover:underline flex items-center gap-1.5 disabled:opacity-50"
            >
              {gerando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {gerando || 'Refazer com IA avançada'}
            </button>
          )}
        </div>
      </div>

      {(errosPlano.length > 0 || alertas.length > 0) && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 space-y-2">
          {errosPlano.map((e, i) => (
            <p key={`e${i}`} className="text-xs font-bold text-danger flex gap-2"><AlertTriangle className="w-4 h-4 shrink-0" />{e}</p>
          ))}
          {alertas.map((a, i) => (
            <p key={`a${i}`} className="text-xs text-fg flex gap-2"><AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />{a}</p>
          ))}
        </div>
      )}

      <div className="bg-surface rounded-xl border border-border shadow-sm p-5 space-y-2">
        <p className="text-[11px] font-bold uppercase tracking-wide text-fg-muted">Cliente</p>
        {plano.cliente.nomeInformado && <p className="text-xs text-fg-muted">Informado no texto: “{plano.cliente.nomeInformado}”</p>}
        <select
          value={clienteId}
          onChange={(e) => setClienteEscolhido(e.target.value)}
          className="w-full max-w-xl py-2 px-2.5 text-sm border border-border rounded-lg bg-surface text-fg"
        >
          <option value="">Selecione o cliente…</option>
          {candidatos && candidatos.length > 0 && (
            <optgroup label="Sugeridos pela IA">{candidatos.map((c) => <option key={c.id} value={c.id}>{clientDisplayName(c)} — {c.name}</option>)}</optgroup>
          )}
          <optgroup label="Todos os clientes">{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>
        </select>
        {clienteNovo && (
          <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-fg flex gap-2 max-w-xl">
            <UserPlus className="w-4 h-4 shrink-0 text-emerald-600" />
            <p>
              <b>Cliente novo:</b> {clienteNovo.nome} · CNPJ {formatarCnpj(clienteNovo.cnpj)}. Será cadastrado ao aprovar, com razão social e endereço
              da Receita. Para usar um cliente existente, escolha na lista acima.
            </p>
          </div>
        )}
      </div>

      <div className="bg-surface rounded-xl border border-border shadow-sm p-5 overflow-x-auto">
        <p className="text-[11px] font-bold uppercase tracking-wide text-fg-muted mb-2">Produtos no estoque ({plano.produtos.length})</p>
        <table className="w-full text-xs">
          <thead className="text-fg-muted text-left">
            <tr><th className="py-1.5 pr-3">Modelo</th><th className="pr-3">Ação</th><th className="pr-3">Marca / categoria</th><th className="pr-3 text-right">Custo</th><th className="text-right">Venda</th></tr>
          </thead>
          <tbody>
            {plano.produtos.map((p) => {
              const atual = p.inventoryItemId ? invPorId.get(p.inventoryItemId) : undefined;
              const muda = (antes?: number, depois?: number | null) =>
                p.acao === 'atualizar' && antes != null && depois != null && Math.abs(antes - depois) > 0.005 ? (
                  <><span className="line-through text-fg-muted mr-1">{brl(antes)}</span>{brl(depois)}</>
                ) : brl(depois ?? antes);
              return (
                <tr key={p.chave} className="border-t border-border">
                  <td className="py-1.5 pr-3"><span className="font-bold text-fg">{p.modelo}</span>{p.codigoFornecedor && <span className="text-fg-muted"> · cód. {p.codigoFornecedor}</span>}<div className="text-fg-muted">{p.descricao || p.nome}</div></td>
                  <td className="pr-3"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${ACAO_LABEL[p.acao].cls}`}>{ACAO_LABEL[p.acao].label}</span></td>
                  <td className="pr-3 text-fg-secondary">{[p.marca, p.categoria].filter(Boolean).join(' · ')}</td>
                  <td className="pr-3 text-right font-data-mono">{muda(atual?.costPrice, p.custo)}</td>
                  <td className="text-right font-data-mono">{muda(atual?.salePrice, p.venda)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="bg-surface rounded-xl border border-border shadow-sm p-5 overflow-x-auto">
        <p className="text-[11px] font-bold uppercase tracking-wide text-fg-muted mb-2">Itens do orçamento</p>
        <table className="w-full text-xs">
          <thead className="text-fg-muted text-left">
            <tr><th className="py-1.5 pr-3">#</th><th className="pr-3">Descrição</th><th className="pr-3">Tipo</th><th className="pr-3 text-right">Qtd.</th><th className="pr-3 text-right">Unit.</th><th className="text-right">Total</th></tr>
          </thead>
          <tbody>
            {itensBase.map((i, idx) => (
              <tr key={idx} className="border-t border-border">
                <td className="py-1.5 pr-3 text-fg-muted">{idx + 1}</td>
                <td className="pr-3 text-fg">{i.descricao}</td>
                <td className="pr-3 text-fg-secondary">{i.tipo === 'servico' ? 'Serviço' : 'Equipamento'}</td>
                <td className="pr-3 text-right font-data-mono">{i.quantidade} {i.unidade}</td>
                <td className="pr-3 text-right font-data-mono">{brl(i.precoUnitario)}</td>
                <td className="text-right font-data-mono">{brl(lineTotal(i))}</td>
              </tr>
            ))}
            {opcionais.map((i, idx) => (
              <tr key={`o${idx}`} className="border-t border-dashed border-border text-fg-muted italic">
                <td className="py-1.5 pr-3">opc.</td>
                <td className="pr-3">{i.descricao} <span className="not-italic text-[10px] font-bold">(opcional — fora do total)</span></td>
                <td className="pr-3">{i.tipo === 'servico' ? 'Serviço' : 'Equipamento'}</td>
                <td className="pr-3 text-right font-data-mono">{i.quantidade} {i.unidade}</td>
                <td className="pr-3 text-right font-data-mono">{brl(i.precoUnitario)}</td>
                <td className="text-right font-data-mono">{brl(lineTotal(i))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {conferencia && (
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div className="rounded-lg bg-surface-3 p-3"><p className="text-fg-muted">Equipamentos</p><p className="font-bold text-fg font-data-mono">{brl(conferencia.equipamentos)}</p><p className="text-[10px] text-fg-muted">custo {brl(conferencia.custoEquipamentos)} · margem {brl(margem)}</p></div>
            <div className="rounded-lg bg-surface-3 p-3"><p className="text-fg-muted">Serviços</p><p className="font-bold text-fg font-data-mono">{brl(conferencia.servicos)}</p></div>
            <div className="rounded-lg bg-navy-3 p-3 text-white"><p className="opacity-80">Total do orçamento</p><p className="font-bold font-data-mono text-base">{brl(conferencia.total)}</p></div>
            {conferencia.opcionais > 0 && (
              <div className="rounded-lg bg-surface-3 p-3"><p className="text-fg-muted">Com os opcionais</p><p className="font-bold text-fg font-data-mono">{brl(roundMoney(conferencia.total + conferencia.opcionais))}</p></div>
            )}
          </div>
        )}
      </div>

      <div className="bg-surface rounded-xl border border-border shadow-sm p-5 space-y-3">
        <p className="text-[11px] font-bold uppercase tracking-wide text-fg-muted">Condições e textos</p>
        <div className="grid md:grid-cols-2 gap-x-6 gap-y-1 text-xs text-fg-secondary">
          <p><b className="text-fg">Prazo:</b> {plano.dados.prazoExecucao || '—'}</p>
          <p><b className="text-fg">Pagamento:</b> {plano.dados.formaPagamento || '—'}</p>
          <p><b className="text-fg">Garantia serviços:</b> {plano.dados.garantiaServicosDias ? `${plano.dados.garantiaServicosDias} dias` : 'padrão (90 dias)'}</p>
          <p><b className="text-fg">Garantia equipamentos:</b> {plano.dados.garantiaMateriais || 'padrão (12 meses)'}</p>
        </div>
        {plano.textos.objetivo && <div><p className="text-[11px] font-bold uppercase tracking-wide text-fg-muted mb-1">Objetivo</p><p className="text-xs text-fg-secondary whitespace-pre-line">{plano.textos.objetivo}</p></div>}
        {plano.textos.solucao && <div><p className="text-[11px] font-bold uppercase tracking-wide text-fg-muted mb-1">Solução</p><p className="text-xs text-fg-secondary whitespace-pre-line">{plano.textos.solucao}</p></div>}
        <div className="grid md:grid-cols-2 gap-4">
          <Lista titulo="Responsabilidades da Fireowl" itens={plano.textos.responsabilidadesContratada} />
          <Lista titulo="Responsabilidades do cliente" itens={plano.textos.responsabilidadesContratante} />
          <Lista titulo="Não inclusos" itens={plano.textos.naoIncluso} />
          <Lista titulo="Premissas técnicas" itens={plano.textos.premissas} />
        </div>
        <p className="text-[11px] text-fg-muted">Carta de apresentação e cláusulas jurídicas usam os textos-padrão da empresa. Tudo continua editável no editor depois de criado.</p>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3">
        {!cliente && !clienteNovo && <p className="text-xs text-danger font-bold">Escolha o cliente para continuar.</p>}
        {aplicando && <p className="text-xs text-fg-secondary flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />{aplicando}</p>}
        <button
          type="button"
          onClick={aprovar}
          disabled={bloqueado}
          className="bg-danger hover:bg-danger-hover text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-2 uppercase tracking-wide disabled:opacity-50"
        >
          <CheckCircle2 className="w-4 h-4" /> Aprovar e criar rascunho
        </button>
      </div>
    </div>
  );
};
