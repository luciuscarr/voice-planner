# Voice Planner

A voice-driven productivity app that lets you record short voice commands, transcribes them to text, detects intent, and adds them to a smart to-do list in real time.

## Features

- 🎤 **Voice Input**: Use Web Speech API to record and transcribe voice commands
- 🤖 **AI-Powered Parsing**: OpenAI GPT-4o-mini for accurate natural language understanding
- 🧠 **Intent Recognition**: Automatically detects task, reminder, note, and schedule intents
- ⚡ **Real-time Updates**: Live task synchronization across clients using WebSocket
- 📱 **Modern UI**: Clean, responsive interface with smooth animations
- 💾 **Persistent Storage**: SQLite database for local data storage
- 🔍 **Smart Filtering**: Search and filter tasks by status, priority, and keywords
- 📅 **Calendar Sync**: Google Calendar and iPhone Calendar integration

## Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development
- **Tailwind CSS** for styling
- **Framer Motion** for animations
- **Lucide React** for icons
- **Web Speech API** for voice recognition

### Backend
- **Node.js** with Express
- **Socket.io** for WebSocket communication
- **SQLite/PostgreSQL** for database
- **OpenAI API** for AI-powered intent parsing
- **CORS** enabled for cross-origin requests

## Quick Start

### Prerequisites
- Node.js 16+ 
- npm or yarn

### Installation

1. **Clone and install dependencies:**
   ```bash
   git clone <repository-url>
   cd voice-planner
   npm run install:all
   ```

2. **Set up environment variables:**
   ```bash
   cp env.example .env
   ```
   Edit `.env` and add your OpenAI API key for AI-powered parsing:
   ```env
   OPENAI_API_KEY=sk-your-api-key-here
   ```
   Get your API key from [OpenAI Platform](https://platform.openai.com/api-keys)
   
   See [AI_SETUP.md](./AI_SETUP.md) for detailed AI setup instructions.

3. **Initialize the database:**
   ```bash
   cd server
   npm run init-db
   ```
   
   Or simply start the server - it will initialize the database automatically:
   ```bash
   cd server
   npm run dev
   ```

4. **Start development servers:**
   ```bash
   # From project root
   npm run dev
   ```
   
   This will start both the frontend (port 3000) and backend (port 3001) servers.

### Alternative: Run servers separately

```bash
# Terminal 1 - Frontend
cd client
npm run dev

# Terminal 2 - Backend  
cd server
npm run dev
```

## Usage

### Voice Commands

The app uses **AI-powered natural language understanding** to parse your voice commands with high accuracy. Try these examples:

- **"Add meeting with Alex tomorrow at 3pm"** - Creates a scheduled task
- **"Remind me to call the dentist"** - Creates a reminder  
- **"Note: Project deadline is Friday"** - Creates a high-priority note
- **"Schedule team standup for next Monday"** - Creates a scheduled task
- **"Buy milk and walk the dog tomorrow"** - Creates two separate tasks

The AI understands natural variations like:
- "Don't forget to..." / "I need to..." / "Make sure I..."
- "Next Tuesday at 3" / "3pm next Tuesday" / "Tuesday 3 o'clock"
- "Urgent meeting" / "Low priority task" / "When you have time"

### Supported Intents

- **Task**: "Add", "create", "new", "make", "do"
- **Reminder**: "Remind", "alert", "notify" 
- **Note**: "Note", "write", "record", "remember"
- **Schedule**: "Schedule", "meeting", "appointment", "book"

### Priority Detection

- **High**: "urgent", "important", "asap", "critical"
- **Medium**: "normal", "regular", "standard" (default)
- **Low**: "low", "minor", "whenever", "sometime"

### Time References

- **Today**: "today", "this morning", "this afternoon", "tonight"
- **Tomorrow**: "tomorrow", "next day"
- **This week**: "this week", "weekend", "saturday", "sunday"
- **Next week**: "next week", "following week"
- **Specific time**: "at 3pm", "@ 2:30", "at 9:30am"
- **Relative time**: "in 2 hours", "after 3 days", "in 1 week"

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions to Vercel + Railway.

## API Endpoints

### Tasks
- `GET /api/tasks` - Get all tasks (supports query params: completed, priority, search)
- `GET /api/tasks/:id` - Get task by ID
- `POST /api/tasks` - Create new task
- `PUT /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task
- `PATCH /api/tasks/:id/toggle` - Toggle task completion

### AI Parsing
- `POST /api/ai/parse` - Parse voice transcript using AI
- `GET /api/ai/status` - Check AI service availability

### WebSocket Events
- `voice_command` - Send voice command for processing
- `task_created` - Broadcast new task to all clients
- `task_updated` - Broadcast task updates
- `task_deleted` - Broadcast task deletion

## Project Structure

```
voice-planner/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── hooks/         # Custom hooks
│   │   ├── utils/         # Utility functions (includes AI parser)
│   │   └── App.tsx        # Main app component
│   └── package.json
├── server/                # Express backend
│   ├── routes/            # API routes
│   ├── services/          # Business logic (AI parser)
│   ├── db/               # Database files
│   └── app.js            # Server entry point
├── shared/               # Shared types
├── AI_SETUP.md           # AI configuration guide
└── README.md
```

## Development

### Adding New Features

1. **Frontend**: Add components in `client/src/components/`
2. **Backend**: Add routes in `server/routes/`
3. **Types**: Update shared types in `shared/types.ts`

### Database Schema

```sql
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  completed INTEGER DEFAULT 0,
  priority TEXT DEFAULT 'medium',
  dueDate TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
```

## Browser Compatibility

- **Chrome/Edge**: Full Web Speech API support
- **Firefox**: Limited support (may require polyfill)
- **Safari**: Limited support
- **Mobile**: iOS Safari, Android Chrome

## Troubleshooting

### Voice Recognition Not Working
- Ensure you're using HTTPS or localhost
- Check browser permissions for microphone access
- Try refreshing the page and allowing microphone access

### Database Issues
- Delete `server/db/voice_planner.db` and run `npm run init-db`
- Check file permissions in the `server/db/` directory

### WebSocket Connection Issues
- Verify both servers are running on correct ports
- Check firewall settings
- Ensure CORS is properly configured

## Security

🔒 API keys and secrets are protected via `.gitignore`. See [SECURITY.md](./SECURITY.md) for:
- How to keep your OpenAI API key safe
- What to do if you accidentally expose a key  
- Production deployment security best practices
- Security checklist before publishing

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. **Never commit `.env` files** (see SECURITY.md)
6. Submit a pull request

## License

MIT License - see LICENSE file for details