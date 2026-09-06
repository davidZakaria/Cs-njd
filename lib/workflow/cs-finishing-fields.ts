export type CsFinishingAdditionInput = {
  addFinishingNote?: string | null;
  addCustomModification?: string | null;
};

export type CsFinishingSnapshot = {
  currentFinishingStatus: string | null;
  customModifications: string | null;
};

export function appendOnlyText(
  existing: string | null | undefined,
  addition: string | null | undefined
): { next: string | null; changed: boolean } {
  const add = String(addition ?? "").trim();
  if (!add) {
    return { next: existing?.trim() ? existing.trim() : null, changed: false };
  }
  const prev = String(existing ?? "").trim();
  if (!prev) {
    return { next: add, changed: true };
  }
  if (prev === add || prev.endsWith(add) || prev.includes(`\n${add}`)) {
    return { next: prev, changed: false };
  }
  return { next: `${prev}\n${add}`, changed: true };
}

export function applyCsFinishingAdditions(
  previous: CsFinishingSnapshot,
  input: CsFinishingAdditionInput
): { next: CsFinishingSnapshot; changes: string[] } {
  const noteResult = appendOnlyText(
    previous.currentFinishingStatus,
    input.addFinishingNote
  );
  const modResult = appendOnlyText(
    previous.customModifications,
    input.addCustomModification
  );

  const changes: string[] = [];
  if (noteResult.changed && input.addFinishingNote?.trim()) {
    changes.push(
      `Finishing notes: added "${truncateSummary(input.addFinishingNote.trim())}"`
    );
  }
  if (modResult.changed && input.addCustomModification?.trim()) {
    changes.push(
      `Custom modifications: added "${truncateSummary(input.addCustomModification.trim())}"`
    );
  }

  return {
    next: {
      currentFinishingStatus: noteResult.next,
      customModifications: modResult.next,
    },
    changes,
  };
}

function truncateSummary(text: string, max = 120): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}
