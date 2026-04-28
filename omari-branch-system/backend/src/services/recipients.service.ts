import {
  EmailerServiceError,
  createEmailRecipient,
  deleteEmailRecipient,
  getActiveReminderRecipientEmails,
  listEmailRecipients,
  updateEmailRecipient,
  type EmailRecipientCreateInput,
  type EmailRecipientResponse,
  type EmailRecipientUpdateInput,
} from "./emailer.service";

export class RecipientServiceError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "RecipientServiceError";
  }
}

export type RecipientCreateInput = EmailRecipientCreateInput;
export type RecipientUpdateInput = EmailRecipientUpdateInput;
export type RecipientResponse = EmailRecipientResponse;

function normalizeEmailerError(error: unknown): never {
  if (error instanceof EmailerServiceError) {
    throw new RecipientServiceError(error.message, error.status);
  }
  throw error;
}

export async function listRecipients(): Promise<RecipientResponse[]> {
  try {
    return await listEmailRecipients();
  } catch (error) {
    normalizeEmailerError(error);
  }
}

export async function getRecipientById(id: bigint): Promise<RecipientResponse | null> {
  const recipients = await listRecipients();
  return recipients.find((recipient) => recipient.id === id.toString()) ?? null;
}

export async function createRecipient(
  input: RecipientCreateInput,
): Promise<RecipientResponse> {
  try {
    return await createEmailRecipient(input);
  } catch (error) {
    normalizeEmailerError(error);
  }
}

export async function updateRecipient(
  id: bigint,
  input: RecipientUpdateInput,
): Promise<RecipientResponse | null> {
  try {
    return await updateEmailRecipient(id, input);
  } catch (error) {
    normalizeEmailerError(error);
  }
}

export async function deleteRecipient(id: bigint): Promise<boolean> {
  try {
    return await deleteEmailRecipient(id);
  } catch (error) {
    normalizeEmailerError(error);
  }
}

export async function getActiveRecipientEmails(): Promise<string[]> {
  return getActiveReminderRecipientEmails();
}
