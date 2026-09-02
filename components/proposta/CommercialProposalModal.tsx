'use client';
import { showToast, requestConfirm, requestText } from '@/components/ui/Feedback';

import React, { useState } from 'react';
import {
  Pedido,
  Client,
  InventoryItem,
  PartnerBrand,
  PedidoTemplate,
  PedidoEquipmentItem,
  PedidoBrand,
  PedidoStatus,
  ServiceCatalogItem,
  PedidoTipo,
  EmpresaAtendida,
  MarcaTecnologia,
  CommercialProposalData,
} from '@/lib/types';
import { PEDIDO_TIPO_LABELS, PEDIDO_TIPO_ORDER } from '@/lib/documentos';
import { AREAS_PROPOSTA, TIPOS_SERVICO, gerarTituloProposta, conclusaoPorTipo, presetPorTipo } from '@/lib/propostaTitulo';
import { montarEstruturaProposta, ordenarEstrutura, SECOES_FIXAS_INICIO, SECOES_FIXAS_FIM } from '@/lib/propostaEstrutura';
import { CARTA_APRESENTACAO } from '@/lib/propostaTextos';
import { SECOES_TEXTO, servicosOfertadosPadrao, restaurarSecaoLista, fonteDaSecaoLista, fonteServicos } from '@/lib/propostaMaterializacao';
import { normalizeUnitCode } from '@/lib/commercialUnits';
import { calculateCommercialProposalTotals } from '@/lib/commercialTotals';
import { CommercialWarranty, StructuredWarranty, WarrantyLeg, WarrantyMode, defaultWarranty, normalizeCommercialWarranty, isLegacyWarranty, isStructuredWarranty, renderWarranty, legText } from '@/lib/commercialWarranty';
import { COMMERCIAL_SCHEMA_VERSION } from '@/lib/commercialProposal';
import { ItensCardEditor } from '@/components/proposta/ItensCardEditor';
import {
  X,
  Plus,
  Trash2,
  FileText,
  Eye,
  Save,
  CheckCircle,
  Copy,
  Building2,
  Wrench,
  ShieldCheck,
  DollarSign,
  Sparkles,
  ChevronDown,
  UserPlus,
  Check,
  Scale,
  CreditCard,
} from 'lucide-react';

interface CommercialProposalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (pedido: Pedido) => void;
  initialPedido?: Pedido | null;
  clients: Client[];
  inventory: InventoryItem[];
  partnerBrands: PartnerBrand[];
  templates: PedidoTemplate[];
  services?: ServiceCatalogItem[];
  empresasAtendidas?: EmpresaAtendida[];
  marcasTecnologias?: MarcaTecnologia[];
  onSaveTemplate?: (template: PedidoTemplate) => void;
  onDeleteTemplate?: (templateId: string) => void;
  onAddClient?: (client: Client) => void;
  onPreviewPDF: (pedido: Pedido) => void;
  /** Próximo número sequencial para novas propostas (default do campo). */
  nextProposalNumber?: number;
}

const inputCls =
  'w-full border border-slate-300 rounded-lg p-2.5 text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-[#0B1E38]/20 focus:border-[#0B1E38]/40';
const labelCls = 'block text-slate-600 font-bold uppercase text-[11px] mb-1';

/* ------------------------- componentes de módulo ------------------------- */

// Sanfona: cabeçalho clicável + corpo colapsável. Definida no módulo para os
// inputs internos não perderem o foco a cada render.
/** Marcador discreto Padrão Fireowl × Personalizado por seção (ETAPA 2). */
const FonteBadge: React.FC<{ fonte: 'padrao' | 'personalizado' }> = ({ fonte }) => (
  <span
    className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full shrink-0 ${
      fonte === 'personalizado'
        ? 'bg-amber-50 text-amber-700 border border-amber-200'
        : 'bg-slate-100 text-slate-500 border border-slate-200'
    }`}
  >
    {fonte === 'personalizado' ? 'Personalizado' : 'Padrão Fireowl'}
  </span>
);

const Accordion: React.FC<{
  title: string;
  icon?: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  badge?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, icon, open, onToggle, badge, children }) => (
  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center gap-2.5 px-4 py-3.5 text-left hover:bg-slate-50 transition-colors"
    >
      {icon}
      <span className="flex-1 font-bold text-[#0B1E38] uppercase text-sm">{title}</span>
      {badge}
      <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${open ? '' : '-rotate-90'}`} />
    </button>
    {open && <div className="px-4 pb-4 pt-1 border-t border-slate-100">{children}</div>}
  </div>
);

// Editor de lista de strings (diretrizes, entregáveis, premissas, resp.).
const ListEditor: React.FC<{
  items: string[];
  onAdd: () => void;
  onUpdate: (i: number, v: string) => void;
  onRemove: (i: number) => void;
  addLabel: string;
  numbered?: boolean;
}> = ({ items, onAdd, onUpdate, onRemove, addLabel, numbered }) => (
  <div className="space-y-2">
    {items.length === 0 && <p className="text-[11px] text-slate-400 italic">Nenhum item adicionado.</p>}
    {items.map((it, idx) => (
      <div key={idx} className="flex items-center gap-2">
        {numbered && <span className="font-bold text-slate-400 font-data-mono text-xs w-5 shrink-0">{idx + 1}.</span>}
        <input type="text" value={it} onChange={(e) => onUpdate(idx, e.target.value)} className={`flex-1 ${inputCls}`} />
        <button
          type="button"
          onClick={() => onRemove(idx)}
          className="p-1.5 text-slate-400 hover:text-[#E63946] hover:bg-red-50 rounded-lg transition-colors shrink-0"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    ))}
    <button
      type="button"
      onClick={onAdd}
      className="w-full py-2 rounded-lg border border-dashed border-[#0B1E38]/40 text-[11px] font-semibold text-[#0B1E38] hover:bg-[#0B1E38]/5 transition-colors flex items-center justify-center gap-1 uppercase"
    >
      <Plus className="w-3.5 h-3.5" /> {addLabel}
    </button>
  </div>
);

