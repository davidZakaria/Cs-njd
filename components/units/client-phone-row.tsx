"use client";

import { WhatsAppButton } from "@/components/units/whatsapp-button";

export function ClientPhoneRow({
  label,
  phone,
  clientName,
  unitCode,
  projectName,
  messageTemplate,
}: {
  label: string;
  phone: string | null | undefined;
  clientName: string;
  unitCode: string;
  projectName: string;
  messageTemplate: string;
}) {
  const display = phone?.trim() || "-";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <p className="min-w-0 flex-1">
        <strong>{label}:</strong> {display}
      </p>
      {phone?.trim() ? (
        <WhatsAppButton
          phone={phone}
          clientName={clientName}
          unitCode={unitCode}
          projectName={projectName}
          messageTemplate={messageTemplate}
        />
      ) : null}
    </div>
  );
}
