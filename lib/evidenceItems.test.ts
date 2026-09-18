import { describe, expect, it } from 'vitest';
import { buildEvidenceCategoryOptions, coarseFromSubcategory, countPhotosByMoment, equipmentLabel, equipmentToFinalItemFields, equipmentToItemFields, hasEquipment, itemEquipmentAfter, itemEquipmentBefore, photosForItemMoment, effectiveNature, momentSlotsForNature, momentLabelForNature, createPhotoMomentForNature, requiresBeforePhotoOnCreate, resultLabelForNature, NATUREZA_LABEL } from './evidenceItems';
import type { ServiceAttendanceEvidenceItem } from './types';
import { FieldPhoto, FieldPhotoMoment } from './fieldPhotos';
import { TechnicalCatalogItem } from './technicalCatalog';

const photo = (over: Partial<FieldPhoto>): FieldPhoto => ({
  id: Math.random().toString(36).slice(2), sessionId: 's', clientId: 'c',
  storagePathOriginal: 'o', capturadoEm: '2026-01-01T00:00:00Z', clientUuid: 'u', syncStatus: 'sincronizado', ...over,
});
const p = (itemId: string, moment: FieldPhotoMoment) => photo({ evidenceItemId: itemId, evidenceMoment: moment });

describe('countPhotosByMoment (§16/§56)', () => {
  const photos = [
    p('i1', 'ANTES'), p('i1', 'DURANTE'), p('i1', 'DURANTE'), p('i1', 'DEPOIS'), p('i1', 'DEPOIS'),
    p('i2', 'ANTES'),
    photo({ evidenceItemId: undefined, evidenceMoment: 'CENTRAL_ANTES' }), // central geral, sem item
  ];
  it('conta por momento de UM item (1 antes, 2 durante, 2 depois)', () => {
    expect(countPhotosByMoment(photos, 'i1')).toEqual({ antes: 1, durante: 2, depois: 2 });
  });
  it('não mistura fotos de outro item nem fotos sem item', () => {
    expect(countPhotosByMoment(photos, 'i2')).toEqual({ antes: 1, durante: 0, depois: 0 });
  });
  it('item inexistente → zeros', () => {
    expect(countPhotosByMoment(photos, 'x')).toEqual({ antes: 0, durante: 0, depois: 0 });
  });
});

describe('photosForItemMoment (§14/§57)', () => {
  const photos = [p('i1', 'DEPOIS'), p('i1', 'DEPOIS'), p('i1', 'ANTES'), p('i2', 'DEPOIS')];
  it('retorna só as fotos do item no momento pedido', () => {
    expect(photosForItemMoment(photos, 'i1', 'DEPOIS')).toHaveLength(2);
    expect(photosForItemMoment(photos, 'i1', 'ANTES')).toHaveLength(1);
    expect(photosForItemMoment(photos, 'i2', 'DEPOIS')).toHaveLength(1);
  });
});

describe('categorias por área / taxonomia (§25/§26/§37)', () => {
  const cat = (category: string, subcategory: string): TechnicalCatalogItem => ({ id: Math.random().toString(36).slice(2), name: subcategory, category, subcategory });
  const catalog = [
    cat('SDAI', 'Acionador Manual'), cat('SDAI', 'Sirenes/Sinalizadores'),
    cat('SDAI', 'Detectores'), cat('SDAI', 'Centrais'), cat('CFTV', 'Câmeras'),
  ];

  it('OS SDAI recebe categorias SDAI da taxonomia + genéricas', () => {
    const opts = buildEvidenceCategoryOptions(catalog, 'sdai').map((o) => o.label);
    expect(opts).toContain('Acionador Manual');
    expect(opts).toContain('Detectores');
    expect(opts).toContain('Infraestrutura');
    expect(opts).toContain('Cabeamento');
    expect(opts).toContain('Outro');
    expect(opts).not.toContain('Câmeras'); // CFTV não vaza para SDAI
  });

  it('mapeia subcategoria para categoria coarse', () => {
    expect(coarseFromSubcategory('Centrais')).toBe('CENTRAL');
    expect(coarseFromSubcategory('Acionador Manual')).toBe('EQUIPAMENTO');
    expect(coarseFromSubcategory('Cabeamento estruturado')).toBe('CABEAMENTO');
    expect(coarseFromSubcategory('Infraestrutura / eletroduto')).toBe('INFRAESTRUTURA');
  });

  it('a opção de categoria carrega a subcategoria para filtrar equipamento', () => {
    const acionador = buildEvidenceCategoryOptions(catalog, 'SDAI').find((o) => o.label === 'Acionador Manual');
    expect(acionador?.subcategory).toBe('Acionador Manual');
    expect(acionador?.coarse).toBe('EQUIPAMENTO');
  });

  it('sem área/sem taxonomia → só genéricas coarse (não assume SDAI, §33)', () => {
    const opts = buildEvidenceCategoryOptions([], undefined).map((o) => o.coarse);
    expect(opts).toEqual(['EQUIPAMENTO', 'CENTRAL', 'INFRAESTRUTURA', 'CABEAMENTO', 'OUTRO']);
  });
});

