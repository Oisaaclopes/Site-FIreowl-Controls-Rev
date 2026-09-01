import type {Metadata, Viewport} from 'next';
import { Poppins, Roboto, Montserrat } from 'next/font/google';
import './globals.css'; // Global styles
import { PwaClient } from '@/components/pwa/PwaClient';
import { FeedbackProvider } from '@/components/ui/Feedback';

// Títulos/headings: Poppins (amigável, arredondada) — mesma família dos PDFs.
// Substitui o antigo Oswald (condensado/industrial, aspecto "quadriculado").
const poppins = Poppins({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-poppins',
  display: 'swap',
});

const roboto = Roboto({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-roboto',
  display: 'swap',
});

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['700'],
  variable: '--font-montserrat',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Fireowl Guardian',
  description: 'Soluções corporativas completas em automação predial, alarmes de incêndio, CFTV de alta resolução e sistemas avançados de controle de acesso para empresas de alta confiança técnica.',
  manifest: '/manifest.webmanifest',
  applicationName: 'Fireowl Guardian',
  appleWebApp: { capable: true, title: 'Fireowl Guardian', statusBarStyle: 'default' },
  // iOS < 16.4 não lê o manifest: garante o modo standalone via meta legado da Apple.
  other: { 'apple-mobile-web-app-capable': 'yes' },
  icons: {
    icon: '/icon.svg',
    apple: '/icons/icon-192.png',
  },
};

export const viewport: Viewport = { themeColor: '#1A1A72', viewportFit: 'cover' };

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="pt-BR" className={`${poppins.variable} ${roboto.variable} ${montserrat.variable}`}>
      <body suppressHydrationWarning className="bg-white antialiased text-gray-800">
        <FeedbackProvider>{children}</FeedbackProvider>
        <PwaClient />
      </body>
    </html>
  );
}
