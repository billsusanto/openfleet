export interface SaveConversationArgs {
  note?: string;
}

export interface SessionEntry {
  sessionID: string;
  transcriptPath: string;
  savedAt: string;
  date: string;
  counter: string;
  slug: string;
  title: string;
  summary: string;
  note?: string;
  duration?: string;
  messageCount: number;
  tokensBefore: number;
  tokensInput?: number;
  tokensOutput?: number;
}

export interface SlugContext {
  maxMessages?: number;
  maxContextChars?: number;
}

export interface CounterInfo {
  date: string;
  counter: string;
  highestFound: number;
}
