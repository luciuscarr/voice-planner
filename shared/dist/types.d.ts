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
export declare enum TaskType {
    TASK = "task",
    REMINDER = "reminder",
    NOTE = "note",
    EVENT = "event"
}
export declare enum Priority {
    LOW = "low",
    MEDIUM = "medium",
    HIGH = "high",
    URGENT = "urgent"
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
        date?: string;
        time?: string;
        priority?: 'low' | 'medium' | 'high';
        timePreference?: 'morning' | 'afternoon' | 'evening';
        duration?: number;
        reminders?: number[];
        applyToLastScheduled?: boolean;
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
//# sourceMappingURL=types.d.ts.map