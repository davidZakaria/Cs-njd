import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "J Communities",
  description: "Real Estate Post-Sales & Customer Service",
  applicationName: "J Communities",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
