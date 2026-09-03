import React from 'react';

/**
 * ClientLogo — renderiza a logo de um CLIENTE/EMPRESA de forma fiel ao arquivo
 * original, inclusive no dark mode.
 *
 * Problema resolvido: muitas logos de clientes são SVG/PNG com cores escuras.
 * Exibidas direto sobre um card navy (dark), elas somem. A solução é puramente
 * de apresentação: quando existe uma imagem real, o container recebe um fundo
 * SEMPRE claro (bg-white deliberado — não theme-aware) com borda discreta, para
 * preservar a marca sem editar o SVG, sem invert e sem filtros CSS.
 *
 * Escopo: use APENAS para logos de cliente/empresa. NÃO usar para avatar de
 * usuário/funcionário, ícone de equipamento, fabricante ou thumbnail de campo.
 *
 * Fallback (sem logo): container theme-aware com ícone/iniciais (§10).
 */
export interface ClientLogoProps {
  /** URL já resolvida (data:/http:) da logo do cliente. Ausente → fallback. */
  src?: string | null;
  /** Nome do cliente — usado no alt (e no fallback de iniciais). */
  name: string;
  /** Classe de tamanho (largura/altura). Padrão: w-14 h-14. */
  sizeClass?: string;
  /** Arredondamento do container. Padrão: rounded-xl. */
  rounded?: string;
  /** Padding interno (evita a logo grudar nas bordas). Padrão: p-1.5. */
  padding?: string;
  /** Conteúdo do fallback quando não há logo. Padrão: ícone "domain". */
  fallback?: React.ReactNode;
  /** Classe do container do fallback (fundo theme-aware). Padrão: bg-navy/10 text-primary. */
  fallbackClassName?: string;
  className?: string;
}

export const ClientLogo: React.FC<ClientLogoProps> = ({
  src,
  name,
  sizeClass = 'w-14 h-14',
  rounded = 'rounded-xl',
  padding = 'p-1.5',
  fallback,
  fallbackClassName = 'bg-navy/10 text-primary',
  className = '',
}) => {
  if (src) {
    return (
      // Fundo branco fixo mesmo no dark (deliberado) — preserva logos escuras.
      <span
        className={`${sizeClass} ${rounded} ${padding} flex items-center justify-center shrink-0 overflow-hidden border border-slate-200 bg-white dark:shadow-sm ${className}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={`Logo ${name}`}
          className="max-w-full max-h-full w-full h-full object-contain"
        />
      </span>
    );
  }
  // Sem logo: fallback theme-aware acompanha o tema do card.
  return (
    <span className={`${sizeClass} ${rounded} flex items-center justify-center shrink-0 ${fallbackClassName} ${className}`}>
      {fallback ?? <span className="material-symbols-outlined text-xl">domain</span>}
    </span>
  );
};
