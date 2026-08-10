'use client';

import React from 'react';
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

export interface CatalogSources {
  categorias: string[];
  itens: string[]; // Estoque + Serviços (labels)
  marcas: string[];
  devices: { id: string; label: string }[];
  contratos: { id: string; label: string }[];
  pendenciasAprovadas: { id: string; label: string }[];
  pendenciasAbertas: { id: string; label: string }[];
}

interface FormEngineProps {
  template: TemplateSchema;
  values: FormValues;
  onChange: (key: string, value: unknown) => void;
  catalog: CatalogSources;
  role: string;
}

const inputCls =
  'w-full border border-slate-200 rounded-lg p-2.5 text-slate-900 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-[#1A1A72]/20 focus:border-[#1A1A72]/40';
const labelCls = 'block text-slate-600 mb-1 font-semibold uppercase text-[11px]';

function catalogOptions(field: FieldSchema, catalog: CatalogSources): string[] {
  switch (field.origem) {
    case 'categorias':
      return catalog.categorias;
    case 'estoque_servicos':
      return catalog.itens;
    case 'marcas':
      return catalog.marcas;
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

/** Controle de um campo simples (não-repeater). */
const FieldControl: React.FC<{
  field: FieldSchema;
  value: unknown;
  onValue: (v: unknown) => void;
  catalog: CatalogSources;
}> = ({ field, value, onValue, catalog }) => {
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
      const opts = catalogOptions(field, catalog);
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
      const opts = catalogOptions(field, catalog);
      const listId = `dl_${field.key}`;
      const known = opts.includes((value as string) || '');
      return (
        <>
          <input list={listId} className={inputCls} value={(value as string) || ''} onChange={(e) => onValue(e.target.value)} placeholder="Buscar no catálogo…" />
          <datalist id={listId}>
            {opts.map((o) => (
              <option key={o} value={o} />
            ))}
          </datalist>
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
                const names = Array.from(e.target.files || []).map((f) => f.name);
                onValue([...arr, ...names]);
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
      );
    }
    case 'assinatura':
      return (
        <button
          type="button"
          onClick={() => onValue(value ? '' : `Assinado em ${new Date().toLocaleString('pt-BR')}`)}
          className={`w-full py-2.5 rounded-lg text-[11px] font-semibold uppercase tracking-wide border-2 border-dashed transition-colors ${
            value ? 'border-emerald-400 text-emerald-700 bg-emerald-50' : 'border-slate-300 text-slate-500 hover:bg-slate-50'
          }`}
        >
          {value ? String(value) : 'Coletar assinatura'}
        </button>
      );
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
}> = ({ field, cards, onCards, catalog, role }) => {
  const schema = field.card_schema || [];
  const addCard = () => {
    const blank: RepeaterCard = {};
    schema.forEach((f) => {
      if (f.default !== undefined) blank[f.key] = f.default;
    });
    onCards([...cards, blank]);
  };
  const updateCard = (idx: number, key: string, v: unknown) => {
    onCards(cards.map((c, i) => (i === idx ? { ...c, [key]: v } : c)));
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
                <div key={f.key} className={f.multilinha ? 'md:col-span-2' : ''}>
                  <label className={labelCls}>
                    {f.label || f.key} {f.obrigatorio && <span className="text-[#E63946]">*</span>}
                  </label>
                  <FieldControl field={f} value={card[f.key]} onValue={(v) => updateCard(idx, f.key, v)} catalog={catalog} />
                </div>
              ))}
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={addCard}
        className="w-full py-2 rounded-lg border border-dashed border-[#1A1A72]/40 text-[11px] font-semibold text-[#1A1A72] hover:bg-[#1A1A72]/5 transition-colors"
      >
        {field.botao_adicionar || '+ Adicionar'}
      </button>
    </div>
  );
};

const Section: React.FC<{
  section: SectionSchema;
  values: FormValues;
  onChange: (key: string, value: unknown) => void;
  catalog: CatalogSources;
  role: string;
}> = ({ section, values, onChange, catalog, role }) => {
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
            const isWide = field.tipo === 'repeater' || field.multilinha || field.tipo === 'multiselect';
            return (
              <div key={field.key} className={isWide ? 'md:col-span-2' : ''}>
                <label className={labelCls}>
                  {field.label || field.key} {field.obrigatorio && <span className="text-[#E63946]">*</span>}
                </label>
                {field.help && <p className="text-[10px] text-slate-400 mb-1">{field.help}</p>}
                {field.tipo === 'repeater' ? (
                  <Repeater
                    field={field}
                    cards={Array.isArray(values[field.key]) ? (values[field.key] as RepeaterCard[]) : []}
                    onCards={(cards) => onChange(field.key, cards)}
                    catalog={catalog}
                    role={role}
                  />
                ) : (
                  <FieldControl field={field} value={values[field.key]} onValue={(v) => onChange(field.key, v)} catalog={catalog} />
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
};

export const FormEngine: React.FC<FormEngineProps> = ({ template, values, onChange, catalog, role }) => {
  return (
    <div className="flex flex-col gap-5">
      {template.secoes.map((section) => (
        <Section key={section.key} section={section} values={values} onChange={onChange} catalog={catalog} role={role} />
      ))}
    </div>
  );
};
