@echo off
echo 🚀 Voice Planner Deployment Script
echo ==================================

REM Check if git is initialized
if not exist ".git" (
    echo Initializing Git repository...
    git init
    git add .
    git commit -m "Initial commit: Voice Planner app"
)

echo Installing dependencies...
call npm run install:all

echo Building frontend...
cd client
call npm run build
cd ..

echo Deploying to Vercel (Frontend)...
cd client
call vercel --prod
cd ..

echo Deploying to Railway (Backend)...
cd server
call railway up
cd ..

echo Deployment complete!
echo.
echo App is now live at:
echo    Frontend: https://your-app.vercel.app
echo    Backend: https://your-app.railway.app
echo.
echo Next steps:
echo    1. Set up Google Calendar integration (see GOOGLE_CALENDAR_SETUP.md)
echo    2. Add environment variables in Railway dashboard
echo    3. Test voice commands on your iPhone!
echo.
echo Enjoy!
pause
