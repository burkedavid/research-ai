import { Inngest } from "inngest";

export const EVENTS = {
  documentUploaded: "document/uploaded",
  documentApproved: "document/approved",
} as const;

export interface DocumentUploadedData {
  documentId: string;
}

export interface DocumentApprovedData {
  documentId: string;
  userId: string;
}

export const inngest = new Inngest({ id: "consumer-sentiment-hub" });
