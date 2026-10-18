import { describe, expect, it } from "vitest";
import type { Role } from "@prisma/client";

import type { CsAgentScope } from "@/lib/auth/cs-agent-scope";
import {
  canAccessEngineeringPortal,
  canAddCommunityExtraContactsOnly,
  canCreateOrUpdateCaseOnUnit,
  canEditFinishingFinancialsOnUnit,
  canEditCsHandoverChecklist,
  canEditClientContactsOnUnit,
  canEditClientIdentityFields,
  canEditClientPhonesAndAddressesOnUnit,
  canUploadClientNationalIdScan,
  canListAllUnits,
  canLogCallOnUnit,
  canSubmitEngineeringSiteUpdate,
  canSyncClientExtraContacts,
  isCsAgentAssignedToUnit,
} from "@/lib/auth/role-permissions";

const csScope: CsAgentScope = {
  loginUserId: "agent-1",
  effectiveAgentId: "agent-1",
  isPreview: false,
};

const assigned = { unitAgentId: "agent-1" };
const other = { unitAgentId: "agent-2" };

describe("role-permissions matrix", () => {
  describe("CS_AGENT", () => {
    const role: Role = "CS_AGENT";

    it("lists all units but not engineering portal", () => {
      expect(canListAllUnits(role)).toBe(true);
      expect(canAccessEngineeringPortal(role)).toBe(false);
      expect(canSubmitEngineeringSiteUpdate(role)).toBe(false);
    });

    it("edits finishing and phone/address contacts on any unit, not identity", () => {
      expect(canEditFinishingFinancialsOnUnit(role, assigned, csScope)).toBe(
        true
      );
      expect(canEditFinishingFinancialsOnUnit(role, other, csScope)).toBe(true);
      expect(canEditClientPhonesAndAddressesOnUnit(role, other, csScope)).toBe(
        true
      );
      expect(canEditClientContactsOnUnit(role, other, csScope)).toBe(true);
      expect(canSyncClientExtraContacts(role, other, csScope)).toBe(true);
      expect(canEditClientIdentityFields(role)).toBe(false);
      expect(canUploadClientNationalIdScan(role)).toBe(false);
    });

    it("keeps cases and handover checklist assignment-scoped", () => {
      expect(
        canCreateOrUpdateCaseOnUnit(role, assigned, csScope)
      ).toBe(true);
      expect(canCreateOrUpdateCaseOnUnit(role, other, csScope)).toBe(false);
      expect(canEditCsHandoverChecklist(role, assigned, csScope)).toBe(true);
      expect(canEditCsHandoverChecklist(role, other, csScope)).toBe(false);
    });

    it("may log calls on any unit", () => {
      expect(canLogCallOnUnit(role, other, csScope)).toBe(true);
      expect(canLogCallOnUnit(role, assigned, csScope)).toBe(true);
    });

    it("detects assignment via scope", () => {
      expect(isCsAgentAssignedToUnit(csScope, assigned)).toBe(true);
      expect(isCsAgentAssignedToUnit(csScope, other)).toBe(false);
    });
  });

  describe("COMMUNITY_MANAGEMENT", () => {
    const role: Role = "COMMUNITY_MANAGEMENT";

    it("may list units and log calls on Jamila only", () => {
      expect(canListAllUnits(role)).toBe(true);
      expect(
        canLogCallOnUnit(role, assigned, csScope, {
          id: "p1",
          name: "JAMILA NORTH COAST",
        })
      ).toBe(true);
      expect(
        canLogCallOnUnit(role, assigned, csScope, {
          id: "p2",
          name: "GREEN AVENUE",
        })
      ).toBe(false);
      expect(canCreateOrUpdateCaseOnUnit(role, assigned, csScope)).toBe(false);
      expect(canEditCsHandoverChecklist(role, assigned, csScope)).toBe(false);
      expect(canEditFinishingFinancialsOnUnit(role, assigned, csScope)).toBe(
        false
      );
      expect(canAddCommunityExtraContactsOnly(role)).toBe(true);
      expect(canEditClientContactsOnUnit(role, assigned, csScope)).toBe(false);
      expect(canSyncClientExtraContacts(role, assigned, csScope)).toBe(false);
      expect(canAccessEngineeringPortal(role)).toBe(false);
    });
  });

  describe("MANAGEMENT", () => {
    const role: Role = "MANAGEMENT";

    it("has full case, handover, and finishing access", () => {
      expect(canCreateOrUpdateCaseOnUnit(role, other)).toBe(true);
      expect(canEditCsHandoverChecklist(role, other)).toBe(true);
      expect(canEditFinishingFinancialsOnUnit(role, other)).toBe(true);
      expect(canSyncClientExtraContacts(role, other)).toBe(true);
      expect(canEditClientIdentityFields(role)).toBe(true);
      expect(canUploadClientNationalIdScan(role)).toBe(true);
      expect(canSubmitEngineeringSiteUpdate(role)).toBe(false);
      expect(canAccessEngineeringPortal(role)).toBe(false);
    });
  });

  describe("ENGINEER", () => {
    const role: Role = "ENGINEER";

    it("uses engineering portal and site updates only", () => {
      expect(canAccessEngineeringPortal(role)).toBe(true);
      expect(canSubmitEngineeringSiteUpdate(role)).toBe(true);
      expect(canCreateOrUpdateCaseOnUnit(role, assigned)).toBe(false);
      expect(canListAllUnits(role)).toBe(false);
      expect(canEditFinishingFinancialsOnUnit(role, assigned)).toBe(false);
    });
  });
});
