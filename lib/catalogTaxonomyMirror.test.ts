import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CATALOG_TAXONOMY_NODES, CATALOG_TAXONOMY_ALIASES } from './catalogTaxonomy';

// Garante que o espelho TS e as migrations 0115/0117 declaram EXATAMENTE os
// mesmos nós e aliases (a UI lê do banco; testes/classificador leem do TS).
const sql = (f: string) => readFileSync(join(__dirname, 'db', 'migrations', f), 'utf8');
const sql0115 = sql('0115_cftv_taxonomy_families.sql');
const sql0117 = sql('0117_infra_taxonomy.sql');

const nodeCodes = (text: string) => new Set([...text.matchAll(/'((?:CFTV|INFRA)\.[A-Z_.]+)'\s*,\s*'[^']+'\s*,\s*\d+\)/g)].map((m) => m[1]));
const aliasPairs = (text: string) => new Set([...text.matchAll(/\('((?:CFTV|INFRA)\.[A-Z_.]+)',\s*'([^']+)'\)/g)].map((m) => `${m[1]}=${m[2]}`));

describe('espelho TS ⇄ SQL (0115/0117)', () => {
  it('0115: mesmos nós CFTV novos', () => {
    const ts = CATALOG_TAXONOMY_NODES.filter((n) => /^CFTV\.(ARMAZENAMENTO|TRANSMISSAO|ACESSORIOS|VISUALIZACAO)/.test(n.code)).map((n) => n.code);
    expect(new Set(ts)).toEqual(nodeCodes(sql0115));
  });
  it('0117: mesmos nós INFRA', () => {
    const ts = CATALOG_TAXONOMY_NODES.filter((n) => n.code.startsWith('INFRA.')).map((n) => n.code);
    expect(new Set(ts)).toEqual(nodeCodes(sql0117));
  });
  it('mesmos aliases', () => {
    const ts = CATALOG_TAXONOMY_ALIASES
      .filter((a) => /^(CFTV\.(ARMAZENAMENTO|TRANSMISSAO|ACESSORIOS|VISUALIZACAO)|INFRA\.)/.test(a.code))
      .map((a) => `${a.code}=${a.alias}`);
    expect(new Set(ts)).toEqual(new Set([...aliasPairs(sql0115), ...aliasPairs(sql0117)]));
  });
  it('0115–0117 não reclassificam produtos (sem update em inventory_items)', () => {
    for (const f of ['0115_cftv_taxonomy_families.sql', '0116_catalog_taxonomy_scope.sql', '0117_infra_taxonomy.sql']) {
      expect(sql(f)).not.toMatch(/update\s+public\.inventory_items/i);
    }
  });
});
