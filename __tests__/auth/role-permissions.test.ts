import { describe, expect, it } from "vitest";
import type { Role } from "@prisma/client";

import type { CsAgentScope } from "@/lib/auth/cs-agent-scope";
import {
  canAccessEngineeringPortal,
  canCreateOrUpdateCaseOnUnit,
  canEditCsFinishingEngineering,
  canEditCsHandoverChecklist,
  canListAllUnits,
  canLogCallOnUnit,
  canSubmitEngineeringSiteUpdate,
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

    it("lists all units and engineering portal", () => {
      expect(canListAllUnits(role)).toBe(true);
      expect(canAccessEngineeringPortal(role)).toBe(true);
      expect(canSubmitEngineeringSiteUpdate(role)).toBe(false);
    });

    it("mutates only assigned units", () => {
      expect(
        canCreateOrUpdateCaseOnUnit(role, assigned, csScope)
      ).toBe(true);
      expect(canCreateOrUpdateCaseOnUnit(role, other, csScope)).toBe(false);
      expect(canEditCsHandoverChecklist(role, assigned, csScope)).toBe(true);
      expect(canEditCsHandoverChecklist(role, other, csScope)).toBe(false);
      expect(canEditCsFinishingEngineering(role, assigned, csScope)).toBe(
        true
      );
      expect(canEditCsFinishingEngineering(role, other, csScope)).toBe(false);
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

    it("may list units and log calls but not cases or handover", () => {
      expect(canListAllUnits(role)).toBe(true);
      expect(canLogCallOnUnit(role, assigned)).toBe(true);
      expect(canCreateOrUpdateCaseOnUnit(role, assigned, csScope)).toBe(false);
      expect(canEditCsHandoverChecklist(role, assigned, csScope)).toBe(false);
      expect(canAccessEngineeringPortal(role)).toBe(false);
    });
  });

  describe("MANAGEMENT", () => {
    const role: Role = "MANAGEMENT";

    it("has full case and handover access", () => {
      expect(canCreateOrUpdateCaseOnUnit(role, other)).toBe(true);
      expect(canEditCsHandoverChecklist(role, other)).toBe(true);
      expect(canEditCsFinishingEngineering(role, other)).toBe(true);
      expect(canSubmitEngineeringSiteUpdate(role)).toBe(false);
    });
  });

  describe("ENGINEER", () => {
    const role: Role = "ENGINEER";

    it("uses engineering portal and site updates only", () => {
      expect(canAccessEngineeringPortal(role)).toBe(true);
      expect(canSubmitEngineeringSiteUpdate(role)).toBe(true);
      expect(canCreateOrUpdateCaseOnUnit(role, assigned)).toBe(false);
      expect(canListAllUnits(role)).toBe(false);
    });
  });
});
