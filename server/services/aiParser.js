const OpenAI = require('openai');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Fallback: extract reminder offsets like "30 minutes and an hour before"
function extractReminderOffsets(text) {
  const lower = text.toLowerCase();

  const mins = [];
  // e.g., "30 minutes", "45 min"
  const minuteMatches = lower.match(/(\d{1,3})\s*(minute|minutes|min)\b/g);
  if (minuteMatches) {
    for (const m of minuteMatches) {
      const num = parseInt(m);
      if (!isNaN(num)) mins.push(num);
    }
  }
  // e.g., "an hour", "1 hour", "2 hours"
  const hourMatches = lower.match(/(an|a|\d{1,2})\s*(hour|hours|hr|hrs)\b/g);
  if (hourMatches) {
    for (const m of hourMatches) {
      const n = m.startsWith('an') || m.startsWith('a') ? 1 : parseInt(m);
      const num = isNaN(n) ? null : n * 60;
      if (num) mins.push(num);
    }
  }
  // common phrases (do not add duplicates)
  if (/half an hour/.test(lower)) mins.push(30);
  if (/(quarter of an hour|quarter hour)/.test(lower)) mins.push(15);
  // capture patterns like "30 minutes and an hour" or "30, 45, and 60 minutes"
  const listMinutes = lower.match(/\b(\d{1,3})\s*(minutes|min)\b/g);
  if (listMinutes) {
    for (const m of listMinutes) {
      const n = parseInt(m);
      if (!isNaN(n)) mins.push(n);
    }
  }

  // de-duplicate and sort descending (longer first or arbitrary)
  const unique = Array.from(new Set(mins));
  return unique.sort((a, b) => b - a);
}

/**
 * Parse weekday names in transcript and return YYYY-MM-DD date
 * @param {string} transcript - The voice transcript
 * @returns {string|null} Date in YYYY-MM-DD format or null
 */
function parseWeekdayInTranscript(transcript) {
  const weekdays = {
    'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3, 
    'thursday': 4, 'friday': 5, 'saturday': 6
  };
  
  const lowerTranscript = transcript.toLowerCase();
  
  for (const [dayName, dayIndex] of Object.entries(weekdays)) {
    if (lowerTranscript.includes(dayName)) {
      // Use local timezone to avoid UTC issues
      const today = new Date();
      const currentDay = today.getDay();
      
      console.log(`Debug: Looking for ${dayName} (index ${dayIndex}), current day is ${currentDay}`);
      
      // Calculate days until target day
      let daysUntilTarget = dayIndex - currentDay;
      
      // If it's the same day, use today; if it's in the past this week, use next week
      if (daysUntilTarget < 0) {
        daysUntilTarget += 7; // Next week
      } else if (daysUntilTarget === 0) {
        // Same day - use today
        daysUntilTarget = 0;
      }
      
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + daysUntilTarget);
      
      const result = targetDate.toISOString().split('T')[0];
      console.log(`Debug: Target date calculated as ${result} (${targetDate.toDateString()})`);
      
      return result; // Return YYYY-MM-DD
    }
  }
  
  return null;
}

/**
 * Parse time in transcript and return HH:mm format
 * @param {string} transcript - The voice transcript
 * @returns {string|null} Time in HH:mm format or null
 */
function parseTimeInTranscript(transcript) {
  const lowerTranscript = transcript.toLowerCase();
  
  // Match patterns like "8 am", "2 pm", "8:30 am", "2:15 pm"
  const timePatterns = [
    /(\d{1,2}):(\d{2})\s*(am|pm)/i,
    /(\d{1,2})\s*(am|pm)/i
  ];
  
  for (const pattern of timePatterns) {
    const match = lowerTranscript.match(pattern);
    if (match) {
      let hours = parseInt(match[1]);
      let minutes = match[2] ? parseInt(match[2]) : 0;
      const period = match[3] || match[2];
      
      // Convert to 24-hour format
      if (period === 'pm' && hours !== 12) {
        hours += 12;
      } else if (period === 'am' && hours === 12) {
        hours = 0;
      }
      
      const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      console.log(`Debug: Parsed time "${transcript}" as ${timeString}`);
      return timeString;
    }
  }
  
  return null;
}

/**
 * Parse voice command using OpenAI's GPT model
 * @param {string} transcript - The voice transcript to parse
 * @returns {Promise<Object>} Parsed command with intent and extracted data
 */
