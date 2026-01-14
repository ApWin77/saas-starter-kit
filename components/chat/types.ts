export type MessageSender = 'USER' | 'ASSISTANT';
export type AnswerMode = 'COURSE_GROUNDED' | 'OUTSIDE_MATERIAL';

export interface Citation {
  chunk_id: string;
  content_file_id: string;
  source_title: string;
  page_number?: number;
  section_heading?: string;
  snippet: string;
}

export interface ChatMessageData {
  id: string;
  thread_id: string;
  sender: MessageSender;
  text: string;
  answer_mode?: AnswerMode;
  citations: Citation[];
  created_at: string;
}

export interface ChatThread {
  id: string;
  course_id: string;
  user_id: string;
  title?: string;
  created_at: string;
  message_count: number;
  last_message_preview?: string;
}

export interface SendMessageResponse {
  user_message: ChatMessageData;
  assistant_message: ChatMessageData;
  citations: Citation[];
}
