"use client";

import { PhoneCountryBadge } from "@/components/phone/phone-country-badge";
import { PhoneLtrText } from "@/components/phone/phone-ltr";
import { WhatsAppButton } from "@/components/units/whatsapp-button";

export function ClientPhoneRow({
  label,
  phone,
  clientName,
  unitCode,
  projectName,
  messageTemplate,
  contactDisabled = false,
}: {
  label: string;
  phone: string | null | undefined;
  clientName: string;
  unitCode: string;
  projectName: string;
  messageTemplate: string;
  contactDisabled?: boolean;
}) {
  const display = phone?.trim() || "-";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <p className="min-w-0 flex-1">
        <strong>{label}:</strong>{" "}
        {display === "-" ? display : <PhoneLtrText>{display}</PhoneLtrText>}
        {phone?.trim() ? (
          <span className="ms-2 inline-flex align-middle">
            <PhoneCountryBadge phone={phone} />
          </span>
        ) : null}
      </p>
      {phone?.trim() && !contactDisabled ? (
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
