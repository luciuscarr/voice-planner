import { VoiceCommand } from '@shared/types';

// Keywords for different intents
const INTENT_KEYWORDS = {
  task: ['add', 'create', 'new', 'make', 'do', 'complete', 'finish', 'need to'],
  reminder: ['remind', 'reminder', 'alert', 'notify', 'wake up', 'don\'t forget'],
  note: ['note', 'write', 'record', 'remember', 'jot down'],
  schedule: ['schedule', 'meeting', 'appointment', 'book', 'plan', 'arrange'],
  delete: ['delete', 'remove', 'cancel', 'clear', 'erase'],
  complete: ['done', 'finished', 'completed', 'accomplished', 'check off'],
  findTime: ['find time', 'find a time', 'when can i', 'free time', 'available time', 'good time', 'look for a time', 'look for time', 'find me a time', 'find some time']
};

// Separators that indicate multiple tasks
const TASK_SEPARATORS = [
  ', and ',
  ' and then ',
  ' also ',
  ' plus ',
  ', ',
  ' and ',
];

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
  specificTime: /\b(at|@)\s+(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)(:\d{2})?\s*(am|pm|o'clock|oclock)?\b/i,
  relativeTime: /\b(in|after)\s+(\d+)\s+(minute|hour|day|week)s?\b/i
};

// Map word numbers to digits for time parsing
const WORD_TO_NUMBER: { [key: string]: number } = {
  'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5, 'six': 6,
  'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10, 'eleven': 11, 'twelve': 12
};

// Extract reminder offsets like "30 minutes" or "an hour" from free text
function extractReminderOffsets(text: string): number[] {
  const lower = text.toLowerCase();
  const minutes: number[] = [];

  // Numeric minutes, e.g., 5 min, 15 minutes, 120 minutes
  const minuteMatches = lower.match(/(\d{1,3})\s*(minute|minutes|min)\b/g);
  if (minuteMatches) {
    for (const m of minuteMatches) {
      const n = parseInt(m);
      if (!isNaN(n)) minutes.push(n);
    }
  }

  // Hours variants, e.g., an hour, 1 hour, 2 hrs
  const hourMatches = lower.match(/(an|a|\d{1,2})\s*(hour|hours|hr|hrs)\b/g);
  if (hourMatches) {
    for (const m of hourMatches) {
      const val = m.startsWith('an') || m.startsWith('a') ? 1 : parseInt(m);
      const num = isNaN(val) ? null : val * 60;
      if (num) minutes.push(num);
    }
  }

  // Common phrases
  if (/half an hour/.test(lower)) minutes.push(30);
  if (/(quarter of an hour|quarter hour)/.test(lower)) minutes.push(15);

  // De-duplicate and sort ascending (closest first)
  const unique = Array.from(new Set(minutes));
  return unique.sort((a, b) => a - b);
}

// Heuristic to determine if a reminder refers to the last scheduled item in the same utterance
function refersToLastScheduled(text: string): boolean {
  const lower = text.toLowerCase();
  return /(beforehand|before|for\s+this|for\s+that|this\s+appointment|this\s+meeting|remind\s+me)/.test(lower);
}

// Split transcript into multiple tasks if separated by keywords
function splitIntoMultipleTasks(transcript: string): string[] {
  let tasks = [transcript];
  
  // Try each separator
  for (const separator of TASK_SEPARATORS) {
    const newTasks: string[] = [];
    
    for (const task of tasks) {
      // Check if this task contains the separator
      if (task.toLowerCase().includes(separator.toLowerCase())) {
        // Split by this separator
        const parts = task.split(new RegExp(separator, 'gi'));
        newTasks.push(...parts.filter(p => p.trim().length > 0));
      } else {
        newTasks.push(task);
      }
    }
    
    tasks = newTasks;
  }
  
  return tasks.filter(t => t.trim().length > 3); // Filter out very short fragments
}

