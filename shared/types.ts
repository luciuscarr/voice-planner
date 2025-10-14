export interface Task {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  dueDate?: string;
  // Minutes before dueDate when notifications should fire (e.g., [60, 30])
  reminders?: number[];
  createdAt: string;
  updatedAt: string;
}

export interface VoiceCommand {
  text: string;
  intent: 'task' | 'reminder' | 'note' | 'schedule' | 'findTime' | 'unknown';
  confidence: number;
  extractedData?: {
    title?: string;
    dueDate?: string;
    // Normalized fields for guaranteed formatting
    // date in YYYY-MM-DD (local) if provided by AI
    date?: string;
    // time in HH:mm (24h) if provided by AI
    time?: string;
    priority?: 'low' | 'medium' | 'high';
    timePreference?: 'morning' | 'afternoon' | 'evening';
    duration?: number;
    // Minutes before dueDate to notify (e.g., [60, 30])
    reminders?: number[];
    // True when command refers to the most recent scheduled item (e.g., "this appointment")
    applyToLastScheduled?: boolean;
  };
}

export interface WebSocketMessage {
  type: 'task_created' | 'task_updated' | 'task_deleted' | 'transcription' | 'error';
  data: Task | VoiceCommand | string;
  timestamp: string;
}

export interface SpeechRecognitionResult {
  transcript: string;
  confidence: number;
  isFinal: boolean;
}
