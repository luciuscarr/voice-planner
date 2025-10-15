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

    // Build calendar event resource from task
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

    // Add Google Calendar reminders if present
    if (Array.isArray(task.reminders) && task.reminders.length > 0) {
      event.reminders = {
        useDefault: false,
        overrides: task.reminders
          .filter((m) => Number.isFinite(m) && m >= 0)
          .map((m) => ({ method: 'popup', minutes: m }))
      };
    }

    let response;
    if (task.calendarEventId) {
      // Update existing event (e.g., to change reminders)
      response = await calendar.events.patch({
        calendarId: 'primary',
        eventId: task.calendarEventId,
        resource: event,
      });
    } else {
      // Create new event
      response = await calendar.events.insert({
        calendarId: 'primary',
        resource: event,
      });
    }

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

    // Get all calendars for the user and filter to those the user OWNS
    const listResp = await calendar.calendarList.list();
    const calendars = (listResp.data.items || [])
      .filter((c) => c && (c.accessRole === 'owner'))
      .map((c) => c.id)
      .filter(Boolean);

    // If no owned calendars returned for some reason, fallback to primary
    const targetCalendarIds = calendars.length > 0 ? calendars : ['primary'];

    // Determine import window: start of today through end of day + 3 days (hard-capped server-side)
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfRange = new Date(startOfToday);
    endOfRange.setDate(endOfRange.getDate() + 3);
    endOfRange.setHours(23, 59, 59, 999);

    // If client provided bounds, use them but cap to our enforced window
    const clientMin = timeMin ? new Date(String(timeMin)) : null;
    const clientMax = timeMax ? new Date(String(timeMax)) : null;
    const from = clientMin && !isNaN(clientMin.getTime()) && clientMin > startOfToday ? clientMin.toISOString() : startOfToday.toISOString();
    const to = clientMax && !isNaN(clientMax.getTime()) && clientMax < endOfRange ? clientMax.toISOString() : endOfRange.toISOString();

    // Fetch events from all calendars in parallel
    const results = await Promise.all(
      targetCalendarIds.map((calId) =>
        calendar.events.list({
          calendarId: calId,
          timeMin: from,
          timeMax: to,
          singleEvents: true,
          orderBy: 'startTime',
        }).then((r) => ({ calId, items: r.data.items || [] }))
      )
    );

    // Flatten and map to task-like objects; prefix ids with calendarId to avoid collisions
    const allEvents = results.flatMap((r) => r.items.map((e) => ({ ...e, _calendarId: r.calId })));
    const tasks = allEvents.map((e) => ({
      id: `${e._calendarId}:${e.id}`,
      title: e.summary || 'Untitled event',
      description: e.description,
      completed: false,
      priority: 'medium',
      dueDate: e.start?.dateTime || e.start?.date || undefined,
      calendarEventId: e.id,
      createdAt: e.created || new Date().toISOString(),
      updatedAt: e.updated || new Date().toISOString(),
    }));

    res.json({ events: allEvents, tasks });
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
