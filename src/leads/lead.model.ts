import { LeadStatus } from './lead-status.enum';

export interface Lead {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  practiceName?: string;
  city?: string;
  state?: string;
  website?: string;
  status: LeadStatus;
  touches: number;
  nextFollowupAt?: string;
  lastContactedAt?: string;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, string>;
}
