'use client';

// Motor de formulário por template (renderer). onCreateCatalogo é threadeado
// FormEngine -> Repeater/FieldControl para o "Cadastrar novo…" dos comboboxes.
import React, { useMemo, useState } from 'react';
import {
  TemplateSchema,
  SectionSchema,
  FieldSchema,
  FormValues,
  RepeaterCard,
  isNegativeAnswer,
  isFieldVisibleForRole,
  fotoLabels,
} from '@/lib/reportSchema';
import { registerPhoto, getPhotoPreview, setPhotoMarkup, hasMarkup } from '@/lib/reportMedia';
import { MarkupCanvas } from '@/components/reports/MarkupCanvas';
import { Combobox } from '@/components/reports/Combobox';
import { falhasPorArea, AreaFalha, falhaLabel, findFalhaByLabel } from '@/lib/catalogoFalhas';

// Rótulo da criticidade (bate com as opções do campo select_interno).
const CRIT_LABEL: Record<1 | 2 | 3, string> = {
  1: '1 - pode aguardar',
  2: '2 - programar',
  3: '3 - executar com urgência',
};
import { getSignature } from '@/lib/signatures';
import { SignatureCanvas } from '@/components/reports/SignatureCanvas';

export interface CatalogSources {
  categorias: string[];
  itens: string[]; // Estoque + Serviços (labels)
  marcas: string[];
  modelos?: string[]; // modelos cadastrados no estoque (lista completa)
  /** Modelos agrupados por marca (do estoque), para filtrar o campo modelo. */
  modelosPorMarca?: Record<string, string[]>;
  devices: { id: string; label: string }[];
  contratos: { id: string; label: string }[];
  pendenciasAprovadas: { id: string; label: string }[];
  pendenciasAbertas: { id: string; label: string }[];
  /** Lista pré-pronta de dispositivos por categoria (ex.: catálogo SDAI do
   * Estoque) para adição rápida no checklist da preventiva. */
  dispositivosPadrao?: {
    grupo: string;
    itens: {
      id: string;
      nome: string;
      marca?: string;
      modelo?: string;
      quantidade: number;
      unidade?: string;
    }[];
  }[];
}

interface FormEngineProps {
  template: TemplateSchema;
  values: FormValues;
  onChange: (key: string, value: unknown) => void;
  catalog: CatalogSources;
  role: string;
  /** Persistência do "Cadastrar novo…" dos comboboxes (ex.: marca -> brands). */
  onCreateCatalogo?: (origem: string, name: string) => void;
}

const inputCls =
  'w-full border border-slate-200 rounded-lg p-2.5 text-slate-900 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-[#1A1A72]/20 focus:border-[#1A1A72]/40';
const labelCls = 'block text-slate-600 mb-1 font-semibold uppercase text-[11px]';

function catalogOptions(field: FieldSchema, catalog: CatalogSources, filtroValor?: string): string[] {
  switch (field.origem) {
    case 'categorias':
      return catalog.categorias;
    case 'estoque_servicos':
      return catalog.itens;
    case 'marcas':
      return catalog.marcas;
    case 'modelos': {
      // Se o campo filtra por marca e há marca escolhida, mostra só os modelos
      // daquela marca (do estoque). Sem marca escolhida, mostra todos.
      const marca = (filtroValor || '').trim();
      if (field.filtro_por && marca) {
        const doGrupo = catalog.modelosPorMarca?.[marca];
        if (doGrupo && doGrupo.length > 0) return doGrupo;
        return []; // marca escolhida sem modelos cadastrados → lista vazia (só "cadastrar novo")
      }
      return catalog.modelos || [];
    }
    case 'devices':
      return catalog.devices.map((d) => d.label);
    case 'contratos':
      return catalog.contratos.map((c) => c.label);
    case 'pendencias_aprovadas':
      return catalog.pendenciasAprovadas.map((p) => p.label);
    case 'pendencias_abertas':
      return catalog.pendenciasAbertas.map((p) => p.label);
    default:
      return [];
  }
}

