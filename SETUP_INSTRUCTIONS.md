# 🚀 Voice Planner Deployment Instructions

Your code is ready! Here's how to deploy it to the cloud.

## 📁 **Step 1: Create GitHub Repository**

### **1.1 Create Repository on GitHub**
1. Go to [github.com](https://github.com)
2. Click "New repository"
3. Name: `voice-planner`
4. Make it **Public** (for free hosting)
5. **Don't** initialize with README (we already have one)
6. Click "Create repository"

### **1.2 Push Your Code**
```bash
# Add GitHub remote (replace YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/voice-planner.git

# Push to GitHub
git branch -M main
git push -u origin main
```

## 🚀 **Step 2: Deploy Frontend (Vercel)**

### **2.1 Deploy to Vercel**
1. Go to [vercel.com](https://vercel.com)
2. Sign in with GitHub
3. Click "New Project"
4. Import your `voice-planner` repository
5. **Important**: Set **Root Directory** to `client`
6. Click "Deploy"

### **2.2 Configure Vercel**
- **Framework Preset**: Vite
- **Root Directory**: `client`
- **Build Command**: `npm run build`
- **Output Directory**: `dist`

## 🚀 **Step 3: Deploy Backend (Railway)**

### **3.1 Deploy to Railway**
1. Go to [railway.app](https://railway.app)
2. Sign in with GitHub
3. Click "New Project"
4. Select "Deploy from GitHub repo"
5. Choose your `voice-planner` repository
6. **Important**: Set **Root Directory** to `server`

### **3.2 Add PostgreSQL Database**
1. In Railway dashboard, click "New" → "Database" → "PostgreSQL"
2. Copy the `DATABASE_URL` from the database service
3. Go to your backend service → "Variables"
4. Add: `DATABASE_URL` = (paste the URL from step 2)

### **3.3 Configure Environment Variables**
Add these in Railway backend service:
```bash
NODE_ENV=production
DATABASE_URL=postgresql://... (from database service)
PORT=3001
```

## 📅 **Step 4: Google Calendar Setup (Optional)**

### **4.1 Google Cloud Console**
1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create new project: "voice-planner"
3. Enable Google Calendar API
4. Create OAuth 2.0 credentials
5. Copy Client ID and Secret

### **4.2 Add Google Calendar Variables to Railway**
```bash
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
GOOGLE_REDIRECT_URI=https://your-railway-app.railway.app/api/calendar/auth-callback
```

## 🔗 **Step 5: Connect Frontend to Backend**

### **5.1 Update Vercel Environment Variables**
1. Go to Vercel dashboard → Your project → Settings → Environment Variables
2. Add:
   - `VITE_API_URL` = `https://your-railway-app.railway.app`
   - `VITE_WEBSOCKET_URL` = `wss://your-railway-app.railway.app`

### **5.2 Redeploy Frontend**
- Vercel will automatically redeploy when you add environment variables

## 📱 **Step 6: Test on iPhone**

### **6.1 Access Your App**
- Open Safari on iPhone
- Go to: `https://your-vercel-app.vercel.app`
- Allow microphone access when prompted

### **6.2 Test Voice Commands**
- Say: "Add meeting with Alex tomorrow at 3pm"
- Click "Sync to Calendar" (if Google Calendar is set up)
- Check your iPhone Calendar app!

## 🎯 **Your Live URLs**

After deployment, you'll have:
- **Frontend**: `https://voice-planner-xxx.vercel.app`
- **Backend**: `https://voice-planner-xxx.railway.app`
- **iPhone Access**: Works from anywhere! 📱

## 🔧 **Troubleshooting**

### **Common Issues:**
1. **Build fails**: Check Node.js version (should be 16+)
2. **Database connection**: Verify DATABASE_URL in Railway
3. **CORS errors**: Check environment variables in Vercel
4. **Voice not working**: Ensure HTTPS (production has this)

### **Quick Fixes:**
```bash
# Check Railway logs
railway logs

# Check Vercel deployment
vercel logs

# Test API
curl https://your-railway-app.railway.app/api/tasks
```

## 🎉 **You're Done!**

Your voice-driven productivity app is now live and accessible from your iPhone from anywhere with internet! 

**Features working:**
- ✅ Voice commands
- ✅ Task management
- ✅ Real-time updates
- ✅ Mobile optimized
- ✅ Google Calendar sync (if configured)

Enjoy your new productivity app! 🚀📱
