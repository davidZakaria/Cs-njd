import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NJD Post-Sales CRM",
  description: "Real Estate Post-Sales & Customer Service CRM",
  applicationName: "NJD CRM",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
