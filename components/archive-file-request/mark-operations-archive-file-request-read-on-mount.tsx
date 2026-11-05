"use client";

import { useEffect, useRef } from "react";

import { markOperationsArchiveFileRequestReadAction } from "@/lib/actions/archive-file-request";

export function MarkOperationsArchiveFileRequestReadOnMount({
  requestId,
}: {
  requestId: string;
}) {
  const marked = useRef(false);

  useEffect(() => {
    if (marked.current) return;
    marked.current = true;
    void markOperationsArchiveFileRequestReadAction({
      requestId,
      skipRevalidate: true,
    });
  }, [requestId]);

  return null;
}
