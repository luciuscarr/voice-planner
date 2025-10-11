# 🚀 Deployment Guide

Deploy your Voice Planner app to the cloud for free!

## 🌐 **Option 1: Vercel + Railway (Recommended)**

### **Frontend (Vercel)**
1. **Push to GitHub:**
   ```bash
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

2. **Deploy to Vercel:**
   - Go to [vercel.com](https://vercel.com)
   - Sign in with GitHub
   - Click "New Project"
   - Import your repository
   - Set **Root Directory** to `client`
   - Click "Deploy"

3. **Environment Variables in Vercel:**
   - Go to Project Settings → Environment Variables
   - Add: `VITE_API_URL` = `https://your-railway-app.railway.app`
   - Add: `VITE_WEBSOCKET_URL` = `wss://your-railway-app.railway.app`

### **Backend (Railway)**
1. **Deploy to Railway:**
   - Go to [railway.app](https://railway.app)
   - Sign in with GitHub
   - Click "New Project" → "Deploy from GitHub repo"
   - Select your repository
   - Set **Root Directory** to `server`

2. **Add PostgreSQL Database:**
   - In Railway dashboard, click "New" → "Database" → "PostgreSQL"
   - Copy the `DATABASE_URL` from the database service

3. **Environment Variables:**
   - Add `DATABASE_URL` from the PostgreSQL service
   - Add `NODE_ENV=production`

## 🌐 **Option 2: Netlify + Railway**

### **Frontend (Netlify)**
1. **Build the project:**
   ```bash
   cd client
   npm run build
   ```

2. **Deploy to Netlify:**
   - Go to [netlify.com](https://netlify.com)
   - Drag and drop the `client/dist` folder
   - Or connect your GitHub repo

3. **Configure redirects:**
   Create `client/public/_redirects`:
   ```
   /api/* https://your-railway-app.railway.app/api/:splat 200
   ```

### **Backend (Railway)**
Same as Option 1 backend steps.

## 🌐 **Option 3: GitHub Pages + Railway**

### **Frontend (GitHub Pages)**
1. **Enable GitHub Pages:**
   - Go to repository Settings → Pages
   - Source: Deploy from a branch
   - Branch: `gh-pages`

2. **Create deployment script:**
   ```bash
   npm run build
   cd client/dist
   git init
   git add .
   git commit -m "Deploy to GitHub Pages"
   git push -f origin main:gh-pages
   ```

### **Backend (Railway)**
Same as Option 1 backend steps.

## 🔧 **Production Configuration**

### **Update CORS for Production:**
```javascript
// In server/app.js
const allowedOrigins = [
  'https://your-vercel-app.vercel.app',
  'https://your-netlify-app.netlify.app',
  'https://your-username.github.io'
];
```

### **Environment Variables:**
```bash
# Production
NODE_ENV=production
DATABASE_URL=postgresql://...
PORT=3001
```

## 📱 **Access from Anywhere**

Once deployed:
- **Frontend**: `https://your-app.vercel.app`
- **Backend**: `https://your-app.railway.app`
- **Works on**: iPhone, Android, Desktop, anywhere with internet!

## 🆓 **Free Tier Limits**

### **Vercel:**
- 100GB bandwidth/month
- Unlimited static sites
- Serverless functions

### **Railway:**
- $5 credit/month (usually enough for small apps)
- PostgreSQL database included
- Automatic deployments

### **Netlify:**
- 100GB bandwidth/month
- 300 build minutes/month
- Form handling

## 🚀 **Quick Deploy Commands**

```bash
# 1. Install Vercel CLI
npm i -g vercel

# 2. Deploy frontend
cd client
vercel --prod

# 3. Deploy backend to Railway
# (Use Railway dashboard or CLI)
```

## 🔍 **Troubleshooting**

### **Common Issues:**
1. **CORS errors**: Update allowed origins
2. **Database connection**: Check DATABASE_URL
3. **Build failures**: Check Node.js version
4. **WebSocket issues**: Ensure HTTPS

### **Debug Commands:**
```bash
# Check Railway logs
railway logs

# Check Vercel deployment
vercel logs

# Test API endpoints
curl https://your-app.railway.app/api/tasks
```

## 🎯 **Recommended Setup**

For the easiest deployment:
1. **Use Vercel for frontend** (best React support)
2. **Use Railway for backend** (includes free PostgreSQL)
3. **Total cost**: $0/month
4. **Access**: Anywhere with internet!

Your app will be live at:
- **Frontend**: `https://voice-planner.vercel.app`
- **Backend**: `https://voice-planner-api.railway.app`

Perfect for iPhone access from anywhere! 📱✨
