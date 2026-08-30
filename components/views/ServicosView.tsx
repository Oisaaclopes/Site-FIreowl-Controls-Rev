'use client';

import React, { useState } from 'react';
import { ServiceCatalogItem } from '@/lib/types';
import { DataListRow, RowMeta, Badge, RowAction } from '@/components/DataListRow';

interface ServicosViewProps {
  services: ServiceCatalogItem[];
  onUpdateService?: (svc: ServiceCatalogItem) => void;
  onDeleteService?: (id: string) => void;
}

/**
 * SERVIÇO = Catálogo de Serviços (e preços normativos).
 * Orçamentos/Propostas foram movidos para PEDIDOS e a Auditoria NBR para
 * RELATÓRIOS — esta página trata apenas do catálogo de serviços técnicos.
 */
export const ServicosView: React.FC<ServicosViewProps> = ({
  services,
  onUpdateService,
  onDeleteService,
}) => {
  // Edição de serviço do catálogo
  const [editService, setEditService] = useState<ServiceCatalogItem | null>(null);

  const handleDeleteService = (svc: ServiceCatalogItem) => {
    if (!onDeleteService) return;
    if (!window.confirm(`Excluir o serviço "${svc.title}"?\n\nEsta ação não pode ser desfeita.`)) return;
    onDeleteService(svc.id);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editService) return;
    onUpdateService?.(editService);
    setEditService(null);
  };

  return (
    <div className="flex flex-col w-full p-4 md:p-8 gap-5 md:gap-6">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-slate-200 pb-5">
        <div>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Engenharia de Incêndio &amp; Operações de Campo SDAI
          </span>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-0.5">
            Catálogo de Serviços &amp; Preços Normativos
          </h1>
        </div>
        <span className="hidden md:flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">
          <span className="material-symbols-outlined text-base">construction</span>
          {services.length} serviço(s)
        </span>
      </div>

      {/* Catálogo de serviços (lista) */}
      {(
        <>
          {services.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm py-16 text-center text-slate-400">
              <span className="material-symbols-outlined text-4xl text-slate-300">construction</span>
              <p className="mt-2 text-sm font-bold text-slate-500 uppercase tracking-wider">
                Nenhum serviço no catálogo
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {services.map((s) => (
                <DataListRow
                  key={s.id}
                  title={
                    <div>
                      <span className="font-data-mono text-[11px] font-bold text-[#1A1A72] block normal-case">
                        {s.code}
                      </span>
                      <span className="uppercase text-sm">{s.title}</span>
                    </div>
                  }
                  meta={<RowMeta label="Categoria" value={s.category} />}
                  center={
                    <div className="flex flex-col items-start md:items-center gap-1.5">
                      <span className="flex items-center gap-1 text-slate-600 font-medium">
                        <span className="material-symbols-outlined text-sm text-slate-400">schedule</span>
                        {s.estimatedHours} horas técnicas
                      </span>
                      <Badge color="blue">{s.nbrNormRef}</Badge>
                    </div>
                  }
                  right={
                    <>
                      <span className="font-data-mono font-bold text-emerald-600 text-base md:text-lg text-right">
                        R$ {s.standardValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                      <div className="flex items-center gap-1">
                        <RowAction
                          icon="delete"
                          label="Excluir serviço"
                          danger
                          onClick={() => handleDeleteService(s)}
                        />
                        <RowAction icon="edit" label="Editar serviço" onClick={() => setEditService(s)} />
                      </div>
                    </>
                  }
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Modal Editar Serviço */}
      {editService && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-xl border border-slate-200 p-6 shadow-2xl relative">
            <button
              onClick={() => setEditService(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 font-bold"
            >
              ✕
            </button>
            <h3 className="text-lg font-bold text-slate-900 uppercase mb-4">Editar Serviço</h3>
            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs font-medium">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 mb-1 font-semibold uppercase">Código</label>
                  <input
                    type="text"
                    value={editService.code}
                    onChange={(e) => setEditService({ ...editService, code: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-slate-900 font-data-mono focus:outline-none focus:ring-2 focus:ring-[#E63946]/20"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1 font-semibold uppercase">Norma (NBR/IT)</label>
                  <input
                    type="text"
                    value={editService.nbrNormRef}
                    onChange={(e) => setEditService({ ...editService, nbrNormRef: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#E63946]/20"
                  />
                </div>
              </div>
              <div>
                <label className="block text-slate-600 mb-1 font-semibold uppercase">Título do Serviço</label>
                <input
                  type="text"
                  required
                  value={editService.title}
                  onChange={(e) => setEditService({ ...editService, title: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#E63946]/20"
                />
              </div>
              <div>
                <label className="block text-slate-600 mb-1 font-semibold uppercase">Categoria</label>
                <input
                  type="text"
                  value={editService.category}
                  onChange={(e) => setEditService({ ...editService, category: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#E63946]/20"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 mb-1 font-semibold uppercase">Horas estimadas</label>
                  <input
                    type="number"
                    min={0}
                    value={editService.estimatedHours}
                    onChange={(e) => setEditService({ ...editService, estimatedHours: Number(e.target.value) })}
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-slate-900 font-data-mono focus:outline-none focus:ring-2 focus:ring-[#E63946]/20"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1 font-semibold uppercase">Valor padrão (R$)</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={editService.standardValue}
                    onChange={(e) => setEditService({ ...editService, standardValue: Number(e.target.value) })}
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-slate-900 font-data-mono focus:outline-none focus:ring-2 focus:ring-[#E63946]/20"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full bg-[#E63946] hover:bg-[#a51515] text-white py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors shadow-sm"
              >
                Salvar Alterações
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
