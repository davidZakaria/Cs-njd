export type EscalationJobRunOptions = {
  /** When true, selection logic runs but no DB writes or inbox notifications are sent. */
  dryRun?: boolean;
};