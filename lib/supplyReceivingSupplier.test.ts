import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/* CORREÇÃO — Recebimento de materiais usa a base CANÔNICA de fornecedores.
 * Testes estruturais (§16) — sem render/browser. */

const modal = readFileSync(resolve(process.cwd(), 'components/fornecimento/SupplyReceivingModal.tsx'), 'utf8');

describe('Recebimento: fornecedor estruturado (não texto livre)', () => {
  it('A) consome a base canônica (fetchSuppliers) e não um input de texto', () => {
    expect(modal).toContain("from '@/lib/suppliers'");
    expect(modal).toContain('fetchSuppliers');
    expect(modal).toContain('<PickerField');
    // não deve mais existir o input de texto "Nome do fornecedor"
    expect(modal).not.toContain('Nome do fornecedor');
  });

  it('C) persiste o vínculo por id + snapshot do nome (§5/§7)', () => {
    expect(modal).toContain('supplierId: supplierId || undefined');
    expect(modal).toContain('supplier: supplierSnapshot');
    expect(modal).toContain('order.supplier'); // snapshot cai para o nome do pedido quando não selecionado
  });

  it('D) pré-seleciona o fornecedor do pedido casando o nome (§8)', () => {
    expect(modal).toMatch(/order\.supplier[\s\S]{0,160}s\.name\.trim\(\)\.toLowerCase\(\)/);
  });

  it('E/F) cadastro inline reutiliza upsertSupplier e seleciona o novo', () => {
    expect(modal).toContain('upsertSupplier');
    expect(modal).toContain('setSupplierId(created.id)');
    expect(modal).toContain('Cadastrar primeiro fornecedor'); // estado vazio (§12)
  });

  it('G) criar fornecedor NÃO reseta as linhas/quantidades do recebimento', () => {
    // criarFornecedor só mexe em suppliers/supplierId/newSupplier — nunca em setRows.
    const fn = modal.slice(modal.indexOf('const criarFornecedor'), modal.indexOf('const confirmarEntrada'));
    expect(fn).not.toContain('setRows');
    expect(fn).not.toContain('setReceipts');
  });
});
