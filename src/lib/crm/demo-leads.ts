import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import { getSupabaseClient } from "@/lib/supabase/client";

export type DemoLeadStatus = "new" | "not_contacted" | "follow_up" | "contacted";

export type DemoLead = {
  id: string;
  workspaceId: string;
  name: string;
  companyName: string;
  employeeCount: number;
  phoneNumber: string;
  email: string;
  leadSource: string;
  status: DemoLeadStatus;
  lastContactedAt: string | null;
};

type SupabaseLeadRow = {
  id: string;
  workspace_id: string;
  name: string;
  company_name: string;
  employee_count: number;
  phone_number: string;
  email: string;
  lead_source: string;
  status: DemoLeadStatus;
  last_contacted_at: string | null;
};

const DATA_DIR = path.join(process.cwd(), ".data");
const LOCAL_FILE = path.join(DATA_DIR, "demo-crm-leads.json");

// Mirrors the seed rows in supabase/migrations/0005_demo_crm_leads.sql, so
// local dev (no Supabase configured) still has something to pick from.
function seedLocalLeads(workspaceId: string): DemoLead[] {
  const seed: Array<Omit<DemoLead, "id" | "workspaceId" | "lastContactedAt">> = [
    { name: "Yuval Margolin", companyName: "CloudFlow", employeeCount: 45, phoneNumber: "+1-555-0101", email: "yuval@cloudflow.example", leadSource: "Website form", status: "new" },
    { name: "Sarah Cohen", companyName: "DataNest", employeeCount: 120, phoneNumber: "+1-555-0102", email: "sarah@datanest.example", leadSource: "Webinar", status: "not_contacted" },
    { name: "Daniel Levi", companyName: "MicroStack", employeeCount: 8, phoneNumber: "+1-555-0103", email: "daniel@microstack.example", leadSource: "Landing page", status: "new" },
    { name: "Emma Stone", companyName: "SalesPilot", employeeCount: 70, phoneNumber: "+1-555-0104", email: "emma@salespilot.example", leadSource: "Demo request", status: "follow_up" },
    { name: "Alex Morgan", companyName: "DevSync", employeeCount: 30, phoneNumber: "+1-555-0105", email: "alex@devsync.example", leadSource: "Campaign", status: "contacted" },
  ];

  return seed.map((lead) => ({
    ...lead,
    id: randomUUID(),
    workspaceId,
    lastContactedAt: null,
  }));
}

async function readLocalLeads(workspaceId: string): Promise<DemoLead[]> {
  try {
    const raw = await fs.readFile(LOCAL_FILE, "utf8");
    return JSON.parse(raw) as DemoLead[];
  } catch {
    const seeded = seedLocalLeads(workspaceId);
    await writeLocalLeads(seeded);
    return seeded;
  }
}

async function writeLocalLeads(leads: DemoLead[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(LOCAL_FILE, JSON.stringify(leads, null, 2), "utf8");
}

function fromSupabaseRow(row: SupabaseLeadRow): DemoLead {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    companyName: row.company_name,
    employeeCount: row.employee_count,
    phoneNumber: row.phone_number,
    email: row.email,
    leadSource: row.lead_source,
    status: row.status,
    lastContactedAt: row.last_contacted_at,
  };
}

export async function listDemoLeads(workspaceId: string): Promise<DemoLead[]> {
  const supabase = getSupabaseClient();

  if (supabase) {
    const { data, error } = await supabase
      .from("demo_crm_leads")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("name", { ascending: true });

    if (error) {
      console.error("[demo-leads] Supabase select failed", error.message, error.details, error.hint);
    } else if (data) {
      return (data as SupabaseLeadRow[]).map(fromSupabaseRow);
    }
  }

  return readLocalLeads(workspaceId);
}

export async function markDemoLeadContacted(id: string, workspaceId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const now = new Date().toISOString();

  if (supabase) {
    const { error } = await supabase
      .from("demo_crm_leads")
      .update({ status: "contacted", last_contacted_at: now })
      .eq("id", id)
      .eq("workspace_id", workspaceId);

    if (!error) {
      return;
    }

    console.error("[demo-leads] Supabase update failed", error.message, error.details, error.hint);
  }

  const leads = await readLocalLeads(workspaceId);
  const next = leads.map((lead) =>
    lead.id === id ? { ...lead, status: "contacted" as const, lastContactedAt: now } : lead,
  );
  await writeLocalLeads(next);
}
