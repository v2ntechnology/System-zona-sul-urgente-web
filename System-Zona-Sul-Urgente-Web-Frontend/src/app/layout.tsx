import type { Metadata } from "next";
import { Archivo, Inter, Montserrat } from "next/font/google";

import { siteConfig } from "@/config/site";

import "./globals.css";

// Texto corrido e interface.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

// Títulos: o eixo de largura (wdth) permite a versão semicondensada, próxima da letra do logo.
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
});

// Só o logotipo: letra larga e geométrica do logo oficial. Um peso, para pesar pouco.
const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: "800",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: siteConfig.name,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  robots: siteConfig.indexable ? undefined : { index: false, follow: false },
  openGraph: {
    siteName: siteConfig.name,
    locale: siteConfig.locale,
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${inter.variable} ${archivo.variable} ${montserrat.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <a
          href="#conteudo"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-background focus:px-4 focus:py-2 focus:font-medium"
        >
          Pular para o conteúdo
        </a>
        {children}
      </body>
    </html>
  );
}
