# AI-Powered Voice Command Parsing Setup

Your Voice Planner app now uses **OpenAI's GPT-4o-mini** for intelligent voice command parsing! This provides much better accuracy than the previous regex-based approach.

## Why AI Parsing?

The AI parser can understand:
- ✅ Natural language variations ("remind me to...", "don't forget to...", "I need to...")
- ✅ Complex time expressions ("next Tuesday at 3pm", "in 2 hours", "tomorrow morning")
- ✅ Multiple tasks in one command ("add buy milk and walk the dog")
- ✅ Context and intent even with imperfect speech recognition
- ✅ Priority levels from tone ("urgent meeting", "when you have time")

## Setup Instructions

### 1. Get an OpenAI API Key

1. Go to [OpenAI Platform](https://platform.openai.com/api-keys)
2. Sign up or log in to your account
3. Click "Create new secret key"
4. Copy the API key (it starts with `sk-`)

**Cost:** GPT-4o-mini is very affordable (~$0.15 per 1M input tokens). For typical usage:
- ~100 voice commands per day ≈ $0.01-0.02 per day
- ~3000 voice commands per month ≈ $0.30-0.60 per month

### 2. Configure Environment Variables

#### For Local Development:

1. Create a `.env` file in the root directory (copy from `env.example`):
   ```bash
   cp env.example .env
   ```

2. Edit the `.env` file and add your OpenAI API key:
   ```env
   OPENAI_API_KEY=sk-your-actual-api-key-here
   ```

3. Create a `.env` file in the `client` directory:
   ```bash
   cp client/.env.example client/.env
   ```

4. Make sure the client `.env` has:
   ```env
   VITE_API_URL=http://localhost:3001
   VITE_WEBSOCKET_URL=ws://localhost:3001
   ```

#### For Production (Railway/Render):

Add the environment variable in your hosting platform's dashboard:
- **Variable name:** `OPENAI_API_KEY`
- **Value:** Your OpenAI API key

### 3. Install Dependencies

Install the OpenAI package on the server:

```bash
cd server
npm install
```

This will install the `openai` package which is now in `package.json`.

### 4. Restart Your Server

```bash
# In the server directory
npm run dev
```

Or if using the full app:
```bash
# From root directory
npm run dev
```

### 5. Verify AI is Working

1. Start your app
2. Look for the **"AI Powered"** green badge on the voice recorder
3. Try a command like: "Add buy groceries tomorrow at 3pm"
4. The AI should accurately extract:
   - Intent: task
   - Title: "buy groceries"
   - Due date: Tomorrow at 3:00 PM
   - Priority: medium

## Fallback Behavior

If the AI service is unavailable (no API key or API error), the app automatically falls back to the original regex-based parser. You'll see a warning in the console, but the app will still work with reduced accuracy.

## Troubleshooting

### "AI Powered" badge not showing?

1. Check server console for errors
2. Verify API key is set: `echo $OPENAI_API_KEY` (Linux/Mac) or `echo %OPENAI_API_KEY%` (Windows)
3. Check the AI status endpoint: `http://localhost:3001/api/ai/status`

### API errors?

- **Invalid API key:** Double-check your key from OpenAI dashboard
- **Rate limit:** You may have exceeded free tier limits
- **Network issues:** Check your internet connection

### High costs?

- GPT-4o-mini is already very cost-effective
- Monitor usage at [OpenAI Usage Dashboard](https://platform.openai.com/usage)
- Set usage limits in OpenAI account settings

## API Endpoints

### Parse Command
```
POST /api/ai/parse
Body: { "transcript": "add meeting tomorrow at 2pm" }
```

### Check Status
```
GET /api/ai/status
Returns: { "available": true, "model": "gpt-4o-mini" }
```

## Files Modified

- `server/services/aiParser.js` - AI parsing service using OpenAI
- `server/routes/ai.js` - API endpoints for AI parsing
- `server/services/aiParser.js` - Server-side AI parser with OpenAI integration
- `client/src/components/VoiceRecorder.tsx` - Updated to use AI parsing
- `server/package.json` - Added OpenAI dependency

## Security Notes

🔒 **Your API key is safe!** The `.env` file is already in `.gitignore` and will NOT be committed to GitHub.

See [SECURITY.md](./SECURITY.md) for complete security best practices.

**Important:**
- Never commit `.env` files
- Use platform dashboards for production secrets (Railway/Vercel)
- Set spending limits on your OpenAI account
- Rotate keys if ever exposed

## Next Steps

1. Test with various commands to see the improved accuracy
2. Check the console to see the structured data extracted by AI
3. Enjoy much better voice command understanding! 🎉

