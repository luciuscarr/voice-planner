const OpenAI = require('openai');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Fallback: extract reminder offsets like "30 minutes and an hour before"
function extractReminderOffsets(text) {
  const lower = text.toLowerCase();
  if (!/(before|beforehand)/.test(lower)) return [];

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
  // common phrases
  if (/half an hour/.test(lower)) mins.push(30);
  if (/quarter of an hour|quarter hour/.test(lower)) mins.push(15);

  // de-duplicate and sort descending (longer first or arbitrary)
  const unique = Array.from(new Set(mins));
  return unique.sort((a, b) => b - a);
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

Intent definitions:
- "task": Creating or adding a task/todo item
- "reminder": Setting a reminder or alert
- "note": Recording a note or memo
- "schedule": Scheduling a meeting or appointment
- "findTime": Finding available time for an activity
- "delete": Removing or canceling something
- "complete": Marking something as done
- "unknown": Cannot determine intent

Priority rules:
- "urgent", "important", "asap", "critical" → high
- "low", "minor", "whenever" → low
- default → medium

Time parsing rules:
- Reminder parsing rules:
- Phrases like "remind me 30 minutes before", "notify me an hour before" → reminders: [30] or [60]
- Allow multiple reminders: "30 minutes and an hour before" → [30, 60]
- "this appointment" / "that meeting" should set applyToLastScheduled = true
- "today" → today's date
- "tomorrow" → tomorrow's date
- "next week" → 7 days from now
- "monday", "tuesday", etc → next occurrence of that day in the user's timezone context
- "at 3pm", "at 3 o'clock" → include specific time
- "in 2 hours", "in 30 minutes" → relative time from now
- "morning" → 9:00 AM if no specific time
- "afternoon" → 2:00 PM if no specific time
- "evening" → 6:00 PM if no specific time

Formatting rules:
- Always interpret dates/times in the user's local timezone unless an explicit timezone is spoken.
- If a specific calendar date is inferred/mentioned, set extractedData.date as YYYY-MM-DD (user local).
- If a specific clock time is inferred/mentioned, set extractedData.time as HH:mm (24-hour, user local).
- If both date and time are present, you may set extractedData.dueDate to the combined ISO datetime but the client will recompute in local time from date+time fields.
- If only date or time is present, set dueDate to null and populate date/time fields accordingly.

Multiple commands:
If multiple tasks are mentioned (separated by "and", "also", commas), only parse the FIRST one and set a flag "hasMultipleTasks": true.

Return ONLY valid JSON, no markdown or additional text.`
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
    
    // If multiple tasks detected, we'll handle splitting on the client side
    return {
      text: transcript,
      ...parsedResponse
    };
    
  } catch (error) {
    console.error('OpenAI parsing error:', error);
    
    // Fallback to basic parsing if AI fails
    return {
      text: transcript,
      intent: 'unknown',
      confidence: 0.3,
      extractedData: {
        title: transcript,
        priority: 'medium'
      },
      error: 'AI parsing failed, using fallback'
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
    // Helper: split transcript by common multi-command separators
    const splitIntoParts = (text) => {
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
      return parts.map(p => p.trim()).filter(p => p.length > 0);
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
      let text = p;
      const lower = p.toLowerCase();
      const hasCommandWord = /(add|create|make|schedule|remind|note|delete|remove|cancel|complete)\b/i.test(lower);
      const startsContextual = /^(another|on\s+\w+day|on\s+\w+|at\s+\d|tomorrow|today|next\s+\w+)/i.test(lower);
      if (startsContextual && baseNoun) {
        text = `${baseNoun} ${text}`;
      }
      if (!hasCommandWord) {
        text = `add ${text}`;
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
      const refersToLast = /(for\s+this|for\s+that|this\s+appointment|this\s+meeting|beforehand)/i.test(text);
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

