'use client';

import { FuncionariosGate } from '@/components/FuncionariosGate';

// Entrada padrão da Área do Funcionário. A aba ativa é refletida na URL
// (/funcionarios/<aba>) pelo próprio CRM; cada aba tem seu link dedicado nas
// rotas geradas em app/funcionarios/[tab].
export default function FuncionariosPage() {
  return <FuncionariosGate />;
}
