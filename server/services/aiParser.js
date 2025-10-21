const OpenAI = require('openai');

// largely reformatted the way the parsing works to the AI. Gives more hints.



// Initialize OpenAI client only if API key is available
let openai = null;
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
  console.log('✅ OpenAI API initialized');
} else {
  console.log('⚠️ OpenAI API key not found - using fallback parsing only');
}

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
  
  // First check for specific dates like "October 18th", "Oct 18", "18th"
  const datePatterns = [
    /(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:st|nd|rd|th)?/i,
    /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+(\d{1,2})(?:st|nd|rd|th)?/i,
    /(\d{1,2})(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december)/i,
    /(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i
  ];
  
  for (const pattern of datePatterns) {
    const match = lowerTranscript.match(pattern);
    if (match) {
      const monthNames = {
        'january': 0, 'jan': 0, 'february': 1, 'feb': 1, 'march': 2, 'mar': 2,
        'april': 3, 'apr': 3, 'may': 4, 'june': 5, 'jun': 5, 'july': 6, 'jul': 6,
        'august': 7, 'aug': 7, 'september': 8, 'sep': 8, 'october': 9, 'oct': 9,
        'november': 10, 'nov': 10, 'december': 11, 'dec': 11
      };
      
      let month, day;
      if (match[1] in monthNames) {
        month = monthNames[match[1]];
        day = parseInt(match[2]);
      } else {
        month = monthNames[match[2]];
        day = parseInt(match[1]);
      }
      
      const currentYear = new Date().getFullYear();
      const targetDate = new Date(currentYear, month, day);
      
      console.log(`Debug: Found specific date - ${match[0]} -> ${targetDate.toISOString().split('T')[0]}`);
      console.log(`Debug: Specific date details - month: ${month}, day: ${day}, year: ${currentYear}`);
      return targetDate.toISOString().split('T')[0];
    }
  }
  
  // Then check for weekdays
  for (const [dayName, dayIndex] of Object.entries(weekdays)) {
    if (lowerTranscript.includes(dayName)) {
      // Use local timezone for consistent date calculation
      const now = new Date();
      const currentDay = now.getDay();
      
      console.log(`Debug: Looking for ${dayName} (index ${dayIndex}), current day is ${currentDay}`);
      console.log(`Debug: Current time - ${now.toISOString()}, local: ${now.toLocaleDateString()}`);
      
      // Calculate days until target day
      let daysUntilTarget = dayIndex - currentDay;
      
      // If it's the same day, use today; if it's in the past this week, use next week
      if (daysUntilTarget < 0) {
        daysUntilTarget += 7; // Next week
      } else if (daysUntilTarget === 0) {
        // Same day - use today
        daysUntilTarget = 0;
      }
      
      const targetDate = new Date(now);
      targetDate.setDate(now.getDate() + daysUntilTarget);
      
      const result = targetDate.toISOString().split('T')[0];
      console.log(`Debug: Target date calculated as ${result} (${targetDate.toDateString()})`);
      console.log(`Debug: Target date day of week: ${targetDate.getDay()}`);
      
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
  
  console.log(`Debug: Parsing time from "${transcript}" (lowercase: "${lowerTranscript}")`);
  
  // Match patterns like "8 am", "2 pm", "8:30 am", "2:15 pm", "8pm", "2pm"
  const timePatterns = [
    /(\d{1,2}):(\d{2})\s*(am|pm)/i,
    /(\d{1,2})\s*(am|pm)/i,
    /(\d{1,2}):(\d{2})(am|pm)/i,
    /(\d{1,2})(am|pm)/i
  ];
  
  for (let i = 0; i < timePatterns.length; i++) {
    const pattern = timePatterns[i];
    const match = lowerTranscript.match(pattern);
    console.log(`Debug: Pattern ${i + 1} (${pattern}): ${match ? 'MATCH' : 'NO MATCH'}`);
    
    if (match) {
      console.log(`Debug: Match groups:`, match);
      let hours = parseInt(match[1]);
      let minutes = match[2] ? parseInt(match[2]) : 0;
      const period = match[3] || match[2];
      
      console.log(`Debug: Extracted - hours: ${hours}, minutes: ${minutes}, period: ${period}`);
      
      // Convert to 24-hour format
      if (period === 'pm' && hours !== 12) {
        hours += 12;
      } else if (period === 'am' && hours === 12) {
        hours = 0;
      }
      
      const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      console.log(`Debug: Final time string: ${timeString}`);
      return timeString;
    }
  }
  
  console.log(`Debug: No time pattern matched for "${transcript}"`);
  return null;
}

/**
 * Analyze keywords for each individual task in a multi-command transcript
 * @param {string} transcript - The full voice transcript
 * @returns {Array} Array of keyword analysis for each task part
 */
function analyzeKeywordsPerTask(transcript) {
  // Split transcript into potential task parts
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
  
  // Clean up empty parts
  parts = parts.filter(part => part.trim().length > 0);
  
  // Analyze each part
  return parts.map((part, index) => {
    const preprocessed = preprocessTranscript(part.trim());
    return {
      taskIndex: index,
      text: part.trim(),
      keywords: preprocessed.highlightedKeywords,
      context: preprocessed.context,
      detectedAction: preprocessed.context.detectedAction,
      detectedTaskType: preprocessed.context.detectedTaskType
    };
  });
}

/**
 * Light preprocessing to enhance transcript for AI
 * @param {string} transcript - The raw voice transcript
 * @returns {Object} Enhanced transcript with keywords and context
 */
function preprocessTranscript(transcript) {
  const lowerTranscript = transcript.toLowerCase();
  
  // Extract keywords by category
  const actionWords = ['remind', 'create', 'schedule', 'note', 'write', 'call', 'text', 'email', 'send', 'make', 'add', 'delete', 'complete'];
  const priorityWords = ['urgent', 'important', 'high priority', 'low priority', 'asap', 'immediately', 'critical'];
  const timeWords = ['today', 'tomorrow', 'yesterday', 'next week', 'next month', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const taskTypeWords = ['meeting', 'event', 'appointment', 'task', 'reminder', 'note'];
  
  // Find highlighted keywords
  const highlightedKeywords = [];
  const allWords = lowerTranscript.split(/\s+/);
  
  allWords.forEach(word => {
    if (actionWords.includes(word) || 
        priorityWords.includes(word) || 
        timeWords.includes(word) || 
        taskTypeWords.includes(word)) {
      highlightedKeywords.push(word);
    }
  });
  
  // Detect potential intent hints
  const hasTime = /(\b\d{1,2}(:\d{2})?\s*(am|pm)\b|\bat\s+\d{1,2}(:\d{2})?\b)/i.test(transcript);
  const hasDate = /(today|tomorrow|yesterday|next week|next month|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i.test(transcript);
  const hasPriority = /(urgent|important|high priority|low priority|asap|immediately|critical)/i.test(transcript);
  
  return {
    originalText: transcript,
    highlightedKeywords: highlightedKeywords,
    context: {
      hasTime,
      hasDate,
      hasPriority,
      keywordCount: highlightedKeywords.length,
      detectedAction: actionWords.find(word => lowerTranscript.includes(word)),
      detectedTaskType: taskTypeWords.find(word => lowerTranscript.includes(word))
    }
  };
}

/**
 * Parse voice command using OpenAI's GPT model
 * @param {string} transcript - The voice transcript to parse
 * @returns {Promise<Object>} Parsed command with intent and extracted data
 */
async function parseVoiceCommand(transcript) {
  // If OpenAI is not available, use fallback parsing immediately
  if (!openai) {
    console.log('Using fallback parser (no OpenAI API key)');
    const weekdayDate = parseWeekdayInTranscript(transcript);
    const timeMatch = parseTimeInTranscript(transcript);

    // Clean up the title by removing command words and time references
    let cleanTitle = transcript
      .replace(/\b(schedule|appointment|meeting|event|for|at)\b/gi, '')
      .replace(/\b\d{1,2}(:\d{2})?\s*(am|pm)\b/gi, '')
      .replace(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, '')
      .trim();

    if (!cleanTitle || cleanTitle.length < 2) cleanTitle = 'Appointment';

    return {
      text: transcript,
      intent: 'schedule',
      confidence: 0.5,
      extractedData: { title: cleanTitle, date: weekdayDate, time: timeMatch, priority: 'medium' },
      error: 'Using fallback parser (no OpenAI API key)'
    };
  }

  // helpers
  const extractJSON = (text) => {
    if (!text || typeof text !== 'string') return null;
    const start = text.indexOf('{');
    const last = text.lastIndexOf('}');
    if (start === -1 || last === -1 || last <= start) return null;
    const candidate = text.slice(start, last + 1);
    try { return JSON.parse(candidate); } catch (e) {}
    try { return JSON.parse(candidate.replace(/,\s*}/g, '}').replace(/,\s*\]/g, ']')); } catch (e2) { return null; }
  };

  const callChatModelRaw = async (text) => {
    const systemRaw = 'You are a JSON-only parser. Given a user\'s voice transcript, return a single JSON object that matches the schema; If a user specifies with words to "Invite" or "notify" someone of an event, return "attendees" in the form: [ { email: "new@example.com"} ].; {"intent":"task|reminder|note|schedule|findTime|delete|complete|unknown","confidence":0.0-1.0,"extractedData":{...}}. Do not output any text besides the JSON.';
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [{ role: 'system', content: systemRaw }, { role: 'user', content: text }],
      temperature: 0.2,
      max_tokens: 700
    });
    const raw = (completion && completion.choices && completion.choices[0] && (completion.choices[0].message?.content || completion.choices[0].text)) || null;
    let parsed = extractJSON(raw);
    if (!parsed) {
      const retry = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [{ role: 'system', content: systemRaw }, { role: 'user', content: `Return ONLY the JSON object for: ${text}` }],
        temperature: 0.0,
        max_tokens: 700
      });
      const retryRaw = (retry && retry.choices && retry.choices[0] && (retry.choices[0].message?.content || retry.choices[0].text)) || null;
      parsed = extractJSON(retryRaw);
    }
    return parsed;
  };

  try {
    // Decide whether to use the raw ChatGPT JSON-only parser.
    // Priority:
    //  - If env USE_RAW_CHATGPT === '0' -> force OFF
    //  - If env USE_RAW_CHATGPT === '1' -> force ON
    //  - Else if request provided a useRawChatGPT flag, use that
    //  - Otherwise default to RAW mode ON
    const useRaw = (() => {
      if (process.env.USE_RAW_CHATGPT === '0') return false;
      if (process.env.USE_RAW_CHATGPT === '1') return true;
      if (typeof arguments[1] === 'object' && arguments[1] && typeof arguments[1].useRawChatGPT !== 'undefined') {
        return !!arguments[1].useRawChatGPT;
      }
      return true; // default: enable raw ChatGPT parsing
    })();

    console.log(`AI Parser - raw mode = ${useRaw ? 'ENABLED' : 'DISABLED'} (USE_RAW_CHATGPT=${process.env.USE_RAW_CHATGPT || 'unset'})`);
    if (useRaw) {
      const parsedResponse = await callChatModelRaw(transcript);
      if (parsedResponse) return { text: transcript, ...parsedResponse };
      // fall through to richer prompt if raw fails
    }

    // Preprocess and analyze
    const preprocessed = preprocessTranscript(transcript);
    const perTaskAnalysis = analyzeKeywordsPerTask(transcript);
    console.log('AI Parser - Preprocessing results:', { originalText: transcript, highlightedKeywords: preprocessed.highlightedKeywords, context: preprocessed.context, perTaskAnalysis });

    const now = new Date();
    const currentDateTime = now.toISOString();
    const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' });

    const systemPrompt = `You are a voice command parser for a task planning application. Your job is to understand natural language commands and extract structured data.\n\nCurrent date/time (UTC ISO): ${currentDateTime}\nCurrent day (user-local may differ): ${currentDay}\n\nPREPROCESSING HINTS:\n- Highlighted Keywords: ${preprocessed.highlightedKeywords.join(', ') || 'none'}\n- Has Time Reference: ${preprocessed.context.hasTime ? 'YES' : 'NO'}\n- Has Date Reference: ${preprocessed.context.hasDate ? 'YES' : 'NO'}\n- Has Priority: ${preprocessed.context.hasPriority ? 'YES' : 'NO'}\n- Detected Action: ${preprocessed.context.detectedAction || 'none'}\n- Detected Task Type: ${preprocessed.context.detectedTaskType || 'none'}\n\nPER-TASK KEYWORD ANALYSIS:\n${perTaskAnalysis.length > 1 ? perTaskAnalysis.map((task, i) => `Task ${i+1}: "${task.text}" - Keywords: [${task.keywords.join(', ') || 'none'}] - Action: ${task.detectedAction || 'none'} - Type: ${task.detectedTaskType || 'none'}`).join('\n') : 'Single task detected'}\n\nIMPORTANT: When the user mentions a weekday name (like "Saturday", "Sunday", "Monday", etc.), you MUST: 1) Calculate the specific date for that weekday; 2) If it's the current day, use today's date; 3) If it's a future weekday in the current week, use that date; 4) If it's a past weekday in the current week, use the same weekday NEXT week; 5) Always provide the date in YYYY-MM-DD format in the "date" field; 6) If a specific time is mentioned, include it in the "time" field as HH:mm (24-hour format).\n\nBe flexible in interpreting titles — minor filler words are fine. If a user specifies with words to "Invite" or "notify" someone of an event, return "attendees" in the form: [ { email: "new@example.com"} ]. But ALWAYS return a valid JSON object that matches the schema below. DO NOT output any explanatory text unless requested. Return JSON only.`;

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [ { role: 'system', content: systemPrompt }, { role: 'user', content: transcript } ],
      temperature: 0.2,
      response_format: { type: 'json_object' }
    });

    const raw = (completion && completion.choices && completion.choices[0] && (completion.choices[0].message?.content || completion.choices[0].text || completion.choices[0].message)) || completion;
    let parsedResponse = null;
    try {
      if (typeof raw === 'object' && raw !== null && raw.content && typeof raw.content === 'object') parsedResponse = raw.content;
      else {
        const candidate = typeof raw === 'string' ? raw : (raw?.message?.content || raw?.text || JSON.stringify(raw));
        parsedResponse = extractJSON(candidate) || JSON.parse(candidate);
      }
    } catch (e) {
      try {
        const retry = await openai.chat.completions.create({ model: process.env.OPENAI_MODEL || 'gpt-4o-mini', messages: [ { role: 'system', content: systemPrompt }, { role: 'user', content: `The previous response could not be parsed. Please return ONLY the JSON object that matches the required schema with no extra text. Here is the original user message:\n\n${transcript}` } ], temperature: 0.0, max_tokens: 700 });
        const retryRaw = (retry && retry.choices && retry.choices[0] && (retry.choices[0].message?.content || retry.choices[0].text)) || null;
        parsedResponse = extractJSON(retryRaw);
      } catch (e2) {
        // final fallback to local heuristics
        const weekdayDate = parseWeekdayInTranscript(transcript);
        const timeMatch = parseTimeInTranscript(transcript);
        let cleanTitle = transcript.replace(/\b(schedule|appointment|meeting|event|for|at)\b/gi, '').replace(/\b\d{1,2}(:\d{2})?\s*(a\.?m\.?|p\.?m\.?)\b/gi, '').replace(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, '').trim();
        if (!cleanTitle || cleanTitle.length < 2) cleanTitle = 'Appointment';
        return { text: transcript, intent: 'schedule', confidence: 0.5, extractedData: { title: cleanTitle, date: weekdayDate, time: timeMatch, priority: 'medium' }, error: 'AI parsing failed, using enhanced fallback' };
      }
    }

    // If AI didn't parse a date but we can detect a weekday, add it
    if (parsedResponse && !parsedResponse.extractedData) parsedResponse.extractedData = {};
    if (parsedResponse && !parsedResponse.extractedData.date && !parsedResponse.extractedData.dueDate) {
      const weekdayDate = parseWeekdayInTranscript(transcript);
      if (weekdayDate) parsedResponse.extractedData.date = weekdayDate;
    }

    return { text: transcript, ...parsedResponse };

  } catch (error) {
    console.error('OpenAI parsing error:', error);
    // Fallback final
    const weekdayDate = parseWeekdayInTranscript(transcript);
    const timeMatch = parseTimeInTranscript(transcript);
    let cleanTitle = transcript.replace(/\b(schedule|appointment|meeting|event|for|at)\b/gi, '').replace(/\b\d{1,2}(:\d{2})?\s*(a\.?m\.?|p\.?m\.?)\b/gi, '').replace(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, '').trim();
    if (!cleanTitle || cleanTitle.length < 2) cleanTitle = 'Appointment';
    return { text: transcript, intent: 'schedule', confidence: 0.5, extractedData: { title: cleanTitle, date: weekdayDate, time: timeMatch, priority: 'medium' }, error: 'AI parsing failed, using enhanced fallback' };
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

    // Parse each part independently via AI with individual preprocessing
    let parsedCommands = await Promise.all(
      normalizedParts.map(async (part) => {
        // Preprocess each individual part for better AI understanding
        const preprocessed = preprocessTranscript(part);
        console.log(`Multi-command parsing - Part: "${part}"`, {
          highlightedKeywords: preprocessed.highlightedKeywords,
          context: preprocessed.context
        });
        
        return await parseVoiceCommand(part);
      })
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