describe('substituição de equipamento — Antes × Depois (§21P–§21W)', () => {
  const item = (over: Partial<ServiceAttendanceEvidenceItem>): ServiceAttendanceEvidenceItem => ({
    id: 'i1', serviceAttendanceId: 'a1', title: 'Detector', category: 'EQUIPAMENTO', ...over,
  });

  it('equipmentToFinalItemFields mapeia o instalado (depois)', () => {
    expect(equipmentToFinalItemFields({ catalogItemId: 'x', brand: 'Intelbras', model: 'AFW' }))
      .toEqual({ equipmentFinalCatalogItemId: 'x', equipmentFinalManufacturer: 'Intelbras', equipmentFinalModel: 'AFW' });
  });

  it('itemEquipmentBefore/After extraem os dois estados', () => {
    const it = item({ manufacturer: 'Tecnohold', model: 'IP20', equipmentReplaced: true, equipmentFinalManufacturer: 'Tecnohold', equipmentFinalModel: 'IP67' });
    expect(itemEquipmentBefore(it)).toMatchObject({ brand: 'Tecnohold', model: 'IP20' });
    expect(itemEquipmentAfter(it)).toMatchObject({ brand: 'Tecnohold', model: 'IP67' });
    expect(equipmentLabel(itemEquipmentBefore(it))).toBe('Tecnohold · IP20');
    expect(equipmentLabel(itemEquipmentAfter(it))).toBe('Tecnohold · IP67');
  });

  it('mudança de fabricante é representável (Tecnohold → Intelbras)', () => {
    const it = item({ manufacturer: 'Tecnohold', model: 'DX', equipmentReplaced: true, equipmentFinalManufacturer: 'Intelbras', equipmentFinalModel: 'AFW' });
    expect(equipmentLabel(itemEquipmentBefore(it))).toBe('Tecnohold · DX');
    expect(equipmentLabel(itemEquipmentAfter(it))).toBe('Intelbras · AFW');
  });

  it('sem substituição: after vazio (CASO A = identificação única)', () => {
    const it = item({ manufacturer: 'Tecnohold', model: 'SAVE485TH' });
    expect(hasEquipment(itemEquipmentAfter(it))).toBe(false);
    expect(hasEquipment(itemEquipmentBefore(it))).toBe(true);
  });
});

