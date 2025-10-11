# 📅 Google Calendar Integration Setup

Set up Google Calendar sync for your Voice Planner app!

## 🔧 **Step 1: Google Cloud Console Setup**

### **1.1 Create Google Cloud Project**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Name: `voice-planner-calendar`
4. Click "Create"

### **1.2 Enable Google Calendar API**
1. In the Google Cloud Console, go to "APIs & Services" → "Library"
2. Search for "Google Calendar API"
3. Click on it and press "Enable"

### **1.3 Create OAuth 2.0 Credentials**
1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth 2.0 Client IDs"
3. Application type: "Web application"
4. Name: `Voice Planner Calendar`
5. **Authorized redirect URIs:**
   - `http://localhost:3001/api/calendar/auth-callback` (development)
   - `https://your-railway-app.railway.app/api/calendar/auth-callback` (production)
6. Click "Create"
7. **Copy the Client ID and Client Secret!**

## 🔧 **Step 2: Environment Variables**

### **Development (.env)**
```bash
# Google Calendar OAuth
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:3001/api/calendar/auth-callback
```

### **Production (Railway)**
Add these environment variables in Railway dashboard:
```bash
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
GOOGLE_REDIRECT_URI=https://your-railway-app.railway.app/api/calendar/auth-callback
```

## 🚀 **Step 3: Deploy with Calendar Integration**

### **3.1 Update Railway Environment**
1. Go to your Railway project dashboard
2. Click on your backend service
3. Go to "Variables" tab
4. Add the Google Calendar environment variables

### **3.2 Update Vercel Environment**
1. Go to your Vercel project dashboard
2. Go to "Settings" → "Environment Variables"
3. Add:
   - `VITE_API_URL` = `https://your-railway-app.railway.app`
   - `VITE_WEBSOCKET_URL` = `wss://your-railway-app.railway.app`

## 📱 **Step 4: iPhone Calendar Sync**

### **4.1 Google Calendar App**
- Install Google Calendar app on iPhone
- Sign in with the same Google account
- Events will automatically sync!

### **4.2 iPhone Calendar App**
- Go to iPhone Settings → Calendar → Accounts
- Add Google account
- Enable Calendar sync
- Events will appear in iPhone Calendar app

## 🎯 **How It Works**

### **Voice Command → Calendar Event**
1. **Say**: "Add meeting with Alex tomorrow at 3pm"
2. **App creates**: Task with due date
3. **User clicks**: "Sync to Calendar" button
4. **App creates**: Google Calendar event
5. **Result**: Event appears in Google Calendar and iPhone Calendar!

### **Calendar Integration Features**
- ✅ **One-click sync** to Google Calendar
- ✅ **Automatic date/time** parsing from voice commands
- ✅ **Priority colors** (red for high, yellow for medium, green for low)
- ✅ **Real-time updates** when tasks change
- ✅ **iPhone Calendar sync** through Google account

## 🔧 **API Endpoints**

### **Calendar Routes**
- `GET /api/calendar/auth-url` - Get Google OAuth URL
- `POST /api/calendar/auth-callback` - Handle OAuth callback
- `POST /api/calendar/sync-task` - Sync task to calendar
- `GET /api/calendar/events` - Get calendar events
- `DELETE /api/calendar/events/:eventId` - Delete calendar event

## 🎤 **Voice Commands That Create Calendar Events**

### **Time-based Commands**
- "Add meeting with Alex tomorrow at 3pm"
- "Schedule team standup for next Monday"
- "Remind me to call dentist at 2pm today"
- "Book doctor appointment for Friday morning"

### **Priority Commands**
- "Urgent: Client call at 4pm today"
- "Important: Board meeting tomorrow"
- "Low priority: Team lunch next week"

## 🔍 **Troubleshooting**

### **Common Issues**
1. **OAuth not working**: Check redirect URI matches exactly
2. **Calendar not syncing**: Verify Google Calendar API is enabled
3. **iPhone not showing events**: Check Google account is added to iPhone Calendar
4. **Permission denied**: User needs to grant calendar access

### **Debug Commands**
```bash
# Check Google Calendar API
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "https://www.googleapis.com/calendar/v3/calendars/primary/events"

# Test OAuth flow
curl -X GET "https://your-app.railway.app/api/calendar/auth-url"
```

## 🎯 **Production Checklist**

- [ ] Google Cloud project created
- [ ] Google Calendar API enabled
- [ ] OAuth credentials created
- [ ] Environment variables set in Railway
- [ ] Redirect URIs configured for production
- [ ] Frontend deployed to Vercel
- [ ] Backend deployed to Railway
- [ ] Test calendar sync on iPhone

## 🚀 **Quick Test**

1. **Deploy your app** (Vercel + Railway)
2. **Open on iPhone** Safari
3. **Say**: "Add meeting with John tomorrow at 2pm"
4. **Click**: "Sync to Calendar" button
5. **Check**: Google Calendar app on iPhone
6. **Result**: Event appears in both Google Calendar and iPhone Calendar! 🎉

Your voice planner now syncs with Google Calendar and iPhone Calendar! 📱✨