// Linha das "Informações Básicas": vazia mostra "+", preenchida mostra lixeira.
const BasicInfoRow: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
}> = ({ label, value, onChange, placeholder, multiline }) => {
  const [adding, setAdding] = useState(false);
  const filled = (value || '').trim() !== '';

  if (!filled && !adding) {
    return (
      <button
        type="button"
        onClick={() => setAdding(true)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border border-dashed border-slate-300 text-slate-500 hover:border-[#0B1E38] hover:text-[#0B1E38] transition-colors"
      >
        <span className="text-[11px] font-bold uppercase">{label}</span>
        <Plus className="w-4 h-4" />
      </button>
    );
  }

  return (
    <div className="flex items-start gap-2">
      <div className="flex-1">
        <label className={labelCls}>{label}</label>
        {multiline ? (
          <textarea autoFocus={adding} rows={2} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={inputCls} />
        ) : (
          <input autoFocus={adding} type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={inputCls} />
        )}
      </div>
      <button
        type="button"
        onClick={() => {
          onChange('');
          setAdding(false);
        }}
        title="Limpar / remover este campo"
        className="mt-6 p-2 text-slate-400 hover:text-[#E63946] hover:bg-red-50 rounded-lg transition-colors shrink-0"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
};

// Opções pré-formatadas de pagamento (tags clicáveis).
const FORMAS_PAGAMENTO = ['Pix', 'Boleto Bancário', 'Transferência (TED/DOC)', 'Cartão de Crédito'];
const CONDICOES_PAGAMENTO = [
  '30% no aceite / 70% na entrega e laudo',
  'À vista',
  'Faturado 30 dias',
  'Parcelado em até 3x',
  'Parcelado em até 5x (com juros)',
];

// Multiseleção por tags: clicar liga/desliga a opção.
const TagSelect: React.FC<{ options: string[]; selected: string[]; onToggle: (v: string) => void }> = ({
  options,
  selected,
  onToggle,
}) => (
  <div className="flex flex-wrap gap-2">
    {options.map((o) => {
      const on = selected.includes(o);
      return (
        <button
          key={o}
          type="button"
          onClick={() => onToggle(o)}
          className={`px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-colors flex items-center gap-1 ${
            on ? 'bg-[#0B1E38] text-white border-[#0B1E38]' : 'bg-white text-slate-600 border-slate-300 hover:border-[#0B1E38]'
          }`}
        >
          {on && <Check className="w-3 h-3" />}
          {o}
        </button>
      );
    })}
  </div>
);

// Chave de ativação de um bloco jurídico (checkbox).
const ClauseRow: React.FC<{ label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }> = ({
  label,
  hint,
  checked,
  onChange,
}) => (
  <button
    type="button"
    onClick={() => onChange(!checked)}
    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-left transition-colors"
  >
    <span
      className={`w-5 h-5 rounded flex items-center justify-center shrink-0 border-2 ${
        checked ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300 text-transparent'
      }`}
    >
      <Check className="w-3.5 h-3.5" />
    </span>
    <span className="flex-1">
      <span className="text-xs font-semibold text-slate-800 block">{label}</span>
      {hint && <span className="text-[10px] text-slate-400">{hint}</span>}
    </span>
    <span className={`text-[10px] font-bold uppercase ${checked ? 'text-emerald-600' : 'text-slate-400'}`}>
      {checked ? 'Incluído' : 'Omitido'}
    </span>
  </button>
);

export const CommercialProposalModal: React.FC<CommercialProposalModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialPedido,
  clients,
  inventory,
  partnerBrands,
  templates,
  services = [],
  empresasAtendidas = [],
  marcasTecnologias = [],
  onAddClient,
  onSaveTemplate,
  onDeleteTemplate,
  onPreviewPDF,
  nextProposalNumber = 249,
}) => {
  // ETAPA 2 — materialização de textos. Uma proposta é NOVA quando não traz um
  // registro `proposal` anterior; nesse caso os textos-padrão são copiados para
  // os campos editáveis (visíveis antes do PDF). Propostas históricas mostram o
  // texto padrão para leitura, mas só o gravam após ação do usuário (textosTouched).
  const initialProposal = initialPedido?.proposal;
  const ehNovaProposta = !initialProposal;
  const jaMaterializada = !!initialProposal?.textosMaterializados;

  // Sanfonas abertas (por padrão as principais abertas).
  const [open, setOpen] = useState<Record<string, boolean>>({
    materiais: true,
    servicos: true,
    garantia: true,
    basicas: true,
  });
  const toggle = (k: string) => setOpen((o) => ({ ...o, [k]: !o[k] }));

  // ----------------- estado do formulário -----------------
  const [numeroPedido, setNumeroPedido] = useState<string>(
    initialPedido?.numeroPedido || `PED-${new Date().getFullYear()}-${nextProposalNumber}`
  );
  const [referencia, setReferencia] = useState<string>(initialPedido?.referencia || 'Manutenção Preventiva SDAI');
  // P1 — Área principal (multi) + Tipo de serviço → título dinâmico.
  const [areaPrincipal, setAreaPrincipal] = useState<string[]>(initialPedido?.proposal?.areaPrincipal || []);
  const [tipoServico, setTipoServico] = useState<string>(initialPedido?.proposal?.tipoServico || '');
  const [nivelProposta, setNivelProposta] = useState<'simples' | 'tecnica' | 'corporativa'>(initialPedido?.proposal?.nivelProposta || 'tecnica');
  const [ordemSecoes, setOrdemSecoes] = useState<string[]>(initialPedido?.proposal?.ordemSecoes || []);
  // Página "Experiência e Capacidade Técnica": undefined = automático (por nível).
  const [incluirExperiencia, setIncluirExperiencia] = useState<boolean | undefined>(initialPedido?.proposal?.incluirExperiencia);
  // §14 — seleção automática (default) x manual das empresas/marcas.
  const [experienciaAuto, setExperienciaAuto] = useState<boolean>(initialPedido?.proposal?.experienciaAuto !== false);
  const [experienciaEmpresasIds, setExperienciaEmpresasIds] = useState<string[]>(initialPedido?.proposal?.experienciaEmpresasIds || []);
  const [experienciaMarcasIds, setExperienciaMarcasIds] = useState<string[]>(initialPedido?.proposal?.experienciaMarcasIds || []);
  const toggleSelId = (arr: string[], set: (v: string[]) => void, id: string) => set(arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);
  const toggleArea = (id: string) => setAreaPrincipal((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const tituloDinamico = gerarTituloProposta(areaPrincipal, tipoServico);
  const [pedidoTipo, setPedidoTipo] = useState<PedidoTipo | ''>(initialPedido?.proposal?.pedidoTipo || '');
  const [clienteId, setClienteId] = useState<string>(initialPedido?.clienteId || clients[0]?.id || '');
  const [fornecedor, setFornecedor] = useState<string>(initialPedido?.fornecedor || 'Fireowl Controls Ltda.');
  const [dataEmissao, setDataEmissao] = useState<string>(
    initialPedido?.dataEmissao || new Date().toISOString().split('T')[0]
  );
  const [responsavelNome, setResponsavelNome] = useState<string>(
    initialPedido?.responsavelComercialNome || 'Isaac Lopes'
  );
  const [status, setStatus] = useState<PedidoStatus>(initialPedido?.status || 'rascunho');
  const [motivoRecusa, setMotivoRecusa] = useState<string>(initialPedido?.proposal?.motivoRecusa || '');

  const [objetivo, setObjetivo] = useState<string>(
    initialPedido?.proposal?.objetivo ||
      'Prestação de serviços técnicos especializados de engenharia para fornecimento, manutenção e testes de sistemas de segurança e alarme de incêndio (SDAI).'
  );
  // Carta: proposta NOVA materializa o texto institucional padrão (fica visível
  // no editor); histórica/já-materializada usa o que estiver gravado.
  const [cartaApresentacao, setCartaApresentacao] = useState<string>(
    initialProposal?.cartaApresentacao !== undefined
      ? initialProposal.cartaApresentacao
      : ehNovaProposta
        ? CARTA_APRESENTACAO.join('\n')
        : ''
  );

  const [diretrizes, setDiretrizes] = useState<string[]>(
    initialPedido?.proposal?.diretrizesNormativas || [
      'ABNT NBR 17240:2010 — Sistemas de detecção e alarme de incêndio',
      'NPT 019 — Sistema de Detecção e Alarme de Incêndio (Corpo de Bombeiros Militar do Paraná)',
      'ABNT NBR 5410:2004 — Instalações elétricas de baixa tensão',
    ]
  );
  const [escopoServico, setEscopoServico] = useState<string>(
    initialPedido?.proposal?.escopoServico ||
      'Inspeção física, ensaios funcionais e manutenção preventiva nos laços de detecção, verificação de centrais e comissionamento com emissão de laudo e ART.'
  );
  const [entregaveis, setEntregaveis] = useState<string[]>(
    initialPedido?.proposal?.entregaveis || [
      'Relatório Diário de Obra (RDO) e Checklist de Testes Normativos',
      'Anotação de Responsabilidade Técnica (ART CREA-PR) registrada',
      'Manual As-Built e cadastro de pontos atualizado',
    ]
  );
  const [equipmentItems, setEquipmentItems] = useState<PedidoEquipmentItem[]>(
    initialPedido?.proposal?.equipmentItems || []
  );
  const [marcas] = useState<PedidoBrand[]>(initialPedido?.proposal?.marcas || []);
  const [premissas, setPremissas] = useState<string[]>(
    initialPedido?.proposal?.premissas || [
      'Acesso livre e desembaraçado às áreas de intervenção técnica',
      'Acompanhamento do responsável de segurança do cliente durante os testes sonoros',
    ]
  );
  // §16 — Incluso / Não incluso (blocos opcionais; só aparecem no PDF se houver itens).
  const [incluso, setIncluso] = useState<string[]>(initialPedido?.proposal?.incluso || []);
  const [naoIncluso, setNaoIncluso] = useState<string[]>(initialPedido?.proposal?.naoIncluso || []);

  // §17/§18/§28 — indicadores do resumo executivo + SLA (todos opcionais).
  const [unidadesAtendidas, setUnidadesAtendidas] = useState<number>(initialPedido?.proposal?.unidadesAtendidas ?? 0);
  const [frequenciaManutencao, setFrequenciaManutencao] = useState<string>(initialPedido?.proposal?.frequenciaManutencao ?? '');
  const [slaCritico, setSlaCritico] = useState<string>(initialPedido?.proposal?.slaCritico ?? '');
  const [slaTabela, setSlaTabela] = useState<{ situacao: string; prazo: string }[]>(initialPedido?.proposal?.slaTabela ?? []);
  const addSla = () => setSlaTabela((prev) => [...prev, { situacao: '', prazo: '' }]);
  const updSla = (i: number, k: 'situacao' | 'prazo', v: string) => setSlaTabela((prev) => prev.map((r, idx) => (idx === i ? { ...r, [k]: v } : r)));
  const rmSla = (i: number) => setSlaTabela((prev) => prev.filter((_, idx) => idx !== i));
  const [respContratada, setRespContratada] = useState<string[]>(
    initialPedido?.proposal?.responsabilidadesContratada || [
      'Fornecer equipe qualificada, EPIs, ferramentas calibradas e emitir laudo ART',
    ]
  );
  const [respContratante, setRespContratante] = useState<string[]>(
    initialPedido?.proposal?.responsabilidadesContratante || [
      'Liberar acessos e autorizações de trabalho no ambiente',
      'Garantir ponto de energia elétrica 220V e sinal telefônico/dados',
    ]
  );
  const [prazoExecucao, setPrazoExecucao] = useState<string>(
    initialPedido?.proposal?.prazoExecucao || '10 dias úteis após autorização formal de início'
  );
  // ETAPA COMERCIAL — Garantia estruturada (mão de obra × materiais). Fonte única
  // do default (90 dias / 12 meses) em [[lib/commercialWarranty]]. Propostas antigas
  // (garantia string) entram em modo legado, preservando o texto histórico.
  const [warranty, setWarranty] = useState<CommercialWarranty>(() => {
    if (!initialProposal) return defaultWarranty();
    const w = initialProposal.warranty
      ? normalizeCommercialWarranty(initialProposal.warranty)
      : normalizeCommercialWarranty(initialProposal.garantia);
    // Proposta sem garantia efetiva (ex.: vinda de levantamento) recebe o default sugerido.
    if (isLegacyWarranty(w) && !w.text.trim()) return defaultWarranty();
    return w;
  });
  const updWarrantyLeg = (leg: 'maoDeObra' | 'materiais', patch: Partial<WarrantyLeg>) =>
    setWarranty((w) => {
      const base = isStructuredWarranty(w) ? w : defaultWarranty();
      return { ...base, [leg]: { ...base[leg], ...patch } };
    });
  const setWarrantyObs = (v: string) =>
    setWarranty((w) => ({ ...(isStructuredWarranty(w) ? w : defaultWarranty()), observacoes: v || undefined }));
  // Texto plano da garantia — compat. com o campo legado `garantia: string`
  // (leitura por versões antigas / modelos / snapshot de revisão).
  const garantiaTexto = (() => {
    const r = renderWarranty(warranty);
    if (isLegacyWarranty(warranty)) return r.legacyText || '';
    const parts: string[] = [];
    if (r.maoDeObra) parts.push(`Mão de obra: ${r.maoDeObra}`);
    if (r.materiais) parts.push(`Materiais/equipamentos: ${r.materiais}`);
    if (r.observacoes) parts.push(r.observacoes);
    return parts.join('. ');
  })();
  const WARRANTY_MODES: { id: WarrantyMode; label: string }[] = [
    { id: 'dias', label: 'Dias' },
    { id: 'meses', label: 'Meses' },
    { id: 'fabricante', label: 'Do fabricante' },
    { id: 'personalizado', label: 'Personalizado' },
  ];
  // Bloco de edição de uma "perna" da garantia (mão de obra ou materiais).
  const warrantyLegBlock = (title: string, key: 'maoDeObra' | 'materiais') => {
    const leg: WarrantyLeg = isStructuredWarranty(warranty) ? warranty[key] : defaultWarranty()[key];
    const preview = legText(leg);
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input type="checkbox" checked={leg.enabled} onChange={(e) => updWarrantyLeg(key, { enabled: e.target.checked })} className="w-4 h-4 accent-emerald-600" />
          <span className="text-sm font-bold text-slate-800">{title}</span>
        </label>
        {leg.enabled && (
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <select value={leg.mode} onChange={(e) => updWarrantyLeg(key, { mode: e.target.value as WarrantyMode })} className={`${inputCls} w-40`}>
              {WARRANTY_MODES.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
            {(leg.mode === 'dias' || leg.mode === 'meses') && (
              <input type="number" min={1} value={leg.value ?? ''} onChange={(e) => updWarrantyLeg(key, { value: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} placeholder="prazo" className={`${inputCls} w-24 font-data-mono text-center`} />
            )}
            {leg.mode === 'personalizado' && (
              <input type="text" value={leg.textoPersonalizado ?? ''} onChange={(e) => updWarrantyLeg(key, { textoPersonalizado: e.target.value })} placeholder="Texto da garantia…" className={`${inputCls} flex-1 min-w-[180px]`} />
            )}
          </div>
        )}
        <p className="text-[10px] text-slate-400 mt-1.5">{leg.enabled ? (preview ? `No PDF: “${preview}”` : 'Selecione um prazo ou texto — perna ativa sem condição não aparece.') : 'Sem garantia informada — não aparece no PDF.'}</p>
      </div>
    );
  };
  const [validadeDias, setValidadeDias] = useState<number>(initialPedido?.proposal?.validadePropostaDias || 15);
  const [validadeComplemento, setValidadeComplemento] = useState<string>(
    initialPedido?.proposal?.validadePropostaComplemento || 'dias corridos a partir da emissão'
  );
  const [conclusao, setConclusao] = useState<string>(
    initialPedido?.proposal?.conclusao ||
      'Permanecemos à disposição para eventuais esclarecimentos adicionais e renovamos nossos votos de estima.'
  );
  const [faturamento, setFaturamento] = useState<string>(initialPedido?.proposal?.faturamento || '');
  const [impostos, setImpostos] = useState<string>(initialPedido?.proposal?.impostos || 'Inclusos, Simples Nacional (Anexo III)');

  // ETAPA 2 — seções antes injetadas só no PDF (embalagem, segurança, preços/
  // impostos obs, multas, limitação, confidencialidade, termo de aceite,
  // condições gerais) + Descrição dos Serviços. Ficam VISÍVEIS aqui; o registro
  // guarda o snapshot. Ver [[lib/propostaMaterializacao.ts]].
  const [textosTouched, setTextosTouched] = useState(false);
  const [secoesTexto, setSecoesTexto] = useState<Record<string, string[]>>(() => {
    const o: Record<string, string[]> = {};
    for (const s of SECOES_TEXTO) {
      const stored = (initialProposal as Record<string, unknown> | undefined)?.[s.campo] as string[] | undefined;
      o[s.campo] = stored !== undefined ? stored : s.padrao();
    }
    return o;
  });
  const [servicosOfertados, setServicosOfertados] = useState<{ titulo: string; itens: string[] }[]>(() =>
    initialProposal?.servicosOfertados !== undefined ? initialProposal.servicosOfertados : servicosOfertadosPadrao()
  );
  const [secaoFonte, setSecaoFonte] = useState<Record<string, 'padrao' | 'personalizado'>>(() => ({ ...(initialProposal?.secaoFonte || {}) }));

  const setSecaoTexto = (campo: string, key: string, next: string[]) => {
    setSecoesTexto((m) => ({ ...m, [campo]: next }));
    setSecaoFonte((f) => ({ ...f, [key]: 'personalizado' }));
    setTextosTouched(true);
  };
  const restaurarPadraoSecao = async (campo: string) => {
    const r = restaurarSecaoLista(campo as Parameters<typeof restaurarSecaoLista>[0]);
    if (!r) return;
    if (!await requestConfirm('Restaurar o texto padrão ATUAL desta seção? O conteúdo atual dela será substituído (apenas esta seção).')) return;
    setSecoesTexto((m) => ({ ...m, [campo]: r.valor }));
    setSecaoFonte((f) => ({ ...f, [r.key]: 'padrao' }));
    setTextosTouched(true);
  };
  const marcarServicosPersonalizado = () => { setSecaoFonte((f) => ({ ...f, servicos: 'personalizado' })); setTextosTouched(true); };
  const restaurarServicos = async () => {
    if (!await requestConfirm('Restaurar a Descrição dos Serviços para o padrão ATUAL? O conteúdo atual será substituído.')) return;
    setServicosOfertados(servicosOfertadosPadrao());
    setSecaoFonte((f) => ({ ...f, servicos: 'padrao' }));
    setTextosTouched(true);
  };
  // Accordion reutilizável para uma seção-lista materializada (badge + restaurar).
  const secaoListaBlock = (opts: { openKey: string; fonteKey: string; campo: string; titulo: string; icon: React.ReactNode; addLabel: string; seed: string; numbered?: boolean }) => {
    const items = secoesTexto[opts.campo] || [];
    const fonte = fonteDaSecaoLista(opts.campo as Parameters<typeof fonteDaSecaoLista>[0], items);
    return (
      <Accordion title={opts.titulo} icon={opts.icon} open={!!open[opts.openKey]} onToggle={() => toggle(opts.openKey)} badge={<FonteBadge fonte={fonte} />}>
        <div className="flex justify-end mb-2">
          <button type="button" onClick={() => restaurarPadraoSecao(opts.campo)} className="text-[10px] font-bold uppercase text-slate-400 hover:text-[#1A1A72] inline-flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">restart_alt</span>Restaurar padrão
          </button>
        </div>
        <ListEditor
          items={items}
          numbered={opts.numbered}
          onAdd={() => setSecaoTexto(opts.campo, opts.fonteKey, [...items, opts.seed])}
          onUpdate={(i, v) => setSecaoTexto(opts.campo, opts.fonteKey, items.map((x, idx) => (idx === i ? v : x)))}
          onRemove={(i) => setSecaoTexto(opts.campo, opts.fonteKey, items.filter((_, idx) => idx !== i))}
          addLabel={opts.addLabel}
        />
      </Accordion>
    );
  };

  // Pagamento por tags pré-formatadas.
  const [formasPagamento, setFormasPagamento] = useState<string[]>(initialPedido?.proposal?.formasPagamento || ['Pix']);
  const [condicoesPagamento, setCondicoesPagamento] = useState<string[]>(
    initialPedido?.proposal?.condicoesPagamento || ['30% no aceite / 70% na entrega e laudo']
  );
  const toggleTag = (setter: React.Dispatch<React.SetStateAction<string[]>>, v: string) =>
    setter((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));

  // Chaves de ativação dos blocos jurídicos (default: incluídos).
  const [incluirMultas, setIncluirMultas] = useState<boolean>(initialPedido?.proposal?.incluirMultas !== false);
  const [incluirLimitacao, setIncluirLimitacao] = useState<boolean>(initialPedido?.proposal?.incluirLimitacao !== false);
  const [incluirConfidencialidade, setIncluirConfidencialidade] = useState<boolean>(
    initialPedido?.proposal?.incluirConfidencialidade !== false
  );
  const [incluirCondicoesGerais, setIncluirCondicoesGerais] = useState<boolean>(
    initialPedido?.proposal?.incluirCondicoesGerais !== false
  );
  const [incluirSeguranca, setIncluirSeguranca] = useState<boolean>(initialPedido?.proposal?.incluirSeguranca !== false);
  const [incluirTermoAceite, setIncluirTermoAceite] = useState<boolean>(initialPedido?.proposal?.incluirTermoAceite !== false);

  const [maoDeObra, setMaoDeObra] = useState<number>(initialPedido?.proposal?.maoDeObra ?? 0);
  // Override do total comercial. Reidratado do snapshot: usa o flag explícito
  // (valorTotalManual) e, para propostas antigas sem flag, recupera o override
  // histórico quando o total gravado diverge do calculado. Ver [[lib/commercialProposal]].
  const [manualValorTotal, setManualValorTotal] = useState<number | null>(() => {
    const p = initialPedido?.proposal;
    if (!p) return null;
    if (p.valorTotalManual != null && Number.isFinite(Number(p.valorTotalManual))) return Number(p.valorTotalManual);
    const calc = calculateCommercialProposalTotals({ equipmentItems: p.equipmentItems, maoDeObra: p.maoDeObra });
    const stored = Number(p.valorTotal) || 0;
    if (!p.recorrente && stored > 0 && Math.abs(stored - calc.calculatedTotal) > 0.01) return stored;
    return null;
  });

  // §15 — Contrato recorrente (valor mensal / anual / vigência).
  const [recorrente, setRecorrente] = useState<boolean>(initialPedido?.proposal?.recorrente ?? false);
  const [valorMensal, setValorMensal] = useState<number>(initialPedido?.proposal?.valorMensal ?? 0);
  const [vigenciaMeses, setVigenciaMeses] = useState<number>(initialPedido?.proposal?.vigenciaMeses ?? 12);

  // Cadastro rápido de cliente (dialog sobreposto).
  const [newClientOpen, setNewClientOpen] = useState(false);
  const [ncName, setNcName] = useState('');
  const [ncCnpj, setNcCnpj] = useState('');
  const [ncEmail, setNcEmail] = useState('');
  const [ncPhone, setNcPhone] = useState('');
  const [ncSegment, setNcSegment] = useState('');

  const selectedClient = clients.find((c) => c.id === clienteId) || clients[0];

  const round2 = (n: number) => Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;
  // Subtotal = soma dos itens (materiais e/ou serviços). Mão de obra é opcional
  // (0 por padrão); o botão "Sugerir 70/30" preenche pela regra material 30% /
  // mão de obra 70% quando a proposta for de fornecimento com instalação.
  // Fonte ÚNICA de cálculo (mesma do PDF). Ver [[lib/commercialTotals]].
  const totals = calculateCommercialProposalTotals({ equipmentItems, maoDeObra, valorTotalManual: manualValorTotal });
  const subtotalItens = totals.itemsSubtotal;
  const valorBase = totals.calculatedTotal;
  const effectiveValorTotal = totals.finalTotal;
  const sugerir7030 = () => setMaoDeObra(round2(subtotalItens > 0 ? subtotalItens * (0.7 / 0.3) : 0));

  // Separa os itens em Materiais (do estoque) e Serviços, mantendo o índice
  // original de cada um no array para os handlers de edição/remoção.
  const materiaisRows = equipmentItems.map((it, idx) => ({ it, idx })).filter((x) => x.it.tipo !== 'servico');
  const servicosRows = equipmentItems.map((it, idx) => ({ it, idx })).filter((x) => x.it.tipo === 'servico');

  // ----------------- helpers de lista -----------------
  const addStr = (setter: React.Dispatch<React.SetStateAction<string[]>>, def = '') => setter((p) => [...p, def]);
  const updStr = (setter: React.Dispatch<React.SetStateAction<string[]>>, i: number, v: string) =>
    setter((p) => p.map((x, idx) => (idx === i ? v : x)));
  const rmStr = (setter: React.Dispatch<React.SetStateAction<string[]>>, i: number) =>
    setter((p) => p.filter((_, idx) => idx !== i));

  // ----------------- equipamentos -----------------
  const handleUpdateEquipmentPatch = (index: number, patch: Partial<PedidoEquipmentItem>) =>
    setEquipmentItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  const handleRemoveEquipment = (index: number) =>
    setEquipmentItems((prev) => prev.filter((_, i) => i !== index).map((it, i) => ({ ...it, itemNumero: i + 1 })));
  const handleAddEquipmentItem = (item: Partial<PedidoEquipmentItem>) =>
    setEquipmentItems((prev) => [
      ...prev,
      { itemNumero: prev.length + 1, descricao: '', marcaModelo: '', unidade: 'un', quantidade: 1, precoUnitario: 0, ...item } as PedidoEquipmentItem,
    ]);
  // Move um item trocando de posição com o vizinho (mantém a ordem geral).
  const handleMoveEquipment = (index: number, dir: -1 | 1) =>
    setEquipmentItems((prev) => {
      const j = index + dir;
      if (j < 0 || j >= prev.length) return prev;
      const copy = [...prev];
      [copy[index], copy[j]] = [copy[j], copy[index]];
      return copy.map((it, i) => ({ ...it, itemNumero: i + 1 }));
    });

  // ----------------- templates -----------------
  const handleLoadTemplate = (template: PedidoTemplate) => {
    setObjetivo(template.objetivo);
    setDiretrizes(template.diretrizesNormativas);
    setEscopoServico(template.escopoServico);
    setEntregaveis(template.entregaveis);
    setPremissas(template.premissas);
    setRespContratada(template.responsabilidadesContratada);
    setRespContratante(template.responsabilidadesContratante);
    setWarranty(template.garantia ? normalizeCommercialWarranty(template.garantia) : defaultWarranty());
    setConclusao(template.conclusao);
    showToast(`Modelo "${template.name}" aplicado ao formulário!`);
  };
  const handleSaveCurrentTemplate = async () => {
    if (!onSaveTemplate) return;
    const name = await requestText('Nome do modelo favorito:', referencia || 'Modelo comercial');
    if (!name?.trim()) return;
    onSaveTemplate({
      id: `tmpl_${Date.now()}`,
      name: name.trim(),
      clientId: selectedClient?.id,
      objetivo,
      diretrizesNormativas: diretrizes,
      escopoServico,
      entregaveis,
      premissas,
      responsabilidadesContratada: respContratada,
      responsabilidadesContratante: respContratante,
      garantia: garantiaTexto,
      conclusao,
    });
    showToast(selectedClient ? `Modelo salvo para ${selectedClient.name}.` : 'Modelo geral salvo.');
  };
  const handleRenameTemplate = async (template: PedidoTemplate) => {
    if (!onSaveTemplate) return;
    const name = await requestText('Novo nome do modelo:', template.name);
    if (name?.trim()) onSaveTemplate({ ...template, name: name.trim() });
  };

  // ----------------- cadastro rápido de cliente -----------------
  const openNewClient = () => {
    setNcName('');
    setNcCnpj('');
    setNcEmail('');
    setNcPhone('');
    setNcSegment('');
    setNewClientOpen(true);
  };
  const confirmNewClient = () => {
    const nome = ncName.trim();
    if (!nome) return;
    const seq = Math.floor(1000 + Math.random() * 9000);
    const novo: Client = {
      id: `c_${Date.now()}`,
      code: `#CLI-${seq}`,
      name: nome,
      cnpj: ncCnpj.trim() || '00.000.000/0000-00',
      segment: ncSegment.trim() || 'Cliente',
      contractStatus: 'EM DIA',
      lastOSDate: new Date().toLocaleDateString('pt-BR'),
      lastOSType: 'Proposta',
      address: 'Endereço a completar',
      contacts: [{ name: 'Contato', role: 'Representante', phone: ncPhone.trim(), email: ncEmail.trim() }],
      totalContractsValue: 0,
    };
    onAddClient?.(novo);
    setClienteId(novo.id); // já seleciona o novo cliente
    setNewClientOpen(false);
  };

  // ----------------- montar / salvar -----------------
  const revisionChanges = (): string[] => {
    if (!initialPedido?.proposal?.revisoes?.length) return [];
    const before = initialPedido.proposal;
    const changed: string[] = [];
    if (initialPedido.referencia !== referencia) changed.push('referência');
    if (initialPedido.clienteId !== (selectedClient?.id || '')) changed.push('cliente');
    if (Number(before.valorTotal || 0) !== Number(effectiveValorTotal || 0)) changed.push('valor');
    if ((before.objetivo || '') !== objetivo) changed.push('objetivo');
    if ((before.escopoServico || '') !== escopoServico) changed.push('escopo');
    if ((before.prazoExecucao || '') !== prazoExecucao) changed.push('prazo de execução');
    if ((before.garantia || '') !== garantiaTexto) changed.push('garantia');
    if (Number(before.validadePropostaDias || 0) !== Number(validadeDias || 0)) changed.push('validade');
    if (JSON.stringify(before.equipmentItems || []) !== JSON.stringify(equipmentItems || [])) changed.push('itens e quantidades');
    if (JSON.stringify(before.formasPagamento || []) !== JSON.stringify(formasPagamento || []) || JSON.stringify(before.condicoesPagamento || []) !== JSON.stringify(condicoesPagamento || [])) changed.push('condições de pagamento');
    return changed;
  };
  const buildCurrentPedido = (overrideStatus?: PedidoStatus): Pedido => {
    const now = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
    const existingRevisions = initialPedido?.proposal?.revisoes || [];
    const changes = revisionChanges();
    const revisoes = existingRevisions.length
      ? existingRevisions.map((revision, index) => index === existingRevisions.length - 1 ? { ...revision, alteracoes: changes } : revision)
      : undefined;

    // ETAPA 2 — snapshot textual. Grava os textos materializados quando a proposta
    // é nova, já materializada, ou o usuário tocou nas seções. Em proposta
    // histórica não tocada, preserva EXATAMENTE o que estava gravado (sem injetar
    // template e sem marcar textosMaterializados).
    const cartaParas = cartaApresentacao.split('\n').map((x) => x.trim()).filter(Boolean);
    const fonteFinal: Record<string, 'padrao' | 'personalizado'> = {};
    for (const s of SECOES_TEXTO) fonteFinal[s.key] = fonteDaSecaoLista(s.campo, secoesTexto[s.campo]);
    fonteFinal.servicos = fonteServicos(servicosOfertados);
    fonteFinal.carta = cartaParas.join('\n') === CARTA_APRESENTACAO.join('\n') ? 'padrao' : 'personalizado';
    const deveMaterializar = ehNovaProposta || jaMaterializada || textosTouched;
    const textosPatch: Partial<CommercialProposalData> = deveMaterializar
      ? {
          embalagemTransporteTexto: secoesTexto.embalagemTransporteTexto,
          segurancaTrabalhoTexto: secoesTexto.segurancaTrabalhoTexto,
          precosObsTexto: secoesTexto.precosObsTexto,
          impostosObsTexto: secoesTexto.impostosObsTexto,
          multasAtrasoTexto: secoesTexto.multasAtrasoTexto,
          limitacaoRespTexto: secoesTexto.limitacaoRespTexto,
          confidencialidadeTexto: secoesTexto.confidencialidadeTexto,
          termoAceiteTexto: secoesTexto.termoAceiteTexto,
          condicoesGeraisTexto: secoesTexto.condicoesGeraisTexto,
          servicosOfertados,
          textosMaterializados: true,
          secaoFonte: fonteFinal,
        }
      : {
          embalagemTransporteTexto: initialProposal?.embalagemTransporteTexto,
          segurancaTrabalhoTexto: initialProposal?.segurancaTrabalhoTexto,
          precosObsTexto: initialProposal?.precosObsTexto,
          impostosObsTexto: initialProposal?.impostosObsTexto,
          multasAtrasoTexto: initialProposal?.multasAtrasoTexto,
          limitacaoRespTexto: initialProposal?.limitacaoRespTexto,
          confidencialidadeTexto: initialProposal?.confidencialidadeTexto,
          termoAceiteTexto: initialProposal?.termoAceiteTexto,
          condicoesGeraisTexto: initialProposal?.condicoesGeraisTexto,
          servicosOfertados: initialProposal?.servicosOfertados,
          textosMaterializados: initialProposal?.textosMaterializados,
          secaoFonte: initialProposal?.secaoFonte,
        };
    return {
      id: initialPedido?.id || `ped_${Date.now()}`,
      numeroPedido,
      referencia,
      clienteId: selectedClient?.id || '',
      clienteNome: selectedClient?.name || 'Cliente Não Selecionado',
      fornecedor,
      dataEmissao,
      responsavelComercialId: 'u1',
      responsavelComercialNome: responsavelNome,
      status: overrideStatus || status,
      createdAt: initialPedido?.createdAt || now,
      updatedAt: now,
      proposal: {
        schemaVersion: COMMERCIAL_SCHEMA_VERSION,
        areaPrincipal,
        tipoServico: tipoServico || undefined,
        tituloManual: tituloDinamico || initialProposal?.tituloManual || undefined,
        nivelProposta,
        ordemSecoes: ordemSecoes.length ? ordemSecoes : undefined,
        incluirExperiencia,
        experienciaAuto,
        experienciaEmpresasIds: experienciaAuto ? undefined : experienciaEmpresasIds,
        experienciaMarcasIds: experienciaAuto ? undefined : experienciaMarcasIds,
        objetivo,
        cartaApresentacao,
        revisoes,
        motivoRecusa: (overrideStatus || status) === 'recusado' || (overrideStatus || status) === 'expirado'
          ? motivoRecusa.trim() || undefined
          : undefined,
        capaImagemPath: initialPedido?.proposal?.capaImagemPath,
        surveyOrigin: initialPedido?.proposal?.surveyOrigin,
        pedidoTipo: pedidoTipo || undefined,
        diretrizesNormativas: diretrizes,
        escopoServico,
        entregaveis,
        premissas,
        incluso,
        naoIncluso,
        unidadesAtendidas: unidadesAtendidas > 0 ? unidadesAtendidas : undefined,
        frequenciaManutencao: frequenciaManutencao.trim() || undefined,
        slaCritico: slaCritico.trim() || undefined,
        slaTabela: slaTabela.filter((r) => r.situacao.trim() || r.prazo.trim()),
        prazoExecucao,
        garantia: garantiaTexto,
        warranty,
        validadePropostaDias: validadeDias,
        validadePropostaComplemento: validadeComplemento,
        conclusao,
        equipmentItems,
        marcas,
        responsabilidadesContratada: respContratada,
        responsabilidadesContratante: respContratante,
        valorTotal: effectiveValorTotal,
        valorTotalManual: manualValorTotal,
        recorrente,
        valorMensal: recorrente ? valorMensal : undefined,
        vigenciaMeses: recorrente ? vigenciaMeses : undefined,
        maoDeObra,
        composicaoValor: '',
        // Texto legado composto das tags (compatibilidade).
        formaPagamento: [formasPagamento.join(', '), condicoesPagamento.join(' · ')].filter(Boolean).join(' — '),
        formasPagamento,
        condicoesPagamento,
        faturamento,
        impostos,
        incluirMultas,
        incluirLimitacao,
        incluirConfidencialidade,
        incluirCondicoesGerais,
        incluirSeguranca,
        incluirTermoAceite,
        ...textosPatch,
      },
    };
  };

  const handleSaveDraft = () => {
    onSave(buildCurrentPedido('rascunho'));
    onClose();
  };
  const handleSaveWithValidation = (targetStatus: PedidoStatus) => {
    if (targetStatus !== 'rascunho') {
      if (!selectedClient) {
        showToast('Selecione o Cliente.');
        setOpen((o) => ({ ...o, pedido: true }));
        return;
      }
      if (effectiveValorTotal <= 0) {
        showToast('O valor total da proposta deve ser maior que zero.');
        setOpen((o) => ({ ...o, valor: true }));
        return;
      }
    }
    onSave(buildCurrentPedido(targetStatus));
    onClose();
  };
  const handlePreview = () => onPreviewPDF(buildCurrentPedido());

  if (!isOpen) return null;

  // Card de valores (renderizado logo após os itens).
  const valorCard = (
    <div className="bg-[#0B1E38] text-white p-5 rounded-xl shadow-sm space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold text-[#F2A900] uppercase tracking-widest">Valores da Proposta</span>
        <span className="text-[10px] text-slate-300 text-right">Serviço puro: use só os itens. Fornecimento + instalação: clique em Sugerir 70/30.</span>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-300">Subtotal dos itens</span>
        <span className="font-data-mono font-bold">R$ {subtotalItens.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-slate-300 text-sm flex items-center gap-1.5">
          Mão de obra / Serviços adicionais
          <button
            type="button"
            onClick={sugerir7030}
            title="Preencher pela regra 70/30 (sobre o subtotal dos itens)"
            className="text-[9px] font-bold uppercase text-[#0B1E38] bg-[#F2A900] hover:bg-amber-400 rounded px-1.5 py-0.5"
          >
            Sugerir 70/30
          </button>
        </span>
        <div className="flex items-center gap-1">
          <span className="text-slate-400 text-xs font-data-mono">R$</span>
          <input
            type="number"
            min={0}
            value={maoDeObra}
            onChange={(e) => setMaoDeObra(e.target.value === '' ? 0 : Number(e.target.value))}
            className="w-32 bg-slate-900 border border-slate-700 rounded p-1.5 text-right font-data-mono font-bold text-amber-300"
          />
        </div>
      </div>
      <div className="border-t border-slate-700 pt-3 flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold text-[#F2A900] uppercase tracking-widest flex items-center gap-1.5">
          Valor Total (R$)
          {manualValorTotal !== null && (
            <button
              type="button"
              onClick={() => setManualValorTotal(null)}
              title="Voltar ao total calculado (itens + mão de obra)"
              className="text-[9px] font-bold uppercase text-[#0B1E38] bg-[#F2A900] hover:bg-amber-400 rounded px-1.5 py-0.5"
            >
              Auto
            </button>
          )}
        </span>
        <input
          type="number"
          min={0}
          value={effectiveValorTotal}
          onChange={(e) => setManualValorTotal(e.target.value === '' ? null : Number(e.target.value))}
          className="w-44 bg-slate-900 border border-slate-700 rounded-lg p-2 text-xl font-black text-amber-400 font-data-mono text-right"
        />
      </div>
      {/* §15 — Contrato recorrente (valor mensal) */}
      <div className="border-t border-slate-700 pt-3 space-y-2">
        <label className="flex items-center gap-2 text-[10px] font-bold text-slate-300 uppercase tracking-widest cursor-pointer">
          <input type="checkbox" checked={recorrente} onChange={(e) => setRecorrente(e.target.checked)} className="accent-[#F2A900] w-3.5 h-3.5" />
          Contrato recorrente (mensal)
        </label>
        {recorrente && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="block text-[9px] text-slate-400 uppercase mb-1">Valor mensal (R$)</span>
              <input type="number" min={0} value={valorMensal} onChange={(e) => setValorMensal(e.target.value === '' ? 0 : Number(e.target.value))} className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-right font-data-mono font-bold text-amber-300" />
            </div>
            <div>
              <span className="block text-[9px] text-slate-400 uppercase mb-1">Vigência (meses)</span>
              <input type="number" min={1} value={vigenciaMeses} onChange={(e) => setVigenciaMeses(e.target.value === '' ? 0 : Number(e.target.value))} className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-right font-data-mono font-bold text-slate-200" />
            </div>
            {valorMensal > 0 && (
              <p className="col-span-2 text-[10px] text-slate-400 font-data-mono leading-relaxed">
                Anual: R$ {(valorMensal * 12).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                {vigenciaMeses > 0 && <> · Total ({vigenciaMeses} meses): R$ {(valorMensal * vigenciaMeses).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</>}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-slate-50 max-w-4xl w-full rounded-2xl border border-slate-200 shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Cabeçalho */}
        <div className="bg-[#0B1E38] text-white p-5 px-6 flex justify-between items-center shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#E63946] text-white rounded-xl flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] bg-[#F2A900] text-slate-950 font-black px-2 py-0.5 rounded uppercase">
                  Módulo CRM • Novo Pedido
                </span>
                <span className="text-xs font-data-mono text-slate-300 font-bold">{numeroPedido}</span>
              </div>
              <h2 className="text-xl font-bold font-display text-white tracking-wide mt-0.5">
                Elaboração de Proposta Comercial
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePreview}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 uppercase"
            >
              <Eye className="w-4 h-4" /> Pré-Visualizar PDF
            </button>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Corpo: rolagem vertical contínua com sanfonas */}
        <div className="p-4 md:p-6 overflow-y-auto flex-1 space-y-4">
          {initialPedido?.proposal?.surveyOrigin && (
            <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 flex items-start gap-2 text-xs text-indigo-950">
              <span className="material-symbols-outlined text-indigo-700">fact_check</span>
              <div><strong>Pedido originado de levantamento técnico.</strong> {initialPedido.proposal.surveyOrigin.reportNumber || 'Relatório sem número'} · os itens abaixo preservam a origem para conferência comercial.</div>
            </div>
          )}
          {/* ---- Informações do Pedido (sempre visível) ---- */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="font-bold text-[#0B1E38] uppercase text-sm flex items-center gap-2 mb-4">
              <Building2 className="w-4 h-4 text-[#E63946]" /> Informações do Pedido
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className={labelCls}>Número do Pedido</label>
                <input
                  type="text"
                  value={numeroPedido}
                  onChange={(e) => setNumeroPedido(e.target.value)}
                  placeholder="Ex.: PED-2026-249"
                  className={`${inputCls} font-data-mono font-bold`}
                />
                <p className="text-[11px] text-slate-400 mt-1">Sequencial automático — edite se quiser um número específico.</p>
              </div>
              <div>
                <label className={labelCls}>Referência / Nome do Projeto</label>
                <input type="text" value={referencia} onChange={(e) => setReferencia(e.target.value)} placeholder="Ex.: Retrofit SDAI Bloco A" className={inputCls} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Tipo de Pedido</label>
                <select
                  value={pedidoTipo}
                  onChange={(e) => setPedidoTipo(e.target.value as PedidoTipo | '')}
                  className={inputCls}
                >
                  <option value="">Não definido</option>
                  {PEDIDO_TIPO_ORDER.map((t) => (
                    <option key={t} value={t}>
                      {PEDIDO_TIPO_LABELS[t]}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  Define o documento gerado por padrão (configurável em Conta → PDF).
                </p>
              </div>

              {/* P1 — Área de atuação (multi) + Tipo de serviço → título dinâmico */}
              <div className="sm:col-span-2">
                <label className={labelCls}>Área(s) de atuação</label>
                <div className="flex flex-wrap gap-1.5">
                  {AREAS_PROPOSTA.map((a) => {
                    const on = areaPrincipal.includes(a.id);
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => toggleArea(a.id)}
                        className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-colors ${on ? 'bg-[#0B1E38] text-white border-[#0B1E38]' : 'bg-white text-slate-600 border-slate-300 hover:border-[#0B1E38]'}`}
                      >
                        {a.sigla}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Selecione uma ou mais áreas. Compõe o título e a apresentação.</p>
              </div>
              <div className="sm:col-span-2">
                <div className="flex items-center justify-between">
                  <label className={labelCls}>Tipo de serviço</label>
                  {presetPorTipo(tipoServico) && (
                    <button
                      type="button"
                      onClick={() => {
                        const preset = presetPorTipo(tipoServico)!;
                        setNivelProposta(preset.nivel);
                        setIncluirSeguranca(preset.seguranca);
                      }}
                      title="Ajusta o nível da proposta e a seção Segurança do Trabalho conforme o tipo (você pode alterar depois)"
                      className="text-[10px] font-bold uppercase text-[#1A1A72] hover:text-[#E63946]"
                    >
                      Aplicar sugestão do tipo
                    </button>
                  )}
                </div>
                <select value={tipoServico} onChange={(e) => setTipoServico(e.target.value)} className={inputCls}>
                  <option value="">Não definido</option>
                  {TIPOS_SERVICO.map((t) => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
                {tituloDinamico && (
                  <div className="mt-2 rounded-lg bg-[#0B1E38]/5 border border-[#0B1E38]/15 px-3 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#0B1E38]/60">Título gerado</p>
                    <p className="text-xs font-bold text-[#0B1E38]">{tituloDinamico}</p>
                  </div>
                )}
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Nível da proposta</label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { id: 'simples', nome: 'Simples', desc: 'Enxuta, sem capa institucional' },
                    { id: 'tecnica', nome: 'Técnica', desc: 'Padrão, com áreas e resumo' },
                    { id: 'corporativa', nome: 'Corporativa', desc: 'Completa, máx. apresentação' },
                  ] as const).map((n) => {
                    const on = nivelProposta === n.id;
                    return (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => setNivelProposta(n.id)}
                        className={`text-left rounded-lg border px-3 py-2 transition-colors ${on ? 'bg-[#0B1E38] text-white border-[#0B1E38]' : 'bg-white text-slate-600 border-slate-300 hover:border-[#0B1E38]'}`}
                      >
                        <p className="text-xs font-bold">{n.nome}</p>
                        <p className={`text-[10px] ${on ? 'text-slate-300' : 'text-slate-400'}`}>{n.desc}</p>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Na Simples, capa institucional (Áreas de Atuação) e Resumo Executivo não entram.</p>
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Página &ldquo;Experiência e Capacidade Técnica&rdquo;</label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { v: undefined as boolean | undefined, nome: 'Automático', desc: 'Entra em Técnica/Corporativa' },
                    { v: true, nome: 'Incluir', desc: 'Sempre nesta proposta' },
                    { v: false, nome: 'Não incluir', desc: 'Nunca nesta proposta' },
                  ]).map((o) => {
                    const on = incluirExperiencia === o.v;
                    return (
                      <button
                        key={String(o.v)}
                        type="button"
                        onClick={() => setIncluirExperiencia(o.v)}
                        className={`text-left rounded-lg border px-3 py-2 transition-colors ${on ? 'bg-[#0B1E38] text-white border-[#0B1E38]' : 'bg-white text-slate-600 border-slate-300 hover:border-[#0B1E38]'}`}
                      >
                        <p className="text-xs font-bold">{o.nome}</p>
                        <p className={`text-[10px] ${on ? 'text-slate-300' : 'text-slate-400'}`}>{o.desc}</p>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Mostra empresas atendidas e marcas relevantes ao serviço (cadastradas em Conta). Sem dados, a página não é gerada.</p>
                {incluirExperiencia !== false && (empresasAtendidas.length > 0 || marcasTecnologias.length > 0) && (
                  <div className="mt-3 rounded-lg border border-slate-200 p-3 bg-slate-50/60">
                    <div className="flex items-center gap-4 mb-2">
                      <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 cursor-pointer">
                        <input type="radio" checked={experienciaAuto} onChange={() => setExperienciaAuto(true)} className="accent-[#0B1E38]" /> Seleção automática
                      </label>
                      <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 cursor-pointer">
                        <input type="radio" checked={!experienciaAuto} onChange={() => setExperienciaAuto(false)} className="accent-[#0B1E38]" /> Selecionar manualmente
                      </label>
                    </div>
                    {experienciaAuto ? (
                      <p className="text-[11px] text-slate-400">O sistema escolhe as empresas e marcas mais relevantes à área/tipo/segmento desta proposta.</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1">Empresas ({experienciaEmpresasIds.length})</p>
                          <div className="max-h-40 overflow-y-auto space-y-0.5 pr-1">
                            {empresasAtendidas.length === 0 && <p className="text-[11px] text-slate-400 italic">Nenhuma cadastrada.</p>}
                            {empresasAtendidas.map((e) => (
                              <label key={e.id} className="flex items-center gap-2 text-[11px] text-slate-700 py-0.5 cursor-pointer">
                                <input type="checkbox" checked={experienciaEmpresasIds.includes(e.id)} onChange={() => toggleSelId(experienciaEmpresasIds, setExperienciaEmpresasIds, e.id)} className="accent-[#0B1E38]" />
                                <span className="truncate">{e.nomeFantasia || e.nome}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1">Marcas ({experienciaMarcasIds.length})</p>
                          <div className="max-h-40 overflow-y-auto space-y-0.5 pr-1">
                            {marcasTecnologias.length === 0 && <p className="text-[11px] text-slate-400 italic">Nenhuma cadastrada.</p>}
                            {marcasTecnologias.map((m) => (
                              <label key={m.id} className="flex items-center gap-2 text-[11px] text-slate-700 py-0.5 cursor-pointer">
                                <input type="checkbox" checked={experienciaMarcasIds.includes(m.id)} onChange={() => toggleSelId(experienciaMarcasIds, setExperienciaMarcasIds, m.id)} className="accent-[#0B1E38]" />
                                <span className="truncate">{m.nome}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="sm:col-span-2">
                <label className={labelCls}>
                  Cliente / Contratante <span className="text-[#E63946]">*</span>
                </label>
                <div className="flex gap-2">
                  <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} className={`${inputCls} font-bold`}>
                    {clients.length === 0 && <option value="">Nenhum cliente</option>}
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} — CNPJ: {c.cnpj}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={openNewClient}
                    title="Cadastrar novo cliente"
                    className="shrink-0 px-3 rounded-lg bg-[#0B1E38] hover:bg-slate-800 text-white flex items-center gap-1.5 text-xs font-bold uppercase"
                  >
                    <UserPlus className="w-4 h-4" /> Novo
                  </button>
                </div>
              </div>
              <div>
                <label className={labelCls}>Fornecedor</label>
                <input type="text" value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Data de Emissão</label>
                <input type="date" value={dataEmissao} onChange={(e) => setDataEmissao(e.target.value)} className={`${inputCls} font-data-mono`} />
              </div>
              <div>
                <label className={labelCls}>Responsável Comercial</label>
                <input type="text" value={responsavelNome} onChange={(e) => setResponsavelNome(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value as PedidoStatus)} className={inputCls}>
                  <option value="rascunho">Rascunho</option>
                  <option value="em_revisao">Em Revisão</option>
                  <option value="enviado_ao_cliente">Enviado ao Cliente</option>
                  <option value="visualizado_cliente">Visualizado pelo Cliente</option>
                  <option value="em_negociacao">Em Negociação</option>
                  <option value="aceito">Aceito</option>
                  <option value="concluido">Concluída / Recebida</option>
                  <option value="recusado">Recusada</option>
                  <option value="expirado">Expirada</option>
                </select>
              </div>
            </div>
            {(status === 'recusado' || status === 'expirado') && (
              <div className="mt-3">
                <label className={labelCls}>{status === 'recusado' ? 'Motivo da recusa' : 'Observação sobre a expiração'}</label>
                <textarea
                  value={motivoRecusa}
                  onChange={(e) => setMotivoRecusa(e.target.value)}
                  rows={2}
                  placeholder="Ex.: valor fora do orçamento, escopo adiado, fornecedor concorrente…"
                  className={inputCls}
                />
              </div>
            )}
          </div>

          {/* ---- Lista de Materiais (puxa do Estoque) ---- */}
          <Accordion
            title="Lista de Materiais"
            icon={<Wrench className="w-4 h-4 text-[#E63946]" />}
            open={!!open.materiais}
            onToggle={() => toggle('materiais')}
            badge={<span className="text-[10px] font-bold bg-slate-100 text-slate-600 rounded-full px-2 py-0.5">{materiaisRows.length}</span>}
          >
            <p className="text-[11px] text-slate-500 mb-3">Vincule do Estoque (código, nome e preço vêm do produto) ou digite manualmente no card abaixo.</p>
            <ItensCardEditor
              tipo="material"
              accent="red"
              itens={materiaisRows}
              catalogo={inventory.map((inv) => ({ id: inv.id, label: `${inv.code} - ${inv.name}` }))}
              resolveCatalogo={(id) => {
                const inv = inventory.find((i) => i.id === id);
                if (!inv) return undefined;
                return {
                  descricao: inv.name,
                  descricaoDetalhada: inv.commercialDescription || inv.shortDescription || inv.description,
                  marcaModelo: [inv.brand, inv.model].filter(Boolean).join(' · ') || inv.supplier || inv.category,
                  precoUnitario: inv.salePrice ?? inv.unitPrice,
                  unidade: normalizeUnitCode(inv.unit),
                  stockSnapshot: inv.quantity,
                };
              }}
              onAdd={handleAddEquipmentItem}
              onUpdate={handleUpdateEquipmentPatch}
              onRemove={handleRemoveEquipment}
              onMove={handleMoveEquipment}
            />
          </Accordion>

          {/* ---- Lista de Serviços (digitado ou do catálogo de Serviços) ---- */}
          <Accordion
            title="Lista de Serviços"
            icon={<ShieldCheck className="w-4 h-4 text-emerald-600" />}
            open={!!open.servicos}
            onToggle={() => toggle('servicos')}
            badge={<span className="text-[10px] font-bold bg-slate-100 text-slate-600 rounded-full px-2 py-0.5">{servicosRows.length}</span>}
          >
            <p className="text-[11px] text-slate-500 mb-3">
              Digite o serviço (ex.: &ldquo;Integração SDAI do lojista&rdquo;) ou vincule ao catálogo da aba Serviços, no card abaixo.
            </p>
            <ItensCardEditor
              tipo="servico"
              accent="emerald"
              itens={servicosRows}
              catalogo={services.map((svc) => ({ id: svc.id, label: `${svc.code} - ${svc.title}` }))}
              resolveCatalogo={(id) => {
                const svc = services.find((s) => s.id === id);
                if (!svc) return undefined;
                return { descricao: svc.title, precoUnitario: svc.standardValue, unidade: normalizeUnitCode(svc.unit || 'vb') };
              }}
              onAdd={handleAddEquipmentItem}
              onUpdate={handleUpdateEquipmentPatch}
              onRemove={handleRemoveEquipment}
              onMove={handleMoveEquipment}
            />
          </Accordion>

          {valorCard}

          {/* ---- Accordions de conteúdo ---- */}
          <Accordion title="Objetivo da Proposta" icon={<FileText className="w-4 h-4 text-[#E63946]" />} open={!!open.objetivo} onToggle={() => toggle('objetivo')}>
            <textarea rows={3} value={objetivo} onChange={(e) => setObjetivo(e.target.value)} placeholder="Objetivo geral da proposta..." className={inputCls} />
          </Accordion>

          <Accordion
            title="Carta de Apresentação"
            icon={<FileText className="w-4 h-4 text-[#0B1E38]" />}
            open={!!open.carta}
            onToggle={() => toggle('carta')}
            badge={<FonteBadge fonte={cartaApresentacao.split('\n').map((x) => x.trim()).filter(Boolean).join('\n') === CARTA_APRESENTACAO.join('\n') ? 'padrao' : 'personalizado'} />}
          >
            <div className="flex justify-end mb-2">
              <button
                type="button"
                onClick={async () => { if (await requestConfirm('Restaurar o texto padrão da Carta de Apresentação?')) { setCartaApresentacao(CARTA_APRESENTACAO.join('\n')); setTextosTouched(true); } }}
                className="text-[10px] font-bold uppercase text-slate-400 hover:text-[#1A1A72] inline-flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-sm">restart_alt</span>Restaurar padrão
              </button>
            </div>
            <textarea
              rows={5}
              value={cartaApresentacao}
              onChange={(e) => { setCartaApresentacao(e.target.value); setTextosTouched(true); }}
              placeholder="Cada linha vira um parágrafo no PDF. Se ficar em branco, uma proposta histórica ainda usa o texto institucional; numa proposta nova o texto padrão já vem preenchido aqui."
              className={inputCls}
            />
            <p className="text-[10px] text-slate-400 mt-1">Aparece na 2ª página do PDF, assinada pelo responsável comercial.</p>
          </Accordion>

          <Accordion title="Diretrizes Normativas" icon={<ShieldCheck className="w-4 h-4 text-emerald-600" />} open={!!open.diretrizes} onToggle={() => toggle('diretrizes')}>
            <ListEditor items={diretrizes} numbered onAdd={() => addStr(setDiretrizes, 'ABNT NBR ')} onUpdate={(i, v) => updStr(setDiretrizes, i, v)} onRemove={(i) => rmStr(setDiretrizes, i)} addLabel="Adicionar norma" />
          </Accordion>

          <Accordion title="Escopo Técnico dos Serviços" icon={<Wrench className="w-4 h-4 text-[#E63946]" />} open={!!open.escopo} onToggle={() => toggle('escopo')}>
            <textarea rows={4} value={escopoServico} onChange={(e) => setEscopoServico(e.target.value)} className={inputCls} />
          </Accordion>

          <Accordion title="Entregáveis do Projeto" icon={<CheckCircle className="w-4 h-4 text-emerald-600" />} open={!!open.entregaveis} onToggle={() => toggle('entregaveis')}>
            <ListEditor items={entregaveis} onAdd={() => addStr(setEntregaveis, 'Documento de entregável')} onUpdate={(i, v) => updStr(setEntregaveis, i, v)} onRemove={(i) => rmStr(setEntregaveis, i)} addLabel="Adicionar entregável" />
          </Accordion>

          <Accordion title="Premissas Adotadas" icon={<ShieldCheck className="w-4 h-4 text-[#0B1E38]" />} open={!!open.premissas} onToggle={() => toggle('premissas')}>
            <ListEditor items={premissas} onAdd={() => addStr(setPremissas, 'Acesso livre e facilitado')} onUpdate={(i, v) => updStr(setPremissas, i, v)} onRemove={(i) => rmStr(setPremissas, i)} addLabel="Adicionar premissa" />
          </Accordion>

          <Accordion title="Incluso / Não incluso" icon={<ShieldCheck className="w-4 h-4 text-emerald-600" />} open={!!open.incluso} onToggle={() => toggle('incluso')}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Incluso no escopo</label>
                <ListEditor items={incluso} onAdd={() => addStr(setIncluso, 'Item incluso no escopo')} onUpdate={(i, v) => updStr(setIncluso, i, v)} onRemove={(i) => rmStr(setIncluso, i)} addLabel="Adicionar incluso" />
              </div>
              <div>
                <label className={labelCls}>Não incluso</label>
                <ListEditor items={naoIncluso} onAdd={() => addStr(setNaoIncluso, 'Item fora do escopo')} onUpdate={(i, v) => updStr(setNaoIncluso, i, v)} onRemove={(i) => rmStr(setNaoIncluso, i)} addLabel="Adicionar exclusão" />
              </div>
            </div>
          </Accordion>

          <Accordion title="Indicadores & SLA (resumo executivo)" icon={<ShieldCheck className="w-4 h-4 text-[#0B1E38]" />} open={!!open.indicadores} onToggle={() => toggle('indicadores')}>
            <p className="text-[11px] text-slate-500 mb-3">Opcional. Preenchido, gera a página de <b>Resumo Executivo</b> (cards) e o bloco de <b>SLA</b>. Em branco, nada aparece.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
              <div>
                <label className={labelCls}>Unidades atendidas</label>
                <input type="number" min={0} value={unidadesAtendidas} onChange={(e) => setUnidadesAtendidas(e.target.value === '' ? 0 : Number(e.target.value))} className={inputCls} placeholder="Ex: 19" />
              </div>
              <div>
                <label className={labelCls}>Frequência de manutenção</label>
                <input type="text" value={frequenciaManutencao} onChange={(e) => setFrequenciaManutencao(e.target.value)} className={inputCls} placeholder="Ex: Trimestral" />
              </div>
              <div>
                <label className={labelCls}>SLA falhas críticas</label>
                <input type="text" value={slaCritico} onChange={(e) => setSlaCritico(e.target.value)} className={inputCls} placeholder="Ex: 48 horas" />
              </div>
            </div>
            <label className={labelCls}>Tabela de SLA (situação → prazo)</label>
            <div className="space-y-2">
              {slaTabela.map((r, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                  <input type="text" value={r.situacao} onChange={(e) => updSla(i, 'situacao', e.target.value)} className={inputCls} placeholder="Situação (ex: Falha crítica)" />
                  <input type="text" value={r.prazo} onChange={(e) => updSla(i, 'prazo', e.target.value)} className={inputCls} placeholder="Prazo (ex: Até 48 horas)" />
                  <button type="button" onClick={() => rmSla(i)} className="text-slate-400 hover:text-[#E63946] p-1" title="Remover linha">✕</button>
                </div>
              ))}
              <button type="button" onClick={addSla} className="text-[11px] font-semibold text-[#1A1A72] hover:text-[#E63946] uppercase">+ Adicionar linha de SLA</button>
            </div>
          </Accordion>

          <Accordion title="Responsabilidades da Contratada" icon={<CheckCircle className="w-4 h-4 text-emerald-600" />} open={!!open.respContratada} onToggle={() => toggle('respContratada')}>
            <ListEditor items={respContratada} onAdd={() => addStr(setRespContratada, 'Fornecer equipe qualificada')} onUpdate={(i, v) => updStr(setRespContratada, i, v)} onRemove={(i) => rmStr(setRespContratada, i)} addLabel="Adicionar item" />
          </Accordion>

          <Accordion title="Obrigações da Contratante" icon={<Building2 className="w-4 h-4 text-blue-600" />} open={!!open.respContratante} onToggle={() => toggle('respContratante')}>
            <ListEditor items={respContratante} onAdd={() => addStr(setRespContratante, 'Liberar autorizações')} onUpdate={(i, v) => updStr(setRespContratante, i, v)} onRemove={(i) => rmStr(setRespContratante, i)} addLabel="Adicionar item" />
          </Accordion>

          {/* ETAPA 2 — Textos padrão materializados (antes injetados só no PDF).
              Todos ficam VISÍVEIS aqui e são a fonte de verdade do documento. */}
          <Accordion
            title="Descrição dos Serviços Ofertados"
            icon={<Wrench className="w-4 h-4 text-[#E63946]" />}
            open={!!open.descServicos}
            onToggle={() => toggle('descServicos')}
            badge={<FonteBadge fonte={fonteServicos(servicosOfertados)} />}
          >
            <div className="flex justify-end mb-2">
              <button type="button" onClick={restaurarServicos} className="text-[10px] font-bold uppercase text-slate-400 hover:text-[#1A1A72] inline-flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">restart_alt</span>Restaurar padrão
              </button>
            </div>
            <div className="space-y-3">
              {servicosOfertados.map((grupo, gi) => (
                <div key={gi} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      type="text"
                      value={grupo.titulo}
                      onChange={(e) => { setServicosOfertados((prev) => prev.map((g, idx) => (idx === gi ? { ...g, titulo: e.target.value } : g))); marcarServicosPersonalizado(); }}
                      placeholder="Título do grupo (ex.: Instalação e Montagem)"
                      className={`flex-1 ${inputCls} font-semibold`}
                    />
                    <button type="button" onClick={() => { setServicosOfertados((prev) => prev.filter((_, idx) => idx !== gi)); marcarServicosPersonalizado(); }} className="p-1.5 text-slate-400 hover:text-[#E63946] hover:bg-red-50 rounded-lg shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                  <ListEditor
                    items={grupo.itens}
                    onAdd={() => { setServicosOfertados((prev) => prev.map((g, idx) => (idx === gi ? { ...g, itens: [...g.itens, 'Novo item do serviço'] } : g))); marcarServicosPersonalizado(); }}
                    onUpdate={(i, v) => { setServicosOfertados((prev) => prev.map((g, idx) => (idx === gi ? { ...g, itens: g.itens.map((x, ii) => (ii === i ? v : x)) } : g))); marcarServicosPersonalizado(); }}
                    onRemove={(i) => { setServicosOfertados((prev) => prev.map((g, idx) => (idx === gi ? { ...g, itens: g.itens.filter((_, ii) => ii !== i) } : g))); marcarServicosPersonalizado(); }}
                    addLabel="Adicionar item"
                  />
                </div>
              ))}
              <button type="button" onClick={() => { setServicosOfertados((prev) => [...prev, { titulo: 'Novo grupo de serviços', itens: [] }]); marcarServicosPersonalizado(); }} className="w-full py-2 rounded-lg border border-dashed border-[#0B1E38]/40 text-[11px] font-semibold text-[#0B1E38] hover:bg-[#0B1E38]/5 flex items-center justify-center gap-1 uppercase">
                <Plus className="w-3.5 h-3.5" /> Adicionar grupo
              </button>
            </div>
          </Accordion>

          {secaoListaBlock({ openKey: 'secEmbalagem', fonteKey: 'embalagem', campo: 'embalagemTransporteTexto', titulo: 'Embalagem, Transporte e Armazenamento', icon: <FileText className="w-4 h-4 text-[#0B1E38]" />, addLabel: 'Adicionar parágrafo', seed: 'Novo parágrafo' })}
          {secaoListaBlock({ openKey: 'secSeguranca', fonteKey: 'seguranca', campo: 'segurancaTrabalhoTexto', titulo: 'Segurança do Trabalho', icon: <ShieldCheck className="w-4 h-4 text-emerald-600" />, addLabel: 'Adicionar item', seed: 'Nova condição de segurança' })}
          {secaoListaBlock({ openKey: 'secPrecos', fonteKey: 'precos', campo: 'precosObsTexto', titulo: 'Preços — Observações', icon: <DollarSign className="w-4 h-4 text-emerald-600" />, addLabel: 'Adicionar observação', seed: 'Nova observação de preço' })}
          {secaoListaBlock({ openKey: 'secImpostos', fonteKey: 'impostos', campo: 'impostosObsTexto', titulo: 'Impostos e Taxas — Observações', icon: <Scale className="w-4 h-4 text-blue-600" />, addLabel: 'Adicionar observação', seed: 'Nova observação de imposto' })}
          {secaoListaBlock({ openKey: 'secMultas', fonteKey: 'multas', campo: 'multasAtrasoTexto', titulo: 'Multas por Atraso de Pagamento', icon: <Scale className="w-4 h-4 text-[#E63946]" />, addLabel: 'Adicionar parágrafo', seed: 'Novo parágrafo' })}
          {secaoListaBlock({ openKey: 'secLimitacao', fonteKey: 'limitacao', campo: 'limitacaoRespTexto', titulo: 'Limitação de Responsabilidade', icon: <Scale className="w-4 h-4 text-[#0B1E38]" />, addLabel: 'Adicionar parágrafo', seed: 'Novo parágrafo' })}
          {secaoListaBlock({ openKey: 'secConfid', fonteKey: 'confidencialidade', campo: 'confidencialidadeTexto', titulo: 'Confidencialidade', icon: <ShieldCheck className="w-4 h-4 text-[#0B1E38]" />, addLabel: 'Adicionar parágrafo', seed: 'Novo parágrafo' })}
          {secaoListaBlock({ openKey: 'secTermo', fonteKey: 'termoAceite', campo: 'termoAceiteTexto', titulo: 'Termo de Aceite da Proposta', icon: <CheckCircle className="w-4 h-4 text-emerald-600" />, addLabel: 'Adicionar parágrafo', seed: 'Novo parágrafo' })}
          {secaoListaBlock({ openKey: 'secCondGerais', fonteKey: 'condicoesGerais', campo: 'condicoesGeraisTexto', titulo: 'Condições Gerais', icon: <FileText className="w-4 h-4 text-slate-600" />, addLabel: 'Adicionar parágrafo', seed: 'Novo parágrafo' })}

          <Accordion title="Conclusão" icon={<FileText className="w-4 h-4 text-[#0B1E38]" />} open={!!open.conclusao} onToggle={() => toggle('conclusao')}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-slate-400">Texto de fechamento da proposta.</span>
              {tipoServico && (
                <button
                  type="button"
                  onClick={() => setConclusao(conclusaoPorTipo(tipoServico))}
                  title="Preenche com uma conclusão adequada ao tipo de serviço (você pode editar)"
                  className="text-[10px] font-bold uppercase text-[#1A1A72] hover:text-[#E63946]"
                >
                  Sugerir pelo tipo
                </button>
              )}
            </div>
            <textarea rows={3} value={conclusao} onChange={(e) => setConclusao(e.target.value)} className={inputCls} />
          </Accordion>

          {/* ---- Condições de Pagamento (tags pré-formatadas) ---- */}
          <Accordion title="Condições de Pagamento" icon={<CreditCard className="w-4 h-4 text-emerald-600" />} open={!!open.pagamento} onToggle={() => toggle('pagamento')}>
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Formas de Pagamento</label>
                <TagSelect options={FORMAS_PAGAMENTO} selected={formasPagamento} onToggle={(v) => toggleTag(setFormasPagamento, v)} />
              </div>
              <div>
                <label className={labelCls}>Condições de Pagamento</label>
                <TagSelect options={CONDICOES_PAGAMENTO} selected={condicoesPagamento} onToggle={(v) => toggleTag(setCondicoesPagamento, v)} />
              </div>
              <p className="text-[10px] text-slate-400">Clique nas opções para marcar. O texto no PDF é montado automaticamente.</p>
            </div>
          </Accordion>

          {/* ---- Cláusulas Jurídicas (chaves de ativação) ---- */}
          <Accordion title="Cláusulas Jurídicas" icon={<Scale className="w-4 h-4 text-[#E63946]" />} open={!!open.clausulas} onToggle={() => toggle('clausulas')}>
            <p className="text-[11px] text-slate-500 mb-2">Marque os blocos que devem sair no PDF. Desmarcado = título e texto totalmente omitidos.</p>
            <div className="space-y-2">
              <ClauseRow label="Multas por atraso de pagamento" hint="Juros de mora e multa por inadimplência" checked={incluirMultas} onChange={setIncluirMultas} />
              <ClauseRow label="Limitação de responsabilidade" checked={incluirLimitacao} onChange={setIncluirLimitacao} />
              <ClauseRow label="Confidencialidade e sigilo" checked={incluirConfidencialidade} onChange={setIncluirConfidencialidade} />
              <ClauseRow label="Condições Gerais" checked={incluirCondicoesGerais} onChange={setIncluirCondicoesGerais} />
              <ClauseRow label="Segurança do Trabalho" checked={incluirSeguranca} onChange={setIncluirSeguranca} />
              <ClauseRow label="Termo de Aceite da Proposta" checked={incluirTermoAceite} onChange={setIncluirTermoAceite} />
            </div>
          </Accordion>

          {/* ---- Estrutura da proposta (§10/§11/§12: prévia + ativar/desativar + reordenar) ---- */}
          <Accordion title="Estrutura da proposta" icon={<FileText className="w-4 h-4 text-[#0B1E38]" />} open={!!open.estrutura} onToggle={() => toggle('estrutura')}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] text-slate-500">Prévia do índice. Ative/desative as opcionais e use ↑↓ para reordenar — a numeração é recalculada sozinha.</p>
              {ordemSecoes.length > 0 && (
                <button type="button" onClick={() => setOrdemSecoes([])} className="shrink-0 text-[10px] font-bold uppercase text-[#1A1A72] hover:text-[#E63946]">Ordem padrão</button>
              )}
            </div>
            {(() => {
              const secToggle: Record<string, { v: boolean; set: (b: boolean) => void }> = {
                seguranca: { v: incluirSeguranca, set: setIncluirSeguranca },
                multas: { v: incluirMultas, set: setIncluirMultas },
                limitacao: { v: incluirLimitacao, set: setIncluirLimitacao },
                confidencialidade: { v: incluirConfidencialidade, set: setIncluirConfidencialidade },
                termoAceite: { v: incluirTermoAceite, set: setIncluirTermoAceite },
                condicoesGerais: { v: incluirCondicoesGerais, set: setIncluirCondicoesGerais },
              };
              const temMateriais = equipmentItems.some((it) => it.tipo !== 'servico');
              const estrutura = ordenarEstrutura(
                montarEstruturaProposta(
                  { tipoServico, incluirSeguranca, incluirMultas, incluirLimitacao, incluirConfidencialidade, incluirTermoAceite, incluirCondicoesGerais },
                  { cartaVisivel: nivelProposta !== 'simples', historicoVisivel: nivelProposta !== 'simples', temMateriais }
                ),
                ordemSecoes
              );
              const fixa = (k: string) => SECOES_FIXAS_INICIO.includes(k) || SECOES_FIXAS_FIM.includes(k);
              const meioKeys = estrutura.filter((s) => !fixa(s.key)).map((s) => s.key);
              const mover = (key: string, dir: -1 | 1) => {
                const i = meioKeys.indexOf(key);
                const j = i + dir;
                if (i < 0 || j < 0 || j >= meioKeys.length) return;
                const next = [...meioKeys];
                [next[i], next[j]] = [next[j], next[i]];
                setOrdemSecoes(next);
              };
              let n = 0;
              return (
                <div className="space-y-1">
                  {estrutura.map((s) => {
                    const tg = secToggle[s.key];
                    const podeMover = !fixa(s.key);
                    const mi = meioKeys.indexOf(s.key);
                    if (s.visible) n += 1;
                    return (
                      <div key={s.key} className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 ${s.visible ? 'bg-white border-slate-200' : 'bg-slate-50 border-dashed border-slate-200'}`}>
                        {podeMover ? (
                          <div className="flex flex-col shrink-0 -my-1">
                            <button type="button" onClick={() => mover(s.key, -1)} disabled={mi <= 0} className="text-slate-400 hover:text-[#0B1E38] disabled:opacity-25 leading-none text-[11px]" title="Subir">▲</button>
                            <button type="button" onClick={() => mover(s.key, 1)} disabled={mi >= meioKeys.length - 1} className="text-slate-400 hover:text-[#0B1E38] disabled:opacity-25 leading-none text-[11px]" title="Descer">▼</button>
                          </div>
                        ) : (
                          <div className="w-3 shrink-0" />
                        )}
                        <span className={`font-data-mono text-[11px] font-bold shrink-0 ${s.visible ? 'text-[#0B1E38]' : 'text-slate-300'}`}>{s.visible ? String(n).padStart(2, '0') : '--'}</span>
                        <span className={`text-xs truncate flex-1 ${s.visible ? 'text-slate-700' : 'text-slate-400 line-through'}`}>{s.titulo}{fixa(s.key) && <span className="text-[9px] text-slate-400 ml-1">(fixa)</span>}</span>
                        {tg ? (
                          <button type="button" onClick={() => tg.set(!tg.v)} className={`shrink-0 text-[10px] font-bold uppercase px-2 py-0.5 rounded ${tg.v ? 'text-emerald-700 bg-emerald-50' : 'text-slate-400 bg-slate-100'}`}>{tg.v ? 'Ativa' : 'Inativa'}</button>
                        ) : s.opcional ? (
                          <span className="text-[9px] text-slate-400 shrink-0">automática</span>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </Accordion>

          {/* ---- Garantia (bloco próprio, visível) ---- */}
          <Accordion title="Garantia" icon={<ShieldCheck className="w-4 h-4 text-emerald-600" />} open={!!open.garantia} onToggle={() => toggle('garantia')}>
            {isLegacyWarranty(warranty) ? (
              <div className="space-y-2">
                <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">Garantia herdada em texto livre. A edição preserva o histórico; converta para o formato estruturado quando quiser separar mão de obra e materiais.</p>
                <textarea rows={3} value={warranty.text} onChange={(e) => setWarranty({ mode: 'legacy_text', text: e.target.value })} placeholder="Condição de garantia…" className={`${inputCls} resize-y`} />
                <button type="button" onClick={() => setWarranty(defaultWarranty())} className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 underline">Converter para garantia estruturada (90 dias / 12 meses)</button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {warrantyLegBlock('Mão de obra', 'maoDeObra')}
                {warrantyLegBlock('Materiais / equipamentos', 'materiais')}
                <div>
                  <label className={labelCls}>Observações da garantia (opcional)</label>
                  <textarea rows={2} value={(isStructuredWarranty(warranty) && warranty.observacoes) || ''} onChange={(e) => setWarrantyObs(e.target.value)} placeholder="Ex.: garantia condicionada à manutenção preventiva…" className={`${inputCls} resize-y`} />
                </div>
                {!renderWarranty(warranty).hasAny && (
                  <p className="text-[11px] text-slate-500 italic">Nenhuma garantia informada — a seção “Garantia” não aparecerá no documento.</p>
                )}
              </div>
            )}
          </Accordion>

          {/* ---- Informações Básicas (colapsável com +/lixeira) ---- */}
          <Accordion title="Informações Básicas" icon={<DollarSign className="w-4 h-4 text-emerald-600" />} open={!!open.basicas} onToggle={() => toggle('basicas')}>
            <div className="space-y-2.5">
              <BasicInfoRow label="Prazo de Execução" value={prazoExecucao} onChange={setPrazoExecucao} placeholder="Ex.: 10 dias úteis após liberação" />
              <BasicInfoRow label="Faturamento" value={faturamento} onChange={setFaturamento} placeholder="Ex.: Nota Fiscal de Serviços" />
              <BasicInfoRow label="Impostos" value={impostos} onChange={setImpostos} placeholder="Ex.: Inclusos, Simples Nacional" />
              <div className="flex items-end gap-2 pt-1">
                <div className="w-28">
                  <label className={labelCls}>Validade (dias)</label>
                  <input type="number" value={validadeDias} onChange={(e) => setValidadeDias(Number(e.target.value))} className={`${inputCls} font-data-mono`} />
                </div>
                <div className="flex-1">
                  <label className={labelCls}>Texto complementar</label>
                  <input type="text" value={validadeComplemento} onChange={(e) => setValidadeComplemento(e.target.value)} className={inputCls} />
                </div>
              </div>
            </div>
          </Accordion>

          {/* ---- Modelos reutilizáveis ---- */}
          {(templates.length > 0 || onSaveTemplate) && (
            <Accordion title="Modelos Reutilizáveis" icon={<Sparkles className="w-4 h-4 text-[#F2A900]" />} open={!!open.modelos} onToggle={() => toggle('modelos')}>
              {onSaveTemplate && (
                <button type="button" onClick={handleSaveCurrentTemplate} className="mb-3 w-full sm:w-auto px-3 py-2 border border-[#1A1A72]/25 text-[#1A1A72] hover:bg-[#1A1A72]/5 rounded-lg text-xs font-bold uppercase flex items-center justify-center gap-1.5">
                  <Save className="w-3.5 h-3.5" /> Salvar preenchimento como modelo{selectedClient ? ' deste cliente' : ''}
                </button>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {templates.filter((tmpl) => !tmpl.clientId || tmpl.clientId === selectedClient?.id).map((tmpl) => (
                  <div key={tmpl.id} className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-col justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-slate-900 text-xs uppercase">{tmpl.name}</h4>
                      {tmpl.clientId && <p className="text-[10px] font-bold uppercase tracking-wide text-[#1A1A72] mt-1">Modelo do cliente</p>}
                      <p className="text-[11px] text-slate-500 line-clamp-2 mt-1">{tmpl.objetivo}</p>
                    </div>
                    <button type="button" onClick={() => handleLoadTemplate(tmpl)} className="px-3 py-2 bg-[#0B1E38] hover:bg-slate-800 text-white rounded-lg text-xs font-bold uppercase flex items-center justify-center gap-1.5">
                      <Copy className="w-3.5 h-3.5 text-[#F2A900]" /> Aplicar modelo
                    </button>
                    {(onSaveTemplate || onDeleteTemplate) && (
                      <div className="flex justify-end gap-1">
                        {onSaveTemplate && <button type="button" onClick={() => handleRenameTemplate(tmpl)} className="px-2 py-1 text-[10px] font-semibold text-slate-500 hover:text-[#1A1A72]">Renomear</button>}
                        {onDeleteTemplate && <button type="button" onClick={async () => { if (await requestConfirm(`Excluir o modelo \"${tmpl.name}\"?`)) onDeleteTemplate(tmpl.id); }} className="p-1 text-slate-400 hover:text-red-600" title="Excluir modelo"><Trash2 className="w-3.5 h-3.5" /></button>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Accordion>
          )}
        </div>

        {/* Rodapé */}
        <div className="bg-white border-t border-slate-200 p-4 px-6 flex flex-wrap justify-between items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={handleSaveDraft}
            className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl text-xs transition-colors uppercase tracking-wide flex items-center gap-1.5"
          >
            <Save className="w-4 h-4 text-slate-600" /> Salvar Rascunho
          </button>
          <div className="flex items-center gap-2">
            {status === 'rascunho' && (
              <button
                type="button"
                onClick={() => handleSaveWithValidation('em_revisao')}
                className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-xs transition-colors uppercase tracking-wide"
              >
                Enviar p/ Revisão
              </button>
            )}
            <button
              type="button"
              onClick={() => handleSaveWithValidation('enviado_ao_cliente')}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-colors uppercase tracking-wide shadow-md flex items-center gap-1.5"
            >
              <CheckCircle className="w-4 h-4" /> Salvar &amp; Emitir Proposta
            </button>
          </div>
        </div>
      </div>

      {/* ============ Dialog: cadastro rápido de cliente ============ */}
      {newClientOpen && (
        <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-xl shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-[#0B1E38]" />
                <h3 className="text-sm font-bold text-slate-900 uppercase">Novo Cliente</h3>
              </div>
              <button onClick={() => setNewClientOpen(false)} className="text-slate-400 hover:text-slate-700 font-bold text-lg leading-none">✕</button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className={labelCls}>Nome / Razão Social *</label>
                <input autoFocus type="text" value={ncName} onChange={(e) => setNcName(e.target.value)} placeholder="Nome do cliente" className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>CNPJ</label>
                  <input type="text" value={ncCnpj} onChange={(e) => setNcCnpj(e.target.value)} placeholder="00.000.000/0000-00" className={`${inputCls} font-data-mono`} />
                </div>
                <div>
                  <label className={labelCls}>Segmento</label>
                  <input type="text" value={ncSegment} onChange={(e) => setNcSegment(e.target.value)} placeholder="Ex.: Shopping" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>E-mail</label>
                  <input type="email" value={ncEmail} onChange={(e) => setNcEmail(e.target.value)} placeholder="contato@cliente.com" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Telefone</label>
                  <input type="text" value={ncPhone} onChange={(e) => setNcPhone(e.target.value)} placeholder="(00) 00000-0000" className={inputCls} />
                </div>
              </div>
              <p className="text-[10px] text-slate-400 flex items-start gap-1 bg-slate-50 border border-slate-200 rounded-lg p-2">
                <span className="material-symbols-outlined text-sm text-slate-400">info</span>
                <span>Você não perde os dados da proposta. O cliente é criado e já selecionado aqui.</span>
              </p>
            </div>
            <div className="flex items-center justify-between p-4 border-t border-slate-100">
              <button onClick={() => setNewClientOpen(false)} className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 uppercase">
                Cancelar
              </button>
              <button
                onClick={confirmNewClient}
                disabled={!ncName.trim()}
                className="px-5 py-2 rounded-lg bg-[#0B1E38] hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wide"
              >
                Salvar e selecionar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
