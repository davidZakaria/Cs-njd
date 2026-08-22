"use client";

import { useEffect } from "react";

/** Triggers the browser print dialog once the document has painted. */
export function PrintOnLoad() {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      window.print();
    }, 500);

    return () => window.clearTimeout(timer);
  }, []);

  return null;
}
