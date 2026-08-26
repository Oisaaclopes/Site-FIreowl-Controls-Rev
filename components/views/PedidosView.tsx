'use client';

import React, { useMemo, useRef, useState } from 'react';
import { PedidoOS, Client, Pedido, InventoryItem, PartnerBrand, PedidoTemplate, PedidoStatus, PdfPrefs, UserRole, ServiceCatalogItem, DocumentosPadrao, DocumentType } from '@/lib/types';
import { uploadPropostaCapa, removePropostaCapa, propostaCapaDataUrl, blobToDataUrl, readImageSize } from '@/lib/propostaCapa';
import { CommercialProposalModal } from '@/components/proposta/CommercialProposalModal';
import { CommercialProposalPDFView } from '@/components/proposta/CommercialProposalPDFView';
import { DocumentTypeModal } from '@/components/proposta/DocumentTypeModal';
import { OrcamentoPDFView } from '@/components/documentos/OrcamentoPDFView';
import { resolveDocumentoPadrao, DOCUMENT_TYPE_LABELS } from '@/lib/documentos';
import { DataListRow, RowMeta, Badge } from '@/components/DataListRow';
import { Toggle } from '@/components/SidePanel';
import { usePrivacy } from '@/lib/privacy';
import {
  FileText,
  Plus,
  Search,
  Eye,
  Wrench,
  Printer,
  List,
  CalendarDays,
  Settings,
  Pencil,
  Trash2,
  History,
  Files,
} from 'lucide-react';

interface PedidosViewProps {
  pedidosOS: PedidoOS[];
  pedidos: Pedido[];
  clients: Client[];
  inventory: InventoryItem[];
  partnerBrands: PartnerBrand[];
  templates: PedidoTemplate[];
  services?: ServiceCatalogItem[];
  companyProfile: any;
  onAddOS: (os: PedidoOS) => void;
  onSavePedido: (pedido: Pedido) => void;
  onUpdatePedidoStatus: (pedidoId: string, newStatus: PedidoStatus) => void;
  onDeletePedido?: (pedidoId: string) => void;
  onGenerateOSFromPedido: (pedido: Pedido) => void;
  onSelectClientForReport?: (clientName: string) => void;
  onAddClient?: (client: Client) => void;
  pdfPrefs: PdfPrefs;
  documentosPadrao?: DocumentosPadrao;
  userRole: UserRole;
  currentUserName?: string;
  /** Aba inicial ao abrir (ex.: atalho "Nova OS" do painel). */
  initialView?: 'propostas' | 'ordens_servico' | null;
}

// Metadados de status das propostas (cor usada em borda, texto e badge)
const STATUS_META: Record<PedidoStatus, { label: string; color: string }> = {
  rascunho: { label: 'Rascunho', color: '#475569' },
  em_revisao: { label: 'Em Revisão', color: '#b45309' },
  aprovado_interno: { label: 'Aprovado Interno', color: '#1d4ed8' },
  enviado_ao_cliente: { label: 'Enviado ao Cliente', color: '#7e22ce' },
  aceito: { label: 'Aceito', color: '#047857' },
  recusado: { label: 'Recusado', color: '#dc2626' },
  expirado: { label: 'Expirado', color: '#64748b' },
};
const STATUS_ORDER = Object.keys(STATUS_META) as PedidoStatus[];

// Mini-cards do funil (ordem enxuta e representativa)
const PIPELINE: PedidoStatus[] = ['rascunho', 'em_revisao', 'enviado_ao_cliente', 'aceito', 'recusado'];

const DEFAULT_STATUS_KEY = 'fireowl_pedidos_default_status';

