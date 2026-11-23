'use client';
import { gerarReferenciaPedido, gerarTituloPedido, tituloFoiPersonalizado, resolverTextoSugerido } from '@/lib/pedidoTitulos';
import { getNormativeReferences, normasForamPersonalizadas } from '@/lib/normasReferencia';
import { ClientSelector } from '@/components/clients/ClientSelector';
import { clientDisplayName } from '@/lib/clientSelection';

import { showToast, requestConfirm, requestText } from '@/components/ui/Feedback';

import { useNavigationScroll } from '@/lib/useNavigationScroll';
import { useNavigation } from '@/components/NavigationSession';
import React, { useState, useMemo } from 'react';
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
  SecoesPadraoEmpresa,
  EmpresaAtendida,
  MarcaTecnologia,
  CommercialProposalData,
  ModalidadeComercial,
  FreteInfo,
  ImpostosAdicionaisInfo,
} from '@/lib/types';
import { PEDIDO_TIPO_LABELS, PEDIDO_TIPO_ORDER, DEFAULT_DOC_BY_PEDIDO_TIPO } from '@/lib/documentos';
import { numeracaoSecoesProposta, numeracaoSecoesOrcamento } from '@/lib/numeracaoSecoesEditor';
import { MODALIDADE_LABELS, MODALIDADE_ORDER, FRETE_MODO_LABELS, IMPOSTO_MODO_LABELS, OBS_DISPONIBILIDADE } from '@/lib/fornecimentoComercial';
import { AREAS_PROPOSTA, TIPOS_SERVICO, conclusaoPorTipo, presetPorTipo } from '@/lib/propostaTitulo';
import { SecaoDocKey, SECAO_KEYS, SECAO_TITULO, alternarSecao, atualizarPadraoEmpresa, flagDaSecao, igualAoPadrao, mesmasSecoes, moverSecao, normalizarSecoes, ordenarSecoes, padraoEmpresaDoTipo, padraoReferenciaDoTipo, secoesPadraoDoTipo, secoesSelecionadas } from '@/lib/documentoSecoes';
import { CARTA_APRESENTACAO } from '@/lib/propostaTextos';
import { SECOES_TEXTO, servicosOfertadosPadrao, restaurarSecaoLista, fonteDaSecaoLista, fonteServicos } from '@/lib/propostaMaterializacao';
import { normalizeUnitCode } from '@/lib/commercialUnits';
import { calculateCommercialProposalTotals } from '@/lib/commercialTotals';
import { CommercialWarranty, StructuredWarranty, WarrantyLeg, WarrantyMode, defaultWarranty, defaultWarrantyMaterial, GARANTIA_MATERIAL_PADRAO, normalizeCommercialWarranty, isLegacyWarranty, isStructuredWarranty, renderWarranty, legText } from '@/lib/commercialWarranty';
import { COMMERCIAL_SCHEMA_VERSION } from '@/lib/commercialProposal';
import { ItensCardEditor } from '@/components/proposta/ItensCardEditor';
import { MaximizableCard, maxCardCls } from '@/components/proposta/MaximizableCard';
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
  onSave: (pedido: Pedido) => void | Promise<void>;
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
  /** Emite o documento do Pedido (obedece ao Tipo de Pedido). Chamado após salvar. */
  onEmit?: (pedido: Pedido) => void | Promise<void>;
  /** Próximo número sequencial para novas propostas (default do campo). */
  nextProposalNumber?: number;
  /** Padrão de seções por tipo salvo pela empresa (company_profile.secoes_padrao). */
  secoesPadraoEmpresa?: SecoesPadraoEmpresa;
  /** Perfil pode salvar/restaurar o padrão da empresa (ADMINISTRATIVO/GESTOR). */
  podeSalvarPadraoSecoes?: boolean;
  /** Persiste o novo mapa de padrões da empresa (lança erro se falhar). */
  onSalvarPadraoSecoes?: (mapa: SecoesPadraoEmpresa) => Promise<void>;
  /** Opções de geração do PDF (Conta → PDF) que afetam a numeração exibida nos cards. */
  opcoesPdf?: { showCarta?: boolean; showHistorico?: boolean };
}

const inputCls =
  'w-full border border-border-strong rounded-lg px-2.5 py-2 text-fg text-xs focus:outline-none focus:ring-2 focus:ring-[#0B1E38]/20 focus:border-navy/40';
const labelCls = 'block text-fg-secondary font-bold uppercase text-[11px] mb-1';

/* ------------------------- componentes de módulo ------------------------- */

// Sanfona: cabeçalho clicável + corpo colapsável. Definida no módulo para os
// inputs internos não perderem o foco a cada render.
/** Marcador discreto Padrão Fireowl × Personalizado por seção (ETAPA 2). */
const FonteBadge: React.FC<{ fonte: 'padrao' | 'personalizado' }> = ({ fonte }) => (
  <span
    className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full shrink-0 ${
      fonte === 'personalizado'
        ? 'bg-amber-50 text-amber-700 border border-amber-200'
        : 'bg-surface-3 text-fg-secondary border border-border'
    }`}
  >
    {fonte === 'personalizado' ? 'Personalizado' : 'Padrão Fireowl'}
  </span>
);

const Accordion: React.FC<{
  title: string;
  icon?: React.ReactNode;
  /** undefined = sem escolha do usuário: segue o Sim/Não do documento (ou recolhido). */
  open: boolean | undefined;
  onToggle: (atual: boolean) => void;
  badge?: React.ReactNode;
  /** Seção do documento: Sim/Não direto no título (fonte de secoesDocumento).
   * Em "Não" o card fica apagado, mas continua editável. */
  doc?: { on: boolean; set: (on: boolean) => void; up?: () => void; down?: () => void; numero?: string };
  children: React.ReactNode;
}> = ({ title, icon, open: openProp, onToggle: onToggleProp, badge, doc, children }) => {
  const inativo = doc ? !doc.on : false;
  // Visão ampla: seções ativas no documento abertas para leitura; desativadas recolhidas.
  const open = openProp ?? (doc ? doc.on : false);
  const onToggle = () => onToggleProp(open);
  return (
    <MaximizableCard title={title}>
      {({ max, everMax, button, titleId }) => {
        // Ampliado: conteúdo sempre visível (sem alterar o estado aberto/recolhido).
        // Depois de ampliado uma vez, o corpo fica montado (oculto) para não perder estado.
        const visivel = open || max;
        return (
    <div className={`rounded-xl border overflow-hidden ${inativo ? 'bg-surface-2 border-dashed border-border-strong' : 'bg-surface border-border shadow-sm'} ${max ? maxCardCls : ''}`}>
      <div className={`flex items-center transition-colors shrink-0 ${max ? 'border-b border-border' : 'hover:bg-surface-2'}`}>
        <button
          type="button"
          onClick={max ? undefined : onToggle}
          className={`flex-1 min-w-0 flex items-center gap-2.5 pl-3.5 pr-2 py-2.5 text-left ${max ? 'cursor-default' : ''} ${inativo ? 'opacity-50' : ''}`}
        >
          {doc?.numero && (
            <span title="Número desta seção no PDF" className="font-data-mono text-[11px] font-bold leading-none px-1.5 py-1 rounded bg-navy-3 text-white shrink-0">{doc.numero}</span>
          )}
          {icon}
          <span id={titleId} className={`flex-1 min-w-0 truncate font-bold uppercase text-sm ${inativo ? 'text-fg-muted' : 'text-primary'}`}>{title}</span>
          {badge}
        </button>
        {doc && (doc.up || doc.down) && (
          <div className="flex shrink-0 mr-1.5 rounded-md border border-border overflow-hidden" aria-label={`Posição de ${title} no documento`}>
            <button type="button" onClick={doc.up} disabled={!doc.up} title="Subir no documento" className="px-1.5 py-1 text-[10px] leading-none text-fg-muted hover:text-primary hover:bg-surface-2 disabled:opacity-25 disabled:hover:bg-transparent">▲</button>
            <button type="button" onClick={doc.down} disabled={!doc.down} title="Descer no documento" className="px-1.5 py-1 text-[10px] leading-none text-fg-muted hover:text-primary hover:bg-surface-2 border-l border-border disabled:opacity-25 disabled:hover:bg-transparent">▼</button>
          </div>
        )}
        {doc && (
          <div role="radiogroup" aria-label={`${title}: aparece no documento`} title="Aparece no documento?" className="flex shrink-0 rounded-md border border-border overflow-hidden">
            <button type="button" role="radio" aria-checked={doc.on} onClick={() => !doc.on && doc.set(true)} className={`text-[10px] font-bold uppercase px-2.5 py-1 ${doc.on ? 'bg-success-soft text-success' : 'bg-surface text-fg-muted hover:text-fg-secondary'}`}>Sim</button>
            <button type="button" role="radio" aria-checked={!doc.on} onClick={() => doc.on && doc.set(false)} className={`text-[10px] font-bold uppercase px-2.5 py-1 border-l border-border ${!doc.on ? 'bg-surface-3 text-fg-secondary' : 'bg-surface text-fg-muted hover:text-fg-secondary'}`}>Não</button>
          </div>
        )}
        {!max && (
          <button type="button" onClick={onToggle} aria-label={open ? 'Recolher' : 'Expandir'} aria-expanded={open} className="px-2 py-2.5 shrink-0">
            <ChevronDown className={`w-4 h-4 text-fg-muted transition-transform ${open ? '' : '-rotate-90'}`} />
          </button>
        )}
        <span className={max ? 'px-2' : 'pr-1.5'}>{button}</span>
      </div>
      {(visivel || everMax) && (
        <div className={`${max ? 'flex-1 min-h-0 overflow-y-auto p-4' : 'px-3.5 pb-3.5 pt-2.5 border-t border-border'} ${visivel ? '' : 'hidden'} ${inativo ? 'opacity-60 focus-within:opacity-100' : ''}`}>{children}</div>
      )}
    </div>
        );
      }}
    </MaximizableCard>
  );
};

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
    {items.length === 0 && <p className="text-[11px] text-fg-muted italic">Nenhum item adicionado.</p>}
    {items.map((it, idx) => (
      <div key={idx} className="flex items-center gap-2">
        {numbered && <span className="font-bold text-fg-muted font-data-mono text-xs w-5 shrink-0">{idx + 1}.</span>}
        <input type="text" value={it} onChange={(e) => onUpdate(idx, e.target.value)} className={`flex-1 ${inputCls}`} />
        <button
          type="button"
          onClick={() => onRemove(idx)}
          className="p-1.5 text-fg-muted hover:text-danger hover:bg-red-50 rounded-lg transition-colors shrink-0"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    ))}
    <button
      type="button"
      onClick={onAdd}
      className="w-full py-2 rounded-lg border border-dashed border-navy/40 text-[11px] font-semibold text-primary hover:bg-navy-3/5 transition-colors flex items-center justify-center gap-1 uppercase"
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
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border border-dashed border-border-strong text-fg-secondary hover:border-navy hover:text-primary transition-colors"
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
        className="mt-6 p-2 text-fg-muted hover:text-danger hover:bg-red-50 rounded-lg transition-colors shrink-0"
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
            on ? 'bg-navy-3 text-white border-navy' : 'bg-surface text-fg-secondary border-border-strong hover:border-navy'
          }`}
        >
          {on && <Check className="w-3 h-3" />}
          {o}
        </button>
      );
    })}
  </div>
);

/** Seções que têm card de edição no editor (as demais ficam em "Outras seções"). */
const CARDS_SECAO: SecaoDocKey[] = [
  'carta', 'visao', 'normas', 'escopo', 'premissas', 'incluso', 'servicos', 'responsabilidades', 'entregaveis',
  'embalagem', 'seguranca', 'obrigacoes', 'precos', 'impostos', 'pagamento', 'multas', 'limitacao', 'garantia',
  'confidencialidade', 'termoAceite', 'condicoesGerais', 'conclusao',
];
/** Seções sem card próprio: Sim/Não numa linha compacta acima dos cards. */
const SECOES_SEM_CARD: SecaoDocKey[] = ['historico', 'infoCompra', 'prazo', 'validade', 'aceite'];