describe('natureza da intervenção (0112 — MANUTENCAO × INSTALACAO × SUBSTITUICAO)', () => {
  it('§11/§14.10 item legado (sem natureza) é tratado como MANUTENCAO na renderização', () => {
    expect(effectiveNature(undefined)).toBe('MANUTENCAO');
    // rótulos legados = Antes/Durante/Depois (não reescreve o registro)
    expect(momentSlotsForNature(undefined).map((s) => s.short)).toEqual(['Antes', 'Durante', 'Depois']);
  });

  it('§14.1 manutenção mantém o fluxo Antes/Durante/Depois e começa por ANTES', () => {
    expect(momentSlotsForNature('MANUTENCAO').map((s) => s.moment)).toEqual(['ANTES', 'DURANTE', 'DEPOIS']);
    expect(createPhotoMomentForNature('MANUTENCAO')).toBe('ANTES');
    expect(requiresBeforePhotoOnCreate('MANUTENCAO')).toBe(true);
  });

  it('§3/§14.2 instalação NÃO obriga foto ANTES: a 1ª foto é o equipamento INSTALADO (DEPOIS)', () => {
    expect(createPhotoMomentForNature('INSTALACAO')).toBe('DEPOIS');
    expect(requiresBeforePhotoOnCreate('INSTALACAO')).toBe(false);
    const slots = momentSlotsForNature('INSTALACAO');
    // "Local antes" existe mas é OPCIONAL; a evidência principal é o instalado.
    const localAntes = slots.find((s) => s.moment === 'ANTES');
    expect(localAntes?.optional).toBe(true);
    expect(localAntes?.short).toBe('Local antes');
    expect(slots.find((s) => s.moment === 'DEPOIS')?.short).toBe('Instalado');
    // NÃO aparece "Antes" cru em instalação (§7/§10).
    expect(slots.some((s) => s.short === 'Antes')).toBe(false);
    expect(momentLabelForNature('INSTALACAO', 'DEPOIS')).toBe('Equipamento instalado');
  });

  it('§4/§14.5-6 substituição rotula anterior → novo e começa pelo anterior (ANTES)', () => {
    const slots = momentSlotsForNature('SUBSTITUICAO');
    expect(slots.find((s) => s.moment === 'ANTES')?.short).toBe('Anterior');
    expect(slots.find((s) => s.moment === 'DEPOIS')?.short).toBe('Novo');
    expect(createPhotoMomentForNature('SUBSTITUICAO')).toBe('ANTES');
  });

  it('§9 resultado contextual mapeia para o enum canônico, sem enum paralelo', () => {
    expect(resultLabelForNature('RESOLVIDO', 'INSTALACAO')).toBe('Instalado e testado');
    expect(resultLabelForNature('PARCIALMENTE_RESOLVIDO', 'INSTALACAO')).toBe('Instalado com pendência');
    expect(resultLabelForNature('NAO_RESOLVIDO', 'SUBSTITUICAO')).toBe('Não concluído');
    // manutenção mantém a linguagem canônica
    expect(resultLabelForNature('RESOLVIDO', 'MANUTENCAO')).toBe('Resolvido');
    expect(resultLabelForNature('RESOLVIDO', undefined)).toBe('Resolvido');
  });

  it('rótulos das três naturezas', () => {
    expect(NATUREZA_LABEL).toEqual({ MANUTENCAO: 'Manutenção', INSTALACAO: 'Instalação', SUBSTITUICAO: 'Substituição' });
  });

  it('§6/§8 identificação de equipamento nunca traz custo/preço/fornecedor (só catálogo técnico)', () => {
    // Reforça o RBAC: o mapeamento catálogo→item só expõe fabricante/modelo/id.
    const mapped = equipmentToItemFields({ catalogItemId: 'inv1', brand: 'Intelbras', model: 'ANM 24' } as any);
    expect(Object.keys(mapped).sort()).toEqual(['catalogItemId', 'manufacturer', 'model']);
  });
});

describe('equipmentToItemFields (§8/§42)', () => {
  it('mapeia catálogo → campos do item sem inventar', () => {
    expect(equipmentToItemFields({ catalogItemId: 'inv1', brand: 'Tecnohold', model: 'Avalon' }))
      .toEqual({ catalogItemId: 'inv1', manufacturer: 'Tecnohold', model: 'Avalon' });
  });
  it('manual (sem catalogItemId) preserva fabricante/modelo digitados', () => {
    expect(equipmentToItemFields({ brand: 'Marca X', model: 'Modelo Y', manual: true } as any))
      .toEqual({ catalogItemId: undefined, manufacturer: 'Marca X', model: 'Modelo Y' });
  });
  it('vazio → tudo indefinido (não cria produto/estoque)', () => {
    expect(equipmentToItemFields(undefined)).toEqual({ catalogItemId: undefined, manufacturer: undefined, model: undefined });
    expect(equipmentToItemFields({ brand: '  ' })).toEqual({ catalogItemId: undefined, manufacturer: undefined, model: undefined });
  });
});
