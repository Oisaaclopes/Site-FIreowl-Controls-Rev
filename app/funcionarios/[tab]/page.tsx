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
  'servicos',
  'relatorios',
  'fotos-de-campo',
  'ponto',
  'conta',
];

// Compatibilidade de rota: a antiga aba "catalogo" (Passada 3) foi unificada
// em "estoque" (Passada 3.1). Mantemos o HTML estático de /funcionarios/catalogo
// para não quebrar links, redirecionando para a aba estoque.
const LEGACY_REDIRECT: Record<string, TabPath> = { catalogo: 'estoque' };
const STATIC_TABS: string[] = [...TABS, ...Object.keys(LEGACY_REDIRECT)];

// Gera o HTML estático de cada aba no build (output: 'export').
export function generateStaticParams() {
  return STATIC_TABS.map((tab) => ({ tab }));
}

export default async function FuncionariosTabPage({
  params,
}: {
  params: Promise<{ tab: string }>;
}) {
  const { tab } = await params;
  const initialTab: TabPath | undefined =
    LEGACY_REDIRECT[tab] ?? ((TABS as string[]).includes(tab) ? (tab as TabPath) : undefined);
  return <FuncionariosGate initialTab={initialTab} />;
}
