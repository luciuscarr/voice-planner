export interface Task {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  dueDate?: string;
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
    priority?: 'low' | 'medium' | 'high';
    timePreference?: 'morning' | 'afternoon' | 'evening';
    duration?: number;
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
