import { randomUUID } from "node:crypto";

// Mock-first HubSpot adapter (docs/milestone-6-crm-calendar-strategy.md).
// No live HubSpot account or OAuth token exists yet -- this simulates the
// contract a real adapter would follow so the app-level code and UI don't
// need to change when a real adapter replaces this one.

export type MockCrmSyncResult = {
  provider: "hubspot-mock";
  status: "success";
  contactId: string;
  dealId: string | null;
  syncedAt: string;
};

export function syncMockHubSpotContact(qualified: boolean): MockCrmSyncResult {
  return {
    provider: "hubspot-mock",
    status: "success",
    contactId: `mock-contact-${randomUUID()}`,
    dealId: qualified ? `mock-deal-${randomUUID()}` : null,
    syncedAt: new Date().toISOString(),
  };
}
