import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/* RBAC de campo (0110): a view technical_catalog deve ser legível pelo TÉCNICO
 * (SECURITY DEFINER) e NUNCA expor dado comercial. Teste ESTÁTICO do SQL — a RLS
 * em si é validada em banco; aqui garantimos o contrato da migration. */
const sql = readFileSync(
  join(process.cwd(), 'lib/db/migrations/0110_technical_catalog_tech_read.sql'),
  'utf8',
).toLowerCase();

describe('0110 — technical_catalog legível pelo técnico, price-free', () => {
  it('recria a view como SECURITY DEFINER (security_invoker = false)', () => {
    expect(sql).toContain('create or replace view public.technical_catalog');
    expect(sql).toMatch(/security_invoker\s*=\s*false/);
    expect(sql).not.toMatch(/security_invoker\s*=\s*true/);
  });
  it('concede leitura a authenticated e bloqueia anon', () => {
    expect(sql).toContain('grant select on public.technical_catalog to authenticated');
    expect(sql).toContain('revoke all on public.technical_catalog from anon');
  });
  it('projeta identificação técnica (fabricante/modelo/família)', () => {
    for (const col of ['i.brand', 'i.model', 'i.category', 'i.subcategory', 'i.technologies']) {
      expect(sql).toContain(col);
    }
  });
  it('NUNCA seleciona campos comerciais/sensíveis (i.<campo>)', () => {
    for (const col of ['i.unit_price', 'i.sale_price', 'i.cost_price', 'i.profit_margin', 'i.markup', 'i.supplier', 'i.quantity', 'i.reserved_quantity', 'i.location']) {
      expect(sql).not.toContain(col);
    }
  });
  it('não abre inventory_items diretamente (só a view muda)', () => {
    expect(sql).not.toContain('policy');
    expect(sql).not.toMatch(/alter table\s+public\.inventory_items/);
  });
});
