import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Quiziniere IA",
  description: "Generateur d'exercices pedagogiques par IA"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
