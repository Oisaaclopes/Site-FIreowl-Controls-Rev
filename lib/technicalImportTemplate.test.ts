import { describe, expect, it } from 'vitest';
import { buildXlsx } from './xlsxWriter';
import { parseXlsx, guessMapping, importTargets, buildImportPreview, isExampleRow } from './technicalImport';
import { AREAS } from './technicalBase';
import {
  TEMPLATE_COLUMNS, templateHeaders, templateColumnKeys, buildTemplateXlsx, templateFileName, buildTemplateSheets, EXAMPLE_ROW_MARKER,
} from './technicalImportTemplate';

describe('xlsxWriter — round-trip com o parser da 3D.2', () => {
  it('gera XLSX que o parseXlsx relê (aba 1)', async () => {
    const bytes = buildXlsx([{ name: 'IMPORTACAO', rows: [['A', 'B'], ['1', 'IP 10.0.0.1'], [2, 'x']] }]);
    const matrix = await parseXlsx(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
    expect(matrix[0]).toEqual(['A', 'B']);
    expect(matrix[1]).toEqual(['1', 'IP 10.0.0.1']);
    expect(matrix[2]).toEqual(['2', 'x']);
  });
  it('escapa caracteres XML', async () => {
    const bytes = buildXlsx([{ name: 'S', rows: [['a&b<c>d"e']] }]);
    const m = await parseXlsx(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
    expect(m[0][0]).toBe('a&b<c>d"e');
  });
});

describe('modelo oficial por área (§14–§23)', () => {
  it('toda coluna do modelo casa com um alvo de importação (auto-map §23)', () => {
    for (const area of AREAS) {
      const targetKeys = new Set(importTargets(area).map((t) => t.key));
      for (const key of templateColumnKeys(area)) {
        expect(targetKeys.has(key), `${area}:${key}`).toBe(true);
      }
    }
  });

  it('o modelo Fireowl mapeia 100% das colunas automaticamente (§74)', () => {
    for (const area of AREAS) {
      const headers = templateHeaders(area);
      const mapping = guessMapping(headers, area);
      const mappedKeys = Object.values(mapping);
      // cada coluna do modelo deve ter sido reconhecida
      for (const c of TEMPLATE_COLUMNS[area]) {
        expect(mappedKeys, `${area}:${c.label}`).toContain(c.key);
      }
      expect(Object.keys(mapping).length).toBe(headers.length);
    }
  });

  it('SDAI usa rótulos numéricos (§42); CFTV mantém IP/Canal/Tecnologia', () => {
    expect(templateHeaders('SDAI')).toEqual(['GRUPO', 'TIPO', 'FABRICANTE', 'MODELO', 'Nº DA CENTRAL', 'Nº DO LAÇO', 'Nº DO ENDEREÇO', 'DESCRIÇÃO PROGRAMADA', 'LOCALIZAÇÃO', 'Nº DE SÉRIE', 'OBSERVAÇÃO']);
    expect(templateHeaders('CFTV')).toEqual(expect.arrayContaining(['IP', 'CANAL', 'TECNOLOGIA', 'Nº DE SÉRIE']));
  });

  it('rótulos legados ainda mapeiam (retrocompat §42)', () => {
    const legacy = guessMapping(['GRUPO', 'CENTRAL', 'LAÇO', 'ENDEREÇO', 'SERIAL'], 'SDAI');
    const keys = Object.values(legacy);
    expect(keys).toEqual(expect.arrayContaining(['grupo', 'central', 'laco', 'endereco', 'serial']));
  });

  it('aba IMPORTACAO traz cabeçalho + 1 linha de exemplo marcada e ignorável (§39)', async () => {
    const sheets = buildTemplateSheets('SDAI');
    expect(sheets[0].name).toBe('IMPORTACAO');
    expect(sheets[0].rows.length).toBe(2);               // cabeçalho + exemplo
    const bytes = buildTemplateXlsx('SDAI');
    const matrix = await parseXlsx(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
    expect(matrix.length).toBe(2);
    // a linha de exemplo é reconhecida e NÃO importada
    expect(isExampleRow(matrix[1])).toBe(true);
    const mapping = guessMapping(matrix[0], 'SDAI');
    const preview = buildImportPreview(matrix, mapping, 'SDAI', []);
    expect(preview.examples).toBe(1);
    expect(preview.total).toBe(0);                        // nenhuma linha real
    expect(preview.results.find((r) => r.example)).toBeTruthy();
  });

  it('EXAMPLE_ROW_MARKER é detectado por isExampleRow', () => {
    expect(isExampleRow(['Acionador', '', EXAMPLE_ROW_MARKER])).toBe(true);
    expect(isExampleRow(['Acionador', '1', 'Corredor'])).toBe(false);
  });

  it('nome de arquivo por área', () => {
    expect(templateFileName('SDAI')).toBe('MODELO_BASE_TECNICA_SDAI.xlsx');
    expect(templateFileName('CONTROLE_ACESSO')).toContain('CONTROLE_DE_ACESSO');
  });
});
