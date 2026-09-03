import type { Metadata } from 'next';
import './funcionarios.css';

export const metadata: Metadata = {
  title: 'FIREOWL CONTROLS — Área do Funcionário',
  description:
    'Sistema de Gestão Integrado — CRM, Contratos, Ordens de Serviço, Ativos, Ponto Eletrônico e Relatório Técnico SDAI',
};

export default function FuncionariosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* Fontes específicas do sistema de gestão (Plus Jakarta Sans / Roboto Mono / Material Symbols).
          O Next.js hoista estas tags <link> para o <head>. */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link
        rel="preconnect"
        href="https://fonts.gstatic.com"
        crossOrigin="anonymous"
      />
      <link
        href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Roboto+Mono:wght@400;500;600;700&display=swap"
        rel="stylesheet"
      />
      <link
        href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
        rel="stylesheet"
      />
      <div className="min-h-screen bg-surface-2 font-body-md text-[#131c28]">
        {children}
      </div>
    </>
  );
}
