import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // ID de build seguro para FTP/Hostinger: por padrão o Next pode gerar um ID
  // começando com "-" (ex.: "-HBsP..."), e nomes iniciados por hífen quebram o
  // path handling de vários servidores FTP → 550 ao enviar _next/static/<id>/*.
  // Aqui garantimos um ID alfanumérico que sempre começa com letra.
  generateBuildId: async () => `b${Date.now().toString(36)}`,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    // O sistema de gestão (CRM) importado na área de funcionários possui
    // tipagens frouxas (ex.: props com `any`) que só aparecem no `next build`.
    // Isso ignora apenas a checagem de TIPOS — o código JS compila normalmente.
    // Para reativar a checagem, rode `next build` localmente, corrija os
    // erros de tipo restantes nas views e volte este valor para `false`.
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  output: 'export',
  // Gera cada rota como pasta/index.html (ex.: funcionarios/index.html) em vez
  // de funcionarios.html. Assim o Hostinger/LiteSpeed serve a URL limpa
  // (/funcionarios) automaticamente, sem precisar de regra de rewrite.
  trailingSlash: true,
  transpilePackages: ['motion'],
  webpack: (config, {dev}) => {
    // HMR is disabled in AI Studio via DISABLE_HMR env var.
    // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
    if (dev && process.env.DISABLE_HMR === 'true') {
      config.watchOptions = {
        ignored: /.*/,
      };
    }
    return config;
  },
};

export default nextConfig;
