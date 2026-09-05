import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');
const receiving = read('components/fornecimento/SupplyReceivingModal.tsx');
const purchase = read('components/fornecimento/SupplyPurchaseModal.tsx');
const receiptsLib = read('lib/supplyReceipts.ts');
const mig = read('lib/db/migrations/0101_receipt_real_cost_and_order_supplier.sql');

describe('Fornecedor estruturado no Recebimento e no Registro de Compra (§25–§38)', () => {
  it('ambos usam o SupplierPickerField (mesma fonte/UX)', () => {
    expect(receiving).toContain('<SupplierPickerField');
    expect(purchase).toContain('<SupplierPickerField');
    expect(receiving).not.toContain('placeholder="Nome do fornecedor"');
    expect(purchase).not.toMatch(/value=\{fornecedor\}/);
  });
  it('compra persiste supplierId e propaga ao pedido (§31)', () => {
    expect(purchase).toContain('supplierId: supplierId || undefined');
    expect(purchase).toContain('updateSupplyOrder(');
  });
  it('recebimento pré-seleciona por supplier_id do pedido, com fallback por nome', () => {
    expect(receiving).toContain('order.supplierId');
    expect(receiving).toMatch(/s\.name\.trim\(\)\.toLowerCase\(\)/);
  });
});

describe('Custo real no recebimento (§1–§13)', () => {
  it('captura frete e outros custos e valida custo antes da entrada (§19)', () => {
    expect(receiving).toContain('freightTotal');
    expect(receiving).toContain('otherTotal');
    expect(receiving).toContain('custoDefinidoOk');
    expect(receiving).toContain('allocateProportional');
    expect(receiving).toContain('finalUnitCost');
  });
  it('persiste frete/outros no recebimento e custo final por item', () => {
    expect(receiving).toContain('freight: freightTotal');
    expect(receiving).toContain('finalUnitCost:');
    expect(receiptsLib).toContain('final_unit_cost');
    expect(receiptsLib).toContain('freight_alloc');
  });
});

describe('Migration 0101 — custo médio ponderado, sem tocar preço de venda (§11/§12)', () => {
  it('calcula média ponderada quando há saldo e usa custo final', () => {
    expect(mig).toContain('inv.quantity::numeric * inv.cost_price + qty::numeric * v_final');
    expect(mig).toContain('coalesce(it.final_unit_cost, it.unit_cost)');
  });
  it('NÃO altera sale_price/markup/profit_margin', () => {
    expect(mig).not.toMatch(/sale_price\s*=/);
    expect(mig).not.toMatch(/profit_margin\s*=/);
    expect(mig).not.toMatch(/markup\s*=/);
  });
  it('adiciona colunas de custo e supplier_id do pedido (aditivo)', () => {
    expect(mig).toContain('add column if not exists freight');
    expect(mig).toContain('add column if not exists final_unit_cost');
    expect(mig).toContain('supply_orders');
    expect(mig).toContain('supplier_id');
  });
});
