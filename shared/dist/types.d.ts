export interface Task {
    id: string;
    title: string;
    description?: string;
    type: TaskType;
    priority: Priority;
    dueDate?: Date;
    completed: boolean;
    createdAt: Date;
    updatedAt: Date;
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
    timestamp: Date;
    confidence: number;
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