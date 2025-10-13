import { useState } from 'react';
import { motion } from 'framer-motion';
import { HelpCircle, Settings, Mic } from 'lucide-react';
import { VoiceRecorder } from './components/VoiceRecorder';
import { TaskList } from './components/TaskList';
import { CommandHint } from './components/CommandHint';
import { Task, VoiceCommand } from '@shared/types';
import { fetchCalendarEvents, findFreeTimeSlots, findBestTimeSlot, formatTimeSlot, parseTimePreference } from './utils/calendarHelper';


// Mock data for development
const mockTasks: Task[] = [
  {
    id: '1',
    title: 'Call dentist for appointment',
    description: 'Schedule routine cleaning',
    completed: false,
    priority: 'medium',
    dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '2',
    title: 'Prepare presentation for Monday meeting',
    description: 'Create slides for quarterly review',
    completed: false,
    priority: 'high',
    dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '3',
    title: 'Buy groceries',
    description: 'Milk, bread, eggs, vegetables',
    completed: true,
    priority: 'low',
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

function App() {
  const [tasks, setTasks] = useState<Task[]>(mockTasks);
  const [showHint, setShowHint] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Debug: Log API URL on mount
  useState(() => {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    console.log('🔧 API URL:', apiUrl);
    console.log('🔧 VITE_API_URL:', import.meta.env.VITE_API_URL);
    console.log('🔧 All env vars:', import.meta.env);
    
    if (!import.meta.env.VITE_API_URL) {
      console.error('⚠️ VITE_API_URL is not set! Using localhost fallback.');
    }
  });

  // Handle voice commands (can be single or multiple)
  const handleVoiceCommand = async (command: VoiceCommand | VoiceCommand[]) => {
    setIsProcessing(true);
    
    const commands = Array.isArray(command) ? command : [command];
    
    // Check if any command is a "find time" request
    const findTimeCommand = commands.find(cmd => cmd.intent === 'findTime');
    
    if (findTimeCommand) {
      await handleFindTimeCommand(findTimeCommand);
      setIsProcessing(false);
      return;
    }
    
    // Process regular task commands
    setTimeout(() => {
      const newTasks: Task[] = [];
      
      commands.forEach((cmd, index) => {
        if (cmd.intent === 'task' || cmd.intent === 'reminder' || cmd.intent === 'note' || cmd.intent === 'schedule') {
          const newTask: Task = {
            id: `${Date.now()}-${index}`,
            title: cmd.extractedData?.title || cmd.text,
            description: cmd.intent === 'note' ? 'Voice note' : undefined,
            completed: false,
            priority: cmd.extractedData?.priority || 'medium',
            // Build dueDate in user's LOCAL timezone from AI's date/time when available
            dueDate: (() => {
              const due = cmd.extractedData?.dueDate;
              const date = cmd.extractedData?.date; // YYYY-MM-DD
              const time = cmd.extractedData?.time; // HH:mm (24h)
              
              // Prefer composing from date/time to avoid server timezone skew
              if (date || time) {
                const now = new Date();
                let year: number;
                let monthIndex: number;
                let day: number;
                
                if (date) {
                  const [y, mo, d] = date.split('-').map(Number);
                  year = y;
                  monthIndex = (mo || 1) - 1;
                  day = d || 1;
                } else {
                  year = now.getFullYear();
                  monthIndex = now.getMonth();
                  day = now.getDate();
                }
                
                let hours = 0;
                let minutes = 0;
                if (time) {
                  const [h, m] = time.split(':').map(Number);
                  hours = h || 0;
                  minutes = m || 0;
                }
                
                // Create local date from components to preserve user's timezone
                const local = new Date(year, monthIndex, day, hours, minutes, 0, 0);
                return local.toISOString();
              }
              
              // Fallback to server-provided dueDate if no structured fields
              if (due) return due;
              return undefined;
            })(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          
          newTasks.push(newTask);
        }
      });
      
      if (newTasks.length > 0) {
        setTasks(prev => [...newTasks, ...prev]);
        
        // Show success message
        if (newTasks.length > 1) {
          console.log(`✅ Created ${newTasks.length} tasks!`);
        }
      }
      
      setIsProcessing(false);
    }, 1000);
  };

  // Handle "find time" commands
  const handleFindTimeCommand = async (command: VoiceCommand) => {
    try {
      // Check if user has connected Google Calendar
      const accessToken = localStorage.getItem('google_access_token');
      
      if (!accessToken) {
        alert('Please connect Google Calendar first to find available time slots!');
        return;
      }

      // Parse the time preference from command
      const { duration = 60, preference, date = new Date() } = parseTimePreference(command.text);
      
      // Fetch calendar events for the specified date
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      
      const events = await fetchCalendarEvents(accessToken, startOfDay, endOfDay);
      
      // Find free time slots
      const freeSlots = findFreeTimeSlots(events, date, duration);
      
      if (freeSlots.length === 0) {
        alert(`No free time slots found for ${date.toLocaleDateString()}. Your day is fully booked!`);
        return;
      }
      
      // Find the best slot based on preference
      const bestSlot = findBestTimeSlot(freeSlots, preference, duration);
      
      if (!bestSlot) {
        alert(`No suitable time slots found for a ${duration}-minute task.`);
        return;
      }
      
      // Create a task with the suggested time
      const taskTitle = command.extractedData?.title || command.text.replace(/find.*time.*to/i, '').trim();
      
      const newTask: Task = {
        id: Date.now().toString(),
        title: taskTitle || 'Scheduled task',
        description: `Suggested time: ${formatTimeSlot(bestSlot)}`,
        completed: false,
        priority: command.extractedData?.priority || 'medium',
        dueDate: bestSlot.start.toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      setTasks(prev => [newTask, ...prev]);
      
      // Show success message with suggested time
      alert(`✅ Found free time!\n\nSuggested: ${formatTimeSlot(bestSlot)}\n\nTask created with this time slot.`);
      
    } catch (error) {
      console.error('Error finding time:', error);
      alert('Failed to find available time. Please try again.');
    }
  };

  // Task management functions
  const handleToggleTask = (id: string) => {
    setTasks(prev => prev.map(task => 
      task.id === id 
        ? { ...task, completed: !task.completed, updatedAt: new Date().toISOString() }
        : task
    ));
  };

  const handleDeleteTask = (id: string) => {
    setTasks(prev => prev.filter(task => task.id !== id));
  };

  const handleUpdateTask = (id: string, updates: Partial<Task>) => {
    setTasks(prev => prev.map(task => 
      task.id === id 
        ? { ...task, ...updates, updatedAt: new Date().toISOString() }
        : task
    ));
  };

  const handleSyncTask = (task: Task) => {
    setTasks(prev => prev.map(t => 
      t.id === task.id ? task : t
    ));
  };

  const handleUnsyncTask = (taskId: string) => {
    setTasks(prev => prev.map(task => 
      task.id === taskId 
        ? { ...task, calendarEventId: undefined, updatedAt: new Date().toISOString() }
        : task
    ));
  };

  const handleCreateTask = () => {
    const newTask: Task = {
      id: Date.now().toString(),
      title: 'New Task',
      completed: false,
      priority: 'medium',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setTasks(prev => [newTask, ...prev]);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                <Mic className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Voice Planner</h1>
                <p className="text-xs text-gray-500">
                  API: {import.meta.env.VITE_API_URL || 'localhost:3001'}
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <motion.button
                onClick={() => setShowHint(true)}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <HelpCircle className="w-5 h-5" />
              </motion.button>
              
              <motion.button
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Settings className="w-5 h-5" />
              </motion.button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Voice Recorder Section */}
          <div className="lg:col-span-1">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
            >
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Voice Commands</h2>
              
              <VoiceRecorder
                onCommand={handleVoiceCommand}
                onTranscription={setCurrentTranscript}
              />
              
              {/* Processing Indicator */}
              {isProcessing && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 p-3 bg-blue-50 rounded-lg"
                >
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm text-blue-700">Processing voice command...</span>
                  </div>
                </motion.div>
              )}
              
              {/* Current Transcript */}
              {currentTranscript && !isProcessing && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 p-3 bg-gray-50 rounded-lg"
                >
                  <p className="text-sm text-gray-600 italic">"{currentTranscript}"</p>
                </motion.div>
              )}
            </motion.div>
          </div>

          {/* Task List Section */}
          <div className="lg:col-span-2">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
            >
              <TaskList
                tasks={tasks}
                onToggle={handleToggleTask}
                onDelete={handleDeleteTask}
                onUpdate={handleUpdateTask}
                onCreateTask={handleCreateTask}
                onSync={handleSyncTask}
                onUnsync={handleUnsyncTask}
              />
            </motion.div>
          </div>
        </div>
      </main>

      {/* Command Hint Modal */}
      <CommandHint
        isVisible={showHint}
        onClose={() => setShowHint(false)}
      />
    </div>
  );
}

export default App;
