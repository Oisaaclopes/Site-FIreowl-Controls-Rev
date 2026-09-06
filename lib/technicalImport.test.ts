import { describe, expect, it } from 'vitest';
import {
  normalizeHeader, detectDelimiter, parseCsv, guessMapping, importTargets,
  buildImportPreview, sharedStringsFromXml, sheetXmlToMatrix, colRefToIndex,
} from './technicalImport';
import { AssetLike } from './technicalBase';

describe('CSV', () => {
  it('detecta delimitador (; vs ,)', () => {
    expect(detectDelimiter('a;b;c\n1;2;3')).toBe(';');
    expect(detectDelimiter('a,b,c\n1,2,3')).toBe(',');
  });
  it('parseia aspas, aspas escapadas e vírgula dentro de campo', () => {
    const rows = parseCsv('nome,obs\n"Silva, João","disse ""oi"""\n');
    expect(rows).toEqual([['nome', 'obs'], ['Silva, João', 'disse "oi"']]);
  });
  it('ignora linhas totalmente vazias e BOM inicial', () => {
    const rows = parseCsv('﻿a,b\n\n1,2\n');
    expect(rows).toEqual([['a', 'b'], ['1', '2']]);
  });
  it('respeita delimitador ; e campos com quebra de linha', () => {
    const rows = parseCsv('a;b\n"linha1\nlinha2";x');
    expect(rows).toEqual([['a', 'b'], ['linha1\nlinha2', 'x']]);
  });
});

describe('normalizeHeader', () => {
  it('remove acentos, caixa e pontuação', () => {
    expect(normalizeHeader(' Endereço ')).toBe('endereco');
    expect(normalizeHeader('IP-Câmera')).toBe('ip camera');
  });
});

describe('guessMapping — auto-mapeamento assistido (§10)', () => {
  it('SDAI: END→endereco, LOOP→laco, DESCRICAO→descricao, LOCAL→localizacao, TIPO→tipoAtivo', () => {
    const headers = ['END', 'LOOP', 'DESCRICAO', 'LOCAL', 'TIPO'];
    const m = guessMapping(headers, 'SDAI');
    expect(m[0]).toBe('endereco');
    expect(m[1]).toBe('laco');
    expect(m[2]).toBe('descricao_programada');
    expect(m[3]).toBe('localizacao');
    expect(m[4]).toBe('tipoAtivo');
  });
  it('CFTV: IP CAMERA→ip, CHANNEL→canal, LOCATION→localizacao, BRAND→fabricante', () => {
    const m = guessMapping(['IP CAMERA', 'CHANNEL', 'LOCATION', 'BRAND'], 'CFTV');
    expect(m[0]).toBe('ip');
    expect(m[1]).toBe('canal');
    expect(m[2]).toBe('localizacao');
    expect(m[3]).toBe('fabricante');
  });
  it('não mapeia coluna desconhecida', () => {
    const m = guessMapping(['xyz_desconhecido'], 'SDAI');
    expect(Object.keys(m)).toHaveLength(0);
  });
  it('importTargets inclui identificadores da área + campos comuns', () => {
    const keys = importTargets('CFTV').map((t) => t.key);
    expect(keys).toContain('ip');
    expect(keys).toContain('canal');
    expect(keys).toContain('fabricante');
    expect(keys).toContain('localizacao');
  });
});

describe('buildImportPreview (§11/§12)', () => {
  const matrix = [
    ['END', 'LOOP', 'TIPO', 'IPX'],
    ['45', '2', 'Acionador Manual', ''],   // válida
    ['45', '2', 'Acionador Manual', ''],   // duplicada no arquivo
    ['', '', '', ''],                       // vazia → inválida
    ['999', '1', 'Sirene', ''],             // válida, nova
  ];
  const mapping = guessMapping(matrix[0], 'SDAI'); // END,LOOP,TIPO mapeados; IPX não

  it('conta total/válidas/inválidas e duplicidade no arquivo', () => {
    const p = buildImportPreview(matrix, mapping, 'SDAI', []);
    expect(p.total).toBe(4);              // 4 linhas de corpo (a vazia entra como inválida)
    expect(p.duplicatesInFile).toBe(1);   // 2ª linha repete a 1ª
    expect(p.valid).toBe(3);              // 3 válidas (dup ainda é válida), a vazia não
  });

  it('marca duplicidade contra a base existente', () => {
    const existing: AssetLike[] = [{ endereco: '45', laco: '2' }];
    const p = buildImportPreview(matrix, mapping, 'SDAI', existing);
    const dupBase = p.results.filter((r) => r.duplicateInBase);
    expect(dupBase.length).toBeGreaterThanOrEqual(1);
  });

  it('reporta colunas não mapeadas', () => {
    const p = buildImportPreview(matrix, mapping, 'SDAI', []);
    expect(p.unmappedColumns).toContain('IPX');
  });

  it('linha só com vazios é inválida', () => {
    const p = buildImportPreview(matrix, mapping, 'SDAI', []);
    expect(p.invalid).toBeGreaterThanOrEqual(1);
  });

  it('IP inválido em CFTV vira erro de validação', () => {
    const cftv = [['IP CAMERA', 'CHANNEL'], ['999.1.1.1', '8'], ['10.0.0.9', '9']];
    const m = guessMapping(cftv[0], 'CFTV');
    const p = buildImportPreview(cftv, m, 'CFTV', []);
    expect(p.results[0].valid).toBe(false);
    expect(p.results[1].valid).toBe(true);
  });
});

