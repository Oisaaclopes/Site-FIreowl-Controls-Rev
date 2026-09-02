import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { TemplateSchema } from './reportSchema';
import {
  resolveReportTemplate, canonicalSchemaHash, isValidSnapshot, stableStringify,
} from './reportTemplateVersioning';

const tpl = (over: Partial<TemplateSchema>): TemplateSchema => ({
  codigo: 'LEVANTAMENTO_SDAI', nome: 'Lev SDAI', tipo: 'LEVANTAMENTO',
  secoes: [{ key: 's', titulo: 'S', campos: [{ key: 'a', tipo: 'texto' }] }],
  ...over,
});

// ---- Mock configurável do client Supabase (query-builder thenable) ----------
let handler: (table: string, ops: any[]) => { data?: any; error?: any } = () => ({ data: null, error: null });
function makeQB(table: string): any {
  const ops: any[] = [];
  const qb: any = new Proxy({}, {
    get(_t, prop) {
      if (prop === 'then') {
        const res = handler(table, ops);
        return (res2: any) => res2(res);
      }
      return (...args: any[]) => { ops.push([String(prop), ...args]); return qb; };
    },
  });
  return qb;
}
vi.mock('./supabaseClient', () => ({ getSupabaseClient: () => ({ from: (t: string) => makeQB(t) }) }));

describe('CAMPO 2B — resolução do template (puro)', () => {
  const current = [tpl({ versao: 3 })];

  // 1/2/3/4 + integridade
  it('snapshot presente → usa o snapshot e sua versão (não a vigente)', () => {
    const snap = tpl({ versao: 1, nome: 'v1' });
    const r = resolveReportTemplate({ templateCodigo: 'LEVANTAMENTO_SDAI', templateSnapshot: snap, templateVersion: 1 }, current);
    expect(r.source).toBe('snapshot');
    expect(r.version).toBe(1);
    expect(r.template?.nome).toBe('v1');
  });
  it('9/10. legado sem snapshot → fallback vigente, version NULL (sem inventar)', () => {
    const r = resolveReportTemplate({ templateCodigo: 'LEVANTAMENTO_SDAI' }, current);
    expect(r.source).toBe('legacy_current');
    expect(r.version).toBeNull();
    expect(r.template?.versao).toBe(3);
  });
  it('27. código inexistente → unknown, sem crash', () => {
    const r = resolveReportTemplate({ templateCodigo: 'NAO_EXISTE' }, current);
    expect(r.source).toBe('unknown');
    expect(r.template).toBeNull();
  });
  it('28. snapshot inválido não derruba: cai para fallback', () => {
    const r = resolveReportTemplate({ templateCodigo: 'LEVANTAMENTO_SDAI', templateSnapshot: { lixo: true } }, current);
    expect(r.source).toBe('legacy_current');
    expect(isValidSnapshot({ lixo: true })).toBe(false);
    expect(isValidSnapshot(tpl({}))).toBe(true);
  });

  // 24 (integridade principal): A→v1, B→v2 mesmo após publicar v3; novo C→v3.
  it('24. A continua v1 e B continua v2 após o template virar v3; novo usa v3', () => {
    const currentV3 = [tpl({ versao: 3 })];
    const A = { templateCodigo: 'LEVANTAMENTO_SDAI', templateSnapshot: tpl({ versao: 1 }), templateVersion: 1 };
    const B = { templateCodigo: 'LEVANTAMENTO_SDAI', templateSnapshot: tpl({ versao: 2 }), templateVersion: 2 };
    const C = { templateCodigo: 'LEVANTAMENTO_SDAI' }; // novo/legado → vigente
    expect(resolveReportTemplate(A, currentV3).version).toBe(1);
    expect(resolveReportTemplate(B, currentV3).version).toBe(2);
    expect(resolveReportTemplate(C, currentV3).template?.versao).toBe(3);
  });
});