/** Rótulo da ação "criar" do combobox, por origem do catálogo. */
function createLabelFor(origem?: string): string | undefined {
  if (origem === 'marcas') return 'Cadastrar nova marca';
  if (origem === 'modelos') return 'Cadastrar novo modelo';
  if (origem === 'estoque_servicos') return 'Cadastrar novo item';
  return undefined;
}

/** Controle de um campo simples (não-repeater). */
const FieldControl: React.FC<{
  field: FieldSchema;
  value: unknown;
  onValue: (v: unknown) => void;
  catalog: CatalogSources;
  onCreateCatalogo?: (origem: string, name: string) => void;
  /** Valor do campo-irmão usado como filtro (ex.: marca escolhida, p/ modelos). */
  filtroValor?: string;
}> = ({ field, value, onValue, catalog, onCreateCatalogo, filtroValor }) => {
  const [sigOpen, setSigOpen] = useState(false);
  const [markupId, setMarkupId] = useState<string | null>(null);
  const [, forceTick] = useState(0); // re-render após gravar markup (registro é mutável)
  const negative = isNegativeAnswer(field, value as never);

  const negHint = negative ? (
    <p className="mt-1 text-[10px] font-semibold text-[#E63946] flex items-center gap-1">
      <span className="material-symbols-outlined text-[13px]">error</span> Gera pendência automaticamente
    </p>
  ) : null;

  switch (field.tipo) {
    case 'texto':
      return (
        <>
          {field.multilinha ? (
            <textarea rows={3} className={inputCls} value={(value as string) || ''} onChange={(e) => onValue(e.target.value)} />
          ) : (
            <input type="text" className={inputCls} value={(value as string) || ''} onChange={(e) => onValue(e.target.value)} />
          )}
          {negHint}
        </>
      );
    case 'numero':
      return <input type="number" className={`${inputCls} font-data-mono`} value={(value as number) ?? ''} onChange={(e) => onValue(e.target.value === '' ? '' : Number(e.target.value))} />;
    case 'data':
      return <input type="date" className={`${inputCls} font-data-mono`} value={(value as string) || ''} onChange={(e) => onValue(e.target.value)} />;
    case 'hora':
      return <input type="time" className={`${inputCls} font-data-mono`} value={(value as string) || ''} onChange={(e) => onValue(e.target.value)} />;
    case 'select':
    case 'passfail': {
      const opts = field.opcoes || (field.tipo === 'passfail' ? ['Aprovado', 'Reprovado'] : []);
      return (
        <>
          <select className={inputCls} value={(value as string) || ''} onChange={(e) => onValue(e.target.value)}>
            <option value="">— selecione —</option>
            {opts.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
          {negHint}
        </>
      );
    }
    case 'multiselect': {
      const opts = field.opcoes || [];
      const arr = Array.isArray(value) ? (value as string[]) : [];
      const toggle = (o: string) => onValue(arr.includes(o) ? arr.filter((x) => x !== o) : [...arr, o]);
      return (
        <>
          <div className="flex flex-wrap gap-1.5">
            {opts.map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => toggle(o)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${
                  arr.includes(o) ? 'bg-[#1A1A72] text-white border-[#1A1A72]' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {o}
              </button>
            ))}
          </div>
          {negHint}
        </>
      );
    }
    case 'select_catalogo': {
      const opts = catalogOptions(field, catalog, filtroValor);
      return (
        <select className={inputCls} value={(value as string) || ''} onChange={(e) => onValue(e.target.value)}>
          <option value="">— selecione —</option>
          {opts.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      );
    }
    case 'select_interno': {
      const opts = field.opcoes || [];
      return (
        <select className={`${inputCls} border-amber-200 bg-amber-50/40`} value={(value as string) || ''} onChange={(e) => onValue(e.target.value)}>
          <option value="">— interno —</option>
          {opts.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      );
    }
    case 'autocomplete_catalogo': {
      const opts = catalogOptions(field, catalog, filtroValor);
      const known = opts.includes((value as string) || '');
      const createLabel = createLabelFor(field.origem);
      return (
        <>
          <Combobox
            value={(value as string) || ''}
            onChange={(v) => onValue(v)}
            options={opts}
            placeholder="Buscar no catálogo…"
            createLabel={createLabel}
            onCreate={createLabel ? (name) => onCreateCatalogo?.(field.origem || '', name) : undefined}
          />
          {field.permite_texto_livre && value && !known && (
            <p className="mt-1 text-[10px] font-semibold text-amber-600 flex items-center gap-1">
              <span className="material-symbols-outlined text-[13px]">new_releases</span> Fora do catálogo — sinalizado para cadastro
            </p>
          )}
        </>
      );
    }
    case 'foto': {
      const labels = fotoLabels(field);
      const arr = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer">
              <span className="material-symbols-outlined text-base">photo_camera</span>
              Adicionar foto
              <input
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                className="hidden"
                onChange={(e) => {
                  const ids = Array.from(e.target.files || []).map((f) => registerPhoto(f));
                  onValue([...arr, ...ids]);
                }}
              />
            </label>
            <span className="text-[10px] text-slate-400">
              {arr.length}/{labels.length} {labels[0] === 'foto' ? 'foto(s)' : labels.join(' + ')}
            </span>
            {arr.length > 0 && (
              <button type="button" onClick={() => onValue([])} className="text-[10px] text-[#E63946] font-semibold hover:underline">
                limpar
              </button>
            )}
          </div>
          {arr.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {arr.map((pid, i) => {
                const preview = getPhotoPreview(pid);
                const marcada = hasMarkup(pid);
                return (
                  <button
                    key={pid + i}
                    type="button"
                    onClick={() => setMarkupId(pid)}
                    title="Marcar foto (destacar o problema)"
                    className="relative w-12 h-12 rounded-md overflow-hidden border border-slate-200 bg-slate-100 group"
                  >
                    {preview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={preview} alt="foto" className="w-full h-full object-cover" />
                    ) : (
                      <span className="material-symbols-outlined text-slate-300 flex items-center justify-center w-full h-full">image</span>
                    )}
                    <span className={`absolute bottom-0 right-0 material-symbols-outlined text-[13px] leading-none p-0.5 rounded-tl ${marcada ? 'bg-[#E63946] text-white' : 'bg-black/50 text-white opacity-0 group-hover:opacity-100'}`}>
                      {marcada ? 'check' : 'edit'}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          <MarkupCanvas
            open={markupId !== null}
            imageUrl={markupId ? getPhotoPreview(markupId) : undefined}
            onClose={() => setMarkupId(null)}
            onDone={(blob) => {
              if (markupId) setPhotoMarkup(markupId, blob);
              setMarkupId(null);
              forceTick((n) => n + 1);
            }}
          />
        </div>
      );
    }
    case 'assinatura': {
      const sig = typeof value === 'string' && value ? getSignature(value) : undefined;
      const assinada = typeof value === 'string' && value.length > 0;
      return (
        <>
          <button
            type="button"
            onClick={() => setSigOpen(true)}
            className={`w-full py-2.5 rounded-lg text-[11px] font-semibold uppercase tracking-wide border-2 border-dashed transition-colors flex items-center justify-center gap-1.5 ${
              assinada ? 'border-emerald-400 text-emerald-700 bg-emerald-50' : 'border-slate-300 text-slate-500 hover:bg-slate-50'
            }`}
          >
            <span className="material-symbols-outlined text-base">{assinada ? 'task_alt' : 'draw'}</span>
            {sig ? `Assinado por ${sig.nome}` : assinada ? 'Assinatura coletada' : 'Coletar assinatura'}
          </button>
          <SignatureCanvas
            open={sigOpen}
            onClose={() => setSigOpen(false)}
            onDone={(id) => {
              onValue(id);
              setSigOpen(false);
            }}
          />
        </>
      );
    }
    default:
      return null;
  }
};

/** Repeater: lista de cards com schema próprio. */
const Repeater: React.FC<{
  field: FieldSchema;
  cards: RepeaterCard[];
  onCards: (cards: RepeaterCard[]) => void;
  catalog: CatalogSources;
  role: string;
  onCreateCatalogo?: (origem: string, name: string) => void;
}> = ({ field, cards, onCards, catalog, role, onCreateCatalogo }) => {
  const schema = field.card_schema || [];
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState('');
  const [pickerSubcategory, setPickerSubcategory] = useState('');
  const [pickerBrand, setPickerBrand] = useState('');
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<Set<string>>(() => new Set());
  // Lista pré-pronta só faz sentido no checklist de dispositivos (preventiva).
  const dispositivosPadrao =
    field.tipo === 'checklist_dispositivos' ? catalog.dispositivosPadrao || [] : [];
  const showPadrao = dispositivosPadrao.length > 0;

  const addCard = () => {
    const blank: RepeaterCard = {};
    schema.forEach((f) => {
      if (f.default !== undefined) blank[f.key] = f.default;
    });
    onCards([...cards, blank]);
  };
  // Adiciona um card a partir da lista pré-pronta, preenchendo o "dispositivo".
  const makeDeviceCard = (item: (typeof dispositivosPadrao)[number]['itens'][number]) => {
    const blank: RepeaterCard = {};
    schema.forEach((f) => {
      if (f.default !== undefined) blank[f.key] = f.default;
    });
    blank['dispositivo'] = item.nome;
    // Mantém o vínculo do item para impedir repetição mesmo quando dois
    // produtos cadastrados possuem o mesmo nome.
    blank['inventory_item_id'] = item.id;
    return blank;
  };
  const existingDeviceIds = new Set(cards.map((card) => String(card.inventory_item_id || '')).filter(Boolean));
  // Relatórios antigos não têm o id do estoque; nesses casos o nome ainda é a
  // melhor proteção contra repetição. Os novos usam o id e aceitam itens com
  // nomes iguais, porém cadastros diferentes.
  const existingLegacyDeviceNames = new Set(
    cards.filter((card) => !card.inventory_item_id).map((card) => String(card.dispositivo || '')).filter(Boolean)
  );
  const flatDevices = useMemo(
    () => dispositivosPadrao.flatMap((group) => group.itens.map((item) => ({ ...item, grupo: group.grupo }))),
    [dispositivosPadrao]
  );
  const subcategories = useMemo(
    () => Array.from(new Set(flatDevices.map((item) => item.grupo))).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [flatDevices]
  );
  const brands = useMemo(
    () => Array.from(new Set(flatDevices.map((item) => item.marca).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [flatDevices]
  );
  const filteredDevices = useMemo(() => {
    const query = pickerQuery.trim().toLocaleLowerCase('pt-BR');
    return flatDevices.filter((item) => {
      const haystack = [item.nome, item.marca, item.modelo, item.grupo].filter(Boolean).join(' ').toLocaleLowerCase('pt-BR');
      return (!pickerSubcategory || item.grupo === pickerSubcategory)
        && (!pickerBrand || item.marca === pickerBrand)
        && (!onlyAvailable || item.quantidade > 0)
        && (!query || haystack.includes(query));
    });
  }, [flatDevices, onlyAvailable, pickerBrand, pickerQuery, pickerSubcategory]);
  const toggleDevice = (id: string) => setSelectedDeviceIds((current) => {
    const next = new Set(current);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const addSelectedDevices = () => {
    const toAdd = flatDevices.filter((item) => selectedDeviceIds.has(item.id) && !existingDeviceIds.has(item.id) && !existingLegacyDeviceNames.has(item.nome));
    if (toAdd.length) onCards([...cards, ...toAdd.map(makeDeviceCard)]);
    setSelectedDeviceIds(new Set());
    setPickerOpen(false);
  };
  const updateCard = (idx: number, key: string, v: unknown) => {
    onCards(cards.map((c, i) => (i === idx ? { ...c, [key]: v } : c)));
  };
  // Aplica vários campos de uma vez (usado pelo seletor de falha padrão).
  const patchCard = (idx: number, patch: Record<string, unknown>) => {
    onCards(cards.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  };
  const removeCard = (idx: number) => onCards(cards.filter((_, i) => i !== idx));

  return (
    <div className="space-y-3">
      {cards.length === 0 && <p className="text-[11px] text-slate-400 italic">Nenhum item adicionado.</p>}
      {cards.map((card, idx) => (
        <div key={idx} className="border border-slate-200 rounded-xl p-3 bg-slate-50/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              {field.label} #{idx + 1}
            </span>
            <button type="button" onClick={() => removeCard(idx)} className="text-slate-400 hover:text-[#E63946]" title="Remover">
              <span className="material-symbols-outlined text-lg">delete</span>
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {schema
              .filter((f) => isFieldVisibleForRole(f, role))
              .map((f) => (
                <div key={f.key} className={f.tipo === 'select_falha' || f.multilinha ? 'md:col-span-2' : ''}>
                  <label className={labelCls}>
                    {f.label || f.key} {f.obrigatorio && <span className="text-[#E63946]">*</span>}
                  </label>
                  {f.tipo === 'select_falha' ? (
                    <select
                      className={inputCls}
                      value={(card[f.key] as string) || ''}
                      onChange={(e) => {
                        const fa = findFalhaByLabel(e.target.value);
                        if (!fa) {
                          patchCard(idx, { [f.key]: '' });
                          return;
                        }
                        // Preenche o card inteiro; o técnico ainda pode editar tudo.
                        patchCard(idx, {
                          [f.key]: e.target.value,
                          grupo: fa.grupo,
                          descricao: fa.descricao,
                          acao_recomendada: fa.acao,
                          criticidade_operacional: CRIT_LABEL[fa.criticidade],
                        });
                      }}
                    >
                      <option value="">— escolher falha padrão (preenche o resto) —</option>
                      {(() => {
                        const falhas = falhasPorArea(field.origem as AreaFalha | undefined);
                        const grupos = Array.from(new Set(falhas.map((x) => x.grupo)));
                        return grupos.map((g) => (
                          <optgroup key={g} label={g.split('> ').pop()}>
                            {falhas.filter((x) => x.grupo === g).map((x) => (
                              <option key={x.titulo} value={falhaLabel(x)}>
                                {x.titulo}
                              </option>
                            ))}
                          </optgroup>
                        ));
                      })()}
                    </select>
                  ) : (
                    <FieldControl
                      field={f}
                      value={card[f.key]}
                      onValue={(v) => updateCard(idx, f.key, v)}
                      catalog={catalog}
                      onCreateCatalogo={onCreateCatalogo}
                      filtroValor={f.filtro_por ? String(card[f.filtro_por] ?? '') : undefined}
                    />
                  )}
                </div>
              ))}
          </div>
        </div>
      ))}
      <div className="flex flex-col sm:flex-row gap-2">
        {showPadrao && (
          <button
            type="button"
            onClick={() => {
              setPickerQuery('');
              setPickerSubcategory('');
              setPickerBrand('');
              setOnlyAvailable(false);
              setSelectedDeviceIds(new Set());
              setPickerOpen(true);
            }}
            className="flex-1 py-2 rounded-lg border border-[#E63946]/50 bg-[#E63946]/5 text-[11px] font-semibold text-[#E63946] hover:bg-[#E63946]/10 transition-colors flex items-center justify-center gap-1.5"
          >
            <span className="material-symbols-outlined text-base">list_alt</span>
            Adicionar da lista padrão
          </button>
        )}
        <button
          type="button"
          onClick={addCard}
          className="flex-1 py-2 rounded-lg border border-dashed border-[#1A1A72]/40 text-[11px] font-semibold text-[#1A1A72] hover:bg-[#1A1A72]/5 transition-colors"
        >
          {field.botao_adicionar || '+ Adicionar'}
        </button>
      </div>

      {/* Seletor da lista pré-pronta (dispositivos por categoria) */}
      {pickerOpen && (
        <div className="fixed inset-0 z-[70] bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-2xl rounded-t-2xl sm:rounded-2xl max-h-[90vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <div>
                <h4 className="text-sm font-bold text-slate-900 uppercase">Selecionar dispositivos</h4>
                <p className="text-[11px] text-slate-500">Filtre o estoque da área e adicione em lote ao checklist</p>
              </div>
              <button
                type="button"
                onClick={() => setPickerOpen(false)}
                className="text-slate-400 hover:text-slate-700 font-bold text-lg leading-none"
              >
                ✕
              </button>
            </div>
            <div className="overflow-y-auto p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="relative sm:col-span-3">
                  <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-base">search</span>
                  <input value={pickerQuery} onChange={(e) => setPickerQuery(e.target.value)} placeholder="Buscar por nome, marca ou modelo…" className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A1A72]/20" />
                </div>
                <select value={pickerSubcategory} onChange={(e) => setPickerSubcategory(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white">
                  <option value="">Todas as subcategorias</option>
                  {subcategories.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
                <select value={pickerBrand} onChange={(e) => setPickerBrand(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white">
                  <option value="">Todas as marcas</option>
                  {brands.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
                <label className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg cursor-pointer">
                  <input type="checkbox" checked={onlyAvailable} onChange={(e) => setOnlyAvailable(e.target.checked)} className="accent-[#1A1A72]" /> Em estoque
                </label>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span><strong className="text-slate-800">{filteredDevices.length}</strong> dispositivo(s) encontrado(s)</span>
                {selectedDeviceIds.size > 0 && <button type="button" onClick={() => setSelectedDeviceIds(new Set())} className="font-semibold text-[#1A1A72] hover:underline">Limpar seleção</button>}
              </div>
              <div className="flex flex-col gap-1.5">
                {filteredDevices.map((item) => {
                  const alreadyAdded = existingDeviceIds.has(item.id) || existingLegacyDeviceNames.has(item.nome);
                  const selected = selectedDeviceIds.has(item.id);
                  return (
                    <button key={item.id} type="button" disabled={alreadyAdded} onClick={() => toggleDevice(item.id)} className={`w-full flex items-center gap-3 text-left px-3 py-2.5 rounded-lg border transition-colors ${alreadyAdded ? 'bg-slate-50 border-slate-100 text-slate-400 cursor-not-allowed' : selected ? 'border-[#1A1A72] bg-[#1A1A72]/5' : 'border-slate-200 hover:border-[#1A1A72]/50 hover:bg-slate-50'}`}>
                      <span className={`material-symbols-outlined text-lg ${selected ? 'text-[#1A1A72]' : 'text-slate-400'}`}>{alreadyAdded ? 'check_circle' : selected ? 'check_box' : 'check_box_outline_blank'}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-semibold text-slate-700 truncate">{item.nome}</span>
                        <span className="block text-[10px] text-slate-500 truncate">{[item.grupo, item.marca, item.modelo].filter(Boolean).join(' · ') || 'Sem detalhes de catálogo'}</span>
                      </span>
                      <span className={`shrink-0 text-[10px] font-bold ${item.quantidade > 0 ? 'text-emerald-700' : 'text-amber-700'}`}>{alreadyAdded ? 'Já adicionado' : `${item.quantidade} ${item.unidade || 'un.'}`}</span>
                    </button>
                  );
                })}
                {filteredDevices.length === 0 && <p className="py-8 text-center text-xs text-slate-400">Nenhum dispositivo corresponde aos filtros.</p>}
              </div>
            </div>
            <div className="flex items-center justify-between p-4 border-t border-slate-100">
              <span className="text-[11px] text-slate-500">
                <strong className="text-slate-800">{selectedDeviceIds.size}</strong> selecionado(s)
              </span>
              <button
                type="button"
                onClick={addSelectedDevices}
                disabled={selectedDeviceIds.size === 0}
                className="px-5 py-2 rounded-lg bg-[#1A1A72] hover:bg-[#12124f] disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-semibold uppercase tracking-wide"
              >
                Adicionar selecionados
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const Section: React.FC<{
  section: SectionSchema;
  values: FormValues;
  onChange: (key: string, value: unknown) => void;
  catalog: CatalogSources;
  role: string;
  onCreateCatalogo?: (origem: string, name: string) => void;
}> = ({ section, values, onChange, catalog, role, onCreateCatalogo }) => {
  // Salto condicional
  if (section.pula_se && String(values[section.pula_se.campo]) === section.pula_se.igual) return null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <div className="border-b border-slate-100 pb-3 mb-4">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">{section.titulo}</h3>
        {section.descricao && <p className="text-[11px] text-slate-500 mt-1">{section.descricao}</p>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {section.campos
          .filter((f) => isFieldVisibleForRole(f, role))
          .map((field) => {
            const isRepeater = field.tipo === 'repeater' || field.tipo === 'checklist_dispositivos' || field.tipo === 'checklist_pendencias';
            const isWide = isRepeater || field.multilinha || field.tipo === 'multiselect';
            return (
              <div key={field.key} className={isWide ? 'md:col-span-2' : ''}>
                <label className={labelCls}>
                  {field.label || field.key} {field.obrigatorio && <span className="text-[#E63946]">*</span>}
                </label>
                {field.help && <p className="text-[10px] text-slate-400 mb-1">{field.help}</p>}
                {isRepeater ? (
                  <Repeater
                    field={field}
                    cards={Array.isArray(values[field.key]) ? (values[field.key] as RepeaterCard[]) : []}
                    onCards={(cards) => onChange(field.key, cards)}
                    catalog={catalog}
                    role={role}
                    onCreateCatalogo={onCreateCatalogo}
                  />
                ) : (
                  <FieldControl
                    field={field}
                    value={values[field.key]}
                    onValue={(v) => onChange(field.key, v)}
                    catalog={catalog}
                    onCreateCatalogo={onCreateCatalogo}
                    filtroValor={field.filtro_por ? String(values[field.filtro_por] ?? '') : undefined}
                  />
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
};

export const FormEngine: React.FC<FormEngineProps & {
  unclassifiedCount?: number;
  onOpenTriagem?: () => void;
  onFastPhotoCaptured?: (url: string) => void;
  hideFloatingCamera?: boolean;
}> = ({ template, values, onChange, catalog, role, onCreateCatalogo, unclassifiedCount = 0, onOpenTriagem, onFastPhotoCaptured, hideFloatingCamera = false }) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleCameraClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    Array.from(files).forEach((file) => {
      const id = registerPhoto(file); // guarda o arquivo; devolve um ID leve
      if (onFastPhotoCaptured) {
        onFastPhotoCaptured(id);
      }
    });
  };

  return (
    <div className="relative flex flex-col gap-5">
      {/* Input oculto para disparo direto da câmera */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Botão flutuante de Câmera Rápida em campo (Seção 3.1) */}
      <div className={`fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2 ${hideFloatingCamera ? 'hidden' : ''}`}>
        {unclassifiedCount > 0 && onOpenTriagem && (
          <button
            type="button"
            onClick={onOpenTriagem}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900 text-white text-xs font-bold shadow-lg border border-slate-700 animate-bounce"
          >
            <span className="material-symbols-outlined text-sm text-[#E63946]">collections</span>
            {unclassifiedCount} foto(s) na triagem
          </button>
        )}

        <button
          type="button"
          onClick={handleCameraClick}
          className="w-14 h-14 rounded-full bg-[#E63946] hover:bg-[#a51515] text-white shadow-2xl flex items-center justify-center transition-all active:scale-95 border-2 border-white"
          title="Captura rápida por câmera (sem formulário)"
        >
          <span className="material-symbols-outlined text-2xl">photo_camera</span>
        </button>
      </div>

      {template.secoes.map((section) => (
        <Section key={section.key} section={section} values={values} onChange={onChange} catalog={catalog} role={role} onCreateCatalogo={onCreateCatalogo} />
      ))}
    </div>
  );
};
