import type {Metadata} from 'next';
import { Oswald, Roboto, Montserrat } from 'next/font/google';
import './globals.css'; // Global styles

const oswald = Oswald({
  subsets: ['latin'],
  weight: ['600', '700'],
  variable: '--font-oswald',
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
  title: 'Fireowl Controls - Automação B2B, Segurança e Combate a Incêndio',
  description: 'Soluções corporativas completas em automação predial, alarmes de incêndio, CFTV de alta resolução e sistemas avançados de controle de acesso para empresas de alta confiança técnica.',
  icons: {
    icon: '/icon.svg',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="pt-BR" className={`${oswald.variable} ${roboto.variable} ${montserrat.variable}`}>
      <body suppressHydrationWarning className="bg-white antialiased text-gray-800">
        {children}
      </body>
    </html>
  );
}
