import type { Metadata } from "next";
import "./globals.css";
import { KeepAlivePinger } from "@/components/KeepAlivePinger";

export const metadata: Metadata = {
  title: "Smart Menu — Gerador de Cardápios",
  description:
    "Sistema inteligente de geração de cardápios mensais para casas de repouso. Multi-tenant com regras clínicas e rotativas.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">
        <KeepAlivePinger />
        {children}
      </body>
    </html>
  );
}