async function parseVoiceCommand(transcript) {
  try {
    const now = new Date();
    const currentDateTime = now.toISOString();
    const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' });
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Using GPT-4o-mini for cost efficiency
      messages: [
        {
          role: "system",
          content: `You are a voice command parser for a task planning application. Your job is to understand natural language commands and extract structured data.

Current date/time (UTC ISO): ${currentDateTime}
Current day (user-local may differ): ${currentDay}

IMPORTANT: When the user mentions a weekday name (like "Saturday", "Sunday", "Monday", etc.), you MUST:
1. Calculate the specific date for that weekday
2. If it's the current day, use today's date
3. If it's a future weekday in the current week, use that date
4. If it's a past weekday in the current week, use the same weekday NEXT week
5. Always provide the date in YYYY-MM-DD format in the "date" field
6. If a specific time is mentioned, include it in the "time" field as HH:mm (24-hour format)

If the user message contains hints like [UserTimeZone:America/Los_Angeles] or [UserOffsetMinutes:-420], interpret weekday names (e.g., "Thursday") against that user timezone.

Parse the user's voice command and return a JSON object with the following STRICT structure and formatting (return JSON only):
{
  "intent": "task" | "reminder" | "note" | "schedule" | "findTime" | "delete" | "complete" | "unknown",
  "confidence": number, // 0.0 to 1.0
  "extractedData": {
    "title": string, // cleaned title without command words/time phrases
    "dueDate": string | null, // ISO 8601 if exact datetime resolved, else null
    "date": string | null, // YYYY-MM-DD if a calendar date is mentioned
    "time": string | null, // HH:mm (24-hour) if a specific time is mentioned
    "priority": "low" | "medium" | "high",
    "timePreference": "morning" | "afternoon" | "evening" | null,
    "duration": number | null, // minutes
    "description": string | null,
    "reminders": number[] | null, // minutes before due time to notify (e.g., [60,30])
    "applyToLastScheduled": boolean | null // true if refers to the most recent scheduled item (e.g., "this appointment")
  }
}
`
        },
        {
          role: "user",
          content: transcript
        }
      ],
      temperature: 0.2, // Lower temperature for deterministic formatting
      response_format: { type: "json_object" }
    });

    const parsedResponse = JSON.parse(completion.choices[0].message.content);
    
    // If AI didn't parse a date but we can detect a weekday, add it
    if (!parsedResponse.extractedData?.date && !parsedResponse.extractedData?.dueDate) {
      const weekdayDate = parseWeekdayInTranscript(transcript);
      if (weekdayDate) {
        parsedResponse.extractedData = parsedResponse.extractedData || {};
        parsedResponse.extractedData.date = weekdayDate;
      }
    }
    
    // If multiple tasks detected, we'll handle splitting on the client side
    return {
      text: transcript,
      ...parsedResponse
    };
    
  } catch (error) {
    console.error('OpenAI parsing error:', error);
    
    // Enhanced fallback with weekday and time parsing
    const weekdayDate = parseWeekdayInTranscript(transcript);
    const timeMatch = parseTimeInTranscript(transcript);
    
    return {
      text: transcript,
      intent: 'schedule',
      confidence: 0.5,
      extractedData: {
        title: transcript.replace(/\b(schedule|appointment|meeting|event|for|at|am|pm)\b/gi, '').trim(),
        date: weekdayDate,
        time: timeMatch,
        priority: 'medium'
      },
      error: 'AI parsing failed, using enhanced fallback'
    };
  }
}

/**
 * Parse multiple voice commands if they are comma or "and" separated
 * @param {string} transcript - The voice transcript
 * @returns {Promise<Array>} Array of parsed commands
 */
