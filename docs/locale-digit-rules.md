# Locale digit display rules (UI)

## Arabic (`ar`) routes

- **UI counts and dates:** Use `Intl` with locale `ar-EG` via `formatLocaleNumber` / `formatDateTime` so dashboard cards, tables, pagination, and charts show **Arabic-Indic digits** (٠–٩).
- **Identifiers stay Western and LTR:** Phone numbers, national IDs, unit codes, and similar copyable fields use Western digits (`0–9`) wrapped in `PhoneLtrText` or `dir="ltr"` so staff can search, copy, and WhatsApp without bidi surprises.
- **Official PDF / handover legal output:** Unchanged — existing Western-digit masters and generated templates are not modified by this rule.

## English (`en`) routes

- Western digits everywhere (existing `en-GB` formatting).

## Search

- User queries may use either digit form on Arabic pages. Server and client search expand digit variants (`searchDigitVariants`) so `١٠` matches `10` in names, counts, and phone fields where applicable.