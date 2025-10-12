const express = require('express');
const { google } = require('googleapis');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// Google Calendar OAuth2 configuration
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI || 'https://voice-planner.onrender.com/api/calendar/auth-callback'
);

// Google Calendar API instance
let calendar;

// Initialize Google Calendar API
const initCalendar = () => {
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    return true;
  }
  return false;
};

// Get Google Calendar authorization URL
router.get('/auth-url', (req, res) => {
  try {
    // Check if credentials are configured
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      return res.status(500).json({ error: 'Google Calendar credentials not configured' });
    }

    // Reinitialize oauth2Client with current env vars
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'https://voice-planner.onrender.com/api/calendar/auth-callback';
    const oauth2 = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      redirectUri
    );

    const authUrl = oauth2.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/calendar'],
      prompt: 'consent'
    });

    console.log('Generated auth URL with redirect:', redirectUri);
    res.json({ authUrl });
  } catch (error) {
    console.error('Error generating auth URL:', error);
    res.status(500).json({ error: error.message });
  }
});

// Handle Google Calendar OAuth callback
router.get('/auth-callback', async (req, res) => {
  try {
    const { code } = req.query;
    
    if (!code) {
      return res.status(400).json({ error: 'Authorization code required' });
    }

    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'https://voice-planner.onrender.com/api/calendar/auth-callback';
    const oauth2 = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      redirectUri
    );

    const { tokens } = await oauth2.getToken(code);
    
    // Send HTML that closes popup and sends token to parent window
    res.send(`
      <html>
        <script>
          window.opener.postMessage({ 
            type: 'google-calendar-auth', 
            success: true,
            accessToken: '${tokens.access_token}'
          }, '*');
          window.close();
        </script>
        <body>
          <h2>Authorization successful! You can close this window.</h2>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Google Calendar auth error:', error);
    res.status(500).json({ error: 'Failed to authenticate with Google Calendar' });
  }
});

// Sync task to Google Calendar
router.post('/sync-task', async (req, res) => {
  try {
    const { task, accessToken } = req.body;
    
    if (!accessToken) {
      return res.status(400).json({ error: 'Access token required' });
    }

    oauth2Client.setCredentials({ access_token: accessToken });
    
    if (!calendar) {
      initCalendar();
    }

    // Create calendar event from task
    const event = {
      summary: task.title,
      description: task.description || '',
      start: {
        dateTime: task.dueDate ? new Date(task.dueDate).toISOString() : new Date().toISOString(),
        timeZone: 'UTC',
      },
      end: {
        dateTime: task.dueDate ? new Date(new Date(task.dueDate).getTime() + 60 * 60 * 1000).toISOString() : new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        timeZone: 'UTC',
      },
      colorId: task.priority === 'high' ? '11' : task.priority === 'medium' ? '5' : '10', // Red, Yellow, Green
    };

    const response = await calendar.events.insert({
      calendarId: 'primary',
      resource: event,
    });

    res.json({
      success: true,
      eventId: response.data.id,
      event: response.data
    });
  } catch (error) {
    console.error('Google Calendar sync error:', error);
    res.status(500).json({ error: 'Failed to sync task to Google Calendar' });
  }
});

// Get Google Calendar events
router.get('/events', async (req, res) => {
  try {
    const { accessToken, timeMin, timeMax } = req.query;
    
    if (!accessToken) {
      return res.status(400).json({ error: 'Access token required' });
    }

    oauth2Client.setCredentials({ access_token: accessToken });
    
    if (!calendar) {
      initCalendar();
    }

    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: timeMin || new Date().toISOString(),
      timeMax: timeMax || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    });

    res.json({
      events: response.data.items || []
    });
  } catch (error) {
    console.error('Google Calendar fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch Google Calendar events' });
  }
});

// Delete event from Google Calendar
router.delete('/events/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;
    const { accessToken } = req.query;
    
    if (!accessToken) {
      return res.status(400).json({ error: 'Access token required' });
    }

    oauth2Client.setCredentials({ access_token: accessToken });
    
    if (!calendar) {
      initCalendar();
    }

    await calendar.events.delete({
      calendarId: 'primary',
      eventId: eventId,
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Google Calendar delete error:', error);
    res.status(500).json({ error: 'Failed to delete Google Calendar event' });
  }
});

module.exports = router;
