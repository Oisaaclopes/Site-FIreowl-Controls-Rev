import { FuncionariosGate } from '@/components/FuncionariosGate';
import { TabPath } from '@/lib/types';

// Uma rota estática por aba: /funcionarios/painel, /funcionarios/clientes,
// /funcionarios/relatorios, etc. Cada uma abre o CRM já na aba certa, dando a
// cada seção do sistema um link próprio (compartilhável e recarregável).
const TABS: TabPath[] = [
  'painel',
  'pedidos',
  'contratos',
  'receitas',
  'despesas',
  'financas',
  'agenda',
  'clientes',
  'fornecedores',
  'estoque',
  'catalogo',
  'servicos',
  'relatorios',
  'fotos-de-campo',
  'ponto',
  'conta',
];

// Gera o HTML estático de cada aba no build (output: 'export').
export function generateStaticParams() {
  return TABS.map((tab) => ({ tab }));
}

export default async function FuncionariosTabPage({
  params,
}: {
  params: Promise<{ tab: string }>;
}) {
  const { tab } = await params;
  const initialTab = (TABS as string[]).includes(tab) ? (tab as TabPath) : undefined;
  return <FuncionariosGate initialTab={initialTab} />;
}
