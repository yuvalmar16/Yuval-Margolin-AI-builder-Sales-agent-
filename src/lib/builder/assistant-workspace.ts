import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import { normalizeAssistantDraft, type AssistantDraft } from "@/lib/builder/assistant-draft";
import { getSupabaseClient } from "@/lib/supabase/client";

type WorkspaceRecord = {
  id: string;
  workspaceId: string;
  assistantId: string;
  versionNumber: number;
  status: "draft" | "approved";
  draft: AssistantDraft;
  createdAt: string;
  updatedAt: string;
};

type WorkspaceStore = {
  workspaceId: string;
  assistantId: string;
  currentVersion: number;
  latest: WorkspaceRecord | null;
};

type SupabaseVersionRow = {
  id: string;
  workspace_id: string;
  assistant_id: string;
  version_number: number;
  status: "draft" | "approved";
  config_json: AssistantDraft;
  created_at: string;
  updated_at: string;
};

const STORE_DIR = path.join(process.cwd(), ".data");
const STORE_FILE = path.join(STORE_DIR, "workspace.json");

async function readStore(): Promise<WorkspaceStore> {
  try {
    const raw = await fs.readFile(STORE_FILE, "utf8");
    const parsed = JSON.parse(raw) as WorkspaceStore;

    return {
      workspaceId: parsed.workspaceId ?? "personal-workspace",
      assistantId: parsed.assistantId ?? "outbound-sales-assistant",
      currentVersion: typeof parsed.currentVersion === "number" ? parsed.currentVersion : 0,
      latest: parsed.latest ?? null,
    };
  } catch {
    return {
      workspaceId: "personal-workspace",
      assistantId: "outbound-sales-assistant",
      currentVersion: 0,
      latest: null,
    };
  }
}

async function writeStore(store: WorkspaceStore): Promise<void> {
  await fs.mkdir(STORE_DIR, { recursive: true });
  await fs.writeFile(STORE_FILE, JSON.stringify(store, null, 2), "utf8");
}

async function persistToSupabase(record: WorkspaceRecord): Promise<boolean> {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return false;
  }

  const { error } = await supabase.from("assistant_versions").insert({
    id: record.id,
    workspace_id: record.workspaceId,
    assistant_id: record.assistantId,
    version_number: record.versionNumber,
    status: record.status,
    config_json: record.draft,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
  });

  if (error) {
    console.error("[assistant-workspace] Supabase insert failed", error.message, error.details, error.hint);
    return false;
  }

  return true;
}

async function loadSupabaseLatest(): Promise<WorkspaceRecord | null> {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("assistant_versions")
    .select("*")
    .order("version_number", { ascending: false })
    .limit(1);

  if (error) {
    console.error("[assistant-workspace] Supabase select failed", error.message, error.details, error.hint);
    return null;
  }

  if (!data?.[0]) {
    return null;
  }

  const latest = data[0] as SupabaseVersionRow;

  return {
    id: latest.id,
    workspaceId: latest.workspace_id,
    assistantId: latest.assistant_id,
    versionNumber: latest.version_number,
    status: latest.status,
    draft: latest.config_json,
    createdAt: latest.created_at,
    updatedAt: latest.updated_at,
  };
}

async function approveSupabaseLatest(): Promise<WorkspaceRecord | null> {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return null;
  }

  const latest = await loadSupabaseLatest();

  if (!latest) {
    return null;
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("assistant_versions")
    .update({
      status: "approved",
      updated_at: now,
    })
    .eq("id", latest.id)
    .select()
    .single();

  if (error) {
    console.error("[assistant-workspace] Supabase update failed", error.message, error.details, error.hint);
    return null;
  }

  if (!data) {
    return null;
  }

  return {
    ...latest,
    status: "approved",
    updatedAt: now,
  };
}

export async function saveWorkspaceDraft(value: unknown): Promise<WorkspaceRecord | null> {
  const draft = normalizeAssistantDraft(value);

  if (!draft) {
    return null;
  }

  const store = await readStore();
  const supabaseLatest = await loadSupabaseLatest();
  const currentVersion = supabaseLatest ? supabaseLatest.versionNumber : store.currentVersion;
  const now = new Date().toISOString();
  const nextVersion = currentVersion + 1;

  const record: WorkspaceRecord = {
    id: randomUUID(),
    workspaceId: store.workspaceId,
    assistantId: store.assistantId,
    versionNumber: nextVersion,
    status: "draft",
    draft,
    createdAt: now,
    updatedAt: now,
  };

  const persistedInSupabase = await persistToSupabase(record);

  if (persistedInSupabase) {
    return record;
  }

  const nextStore: WorkspaceStore = {
    ...store,
    currentVersion: nextVersion,
    latest: record,
  };

  await writeStore(nextStore);

  return record;
}

export async function loadLatestWorkspaceDraft(): Promise<WorkspaceRecord | null> {
  const latestFromSupabase = await loadSupabaseLatest();

  if (latestFromSupabase) {
    return latestFromSupabase;
  }

  const store = await readStore();
  return store.latest;
}

export async function approveLatestDraft(): Promise<WorkspaceRecord | null> {
  const approvedFromSupabase = await approveSupabaseLatest();

  if (approvedFromSupabase) {
    return approvedFromSupabase;
  }

  const store = await readStore();

  if (!store.latest) {
    return null;
  }

  const now = new Date().toISOString();
  const updated: WorkspaceRecord = {
    ...store.latest,
    status: "approved",
    updatedAt: now,
  };

  const nextStore: WorkspaceStore = {
    ...store,
    latest: updated,
  };

  await writeStore(nextStore);

  return updated;
}