describe('CAMPO 2B — hash canônico', () => {
  it('estável independente da ordem das chaves', () => {
    const a = tpl({ nome: 'X' });
    const b = { secoes: a.secoes, tipo: a.tipo, nome: 'X', codigo: a.codigo } as TemplateSchema;
    expect(canonicalSchemaHash(a)).toBe(canonicalSchemaHash(b));
  });
  it('muda quando o schema muda', () => {
    const a = tpl({});
    const c = tpl({ secoes: [{ key: 's', titulo: 'S', campos: [{ key: 'a', tipo: 'numero' }] }] });
    expect(canonicalSchemaHash(a)).not.toBe(canonicalSchemaHash(c));
  });
  it('IGNORA a versão (só a versão não muda o hash)', () => {
    expect(canonicalSchemaHash(tpl({ versao: 1 }))).toBe(canonicalSchemaHash(tpl({ versao: 9 })));
  });
  it('stableStringify ordena chaves', () => {
    expect(stableStringify({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
  });
});

describe('CAMPO 2B — snapshot não contém dados mutáveis', () => {
  it('20/21/22. o snapshot é a DEFINIÇÃO (sem answers/fotos/assinatura)', () => {
    const snap = tpl({});
    const json = JSON.stringify(snap);
    expect(json).not.toMatch(/"answers"/);
    expect(json).not.toMatch(/"assinatura_valor"|"signature"|"foto_blob"/);
    // Estrutura presente: secoes/campos.
    expect(Array.isArray(snap.secoes)).toBe(true);
  });
});

describe('CAMPO 2B — publishTemplate (versionado, não-destrutivo)', () => {
  beforeEach(() => { handler = () => ({ data: null, error: null }); });

  it('unsupported quando schema_hash não existe (0075 pendente)', async () => {
    const { publishTemplate } = await import('./reportTemplates');
    handler = () => ({ data: null, error: { message: 'column report_templates.schema_hash does not exist' } });
    expect(await publishTemplate(tpl({ versao: 1 }))).toBe('unsupported');
  });
  it('inserted quando o código não existe', async () => {
    const { publishTemplate } = await import('./reportTemplates');
    handler = (_t, ops) => {
      if (ops.some((o) => o[0] === 'insert')) return { error: null };
      return { data: null, error: null }; // maybeSingle → não existe
    };
    expect(await publishTemplate(tpl({ versao: 1 }))).toBe('inserted');
  });
  it('noop com mesma versão e mesmo hash', async () => {
    const { publishTemplate } = await import('./reportTemplates');
    const schema = tpl({ versao: 2 });
    const hash = canonicalSchemaHash(schema);
    handler = () => ({ data: { id: 'x', versao: 2, schema_hash: hash }, error: null });
    expect(await publishTemplate(schema)).toBe('noop');
  });
  it('15. CONFLICT: mesma versão, schema diferente (baseline já existe) → NÃO sobrescreve', async () => {
    const { publishTemplate } = await import('./reportTemplates');
    handler = () => ({ data: { id: 'x', versao: 2, schema_hash: 'HASH_ANTIGO_DIFERENTE' }, error: null });
    expect(await publishTemplate(tpl({ versao: 2 }))).toBe('conflict');
  });
  it('aligned: mesma versão, schema_hash NULL (linha pré-versionamento) → adota baseline', async () => {
    const { publishTemplate } = await import('./reportTemplates');
    handler = (_t, ops) => {
      if (ops.some((o) => o[0] === 'update')) return { error: null };
      return { data: { id: 'x', versao: 1, schema_hash: null }, error: null };
    };
    expect(await publishTemplate(tpl({ versao: 1 }))).toBe('aligned');
  });
  it('16. advanced: versão maior no código insere/atualiza a vigente', async () => {
    const { publishTemplate } = await import('./reportTemplates');
    handler = (_t, ops) => {
      if (ops.some((o) => o[0] === 'update')) return { error: null };
      return { data: { id: 'x', versao: 1, schema_hash: 'antigo' }, error: null };
    };
    expect(await publishTemplate(tpl({ versao: 2 }))).toBe('advanced');
  });
  it('behind: banco à frente do código', async () => {
    const { publishTemplate } = await import('./reportTemplates');
    handler = () => ({ data: { id: 'x', versao: 5, schema_hash: 'z' }, error: null });
    expect(await publishTemplate(tpl({ versao: 2 }))).toBe('behind');
  });
});

describe('CAMPO 2B — invariantes da migration 0075', () => {
  const sql = readFileSync(resolve(process.cwd(), 'lib/db/migrations/0075_report_template_versioning.sql'), 'utf8');

  it('adiciona reports.template_version + template_snapshot (jsonb) e schema_hash', () => {
    expect(sql).toMatch(/add column if not exists template_version integer/i);
    expect(sql).toMatch(/add column if not exists template_snapshot jsonb/i);
    expect(sql).toMatch(/add column if not exists schema_hash text/i);
  });
  it('trigger de imutabilidade: preenche quando NULL, reverte alteração posterior', () => {
    expect(sql).toMatch(/create or replace function public\.reports_freeze_template_snapshot/i);
    expect(sql).toMatch(/if old\.template_snapshot is not null then/i);
    expect(sql).toMatch(/new\.template_snapshot := old\.template_snapshot/i);
    expect(sql).toMatch(/before update on public\.reports/i);
  });
  it('sem backfill especulativo (não seta snapshot em massa)', () => {
    expect(sql).not.toMatch(/update public\.reports\s+set template_snapshot/i);
  });
});
