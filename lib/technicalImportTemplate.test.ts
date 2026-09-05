import { describe, expect, it } from 'vitest';
import { buildXlsx } from './xlsxWriter';
import { parseXlsx, guessMapping, importTargets } from './technicalImport';
import { AREAS } from './technicalBase';
import {
  TEMPLATE_COLUMNS, templateHeaders, templateColumnKeys, buildTemplateXlsx, templateFileName, buildTemplateSheets,
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

  it('SDAI/CFTV têm as colunas do enunciado', () => {
    expect(templateHeaders('SDAI')).toEqual(['GRUPO', 'TIPO', 'FABRICANTE', 'MODELO', 'CENTRAL', 'LAÇO', 'ENDEREÇO', 'DESCRIÇÃO PROGRAMADA', 'LOCALIZAÇÃO', 'SERIAL', 'OBSERVAÇÃO']);
    expect(templateHeaders('CFTV')).toContain('IP');
    expect(templateHeaders('CFTV')).toContain('CANAL');
    expect(templateHeaders('CFTV')).toContain('TECNOLOGIA');
  });

  it('aba IMPORTACAO (sheet1) só tem cabeçalhos — exemplos NÃO importáveis (§20)', async () => {
    const sheets = buildTemplateSheets('SDAI');
    expect(sheets[0].name).toBe('IMPORTACAO');
    expect(sheets[0].rows.length).toBe(1);               // só o cabeçalho
    const bytes = buildTemplateXlsx('SDAI');
    const matrix = await parseXlsx(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
    expect(matrix.length).toBe(1);                        // parser lê só a sheet1 → nenhuma linha de dado
  });

  it('nome de arquivo por área', () => {
    expect(templateFileName('SDAI')).toBe('MODELO_BASE_TECNICA_SDAI.xlsx');
    expect(templateFileName('CONTROLE_ACESSO')).toContain('CONTROLE_DE_ACESSO');
  });
});
