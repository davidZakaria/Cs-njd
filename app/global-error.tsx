"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background p-6 text-center font-sans text-foreground">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">
            Something went wrong / حدث خطأ ما
          </h1>
          <p className="max-w-md text-muted-foreground">
            An unexpected error occurred. Please try again or return to the dashboard.
            <br />
            حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى أو العودة إلى لوحة التحكم.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            Try again / حاول مرة أخرى
          </button>
          <a
            href="/en/dashboard"
            className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium"
          >
            Return to Dashboard / العودة للوحة التحكم
          </a>
        </div>
      </body>
    </html>
  );
}
