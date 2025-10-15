import { useState } from 'react';
import { motion } from 'framer-motion';
import { HelpCircle, Settings, Mic } from 'lucide-react';
import { VoiceRecorder } from './components/VoiceRecorder';
import { TaskList } from './components/TaskList';
import { ThreeDayCalendar } from './components/ThreeDayCalendar';
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
  const [lastScheduledTaskId, setLastScheduledTaskId] = useState<string | null>(null);
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
      // Keep a batch-local pointer so multi-part utterances can reference earlier item in same batch
      let batchLastScheduledId: string | null = lastScheduledTaskId;
      // Capture reminder requests that appear before the task in the same utterance
      let pendingReminders: number[] | null = null;
      
      commands.forEach((cmd, index) => {
        // Treat explicit reminder intent or applyToLastScheduled flag as a reminder update
        const isReminderUpdate = (cmd.intent === 'reminder') || !!cmd.extractedData?.applyToLastScheduled || /^(remind|notify)/i.test(cmd.text);
        if (isReminderUpdate && cmd.extractedData?.reminders) {
          const offsets = cmd.extractedData.reminders;
          if (batchLastScheduledId) {
            // Prefer updating the task created in this batch if present
            const idx = newTasks.findIndex(t => t.id === batchLastScheduledId);
            if (idx >= 0) {
              const existing = Array.isArray(newTasks[idx].reminders) ? newTasks[idx].reminders! : [];
              const merged = Array.from(new Set([ ...existing, ...offsets ]));
              newTasks[idx] = { ...newTasks[idx], reminders: merged, updatedAt: new Date().toISOString() };
            } else {
              // Otherwise update an existing task in state
              setTasks(prev => prev.map(t => {
                if (t.id !== batchLastScheduledId) return t;
                const existing = Array.isArray(t.reminders) ? t.reminders : [];
                const next = Array.from(new Set([ ...existing, ...offsets ]));
                return { ...t, reminders: next, updatedAt: new Date().toISOString() };
              }));
            }
          } else {
            // No task created yet in this batch; hold onto reminders to apply to the next scheduled task created now
            const existing = Array.isArray(pendingReminders) ? pendingReminders : [];
            pendingReminders = Array.from(new Set([ ...existing, ...offsets ]));
          }
          return;
        }
        
        if (cmd.intent === 'task' || cmd.intent === 'reminder' || cmd.intent === 'note' || cmd.intent === 'schedule') {
          const newTask: Task = {
            id: `${Date.now()}-${index}`,
            title: cmd.extractedData?.title || cmd.text,
            description: cmd.intent === 'note' ? 'Voice note' : undefined,
            completed: false,
            priority: cmd.extractedData?.priority || 'medium',
            // Merge any pending reminders captured earlier in this utterance with reminders on this command
            reminders: (() => {
              const r1 = cmd.extractedData?.reminders || [];
              const r2 = pendingReminders || [];
              const merged = Array.from(new Set([...r1, ...r2]));
              return merged.length > 0 ? merged : undefined;
            })(),
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

          // Track last scheduled item when there is a due date (batch-local)
          if (newTask.dueDate) {
            batchLastScheduledId = newTask.id;
            // Clear pending reminders after applying to the created task
            pendingReminders = null;
          }
        }
      });
      
      if (newTasks.length > 0) {
        setTasks(prev => [...newTasks, ...prev]);
        // Persist batch-local pointer globally
        if (batchLastScheduledId) {
          setLastScheduledTaskId(batchLastScheduledId);
        }
        
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
      const { duration = 60, preference, date = new Date(), window } = parseTimePreference(command.text);
      
      // Fetch calendar events for the specified date
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      
      // Remote Google events
      const googleEvents = await fetchCalendarEvents(accessToken, startOfDay, endOfDay);
      
      // Local scheduled tasks for that day (treat as busy as well)
      const localBusy = tasks
        .filter(t => t.dueDate)
        .map(t => ({ id: t.id, summary: t.title, start: t.dueDate!, end: new Date(new Date(t.dueDate!).getTime() + 60 * 60 * 1000).toISOString() }))
        .filter(e => {
          const s = new Date(e.start);
          return s >= startOfDay && s <= endOfDay;
        });
      
      const events = [...googleEvents, ...localBusy];
      
      // Find free time slots
      let freeSlots = findFreeTimeSlots(events, date, duration);
      // If a window is specified, clip free slots to that window
      if (window && (window.start || window.end)) {
        freeSlots = freeSlots.map((slot) => {
          const start = new Date(Math.max(slot.start.getTime(), window.start ? window.start.getTime() : slot.start.getTime()));
          const end = new Date(Math.min(slot.end.getTime(), window.end ? window.end.getTime() : slot.end.getTime()));
          return { start, end, duration: (end.getTime() - start.getTime()) / (1000 * 60) };
        }).filter(s => s.end > s.start && s.duration >= duration);
      }
      
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
      const taskTitle = (() => {
        const explicit = command.extractedData?.title?.trim();
        if (explicit && explicit.length > 0) return explicit;
        // Try to extract phrase after "to" or the action word
        const m = command.text.match(/(?:find|look)\s+(?:.*?\s)?time(?:\s+for|\s+to)?\s+(.*)$/i);
        if (m && m[1]) return m[1].trim();
        return 'Study';
      })();
      
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

  const handleImportTasks = (imported: Task[]) => {
    // Prepend imported tasks
    setTasks(prev => [...imported, ...prev]);
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

          {/* Calendar Section */}
          <div className="lg:col-span-2">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Next 3 Days</h2>
                <div className="text-xs text-gray-500">Today, Tomorrow, and the next day</div>
              </div>
              <ThreeDayCalendar
                tasks={tasks}
                onSync={handleSyncTask}
                onUnsync={handleUnsyncTask}
                onImportTasks={handleImportTasks}
                onDelete={handleDeleteTask}
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
