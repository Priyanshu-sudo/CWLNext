import type { Metadata } from "next";
import "../src/styles.css";

export const metadata: Metadata = {
  title: "MYCWLNext",
  description: "Credit watchlist workflow platform for MYCWLNext.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
