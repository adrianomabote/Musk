export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isVoice?: boolean;
  action?: Action;
  timestamp: number;
}

export interface Action {
  type: string;
  param?: string;
}

export interface AssistantResponse {
  text: string;
  action?: Action;
  audioBase64: string;
  transcript?: string;
}
