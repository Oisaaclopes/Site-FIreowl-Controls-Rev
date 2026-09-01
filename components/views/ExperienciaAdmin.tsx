'use client';
import { showToast, requestConfirm } from '@/components/ui/Feedback';

import React, { useMemo, useState } from 'react';
import { EmpresaAtendida, MarcaTecnologia, AutorizacaoMarca } from '@/lib/types';
import { AREAS_PROPOSTA } from '@/lib/propostaTitulo';
import { uploadInstitucionalLogo, removeInstitucionalLogo } from '@/lib/institucional';

const SEGMENTOS_SUGERIDOS = ['Varejo', 'Atacado', 'Shopping Center', 'Indústria', 'Logística', 'Corporativo', 'Condomínios', 'Educação', 'Saúde', 'Hotelaria', 'Centros de Distribuição', 'Agronegócio', 'Outros'];
const CATEGORIAS_MARCA = ['SDAI', 'CFTV', 'Controle de Acesso', 'Automação', 'BMS', 'Segurança Eletrônica', 'Infraestrutura', 'Comunicação', 'Integração', 'Outros'];
const AREAS = AREAS_PROPOSTA.filter((a) => a.id !== 'outro');

const inputCls = 'w-full border border-slate-200 rounded-lg p-2 text-xs text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#E63946]/20';
const labelCls = 'block text-slate-500 mb-1 font-semibold uppercase text-[10px] tracking-wide';
const uid = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `id_${Date.now()}_${Math.random().toString(36).slice(2)}`);

// ---- Peças reutilizáveis ----
function TagInput({ value, onChange, suggestions, placeholder }: { value: string[]; onChange: (v: string[]) => void; suggestions?: string[]; placeholder?: string }) {
  const [txt, setTxt] = useState('');
  const add = (t: string) => { const v = t.trim(); if (v && !value.includes(v)) onChange([...value, v]); setTxt(''); };
  return (
    <div>
      <div className="flex flex-wrap gap-1 mb-1">
        {value.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 text-[10px] font-semibold bg-slate-100 text-slate-700 rounded px-1.5 py-0.5">
            {t}<button type="button" onClick={() => onChange(value.filter((x) => x !== t))} className="text-slate-400 hover:text-[#E63946]">✕</button>
          </span>
        ))}
      </div>
      <input list={placeholder} value={txt} placeholder={placeholder} onChange={(e) => setTxt(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(txt); } }} onBlur={() => add(txt)} className={inputCls} />
      {suggestions && <datalist id={placeholder}>{suggestions.map((s) => <option key={s} value={s} />)}</datalist>}
    </div>
  );
}

function AreaChecks({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  return (
    <div className="flex flex-wrap gap-1.5">
      {AREAS.map((a) => {
        const on = value.includes(a.id);
        return (
          <button key={a.id} type="button" onClick={() => toggle(a.id)} className={`text-[10px] font-bold rounded px-2 py-1 border ${on ? 'bg-[#0B1E38] text-white border-[#0B1E38]' : 'bg-white text-slate-500 border-slate-300 hover:border-[#0B1E38]'}`}>
            {a.sigla}
          </button>
        );
      })}
    </div>
  );
}

function LogoBox({ path, previewUrl, busy, onUpload, onRemove }: { path?: string; previewUrl?: string; busy?: boolean; onUpload: (f: File) => void; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-12 rounded bg-slate-50 border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
        {previewUrl ? <img src={previewUrl} alt="logo" className="max-h-10 max-w-full object-contain" /> : path ? <span className="material-symbols-outlined text-emerald-500 text-lg">check_circle</span> : <span className="material-symbols-outlined text-slate-300 text-lg">image</span>}
      </div>
      {path ? (
        <button type="button" onClick={onRemove} className="text-[10px] font-bold uppercase text-slate-400 hover:text-[#E63946]">remover</button>
      ) : (
        <label className={`text-[10px] font-bold uppercase cursor-pointer ${busy ? 'text-slate-400' : 'text-[#1A1A72] hover:text-[#E63946]'}`}>
          {busy ? 'enviando…' : 'enviar logo'}
          <input type="file" accept="image/svg+xml,image/png,image/*" className="hidden" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ''; }} />
        </label>
      )}
    </div>
  );
}

interface Props {
  empresas: EmpresaAtendida[];
  marcas: MarcaTecnologia[];
  onSaveEmpresa: (e: EmpresaAtendida) => void;
  onDeleteEmpresa: (id: string) => void;
  onSaveMarca: (m: MarcaTecnologia) => void;
  onDeleteMarca: (id: string) => void;
}