describe('§5A — colar do Excel/Sheets (TSV) reutiliza o importador', () => {
  it('parseCsv detecta TAB e separa colunas/linhas', () => {
    const tsv = 'Intelbras\tDFE 521\tLoja 01\nTecnohold\tAvalon\tDepósito';
    expect(detectDelimiter(tsv)).toBe('\t');
    expect(parseCsv(tsv)).toEqual([
      ['Intelbras', 'DFE 521', 'Loja 01'],
      ['Tecnohold', 'Avalon', 'Depósito'],
    ]);
  });

  it('sem cabeçalho: sintetiza "Coluna N" e todas as linhas viram dados', () => {
    const rows = parseCsv('45\t2\tAcionador\n46\t2\tSirene');
    const header = Array.from({ length: 3 }, (_, i) => `Coluna ${i + 1}`);
    const matrix = [header, ...rows];
    const mapping = { 0: 'endereco', 1: 'laco', 2: 'tipoAtivo' };
    const p = buildImportPreview(matrix, mapping, 'SDAI', []);
    expect(p.total).toBe(2);
    expect(p.valid).toBe(2);
  });

  it('preview colado sinaliza duplicidades (arquivo e base) sem persistir', () => {
    const rows = parseCsv('End\tLoop\tTipo\n45\t2\tAcionador\n45\t2\tAcionador\n999\t1\tSirene');
    const mapping = guessMapping(rows[0], 'SDAI');
    const p = buildImportPreview(rows, mapping, 'SDAI', [{ endereco: '45', laco: '2' }]);
    expect(p.total).toBe(3);
    expect(p.duplicatesInFile).toBe(1);           // 2ª linha repete a 1ª
    expect(p.duplicatesInBase).toBeGreaterThanOrEqual(1); // 45/2 já existe na base
    // buildImportPreview é PURO: só analisa, nenhuma gravação acontece aqui.
  });

  it('linha colada sem identificador nem tipo/grupo é sinalizada inválida', () => {
    const rows = parseCsv('Intelbras\tDFE 521\tLoja 01');
    const matrix = [['Coluna 1', 'Coluna 2', 'Coluna 3'], ...rows];
    const mapping = { 0: 'fabricante', 1: 'modelo', 2: 'localizacao' };
    const p = buildImportPreview(matrix, mapping, 'SDAI', []);
    expect(p.results[0].valid).toBe(false);
    expect(p.results[0].errors.join(' ')).toMatch(/identificador|tipo\/grupo/i);
  });
});

describe('XLSX helpers (parsing puro, sem binário)', () => {
  it('colRefToIndex', () => {
    expect(colRefToIndex('A1')).toBe(0);
    expect(colRefToIndex('B2')).toBe(1);
    expect(colRefToIndex('AA1')).toBe(26);
    expect(colRefToIndex('AB1')).toBe(27);
  });
  it('sharedStringsFromXml concatena runs e decodifica entidades', () => {
    const xml = '<sst><si><t>Acionador</t></si><si><r><t>IP </t></r><r><t>&amp; MAC</t></r></si></sst>';
    expect(sharedStringsFromXml(xml)).toEqual(['Acionador', 'IP & MAC']);
  });
  it('sheetXmlToMatrix resolve shared strings e numéricos por referência', () => {
    const shared = ['END', 'Acionador'];
    const xml = '<sheetData>' +
      '<row><c r="A1" t="s"><v>0</v></c><c r="B1"><v>45</v></c></row>' +
      '<row><c r="A2" t="s"><v>1</v></c><c r="B2"><v>2</v></c></row>' +
      '</sheetData>';
    expect(sheetXmlToMatrix(xml, shared)).toEqual([['END', '45'], ['Acionador', '2']]);
  });
  it('sheetXmlToMatrix preenche buracos entre colunas', () => {
    const xml = '<sheetData><row><c r="A1"><v>1</v></c><c r="C1"><v>3</v></c></row></sheetData>';
    expect(sheetXmlToMatrix(xml, [])).toEqual([['1', '', '3']]);
  });
});
