#!/bin/bash

echo "Voice Planner Deployment Script"
echo "=================================="

# Check if git is initialized
if [ ! -d ".git" ]; then
    echo "Initializing Git repository..."
    git init
    git add .
    git commit -m "Initial commit: Voice Planner app"
fi

# Check if user is logged into Vercel
if ! vercel whoami > /dev/null 2>&1; then
    echo "Please login to Vercel:"
    vercel login
fi

# Check if user is logged into Railway
if ! railway whoami > /dev/null 2>&1; then
    echo "Please login to Railway:"
    railway login
fi

echo "Installing dependencies..."
npm run install:all

echo "Building frontend..."
cd client
npm run build
cd ..

echo "Deploying to Vercel (Frontend)..."
cd client
vercel --prod
cd ..

echo "Deploying to Railway (Backend)..."
cd server
railway up
cd ..

echo "Deployment complete!"
echo ""
echo "App is now live at:"
echo "   Frontend: https://your-app.vercel.app"
echo "   Backend: https://your-app.railway.app"
echo ""
echo "Next steps:"
echo "   1. Set up Google Calendar integration (see GOOGLE_CALENDAR_SETUP.md)"
echo "   2. Add environment variables in Railway dashboard"
echo "   3. Test voice commands on your iPhone!"
echo ""
echo "Enjoy!"