const emptyEmpresa = (ordem: number): EmpresaAtendida => ({ id: uid(), nome: '', nomeFantasia: '', logoPath: undefined, descricao: '', segmentos: [], areas: [], destaque: false, ativo: true, exibirProposta: true, autorizacao: 'nao_informado', ordem });
const emptyMarca = (ordem: number): MarcaTecnologia => ({ id: uid(), nome: '', logoPath: undefined, descricao: '', categoria: '', areas: [], tecnologias: [], ativo: true, exibirProposta: true, ordem });

export const ExperienciaAdmin: React.FC<Props> = ({ empresas, marcas, onSaveEmpresa, onDeleteEmpresa, onSaveMarca, onDeleteMarca }) => {
  const [sub, setSub] = useState<'empresas' | 'marcas'>('empresas');
  const [empDraft, setEmpDraft] = useState<EmpresaAtendida | null>(null);
  const [marDraft, setMarDraft] = useState<MarcaTecnologia | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | undefined>(undefined);

  const empresasOrd = useMemo(() => [...empresas].sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome)), [empresas]);
  const marcasOrd = useMemo(() => [...marcas].sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome)), [marcas]);

  const uploadLogo = async (file: File, slug: string, set: (path: string) => void) => {
    setBusy(true);
    try { const path = await uploadInstitucionalLogo(file, slug); set(path); setPreview(URL.createObjectURL(file)); }
    catch { showToast('Não foi possível enviar o logo.'); }
    finally { setBusy(false); }
  };
  const removeLogo = async (path: string | undefined, clear: () => void) => {
    if (path) { try { await removeInstitucionalLogo(path); } catch { /* best-effort */ } }
    clear(); setPreview(undefined);
  };
  const move = <T extends { id: string; ordem: number }>(list: T[], id: string, dir: -1 | 1, save: (x: T) => void) => {
    const i = list.findIndex((x) => x.id === id); const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    const a = { ...list[i], ordem: list[j].ordem }; const b = { ...list[j], ordem: list[i].ordem };
    save(a); save(b);
  };

  const chip = (txt: string, tone: 'ok' | 'off' | 'gold') => (
    <span className={`text-[9px] font-bold uppercase rounded px-1.5 py-0.5 ${tone === 'ok' ? 'bg-emerald-50 text-emerald-700' : tone === 'gold' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-400'}`}>{txt}</span>
  );

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">Experiência, Clientes e Marcas</h3>
          <p className="text-[11px] text-slate-400">Empresas atendidas e marcas exibidas na página institucional das propostas.</p>
        </div>
        <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs font-bold">
          <button type="button" onClick={() => setSub('empresas')} className={`px-3 py-1.5 ${sub === 'empresas' ? 'bg-[#0B1E38] text-white' : 'bg-white text-slate-500'}`}>Empresas ({empresas.length})</button>
          <button type="button" onClick={() => setSub('marcas')} className={`px-3 py-1.5 ${sub === 'marcas' ? 'bg-[#0B1E38] text-white' : 'bg-white text-slate-500'}`}>Marcas ({marcas.length})</button>
        </div>
      </div>

      {sub === 'empresas' ? (
        <div className="space-y-3">
          {empDraft ? (
            <div className="rounded-xl border border-[#0B1E38]/30 bg-slate-50 p-3 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div><label className={labelCls}>Nome da empresa *</label><input value={empDraft.nome} onChange={(e) => setEmpDraft({ ...empDraft, nome: e.target.value })} className={inputCls} /></div>
                <div><label className={labelCls}>Nome fantasia</label><input value={empDraft.nomeFantasia || ''} onChange={(e) => setEmpDraft({ ...empDraft, nomeFantasia: e.target.value })} className={inputCls} /></div>
              </div>
              <div><label className={labelCls}>Logo</label><LogoBox path={empDraft.logoPath} previewUrl={preview} busy={busy} onUpload={(f) => uploadLogo(f, `empresa_${empDraft.nome || 'x'}`, (path) => setEmpDraft((d) => d && { ...d, logoPath: path }))} onRemove={() => removeLogo(empDraft.logoPath, () => setEmpDraft((d) => d && { ...d, logoPath: undefined }))} /></div>
              <div><label className={labelCls}>Segmentos</label><TagInput value={empDraft.segmentos} onChange={(v) => setEmpDraft({ ...empDraft, segmentos: v })} suggestions={SEGMENTOS_SUGERIDOS} placeholder="Segmento" /></div>
              <div><label className={labelCls}>Áreas relacionadas</label><AreaChecks value={empDraft.areas} onChange={(v) => setEmpDraft({ ...empDraft, areas: v })} /></div>
              <div><label className={labelCls}>Descrição (opcional)</label><input value={empDraft.descricao || ''} onChange={(e) => setEmpDraft({ ...empDraft, descricao: e.target.value })} className={inputCls} /></div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
                <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600"><input type="checkbox" checked={empDraft.destaque} onChange={(e) => setEmpDraft({ ...empDraft, destaque: e.target.checked })} />Destaque</label>
                <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600"><input type="checkbox" checked={empDraft.ativo} onChange={(e) => setEmpDraft({ ...empDraft, ativo: e.target.checked })} />Ativo</label>
                <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600"><input type="checkbox" checked={empDraft.exibirProposta} onChange={(e) => setEmpDraft({ ...empDraft, exibirProposta: e.target.checked })} />Exibir em propostas</label>
                <div><label className={labelCls}>Autorização da marca</label>
                  <select value={empDraft.autorizacao} onChange={(e) => setEmpDraft({ ...empDraft, autorizacao: e.target.value as AutorizacaoMarca })} className={inputCls}>
                    <option value="nao_informado">Não informado</option><option value="autorizado">Autorizado</option><option value="nao_autorizado">Não autorizado</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <button type="button" disabled={!empDraft.nome.trim()} onClick={() => { onSaveEmpresa(empDraft); setEmpDraft(null); setPreview(undefined); }} className="bg-[#0B1E38] hover:bg-[#13315C] disabled:opacity-40 text-white text-xs font-bold uppercase px-4 py-2 rounded-lg">Salvar empresa</button>
                <button type="button" onClick={() => { setEmpDraft(null); setPreview(undefined); }} className="text-xs font-bold uppercase text-slate-400 hover:text-slate-700 px-3">Cancelar</button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => { setEmpDraft(emptyEmpresa(empresas.length)); setPreview(undefined); }} className="text-xs font-bold uppercase text-[#1A1A72] hover:text-[#E63946] flex items-center gap-1"><span className="material-symbols-outlined text-base">add</span>Adicionar empresa atendida</button>
          )}
          <div className="space-y-1.5">
            {empresasOrd.map((e, idx) => (
              <div key={e.id} className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${e.ativo ? 'bg-white border-slate-200' : 'bg-slate-50 border-dashed border-slate-200 opacity-70'}`}>
                <div className="flex flex-col shrink-0 -my-1">
                  <button type="button" onClick={() => move(empresasOrd, e.id, -1, onSaveEmpresa)} disabled={idx === 0} className="text-slate-300 hover:text-[#0B1E38] disabled:opacity-25 text-[11px] leading-none">▲</button>
                  <button type="button" onClick={() => move(empresasOrd, e.id, 1, onSaveEmpresa)} disabled={idx === empresasOrd.length - 1} className="text-slate-300 hover:text-[#0B1E38] disabled:opacity-25 text-[11px] leading-none">▼</button>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-800 truncate">{e.nomeFantasia || e.nome}</p>
                  <div className="flex flex-wrap gap-1 mt-0.5 items-center">
                    {e.destaque && chip('Destaque', 'gold')}
                    {e.exibirProposta ? chip('Em propostas', 'ok') : chip('Oculta', 'off')}
                    {e.autorizacao === 'nao_autorizado' && chip('Não autorizada', 'off')}
                    <span className="text-[9px] text-slate-400">{e.areas.map((a) => AREAS.find((x) => x.id === a)?.sigla).filter(Boolean).join(' · ')}</span>
                  </div>
                </div>
                <button type="button" onClick={() => { setEmpDraft(e); setPreview(undefined); }} className="text-slate-400 hover:text-[#0B1E38] p-1" title="Editar"><span className="material-symbols-outlined text-base">edit</span></button>
                <button type="button" onClick={async () => { if (await requestConfirm(`Excluir "${e.nome}"?`)) onDeleteEmpresa(e.id); }} className="text-slate-400 hover:text-[#E63946] p-1" title="Excluir"><span className="material-symbols-outlined text-base">delete</span></button>
              </div>
            ))}
            {empresasOrd.length === 0 && <p className="text-[11px] text-slate-400 italic">Nenhuma empresa cadastrada.</p>}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {marDraft ? (
            <div className="rounded-xl border border-[#0B1E38]/30 bg-slate-50 p-3 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div><label className={labelCls}>Nome da marca *</label><input value={marDraft.nome} onChange={(e) => setMarDraft({ ...marDraft, nome: e.target.value })} className={inputCls} /></div>
                <div><label className={labelCls}>Categoria</label>
                  <select value={marDraft.categoria || ''} onChange={(e) => setMarDraft({ ...marDraft, categoria: e.target.value })} className={inputCls}>
                    <option value="">Não definida</option>{CATEGORIAS_MARCA.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div><label className={labelCls}>Logo</label><LogoBox path={marDraft.logoPath} previewUrl={preview} busy={busy} onUpload={(f) => uploadLogo(f, `marca_${marDraft.nome || 'x'}`, (path) => setMarDraft((d) => d && { ...d, logoPath: path }))} onRemove={() => removeLogo(marDraft.logoPath, () => setMarDraft((d) => d && { ...d, logoPath: undefined }))} /></div>
              <div><label className={labelCls}>Áreas relacionadas</label><AreaChecks value={marDraft.areas} onChange={(v) => setMarDraft({ ...marDraft, areas: v })} /></div>
              <div><label className={labelCls}>Tecnologias</label><TagInput value={marDraft.tecnologias} onChange={(v) => setMarDraft({ ...marDraft, tecnologias: v })} placeholder="Tecnologia" /></div>
              <div><label className={labelCls}>Descrição (opcional)</label><input value={marDraft.descricao || ''} onChange={(e) => setMarDraft({ ...marDraft, descricao: e.target.value })} className={inputCls} /></div>
              <div className="flex gap-4">
                <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600"><input type="checkbox" checked={marDraft.ativo} onChange={(e) => setMarDraft({ ...marDraft, ativo: e.target.checked })} />Ativo</label>
                <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600"><input type="checkbox" checked={marDraft.exibirProposta} onChange={(e) => setMarDraft({ ...marDraft, exibirProposta: e.target.checked })} />Exibir em propostas</label>
              </div>
              <div className="flex gap-2">
                <button type="button" disabled={!marDraft.nome.trim()} onClick={() => { onSaveMarca(marDraft); setMarDraft(null); setPreview(undefined); }} className="bg-[#0B1E38] hover:bg-[#13315C] disabled:opacity-40 text-white text-xs font-bold uppercase px-4 py-2 rounded-lg">Salvar marca</button>
                <button type="button" onClick={() => { setMarDraft(null); setPreview(undefined); }} className="text-xs font-bold uppercase text-slate-400 hover:text-slate-700 px-3">Cancelar</button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => { setMarDraft(emptyMarca(marcas.length)); setPreview(undefined); }} className="text-xs font-bold uppercase text-[#1A1A72] hover:text-[#E63946] flex items-center gap-1"><span className="material-symbols-outlined text-base">add</span>Adicionar marca/tecnologia</button>
          )}
          <div className="space-y-1.5">
            {marcasOrd.map((m, idx) => (
              <div key={m.id} className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${m.ativo ? 'bg-white border-slate-200' : 'bg-slate-50 border-dashed border-slate-200 opacity-70'}`}>
                <div className="flex flex-col shrink-0 -my-1">
                  <button type="button" onClick={() => move(marcasOrd, m.id, -1, onSaveMarca)} disabled={idx === 0} className="text-slate-300 hover:text-[#0B1E38] disabled:opacity-25 text-[11px] leading-none">▲</button>
                  <button type="button" onClick={() => move(marcasOrd, m.id, 1, onSaveMarca)} disabled={idx === marcasOrd.length - 1} className="text-slate-300 hover:text-[#0B1E38] disabled:opacity-25 text-[11px] leading-none">▼</button>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-800 truncate">{m.nome}</p>
                  <div className="flex flex-wrap gap-1 mt-0.5 items-center">
                    {m.categoria ? <span className="text-[9px] text-slate-400">{m.categoria}</span> : null}
                    {m.exibirProposta ? chip('Em propostas', 'ok') : chip('Oculta', 'off')}
                    <span className="text-[9px] text-slate-400">{m.areas.map((a) => AREAS.find((x) => x.id === a)?.sigla).filter(Boolean).join(' · ')}</span>
                  </div>
                </div>
                <button type="button" onClick={() => { setMarDraft(m); setPreview(undefined); }} className="text-slate-400 hover:text-[#0B1E38] p-1" title="Editar"><span className="material-symbols-outlined text-base">edit</span></button>
                <button type="button" onClick={async () => { if (await requestConfirm(`Excluir "${m.nome}"?`)) onDeleteMarca(m.id); }} className="text-slate-400 hover:text-[#E63946] p-1" title="Excluir"><span className="material-symbols-outlined text-base">delete</span></button>
              </div>
            ))}
            {marcasOrd.length === 0 && <p className="text-[11px] text-slate-400 italic">Nenhuma marca cadastrada.</p>}
          </div>
        </div>
      )}
    </div>
  );
};
