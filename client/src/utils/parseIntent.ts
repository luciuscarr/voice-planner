import { VoiceCommand } from '@shared/types';

// Keywords for different intents
const INTENT_KEYWORDS = {
  task: ['add', 'create', 'new', 'make', 'do', 'complete', 'finish'],
  reminder: ['remind', 'reminder', 'alert', 'notify', 'wake up'],
  note: ['note', 'write', 'record', 'remember', 'jot down'],
  schedule: ['schedule', 'meeting', 'appointment', 'book', 'plan', 'arrange'],
  delete: ['delete', 'remove', 'cancel', 'clear', 'erase'],
  complete: ['done', 'finished', 'completed', 'accomplished', 'check off']
};

// Priority keywords
const PRIORITY_KEYWORDS = {
  high: ['urgent', 'important', 'asap', 'critical', 'priority'],
  medium: ['normal', 'regular', 'standard'],
  low: ['low', 'minor', 'whenever', 'sometime']
};

// Time-related keywords and patterns
const TIME_PATTERNS = {
  today: /\b(today|this morning|this afternoon|this evening|tonight)\b/i,
  tomorrow: /\b(tomorrow|next day)\b/i,
  thisWeek: /\b(this week|weekend|saturday|sunday)\b/i,
  nextWeek: /\b(next week|following week)\b/i,
  specificTime: /\b(at|@)\s+(\d{1,2}):?(\d{2})?\s*(am|pm)?\b/i,
  relativeTime: /\b(in|after)\s+(\d+)\s+(minute|hour|day|week)s?\b/i
};

export function parseIntent(transcript: string): VoiceCommand {
  const lowerTranscript = transcript.toLowerCase();
  
  // Detect intent
  let intent: VoiceCommand['intent'] = 'unknown';
  let confidence = 0;

  for (const [intentType, keywords] of Object.entries(INTENT_KEYWORDS)) {
    const matches = keywords.filter(keyword => lowerTranscript.includes(keyword));
    if (matches.length > 0) {
      intent = intentType as VoiceCommand['intent'];
      confidence = Math.min(0.9, 0.5 + (matches.length * 0.1));
      break;
    }
  }

  // Extract title (remove command words)
  let title = transcript;
  const commandWords = Object.values(INTENT_KEYWORDS).flat();
  commandWords.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    title = title.replace(regex, '').trim();
  });

  // Extract priority
  let priority: 'low' | 'medium' | 'high' = 'medium';
  for (const [priorityLevel, keywords] of Object.entries(PRIORITY_KEYWORDS)) {
    if (keywords.some(keyword => lowerTranscript.includes(keyword))) {
      priority = priorityLevel as 'low' | 'medium' | 'high';
      break;
    }
  }

  // Extract due date
  let dueDate: string | undefined;
  
  // Check for specific time patterns
  for (const [patternName, pattern] of Object.entries(TIME_PATTERNS)) {
    const match = transcript.match(pattern);
    if (match) {
      const now = new Date();
      
      switch (patternName) {
        case 'today':
          dueDate = now.toISOString().split('T')[0];
          break;
        case 'tomorrow':
          const tomorrow = new Date(now);
          tomorrow.setDate(tomorrow.getDate() + 1);
          dueDate = tomorrow.toISOString().split('T')[0];
          break;
        case 'thisWeek':
          const endOfWeek = new Date(now);
          endOfWeek.setDate(now.getDate() + (7 - now.getDay()));
          dueDate = endOfWeek.toISOString().split('T')[0];
          break;
        case 'nextWeek':
          const nextWeek = new Date(now);
          nextWeek.setDate(now.getDate() + 7);
          dueDate = nextWeek.toISOString().split('T')[0];
          break;
        case 'specificTime':
          // Extract time and create datetime
          const timeMatch = match[0].match(/(\d{1,2}):?(\d{2})?\s*(am|pm)?/i);
          if (timeMatch) {
            let hours = parseInt(timeMatch[1]);
            const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
            const ampm = timeMatch[3]?.toLowerCase();
            
            if (ampm === 'pm' && hours !== 12) hours += 12;
            if (ampm === 'am' && hours === 12) hours = 0;
            
            const date = new Date(now);
            date.setHours(hours, minutes, 0, 0);
            dueDate = date.toISOString();
          }
          break;
        case 'relativeTime':
          const relativeMatch = match[0].match(/(\d+)\s+(minute|hour|day|week)/i);
          if (relativeMatch) {
            const amount = parseInt(relativeMatch[1]);
            const unit = relativeMatch[2].toLowerCase();
            const futureDate = new Date(now);
            
            switch (unit) {
              case 'minute':
                futureDate.setMinutes(futureDate.getMinutes() + amount);
                break;
              case 'hour':
                futureDate.setHours(futureDate.getHours() + amount);
                break;
              case 'day':
                futureDate.setDate(futureDate.getDate() + amount);
                break;
              case 'week':
                futureDate.setDate(futureDate.getDate() + (amount * 7));
                break;
            }
            dueDate = futureDate.toISOString();
          }
          break;
      }
      break;
    }
  }

  return {
    text: transcript,
    intent,
    confidence,
    extractedData: {
      title: title.trim(),
      dueDate,
      priority
    }
  };
}
