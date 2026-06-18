export enum ReplyIntent {
  Interested = 'interested',
  NotInterested = 'not_interested',
  Unsubscribe = 'unsubscribe',
  Other = 'other',
}

export interface ReplyClassification {
  intent: ReplyIntent;
  confidence: number;
  reason: string;
}
