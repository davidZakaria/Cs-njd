"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

import {
  removeUnitCoOwner,
  setUnitPrimaryOwner,
} from "@/lib/actions/unit-clients";
import { useCrudToast } from "@/hooks/use-crud-toast";
import { Button } from "@/components/ui/button";
import {
  UnitClientForm,
  type UnitClientFormDefaults,
  type UnitProfileEditLevel,
} from "@/components/units/unit-client-form";
import { UnitCoOwnerDialog } from "@/components/units/unit-co-owner-dialog";
import type { ContactExtraLine } from "@/components/units/client-contact-extras";

export type UnitOwnerCardData = {
  clientId: string;
  role: "PRIMARY" | "CO_OWNER";
  coOwnerIndex: number;
  clientName: string;
  phone1: string | null;
  email: string | null;
  nationalId: string | null;
  address1: string | null;
  extraPhones: ContactExtraLine[];
  extraAddresses: ContactExtraLine[];
  nationalIdFile: string | null;
};

export function UnitOwnersTab({
  unitId,
  unitDefaults,
  owners,
  profileEditLevel,
  canManageCoOwners,
  hideClientContact = false,
  contactDisabled = false,
  agentOptions = [],
  showCommunityJamilaHint = false,
}: {
  unitId: string;
  unitDefaults: Omit<
    UnitClientFormDefaults,
    | "clientName"
    | "phone1"
    | "email"
    | "nationalId"
    | "address1"
    | "extraPhones"
    | "extraAddresses"
    | "clientId"
    | "nationalIdFile"
  >;
  owners: UnitOwnerCardData[];
  profileEditLevel: UnitProfileEditLevel;
  canManageCoOwners: boolean;
  hideClientContact?: boolean;
  contactDisabled?: boolean;
  agentOptions?: Array<{ id: string; name: string }>;
  showCommunityJamilaHint?: boolean;
}) {
  const t = useTranslations("units.owners");
  const { pending, runAction } = useCrudToast();
  const router = useRouter();
  const [coOwnerOpen, setCoOwnerOpen] = useState(false);

  function ownerLabel(owner: UnitOwnerCardData) {
    if (owner.role === "PRIMARY") return t("primaryOwner");
    return t("coOwner", { n: owner.coOwnerIndex });
  }

  function handleRemove(clientId: string) {
    if (!confirm(t("removeConfirm"))) return;
    runAction(async () => {
      const result = await removeUnitCoOwner(unitId, clientId);
      if (result.success) router.refresh();
      return result;
    }, "deleted");
  }

  function handleMakePrimary(clientId: string) {
    runAction(async () => {
      const result = await setUnitPrimaryOwner(unitId, clientId);
      if (result.success) router.refresh();
      return result;
    }, "saved");
  }

  return (
    <div className="space-y-8">
      {owners.map((owner) => {
        const isPrimary = owner.role === "PRIMARY";
        const defaults: UnitClientFormDefaults = {
          ...unitDefaults,
          clientId: owner.clientId,
          clientName: owner.clientName,
          phone1: owner.phone1,
          email: owner.email,
          nationalId: owner.nationalId,
          address1: owner.address1,
          extraPhones: owner.extraPhones,
          extraAddresses: owner.extraAddresses,
          nationalIdFile: owner.nationalIdFile,
        };

        return (
          <div key={owner.clientId} className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-lg font-semibold">{ownerLabel(owner)}</h3>
              {canManageCoOwners && !isPrimary ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => handleMakePrimary(owner.clientId)}
                  >
                    {t("makePrimary")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    disabled={pending}
                    onClick={() => handleRemove(owner.clientId)}
                  >
                    {t("removeCoOwner")}
                  </Button>
                </div>
              ) : null}
            </div>
            <UnitClientForm
              defaults={defaults}
              profileEditLevel={profileEditLevel}
              isPrimaryOwner={isPrimary}
              hideClientContact={hideClientContact}
              contactDisabled={contactDisabled}
              agentOptions={isPrimary ? agentOptions : []}
              showCommunityJamilaHint={showCommunityJamilaHint}
            />
          </div>
        );
      })}

      {canManageCoOwners ? (
        <Button
          type="button"
          variant="secondary"
          disabled={pending}
          onClick={() => setCoOwnerOpen(true)}
        >
          {t("addCoOwner")}
        </Button>
      ) : null}

      <UnitCoOwnerDialog
        unitId={unitId}
        open={coOwnerOpen}
        onOpenChange={setCoOwnerOpen}
      />
    </div>
  );
}
