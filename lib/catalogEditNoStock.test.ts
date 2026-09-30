import { describe, expect, it, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { InventoryItem } from './types';

// Supabase simulado: registra o payload de UPDATE e devolve a linha "do banco"
// (saldo ATUAL 10 — outro usuário fez uma entrada enquanto o formulário estava
// aberto com saldo 5) mesclada com o payload: se o saldo fosse enviado, o
// retorno voltaria para 5 e o teste falharia.
const calls: { table: string; payload: Record<string, unknown> }[] = [];
const DB_ROW = { id: 'p1', code: 'NB-1', name: 'Nobreak', category: 'INFRA', quantity: 10, reserved_quantity: 2, min_quantity: 1, unit_price: 0 };
vi.mock('./supabaseClient', () => ({
  getSupabaseClient: () => ({
    from: (table: string) => ({
      update: (payload: Record<string, unknown>) => {
        calls.push({ table, payload });
        const chain = { eq: () => chain, select: () => chain, single: async () => ({ data: { ...DB_ROW, ...payload }, error: null }) };
        return chain;
      },
    }),
  }),
}));

import { updateInventoryCatalog, updateInventoryItem, catalogEditRow, STOCK_FLOW_COLUMNS } from './inventory';
import { resolveClassificationStatus } from './catalogTree';
import { commercialAreaOptions } from './catalogApplicability';

// Snapshot do formulário: saldo 5 (desatualizado).
const stale: InventoryItem = {
  id: 'p1', code: 'NB-1', name: 'Nobreak', category: 'INFRA', quantity: 5, reservedQuantity: 0, minQuantity: 1,
  unitPrice: 0, supplier: '', location: '', canonicalTaxonomyId: 'n1', classificationStatus: 'REVISAR', applicableAreas: ['CFTV'],
} as InventoryItem;

beforeEach(() => { calls.length = 0; });

describe('REGRESSÃO — edição de cadastro nunca grava saldo', () => {
  const cenarios: Array<[string, Partial<InventoryItem>]> = [
    ['classificação', { canonicalTaxonomyId: 'n2', classificationStatus: 'CLASSIFICADO' }],
    ['aplicabilidade', { applicableAreas: ['CFTV', 'ALARME'] }],
    ['nome/modelo', { name: 'Nobreak 1200VA', model: 'NB 1200' }],
  ];
  for (const [nome, mudanca] of cenarios) {
    it(`salvar ${nome} não envia quantity/reserved_quantity e preserva o saldo atual do banco`, async () => {
      const saved = await updateInventoryCatalog({ ...stale, ...mudanca });
      expect(calls).toHaveLength(1);
      expect(calls[0].table).toBe('inventory_items');
      for (const col of STOCK_FLOW_COLUMNS) expect(calls[0].payload).not.toHaveProperty(col);
      expect(saved.quantity).toBe(10);          // não voltou para 5
      expect(saved.reservedQuantity).toBe(2);
    });
  }

  it('o que mudou no cadastro é gravado', async () => {
    await updateInventoryCatalog({ ...stale, name: 'Nobreak 1200VA', canonicalTaxonomyId: 'n2' });
    expect(calls[0].payload).toMatchObject({ name: 'Nobreak 1200VA', canonical_taxonomy_id: 'n2' });
  });

  it('catalogEditRow remove exatamente as colunas de saldo', () => {
    const row = catalogEditRow(stale);
    expect(row).not.toHaveProperty('quantity');
    expect(row).not.toHaveProperty('reserved_quantity');
    expect(row).toHaveProperty('min_quantity', 1); // parâmetro de cadastro, não saldo
  });

  it('contraste: o fluxo de movimentação continua gravando o saldo', async () => {
    await updateInventoryItem({ ...stale, quantity: 7 });
    expect(calls[0].payload).toHaveProperty('quantity', 7);
  });

  it('Estoque › Editar usa o fluxo de cadastro (nunca o de movimentação)', () => {
    const src = readFileSync(join(__dirname, '..', 'components', 'views', 'CatalogoView.tsx'), 'utf8');
    const save = src.slice(src.indexOf('const handleSaveProduct'), src.indexOf('const handleDeleteProduct'));
    expect(save).toContain('onEditInventoryCatalog(item, opts)');
    expect(save).not.toContain('onUpdateInventoryItem');
    const app = readFileSync(join(__dirname, '..', 'components', 'CrmApp.tsx'), 'utf8');
    const edit = app.slice(app.indexOf('const handleEditInventoryCatalog'), app.indexOf('const handleUpdateInventoryItem'));
    expect(edit).toContain('updateInventoryCatalog(item)');
    expect(edit).not.toMatch(/updateInventoryItem\(/);
  });
});

describe('status REVISAR preservado', () => {
  it('mesmo nó: REVISAR continua REVISAR (editar aplicabilidade/nome não aprova)', () => {
    expect(resolveClassificationStatus({ canonicalTaxonomyId: 'n1', classificationStatus: 'REVISAR' }, 'n1')).toBe('REVISAR');
    expect(resolveClassificationStatus({ canonicalTaxonomyId: 'n1', classificationStatus: 'CLASSIFICADO' }, 'n1')).toBe('CLASSIFICADO');
  });
  it('escolher/alterar o nó é a confirmação: vira CLASSIFICADO', () => {
    expect(resolveClassificationStatus({ canonicalTaxonomyId: 'n1', classificationStatus: 'REVISAR' }, 'n2')).toBe('CLASSIFICADO');
    expect(resolveClassificationStatus(null, 'n2')).toBe('CLASSIFICADO');
  });
  it('sem nó: NAO_CLASSIFICADO', () => {
    expect(resolveClassificationStatus({ canonicalTaxonomyId: 'n1', classificationStatus: 'REVISAR' }, '')).toBe('NAO_CLASSIFICADO');
  });
});

describe('Fornecedores — áreas de fornecimento', () => {
  it('oferece só as 5 áreas comerciais (nunca INFRA / categorias de estoque)', () => {
    const opts = commercialAreaOptions([]);
    expect(opts.map((o) => o.value)).toEqual(['SDAI', 'CFTV', 'ALARME', 'BMS', 'CONTROLE_ACESSO']);
    expect(opts.some((o) => o.value === 'INFRA')).toBe(false);
  });
  it('preserva valores históricos já gravados, marcados como legado', () => {
    const opts = commercialAreaOptions(['CFTV', 'A DEFINIR', 'Detecção SDAI', 'INFRA', 'A DEFINIR']);
    expect(opts.filter((o) => o.legacy).map((o) => o.value)).toEqual(['A DEFINIR', 'Detecção SDAI', 'INFRA']);
    expect(opts.find((o) => o.value === 'CFTV')?.legacy).toBe(false);
  });
});
