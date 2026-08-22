import { Cairo, Geist_Mono, Plus_Jakarta_Sans, Tajawal } from "next/font/google";

/** Arabic body — tables, forms, paragraphs */
export const tajawal = Tajawal({
  variable: "--font-tajawal",
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

/** Arabic display — KPIs, page titles, card headers */
export const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

/** English body + display */
export const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

/** All font CSS variables — load every face once; locale picks active families in layout. */
export const fontVariables = [
  tajawal.variable,
  cairo.variable,
  plusJakartaSans.variable,
  geistMono.variable,
].join(" ");
