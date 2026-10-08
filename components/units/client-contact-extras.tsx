"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

import {
  addClientExtraAddress,
  addClientExtraPhone,
} from "@/lib/actions/client-contacts";
import type {
  ClientExtraAddress,
  ClientExtraPhone,
} from "@/lib/client/contact-lines";
import { isPersistedExtraId } from "@/lib/client/contact-lines";
import { useCrudToast } from "@/hooks/use-crud-toast";
import { ClientPhoneRow } from "@/components/units/client-phone-row";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type ContactExtraLine = { id: string; value: string };

type ContactExtrasMode = "readonly" | "editable" | "communityAddOnly";

export function ClientContactExtras({
  unitId,
  clientName,
  unitCode,
  projectName,
  messageTemplate,
  extraPhones,
  extraAddresses,
  mode,
  contactDisabled = false,
  onExtrasChange,
}: {
  unitId: string;
  clientName: string;
  unitCode: string;
  projectName: string;
  messageTemplate: string;
  extraPhones: ContactExtraLine[];
  extraAddresses: ContactExtraLine[];
  mode: ContactExtrasMode;
  contactDisabled?: boolean;
  onExtrasChange?: (next: {
    phones: ContactExtraLine[];
    addresses: ContactExtraLine[];
  }) => void;
}) {
  const t = useTranslations("client.contacts");
  const tCommon = useTranslations("common");
  const { pending, runAction } = useCrudToast();
  const router = useRouter();

  const [phoneDialogOpen, setPhoneDialogOpen] = useState(false);
  const [addressDialogOpen, setAddressDialogOpen] = useState(false);
  const [newPhone, setNewPhone] = useState("");
  const [newAddress, setNewAddress] = useState("");

  const canEdit = mode === "editable";
  const canAddOnly = mode === "communityAddOnly";

  function updatePhone(index: number, value: string) {
    if (!onExtrasChange) return;
    const next = extraPhones.map((row, i) =>
      i === index ? { ...row, value } : row
    );
    onExtrasChange({ phones: next, addresses: extraAddresses });
  }

  function removePhone(index: number) {
    if (!onExtrasChange) return;
    onExtrasChange({
      phones: extraPhones.filter((_, i) => i !== index),
      addresses: extraAddresses,
    });
  }

  function addEditablePhone() {
    if (!onExtrasChange) return;
    onExtrasChange({
      phones: [...extraPhones, { id: "", value: "" }],
      addresses: extraAddresses,
    });
  }

  function updateAddress(index: number, value: string) {
    if (!onExtrasChange) return;
    const next = extraAddresses.map((row, i) =>
      i === index ? { ...row, value } : row
    );
    onExtrasChange({ phones: extraPhones, addresses: next });
  }

  function removeAddress(index: number) {
    if (!onExtrasChange) return;
    onExtrasChange({
      phones: extraPhones,
      addresses: extraAddresses.filter((_, i) => i !== index),
    });
  }

  function addEditableAddress() {
    if (!onExtrasChange) return;
    onExtrasChange({
      phones: extraPhones,
      addresses: [...extraAddresses, { id: "", value: "" }],
    });
  }

  function submitNewPhone() {
    runAction(async () => {
      const result = await addClientExtraPhone(unitId, newPhone);
      if (result.success) {
        setNewPhone("");
        setPhoneDialogOpen(false);
        router.refresh();
      }
      return result;
    }, "saved");
  }

  function submitNewAddress() {
    runAction(async () => {
      const result = await addClientExtraAddress(unitId, newAddress);
      if (result.success) {
        setNewAddress("");
        setAddressDialogOpen(false);
        router.refresh();
      }
      return result;
    }, "saved");
  }

  const phoneRows = extraPhones;
  const addressRows = extraAddresses;

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-sm font-medium">{t("extraPhones")}</Label>
          {canEdit ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={addEditablePhone}
            >
              <Plus className="size-3.5" />
              {t("addPhone")}
            </Button>
          ) : canAddOnly ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending || contactDisabled}
              onClick={() => setPhoneDialogOpen(true)}
            >
              <Plus className="size-3.5" />
              {t("addPhone")}
            </Button>
          ) : null}
        </div>
        {phoneRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noExtraPhones")}</p>
        ) : (
          <ul className="space-y-2">
            {phoneRows.map((row, index) => (
              <li key={row.id || `phone-${index}`} className="flex flex-wrap gap-2">
                {canEdit ? (
                  <>
                    <Input
                      className="min-w-[12rem] flex-1"
                      value={row.value}
                      disabled={pending}
                      onChange={(event) => updatePhone(index, event.target.value)}
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      disabled={pending}
                      onClick={() => removePhone(index)}
                      aria-label={t("removePhone")}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </>
                ) : (
                  <ClientPhoneRow
                    label={t("extraPhoneLabel", { index: index + 1 })}
                    phone={row.value}
                    clientName={clientName}
                    unitCode={unitCode}
                    projectName={projectName}
                    messageTemplate={messageTemplate}
                    contactDisabled={contactDisabled}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-sm font-medium">{t("extraAddresses")}</Label>
          {canEdit ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={addEditableAddress}
            >
              <Plus className="size-3.5" />
              {t("addAddress")}
            </Button>
          ) : canAddOnly ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending || contactDisabled}
              onClick={() => setAddressDialogOpen(true)}
            >
              <Plus className="size-3.5" />
              {t("addAddress")}
            </Button>
          ) : null}
        </div>
        {addressRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noExtraAddresses")}</p>
        ) : (
          <ul className="space-y-2">
            {addressRows.map((row, index) => (
              <li key={row.id || `address-${index}`}>
                {canEdit ? (
                  <div className="flex gap-2">
                    <Textarea
                      rows={2}
                      className="flex-1"
                      value={row.value}
                      disabled={pending}
                      onChange={(event) => updateAddress(index, event.target.value)}
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      disabled={pending}
                      onClick={() => removeAddress(index)}
                      aria-label={t("removeAddress")}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm">
                    <strong>{t("extraAddressLabel", { index: index + 1 })}:</strong>{" "}
                    {row.value || "—"}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {canAddOnly ? (
        <>
          <Dialog open={phoneDialogOpen} onOpenChange={setPhoneDialogOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{t("addPhone")}</DialogTitle>
              </DialogHeader>
              <Input
                value={newPhone}
                onChange={(event) => setNewPhone(event.target.value)}
                disabled={pending}
                autoFocus
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPhoneDialogOpen(false)}
                  disabled={pending}
                >
                  {tCommon("cancel")}
                </Button>
                <Button
                  type="button"
                  disabled={pending || !newPhone.trim()}
                  onClick={submitNewPhone}
                >
                  {t("addPhone")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={addressDialogOpen} onOpenChange={setAddressDialogOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{t("addAddress")}</DialogTitle>
              </DialogHeader>
              <Textarea
                rows={3}
                value={newAddress}
                onChange={(event) => setNewAddress(event.target.value)}
                disabled={pending}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAddressDialogOpen(false)}
                  disabled={pending}
                >
                  {tCommon("cancel")}
                </Button>
                <Button
                  type="button"
                  disabled={pending || !newAddress.trim()}
                  onClick={submitNewAddress}
                >
                  {t("addAddress")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      ) : null}
    </div>
  );
}

export function toContactExtraLines(
  phones: ClientExtraPhone[],
  addresses: ClientExtraAddress[]
): { phones: ContactExtraLine[]; addresses: ContactExtraLine[] } {
  return {
    phones: phones.map((row) => ({
      id: isPersistedExtraId(row.id) ? row.id : "",
      value: row.phone,
    })),
    addresses: addresses.map((row) => ({
      id: isPersistedExtraId(row.id) ? row.id : "",
      value: row.address,
    })),
  };
}
