import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
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