// Parse a single task
function parseSingleTask(transcript: string): VoiceCommand {
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

  // Extract title (remove command words and calendar-related phrases)
  let title = transcript;
  const commandWords = Object.values(INTENT_KEYWORDS).flat();
  commandWords.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    title = title.replace(regex, '').trim();
  });
  
  // Remove calendar-related phrases
  const calendarPhrases = [
    /\bto my calendar\b/gi,
    /\bto the calendar\b/gi,
    /\bon my calendar\b/gi,
    /\bin my calendar\b/gi,
    /\bto calendar\b/gi
  ];
  
  calendarPhrases.forEach(phrase => {
    title = title.replace(phrase, '').trim();
  });
  
  // Remove time and date phrases from title (they'll be in dueDate)
  const timePhrases = [
    /\bat\s+(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)(:\d{2})?\s*(am|pm|o'clock|oclock)?\b/gi,
    /\btomorrow\b/gi,
    /\btoday\b/gi,
    /\bnext\s+\w+\b/gi,
    /\bthis\s+\w+\b/gi,
    /\bfor\s+\b/gi  // Remove "for" that might be left over
  ];
  
  timePhrases.forEach(phrase => {
    title = title.replace(phrase, '').trim();
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
  let baseDate: Date | undefined;
  let specificTime: { hours: number; minutes: number } | undefined;
  
  // First, check for day references (today, tomorrow, etc.)
  if (TIME_PATTERNS.tomorrow.test(transcript)) {
    baseDate = new Date();
    baseDate.setDate(baseDate.getDate() + 1);
  } else if (TIME_PATTERNS.today.test(transcript)) {
    baseDate = new Date();
  } else if (TIME_PATTERNS.nextWeek.test(transcript)) {
    baseDate = new Date();
    baseDate.setDate(baseDate.getDate() + 7);
  } else if (TIME_PATTERNS.thisWeek.test(transcript)) {
    baseDate = new Date();
    baseDate.setDate(baseDate.getDate() + (7 - baseDate.getDay()));
  }
  
  // Then, check for specific time
  const timeMatch = transcript.match(TIME_PATTERNS.specificTime);
  if (timeMatch) {
    const timeDetails = timeMatch[0].match(/(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)(:\d{2})?\s*(am|pm|o'clock|oclock)?/i);
    if (timeDetails) {
      // Convert word to number if needed
      const hourStr = timeDetails[1].toLowerCase();
      let hours = isNaN(parseInt(hourStr)) ? (WORD_TO_NUMBER[hourStr] || 0) : parseInt(hourStr);
      
      const minuteMatch = timeDetails[2];
      const minutes = minuteMatch ? parseInt(minuteMatch.replace(':', '')) : 0;
      const ampm = timeDetails[3]?.toLowerCase().replace(/[^a-z]/g, ''); // Remove apostrophes from o'clock
      
      // Handle AM/PM conversion
      if (ampm === 'pm' && hours !== 12) hours += 12;
      if (ampm === 'am' && hours === 12) hours = 0;
      // If no AM/PM specified and hour is between 1-7, assume PM (common for afternoon meetings)
      if (!ampm && hours >= 1 && hours <= 7) hours += 12;
      
      specificTime = { hours, minutes };
    }
  }
  
  // Combine base date with specific time
  if (baseDate && specificTime) {
    baseDate.setHours(specificTime.hours, specificTime.minutes, 0, 0);
    dueDate = baseDate.toISOString();
  } else if (baseDate) {
    dueDate = baseDate.toISOString();
  } else if (specificTime) {
    const date = new Date();
    date.setHours(specificTime.hours, specificTime.minutes, 0, 0);
    dueDate = date.toISOString();
  }
  
  // Check for relative time if no other date found
  if (!dueDate) {
    const relativeMatch = transcript.match(TIME_PATTERNS.relativeTime);
    if (relativeMatch) {
      const details = relativeMatch[0].match(/(\d+)\s+(minute|hour|day|week)/i);
      if (details) {
        const amount = parseInt(details[1]);
        const unit = details[2].toLowerCase();
        const futureDate = new Date();
        
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
    }
  }

  // Extract reminder offsets and contextual linkage
  const reminderOffsets = extractReminderOffsets(transcript);
  const applyToLast = refersToLastScheduled(transcript);

  return {
    text: transcript,
    intent,
    confidence,
    extractedData: {
      title: title.trim(),
      dueDate,
      priority,
      // Include reminders if mentioned anywhere in the fragment
      reminders: reminderOffsets.length > 0 ? reminderOffsets : undefined,
      // Mark that this reminder likely applies to the previously scheduled item
      applyToLastScheduled: reminderOffsets.length > 0 && applyToLast ? true : undefined
    }
  };
}

// Main export function - handles multiple tasks
export function parseIntent(transcript: string): VoiceCommand | VoiceCommand[] {
  // Check if transcript contains multiple tasks
  const tasks = splitIntoMultipleTasks(transcript);
  
  if (tasks.length === 1) {
    // Single task
    return parseSingleTask(transcript);
  } else {
    // Multiple tasks - parse each one
    return tasks.map(task => {
      // Prepend "add" if the task doesn't start with a command word
      const hasCommand = Object.values(INTENT_KEYWORDS).flat().some(keyword => 
        task.toLowerCase().trim().startsWith(keyword)
      );
      
      const taskText = hasCommand ? task : `add ${task}`;
      return parseSingleTask(taskText.trim());
    });
  }
}
