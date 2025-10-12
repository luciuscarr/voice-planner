const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const taskRoutes = require('./routes/tasks');
const calendarRoutes = require('./routes/calendar');

// Use production database if DATABASE_URL is set, otherwise use SQLite
const { initDatabase } = process.env.DATABASE_URL 
  ? require('./db/production') 
  : require('./db/init');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      /^https:\/\/.*\.vercel\.app$/, // All Vercel deployments
      "http://192.168.1.100:3000",
      "http://192.168.0.100:3000",
    ],
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://voice-planner-client-hchjysqsd-lu-ius-projects.vercel.app", // Your Vercel preview URL
    /^https:\/\/.*\.vercel\.app$/, // All Vercel deployments
    // Add your computer's IP address here
    "http://192.168.1.100:3000",
    "http://192.168.0.100:3000",
  ],
  credentials: true
}));
app.use(express.json());

// Routes
app.use('/api/tasks', taskRoutes);
app.use('/api/calendar', calendarRoutes);

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Handle voice command processing
  socket.on('voice_command', async (command) => {
    try {
      console.log('Received voice command:', command);
      
      // Broadcast the command to all connected clients
      socket.broadcast.emit('voice_command_received', command);
      
      // Process the command (this would integrate with your intent parsing)
      const processedCommand = {
        ...command,
        processedAt: new Date().toISOString(),
        status: 'processed'
      };
      
      socket.emit('voice_command_processed', processedCommand);
    } catch (error) {
      console.error('Error processing voice command:', error);
      socket.emit('voice_command_error', { error: error.message });
    }
  });

  // Handle task updates
  socket.on('task_updated', (task) => {
    console.log('Task updated:', task);
    socket.broadcast.emit('task_updated', task);
  });

  // Handle task creation
  socket.on('task_created', (task) => {
    console.log('Task created:', task);
    socket.broadcast.emit('task_created', task);
  });

  // Handle task deletion
  socket.on('task_deleted', (taskId) => {
    console.log('Task deleted:', taskId);
    socket.broadcast.emit('task_deleted', taskId);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Health check and root route
app.get('/', (req, res) => {
  res.json({ 
    message: 'Voice Planner API Server', 
    status: 'running',
    version: '1.0.0',
    endpoints: {
      tasks: '/api/tasks',
      calendar: '/api/calendar'
    }
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

// Initialize database and start server
async function startServer() {
  try {
    await initDatabase();
    console.log('Database initialized successfully');
    
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`WebSocket server ready for connections`);
      console.log(`API available at http://localhost:${PORT}/api`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});

startServer();
