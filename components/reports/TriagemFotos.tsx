'use client';

import React, { useState } from 'react';

export interface UnclassifiedPhoto {
  id: string;
  url: string;
  timestamp: string;
  notaRapida?: string;
  grupo?: string;
  local?: string;
  lat?: number;
  lng?: number;
}

interface TriagemFotosProps {
  isOpen: boolean;
  onClose: () => void;
  photos: UnclassifiedPhoto[];
  onUpdatePhotoNota: (id: string, nota: string) => void;
  onAssignPhotosToApontamento: (photoIds: string[], grupo?: string, local?: string, descricao?: string) => void;
  onDeletePhoto: (id: string) => void;
  categoriasGrupos: string[];
}

export const TriagemFotos: React.FC<TriagemFotosProps> = ({
  isOpen,
  onClose,
  photos,
  onUpdatePhotoNota,
  onAssignPhotosToApontamento,
  onDeletePhoto,
  categoriasGrupos,
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [targetGrupo, setTargetGrupo] = useState('');
  const [targetLocal, setTargetLocal] = useState('');
  const [targetDescricao, setTargetDescricao] = useState('');
  const [isListening, setIsListening] = useState<string | null>(null);

  if (!isOpen) return null;

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === photos.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(photos.map((p) => p.id));
    }
  };

  const handleCreateApontamentoEmLote = () => {
    if (selectedIds.length === 0) return;
    onAssignPhotosToApontamento(selectedIds, targetGrupo, targetLocal, targetDescricao);
    setSelectedIds([]);
    setTargetGrupo('');
    setTargetLocal('');
    setTargetDescricao('');
  };

  // Ditado por voz via Web Speech API (se suportado pelo navegador)
  const handleVoiceInput = (photoId: string) => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      alert('Ditado por voz não suportado neste navegador.');
      return;
    }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(photoId);
    recognition.onend = () => setIsListening(null);
    recognition.onerror = () => setIsListening(null);

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      const current = photos.find((p) => p.id === photoId)?.notaRapida || '';
      onUpdatePhotoNota(photoId, `${current} ${transcript}`.trim());
    };

    recognition.start();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-150">
        {/* Topo fixo */}
        <div className="bg-slate-900 text-white p-4 px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#E63946] flex items-center justify-center text-white font-bold">
              <span className="material-symbols-outlined text-xl">collections</span>
            </div>
            <div>
              <h3 className="font-bold text-base tracking-tight flex items-center gap-2">
                Bandeja de Triagem de Fotos
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-red-500/30 text-red-200 border border-red-400/30">
                  {photos.length} foto{photos.length === 1 ? '' : 's'} não classificada{photos.length === 1 ? '' : 's'}
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Captura rápida em campo. As fotos não classificadas entrarão no PDF no "Registro Fotográfico Geral".
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Conteúdo Principal */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {photos.length === 0 ? (
            <div className="text-center py-16 flex flex-col items-center justify-center text-slate-400">
              <span className="material-symbols-outlined text-5xl text-slate-300 mb-3">no_photography</span>
              <p className="font-semibold text-slate-600">Todas as fotos foram classificadas!</p>
              <p className="text-xs max-w-md mt-1 text-slate-400">
                Use o botão flutuante de câmera em campo para capturar fotos rapidamente sem bloquear a inspeção.
              </p>
            </div>
          ) : (
            <>
              {/* Barra de ações em lote */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-xl p-3.5">
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleSelectAll}
                    className="text-xs font-semibold text-slate-700 hover:text-slate-900 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 shadow-sm"
                  >
                    <span className="material-symbols-outlined text-base">
                      {selectedIds.length === photos.length ? 'check_box' : 'check_box_outline_blank'}
                    </span>
                    {selectedIds.length === photos.length ? 'Desmarcar todas' : 'Selecionar todas'}
                  </button>
                  <span className="text-xs font-data-mono text-slate-500">
                    {selectedIds.length} selecionada{selectedIds.length === 1 ? '' : 's'}
                  </span>
                </div>

                {selectedIds.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={targetGrupo}
                      onChange={(e) => setTargetGrupo(e.target.value)}
                      className="text-xs bg-white border border-slate-200 rounded-lg p-2 font-body-md"
                    >
                      <option value="">-- Grupo (opcional) --</option>
                      {categoriasGrupos.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>

                    <input
                      type="text"
                      placeholder="Local (ex: 2º Pavimento - Central)"
                      value={targetLocal}
                      onChange={(e) => setTargetLocal(e.target.value)}
                      className="text-xs bg-white border border-slate-200 rounded-lg p-2 w-48 font-body-md"
                    />

                    <button
                      onClick={handleCreateApontamentoEmLote}
                      className="text-xs font-semibold bg-[#E63946] hover:bg-[#a51515] text-white px-3 py-2 rounded-lg transition-colors flex items-center gap-1 shadow-sm"
                    >
                      <span className="material-symbols-outlined text-base">add_task</span>
                      Criar Apontamento com {selectedIds.length} Foto{selectedIds.length === 1 ? '' : 's'}
                    </button>
                  </div>
                )}
              </div>

              {/* Grid de fotos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {photos.map((photo) => {
                  const isSelected = selectedIds.includes(photo.id);
                  return (
                    <div
                      key={photo.id}
                      className={`relative group bg-white rounded-xl border transition-all overflow-hidden flex flex-col ${
                        isSelected
                          ? 'border-[#E63946] ring-2 ring-[#E63946]/20 shadow-md'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {/* Checkbox de seleção */}
                      <div className="relative h-44 bg-slate-900 overflow-hidden">
                        <img
                          src={photo.url}
                          alt="Fotografia de campo"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        />
                        <button
                          onClick={() => toggleSelect(photo.id)}
                          className={`absolute top-2 left-2 w-7 h-7 rounded-lg flex items-center justify-center shadow-md transition-colors ${
                            isSelected ? 'bg-[#E63946] text-white' : 'bg-black/40 text-white/80 hover:bg-black/60'
                          }`}
                        >
                          <span className="material-symbols-outlined text-base">
                            {isSelected ? 'check' : 'check_box_outline_blank'}
                          </span>
                        </button>
                        <button
                          onClick={() => onDeletePhoto(photo.id)}
                          className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-black/40 text-white/80 hover:bg-red-600 hover:text-white flex items-center justify-center transition-colors shadow-md"
                          title="Remover foto"
                        >
                          <span className="material-symbols-outlined text-sm">delete</span>
                        </button>

                        <div className="absolute bottom-2 left-2 right-2 bg-black/60 backdrop-blur-xs rounded px-2 py-1 flex items-center justify-between text-[10px] text-white/90 font-data-mono">
                          <span>{photo.timestamp}</span>
                          {photo.lat && <span>GPS: OK</span>}
                        </div>
                      </div>

                      {/* Nota rápida / Ditado por voz */}
                      <div className="p-3 flex flex-col gap-2 flex-1 bg-slate-50/50">
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            placeholder="Nota rápida de campo..."
                            value={photo.notaRapida || ''}
                            onChange={(e) => onUpdatePhotoNota(photo.id, e.target.value)}
                            className="flex-1 bg-white border border-slate-200 rounded p-1.5 text-xs font-body-md text-slate-800 focus:outline-none focus:border-[#1A1A72]"
                          />
                          <button
                            type="button"
                            onClick={() => handleVoiceInput(photo.id)}
                            className={`p-1.5 rounded border transition-colors ${
                              isListening === photo.id
                                ? 'bg-red-600 border-red-600 text-white animate-pulse'
                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                            }`}
                            title="Ditado por voz"
                          >
                            <span className="material-symbols-outlined text-base">mic</span>
                          </button>
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1">
                          <span className="font-semibold text-slate-700">
                            {photo.grupo ? `Grupo: ${photo.grupo}` : 'Sem grupo'}
                          </span>
                          <button
                            onClick={() => {
                              setSelectedIds([photo.id]);
                            }}
                            className="text-[#E63946] hover:underline font-semibold"
                          >
                            Criar Apontamento →
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Rodapé fixo */}
        <div className="bg-slate-50 border-t border-slate-200 p-4 px-6 flex items-center justify-between">
          <p className="text-xs text-slate-500 font-data-mono">
            {photos.length} foto(s) na bandeja &middot; Salvas em rascunho
          </p>
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-[#1A1A72] hover:bg-[#12124f] text-white text-xs font-semibold uppercase tracking-wider transition-colors shadow-sm"
          >
            Concluir Triagem
          </button>
        </div>
      </div>
    </div>
  );
};
