export type PublishToDlqInput = {
  topic: string;
  partition: number;
  offset: string;
  timestamp: string;
  key: Buffer | null;
  rawValue: string | null;
  failureReason: string;
};