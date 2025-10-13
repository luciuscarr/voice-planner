const OpenAI = require('openai');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Parse voice command using OpenAI's GPT model
 * @param {string} transcript - The voice transcript to parse
 * @returns {Promise<Object>} Parsed command with intent and extracted data
 */
async function parseVoiceCommand(transcript) {
  try {
    const currentDateTime = new Date().toISOString();
    const currentDay = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Using GPT-4o-mini for cost efficiency
      messages: [
        {
          role: "system",
          content: `You are a voice command parser for a task planning application. Your job is to understand natural language commands and extract structured data.

Current date/time: ${currentDateTime}
Current day: ${currentDay}

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
    "description": string | null
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
- "today" → today's date
- "tomorrow" → tomorrow's date
- "next week" → 7 days from now
- "monday", "tuesday", etc → next occurrence of that day
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
    // First, check if there are multiple commands
    const response = await parseVoiceCommand(transcript);
    
    if (response.hasMultipleTasks) {
      // Split the transcript intelligently and parse each one
      const separators = [', and ', ' and then ', ' also ', ' plus ', ' and ', ', ', ' & ', ' then '];
      let parts = [transcript];
      
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

      // Derive a base noun (e.g., "appointment", "meeting") if present
      const baseNounMatch = transcript.match(/\b(appointment|meeting|reminder|note|task|event)\b/i);
      const baseNoun = baseNounMatch ? baseNounMatch[1] : null;

      // Normalize parts: if a part is context-dependent (e.g., starts with "another" or only has time/date),
      // prepend the base noun and a command word to improve parsing.
      const normalizedParts = parts
        .map(p => p.trim())
        .filter(p => p.length > 0)
        .map((p, idx) => {
          let text = p;
          const lower = p.toLowerCase();
          const hasCommandWord = /(add|create|make|schedule|remind|note|delete|remove|cancel|complete)\b/i.test(lower);
          const startsContextual = /^(another|on\s+\w+day|on\s+\w+|at\s+\d|tomorrow|today|next\s+\w+)/i.test(lower);
          if (startsContextual && baseNoun) {
            text = `${baseNoun} ${p}`;
          }
          if (!hasCommandWord) {
            text = `add ${text}`;
          }
          return text.trim();
        });

      // Parse each part
      const parsedCommands = await Promise.all(
        normalizedParts.map(part => parseVoiceCommand(part))
      );
      
      return parsedCommands;
    }
    
    return [response];
    
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

