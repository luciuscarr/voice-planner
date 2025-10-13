const express = require('express');
const router = express.Router();
const { parseVoiceCommand, parseMultipleCommands } = require('../services/aiParser');

/**
 * POST /api/ai/parse
 * Parse a voice transcript using AI
 * Body: { transcript: string, multipleCommands?: boolean }
 */
router.post('/parse', async (req, res) => {
  try {
    const { transcript, multipleCommands = true, timeZone, offsetMinutes } = req.body;
    
    if (!transcript || typeof transcript !== 'string') {
      return res.status(400).json({ 
        error: 'Invalid request',
        message: 'Transcript is required and must be a string' 
      });
    }

    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({
        error: 'Service not configured',
        message: 'OpenAI API key is not configured. Please set OPENAI_API_KEY environment variable.'
      });
    }

    // Attach client timezone context to transcript for better weekday resolution
    const tzHint = timeZone ? ` [UserTimeZone:${timeZone}]` : offsetMinutes !== undefined ? ` [UserOffsetMinutes:${offsetMinutes}]` : '';

    let result;
    if (multipleCommands) {
      result = await parseMultipleCommands(`${transcript}${tzHint}`);
    } else {
      result = await parseVoiceCommand(`${transcript}${tzHint}`);
    }
    
    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error in AI parse endpoint:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

/**
 * GET /api/ai/status
 * Check if AI parsing service is available
 */
router.get('/status', (req, res) => {
  const isConfigured = !!process.env.OPENAI_API_KEY;
  
  res.json({
    available: isConfigured,
    model: 'gpt-4o-mini',
    status: isConfigured ? 'ready' : 'not_configured',
    message: isConfigured 
      ? 'AI parsing service is ready' 
      : 'OpenAI API key not configured'
  });
});

module.exports = router;

