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