const pad2 = (n: number) => n.toString().padStart(2, '0');
const dateKeyOf = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const brl = (v: number) => `R$ ${(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

export const PedidosView: React.FC<PedidosViewProps> = ({
  pedidosOS,
  pedidos,
  clients,
  inventory,
  partnerBrands,
  templates,
  services = [],
  companyProfile,
  onAddOS,
  onSavePedido,
  onUpdatePedidoStatus,
  onDeletePedido,
  onGenerateOSFromPedido,
  onSelectClientForReport,
  onAddClient,
  pdfPrefs,
  documentosPadrao = {},
  userRole,
  currentUserName = '',
  initialView,
}) => {
  const { maskMoney } = usePrivacy();
  const isTecnico = userRole === 'TECNICO';

  // Aba inicial: atalho "Nova OS" força OS; técnico começa em OS; demais em propostas
  const [viewTab, setViewTab] = useState<'propostas' | 'ordens_servico'>(
    initialView ?? (isTecnico ? 'ordens_servico' : 'propostas')
  );

  // Modo de exibição das propostas
  const [displayMode, setDisplayMode] = useState<'lista' | 'timeline'>('lista');

  // Filtros
  const [filterStatus, setFilterStatus] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      try {
        return localStorage.getItem(DEFAULT_STATUS_KEY) || 'TODOS';
      } catch {
        /* ignore */
      }
    }
    return 'TODOS';
  });
  const [filterClient, setFilterClient] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showDefaultMenu, setShowDefaultMenu] = useState(false);

  // Modais & Overlays
  const [isProposalModalOpen, setIsProposalModalOpen] = useState(false);
  const [editingPedido, setEditingPedido] = useState<Pedido | null>(null);
  const [pdfPreviewPedido, setPdfPreviewPedido] = useState<Pedido | null>(null);
  const [pdfOptions, setPdfOptions] = useState({
    showLogo: pdfPrefs.showLogo,
    detailedSubtotal: pdfPrefs.detailedSubtotal,
    showBankData: pdfPrefs.showBankData,
    showCarta: true,
    showIndice: true,
    showHistorico: true,
    showClausulas: true,
    showTermoAceite: true,
    showAreasAtuacao: true,
    showFechamento: true,
    capaImagemUrl: undefined as string | undefined,
  });
  const [pdfConfigPedido, setPdfConfigPedido] = useState<Pedido | null>(null);
  const [docModalPedido, setDocModalPedido] = useState<Pedido | null>(null);
  const [orcamentoPedido, setOrcamentoPedido] = useState<Pedido | null>(null);
  const [capaBusy, setCapaBusy] = useState(false);
  const capaInputRef = useRef<HTMLInputElement>(null);

  // Carrega (assíncrono) a imagem de capa persistida na proposta como data URI.
  const loadCapaIntoOptions = async (ped: Pedido) => {
    const path = ped.proposal?.capaImagemPath;
    if (!path) return;
    try {
      const dataUrl = await propostaCapaDataUrl(path);
      setPdfOptions((prev) => ({ ...prev, capaImagemUrl: dataUrl }));
    } catch {
      /* Sem imagem acessível → o PDF usa o grafismo blueprint. */
    }
  };

  const openPdf = (ped: Pedido) => {
    const base = {
      showLogo: pdfPrefs.showLogo,
      detailedSubtotal: pdfPrefs.detailedSubtotal,
      showBankData: pdfPrefs.showBankData,
      showCarta: true,
      showIndice: true,
      showHistorico: true,
      showClausulas: true,
      showTermoAceite: true,
      showAreasAtuacao: true,
      showFechamento: true,
      capaImagemUrl: undefined as string | undefined,
    };
    setPdfOptions(base);
    loadCapaIntoOptions(ped);
    if (pdfPrefs.configBeforeGenerate) setPdfConfigPedido(ped);
    else setPdfPreviewPedido(ped);
  };

  // Roteia a geração para o documento escolhido. Fase 1: só a Proposta comercial
  // tem gerador real; os demais avisam que entram em fases seguintes.
  const dispatchDocument = (ped: Pedido, doc: DocumentType) => {
    if (doc === 'proposta_comercial') {
      openPdf(ped);
      return;
    }
    if (doc === 'orcamento') {
      setOrcamentoPedido(ped);
      return;
    }
    if (doc === 'personalizado') {
      alert('A personalização de documento (título e campos livres) entra em uma fase seguinte. Por ora, gere a Proposta comercial.');
      return;
    }
    alert(`O gerador de "${DOCUMENT_TYPE_LABELS[doc]}" entra em uma próxima fase. Por ora, apenas a Proposta comercial é gerada.`);
  };

  // Ponto de entrada ao gerar documento: usa o padrão do tipo do pedido; se não
  // houver padrão, abre o modal de escolha.
  const handleGenerateDocument = (ped: Pedido) => {
    const padrao = resolveDocumentoPadrao(ped, documentosPadrao);
    if (padrao) dispatchDocument(ped, padrao);
    else setDocModalPedido(ped);
  };

  // Upload da imagem de capa (JPG/PNG) no modal de opções do PDF.
  const handleCapaFile = async (file: File | undefined) => {
    if (!file || !pdfConfigPedido) return;
    if (!/^image\/(jpe?g|png)$/i.test(file.type)) {
      alert('Envie uma imagem JPG ou PNG.');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      alert('Imagem muito grande (máximo 8 MB).');
      return;
    }
    setCapaBusy(true);
    try {
      // Pré-visualização imediata (funciona mesmo se o Storage falhar).
      const dataUrl = await blobToDataUrl(file);
      setPdfOptions((prev) => ({ ...prev, capaImagemUrl: dataUrl }));
      // Recomendação de proporção/resolução (não bloqueia).
      try {
        const { width, height } = await readImageSize(file);
        if (width < 1000 || width < height) {
          alert('Dica: para a capa, prefira uma imagem em paisagem e com boa resolução (largura ≥ 1000px). A imagem atual pode ficar pixelizada ou ser cortada.');
        }
      } catch {
        /* ignore */
      }
      // Persistência no Storage + na proposta.
      const prevPath = pdfConfigPedido.proposal?.capaImagemPath;
      const path = await uploadPropostaCapa(file, pdfConfigPedido.id);
      const updated: Pedido = { ...pdfConfigPedido, proposal: { ...pdfConfigPedido.proposal, capaImagemPath: path } };
      onSavePedido(updated);
      setPdfConfigPedido(updated);
      if (prevPath && prevPath !== path) {
        try { await removePropostaCapa(prevPath); } catch { /* best-effort */ }
      }
    } catch (e) {
      console.error('Falha ao salvar a imagem da capa:', e);
      alert('A imagem foi aplicada nesta pré-visualização, mas não pôde ser salva no servidor. Ela não ficará guardada para a próxima vez.');
    } finally {
      setCapaBusy(false);
      if (capaInputRef.current) capaInputRef.current.value = '';
    }
  };

  const handleCapaRemove = async () => {
    setPdfOptions((prev) => ({ ...prev, capaImagemUrl: undefined }));
    if (!pdfConfigPedido) return;
    const prevPath = pdfConfigPedido.proposal?.capaImagemPath;
    if (prevPath) {
      const updated: Pedido = { ...pdfConfigPedido, proposal: { ...pdfConfigPedido.proposal } };
      delete (updated.proposal as { capaImagemPath?: string }).capaImagemPath;
      onSavePedido(updated);
      setPdfConfigPedido(updated);
      try { await removePropostaCapa(prevPath); } catch { /* best-effort */ }
    }
  };

  // Data parseável da proposta (para período e agrupamento)
  const pedDate = (p: Pedido): Date | null => {
    const d = new Date(p.createdAt || p.dataEmissao);
    return isNaN(d.getTime()) ? null : d;
  };

  const clientNames = useMemo(
    () => Array.from(new Set(pedidos.map((p) => p.clienteNome).filter(Boolean))).sort(),
    [pedidos]
  );

  // Contagem por status (para os mini-cards do funil) — respeita cliente/período/busca,
  // mas NÃO o filtro de status (para o funil sempre mostrar o todo filtrável).
  const passesBase = (p: Pedido) => {
    if (filterClient && p.clienteNome !== filterClient) return false;
    if (filterFrom || filterTo) {
      const d = pedDate(p);
      if (!d) return false;
      const k = dateKeyOf(d);
      if (filterFrom && k < filterFrom) return false;
      if (filterTo && k > filterTo) return false;
    }
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const hit =
        p.numeroPedido.toLowerCase().includes(q) ||
        p.clienteNome.toLowerCase().includes(q) ||
        p.referencia.toLowerCase().includes(q);
      if (!hit) return false;
    }
    return true;
  };

  const statusCounts = useMemo(() => {
    const base = pedidos.filter(passesBase);
    const counts: Record<string, number> = { TODOS: base.length };
    STATUS_ORDER.forEach((s) => (counts[s] = 0));
    base.forEach((p) => (counts[p.status] = (counts[p.status] || 0) + 1));
    return counts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedidos, filterClient, filterFrom, filterTo, searchTerm]);

  // Propostas filtradas (todas as regras)
  const filteredPedidos = useMemo(
    () => pedidos.filter((p) => passesBase(p) && (filterStatus === 'TODOS' || p.status === filterStatus)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pedidos, filterClient, filterFrom, filterTo, searchTerm, filterStatus]
  );

  const volumeFiltrado = useMemo(
    () => filteredPedidos.reduce((acc, p) => acc + (p.proposal.valorTotal || 0), 0),
    [filteredPedidos]
  );

  // Agrupamento por data (timeline)
  const groupedByDate = useMemo(() => {
    const groups = new Map<string, { label: string; items: Pedido[] }>();
    filteredPedidos.forEach((p) => {
      const d = pedDate(p);
      const key = d ? dateKeyOf(d) : 'sem-data';
      const label = d
        ? d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
        : 'Sem data';
      if (!groups.has(key)) groups.set(key, { label, items: [] });
      groups.get(key)!.items.push(p);
    });
    return Array.from(groups.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filteredPedidos]);

  // Técnico só enxerga as OS onde ele é o responsável
  const baseOS = isTecnico ? pedidosOS.filter((p) => p.technicianName === currentUserName) : pedidosOS;

  const filteredOS = baseOS.filter((p) => {
    const matchesStatus = filterStatus === 'TODOS' || p.status === filterStatus;
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      p.id.toLowerCase().includes(q) ||
      p.clientName.toLowerCase().includes(q) ||
      p.title.toLowerCase().includes(q) ||
      p.technicianName.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  const handleOpenNewProposal = () => {
    setEditingPedido(null);
    setIsProposalModalOpen(true);
  };
  const handleEditProposal = (ped: Pedido) => {
    setEditingPedido(ped);
    setIsProposalModalOpen(true);
  };
  // Revisão: registra a versão atual no histórico, incrementa o número (-R01,
  // -R02…) e reabre a proposta para edição. Ao salvar, entra no histórico.
  const handleRevisar = (ped: Pedido) => {
    const motivo = window.prompt('Motivo da revisão (ex.: ajuste solicitado pelo cliente):', 'Revisão solicitada pelo cliente');
    if (motivo === null) return;
    const hoje = new Date().toLocaleDateString('pt-BR');
    const entradaAtual = {
      numero: ped.numeroPedido,
      data: ped.dataEmissao || hoje,
      elaborador: ped.responsavelComercialNome || '',
      motivo: motivo.trim() || undefined,
      status: ped.status,
    };
    const revisoes = [...(ped.proposal?.revisoes || []), entradaAtual];
    const base = ped.numeroPedido.replace(/-R\d+$/, '');
    const novoNumero = `${base}-R${String(revisoes.length).padStart(2, '0')}`;
    const revisado: Pedido = {
      ...ped,
      numeroPedido: novoNumero,
      dataEmissao: new Date().toISOString().split('T')[0],
      status: 'em_revisao',
      proposal: { ...ped.proposal, revisoes },
    };
    setEditingPedido(revisado);
    setIsProposalModalOpen(true);
  };
  const handleDelete = (ped: Pedido) => {
    if (!onDeletePedido) return;
    if (window.confirm(`Excluir a proposta ${ped.numeroPedido} de ${ped.clienteNome}? Esta ação não pode ser desfeita.`))
      onDeletePedido(ped.id);
  };
  const setDefaultStatus = (st: string) => {
    setFilterStatus(st);
    setShowDefaultMenu(false);
    try {
      localStorage.setItem(DEFAULT_STATUS_KEY, st);
    } catch {
      /* ignore */
    }
  };

  // Nº e ano a partir de "PED-2026-014"
  const numeroAno = (p: Pedido): { num: string; ano: string } => {
    const parts = (p.numeroPedido || '').split('-');
    if (parts.length >= 3) return { num: parts[2], ano: parts[1] };
    const d = pedDate(p);
    return { num: p.numeroPedido || '—', ano: d ? String(d.getFullYear()) : '' };
  };
  const dataCurta = (p: Pedido) => {
    const d = pedDate(p);
    return d ? d.toLocaleDateString('pt-BR') : p.dataEmissao || '—';
  };

  // Relatório imprimível das propostas filtradas
  const gerarRelatorio = () => {
    const filtroDesc = [
      filterClient ? `Cliente: ${filterClient}` : 'Cliente: Todos',
      `Status: ${filterStatus === 'TODOS' ? 'Todos' : STATUS_META[filterStatus as PedidoStatus]?.label || filterStatus}`,
      filterFrom || filterTo ? `Período: ${filterFrom || '...'} a ${filterTo || '...'}` : 'Período: completo',
    ].join(' · ');
    const linhas = filteredPedidos
      .map(
        (p) => `<tr>
          <td style="padding:6px 8px;border:1px solid #ddd;font-family:monospace">${p.numeroPedido}</td>
          <td style="padding:6px 8px;border:1px solid #ddd">${dataCurta(p)}</td>
          <td style="padding:6px 8px;border:1px solid #ddd">${p.clienteNome}</td>
          <td style="padding:6px 8px;border:1px solid #ddd">${p.responsavelComercialNome || ''}</td>
          <td style="padding:6px 8px;border:1px solid #ddd">${STATUS_META[p.status]?.label || p.status}</td>
          <td style="padding:6px 8px;border:1px solid #ddd;text-align:right;font-family:monospace">${brl(p.proposal.valorTotal || 0)}</td>
        </tr>`
      )
      .join('');
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Relatório de Propostas</title></head>
      <body style="font-family:Arial,sans-serif;color:#0f172a;padding:24px">
        <h2 style="margin:0 0 4px">Propostas Comerciais — Fireowl Controls</h2>
        <p style="margin:0 0 2px;font-size:13px">${filtroDesc}</p>
        <p style="margin:0 0 16px;font-size:13px">Propostas: <strong>${filteredPedidos.length}</strong> · Volume: <strong>${brl(volumeFiltrado)}</strong></p>
        <table style="border-collapse:collapse;width:100%;font-size:12px">
          <thead><tr>${['Nº', 'Data', 'Cliente', 'Responsável', 'Status', 'Valor']
            .map((h) => `<th style="padding:6px 8px;border:1px solid #ddd;background:#1A1A72;color:#fff;text-align:left">${h}</th>`)
            .join('')}</tr></thead>
          <tbody>${linhas || `<tr><td colspan="6" style="padding:16px;text-align:center;color:#888">Sem propostas no filtro</td></tr>`}</tbody>
        </table>
      </body></html>`;
    const w = window.open('', '_blank');
    if (!w) {
      alert('Permita pop-ups para gerar o relatório.');
      return;
    }
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  };

  // ---- Linha de proposta (card com borda de status) ----
  const ProposalRow: React.FC<{ ped: Pedido }> = ({ ped }) => {
    const meta = STATUS_META[ped.status];
    const { num, ano } = numeroAno(ped);
    return (
      <div
        className="bg-white rounded-xl shadow-sm border border-slate-100 border-l-4 flex flex-col md:flex-row md:items-center justify-between gap-3 p-4"
        style={{ borderLeftColor: meta.color }}
      >
        {/* Bloco esquerdo */}
        <div className="min-w-0">
          <p className="text-[11px] text-slate-400 font-data-mono">
            nº {num} - {ano}
          </p>
          <p className="text-[11px] text-slate-400">{dataCurta(ped)}</p>
          <p className="font-bold text-slate-900 truncate uppercase">{ped.clienteNome}</p>
          {ped.referencia && <p className="text-[11px] text-slate-400 truncate">{ped.referencia}</p>}
        </div>

        {/* Bloco direito */}
        <div className="flex items-center gap-2 md:gap-3 shrink-0 flex-wrap justify-end">
          <span className="font-data-mono font-bold text-emerald-600 text-base md:text-lg">
            {maskMoney(brl(ped.proposal.valorTotal || 0))}
          </span>

          {/* Status interativo (dropdown com aparência de botão na cor do status) */}
          <select
            value={ped.status}
            onChange={(e) => onUpdatePedidoStatus(ped.id, e.target.value as PedidoStatus)}
            style={{ color: meta.color, borderColor: meta.color }}
            className="text-[11px] font-bold uppercase rounded-lg border-2 bg-white px-2 py-1.5 cursor-pointer focus:outline-none"
            title="Alterar status"
          >
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s} style={{ color: '#0f172a' }}>
                {STATUS_META[s].label}
              </option>
            ))}
          </select>

          {ped.status === 'aceito' && (
            <button
              onClick={() => onGenerateOSFromPedido(ped)}
              title="Gerar Ordem de Serviço"
              className="px-2.5 py-1.5 bg-[#E63946] hover:bg-[#a51515] text-white rounded-lg text-[10px] font-bold uppercase flex items-center gap-1"
            >
              <Wrench className="w-3 h-3" /> Gerar OS
            </button>
          )}

          {/* Ações: gerar documento, editar, excluir */}
          <button
            onClick={() => handleGenerateDocument(ped)}
            title="Gerar documento"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={() => setDocModalPedido(ped)}
            title="Gerar outro documento"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-[#1A1A72] hover:bg-slate-100 transition-colors"
          >
            <Files className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleEditProposal(ped)}
            title="Editar proposta"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-[#1A1A72] hover:bg-slate-100 transition-colors"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleRevisar(ped)}
            title="Revisar proposta (nova revisão no histórico)"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-amber-600 hover:bg-amber-50 transition-colors"
          >
            <History className="w-4 h-4" />
          </button>
          {onDeletePedido && (
            <button
              onClick={() => handleDelete(ped)}
              title="Excluir proposta"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-[#E63946] hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col w-full p-4 md:p-8 gap-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Módulo CRM &bull; Gestão Comercial &amp; Execução
          </span>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-0.5">
            Pedidos, Propostas Comerciais &amp; Ordens de Serviço (OS)
          </h1>
        </div>

        {!isTecnico && (
          <button
            onClick={handleOpenNewProposal}
            className="bg-[#E63946] hover:bg-[#a51515] text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-colors shadow-sm flex items-center gap-1.5 uppercase tracking-wide"
          >
            <Plus className="w-4 h-4" /> Nova Proposta Comercial
          </button>
        )}
      </div>

      {/* Seletor Propostas vs OS — oculto p/ técnico */}
      <div className={`flex items-center gap-3 bg-slate-200 p-1.5 rounded-xl w-fit ${isTecnico ? 'hidden' : ''}`}>
        <button
          onClick={() => {
            setViewTab('propostas');
            // status de OS não existe em propostas → volta para "Todos"
            if (filterStatus !== 'TODOS' && !STATUS_META[filterStatus as PedidoStatus]) setFilterStatus('TODOS');
          }}
          className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${
            viewTab === 'propostas' ? 'bg-[#0B1E38] text-white shadow-md' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <FileText className="w-4 h-4 text-[#F2A900]" /> Propostas Comerciais (CRM) ({pedidos.length})
        </button>
        <button
          onClick={() => {
            setViewTab('ordens_servico');
            setFilterStatus('TODOS');
          }}
          className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${
            viewTab === 'ordens_servico' ? 'bg-[#0B1E38] text-white shadow-md' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Wrench className="w-4 h-4 text-emerald-400" /> Ordens de Serviço (Campo) ({pedidosOS.length})
        </button>
      </div>

      {/* ===================== PROPOSTAS ===================== */}
      {viewTab === 'propostas' && !isTecnico && (
        <>
          {/* Toolbar de filtros e ações */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 flex flex-col lg:flex-row lg:items-center gap-3">
            {/* Filtros (esquerda) */}
            <div className="flex flex-1 flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 text-slate-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Buscar..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-40 pl-8 pr-2 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E63946]/20"
                />
              </div>
              <select
                value={filterClient}
                onChange={(e) => setFilterClient(e.target.value)}
                className="py-2 px-2.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1A1A72]/20 max-w-[10rem]"
                title="Filtrar por cliente"
              >
                <option value="">Todos os clientes</option>
                {clientNames.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="py-2 px-2.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1A1A72]/20"
                title="Filtrar por status"
              >
                <option value="TODOS">Todos os status</option>
                {STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_META[s].label}
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-1 text-xs text-slate-500">
                <input
                  type="date"
                  value={filterFrom}
                  onChange={(e) => setFilterFrom(e.target.value)}
                  className="py-2 px-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1A1A72]/20"
                  title="Período — de"
                />
                <span className="text-slate-300">→</span>
                <input
                  type="date"
                  value={filterTo}
                  onChange={(e) => setFilterTo(e.target.value)}
                  className="py-2 px-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1A1A72]/20"
                  title="Período — até"
                />
              </div>
              {(filterClient || filterFrom || filterTo || searchTerm || filterStatus !== 'TODOS') && (
                <button
                  onClick={() => {
                    setFilterClient('');
                    setFilterFrom('');
                    setFilterTo('');
                    setSearchTerm('');
                    setFilterStatus('TODOS');
                  }}
                  className="text-[11px] font-semibold text-slate-400 hover:text-[#E63946] underline"
                >
                  limpar
                </button>
              )}
            </div>

            {/* Ações e exibição (direita) */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={gerarRelatorio}
                className="flex items-center gap-1.5 border border-slate-200 hover:border-[#1A1A72] text-slate-700 hover:text-[#1A1A72] text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
                title="Gerar relatório das propostas filtradas"
              >
                <Printer className="w-4 h-4" /> Gerar Relatório
              </button>

              {/* Modo de exibição */}
              <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
                <button
                  onClick={() => setDisplayMode('lista')}
                  title="Lista"
                  className={`w-8 h-8 rounded-md flex items-center justify-center transition-colors ${
                    displayMode === 'lista' ? 'bg-white shadow-sm text-[#1A1A72]' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <List className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setDisplayMode('timeline')}
                  title="Timeline (por data)"
                  className={`w-8 h-8 rounded-md flex items-center justify-center transition-colors ${
                    displayMode === 'timeline' ? 'bg-white shadow-sm text-[#1A1A72]' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <CalendarDays className="w-4 h-4" />
                </button>
              </div>

              {/* Status inicial padrão */}
              <div className="relative">
                <button
                  onClick={() => setShowDefaultMenu((v) => !v)}
                  title="Status inicial padrão"
                  className="w-9 h-9 rounded-lg flex items-center justify-center border border-slate-200 text-slate-500 hover:text-[#1A1A72] hover:border-[#1A1A72] transition-colors"
                >
                  <Settings className="w-4 h-4" />
                </button>
                {showDefaultMenu && (
                  <div className="absolute right-0 mt-1 w-52 bg-white border border-slate-200 rounded-lg shadow-lg z-20 p-1.5">
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 px-2 py-1">Status inicial padrão</p>
                    {['TODOS', ...STATUS_ORDER].map((s) => (
                      <button
                        key={s}
                        onClick={() => setDefaultStatus(s)}
                        className={`w-full text-left px-2 py-1.5 rounded-md text-xs font-semibold hover:bg-slate-100 ${
                          filterStatus === s ? 'text-[#1A1A72]' : 'text-slate-600'
                        }`}
                      >
                        {s === 'TODOS' ? 'Todos os status' : STATUS_META[s as PedidoStatus].label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Pipeline — mini-cards interativos */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            <PipelineCard
              label="Todos"
              count={statusCounts.TODOS || 0}
              color="#1A1A72"
              active={filterStatus === 'TODOS'}
              onClick={() => setFilterStatus('TODOS')}
            />
            {PIPELINE.map((s) => (
              <PipelineCard
                key={s}
                label={STATUS_META[s].label}
                count={statusCounts[s] || 0}
                color={STATUS_META[s].color}
                active={filterStatus === s}
                onClick={() => setFilterStatus(filterStatus === s ? 'TODOS' : s)}
              />
            ))}
            <div className="ml-auto shrink-0 flex flex-col justify-center px-4 py-2 rounded-xl bg-white border border-slate-200 shadow-sm">
              <p className="text-[10px] font-semibold text-slate-500 uppercase">Volume filtrado</p>
              <p className="font-data-mono text-lg font-bold text-emerald-600">{maskMoney(brl(volumeFiltrado))}</p>
            </div>
          </div>

          {/* Lista / Timeline */}
          {filteredPedidos.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm py-16 text-center text-slate-400">
              <FileText className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="mt-2 text-sm font-bold text-slate-500 uppercase tracking-wider">Nenhuma proposta encontrada</p>
            </div>
          ) : displayMode === 'lista' ? (
            <div className="flex flex-col gap-3">
              {filteredPedidos.map((ped) => (
                <ProposalRow key={ped.id} ped={ped} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {groupedByDate.map(([key, group]) => (
                <div key={key} className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 capitalize">
                      {group.label}
                    </span>
                    <span className="text-[11px] text-slate-300">· {group.items.length}</span>
                    <div className="flex-1 h-px bg-slate-100" />
                  </div>
                  {group.items.map((ped) => (
                    <ProposalRow key={ped.id} ped={ped} />
                  ))}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ===================== ORDENS DE SERVIÇO ===================== */}
      {viewTab === 'ordens_servico' && (
        <>
          {/* Métricas de OS */}
          <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${isTecnico ? 'md:grid-cols-3' : 'md:grid-cols-4'}`}>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <p className="text-[11px] font-semibold text-slate-500 uppercase">
                {isTecnico ? 'Minhas Ordens de Serviço' : 'Ordens de Serviço'}
              </p>
              <p className="font-data-mono text-2xl font-bold text-slate-900 mt-1">{baseOS.length}</p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <p className="text-[11px] font-semibold text-slate-500 uppercase">Em Andamento</p>
              <p className="font-data-mono text-2xl font-bold text-amber-600 mt-1">
                {baseOS.filter((p) => p.status === 'EM ANDAMENTO').length}
              </p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <p className="text-[11px] font-semibold text-slate-500 uppercase">Concluídas</p>
              <p className="font-data-mono text-2xl font-bold text-emerald-600 mt-1">
                {baseOS.filter((p) => p.status === 'CONCLUIDA').length}
              </p>
            </div>
            {!isTecnico && (
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <p className="text-[11px] font-semibold text-slate-500 uppercase">Faturamento de OS</p>
                <p className="font-data-mono text-2xl font-bold text-[#E63946] mt-1">
                  {maskMoney(`R$ ${pedidosOS.reduce((acc, p) => acc + p.value, 0).toLocaleString('pt-BR')}`)}
                </p>
              </div>
            )}
          </div>

          {/* Busca + status */}
          <div className="flex flex-col sm:flex-row gap-3 justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-2.5 text-slate-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Buscar por OS, cliente, título, técnico..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E63946]/20"
              />
            </div>
            <div className="flex gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
              {['TODOS', 'ABERTA', 'EM ANDAMENTO', 'CONCLUIDA', 'ATRASADA'].map((st) => (
                <button
                  key={st}
                  onClick={() => setFilterStatus(st)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                    filterStatus === st ? 'bg-slate-900 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {filteredOS.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm py-16 text-center text-slate-400">
              <Wrench className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="mt-2 text-sm font-bold text-slate-500 uppercase tracking-wider">Nenhuma ordem de serviço encontrada</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {filteredOS.map((p) => (
                <DataListRow
                  key={p.id}
                  leading={
                    <span className="w-10 h-10 rounded-lg bg-[#1A1A72]/10 text-[#1A1A72] flex items-center justify-center shrink-0">
                      <Wrench className="w-5 h-5" />
                    </span>
                  }
                  title={<span className="uppercase">{p.clientName}</span>}
                  meta={
                    <>
                      <RowMeta label="OS" value={<span className="font-data-mono">{p.id}</span>} />
                      <RowMeta label="Pedido" value={<span className="font-data-mono">{p.pedidoId}</span>} />
                      <span className="text-slate-500">{p.title}</span>
                      <Badge color="slate">{p.type}</Badge>
                    </>
                  }
                  center={
                    <div className="text-left md:text-center">
                      <p className="text-slate-700 font-semibold">{p.technicianName}</p>
                      <p className="text-[10px] text-slate-400 font-data-mono">{p.scheduledDate}</p>
                    </div>
                  }
                  right={
                    <>
                      {!isTecnico && (
                        <span className="font-data-mono font-bold text-slate-900 text-base md:text-lg text-right">
                          {maskMoney(`R$ ${p.value.toLocaleString('pt-BR')}`)}
                        </span>
                      )}
                      <Badge color={p.priority === 'CRITICA' ? 'red' : p.priority === 'ALTA' ? 'amber' : 'slate'} outline>
                        {p.priority}
                      </Badge>
                      <Badge
                        color={
                          p.status === 'CONCLUIDA'
                            ? 'emerald'
                            : p.status === 'EM ANDAMENTO'
                            ? 'blue'
                            : p.status === 'ATRASADA'
                            ? 'red'
                            : 'slate'
                        }
                      >
                        {p.status}
                      </Badge>
                    </>
                  }
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Commercial Proposal Form Modal */}
      {/*
        key força o modal a remontar a cada abertura (e ao trocar de proposta),
        para que os campos sejam recarregados de initialPedido. Sem isso, o
        useState inicializa só na 1ª montagem e a edição mostra dados velhos —
        salvando por cima e "perdendo" objetivo, premissas, etc.
      */}
      <CommercialProposalModal
        key={`${isProposalModalOpen ? 'open' : 'closed'}:${editingPedido?.id ?? 'new'}`}
        isOpen={isProposalModalOpen}
        onClose={() => setIsProposalModalOpen(false)}
        onSave={onSavePedido}
        initialPedido={editingPedido}
        clients={clients}
        inventory={inventory}
        partnerBrands={partnerBrands}
        templates={templates}
        services={services}
        onAddClient={onAddClient}
        onPreviewPDF={(ped) => setPdfPreviewPedido(ped)}
      />

      {/* Modal "Qual documento gerar?" (quando não há padrão, ou via "Gerar outro documento") */}
      <DocumentTypeModal
        isOpen={!!docModalPedido}
        onClose={() => setDocModalPedido(null)}
        atual={docModalPedido ? resolveDocumentoPadrao(docModalPedido, documentosPadrao) ?? undefined : undefined}
        onSelect={(doc) => {
          const ped = docModalPedido;
          setDocModalPedido(null);
          if (ped) dispatchDocument(ped, doc);
        }}
      />

      {/* Visualizador do Orçamento */}
      {orcamentoPedido && (
        <OrcamentoPDFView
          pedido={orcamentoPedido}
          companyProfile={companyProfile}
          options={{ showLogo: pdfPrefs.showLogo, detailedSubtotal: pdfPrefs.detailedSubtotal }}
          onClose={() => setOrcamentoPedido(null)}
        />
      )}

      {/* Config antes de gerar o PDF */}
      {pdfConfigPedido && (
        <div className="fixed inset-0 z-[55] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-xl border border-slate-200 shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#1A1A72]" />
                <h3 className="font-display text-base font-bold text-[#1A1A72] uppercase tracking-wide">Opções do PDF</h3>
              </div>
              <button onClick={() => setPdfConfigPedido(null)} className="text-slate-400 hover:text-slate-700 font-bold text-xl">
                ✕
              </button>
            </div>
            <div className="px-6 py-5 space-y-3 text-xs">
              <p className="text-slate-500">
                Proposta <span className="font-data-mono font-bold text-slate-700">{pdfConfigPedido.numeroPedido}</span> — ajuste o que incluir no documento.
              </p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Elementos do documento</p>
              {[
                { key: 'showLogo', label: 'Logotipo no cabeçalho' },
                { key: 'showCarta', label: 'Carta de apresentação' },
                { key: 'showIndice', label: 'Índice' },
                { key: 'showHistorico', label: 'Histórico de propostas' },
                { key: 'showAreasAtuacao', label: 'Página "Áreas de Atuação"' },
                { key: 'showFechamento', label: 'Página de fechamento (contatos)' },
                { key: 'detailedSubtotal', label: 'Detalhar itens e subtotais' },
                { key: 'showBankData', label: 'Dados para pagamento' },
              ].map((opt) => (
                <div key={opt.key} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5">
                  <span className="font-semibold text-slate-700">{opt.label}</span>
                  <Toggle checked={(pdfOptions as any)[opt.key]} onChange={(v) => setPdfOptions((prev) => ({ ...prev, [opt.key]: v }))} />
                </div>
              ))}

              {/* Imagem da capa (opcional) */}
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 pt-2">Imagem da capa (opcional)</p>
              <input
                ref={capaInputRef}
                type="file"
                accept="image/jpeg,image/png"
                className="hidden"
                onChange={(e) => handleCapaFile(e.target.files?.[0])}
              />
              {pdfOptions.capaImagemUrl ? (
                <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={pdfOptions.capaImagemUrl}
                    alt="Pré-visualização da capa"
                    className="w-24 h-16 object-cover rounded-md border border-slate-300 bg-white shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold text-slate-700">Imagem aplicada à capa</p>
                    <p className="text-[10px] text-slate-400">Aparece no topo da capa; sem imagem, usa o grafismo.</p>
                    <div className="flex gap-2 mt-1.5">
                      <button
                        type="button"
                        onClick={() => capaInputRef.current?.click()}
                        disabled={capaBusy}
                        className="text-[10px] font-bold uppercase tracking-wider text-[#1A1A72] hover:underline disabled:opacity-50"
                      >
                        {capaBusy ? 'Enviando…' : 'Trocar'}
                      </button>
                      <button
                        type="button"
                        onClick={handleCapaRemove}
                        disabled={capaBusy}
                        className="text-[10px] font-bold uppercase tracking-wider text-red-600 hover:underline disabled:opacity-50"
                      >
                        Remover
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => capaInputRef.current?.click()}
                  disabled={capaBusy}
                  className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-slate-300 hover:border-[#1A1A72] hover:bg-slate-50 rounded-lg py-3 text-[11px] font-semibold text-slate-500 hover:text-[#1A1A72] transition-colors disabled:opacity-60"
                >
                  <Plus className="w-4 h-4" /> {capaBusy ? 'Enviando…' : 'Adicionar imagem (JPG/PNG)'}
                </button>
              )}

              <p className="text-[10px] text-slate-400 pt-1">
                As cláusulas jurídicas (multas, responsabilidade, sigilo, condições gerais, termo de aceite) são
                ligadas/desligadas na própria proposta, em <strong>&ldquo;Cláusulas Jurídicas&rdquo;</strong>.
              </p>
            </div>
            <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => setPdfConfigPedido(null)}
                className="px-4 py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  const ped = pdfConfigPedido;
                  setPdfConfigPedido(null);
                  setPdfPreviewPedido(ped);
                }}
                className="bg-[#E63946] hover:bg-[#a51515] text-white px-5 py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors shadow-sm flex items-center gap-1.5"
              >
                <Eye className="w-4 h-4" /> Gerar PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PDF View Overlay */}
      {pdfPreviewPedido && (
        <CommercialProposalPDFView
          pedido={pdfPreviewPedido}
          companyProfile={companyProfile}
          options={pdfOptions}
          onClose={() => setPdfPreviewPedido(null)}
          onSendEmail={(ped) => {
            alert(`Proposta comercial ${ped.numeroPedido} enviada com sucesso para o e-mail do cliente!`);
          }}
        />
      )}
    </div>
  );
};

// Mini-card do funil (clicável)
const PipelineCard: React.FC<{
  label: string;
  count: number;
  color: string;
  active: boolean;
  onClick: () => void;
}> = ({ label, count, color, active, onClick }) => (
  <button
    onClick={onClick}
    className={`shrink-0 min-w-[7rem] text-left px-3 py-2 rounded-xl border bg-white shadow-sm cursor-pointer transition-all hover:shadow-md active:scale-[0.97] ${
      active ? 'border-current ring-2' : 'border-slate-200'
    }`}
    style={active ? { color, boxShadow: `0 0 0 2px ${color}22` } : undefined}
  >
    <p className="font-data-mono text-2xl font-bold leading-none" style={{ color }}>
      {count}
    </p>
    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mt-1 truncate">{label}</p>
  </button>
);
