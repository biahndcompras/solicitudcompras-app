import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "../styles/globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Portal de Compras BIA",
  description:
    "Solicita una cotización y deja que el equipo de Compras la gestione con especificaciones claras y comparables.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es-HN">
      <body className={`${inter.variable} ${jetbrains.variable} bg-grid antialiased`}>
        {children}
      </body>
    </html>
  );
}