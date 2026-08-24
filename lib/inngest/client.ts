import { Inngest } from "inngest";

export const EVENTS = {
  documentUploaded: "document/uploaded",
  documentApproved: "document/approved",
  retagRequested: "theme/retag.requested",
} as const;

export interface DocumentUploadedData {
  documentId: string;
}

export interface DocumentApprovedData {
  documentId: string;
  userId: string;
}

export interface RetagRequestedData {
  runId: string;
}

export const inngest = new Inngest({ id: "consumer-sentiment-hub" });
