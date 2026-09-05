'use client';
import React, { useMemo, useState } from 'react';
import { Device, AssetSourceValue } from '@/lib/types';
import { TechArea, AREA_LABEL, AREAS, assetDisplayIdentifier } from '@/lib/technicalBase';
import {
  parseSpreadsheet, guessMapping, importTargets, buildImportPreview, ImportPreview, DeviceDraft,
} from '@/lib/technicalImport';
import { upsertDevice } from '@/lib/devices';
import { newAssetId } from '@/lib/surveyCapture';
import { showToast } from '@/components/ui/Feedback';
import { isSupabaseConfigured } from '@/lib/inventory';

/* ==========================================================================
 * ETAPA 3D.2 — Importação assistida de Base Técnica (XLSX/CSV, §9–§12).
 * Fluxo: upload → detectar colunas → mapear → pré-visualizar → validar →
 * importar. Converge para o MESMO modelo (devices), source=IMPORTACAO. Importado
 * NUNCA é "verificado em campo" (§12): não recebe condição/verificação.
 * ========================================================================== */

const inputCls = 'w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg focus:border-primary focus:outline-none';

interface Props {
  clienteId: string;
  area: TechArea;
  existingDevices: Device[];
  onClose: () => void;
  onImported: () => void;
}

export const TechnicalBaseImport: React.FC<Props> = ({ clienteId, area: initialArea, existingDevices, onClose, onImported }) => {
  const [area, setArea] = useState<TechArea>(initialArea);
  const [step, setStep] = useState<'upload' | 'map' | 'preview' | 'done'>('upload');
  const [matrix, setMatrix] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<number, string>>({});
  const [includeBaseDupes, setIncludeBaseDupes] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importedCount, setImportedCount] = useState(0);

  const targets = useMemo(() => importTargets(area), [area]);
  const headers = matrix[0] || [];
  const baseAssets = useMemo(() => existingDevices.filter((d) => d.sistema === area).map((d) => ({
    central: d.central, laco: d.laco, endereco: d.endereco, technicalAttributes: d.technicalAttributes,
  })), [existingDevices, area]);

  const preview: ImportPreview | null = useMemo(
    () => (matrix.length > 1 ? buildImportPreview(matrix, mapping, area, baseAssets) : null),
    [matrix, mapping, area, baseAssets],
  );

  const onFile = async (file: File | null) => {
    if (!file) return;
    try {
      const rows = await parseSpreadsheet(file);
      if (rows.length < 2) { showToast('Arquivo sem linhas de dados (precisa de cabeçalho + 1 linha).'); return; }
      setMatrix(rows);
      setMapping(guessMapping(rows[0], area));
      setStep('map');
    } catch (e: any) { showToast(`Não foi possível ler o arquivo: ${e?.message || e}`); }
  };

  // Reaplica auto-map quando muda a área na etapa de mapeamento.
  const changeArea = (a: TechArea) => { setArea(a); if (matrix.length) setMapping(guessMapping(matrix[0], a)); };

  const draftToDevice = (draft: DeviceDraft): Device => ({
    id: newAssetId(), clienteId, sistema: area, status: 'ativo',
    grupo: draft.grupo, tipoAtivo: draft.tipoAtivo, fabricante: draft.fabricante, modelo: draft.modelo,
    serial: draft.serial, localizacao: draft.localizacao,
    central: draft.central, laco: draft.laco, endereco: draft.endereco,
    technicalAttributes: draft.technicalAttributes,
    source: 'IMPORTACAO' as AssetSourceValue,
    // §12: importado NÃO é verificado — sem condição em campo.
  } as Device);

  const runImport = async () => {
    if (!preview || !isSupabaseConfigured()) { showToast('Supabase não configurado.'); return; }
    const toImport = preview.results.filter((r) => r.valid && !r.duplicateInFile && (includeBaseDupes || !r.duplicateInBase));
    if (toImport.length === 0) { showToast('Nenhuma linha elegível para importar.'); return; }
    setImporting(true);
    let ok = 0;
    try {
      for (const r of toImport) {
        try { await upsertDevice(draftToDevice(r.draft)); ok++; } catch { /* segue as demais */ }
      }
      setImportedCount(ok);
      setStep('done');
      onImported();
      showToast(`${ok} ativo(s) importado(s) (não verificados em campo).`);
    } finally { setImporting(false); }
  };

  const eligible = preview ? preview.results.filter((r) => r.valid && !r.duplicateInFile && (includeBaseDupes || !r.duplicateInBase)).length : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-surface" onClick={(e) => e.stopPropagation()}>
        <header className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-base font-bold text-fg">Importar Base Técnica — {AREA_LABEL[area]}</h3>
          <button onClick={onClose} className="material-symbols-outlined text-fg-muted hover:text-fg">close</button>
        </header>

        <div className="flex-1 overflow-y-auto p-4">
          {step === 'upload' && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1"><span className="text-xs font-semibold text-fg-secondary">Disciplina</span>
                  <select value={area} onChange={(e) => changeArea(e.target.value as TechArea)} className={inputCls}>
                    {AREAS.map((a) => <option key={a} value={a}>{AREA_LABEL[a]}</option>)}
                  </select>
                </label>
                <label className="flex flex-col gap-1"><span className="text-xs font-semibold text-fg-secondary">Arquivo (XLSX ou CSV)</span>
                  <input type="file" accept=".xlsx,.csv,text/csv" onChange={(e) => onFile(e.target.files?.[0] || null)} className={inputCls} />
                </label>
              </div>
              <p className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-[11px] text-fg-muted">
                Aceita cabeçalhos livres — na próxima etapa você confirma o mapeamento das colunas. Nada é importado sem sua confirmação. Ativos importados entram como <b>não verificados em campo</b> (§12).
              </p>
            </div>
          )}

          {step === 'map' && (
            <div className="flex flex-col gap-3">
              <p className="text-xs text-fg-secondary">Confirme para onde vai cada coluna do arquivo (§10). Colunas em “Ignorar” não são importadas.</p>
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-2 text-[10px] uppercase tracking-wider text-fg-muted">
                    <tr><th className="px-3 py-2">Coluna do arquivo</th><th className="px-3 py-2">Exemplo</th><th className="px-3 py-2">Mapear para</th></tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {headers.map((h, i) => (
                      <tr key={i} className="bg-surface">
                        <td className="px-3 py-2 font-semibold text-fg">{h || `Coluna ${i + 1}`}</td>
                        <td className="px-3 py-2 text-fg-muted">{(matrix[1]?.[i] ?? '').slice(0, 24) || '—'}</td>
                        <td className="px-3 py-2">
                          <select value={mapping[i] || ''} onChange={(e) => {
                            const v = e.target.value;
                            setMapping((prev) => {
                              const next = { ...prev };
                              // um alvo por coluna; libera o alvo antes usado por outra coluna
                              if (v) for (const k of Object.keys(next)) if (next[Number(k)] === v) delete next[Number(k)];
                              if (v) next[i] = v; else delete next[i];
                              return next;
                            });
                          }} className="rounded-lg border border-border bg-surface px-2 py-1 text-xs">
                            <option value="">Ignorar</option>
                            {targets.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {step === 'preview' && preview && (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                <PvStat label="Linhas" value={preview.total} />
                <PvStat label="Válidas" value={preview.valid} tone="emerald" />
                <PvStat label="Inválidas" value={preview.invalid} tone="red" />
                <PvStat label="Dup. arquivo" value={preview.duplicatesInFile} tone="amber" />
                <PvStat label="Dup. base" value={preview.duplicatesInBase} tone="amber" />
                <PvStat label="A importar" value={eligible} tone="blue" />
              </div>
              {preview.unmappedColumns.length > 0 && (
                <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                  Colunas não mapeadas (serão ignoradas): {preview.unmappedColumns.join(', ')}
                </p>
              )}
              <label className="flex items-center gap-2 text-xs text-fg-secondary">
                <input type="checkbox" checked={includeBaseDupes} onChange={(e) => setIncludeBaseDupes(e.target.checked)} />
                Importar mesmo as que já existem na base (cria novo registro; padrão: pular)
              </label>
              <div className="max-h-80 overflow-auto rounded-xl border border-border">
                <table className="w-full min-w-[560px] text-left text-xs">
                  <thead className="sticky top-0 bg-surface-2 text-[10px] uppercase tracking-wider text-fg-muted">
                    <tr><th className="px-3 py-2">#</th><th className="px-3 py-2">Identificador</th><th className="px-3 py-2">Tipo / Fab.</th><th className="px-3 py-2">Situação</th></tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {preview.results.slice(0, 300).map((r) => {
                      const ident = assetDisplayIdentifier(area, { central: r.draft.central, laco: r.draft.laco, endereco: r.draft.endereco, technicalAttributes: r.draft.technicalAttributes });
                      return (
                        <tr key={r.row} className="bg-surface">
                          <td className="px-3 py-1.5 text-fg-muted">{r.row + 2}</td>
                          <td className="px-3 py-1.5 font-data-mono text-fg">{ident || '—'}</td>
                          <td className="px-3 py-1.5 text-fg-secondary">{[r.draft.tipoAtivo, r.draft.fabricante].filter(Boolean).join(' · ') || '—'}</td>
                          <td className="px-3 py-1.5">
                            {!r.valid ? <span className="text-danger">{r.errors[0] || 'inválida'}</span>
                              : r.duplicateInFile ? <span className="text-amber-600">duplicada no arquivo</span>
                              : r.duplicateInBase ? <span className="text-amber-600">já existe na base</span>
                              : <span className="text-emerald-600">ok</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {preview.results.length > 300 && <p className="px-3 py-2 text-[11px] text-fg-muted">Mostrando 300 de {preview.results.length} linhas.</p>}
              </div>
            </div>
          )}

          {step === 'done' && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <span className="material-symbols-outlined text-5xl text-emerald-600">task_alt</span>
              <p className="text-sm font-semibold text-fg">{importedCount} ativo(s) importado(s) para a Base Técnica.</p>
              <p className="text-xs text-fg-muted">Entraram como <b>não verificados em campo</b>. Use um levantamento para verificá-los.</p>
            </div>
          )}
        </div>

        <footer className="shrink-0 border-t border-border p-3">
          <div className="flex justify-end gap-2">
            {step === 'map' && <>
              <button onClick={() => setStep('upload')} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-fg-secondary hover:bg-surface-2">Voltar</button>
              <button onClick={() => setStep('preview')} className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-navy">Pré-visualizar</button>
            </>}
            {step === 'preview' && <>
              <button onClick={() => setStep('map')} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-fg-secondary hover:bg-surface-2">Ajustar mapeamento</button>
              <button onClick={runImport} disabled={importing || eligible === 0} className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-navy disabled:opacity-50">{importing ? 'Importando…' : `Importar ${eligible}`}</button>
            </>}
            {step === 'done' && <button onClick={onClose} className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-navy">Concluir</button>}
          </div>
        </footer>
      </div>
    </div>
  );
};

const PvStat: React.FC<{ label: string; value: number; tone?: 'emerald' | 'amber' | 'red' | 'blue' }> = ({ label, value, tone }) => (
  <div className="rounded-lg border border-border bg-surface px-2 py-1.5 text-center">
    <p className="text-[9px] uppercase tracking-wider text-fg-muted">{label}</p>
    <p className={`font-data-mono text-lg font-bold ${tone === 'red' ? 'text-danger' : tone === 'amber' ? 'text-amber-600' : tone === 'blue' ? 'text-blue-600' : tone === 'emerald' ? 'text-emerald-600' : 'text-fg'}`}>{value}</p>
  </div>
);
