export interface Attendee {
  email: string;
  displayName?: string;
  responseStatus?: 'accepted' | 'declined' | 'tentative' | 'needsAction';
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  type?: TaskType;
  priority: Priority;
  dueDate?: Date;
  completed: boolean;
  createdAt: Date;
  updatedAt: Date;
  attendees?: Attendee[];
  calendarEventId?: string;
  reminders?: number[];
}

export enum TaskType {
  TASK = 'task',
  REMINDER = 'reminder',
  NOTE = 'note',
  EVENT = 'event'
}

export enum Priority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent'
}

export interface ParsedIntent {
  type: TaskType;
  title: string;
  description?: string;
  priority: Priority;
  dueDate?: Date;
  originalText: string;
}

export interface VoiceCommand {
  text: string;
  intent: 'task' | 'reminder' | 'note' | 'schedule' | 'findTime' | 'delete' | 'complete' | 'unknown';
  timestamp: Date;
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
    // Attendees for calendar events
    attendees?: Attendee[];
  };
}

export interface WebSocketMessage {
  type: 'task_created' | 'task_updated' | 'task_deleted' | 'task_completed';
  payload: Task;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}
