import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/* CORREÇÃO — Recebimento de materiais usa a base CANÔNICA de fornecedores.
 * O seletor + cadastro inline vivem no componente compartilhado SupplierPickerField
 * (reutilizado no Recebimento e no Registro de Compra). Testes estruturais (§16). */

const modal = readFileSync(resolve(process.cwd(), 'components/fornecimento/SupplyReceivingModal.tsx'), 'utf8');
const picker = readFileSync(resolve(process.cwd(), 'components/fornecimento/SupplierPickerField.tsx'), 'utf8');

describe('Recebimento: fornecedor estruturado (não texto livre)', () => {
  it('A) consome a base canônica (fetchSuppliers) via SupplierPickerField', () => {
    expect(modal).toContain("from '@/lib/suppliers'");
    expect(modal).toContain('fetchSuppliers');
    expect(modal).toContain('<SupplierPickerField');
    expect(modal).not.toContain('Nome do fornecedor');
    // o seletor real está no componente compartilhado
    expect(picker).toContain('<PickerField');
  });

  it('C) persiste o vínculo por id + snapshot do nome (§5/§7)', () => {
    expect(modal).toContain('supplierId: supplierId || undefined');
    expect(modal).toContain('supplier: supplierSnapshot');
    expect(modal).toContain('order.supplier'); // snapshot cai para o nome do pedido quando não selecionado
  });

  it('D) pré-seleciona o fornecedor do pedido (id, com fallback por nome §8/§31)', () => {
    expect(modal).toContain('order.supplierId');
    expect(modal).toMatch(/s\.name\.trim\(\)\.toLowerCase\(\)/);
  });

  it('E/F) cadastro inline reutiliza upsertSupplier e seleciona o novo (no componente compartilhado)', () => {
    expect(picker).toContain('upsertSupplier');
    expect(picker).toContain('onChange(created.id)');
    expect(picker).toContain('Cadastrar primeiro fornecedor'); // estado vazio (§12)
  });

  it('G) cadastro inline NÃO reseta as linhas/quantidades do recebimento', () => {
    // o SupplierPickerField só mexe em suppliers/valor selecionado; nunca no formulário pai.
    expect(picker).not.toContain('setRows');
    expect(picker).not.toContain('setReceipts');
  });
});
