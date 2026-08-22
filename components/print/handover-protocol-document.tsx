import { formatCurrency } from "@/lib/format/currency";

export type HandoverProtocolData = {
  locale: string;
  unitCode: string;
  projectName: string;
  unitType: string;
  areaLabel: string;
  clientName: string;
  clientNationalId: string | null;
  clientPhone1: string | null;
  clientPhone2: string | null;
  clientEmail: string | null;
  handoverStatus: string;
  contractDate: string | null;
  deliveryDate: string | null;
  finishingPackage: string | null;
  executingCompany: string | null;
  totalFinishingPrice: number | null;
  issuedAt: string;
  labels: {
    companyName: string;
    documentTitle: string;
    documentSubtitle: string;
    issuedDate: string;
    sectionClient: string;
    sectionUnit: string;
    sectionFinishing: string;
    sectionLegal: string;
    clientName: string;
    nationalId: string;
    phone: string;
    email: string;
    unitCode: string;
    project: string;
    unitType: string;
    area: string;
    handoverStatus: string;
    contractDate: string;
    deliveryDate: string;
    finishingPackage: string;
    executingCompany: string;
    totalFinishing: string;
    bodyIntro: string;
    bodyClause1: string;
    bodyClause2: string;
    bodyClause3: string;
    signatureClient: string;
    signatureCompany: string;
    signatureDate: string;
    footerNote: string;
  };
};

export function HandoverProtocolDocument({ data }: { data: HandoverProtocolData }) {
  const isRtl = data.locale === "ar";
  const dir = isRtl ? "rtl" : "ltr";

  return (
    <article
      dir={dir}
      className={`handover-print-sheet mx-auto w-[210mm] min-h-[297mm] bg-white px-[18mm] py-[14mm] text-[11pt] leading-relaxed text-black shadow-premium print:m-0 print:min-h-0 print:w-full print:max-w-none print:px-[15mm] print:py-[12mm] print:shadow-none ${
        isRtl ? "font-[family-name:var(--font-cairo)]" : "font-[family-name:var(--font-jakarta)]"
      }`}
    >
      <header className="mb-8 flex items-start justify-between gap-6 border-b border-black/15 pb-6">
        <div className="flex h-16 w-28 items-center justify-center rounded-md border-2 border-black/20 bg-black/[0.03] text-center text-xs font-bold uppercase tracking-wider">
          NJD
          <br />
          Development
        </div>
        <div className="min-w-0 flex-1 text-center">
          <h1 className="text-xl font-bold tracking-tight">{data.labels.documentTitle}</h1>
          <p className="mt-1 text-sm text-black/70">{data.labels.documentSubtitle}</p>
          <p className="mt-2 text-xs text-black/60">
            {data.labels.issuedDate}: {data.issuedAt}
          </p>
        </div>
        <div className="flex h-16 w-28 items-center justify-center rounded-md border-2 border-dashed border-black/20 bg-black/[0.02] text-[10px] text-black/50">
          {data.labels.companyName}
        </div>
      </header>

      <section className="mb-6 space-y-2">
        <h2 className="border-b border-black/10 pb-1 text-sm font-bold">
          {data.labels.sectionClient}
        </h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <div>
            <dt className="font-semibold">{data.labels.clientName}</dt>
            <dd>{data.clientName}</dd>
          </div>
          <div>
            <dt className="font-semibold">{data.labels.nationalId}</dt>
            <dd>{data.clientNationalId ?? "—"}</dd>
          </div>
          <div>
            <dt className="font-semibold">{data.labels.phone}</dt>
            <dd>
              {[data.clientPhone1, data.clientPhone2].filter(Boolean).join(" / ") || "—"}
            </dd>
          </div>
          <div>
            <dt className="font-semibold">{data.labels.email}</dt>
            <dd>{data.clientEmail ?? "—"}</dd>
          </div>
        </dl>
      </section>

      <section className="mb-6 space-y-2">
        <h2 className="border-b border-black/10 pb-1 text-sm font-bold">
          {data.labels.sectionUnit}
        </h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <div>
            <dt className="font-semibold">{data.labels.unitCode}</dt>
            <dd>{data.unitCode}</dd>
          </div>
          <div>
            <dt className="font-semibold">{data.labels.project}</dt>
            <dd>{data.projectName}</dd>
          </div>
          <div>
            <dt className="font-semibold">{data.labels.unitType}</dt>
            <dd>{data.unitType}</dd>
          </div>
          <div>
            <dt className="font-semibold">{data.labels.area}</dt>
            <dd>{data.areaLabel}</dd>
          </div>
        </dl>
      </section>

      {(data.finishingPackage || data.executingCompany || data.totalFinishingPrice != null) && (
        <section className="mb-6 space-y-2">
          <h2 className="border-b border-black/10 pb-1 text-sm font-bold">
            {data.labels.sectionFinishing}
          </h2>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <div>
              <dt className="font-semibold">{data.labels.finishingPackage}</dt>
              <dd>{data.finishingPackage ?? "—"}</dd>
            </div>
            <div>
              <dt className="font-semibold">{data.labels.executingCompany}</dt>
              <dd>{data.executingCompany ?? "—"}</dd>
            </div>
            <div className="col-span-2">
              <dt className="font-semibold">{data.labels.totalFinishing}</dt>
              <dd>{formatCurrency(data.totalFinishingPrice, data.locale)}</dd>
            </div>
          </dl>
        </section>
      )}

      <section className="mb-8 space-y-2">
        <h2 className="border-b border-black/10 pb-1 text-sm font-bold">
          {data.labels.sectionLegal}
        </h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <div>
            <dt className="font-semibold">{data.labels.handoverStatus}</dt>
            <dd>{data.handoverStatus}</dd>
          </div>
          <div>
            <dt className="font-semibold">{data.labels.contractDate}</dt>
            <dd>{data.contractDate ?? "—"}</dd>
          </div>
          <div>
            <dt className="font-semibold">{data.labels.deliveryDate}</dt>
            <dd>{data.deliveryDate ?? "—"}</dd>
          </div>
        </dl>
      </section>

      <section className="mb-10 space-y-3 text-sm leading-8">
        <p>{data.labels.bodyIntro}</p>
        <p>{data.labels.bodyClause1}</p>
        <p>{data.labels.bodyClause2}</p>
        <p>{data.labels.bodyClause3}</p>
      </section>

      <footer className="mt-auto grid grid-cols-2 gap-10 pt-8 text-sm">
        <div className="space-y-8">
          <p className="font-semibold">{data.labels.signatureClient}</p>
          <div className="border-b border-black/40 pt-10" />
          <p className="text-xs text-black/60">{data.labels.signatureDate}</p>
        </div>
        <div className="space-y-8">
          <p className="font-semibold">{data.labels.signatureCompany}</p>
          <div className="border-b border-black/40 pt-10" />
          <p className="text-xs text-black/60">{data.labels.footerNote}</p>
        </div>
      </footer>
    </article>
  );
}