async function parseMultipleCommands(transcript) {
  try {
    // First preference: let the model return an ARRAY of commands
    try {
      const array = await parseCommandsArray(transcript);
      if (Array.isArray(array) && array.length > 0) {
        let commands = array.map(cmd => ({ text: transcript, ...cmd }));
        // If model returned only a reminder but transcript clearly contains an appointment time, synthesize a schedule
        const hasSchedule = commands.some(c => c.intent === 'schedule' || c.intent === 'task');
        const hasReminder = commands.some(c => c.intent === 'reminder' || (c.extractedData && Array.isArray(c.extractedData.reminders) && c.extractedData.reminders.length > 0));
        const looksLikeAppointment = /\b(appointment|meeting|schedule)\b/i.test(transcript) && /(\b\d{1,2}(:\d{2})?\s*(am|pm)\b|at\s+\d{1,2})/i.test(transcript);
        if (!hasSchedule && hasReminder && looksLikeAppointment) {
          const candidate = await parseVoiceCommand(transcript);
          if (candidate && (candidate.intent === 'schedule' || candidate.extractedData?.dueDate || candidate.extractedData?.time)) {
            commands = [{ ...candidate, text: transcript }, ...commands];
          }
        }
        return commands;
      }
    } catch (e) {
      // fall through to deterministic splitting
    }

    // Fallback: split transcript by common multi-command separators
    const splitIntoParts = (text) => {
      // 1) Separator words
      const separators = [', and ', ' and then ', ' also ', ' plus ', ' and ', ', ', ' & ', ' then '];
      let parts = [text];
      for (const separator of separators) {
        const newParts = [];
        for (const part of parts) {
          if (part.toLowerCase().includes(separator)) {
            newParts.push(...part.split(new RegExp(separator, 'gi')));
          } else {
            newParts.push(part);
          }
        }
        parts = newParts;
      }

      // 2) Sentence boundaries (avoid breaking times; split only on punctuation followed by whitespace)
      // e.g., "... at 2:00 p.m. remind me ..."
      {
        const newParts = [];
        for (const part of parts) {
          const chunks = part.split(/(?<=[.!?])\s+(?=[A-Za-z])/g);
          newParts.push(...chunks);
        }
        parts = newParts;
      }

      // 3) If phrase like "and schedule another appointment ...", split right before that sequence
      {
        const newParts = [];
        for (const part of parts) {
          const chunks = part.split(/\band\s+schedule\s+(?=another\s+(appointment|meeting|event)\b)/gi);
          newParts.push(...chunks);
        }
        parts = newParts;
      }

      // 4) Start of a new appointment/meeting/event phrase (e.g., "another appointment", "another meeting")
      {
        const newParts = [];
        for (const part of parts) {
          // Split BEFORE the keyword so it starts a new fragment
          const chunks = part.split(/(?=\banother\s+(appointment|meeting|event)\b)/gi);
          newParts.push(...chunks);
        }
        parts = newParts;
      }

      // 5) Cleanup: remove connector-only fragments like "and", "and schedule"
      const cleaned = [];
      for (let i = 0; i < parts.length; i++) {
        const p = (parts[i] || '').trim();
        if (!p) continue;
        // Drop trivial connectors
        if (/^(and|then)$/i.test(p)) continue;
        if (/^(and\s+)?schedule\s*$/i.test(p)) continue;
        if (/^(and\s+)?schedule\s+(it|this|that)$/i.test(p)) continue;
        cleaned.push(p);
      }

      return cleaned;
    };

    // First attempt deterministic splitting regardless of AI flag
    let parts = splitIntoParts(transcript);

    // If only one part, ask AI once and see if it hints multiple tasks
    const response = await parseVoiceCommand(transcript);
    if (parts.length === 1 && response.hasMultipleTasks) {
      parts = splitIntoParts(transcript);
    }

    // If still single-part, just return the AI's single response
    if (parts.length <= 1) {
      return [response];
    }

    // Derive a base noun (e.g., "appointment", "meeting") if present
    const baseNounMatch = transcript.match(/\b(appointment|meeting|reminder|note|task|event)\b/i);
    const baseNoun = baseNounMatch ? baseNounMatch[1] : null;

    // Normalize contextual fragments
    const normalizedParts = parts.map((p) => {
      let text = p.trim();
      const lower = text.toLowerCase();
      const hasCommandWord = /(add|create|make|schedule|remind|note|delete|remove|cancel|complete)\b/i.test(lower);
      const startsContextual = /^(another|on\s+\w+day|on\s+\w+|at\s+\d|tomorrow|today|next\s+\w+)/i.test(lower);
      const hasTime = /(\b\d{1,2}(:\d{2})?\s*(am|pm)\b|\bat\s+\d{1,2}(:\d{2})?\b)/i.test(lower);

      if (startsContextual && baseNoun) {
        // e.g., "another for 6pm" → "appointment another for 6pm"
        text = `${baseNoun} ${text.replace(/^another\s*/i, '')}`.trim();
      }

      if (!hasCommandWord) {
        // Prefer "schedule" when we have a time and the base noun suggests an event
        if (hasTime && baseNoun && /(appointment|meeting|event)/i.test(baseNoun)) {
          text = `schedule ${text}`;
        } else {
          text = `add ${text}`;
        }
      }

      return text.trim();
    });

    // Parse each part independently via AI
    let parsedCommands = await Promise.all(
      normalizedParts.map(part => parseVoiceCommand(part))
    );

    // Fallback: convert reminder-only phrases to applyToLastScheduled with reminders
    parsedCommands = parsedCommands.map(cmd => {
      const text = cmd?.text || '';
      const offsets = extractReminderOffsets(text);
      const refersToLast = /(for\s+this|for\s+that|this\s+appointment|this\s+meeting|beforehand|before|remind\s+me)/i.test(text);
      if (offsets.length > 0 && refersToLast) {
        return {
          ...cmd,
          intent: cmd.intent, // unchanged
          extractedData: {
            ...(cmd.extractedData || {}),
            reminders: offsets,
            applyToLastScheduled: true,
            // clear misleading title if it's generic like "remind me"
            title: (cmd.extractedData && cmd.extractedData.title) || undefined
          }
        };
      }
      return cmd;
    });

    // Fallback: convert title-change phrases like "call it X" to applyToLastScheduled title updates
    parsedCommands = parsedCommands.map(cmd => {
      const text = cmd?.text || '';
      const m = text.match(/\b(call it|title it|name it)\s+(.+)$/i);
      if (m && m[2]) {
        const title = m[2].trim();
        return {
          ...cmd,
          extractedData: {
            ...(cmd.extractedData || {}),
            title,
            applyToLastScheduled: true
          }
        };
      }
      return cmd;
    });

    // Propagate base date across commands when missing (e.g., "today" applies to later fragments)
    const lowerAll = transcript.toLowerCase();
    let baseDate = null;
    if (/\btoday\b/i.test(transcript) || /\btonight\b/i.test(transcript)) {
      const d = new Date();
      baseDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    } else if (/\btomorrow\b/i.test(transcript)) {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      baseDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    }

    const getDateOnly = (iso) => {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return null;
      return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    };

    let lastKnownDate = null;
    parsedCommands = parsedCommands.map(cmd => {
      const ed = cmd.extractedData || {};
      const hasExplicitDate = !!ed.date || !!ed.dueDate;
      if (ed.dueDate && !ed.date) {
        const d = new Date(ed.dueDate);
        if (!isNaN(d.getTime())) {
          ed.date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        }
      }
      if (ed.date) {
        const parts = ed.date.split('-').map(Number);
        lastKnownDate = new Date(parts[0], (parts[1] || 1) - 1, parts[2] || 1);
      } else if (ed.dueDate) {
        const dd = getDateOnly(ed.dueDate);
        if (dd) lastKnownDate = dd;
      }

      // If time present but no date, apply lastKnownDate or baseDate
      if (!hasExplicitDate && ed.time) {
        const anchor = lastKnownDate || baseDate;
        if (anchor) {
          let [hh, mm] = ed.time.split(':').map(Number);
          // If transcript suggests PM/tonight/evening and hour is < 12, bias to PM
          const pmHint = /(pm|p\.m\.|tonight|evening)/i.test(transcript);
          if (pmHint && !isNaN(hh) && hh >= 1 && hh <= 11) hh += 12;
          const composed = new Date(anchor);
          composed.setHours(isNaN(hh) ? 0 : hh, isNaN(mm) ? 0 : mm, 0, 0);
          ed.dueDate = composed.toISOString();
          ed.date = `${anchor.getFullYear()}-${String(anchor.getMonth() + 1).padStart(2, '0')}-${String(anchor.getDate()).padStart(2, '0')}`;
        }
      }

      return { ...cmd, extractedData: ed };
    });

    return parsedCommands;

  } catch (error) {
    console.error('Error parsing multiple commands:', error);
    return [{
      text: transcript,
      intent: 'unknown',
      confidence: 0.3,
      extractedData: { title: transcript, priority: 'medium' }
    }];
  }
}

module.exports = {
  parseVoiceCommand,
  parseMultipleCommands
};

