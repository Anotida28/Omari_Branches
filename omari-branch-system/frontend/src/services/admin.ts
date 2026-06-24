import { api } from "./api";

type TestEmailInput = {
  to: string;
  subject: string;
  message: string;
};

type TestEmailResponse = {
  ok: boolean;
  message: string;
  messageId: string;
  to: string[];
};

export async function sendTestEmail(input: TestEmailInput): Promise<TestEmailResponse> {
  const { data } = await api.post<TestEmailResponse>("/api/admin/test-email", input);
  return data;
}

export type SnapshotStatus = {
  customerCount: number;
  refreshedAt: string | null;
  isStale: boolean;
};

export async function fetchSnapshotStatus(): Promise<SnapshotStatus> {
  const { data } = await api.get<{ data: SnapshotStatus }>("/api/admin/wallet-snapshot/status");
  return data.data;
}

export async function triggerSnapshotSync(): Promise<{ customerCount: number; durationMs: number; refreshedAt: string }> {
  const { data } = await api.post<{ ok: boolean; data: { customerCount: number; durationMs: number; refreshedAt: string } }>(
    "/api/admin/wallet-snapshot/sync",
    undefined,
    { timeout: 10 * 60 * 1000 },
  );
  return data.data;
}

