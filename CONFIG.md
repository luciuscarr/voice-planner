# Configuration

## Your Render Backend URL

Replace `REPLACE_WITH_YOUR_RENDER_URL` in `vercel.json` with your actual Render URL.

### How to find your Render URL:

1. Go to [render.com/dashboard](https://render.com/dashboard)
2. Click on your `voice-planner-api` service
3. At the top, you'll see your URL (looks like: `https://voice-planner-api-xxxx.onrender.com`)
4. Copy that URL

### What to update:

In `vercel.json`, line 8 and 9, replace:
```
"VITE_API_URL": "https://YOUR-ACTUAL-RENDER-URL.onrender.com",
"VITE_WEBSOCKET_URL": "wss://YOUR-ACTUAL-RENDER-URL.onrender.com"
```

With your actual URL!

Example:
```
"VITE_API_URL": "https://voice-planner-api-abc123.onrender.com",
"VITE_WEBSOCKET_URL": "wss://voice-planner-api-abc123.onrender.com"
```
