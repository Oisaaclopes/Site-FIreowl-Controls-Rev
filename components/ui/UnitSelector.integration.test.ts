import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('integração do seletor de unidades', () => {
  it('ProductEditor usa o componente compartilhado, sem select de unidades paralelo', () => {
    const productEditor = source('components/catalog/ProductEditor.tsx');
    expect(productEditor).toContain("import { UnitSelector }");
    expect(productEditor).toContain('<UnitSelector value={unit}');
    expect(productEditor).not.toContain('COMMERCIAL_UNITS.map');
  });

  it('ItensCardEditor usa o mesmo componente para materiais e serviços', () => {
    const itemsEditor = source('components/proposta/ItensCardEditor.tsx');
    expect(itemsEditor).toContain("import { UnitSelector }");
    expect(itemsEditor).toContain('<UnitSelector value={draft.unidade}');
    expect(itemsEditor).not.toContain('COMMERCIAL_UNITS.map');
    expect(itemsEditor).toContain("tipo: 'material' | 'servico'");
  });

  it('documento comercial normaliza e imprime somente a sigla', () => {
    const document = source('components/documentos/OrcamentoDocument.tsx');
    expect(document).toContain('normalizeUnitCode(eq.unidade)');
  });
});
