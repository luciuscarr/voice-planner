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

Parse the user's voice command and return a JSON object with the following structure:
{
  "intent": "task" | "reminder" | "note" | "schedule" | "findTime" | "delete" | "complete" | "unknown",
  "confidence": 0.0 to 1.0,
  "extractedData": {
    "title": "cleaned task title without command words or time references",
    "dueDate": "ISO 8601 date string if mentioned, null otherwise",
    "priority": "low" | "medium" | "high",
    "timePreference": "morning" | "afternoon" | "evening" | null,
    "duration": minutes as number or null,
    "description": "additional details if mentioned"
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

If multiple tasks are mentioned (separated by "and", "also", commas), only parse the FIRST one and set a flag "hasMultipleTasks": true.

Return ONLY valid JSON, no markdown or additional text.`
        },
        {
          role: "user",
          content: transcript
        }
      ],
      temperature: 0.3, // Lower temperature for more consistent parsing
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
      const separators = [', and ', ' and then ', ' also ', ' plus '];
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
      
      // Parse each part
      const parsedCommands = await Promise.all(
        parts.filter(p => p.trim().length > 0).map(part => parseVoiceCommand(part.trim()))
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

