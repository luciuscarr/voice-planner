import { VoiceCommand } from '@shared/types';

// Get API URL from environment variables
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Parse voice transcript using AI (OpenAI GPT)
 * This provides much better accuracy than regex-based parsing
 */
export async function parseIntentAI(transcript: string): Promise<VoiceCommand | VoiceCommand[]> {
  try {
    const response = await fetch(`${API_URL}/api/ai/parse`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transcript,
        multipleCommands: true
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to parse command');
    }

    const result = await response.json();
    
    // The API returns { success: true, data: VoiceCommand[] | VoiceCommand }
    if (result.success && result.data) {
      return result.data;
    }
    
    throw new Error('Invalid response from AI parser');
    
  } catch (error) {
    console.error('AI parsing error:', error);
    
    // Fallback to basic parsing
    console.warn('Falling back to basic parsing');
    return fallbackParse(transcript);
  }
}

/**
 * Check if AI parsing service is available
 */
export async function checkAIStatus(): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/api/ai/status`);
    const result = await response.json();
    return result.available;
  } catch (error) {
    console.error('Error checking AI status:', error);
    return false;
  }
}

/**
 * Fallback parser when AI is not available
 * Uses simple keyword matching (less accurate)
 */
function fallbackParse(transcript: string): VoiceCommand {
  const lowerTranscript = transcript.toLowerCase();
  
  let intent: VoiceCommand['intent'] = 'unknown';
  
  // Simple intent detection
  if (lowerTranscript.includes('add') || lowerTranscript.includes('create') || lowerTranscript.includes('new')) {
    intent = 'task';
  } else if (lowerTranscript.includes('remind') || lowerTranscript.includes('reminder')) {
    intent = 'reminder';
  } else if (lowerTranscript.includes('schedule') || lowerTranscript.includes('meeting')) {
    intent = 'schedule';
  } else if (lowerTranscript.includes('note') || lowerTranscript.includes('write down')) {
    intent = 'note';
  }
  
  return {
    text: transcript,
    intent,
    confidence: 0.5,
    extractedData: {
      title: transcript,
      priority: 'medium'
    }
  };
}

