"use client";

import { useEffect, useState } from "react";

import type { DemoLead, DemoLeadStatus } from "@/lib/crm/demo-leads";

type DemoLeadsPanelProps = {
  selectedLeadId: string | null;
  onSelectLead: (lead: DemoLead) => void;
  refreshKey: number;
};

const STATUS_LABEL: Record<DemoLeadStatus, string> = {
  new: "New",
  not_contacted: "Not contacted",
  follow_up: "Follow-up",
  contacted: "Contacted",
};

const STATUS_CLASS: Record<DemoLeadStatus, string> = {
  new: "bg-violet-50 text-violet-700",
  not_contacted: "bg-amber-50 text-amber-700",
  follow_up: "bg-sky-50 text-sky-700",
  contacted: "bg-emerald-50 text-emerald-700",
};

export function DemoLeadsPanel({ selectedLeadId, onSelectLead, refreshKey }: DemoLeadsPanelProps) {
  const [leads, setLeads] = useState<DemoLead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadLeads() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/crm/leads");
        const payload = (await response.json()) as { leads?: DemoLead[]; error?: string };

        if (!response.ok || !payload.leads) {
          throw new Error(payload.error ?? "Unable to load demo leads.");
        }

        if (!cancelled) {
          setLeads(payload.leads);
        }
      } catch (caughtError) {
        if (!cancelled) {
          setError(caughtError instanceof Error ? caughtError.message : "Unable to load demo leads.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadLeads();

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  return (
    <div className="rounded-[28px] border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="rounded-[22px] border border-zinc-100 bg-zinc-50 p-4">
        <div className="mb-4 flex items-center justify-between text-sm text-zinc-500">
          <span>Demo CRM — pick a lead to call</span>
          <span className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs text-zinc-500">
            {leads.length} leads
          </span>
        </div>

        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        {isLoading ? (
          <div className="rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-500">
            Loading leads...
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {leads.map((lead) => {
              const isSelected = lead.id === selectedLeadId;

              return (
                <div
                  key={lead.id}
                  className={`rounded-2xl border bg-white p-3 ${
                    isSelected ? "border-violet-400 ring-1 ring-violet-300" : "border-zinc-200"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold text-zinc-950">{lead.name}</div>
                      <div className="text-xs text-zinc-500">{lead.companyName}</div>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-[10px] uppercase tracking-wide ${STATUS_CLASS[lead.status]}`}>
                      {STATUS_LABEL[lead.status]}
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-zinc-500">
                    {lead.employeeCount} employees · {lead.leadSource}
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelectLead(lead)}
                    className={`mt-3 w-full rounded-full px-3 py-2 text-xs font-medium transition ${
                      isSelected
                        ? "bg-zinc-950 text-white"
                        : "border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50"
                    }`}
                  >
                    {isSelected ? "Selected" : "Select lead"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
