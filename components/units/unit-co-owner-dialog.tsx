"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

import {
  addUnitCoOwner,
  searchClientsForCoOwnerLink,
} from "@/lib/actions/unit-clients";
import { useCrudToast } from "@/hooks/use-crud-toast";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type LinkResult = {
  id: string;
  name: string;
  nationalId: string | null;
  phone1: string | null;
};

export function UnitCoOwnerDialog({
  unitId,
  open,
  onOpenChange,
}: {
  unitId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("units.owners");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const { pending, runAction } = useCrudToast();

  const [mode, setMode] = useState<"new" | "link">("new");
  const [name, setName] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [phone, setPhone] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<LinkResult[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  function handleOpenChange(next: boolean) {
    if (!next) {
      setMode("new");
      setName("");
      setNationalId("");
      setPhone("");
      setSearchQuery("");
      setSearchResults([]);
      setSelectedClientId(null);
    }
    onOpenChange(next);
  }

  async function handleSearchInput(value: string) {
    setSearchQuery(value);
    if (mode !== "link" || value.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const result = await searchClientsForCoOwnerLink(unitId, value);
    if (result.success) setSearchResults(result.clients);
  }

  function handleSubmit() {
    runAction(async () => {
      const result = await addUnitCoOwner({
        unitId,
        mode,
        name: mode === "new" ? name : undefined,
        nationalId: mode === "new" ? nationalId : undefined,
        phone: mode === "new" ? phone : undefined,
        existingClientId: mode === "link" ? selectedClientId ?? undefined : undefined,
      });
      if (result.success) {
        handleOpenChange(false);
        router.refresh();
      }
      return result;
    }, "saved");
  }

  const canSubmit =
    mode === "new"
      ? name.trim().length > 0
      : selectedClientId != null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("addCoOwner")}</DialogTitle>
        </DialogHeader>
        <Tabs
          value={mode}
          onValueChange={(v) => setMode(v === "link" ? "link" : "new")}
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="new">{t("newClientTab")}</TabsTrigger>
            <TabsTrigger value="link">{t("linkClientTab")}</TabsTrigger>
          </TabsList>
          <TabsContent value="new" className="space-y-3 pt-3">
            <div className="space-y-2">
              <Label htmlFor="co-owner-name">{t("name")}</Label>
              <Input
                id="co-owner-name"
                value={name}
                disabled={pending}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="co-owner-nid">{t("nationalIdOptional")}</Label>
              <Input
                id="co-owner-nid"
                value={nationalId}
                disabled={pending}
                onChange={(e) => setNationalId(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="co-owner-phone">{t("phoneOptional")}</Label>
              <Input
                id="co-owner-phone"
                value={phone}
                disabled={pending}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </TabsContent>
          <TabsContent value="link" className="space-y-3 pt-3">
            <div className="space-y-2">
              <Label htmlFor="co-owner-search">{t("searchHint")}</Label>
              <Input
                id="co-owner-search"
                value={searchQuery}
                disabled={pending}
                placeholder={t("searchPlaceholder")}
                onChange={(e) => handleSearchInput(e.target.value)}
              />
            </div>
            <ul className="max-h-48 space-y-1 overflow-y-auto text-sm">
              {searchResults.map((client) => (
                <li key={client.id}>
                  <button
                    type="button"
                    className={`w-full rounded-md border px-3 py-2 text-start transition-colors ${
                      selectedClientId === client.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/50"
                    }`}
                    disabled={pending}
                    onClick={() => setSelectedClientId(client.id)}
                  >
                    <span className="font-medium">{client.name}</span>
                    {client.nationalId ? (
                      <span className="text-muted-foreground">
                        {" · "}
                        {client.nationalId}
                      </span>
                    ) : null}
                    {client.phone1 ? (
                      <span className="text-muted-foreground">
                        {" · "}
                        {client.phone1}
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
              {searchQuery.trim().length >= 2 && searchResults.length === 0 ? (
                <p className="text-muted-foreground">{t("noSearchResults")}</p>
              ) : null}
            </ul>
          </TabsContent>
        </Tabs>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => handleOpenChange(false)}
          >
            {tCommon("cancel")}
          </Button>
          <Button
            type="button"
            disabled={pending || !canSubmit}
            onClick={handleSubmit}
          >
            {t("addCoOwner")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
