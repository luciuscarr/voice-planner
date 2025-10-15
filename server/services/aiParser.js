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

// Ask OpenAI to return an ARRAY of commands in one shot
async function parseCommandsArray(transcript) {
  const now = new Date();
  const currentDateTime = now.toISOString();
  const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' });

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are a voice command parser for a task planning application. Parse the user's full utterance into an ARRAY of structured commands.

Return ONLY valid JSON object with a single top-level key "commands" that is an array (no markdown):
{
  "commands": [
    {
      "intent": "task" | "reminder" | "note" | "schedule" | "findTime" | "delete" | "complete" | "unknown",
      "confidence": number,
      "extractedData": {
        "title": string,
        "dueDate": string | null,
        "date": string | null,   // YYYY-MM-DD (user local)
        "time": string | null,   // HH:mm 24h (user local)
        "priority": "low" | "medium" | "high",
        "timePreference": "morning" | "afternoon" | "evening" | null,
        "duration": number | null,
        "description": string | null,
        "reminders": number[] | null,            // minutes before due time
        "applyToLastScheduled": boolean | null   // refers to most recently scheduled item
      }
    }
  ]
}

Rules:
- Interpret weekdays and times in user's timezone if provided via hints like [UserTimeZone:..] or [UserOffsetMinutes:..].
- If multiple tasks are spoken (e.g., "... and ..."), return multiple objects in the array.
- If only one command is present, still return one object in the "commands" array.
- Use "schedule" for appointments/meetings. Clean titles (no command words/time phrases).
- Populate date/time fields when present; set dueDate when datetime is fully known.
- Extract reminder offsets from phrases like "30 minutes", "an hour", and allow multiples.
- Return {"commands":[]} only if nothing actionable is detected.`
      },
      { role: "user", content: transcript }
    ],
    temperature: 0.2,
    response_format: { type: "json_object" }
  });

  // The model returns a JSON object or array as a string; ensure we get an array
  const content = completion.choices[0].message.content;
  const parsed = JSON.parse(content);
  if (Array.isArray(parsed)) return parsed;
  if (parsed && Array.isArray(parsed.commands)) return parsed.commands;
  if (parsed && Array.isArray(parsed.data)) return parsed.data;
  return [];
}

// NOTE: Removed stray prompt text that was accidentally left outside of a string
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

