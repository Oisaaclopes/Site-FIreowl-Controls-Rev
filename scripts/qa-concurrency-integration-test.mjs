/**
 * QA ETAPA 7 — concorrência real das RPCs de conversão e OS.
 * Requer migrations 0033, 0044, 0056, 0057 e 0059 aplicadas e SERVICE ROLE.
 * Uso: $env:SUPABASE_URL="..."; $env:SUPABASE_SERVICE_ROLE_KEY="..."; node scripts/qa-concurrency-integration-test.mjs
 */
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const env = (key) => {
  if (process.env[key]) return process.env[key];
  try { return (fs.readFileSync('.env.local', 'utf8').match(new RegExp(`^${key}=(.*)$`, 'm')) || [])[1]?.trim().replace(/^["']|["']$/g, ''); } catch { return undefined; }
};
const url = env('SUPABASE_URL') || env('NEXT_PUBLIC_SUPABASE_URL');
const key = env('SUPABASE_SERVICE_ROLE_KEY') || env('SUPABASE_SERVICE_KEY');
if (!url || !key) throw new Error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.');
const sb = createClient(url, key, { auth: { persistSession: false } });
const tag = `QA-CONC-${Date.now()}`;
const check = (name, condition) => { if (!condition) throw new Error(`Falhou: ${name}`); console.log(`✓ ${name}`); };

const pedidoPayload = (id) => ({
  id, numero_pedido: `PED-${new Date().getFullYear()}-${tag.slice(-4)}`, referencia: tag,
  cliente_id: '', cliente_nome: 'QA concorrência', fornecedor: 'Fireowl Controls Ltda.',
  data_emissao: new Date().toISOString().slice(0, 10), responsavel_comercial_id: '',
  responsavel_comercial_nome: 'QA', status: 'rascunho', valor_total: 0, proposal: {},
  created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
});

async function main() {
  const reportId = crypto.randomUUID(); const contractId = `${tag}-CTR`;
  const routineId = crypto.randomUUID(); const executionA = crypto.randomUUID(); const executionB = crypto.randomUUID();
  try {
    await sb.from('reports').insert({ id: reportId, template_codigo: 'LEVANTAMENTO', tipo: 'LEVANTAMENTO', status: 'finalizado', titulo: tag }).throwOnError();

    // TESTES 1 e 4: duas chamadas para o mesmo levantamento e repetição posterior.
    const [first, second] = await Promise.all([
      sb.rpc('get_or_create_order_from_survey', { p_report_id: reportId, p_pedido: pedidoPayload(`${tag}-PED-A`) }),
      sb.rpc('get_or_create_order_from_survey', { p_report_id: reportId, p_pedido: pedidoPayload(`${tag}-PED-B`) }),
    ]);
    if (first.error) throw first.error; if (second.error) throw second.error;
    check('mesma conversão retorna o mesmo pedido', first.data.pedido_id === second.data.pedido_id);
    const links = await sb.from('report_order_links').select('pedido_id').eq('report_id', reportId).eq('operation', 'initial_conversion').throwOnError();
    check('somente um vínculo de conversão inicial', links.data.length === 1);
    const later = await sb.rpc('get_or_create_order_from_survey', { p_report_id: reportId, p_pedido: pedidoPayload(`${tag}-PED-C`) });
    if (later.error) throw later.error;
    check('repetição é idempotente', later.data.pedido_id === first.data.pedido_id && later.data.already_exists === true);

    await sb.from('contracts').insert({ id: contractId, client_name: 'QA concorrência', status: 'ATIVO' }).throwOnError();
    await sb.from('contract_routines').insert({ id: routineId, contract_id: contractId, tipo: 'preventiva', frequencia: 'mensal' }).throwOnError();
    await sb.from('contract_routine_executions').insert([
      { id: executionA, contract_id: contractId, routine_id: routineId, competencia: '2099-01', status: 'previsto' },
      { id: executionB, contract_id: contractId, routine_id: routineId, competencia: '2099-02', status: 'previsto' },
    ]).throwOnError();

    // TESTE 2: mesma competência em paralelo -> mesma OS.
    const [sameA, sameB] = await Promise.all([
      sb.rpc('generate_os_from_execution', { p_execution_id: executionA, p_titulo: tag }),
      sb.rpc('generate_os_from_execution', { p_execution_id: executionA, p_titulo: tag }),
    ]);
    if (sameA.error) throw sameA.error; if (sameB.error) throw sameB.error;
    check('mesma competência retorna a mesma OS', sameA.data.os_id === sameB.data.os_id);

    // TESTE 3: competências distintas em paralelo -> OS e números distintos.
    const other = await sb.rpc('generate_os_from_execution', { p_execution_id: executionB, p_titulo: tag });
    if (other.error) throw other.error;
    check('competências distintas recebem OS distintas', other.data.os_id !== sameA.data.os_id);
    check('competências distintas recebem números distintos', other.data.numero !== sameA.data.numero);
    console.log('QA concorrência: PASS');
  } finally {
    // Ordem segura de limpeza; preserva qualquer dado que não use o prefixo QA-CONC.
    const os = (await sb.from('ordens_servico').select('id').like('titulo', `%${tag}%`)).data || [];
    if (os.length) await sb.from('ordens_servico').delete().in('id', os.map((row) => row.id));
    await sb.from('contract_routine_executions').delete().eq('contract_id', contractId);
    await sb.from('contract_routines').delete().eq('contract_id', contractId);
    await sb.from('contracts').delete().eq('id', contractId);
    const links = (await sb.from('report_order_links').select('pedido_id').eq('report_id', reportId)).data || [];
    await sb.from('report_order_links').delete().eq('report_id', reportId);
    if (links.length) await sb.from('pedidos').delete().in('id', links.map((row) => row.pedido_id));
    await sb.from('reports').delete().eq('id', reportId);
  }
}
main().catch((error) => { console.error('QA concorrência: FAIL', error.message || error); process.exit(1); });
