import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Self-hosted (no runtime call to Google Fonts).
const poppins = localFont({
  variable: "--font-poppins",
  display: "swap",
  src: [
    { path: "../../node_modules/@fontsource/poppins/files/poppins-latin-500-normal.woff2", weight: "500" },
    { path: "../../node_modules/@fontsource/poppins/files/poppins-latin-600-normal.woff2", weight: "600" },
    { path: "../../node_modules/@fontsource/poppins/files/poppins-latin-700-normal.woff2", weight: "700" },
  ],
});

const openSans = localFont({
  variable: "--font-open-sans",
  display: "swap",
  src: "../../node_modules/@fontsource-variable/open-sans/files/open-sans-latin-wght-normal.woff2",
  weight: "300 800",
});

export const metadata: Metadata = {
  title: { default: "DG Work Hub", template: "%s · DG Work Hub" },
  description: "The Design Guy — private visual bookmarks.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#111315",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${poppins.variable} ${openSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