/**
 * Conteúdo pré-preenchido de um pedido NOVO. O tipo "Personalizado" começa do
 * zero: ao escolhê-lo num pedido novo, os campos que ainda têm este texto são
 * esvaziados (o que o usuário já digitou é preservado).
 */
const PADRAO_NOVO = {
  objetivo: 'Prestação de serviços técnicos especializados de engenharia para fornecimento, manutenção e testes de sistemas de segurança e alarme de incêndio (SDAI).',
  escopo: 'Inspeção física, ensaios funcionais e manutenção preventiva nos laços de detecção, verificação de centrais e comissionamento com emissão de laudo e ART.',
  entregaveis: [
    'Relatório Diário de Obra (RDO) e Checklist de Testes Normativos',
    'Anotação de Responsabilidade Técnica (ART CREA-PR) registrada',
    'Manual As-Built e cadastro de pontos atualizado',
  ],
  premissas: [
    'Acesso livre e desembaraçado às áreas de intervenção técnica',
    'Acompanhamento do responsável de segurança do cliente durante os testes sonoros',
  ],
  respContratada: ['Fornecer equipe qualificada, EPIs, ferramentas calibradas e emitir laudo ART'],
  respContratante: [
    'Liberar acessos e autorizações de trabalho no ambiente',
    'Garantir ponto de energia elétrica 220V e sinal telefônico/dados',
  ],
  prazo: '10 dias úteis após autorização formal de início',
  conclusao: 'Permanecemos à disposição para eventuais esclarecimentos adicionais e renovamos nossos votos de estima.',
  impostos: 'Inclusos, Simples Nacional (Anexo III)',
  formasPagamento: ['Pix'],
  condicoesPagamento: ['30% no aceite / 70% na entrega e laudo'],
};

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
    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border hover:bg-surface-2 text-left transition-colors"
  >
    <span
      className={`w-5 h-5 rounded flex items-center justify-center shrink-0 border-2 ${
        checked ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-border-strong text-transparent'
      }`}
    >
      <Check className="w-3.5 h-3.5" />
    </span>
    <span className="flex-1">
      <span className="text-xs font-semibold text-fg block">{label}</span>
      {hint && <span className="text-[10px] text-fg-muted">{hint}</span>}
    </span>
    <span className={`text-[10px] font-bold uppercase ${checked ? 'text-emerald-600' : 'text-fg-muted'}`}>
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
  onEmit,
  nextProposalNumber = 249,
  secoesPadraoEmpresa,
  podeSalvarPadraoSecoes = false,
  onSalvarPadraoSecoes,
  opcoesPdf,
}) => {
  // ETAPA 2 — materialização de textos. Uma proposta é NOVA quando não traz um
  // registro `proposal` anterior; nesse caso os textos-padrão são copiados para
  // os campos editáveis (visíveis antes do PDF). Propostas históricas mostram o
  // texto padrão para leitura, mas só o gravam após ação do usuário (textosTouched).
  const scrollRef = useNavigationScroll('pedido:' + initialPedido?.id, isOpen && !!initialPedido);
  const initialProposal = initialPedido?.proposal;
  const ehNovaProposta = !initialProposal;
  const jaMaterializada = !!initialProposal?.textosMaterializados;
  // Texto inicial de um campo: pedido Personalizado respeita o vazio gravado
  // (não reinjeta o texto padrão); os demais mantêm o comportamento histórico.
  const iniTexto = (stored: string | undefined, padrao: string) =>
    initialProposal?.pedidoTipo === 'personalizado' ? stored ?? padrao : stored || padrao;

  // Sanfonas abertas. Só guarda o que o usuário alternou ("k" = aberto, "-k" = recolhido).
  // Sem escolha do usuário: cards de seção do documento seguem o Sim/Não (Sim = aberto
  // para leitura, Não = recolhido); os demais usam ABERTOS_PADRAO. Ver Accordion.
  const { state: navigation, update: navigate } = useNavigation();
  const ABERTOS_PADRAO: Record<string, boolean> = { basicas: true, estrutura: true };
  const open: Record<string, boolean | undefined> = { ...ABERTOS_PADRAO };
  for (const raw of (navigation.secoes || '').split(',')) {
    const key = raw.trim();
    if (!key || key === 'nenhuma') continue;
    if (key.startsWith('-')) open[key.slice(1)] = false;
    else open[key] = true;
  }
  /** Alterna um card; `atual` = estado exibido (inclui o padrão pelo Sim/Não). */
  const toggle = (k: string, atual?: boolean) => {
    const next = { ...open, [k]: !(atual ?? open[k] ?? false) };
    navigate({ secoes: Object.entries(next).filter(([, v]) => v !== undefined).map(([key, v]) => (v ? key : '-' + key)).join(',') || 'nenhuma' });
  };
  // Card "Informações do Pedido" na visão ampla: resumo (só o preenchido) x formulário.
  // null = automático (pedido existente e completo abre como resumo). Ver infoCompleta.
  const [infoResumo, setInfoResumo] = useState<boolean | null>(null);
  const abrirSecao = (k: string) => {
    if (k === 'pedido') setInfoResumo(false);
    else if (!open[k]) toggle(k, false);
  };

  // ----------------- estado do formulário -----------------
  const [numeroPedido, setNumeroPedido] = useState<string>(
    initialPedido?.numeroPedido || `PED-${new Date().getFullYear()}-${nextProposalNumber}`
  );
  const [referenciaManual, setReferenciaManual] = useState<string | null>(() => initialPedido?.proposal?.referenciaEditadaManualmente === false ? null : initialPedido?.proposal?.referenciaEditadaManualmente === true ? initialPedido.referencia : initialPedido?.referencia || null);
  const [tituloManual, setTituloManual] = useState<string | null>(() => initialPedido && tituloFoiPersonalizado(initialPedido.proposal) ? initialPedido.proposal.tituloManual ?? '' : null);
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
  const [pedidoTipo, setPedidoTipo] = useState<PedidoTipo | ''>(initialPedido?.proposal?.pedidoTipo || '');
  // Modalidade comercial (natureza). Ausente = fluxo histórico (Material + Serviço).
  const [modalidade, setModalidade] = useState<ModalidadeComercial>(initialPedido?.proposal?.modalidade || 'material_servico');
  const [frete, setFrete] = useState<FreteInfo>(initialPedido?.proposal?.frete || { modo: 'incluso' });
  const [impostosAdicionais, setImpostosAdicionais] = useState<ImpostosAdicionaisInfo>(initialPedido?.proposal?.impostosAdicionais || { modo: 'inclusos' });
  const [observacoesComerciais, setObservacoesComerciais] = useState<string>(initialPedido?.proposal?.observacoesComerciais || '');
  const somenteMaterial = modalidade === 'somente_material';
  const contextoTitulo = { areaPrincipal, tipoServico, pedidoTipo: pedidoTipo || undefined, modalidade };
  const referencia = resolverTextoSugerido(gerarReferenciaPedido(contextoTitulo), referenciaManual);
  const tituloDinamico = resolverTextoSugerido(gerarTituloPedido(contextoTitulo), tituloManual);
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
    iniTexto(initialPedido?.proposal?.objetivo, PADRAO_NOVO.objetivo)
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

  // Normas de referência: sugeridas por Área + Serviço (fonte única em
  // [[lib/normasReferencia]]); null = automático, lista = edição manual preservada.
  const [diretrizesManual, setDiretrizesManual] = useState<string[] | null>(() => initialPedido && normasForamPersonalizadas(initialPedido.proposal) ? initialPedido.proposal.diretrizesNormativas || [] : null);
  const diretrizes = diretrizesManual ?? getNormativeReferences(contextoTitulo);
  const setDiretrizes: React.Dispatch<React.SetStateAction<string[]>> = (action) =>
    setDiretrizesManual((prev) => (typeof action === 'function' ? action(prev ?? getNormativeReferences(contextoTitulo)) : action));
  const [escopoServico, setEscopoServico] = useState<string>(
    iniTexto(initialPedido?.proposal?.escopoServico, PADRAO_NOVO.escopo)
  );
  const [entregaveis, setEntregaveis] = useState<string[]>(
    initialPedido?.proposal?.entregaveis || PADRAO_NOVO.entregaveis
  );
  const [equipmentItems, setEquipmentItems] = useState<PedidoEquipmentItem[]>(
    initialPedido?.proposal?.equipmentItems || []
  );
  const [marcas] = useState<PedidoBrand[]>(initialPedido?.proposal?.marcas || []);
  const [premissas, setPremissas] = useState<string[]>(
    initialPedido?.proposal?.premissas || PADRAO_NOVO.premissas
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
    initialPedido?.proposal?.responsabilidadesContratada || PADRAO_NOVO.respContratada
  );
  const [respContratante, setRespContratante] = useState<string[]>(
    initialPedido?.proposal?.responsabilidadesContratante || PADRAO_NOVO.respContratante
  );
  const [prazoExecucao, setPrazoExecucao] = useState<string>(
    iniTexto(initialPedido?.proposal?.prazoExecucao, PADRAO_NOVO.prazo)
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
      <div className="rounded-xl border border-border bg-surface p-3">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input type="checkbox" checked={leg.enabled} onChange={(e) => updWarrantyLeg(key, { enabled: e.target.checked })} className="w-4 h-4 accent-emerald-600" />
          <span className="text-sm font-bold text-fg">{title}</span>
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
        <p className="text-[10px] text-fg-muted mt-1.5">{leg.enabled ? (preview ? `No PDF: “${preview}”` : 'Selecione um prazo ou texto — perna ativa sem condição não aparece.') : 'Sem garantia informada — não aparece no PDF.'}</p>
      </div>
    );
  };
  const [validadeDias, setValidadeDias] = useState<number>(initialPedido?.proposal?.validadePropostaDias || 15);
  const [validadeComplemento, setValidadeComplemento] = useState<string>(
    initialPedido?.proposal?.validadePropostaComplemento || 'dias corridos a partir da emissão'
  );
  const [conclusao, setConclusao] = useState<string>(
    iniTexto(initialPedido?.proposal?.conclusao, PADRAO_NOVO.conclusao)
  );
  const [faturamento, setFaturamento] = useState<string>(initialPedido?.proposal?.faturamento || '');
  const [impostos, setImpostos] = useState<string>(iniTexto(initialPedido?.proposal?.impostos, PADRAO_NOVO.impostos));

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
      <Accordion title={opts.titulo} icon={opts.icon} doc={docSecao(opts.fonteKey as SecaoDocKey)} open={open[opts.openKey]} onToggle={(atual) => toggle(opts.openKey, atual)} badge={<FonteBadge fonte={fonte} />}>
        <div className="flex justify-end mb-2">
          <button type="button" onClick={() => restaurarPadraoSecao(opts.campo)} className="text-[10px] font-bold uppercase text-fg-muted hover:text-primary inline-flex items-center gap-1">
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
  const [formasPagamento, setFormasPagamento] = useState<string[]>(initialPedido?.proposal?.formasPagamento || PADRAO_NOVO.formasPagamento);
  const [condicoesPagamento, setCondicoesPagamento] = useState<string[]>(
    initialPedido?.proposal?.condicoesPagamento || PADRAO_NOVO.condicoesPagamento
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
  // Pedido antigo com mão de obra gravada: mantém o campo visível (recurso retirado da tela).
  const maoDeObraLegado = (initialPedido?.proposal?.maoDeObra ?? 0) > 0;
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

  // Card "Valores" retirado da tela (não usado). Continua em Somente Material (frete e
  // impostos adicionais só existem nele) e em pedido antigo que já usa mão de obra,
  // contrato recorrente ou valor total manual — para esses valores não ficarem invisíveis.
  const [valorCardLegado] = useState(() => maoDeObraLegado || !!initialPedido?.proposal?.recorrente || manualValorTotal !== null);

  // §15 — Contrato recorrente (valor mensal / anual / vigência).
  const [recorrente, setRecorrente] = useState<boolean>(initialPedido?.proposal?.recorrente ?? false);
  const [valorMensal, setValorMensal] = useState<number>(initialPedido?.proposal?.valorMensal ?? 0);
  const [vigenciaMeses, setVigenciaMeses] = useState<number>(initialPedido?.proposal?.vigenciaMeses ?? 12);

  // ----------------- seções do documento (todos os tipos) -----------------
  // Fonte única: o Sim/Não no título de cada card (e "Também no documento").
  // null = sem seleção própria → padrão do SISTEMA para o tipo (pedido antigo
  // gera exatamente como antes). Ver [[lib/documentoSecoes]].
  const [secoesDocumento, setSecoesDocumento] = useState<string[] | null>(initialProposal?.secoesDocumento ?? null);
  const flagsSecoes = { incluirSeguranca, incluirMultas, incluirLimitacao, incluirConfidencialidade, incluirTermoAceite, incluirCondicoesGerais };
  const secoesPadraoSistema = secoesPadraoDoTipo(pedidoTipo, flagsSecoes);
  const secoesAtivas = secoesDocumento ? normalizarSecoes(secoesDocumento) : secoesPadraoSistema;
  const secaoOn = (key: SecaoDocKey) => secoesAtivas.includes(key);
  // Ordem dos cards de seção no editor = ordem do documento (setas ▲▼ no título).
  // As listas de Materiais/Serviços ficam no topo (só Sim/Não, sem setas).
  const ordemCards: SecaoDocKey[] = somenteMaterial ? ['pagamento', 'garantia'] : ordenarSecoes(CARDS_SECAO, ordemSecoes);
  const cardsMoveis: SecaoDocKey[] = ordemCards.filter((k) => k !== 'carta');
  const moverCard = (key: SecaoDocKey, dir: -1 | 1) => setOrdemSecoes(moverSecao(ordemSecoes, key, dir, cardsMoveis));
  // Sim/Não (e ▲▼) no título de cada card. Somente Material tem estrutura própria.
  const docSecao = (key: SecaoDocKey) => {
    if (somenteMaterial) return undefined;
    const i = cardsMoveis.indexOf(key);
    return {
      on: secaoOn(key),
      // Nº da seção no PDF (Materiais e Serviços saem juntos na seção "itens").
      numero: numeroPdf[key === 'itensServicos' ? 'itens' : key],
      set: (on: boolean) => setSecao(key, on),
      up: i > 0 ? () => moverCard(key, -1) : undefined,
      down: i >= 0 && i < cardsMoveis.length - 1 ? () => moverCard(key, 1) : undefined,
    };
  };
  // Gravado no pedido só quando difere do padrão do sistema (Personalizado: sempre).
  const secoesSaoPersonalizadas = !!secoesDocumento && !igualAoPadrao(secoesDocumento, pedidoTipo, flagsSecoes);
  // Padrão da EMPRESA por tipo (0122): referência para "Salvar como novo padrão".
  const [padraoEmpresa, setPadraoEmpresa] = useState<SecoesPadraoEmpresa>(secoesPadraoEmpresa || {});
  const padraoEmpresaTipo = padraoEmpresaDoTipo(pedidoTipo, padraoEmpresa);
  const padraoReferencia = padraoReferenciaDoTipo(pedidoTipo, padraoEmpresa, flagsSecoes);
  const difereDoPadrao = !mesmasSecoes(secoesAtivas, padraoReferencia);
  const [salvandoPadrao, setSalvandoPadrao] = useState(false);
  const FLAG_SETTERS: Record<string, (b: boolean) => void> = {
    incluirSeguranca: setIncluirSeguranca,
    incluirMultas: setIncluirMultas,
    incluirLimitacao: setIncluirLimitacao,
    incluirConfidencialidade: setIncluirConfidencialidade,
    incluirTermoAceite: setIncluirTermoAceite,
    incluirCondicoesGerais: setIncluirCondicoesGerais,
  };
  const setSecao = (key: SecaoDocKey, ligar: boolean) => {
    const flag = flagDaSecao(key);
    if (flag) FLAG_SETTERS[flag](ligar);
    setSecoesDocumento(alternarSecao(secoesAtivas, key, ligar));
  };
  // Aplica uma seleção inteira (padrão do tipo), mantendo as flags coerentes.
  const aplicarSelecao = (lista: string[] | null) => {
    if (lista) for (const k of SECAO_KEYS) { const flag = flagDaSecao(k); if (flag) FLAG_SETTERS[flag](lista.includes(k)); }
    setSecoesDocumento(lista ? [...lista] : null);
  };
  const persistirPadraoEmpresa = async (novo: SecoesPadraoEmpresa, msgOk: string): Promise<boolean> => {
    if (!onSalvarPadraoSecoes) return false;
    setSalvandoPadrao(true);
    try {
      await onSalvarPadraoSecoes(novo);
      setPadraoEmpresa(novo);
      showToast(msgOk);
      return true;
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Não foi possível salvar o padrão.');
      return false;
    } finally {
      setSalvandoPadrao(false);
    }
  };
  const salvarComoPadrao = async () => {
    if (!pedidoTipo) return;
    const nome = PEDIDO_TIPO_LABELS[pedidoTipo];
    if (!await requestConfirm(`Salvar esta seleção como novo padrão de "${nome}"? Todo pedido NOVO desse tipo já virá assim, para todos os usuários. Pedidos existentes não mudam.`)) return;
    await persistirPadraoEmpresa(atualizarPadraoEmpresa(padraoEmpresa, pedidoTipo, secoesAtivas), `Novo padrão de "${nome}" salvo.`);
  };
  // Restaurar padrão: descarta o padrão salvo da empresa (quando há e o perfil
  // pode) e volta as linhas à configuração original do sistema para o tipo.
  const restaurarPadrao = async () => {
    if (!pedidoTipo) return;
    const nome = PEDIDO_TIPO_LABELS[pedidoTipo];
    // Sem permissão para mexer no padrão da empresa: volta ao padrão salvo dela.
    if (padraoEmpresaTipo && !podeSalvarPadraoSecoes) {
      aplicarSelecao(padraoEmpresaTipo);
      return;
    }
    if (padraoEmpresaTipo && podeSalvarPadraoSecoes) {
      if (!await requestConfirm(`Descartar o padrão salvo de "${nome}" e voltar à configuração original do sistema? Vale para os próximos pedidos desse tipo.`)) return;
      const ok = await persistirPadraoEmpresa(atualizarPadraoEmpresa(padraoEmpresa, pedidoTipo, null), `Padrão original de "${nome}" restaurado.`);
      if (!ok) return;
    }
    aplicarSelecao(secoesPadraoDoTipo(pedidoTipo));
    setSecoesDocumento(null);
  };

  // Personalizado começa do zero: esvazia o que ainda é texto pré-preenchido.
  const limparPreenchimentoPadrao = () => {
    const igual = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
    if (objetivo === PADRAO_NOVO.objetivo) setObjetivo('');
    if (escopoServico === PADRAO_NOVO.escopo) setEscopoServico('');
    if (igual(entregaveis, PADRAO_NOVO.entregaveis)) setEntregaveis([]);
    if (igual(premissas, PADRAO_NOVO.premissas)) setPremissas([]);
    if (igual(respContratada, PADRAO_NOVO.respContratada)) setRespContratada([]);
    if (igual(respContratante, PADRAO_NOVO.respContratante)) setRespContratante([]);
    if (prazoExecucao === PADRAO_NOVO.prazo) setPrazoExecucao('');
    if (conclusao === PADRAO_NOVO.conclusao) setConclusao('');
    if (impostos === PADRAO_NOVO.impostos) setImpostos('');
    if (igual(formasPagamento, PADRAO_NOVO.formasPagamento)) setFormasPagamento([]);
    if (igual(condicoesPagamento, PADRAO_NOVO.condicoesPagamento)) setCondicoesPagamento([]);
    if (cartaApresentacao === CARTA_APRESENTACAO.join('\n')) setCartaApresentacao('');
    if (diretrizesManual === null) setDiretrizesManual([]);
    if (igual(warranty, defaultWarranty()) && isStructuredWarranty(warranty)) {
      setWarranty({ ...warranty, maoDeObra: { ...warranty.maoDeObra, enabled: false }, materiais: { ...warranty.materiais, enabled: false } });
    }
    setSecoesTexto((m) => {
      const o = { ...m };
      for (const sec of SECOES_TEXTO) if (igual(o[sec.campo], sec.padrao())) o[sec.campo] = [];
      return o;
    });
    if (igual(servicosOfertados, servicosOfertadosPadrao())) setServicosOfertados([]);
    setTextosTouched(true);
  };

  // Troca de tipo: as linhas da Estrutura voltam ao padrão do novo tipo (o da
  // empresa quando salvo, senão o do sistema).
  const handleTipoChange = (t: PedidoTipo | '') => {
    setPedidoTipo(t);
    aplicarSelecao(padraoEmpresaDoTipo(t, padraoEmpresa));
    if (t === 'personalizado' && ehNovaProposta) limparPreenchimentoPadrao();
  };

  // Cadastro rápido de cliente (dialog sobreposto).
  const [newClientOpen, setNewClientOpen] = useState(false);
  const [ncName, setNcName] = useState('');
  const [ncCnpj, setNcCnpj] = useState('');
  const [ncEmail, setNcEmail] = useState('');
  const [ncPhone, setNcPhone] = useState('');
  const [ncSegment, setNcSegment] = useState('');

  const selectedClient = clients.find((c) => c.id === clienteId) || clients[0];

  // Subtotal = soma dos itens (materiais e/ou serviços). Mão de obra é opcional
  // (0 por padrão); o botão "Sugerir 70/30" preenche pela regra material 30% /
  // mão de obra 70% quando a proposta for de fornecimento com instalação.
  // Fonte ÚNICA de cálculo (mesma do PDF). Ver [[lib/commercialTotals]].
  const totals = calculateCommercialProposalTotals({
    equipmentItems,
    maoDeObra,
    valorTotalManual: manualValorTotal,
    frete: somenteMaterial ? frete : undefined,
    impostosAdicionais: somenteMaterial ? impostosAdicionais : undefined,
    onlyMaterials: somenteMaterial,
  });
  const subtotalItens = totals.itemsSubtotal;
  const valorBase = totals.calculatedTotal;
  const effectiveValorTotal = totals.finalTotal;

  // Separa os itens em Materiais (do estoque) e Serviços, mantendo o índice
  // original de cada um no array para os handlers de edição/remoção.
  const materiaisRows = equipmentItems.map((it, idx) => ({ it, idx })).filter((x) => x.it.tipo !== 'servico');
  const servicosRows = equipmentItems.map((it, idx) => ({ it, idx })).filter((x) => x.it.tipo === 'servico');

  // Troca de modalidade. NUNCA apaga dados em silêncio: ao entrar em SOMENTE
  // MATERIAL com serviços cadastrados, alerta (os serviços ficam preservados,
  // fora do documento, e voltam a contar se a modalidade mudar de novo). Ao
  // entrar em material-only, sugere a garantia de fornecimento quando a garantia
  // atual ainda é a padrão de serviço (90/12) ou está vazia — sem sobrescrever
  // texto que o usuário tenha personalizado.
  const handleModalidadeChange = async (next: ModalidadeComercial) => {
    if (next === modalidade) return;
    if (next === 'somente_material' && servicosRows.length > 0) {
      const ok = await requestConfirm(
        `Este pedido tem ${servicosRows.length} serviço(s) cadastrado(s). Em "Somente Material" eles não serão exibidos nem somados ao total (permanecem salvos e voltam se você mudar a modalidade). Deseja continuar?`
      );
      if (!ok) return;
    }
    if (next === 'somente_material') {
      const padraoServico = isStructuredWarranty(warranty) && warranty.maoDeObra.enabled && warranty.materiais.enabled && !warranty.observacoes;
      const garantiaVazia = !renderWarranty(warranty).hasAny;
      if (padraoServico || garantiaVazia) setWarranty(defaultWarrantyMaterial());
      if (!pedidoTipo) setPedidoTipo('fornecimento');
    }
    setModalidade(next);
  };

  // Área(s) da proposta → código(s) de categoria do estoque (para o seletor
  // inteligente de materiais). Áreas sem mapeamento não restringem o catálogo.
  const materialAreaCodes = useMemo(() => {
    const MAP: Record<string, string> = { sdai: 'SDAI', cftv: 'CFTV', alarme: 'ALARME', bms: 'BMS', acesso: 'CONTROLE_ACESSO' };
    return Array.from(new Set(areaPrincipal.map((id) => MAP[id]).filter(Boolean)));
  }, [areaPrincipal]);

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
        tituloManual: tituloDinamico,
        tituloEditadoManualmente: tituloManual !== null,
        referenciaEditadaManualmente: referenciaManual !== null,
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
        // Seleção explícita só quando difere do padrão do tipo (pedido "não
        // personalizado" continua gerando pelo caminho histórico). Personalizado
        // grava a lista sempre (começa vazia).
        secoesDocumento: secoesSaoPersonalizadas || pedidoTipo === 'personalizado' ? [...secoesAtivas] : undefined,
        modalidade,
        // Frete/impostos só fazem sentido no fornecimento; nas demais modalidades
        // não gravamos (mantém pedidos de serviço idênticos ao histórico).
        frete: somenteMaterial ? frete : undefined,
        impostosAdicionais: somenteMaterial ? impostosAdicionais : undefined,
        observacoesComerciais: somenteMaterial ? (observacoesComerciais.trim() || undefined) : (initialProposal?.observacoesComerciais),
        diretrizesNormativas: diretrizes,
        diretrizesEditadasManualmente: diretrizesManual !== null,
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
  // Validação: dados mínimos comuns a salvar-para-emitir e emitir.
  const validarParaEmissao = (): boolean => {
    if (!selectedClient) {
      showToast('Selecione o Cliente.');
      abrirSecao('pedido');
      return false;
    }
    if (effectiveValorTotal <= 0) {
      showToast('O valor total da proposta deve ser maior que zero.');
      abrirSecao('valor');
      return false;
    }
    return true;
  };
  // §10 — o Tipo de Pedido é a fonte de verdade da emissão. Sem ele, não emite:
  // avisa e leva o usuário ao campo Tipo de Pedido (topo da estruturação).
  const ensureTipoSelecionado = (): boolean => {
    if (!pedidoTipo) {
      showToast('Selecione o Tipo de Pedido antes de emitir o documento.');
      abrirSecao('pedido');
      return false;
    }
    return true;
  };
  const handleSaveWithValidation = (targetStatus: PedidoStatus) => {
    if (targetStatus !== 'rascunho' && !validarParaEmissao()) return;
    onSave(buildCurrentPedido(targetStatus));
    onClose();
  };
  // Salvar e Emitir: valida Tipo + dados, SALVA e só então EMITE o documento do
  // Tipo (sem o modal "Qual documento gerar?"). Se o save falhar, não emite.
  const handleSaveAndEmit = async () => {
    if (!ensureTipoSelecionado()) return;
    if (!validarParaEmissao()) return;
    const built = buildCurrentPedido('enviado_ao_cliente');
    try {
      await onSave(built);
    } catch {
      showToast('Não foi possível salvar o pedido. O documento não foi emitido.');
      return;
    }
    onClose();
    onEmit?.(built);
  };
  // Pré-visualizar: obedece ao Tipo de Pedido (roteado pelo container).
  const handlePreview = () => {
    if (!ensureTipoSelecionado()) return;
    onPreviewPDF(buildCurrentPedido());
  };

  // §5 — rótulo contextual do botão de emissão pelo Tipo de Pedido (quando
  // simples e seguro); caso contrário, neutro "Salvar & Emitir PDF".
  const emitLabel =
    pedidoTipo === 'orcamento' ? 'Salvar & Emitir Orçamento'
    : pedidoTipo === 'proposta' ? 'Salvar & Emitir Proposta'
    : pedidoTipo === 'fornecimento' ? 'Salvar & Emitir Fornecimento'
    : 'Salvar & Emitir PDF';

  // Resumo de "Informações do Pedido": só aparece com os campos essenciais preenchidos.
  const infoCompleta = !!clienteId && !!pedidoTipo && (somenteMaterial || (areaPrincipal.length > 0 && !!tipoServico));
  const mostrarResumoInfo = infoCompleta && (infoResumo ?? !!initialPedido);

  // Numeração das seções exatamente como sai no PDF do documento que este Tipo de Pedido
  // gera (Proposta Comercial ou Orçamento), calculada sobre o pedido como será gravado.
  // Somente Material, Laudo e Personalizado usam outros documentos: sem número.
  const docGerado = !somenteMaterial && pedidoTipo ? DEFAULT_DOC_BY_PEDIDO_TIPO[pedidoTipo] : null;
  const numeroPdf: Record<string, string> = (() => {
    if (docGerado !== 'proposta_comercial' && docGerado !== 'orcamento') return {};
    const pAtual = buildCurrentPedido().proposal;
    if (docGerado === 'orcamento') return numeracaoSecoesOrcamento(pAtual);
    return numeracaoSecoesProposta(pAtual, {
      selecao: secoesSelecionadas(pAtual),
      temMateriais: (pAtual.equipmentItems || []).some((e) => e.tipo !== 'servico'),
      garantiaVisivel: renderWarranty(pAtual.warranty).hasAny,
      showCarta: opcoesPdf?.showCarta,
      showHistorico: opcoesPdf?.showHistorico,
    });
  })();

  const mostrarValorCard = somenteMaterial || valorCardLegado;

  // Cards de seção exibidos na sequência numerada do PDF, com Materiais/Serviços ("itens")
  // na posição em que saem no documento. Seção sem número (desligada/sem conteúdo) fica
  // logo após a vizinha anterior, como no editor. Só muda a exibição.
  type CardGrade = SecaoDocKey | 'itens';
  const cardsNaOrdemDoPdf: CardGrade[] = (() => {
    const base: CardGrade[] = [...ordemCards];
    if (!somenteMaterial) {
      const iEscopo = base.indexOf('escopo');
      base.splice(iEscopo >= 0 ? iEscopo + 1 : 0, 0, 'itens');
    }
    let ultimo = 0;
    return base
      .map((k, i) => {
        const n = Number(numeroPdf[k]) || 0;
        if (n) ultimo = n;
        return { k, rank: n || ultimo + 0.5, i };
      })
      .sort((x, y) => x.rank - y.rank || x.i - y.i)
      .map((x) => x.k);
  })();

  if (!isOpen) return null;

  // Card de valores (renderizado logo após os itens).
  const valorCard = (
    <MaximizableCard title={somenteMaterial ? 'Resumo Financeiro' : 'Valores da Proposta'} tone="dark">
    {({ max, button, titleId }) => (
    <div className={`bg-navy-3 text-white p-4 rounded-xl shadow-sm space-y-3 ${max ? `${maxCardCls} overflow-y-auto` : ''}`}>
      <div className="flex items-center justify-between gap-2">
        <span id={titleId} className="text-[10px] font-bold text-[#F2A900] uppercase tracking-widest">{somenteMaterial ? 'Resumo Financeiro' : 'Valores da Proposta'}</span>
        <span className="flex-1 text-[10px] text-fg-muted text-right">{somenteMaterial ? 'Subtotal + frete + impostos − desconto = total geral.' : ''}</span>
        {button}
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-fg-muted">{somenteMaterial ? 'Subtotal dos produtos' : 'Subtotal dos itens'}</span>
        <span className="font-data-mono font-bold">R$ {(somenteMaterial ? (totals.materialsSubtotal + totals.discountTotal) : subtotalItens).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
      </div>
      {/* Mão de obra / Serviços adicionais: recurso retirado da tela. Só aparece em pedido
          antigo que já tem valor gravado, para o total não incluir um valor invisível. */}
      {!somenteMaterial && maoDeObraLegado && (
      <div className="flex items-center justify-between gap-2">
        <span className="text-fg-muted text-sm" title="Valor de pedido antigo. Zere para remover.">
          Mão de obra / Serviços adicionais
        </span>
        <div className="flex items-center gap-1">
          <span className="text-fg-muted text-xs font-data-mono">R$</span>
          <input
            type="number"
            min={0}
            value={maoDeObra}
            onChange={(e) => setMaoDeObra(e.target.value === '' ? 0 : Number(e.target.value))}
            className="w-32 bg-slate-900 border border-slate-700 rounded p-1.5 text-right font-data-mono font-bold text-amber-300"
          />
        </div>
      </div>
      )}
      {somenteMaterial && (
        <div className="space-y-2.5 border-t border-slate-700 pt-3">
          {totals.discountTotal > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-fg-muted">Desconto (nos itens)</span>
              <span className="font-data-mono font-bold text-red-300">− R$ {totals.discountTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </div>
          )}
          <div className="flex items-center justify-between gap-2">
            <span className="text-fg-muted text-sm">Frete</span>
            <div className="flex items-center gap-1">
              <select
                value={frete.modo}
                onChange={(e) => setFrete((f) => ({ ...f, modo: e.target.value as FreteInfo['modo'] }))}
                className="bg-slate-900 border border-slate-700 rounded p-1.5 text-xs font-bold text-slate-200"
              >
                {(Object.keys(FRETE_MODO_LABELS) as FreteInfo['modo'][]).map((k) => (
                  <option key={k} value={k}>{FRETE_MODO_LABELS[k]}</option>
                ))}
              </select>
              {frete.modo === 'valor' && (
                <input
                  type="number"
                  min={0}
                  value={frete.valor ?? 0}
                  onChange={(e) => setFrete((f) => ({ ...f, valor: e.target.value === '' ? 0 : Number(e.target.value) }))}
                  className="w-28 bg-slate-900 border border-slate-700 rounded p-1.5 text-right font-data-mono font-bold text-amber-300"
                />
              )}
            </div>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-fg-muted text-sm">Impostos adicionais</span>
            <div className="flex items-center gap-1">
              <select
                value={impostosAdicionais.modo}
                onChange={(e) => setImpostosAdicionais((im) => ({ ...im, modo: e.target.value as ImpostosAdicionaisInfo['modo'] }))}
                className="bg-slate-900 border border-slate-700 rounded p-1.5 text-xs font-bold text-slate-200"
              >
                {(Object.keys(IMPOSTO_MODO_LABELS) as ImpostosAdicionaisInfo['modo'][]).map((k) => (
                  <option key={k} value={k}>{IMPOSTO_MODO_LABELS[k]}</option>
                ))}
              </select>
              {impostosAdicionais.modo === 'valor' && (
                <input
                  type="number"
                  min={0}
                  value={impostosAdicionais.valor ?? 0}
                  onChange={(e) => setImpostosAdicionais((im) => ({ ...im, valor: e.target.value === '' ? 0 : Number(e.target.value) }))}
                  className="w-28 bg-slate-900 border border-slate-700 rounded p-1.5 text-right font-data-mono font-bold text-amber-300"
                />
              )}
            </div>
          </div>
        </div>
      )}
      <div className="border-t border-slate-700 pt-3 flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold text-[#F2A900] uppercase tracking-widest flex items-center gap-1.5">
          Valor Total (R$)
          {manualValorTotal !== null && (
            <button
              type="button"
              onClick={() => setManualValorTotal(null)}
              title="Voltar ao total calculado"
              className="text-[9px] font-bold uppercase text-primary bg-[#F2A900] hover:bg-amber-400 rounded px-1.5 py-0.5"
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
      {/* §15 — Contrato recorrente (valor mensal) — não se aplica a fornecimento */}
      {!somenteMaterial && (
      <div className="border-t border-slate-700 pt-3 space-y-2">
        <label className="flex items-center gap-2 text-[10px] font-bold text-fg-muted uppercase tracking-widest cursor-pointer">
          <input type="checkbox" checked={recorrente} onChange={(e) => setRecorrente(e.target.checked)} className="accent-[#F2A900] w-3.5 h-3.5" />
          Contrato recorrente (mensal)
        </label>
        {recorrente && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="block text-[9px] text-fg-muted uppercase mb-1">Valor mensal (R$)</span>
              <input type="number" min={0} value={valorMensal} onChange={(e) => setValorMensal(e.target.value === '' ? 0 : Number(e.target.value))} className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-right font-data-mono font-bold text-amber-300" />
            </div>
            <div>
              <span className="block text-[9px] text-fg-muted uppercase mb-1">Vigência (meses)</span>
              <input type="number" min={1} value={vigenciaMeses} onChange={(e) => setVigenciaMeses(e.target.value === '' ? 0 : Number(e.target.value))} className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-right font-data-mono font-bold text-slate-200" />
            </div>
            {valorMensal > 0 && (
              <p className="col-span-2 text-[10px] text-fg-muted font-data-mono leading-relaxed">
                Anual: R$ {(valorMensal * 12).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                {vigenciaMeses > 0 && <> · Total ({vigenciaMeses} meses): R$ {(valorMensal * vigenciaMeses).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</>}
              </p>
            )}
          </div>
        )}
      </div>
      )}
    </div>
    )}
    </MaximizableCard>
  );

  // Faixa "Salvar como novo padrão / Restaurar padrão" (antes dos cards e na Estrutura).
  const faixaPadrao = pedidoTipo && !somenteMaterial && (difereDoPadrao || (padraoEmpresaTipo && podeSalvarPadraoSecoes)) ? (
    <div className="flex flex-wrap items-center gap-2 mb-2 rounded-lg border border-warning/40 bg-warning-soft px-3 py-2">
      <span className="text-[11px] text-fg-secondary flex-1 min-w-[180px]">
        {difereDoPadrao ? `Esta seleção difere do padrão de ${PEDIDO_TIPO_LABELS[pedidoTipo]}.` : `${PEDIDO_TIPO_LABELS[pedidoTipo]} usa um padrão salvo pela empresa.`}
      </span>
      {difereDoPadrao && podeSalvarPadraoSecoes && onSalvarPadraoSecoes && (
        <button type="button" disabled={salvandoPadrao} onClick={salvarComoPadrao} className="text-[10px] font-bold uppercase px-2.5 py-1 rounded bg-primary text-primary-fg hover:bg-primary-hover disabled:opacity-50">
          Salvar como novo padrão do {PEDIDO_TIPO_LABELS[pedidoTipo]}?
        </button>
      )}
      <button type="button" disabled={salvandoPadrao} onClick={restaurarPadrao} className="text-[10px] font-bold uppercase px-2.5 py-1 rounded border border-border-strong text-fg-secondary hover:text-primary disabled:opacity-50">
        Restaurar padrão
      </button>
    </div>
  ) : null;

  // Seções sem card próprio (Histórico, Pedido de Compra, Prazo, Validade, Aceite):
  // Sim/Não numa linha compacta, sem card.
  const outrasSecoes = somenteMaterial ? null : (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-1 text-[11px]">
      <span className="font-bold uppercase text-fg-muted">Também no documento:</span>
      {SECOES_SEM_CARD.map((k) => {
        const on = secaoOn(k);
        return (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span className={on ? 'text-primary font-semibold' : 'text-fg-muted'}>{numeroPdf[k] ? <b className="font-data-mono">{numeroPdf[k]} </b> : null}{SECAO_TITULO[k]}</span>
            <span role="radiogroup" aria-label={`${SECAO_TITULO[k]}: aparece no documento`} className="inline-flex rounded border border-border overflow-hidden">
              <button type="button" role="radio" aria-checked={on} onClick={() => !on && setSecao(k, true)} className={`text-[9px] font-bold uppercase px-1.5 py-0.5 ${on ? 'bg-success-soft text-success' : 'bg-surface text-fg-muted'}`}>Sim</button>
              <button type="button" role="radio" aria-checked={!on} onClick={() => on && setSecao(k, false)} className={`text-[9px] font-bold uppercase px-1.5 py-0.5 border-l border-border ${!on ? 'bg-surface-3 text-fg-secondary' : 'bg-surface text-fg-muted'}`}>Não</button>
            </span>
          </span>
        );
      })}
    </div>
  );

  // Cards de edição por seção, desenhados na MESMA ordem do documento (setas ▲▼
  // no título reordenam). Somente Material: só Pagamento e Garantia.
  const cardsSecao: Partial<Record<SecaoDocKey, React.ReactNode>> = {
    visao: (
    <>
    <Accordion title="Objetivo da Proposta" doc={docSecao('visao')} icon={<FileText className="w-4 h-4 text-danger" />} open={open.objetivo} onToggle={(atual) => toggle('objetivo', atual)}>
      <textarea rows={3} value={objetivo} onChange={(e) => setObjetivo(e.target.value)} placeholder="Objetivo geral da proposta..." className={inputCls} />
    </Accordion>
    </>
    ),
    carta: (
    <>
    <Accordion
      title="Carta de Apresentação"
      doc={docSecao('carta')}
      icon={<FileText className="w-4 h-4 text-primary" />}
      open={open.carta}
      onToggle={(atual) => toggle('carta', atual)}
      badge={<FonteBadge fonte={cartaApresentacao.split('\n').map((x) => x.trim()).filter(Boolean).join('\n') === CARTA_APRESENTACAO.join('\n') ? 'padrao' : 'personalizado'} />}
    >
      <div className="flex justify-end mb-2">
        <button
          type="button"
          onClick={async () => { if (await requestConfirm('Restaurar o texto padrão da Carta de Apresentação?')) { setCartaApresentacao(CARTA_APRESENTACAO.join('\n')); setTextosTouched(true); } }}
          className="text-[10px] font-bold uppercase text-fg-muted hover:text-primary inline-flex items-center gap-1"
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
      <p className="text-[10px] text-fg-muted mt-1">Aparece na 2ª página do PDF, assinada pelo responsável comercial.</p>
    </Accordion>
    </>
    ),
    normas: (
    <>
    <Accordion title="Diretrizes Normativas" doc={docSecao('normas')} icon={<ShieldCheck className="w-4 h-4 text-emerald-600" />} open={open.diretrizes} onToggle={(atual) => toggle('diretrizes', atual)}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-[11px] text-fg-muted">
          {diretrizesManual === null ? 'Sugeridas automaticamente conforme Área(s) + Tipo de serviço.' : 'Editadas manualmente — mudanças de Área/Serviço não alteram esta lista.'}
        </p>
        {diretrizesManual !== null && (
          <button type="button" onClick={() => setDiretrizesManual(null)} title="Substitui a lista pelas normas sugeridas para o contexto atual" className="text-[10px] font-bold uppercase text-primary hover:text-danger shrink-0">
            Reaplicar sugestão automática
          </button>
        )}
      </div>
      <ListEditor items={diretrizes} numbered onAdd={() => addStr(setDiretrizes, 'ABNT NBR ')} onUpdate={(i, v) => updStr(setDiretrizes, i, v)} onRemove={(i) => rmStr(setDiretrizes, i)} addLabel="Adicionar norma" />
    </Accordion>
    </>
    ),
    escopo: (
    <>
    <Accordion title="Escopo Técnico dos Serviços" doc={docSecao('escopo')} icon={<Wrench className="w-4 h-4 text-danger" />} open={open.escopo} onToggle={(atual) => toggle('escopo', atual)}>
      <textarea rows={4} value={escopoServico} onChange={(e) => setEscopoServico(e.target.value)} className={inputCls} />
    </Accordion>
    
    <Accordion title="Indicadores & SLA (resumo executivo)" icon={<ShieldCheck className="w-4 h-4 text-primary" />} open={open.indicadores} onToggle={(atual) => toggle('indicadores', atual)}>
      <p className="text-[11px] text-fg-secondary mb-3">Opcional. Preenchido, gera a página de <b>Resumo Executivo</b> (cards) e o bloco de <b>SLA</b>. Em branco, nada aparece.</p>
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
            <button type="button" onClick={() => rmSla(i)} className="text-fg-muted hover:text-danger p-1" title="Remover linha">✕</button>
          </div>
        ))}
        <button type="button" onClick={addSla} className="text-[11px] font-semibold text-primary hover:text-danger uppercase">+ Adicionar linha de SLA</button>
      </div>
    </Accordion>
    </>
    ),
    entregaveis: (
    <>
    <Accordion title="Entregáveis do Projeto" doc={docSecao('entregaveis')} icon={<CheckCircle className="w-4 h-4 text-emerald-600" />} open={open.entregaveis} onToggle={(atual) => toggle('entregaveis', atual)}>
      <ListEditor items={entregaveis} onAdd={() => addStr(setEntregaveis, 'Documento de entregável')} onUpdate={(i, v) => updStr(setEntregaveis, i, v)} onRemove={(i) => rmStr(setEntregaveis, i)} addLabel="Adicionar entregável" />
    </Accordion>
    </>
    ),
    premissas: (
    <>
    <Accordion title="Premissas Adotadas" doc={docSecao('premissas')} icon={<ShieldCheck className="w-4 h-4 text-primary" />} open={open.premissas} onToggle={(atual) => toggle('premissas', atual)}>
      <ListEditor items={premissas} onAdd={() => addStr(setPremissas, 'Acesso livre e facilitado')} onUpdate={(i, v) => updStr(setPremissas, i, v)} onRemove={(i) => rmStr(setPremissas, i)} addLabel="Adicionar premissa" />
    </Accordion>
    </>
    ),
    incluso: (
    <>
    <Accordion title="Incluso / Não incluso" doc={docSecao('incluso')} icon={<ShieldCheck className="w-4 h-4 text-emerald-600" />} open={open.incluso} onToggle={(atual) => toggle('incluso', atual)}>
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
    </>
    ),
    responsabilidades: (
    <>
    <Accordion title="Responsabilidades da Contratada" doc={docSecao('responsabilidades')} icon={<CheckCircle className="w-4 h-4 text-emerald-600" />} open={open.respContratada} onToggle={(atual) => toggle('respContratada', atual)}>
      <ListEditor items={respContratada} onAdd={() => addStr(setRespContratada, 'Fornecer equipe qualificada')} onUpdate={(i, v) => updStr(setRespContratada, i, v)} onRemove={(i) => rmStr(setRespContratada, i)} addLabel="Adicionar item" />
    </Accordion>
    </>
    ),
    obrigacoes: (
    <>
    <Accordion title="Obrigações da Contratante" doc={docSecao('obrigacoes')} icon={<Building2 className="w-4 h-4 text-blue-600" />} open={open.respContratante} onToggle={(atual) => toggle('respContratante', atual)}>
      <ListEditor items={respContratante} onAdd={() => addStr(setRespContratante, 'Liberar autorizações')} onUpdate={(i, v) => updStr(setRespContratante, i, v)} onRemove={(i) => rmStr(setRespContratante, i)} addLabel="Adicionar item" />
    </Accordion>
    
    {/* ETAPA 2 — Textos padrão materializados (antes injetados só no PDF).
        Todos ficam VISÍVEIS aqui e são a fonte de verdade do documento. */}
    </>
    ),
    servicos: (
    <>
    <Accordion
      title="Descrição dos Serviços Ofertados"
      doc={docSecao('servicos')}
      icon={<Wrench className="w-4 h-4 text-danger" />}
      open={open.descServicos}
      onToggle={(atual) => toggle('descServicos', atual)}
      badge={<FonteBadge fonte={fonteServicos(servicosOfertados)} />}
    >
      <div className="flex justify-end mb-2">
        <button type="button" onClick={restaurarServicos} className="text-[10px] font-bold uppercase text-fg-muted hover:text-primary inline-flex items-center gap-1">
          <span className="material-symbols-outlined text-sm">restart_alt</span>Restaurar padrão
        </button>
      </div>
      <div className="space-y-3">
        {servicosOfertados.map((grupo, gi) => (
          <div key={gi} className="rounded-lg border border-border p-3">
            <div className="flex items-center gap-2 mb-2">
              <input
                type="text"
                value={grupo.titulo}
                onChange={(e) => { setServicosOfertados((prev) => prev.map((g, idx) => (idx === gi ? { ...g, titulo: e.target.value } : g))); marcarServicosPersonalizado(); }}
                placeholder="Título do grupo (ex.: Instalação e Montagem)"
                className={`flex-1 ${inputCls} font-semibold`}
              />
              <button type="button" onClick={() => { setServicosOfertados((prev) => prev.filter((_, idx) => idx !== gi)); marcarServicosPersonalizado(); }} className="p-1.5 text-fg-muted hover:text-danger hover:bg-red-50 rounded-lg shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
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
        <button type="button" onClick={() => { setServicosOfertados((prev) => [...prev, { titulo: 'Novo grupo de serviços', itens: [] }]); marcarServicosPersonalizado(); }} className="w-full py-2 rounded-lg border border-dashed border-navy/40 text-[11px] font-semibold text-primary hover:bg-navy-3/5 flex items-center justify-center gap-1 uppercase">
          <Plus className="w-3.5 h-3.5" /> Adicionar grupo
        </button>
      </div>
    </Accordion>
    </>
    ),
    conclusao: (
    <>
    <Accordion title="Conclusão" doc={docSecao('conclusao')} icon={<FileText className="w-4 h-4 text-primary" />} open={open.conclusao} onToggle={(atual) => toggle('conclusao', atual)}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] text-fg-muted">Texto de fechamento da proposta.</span>
        {tipoServico && (
          <button
            type="button"
            onClick={() => setConclusao(conclusaoPorTipo(tipoServico))}
            title="Preenche com uma conclusão adequada ao tipo de serviço (você pode editar)"
            className="text-[10px] font-bold uppercase text-primary hover:text-danger"
          >
            Sugerir pelo tipo
          </button>
        )}
      </div>
      <textarea rows={3} value={conclusao} onChange={(e) => setConclusao(e.target.value)} className={inputCls} />
    </Accordion>
    </>
    ),
    pagamento: (
    <>
    {/* ---- Condições de Pagamento (tags pré-formatadas) ---- */}
    <Accordion title="Condições de Pagamento" doc={docSecao('pagamento')} icon={<CreditCard className="w-4 h-4 text-emerald-600" />} open={open.pagamento} onToggle={(atual) => toggle('pagamento', atual)}>
      <div className="space-y-4">
        <div>
          <label className={labelCls}>Formas de Pagamento</label>
          <TagSelect options={FORMAS_PAGAMENTO} selected={formasPagamento} onToggle={(v) => toggleTag(setFormasPagamento, v)} />
        </div>
        <div>
          <label className={labelCls}>Condições de Pagamento</label>
          <TagSelect options={CONDICOES_PAGAMENTO} selected={condicoesPagamento} onToggle={(v) => toggleTag(setCondicoesPagamento, v)} />
        </div>
        <p className="text-[10px] text-fg-muted">Clique nas opções para marcar. O texto no PDF é montado automaticamente.</p>
      </div>
    </Accordion>
    </>
    ),
    garantia: (
    <>
    {/* ---- Garantia (bloco próprio, visível) ---- */}
    <Accordion title="Garantia" doc={docSecao('garantia')} icon={<ShieldCheck className="w-4 h-4 text-emerald-600" />} open={open.garantia} onToggle={(atual) => toggle('garantia', atual)}>
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
            <p className="text-[11px] text-fg-secondary italic">Nenhuma garantia informada — a seção “Garantia” não aparecerá no documento.</p>
          )}
        </div>
      )}
    </Accordion>
    </>
    ),
    embalagem: (
    <>
    {secaoListaBlock({ openKey: 'secEmbalagem', fonteKey: 'embalagem', campo: 'embalagemTransporteTexto', titulo: 'Embalagem, Transporte e Armazenamento', icon: <FileText className="w-4 h-4 text-primary" />, addLabel: 'Adicionar parágrafo', seed: 'Novo parágrafo' })}
    </>
    ),
    seguranca: (
    <>
    {secaoListaBlock({ openKey: 'secSeguranca', fonteKey: 'seguranca', campo: 'segurancaTrabalhoTexto', titulo: 'Segurança do Trabalho', icon: <ShieldCheck className="w-4 h-4 text-emerald-600" />, addLabel: 'Adicionar item', seed: 'Nova condição de segurança' })}
    </>
    ),
    precos: (
    <>
    {secaoListaBlock({ openKey: 'secPrecos', fonteKey: 'precos', campo: 'precosObsTexto', titulo: 'Preços — Observações', icon: <DollarSign className="w-4 h-4 text-emerald-600" />, addLabel: 'Adicionar observação', seed: 'Nova observação de preço' })}
    </>
    ),
    impostos: (
    <>
    {secaoListaBlock({ openKey: 'secImpostos', fonteKey: 'impostos', campo: 'impostosObsTexto', titulo: 'Impostos e Taxas — Observações', icon: <Scale className="w-4 h-4 text-blue-600" />, addLabel: 'Adicionar observação', seed: 'Nova observação de imposto' })}
    </>
    ),
    multas: (
    <>
    {secaoListaBlock({ openKey: 'secMultas', fonteKey: 'multas', campo: 'multasAtrasoTexto', titulo: 'Multas por Atraso de Pagamento', icon: <Scale className="w-4 h-4 text-danger" />, addLabel: 'Adicionar parágrafo', seed: 'Novo parágrafo' })}
    </>
    ),
    limitacao: (
    <>
    {secaoListaBlock({ openKey: 'secLimitacao', fonteKey: 'limitacao', campo: 'limitacaoRespTexto', titulo: 'Limitação de Responsabilidade', icon: <Scale className="w-4 h-4 text-primary" />, addLabel: 'Adicionar parágrafo', seed: 'Novo parágrafo' })}
    </>
    ),
    confidencialidade: (
    <>
    {secaoListaBlock({ openKey: 'secConfid', fonteKey: 'confidencialidade', campo: 'confidencialidadeTexto', titulo: 'Confidencialidade', icon: <ShieldCheck className="w-4 h-4 text-primary" />, addLabel: 'Adicionar parágrafo', seed: 'Novo parágrafo' })}
    </>
    ),
    termoAceite: (
    <>
    {secaoListaBlock({ openKey: 'secTermo', fonteKey: 'termoAceite', campo: 'termoAceiteTexto', titulo: 'Termo de Aceite da Proposta', icon: <CheckCircle className="w-4 h-4 text-emerald-600" />, addLabel: 'Adicionar parágrafo', seed: 'Novo parágrafo' })}
    </>
    ),
    condicoesGerais: (
    <>
    {secaoListaBlock({ openKey: 'secCondGerais', fonteKey: 'condicoesGerais', campo: 'condicoesGeraisTexto', titulo: 'Condições Gerais', icon: <FileText className="w-4 h-4 text-fg-secondary" />, addLabel: 'Adicionar parágrafo', seed: 'Novo parágrafo' })}
    </>
    ),
  };


  // Itens do resumo de "Informações do Pedido" (só os preenchidos). [rótulo, valor, ocupa 2 colunas]
  const STATUS_LABEL: Record<string, string> = {
    rascunho: 'Rascunho', em_revisao: 'Em Revisão', enviado_ao_cliente: 'Enviado ao Cliente', visualizado_cliente: 'Visualizado pelo Cliente',
    em_negociacao: 'Em Negociação', aceito: 'Aceito', concluido: 'Concluída / Recebida', recusado: 'Recusada', expirado: 'Expirada',
  };
  const NIVEL_LABEL = { simples: 'Simples', tecnica: 'Técnica', corporativa: 'Corporativa' } as const;
  const clienteResumo = clients.find((c) => c.id === clienteId);
  const resumoInfo = ([
    ['Número', numeroPedido],
    ['Tipo de Pedido', pedidoTipo ? PEDIDO_TIPO_LABELS[pedidoTipo] : ''],
    ['Referência', referencia, true],
    ['Cliente', clienteResumo ? clientDisplayName(clienteResumo) : '', true],
    ['Modalidade', MODALIDADE_LABELS[modalidade]],
    ['Área(s)', areaPrincipal.map((id) => AREAS_PROPOSTA.find((a) => a.id === id)?.sigla || id).join(', ')],
    ['Título', tituloDinamico, true],
    ...(somenteMaterial ? [] : [
      ['Tipo de serviço', TIPOS_SERVICO.find((t) => t.id === tipoServico)?.label || tipoServico],
      ['Nível', NIVEL_LABEL[nivelProposta]],
      ['Experiência', incluirExperiencia === undefined ? 'Automático' : incluirExperiencia ? 'Incluir' : 'Não incluir'],
    ]),
    ['Fornecedor', fornecedor],
    ['Data de Emissão', dataEmissao ? dataEmissao.split('-').reverse().join('/') : ''],
    ['Responsável', responsavelNome],
    ['Status', STATUS_LABEL[status] || status],
    ...((status === 'recusado' || status === 'expirado') && motivoRecusa ? [[status === 'recusado' ? 'Motivo da recusa' : 'Observação', motivoRecusa, true]] : []),
  ] as [string, string, boolean?][]).filter(([, valor]) => !!(valor || '').trim());

  // Listas de Materiais e de Serviços (posicionadas na grade conforme o PDF).
  const materiaisCard = (
      <Accordion
        title="Lista de Materiais"
        doc={docSecao('itens')}
        icon={<Wrench className="w-4 h-4 text-danger" />}
        open={open.materiais}
        onToggle={(atual) => toggle('materiais', atual)}
        badge={<span className="text-[10px] font-bold bg-surface-3 text-fg-secondary rounded-full px-2 py-0.5">{materiaisRows.length}</span>}
      >
        <p className="text-[11px] text-fg-secondary mb-3">Vincule do Estoque (código, nome e preço vêm do produto) ou digite manualmente em “Cadastrar novo dispositivo”.</p>
        <ItensCardEditor
          tipo="material"
          accent="red"
          itens={materiaisRows}
          smartCatalog={{ items: inventory, areaCodes: materialAreaCodes }}
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
  );
  const servicosCard = (
      <Accordion
        title="Lista de Serviços"
        doc={docSecao('itensServicos')}
        icon={<ShieldCheck className="w-4 h-4 text-emerald-600" />}
        open={open.servicos}
        onToggle={(atual) => toggle('servicos', atual)}
        badge={<span className="text-[10px] font-bold bg-surface-3 text-fg-secondary rounded-full px-2 py-0.5">{servicosRows.length}</span>}
      >
        <p className="text-[11px] text-fg-secondary mb-3">
          Digite o serviço (ex.: &ldquo;Integração SDAI do lojista&rdquo;) ou vincule ao catálogo da aba Serviços, em “Cadastrar novo serviço”.
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
  );

  // Mesmas ações (e handlers) do rodapé, na versão do cabeçalho para telas largas.
  const acoesSalvar = (
    <>
      <button
        type="button"
        onClick={handleSaveDraft}
        className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 font-bold rounded-lg text-xs transition-colors uppercase tracking-wide flex items-center gap-1.5"
      >
        <Save className="w-4 h-4" /> Salvar Rascunho
      </button>
      {status === 'rascunho' && (
        <button
          type="button"
          onClick={() => handleSaveWithValidation('em_revisao')}
          className="px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg text-xs transition-colors uppercase tracking-wide"
        >
          Enviar p/ Revisão
        </button>
      )}
      <button
        type="button"
        onClick={handleSaveAndEmit}
        className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition-colors uppercase tracking-wide shadow-md flex items-center gap-1.5"
      >
        <CheckCircle className="w-4 h-4" /> {emitLabel}
      </button>
    </>
  );

  return (
    // Editor panorâmico: ocupa praticamente toda a viewport. Sem backdrop-blur/transform
    // aqui — o popup de card ampliado (position: fixed) depende disso para centralizar na tela.
    <div className="fixed inset-0 z-50 bg-slate-900/70 flex p-0 sm:p-2 lg:p-3">
      <div className="bg-surface-2 w-full h-full sm:rounded-2xl border border-border shadow-2xl flex flex-col overflow-hidden">
        {/* Cabeçalho */}
        <div className="bg-navy-3 text-white px-3 py-2.5 sm:px-4 flex justify-between items-center gap-3 shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 bg-danger text-white rounded-xl hidden sm:flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] bg-[#F2A900] text-slate-950 font-black px-2 py-0.5 rounded uppercase whitespace-nowrap">
                  Módulo CRM • Novo Pedido
                </span>
                <span className="text-xs font-data-mono text-fg-muted font-bold truncate">{numeroPedido}</span>
              </div>
              <h2 className="text-lg font-bold font-display text-white tracking-wide leading-tight mt-0.5 truncate">
                Estruturação do Pedido
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Ações de salvamento no cabeçalho em telas largas (no rodapé nas demais). */}
            <div className="hidden xl:flex items-center gap-2 pr-2 mr-1 border-r border-slate-700">{acoesSalvar}</div>
            <button
              onClick={handlePreview}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 uppercase"
            >
              <Eye className="w-4 h-4" /> <span className="hidden sm:inline">Pré-Visualizar PDF</span>
            </button>
            <button onClick={onClose} aria-label="Fechar editor" className="p-2 text-fg-muted hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Corpo: uma rolagem principal; duas colunas de cards no desktop */}
        <div ref={scrollRef} data-editor-scroll className="p-3 md:p-4 overflow-y-auto flex-1 [scrollbar-gutter:stable]">
          {initialPedido?.proposal?.surveyOrigin && (
            <div className="mb-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 flex items-start gap-2 text-xs text-indigo-950">
              <span className="material-symbols-outlined text-indigo-700">fact_check</span>
              <div><strong>Pedido originado de levantamento técnico.</strong> {initialPedido.proposal.surveyOrigin.reportNumber || 'Relatório sem número'} · os itens abaixo preservam a origem para conferência comercial.</div>
            </div>
          )}
          {/* Panorâmico (desktop): grade de duas colunas na ordem do DOM. Informações do Pedido
              e Valores na largura toda; Materiais | Serviços lado a lado; as seções do documento
              seguem a sequência do PDF (esquerda → direita). No celular, uma coluna na mesma ordem. */}
          <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:items-start">
          {/* ---- Informações do Pedido (sempre visível) ---- */}
          <div className="lg:col-span-2">
          <MaximizableCard title="Informações do Pedido">
          {({ max, button, titleId, ampliar }) => (
          <div className={`bg-surface rounded-xl border border-border shadow-sm ${max ? `${maxCardCls} overflow-hidden` : 'p-4'}`}>
            <div className={`flex items-center justify-between gap-2 shrink-0 ${max ? 'px-4 py-2.5 border-b border-border' : 'mb-3'}`}>
              <h3 id={titleId} className="font-bold text-primary uppercase text-sm flex items-center gap-2">
                <Building2 className="w-4 h-4 text-danger" /> Informações do Pedido
              </h3>
              <div className="flex items-center gap-1.5">
                {!max && infoCompleta && (
                  <button
                    type="button"
                    onClick={() => setInfoResumo(!mostrarResumoInfo)}
                    className="text-[10px] font-bold uppercase px-2 py-1 rounded-md border border-border-strong text-fg-secondary hover:text-primary hover:bg-surface-3"
                  >
                    {mostrarResumoInfo ? 'Editar aqui' : 'Ver resumo'}
                  </button>
                )}
                {button}
              </div>
            </div>
            {!max && mostrarResumoInfo ? (
              <div>
                <dl className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-2.5">
                  {resumoInfo.map(([rotulo, valor, largo]) => (
                    <div key={rotulo} className={`min-w-0 ${largo ? 'col-span-2' : ''}`}>
                      <dt className="text-[10px] font-bold uppercase tracking-wide text-fg-muted">{rotulo}</dt>
                      <dd className="text-xs font-semibold text-fg truncate" title={valor}>{valor}</dd>
                    </div>
                  ))}
                </dl>
                <button type="button" onClick={ampliar} className="mt-3 text-[10px] font-bold uppercase text-primary hover:text-danger">
                  Editar no popup
                </button>
              </div>
            ) : (
            <div className={max ? 'flex-1 min-h-0 overflow-y-auto p-4' : undefined}>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-x-4 gap-y-3">
              <div>
                <label className={labelCls}>Número do Pedido</label>
                <input
                  type="text"
                  value={numeroPedido}
                  onChange={(e) => setNumeroPedido(e.target.value)}
                  placeholder="Ex.: PED-2026-249"
                  className={`${inputCls} font-data-mono font-bold`}
                />
                <p className="text-[11px] text-fg-muted mt-0.5">Sequencial automático — edite se quiser um número específico.</p>
              </div>
              <div className="xl:col-span-2">
                <label className={labelCls}>Referência / Nome do Projeto</label>
                <input type="text" value={referencia} onChange={(e) => setReferenciaManual(e.target.value)} placeholder="Ex.: Retrofit SDAI Bloco A" className={inputCls} />
              </div>
              <div className="sm:col-span-2 xl:col-span-1">
                <label className={labelCls}>Tipo de Pedido</label>
                <select
                  value={pedidoTipo}
                  onChange={(e) => handleTipoChange(e.target.value as PedidoTipo | '')}
                  className={inputCls}
                >
                  <option value="">Não definido</option>
                  {PEDIDO_TIPO_ORDER.map((t) => (
                    <option key={t} value={t}>
                      {PEDIDO_TIPO_LABELS[t]}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-fg-muted mt-1">
                  Define o documento gerado por padrão (configurável em Conta → PDF).
                </p>
              </div>

              {/* Modalidade comercial (natureza) — decide seções técnicas × fornecimento */}
              <div className="sm:col-span-2 xl:col-span-4">
                <label className={labelCls}>Modalidade comercial</label>
                <div className="grid grid-cols-3 gap-2">
                  {MODALIDADE_ORDER.map((m) => {
                    const on = modalidade === m;
                    const desc = m === 'servico' ? 'Só execução técnica' : m === 'material_servico' ? 'Produtos + execução' : 'Só venda de produtos';
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => handleModalidadeChange(m)}
                        className={`text-left rounded-lg border px-3 py-2 transition-colors ${on ? 'bg-navy-3 text-white border-navy' : 'bg-surface text-fg-secondary border-border-strong hover:border-navy'}`}
                      >
                        <p className="text-xs font-bold">{MODALIDADE_LABELS[m]}</p>
                        <p className="text-[10px] text-fg-muted">{desc}</p>
                      </button>
                    );
                  })}
                </div>
                {somenteMaterial && (
                  <p className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 mt-2">
                    Fornecimento de materiais: o documento sai como <b>Orçamento Comercial — Fornecimento de Materiais</b>, sem seções de execução técnica. Preencha produtos, valores e condições comerciais abaixo.
                  </p>
                )}
              </div>

              {/* P1 — Área de atuação (multi) + Tipo de serviço → título dinâmico */}
              <>
              <div className="sm:col-span-2 xl:col-span-4">
                <label className={labelCls}>Área(s) de atuação</label>
                <div className="flex flex-wrap gap-1.5">
                  {AREAS_PROPOSTA.map((a) => {
                    const on = areaPrincipal.includes(a.id);
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => toggleArea(a.id)}
                        className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-colors ${on ? 'bg-navy-3 text-white border-navy' : 'bg-surface text-fg-secondary border-border-strong hover:border-navy'}`}
                      >
                        {a.sigla}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-fg-muted mt-1">Selecione uma ou mais áreas. Compõe o título e a apresentação.</p>
              </div>
              <div className="sm:col-span-2 xl:col-span-4">
                <div className="flex items-center justify-between">
                  <label className={labelCls}>{somenteMaterial ? 'Fornecimento de materiais' : 'Tipo de serviço'}</label>
                  {(somenteMaterial || tipoServico) && (
                    <button
                      type="button"
                      onClick={() => {
                        const preset = somenteMaterial ? undefined : presetPorTipo(tipoServico);
                        setReferenciaManual(null);
                        setTituloManual(null);
                        if (preset) {
                          setNivelProposta(preset.nivel);
                          setIncluirSeguranca(preset.seguranca);
                        }
                      }}
                      title="Reaplica referência, título, nível e Segurança do Trabalho conforme o contexto"
                      className="text-[10px] font-bold uppercase text-primary hover:text-danger"
                    >
                      Aplicar sugestão do tipo
                    </button>
                  )}
                </div>
                {!somenteMaterial && <select value={tipoServico} onChange={(e) => setTipoServico(e.target.value)} className={inputCls}>
                  <option value="">Não definido</option>
                  {TIPOS_SERVICO.map((t) => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>}
                {(tituloDinamico || tituloManual !== null) && (
                  <div className="mt-2 rounded-lg bg-navy-3/5 border border-navy/15 px-3 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-primary/60">Título gerado</p>
                    <input aria-label="Título gerado" value={tituloDinamico} onChange={(e) => setTituloManual(e.target.value)} className={inputCls} />
                  </div>
                )}
              </div>
              </>
              {!somenteMaterial && (<>
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
                        className={`text-left rounded-lg border px-3 py-2 transition-colors ${on ? 'bg-navy-3 text-white border-navy' : 'bg-surface text-fg-secondary border-border-strong hover:border-navy'}`}
                      >
                        <p className="text-xs font-bold">{n.nome}</p>
                        <p className={`text-[10px] ${on ? 'text-fg-muted' : 'text-fg-muted'}`}>{n.desc}</p>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-fg-muted mt-1">Na Simples, capa institucional (Áreas de Atuação) e Resumo Executivo não entram.</p>
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
                        className={`text-left rounded-lg border px-3 py-2 transition-colors ${on ? 'bg-navy-3 text-white border-navy' : 'bg-surface text-fg-secondary border-border-strong hover:border-navy'}`}
                      >
                        <p className="text-xs font-bold">{o.nome}</p>
                        <p className={`text-[10px] ${on ? 'text-fg-muted' : 'text-fg-muted'}`}>{o.desc}</p>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-fg-muted mt-1">Mostra empresas atendidas e marcas relevantes ao serviço (cadastradas em Conta). Sem dados, a página não é gerada.</p>
                {incluirExperiencia !== false && (empresasAtendidas.length > 0 || marcasTecnologias.length > 0) && (
                  <div className="mt-3 rounded-lg border border-border p-3 bg-surface-2/60">
                    <div className="flex items-center gap-4 mb-2">
                      <label className="flex items-center gap-1.5 text-[11px] font-bold text-fg-secondary cursor-pointer">
                        <input type="radio" checked={experienciaAuto} onChange={() => setExperienciaAuto(true)} className="accent-[#0B1E38]" /> Seleção automática
                      </label>
                      <label className="flex items-center gap-1.5 text-[11px] font-bold text-fg-secondary cursor-pointer">
                        <input type="radio" checked={!experienciaAuto} onChange={() => setExperienciaAuto(false)} className="accent-[#0B1E38]" /> Selecionar manualmente
                      </label>
                    </div>
                    {experienciaAuto ? (
                      <p className="text-[11px] text-fg-muted">O sistema escolhe as empresas e marcas mais relevantes à área/tipo/segmento desta proposta.</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wide text-fg-secondary mb-1">Empresas ({experienciaEmpresasIds.length})</p>
                          <div className="max-h-40 overflow-y-auto space-y-0.5 pr-1">
                            {empresasAtendidas.length === 0 && <p className="text-[11px] text-fg-muted italic">Nenhuma cadastrada.</p>}
                            {empresasAtendidas.map((e) => (
                              <label key={e.id} className="flex items-center gap-2 text-[11px] text-fg-secondary py-0.5 cursor-pointer">
                                <input type="checkbox" checked={experienciaEmpresasIds.includes(e.id)} onChange={() => toggleSelId(experienciaEmpresasIds, setExperienciaEmpresasIds, e.id)} className="accent-[#0B1E38]" />
                                <span className="truncate">{e.nomeFantasia || e.nome}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wide text-fg-secondary mb-1">Marcas ({experienciaMarcasIds.length})</p>
                          <div className="max-h-40 overflow-y-auto space-y-0.5 pr-1">
                            {marcasTecnologias.length === 0 && <p className="text-[11px] text-fg-muted italic">Nenhuma cadastrada.</p>}
                            {marcasTecnologias.map((m) => (
                              <label key={m.id} className="flex items-center gap-2 text-[11px] text-fg-secondary py-0.5 cursor-pointer">
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
              </>)}

              <div className="sm:col-span-2 xl:col-span-4">
                <label className={labelCls}>
                  Cliente / Contratante <span className="text-danger">*</span>
                </label>
                <div className="flex gap-2 items-start">
                  <div className="flex-1 min-w-0">
                    {/* value = cliente efetivamente gravado (selectedClient tem fallback). */}
                    <ClientSelector
                      clients={clients}
                      value={selectedClient?.id || ''}
                      onChange={setClienteId}
                      label=""
                      placeholder="Buscar por nome fantasia, razão social ou CNPJ"
                      showModeFilter
                      onCreate={openNewClient}
                      createLabel="+ Novo cliente"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={openNewClient}
                    title="Cadastrar novo cliente"
                    className="shrink-0 min-h-12 px-3 rounded-lg bg-navy-3 hover:bg-slate-800 text-white flex items-center gap-1.5 text-xs font-bold uppercase"
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
            )}
          </div>
          )}
          </MaximizableCard>
          </div>

          {/* ---- Lista de Materiais: em Somente Material fica no topo; nos demais, na
              posição em que sai no PDF (junto da Lista de Serviços, na grade de seções) ---- */}
          {somenteMaterial && <div className="lg:col-span-2">{materiaisCard}</div>}


          {mostrarValorCard && <div className="lg:col-span-2">{valorCard}</div>}
          {/* ---- Seções do documento: Sim/Não e ▲▼ no título de cada card, na ordem do documento ---- */}
          {faixaPadrao && <div className="lg:col-span-2 -mb-2">{faixaPadrao}</div>}
          {outrasSecoes && <div className="lg:col-span-2">{outrasSecoes}</div>}
          {/* Seções do documento lado a lado, na sequência do PDF: 1ª à esquerda, 2ª à direita… */}
          {cardsNaOrdemDoPdf.map((k) =>
            k === 'itens' ? (
              // Materiais | Serviços lado a lado, na posição da seção no PDF.
              <div key={k} className="lg:col-span-2 grid gap-3 lg:grid-cols-2 lg:items-start">
                <div className="min-w-0">{materiaisCard}</div>
                <div className="min-w-0">{servicosCard}</div>
              </div>
            ) : (
              <div key={k} className="min-w-0 flex flex-col gap-3">{cardsSecao[k]}</div>
            ),
          )}

          {/* ---- Cláusulas Jurídicas (atalho: mesma seleção dos cards) ---- */}
          {!somenteMaterial && (<div className="min-w-0">
          <Accordion title="Cláusulas Jurídicas" icon={<Scale className="w-4 h-4 text-danger" />} open={open.clausulas} onToggle={(atual) => toggle('clausulas', atual)}>
            <p className="text-[11px] text-fg-secondary mb-2">Marque os blocos que devem sair no PDF. Desmarcado = título e texto totalmente omitidos.</p>
            <div className="space-y-2">
              <ClauseRow label="Multas por atraso de pagamento" hint="Juros de mora e multa por inadimplência" checked={secaoOn('multas')} onChange={(on) => setSecao('multas', on)} />
              <ClauseRow label="Limitação de responsabilidade" checked={secaoOn('limitacao')} onChange={(on) => setSecao('limitacao', on)} />
              <ClauseRow label="Confidencialidade e sigilo" checked={secaoOn('confidencialidade')} onChange={(on) => setSecao('confidencialidade', on)} />
              <ClauseRow label="Condições Gerais" checked={secaoOn('condicoesGerais')} onChange={(on) => setSecao('condicoesGerais', on)} />
              <ClauseRow label="Segurança do Trabalho" checked={secaoOn('seguranca')} onChange={(on) => setSecao('seguranca', on)} />
              <ClauseRow label="Termo de Aceite da Proposta" checked={secaoOn('termoAceite')} onChange={(on) => setSecao('termoAceite', on)} />
            </div>
          </Accordion>
          </div>)}

          {/* ---- Informações Básicas (colapsável com +/lixeira) ---- */}
          <div className="min-w-0">
          <Accordion title={somenteMaterial ? 'Condições Comerciais' : 'Informações Básicas'} icon={<DollarSign className="w-4 h-4 text-emerald-600" />} open={open.basicas} onToggle={(atual) => toggle('basicas', atual)}>
            <div className="space-y-2.5">
              <BasicInfoRow label={somenteMaterial ? 'Prazo de entrega' : 'Prazo de Execução'} value={prazoExecucao} onChange={setPrazoExecucao} placeholder={somenteMaterial ? 'Ex.: Até 10 dias úteis após a confirmação do pedido' : 'Ex.: 10 dias úteis após liberação'} />
              <BasicInfoRow label="Faturamento" value={faturamento} onChange={setFaturamento} placeholder={somenteMaterial ? 'Ex.: Nota Fiscal de Venda' : 'Ex.: Nota Fiscal de Serviços'} />
              {!somenteMaterial && (
              <BasicInfoRow label="Impostos" value={impostos} onChange={setImpostos} placeholder="Ex.: Inclusos, Simples Nacional" />
              )}
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
          </div>

          {/* ---- Observações comerciais (SOMENTE MATERIAL) ---- */}
          {somenteMaterial && (
            <div className="min-w-0">
            <Accordion title="Observações" icon={<FileText className="w-4 h-4 text-primary" />} open={open.observacoes} onToggle={(atual) => toggle('observacoes', atual)}>
              <textarea
                rows={3}
                value={observacoesComerciais}
                onChange={(e) => setObservacoesComerciais(e.target.value)}
                placeholder={OBS_DISPONIBILIDADE}
                className={inputCls}
              />
              <p className="text-[11px] text-fg-muted mt-1">
                Observações livres do orçamento. O aviso de que o fornecimento não inclui instalação/serviços já entra automaticamente no documento.
              </p>
            </Accordion>
            </div>
          )}

          {/* ---- Modelos reutilizáveis ---- */}
          {(templates.length > 0 || onSaveTemplate) && (
            <div className="min-w-0">
            <Accordion title="Modelos Reutilizáveis" icon={<Sparkles className="w-4 h-4 text-[#F2A900]" />} open={open.modelos} onToggle={(atual) => toggle('modelos', atual)}>
              {onSaveTemplate && (
                <button type="button" onClick={handleSaveCurrentTemplate} className="mb-3 w-full sm:w-auto px-3 py-2 border border-primary/25 text-primary hover:bg-navy/5 rounded-lg text-xs font-bold uppercase flex items-center justify-center gap-1.5">
                  <Save className="w-3.5 h-3.5" /> Salvar preenchimento como modelo{selectedClient ? ' deste cliente' : ''}
                </button>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {templates.filter((tmpl) => !tmpl.clientId || tmpl.clientId === selectedClient?.id).map((tmpl) => (
                  <div key={tmpl.id} className="bg-surface-2 p-3 rounded-xl border border-border flex flex-col justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-fg text-xs uppercase">{tmpl.name}</h4>
                      {tmpl.clientId && <p className="text-[10px] font-bold uppercase tracking-wide text-primary mt-1">Modelo do cliente</p>}
                      <p className="text-[11px] text-fg-secondary line-clamp-2 mt-1">{tmpl.objetivo}</p>
                    </div>
                    <button type="button" onClick={() => handleLoadTemplate(tmpl)} className="px-3 py-2 bg-navy-3 hover:bg-slate-800 text-white rounded-lg text-xs font-bold uppercase flex items-center justify-center gap-1.5">
                      <Copy className="w-3.5 h-3.5 text-[#F2A900]" /> Aplicar modelo
                    </button>
                    {(onSaveTemplate || onDeleteTemplate) && (
                      <div className="flex justify-end gap-1">
                        {onSaveTemplate && <button type="button" onClick={() => handleRenameTemplate(tmpl)} className="px-2 py-1 text-[10px] font-semibold text-fg-secondary hover:text-primary">Renomear</button>}
                        {onDeleteTemplate && <button type="button" onClick={async () => { if (await requestConfirm(`Excluir o modelo \"${tmpl.name}\"?`)) onDeleteTemplate(tmpl.id); }} className="p-1 text-fg-muted hover:text-red-600" title="Excluir modelo"><Trash2 className="w-3.5 h-3.5" /></button>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Accordion>
            </div>
          )}
          </div>
        </div>

        {/* Rodapé */}
        <div className="xl:hidden bg-surface border-t border-border p-3 px-4 flex flex-wrap justify-between items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={handleSaveDraft}
            className="px-4 py-2.5 bg-surface-3 hover:bg-border-strong text-fg font-bold rounded-xl text-xs transition-colors uppercase tracking-wide flex items-center gap-1.5"
          >
            <Save className="w-4 h-4 text-fg-secondary" /> Salvar Rascunho
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
              onClick={handleSaveAndEmit}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-colors uppercase tracking-wide shadow-md flex items-center gap-1.5"
            >
              <CheckCircle className="w-4 h-4" /> {emitLabel}
            </button>
          </div>
        </div>
      </div>

      {/* ============ Dialog: cadastro rápido de cliente ============ */}
      {newClientOpen && (
        <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface w-full max-w-md rounded-xl shadow-2xl border border-border">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-primary" />
                <h3 className="text-sm font-bold text-fg uppercase">Novo Cliente</h3>
              </div>
              <button onClick={() => setNewClientOpen(false)} className="text-fg-muted hover:text-fg-secondary font-bold text-lg leading-none">✕</button>
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
              <p className="text-[10px] text-fg-muted flex items-start gap-1 bg-surface-2 border border-border rounded-lg p-2">
                <span className="material-symbols-outlined text-sm text-fg-muted">info</span>
                <span>Você não perde os dados da proposta. O cliente é criado e já selecionado aqui.</span>
              </p>
            </div>
            <div className="flex items-center justify-between p-4 border-t border-border">
              <button onClick={() => setNewClientOpen(false)} className="px-4 py-2 text-xs font-semibold text-fg-secondary hover:text-fg uppercase">
                Cancelar
              </button>
              <button
                onClick={confirmNewClient}
                disabled={!ncName.trim()}
                className="px-5 py-2 rounded-lg bg-navy-3 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wide"
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
