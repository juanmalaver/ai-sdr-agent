export interface ImportLeadInput {
  email?: string;
  firstName?: string;
  lastName?: string;
  practiceName?: string;
  city?: string;
  state?: string;
  website?: string;
  metadata?: Record<string, string>;
}

export interface ImportLeadsDto {
  leads: ImportLeadInput[];
}
