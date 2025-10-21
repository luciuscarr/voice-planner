import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HelpCircle, Settings, Mic, Sun, Moon } from 'lucide-react';
import { VoiceRecorder } from './components/VoiceRecorder';
import { TaskList } from './components/TaskList';
import { ThreeDayCalendar } from './components/ThreeDayCalendar';
import { CommandHint } from './components/CommandHint';
import { Task, VoiceCommand } from '@shared/types';
import { fetchCalendarEvents, findFreeTimeSlots, findBestTimeSlot, formatTimeSlot, parseTimePreference } from './utils/calendarHelper';

// Fix this later with the include.
// Temporary local definition until shared types are properly resolved
interface Attendee {
  email: string;
  displayName?: string;
  responseStatus?: 'accepted' | 'declined' | 'tentative' | 'needsAction';
}

// Extend Task interface locally to include attendees
interface TaskWithAttendees extends Task {
  attendees?: Attendee[];
}

// Extend VoiceCommand extractedData to include attendees
interface VoiceCommandWithAttendees extends VoiceCommand {
  extractedData?: VoiceCommand['extractedData'] & {
    attendees?: Attendee[];
  };
}

// Mock data for development
const mockTasks: Task[] = [

];

function App() {
  const [tasks, setTasks] = useState<Task[]>(mockTasks);
  const [lastScheduledTaskId, setLastScheduledTaskId] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Dark mode initialization and persistence
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const shouldBeDark = savedTheme === 'dark' || (!savedTheme && prefersDark);
    
    setIsDarkMode(shouldBeDark);
    if (shouldBeDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleDarkMode = () => {
    const newDarkMode = !isDarkMode;
    setIsDarkMode(newDarkMode);
    
    if (newDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  // Debug: Log API URL on mount
  useState(() => {
    const apiUrl = import.meta.env.VITE_API_URL || 'https://voice-planner.onrender.com';
    console.log('🔧 API URL:', apiUrl);
    console.log('🔧 VITE_API_URL:', import.meta.env.VITE_API_URL);
    console.log('🔧 All env vars:', import.meta.env);
    
    if (!import.meta.env.VITE_API_URL) {
      console.error('⚠️ VITE_API_URL is not set! Using production server fallback.');
    }
  });

  // Handle voice commands (can be single or multiple)
  const handleVoiceCommand = async (command: VoiceCommandWithAttendees | VoiceCommandWithAttendees[]) => {
    setIsProcessing(true);
    
    const commands = Array.isArray(command) ? command : [command];
    
    // Debug logging for command parsing
    console.log('Voice command received:', {
      isArray: Array.isArray(command),
      commandCount: commands.length,
      commands: commands.map(cmd => ({
        intent: cmd.intent,
        title: cmd.extractedData?.title,
        date: cmd.extractedData?.date,
        time: cmd.extractedData?.time
      }))
    });
    
    const findTimeCommands = commands.filter(cmd => cmd.intent === 'findTime');
    const actionable = commands.filter(cmd => cmd.intent !== 'findTime');

    const newTasks: Task[] = [];
    // Keep a batch-local pointer so multi-part utterances can reference earlier item in same batch
    let batchLastScheduledId: string | null = lastScheduledTaskId;
    // Capture reminder requests that appear before the task in the same utterance
    let pendingReminders: number[] | null = null;

    actionable.forEach((cmd, index) => {
      // Apply-to-last updates: title and/or reminders
      const applyToLast = !!cmd.extractedData?.applyToLastScheduled;
      if (applyToLast) {
        if (batchLastScheduledId) {
          const titleUpdate = cmd.extractedData?.title;
          const reminderOffsets = cmd.extractedData?.reminders;
          const idx = newTasks.findIndex(t => t.id === batchLastScheduledId);
          if (idx >= 0) {
            const updated: Task = { ...newTasks[idx] };
            if (titleUpdate) updated.title = titleUpdate;
            if (reminderOffsets && reminderOffsets.length > 0) {
              const existing = Array.isArray(updated.reminders) ? updated.reminders : [];
              updated.reminders = Array.from(new Set([...existing, ...reminderOffsets]));
            }
            updated.updatedAt = new Date().toISOString();
            newTasks[idx] = updated;
          } else {
            setTasks(prev => prev.map(t => {
              if (t.id !== batchLastScheduledId) return t;
              const updated: Task = { ...t };
              if (titleUpdate) updated.title = titleUpdate;
              if (reminderOffsets && reminderOffsets.length > 0) {
                const existing = Array.isArray(updated.reminders) ? updated.reminders : [];
                updated.reminders = Array.from(new Set([...existing, ...reminderOffsets]));
              }
              updated.updatedAt = new Date().toISOString();
              return updated;
            }));
          }
        } else if (cmd.extractedData?.reminders) {
          const existing = Array.isArray(pendingReminders) ? pendingReminders : [];
          pendingReminders = Array.from(new Set([ ...existing, ...cmd.extractedData.reminders ]));
        }
        return;
      }

      // Explicit reminder intent without applyToLast
      const isReminderUpdate = (cmd.intent === 'reminder') || /^(remind|notify)/i.test(cmd.text);
      if (isReminderUpdate && cmd.extractedData?.reminders) {
        const offsets = cmd.extractedData.reminders;
        if (batchLastScheduledId) {
          const idx = newTasks.findIndex(t => t.id === batchLastScheduledId);
          if (idx >= 0) {
            const existing = Array.isArray(newTasks[idx].reminders) ? newTasks[idx].reminders! : [];
            const merged = Array.from(new Set([ ...existing, ...offsets ]));
            newTasks[idx] = { ...newTasks[idx], reminders: merged, updatedAt: new Date().toISOString() };
          } else {
            setTasks(prev => prev.map(t => {
              if (t.id !== batchLastScheduledId) return t;
              const existing = Array.isArray(t.reminders) ? t.reminders : [];
              const next = Array.from(new Set([ ...existing, ...offsets ]));
              return { ...t, reminders: next, updatedAt: new Date().toISOString() };
            }));
          }
        } else {
          const existing = Array.isArray(pendingReminders) ? pendingReminders : [];
          pendingReminders = Array.from(new Set([ ...existing, ...offsets ]));
        }
        return;
      }
      
      if (cmd.intent === 'task' || cmd.intent === 'reminder' || cmd.intent === 'note' || cmd.intent === 'schedule') {
        const newTask: TaskWithAttendees = {
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
          // Include attendees if present
          attendees: cmd.extractedData?.attendees || undefined,
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
              
              // Debug logging for appointments
              console.log('Appointment debug:', {
                inputDate: date,
                inputTime: time,
                localDate: local.toISOString(),
                localDateString: local.toDateString(),
                dayOfWeek: local.getDay(),
                hours: hours,
                minutes: minutes
              });
              
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
      if (batchLastScheduledId) setLastScheduledTaskId(batchLastScheduledId);
    }

    // Handle find-time commands afterwards so they consider newly-created tasks as busy blocks
    for (const ft of findTimeCommands) {
      await handleFindTimeCommand(ft);
    }

    setIsProcessing(false);
    
    // Fade out transcript after processing is complete
    setTimeout(() => {
      setShowTranscript(false);
      setCurrentTranscript('');
    }, 2000);
  };

  // Handle "find time" commands
  const handleFindTimeCommand = async (command: VoiceCommandWithAttendees) => {
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
      
      const newTask: TaskWithAttendees = {
        id: Date.now().toString(),
        title: taskTitle || 'Scheduled task',
        description: `Suggested time: ${formatTimeSlot(bestSlot)}`,
        completed: false,
        priority: command.extractedData?.priority || 'medium',
        dueDate: bestSlot.start.toISOString(),
        attendees: command.extractedData?.attendees || undefined,
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
    <div className="min-h-screen relative">
      {/* Aura Background */}
      <div className="fixed inset-0 -z-10">
        {/* Galaxy base with rich royal purple */}
        <div 
          className="absolute inset-0 bg-gradient-to-br from-[#1a0033] via-[#2d1b69] to-[#0f0a1a]"
          style={{ 
            animation: (isSpeaking || isProcessing) ? 'sparkGradient 2s ease-in-out infinite' : 'none' 
          }}
        />
        
        {/* Galaxy stars overlay */}
        <div 
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: `
              radial-gradient(2px 2px at 20px 30px, #eee, transparent),
              radial-gradient(2px 2px at 40px 70px, rgba(255,255,255,0.8), transparent),
              radial-gradient(1px 1px at 90px 40px, #fff, transparent),
              radial-gradient(1px 1px at 130px 80px, rgba(255,255,255,0.6), transparent),
              radial-gradient(2px 2px at 160px 30px, #fff, transparent)
            `,
            backgroundRepeat: 'repeat',
            backgroundSize: '200px 100px'
          }}
        />
        
        {/* Galaxy nebula clouds - optimized with pseudo-elements */}
        <div className="absolute top-1/3 left-1/4 w-[60rem] h-[60rem] aura-purple" />
        <div className="absolute bottom-1/4 right-1/4 w-[55rem] h-[55rem] aura-indigo" />
        <div className="absolute top-1/2 right-1/3 w-[50rem] h-[50rem] aura-fuchsia" />
        <div className="absolute bottom-1/3 left-1/2 w-[45rem] h-[45rem] aura-violet" />
        <div className="absolute top-1/4 right-1/6 w-[40rem] h-[40rem] aura-spiral" />
      </div>
      
      {/* Main Content */}
      <div className="relative z-10 bg-background/80 backdrop-blur-xl mobile-safe-area min-h-screen">
      <header className="bg-card shadow-sm border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <Mic className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">Day Planner</h1>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">

              
              <motion.button
                onClick={() => setShowHint(true)}
                className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors mobile-tap"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                title="Voice Commands"
              >
                <HelpCircle className="w-5 h-5" />
              </motion.button>

            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-8">
          {/* Voice Recorder Section */}
          <div className="lg:col-span-1 order-2 lg:order-1">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-card rounded-lg shadow-sm border border-border p-4 sm:p-6"
            >
              <h2 className="text-lg font-semibold text-card-foreground mb-4">Voice Commands</h2>
              

              
              <VoiceRecorder
                onCommand={handleVoiceCommand}
                onTranscription={(transcript) => {
                  setCurrentTranscript(transcript);
                  if (transcript) {
                    setShowTranscript(true);
                    setIsSpeaking(true);
                  }
                }}
                onProcessingChange={(processing) => {
                  setIsProcessing(processing);
                  if (!processing) {
                    setIsSpeaking(false);
                  }
                }}
              />

                            {/* Current Transcript */}
              <motion.div
                animate={{ height: showTranscript && currentTranscript ? "auto" : 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <AnimatePresence>
                  {showTranscript && currentTranscript && (
                    <motion.div
                      key="transcript"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.3 }}
                      className="mt-4 p-3 bg-muted rounded-lg"
                    >
                      <p className="text-sm text-muted-foreground italic">"{currentTranscript}"</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>

              {/* Reset Button */}
              <motion.div
                animate={{ height: showTranscript && (currentTranscript || isProcessing) ? "auto" : 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <AnimatePresence>
                  {showTranscript && (currentTranscript || isProcessing) && (
                    <motion.div
                      key="reset-button"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.3 }}
                      className="flex justify-center mt-2"
                    >
                      <motion.button
                        onClick={() => {
                          setCurrentTranscript('');
                          setIsProcessing(false);
                          setShowTranscript(false);
                        }}
                        className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Clear
                      </motion.button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
              
              {/* Processing Indicator */}
              {isProcessing && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 p-3 bg-primary/10 rounded-lg"
                >
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm text-primary">Processing voice command...</span>
                  </div>
                </motion.div>
              )}
              

            </motion.div>
          </div>

          {/* Calendar Section */}
          <div className="lg:col-span-2 order-1 lg:order-2">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-card rounded-lg shadow-sm border border-border p-4 sm:p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-card-foreground">Next 3 Days</h2>
                <div className="text-xs text-muted-foreground hidden sm:block">Today, Tomorrow, and the next day</div>
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
      </div>

      {/* Command Hint Modal */}
      <CommandHint
        isVisible={showHint}
        onClose={() => setShowHint(false)}
      />
      
      {/* Animation keyframes */}
      <style>{`
        .bg-gradient-radial {
          background: radial-gradient(circle, var(--tw-gradient-stops));
        }
        
        .bg-gradient-conic {
          background: conic-gradient(from 0deg, var(--tw-gradient-stops));
        }
        
        /* Optimized aura effects with pseudo-elements */
        .aura-purple::before {
          content: "";
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at 50% 50%, #6b21a8 0%, #7c3aed 30%, transparent 70%);
          filter: blur(200px);
          opacity: 0.6;
          animation: ${(isSpeaking || isProcessing) ? 'sparkUp 1.5s ease-in-out infinite' : 'breathe 6s ease-in-out infinite'};
        }
        
        .aura-indigo::before {
          content: "";
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at 50% 50%, #4338ca 0%, #6366f1 30%, transparent 70%);
          filter: blur(200px);
          opacity: 0.5;
          animation: ${(isSpeaking || isProcessing) ? 'sparkUp 1.7s ease-in-out infinite' : 'breathe 7s ease-in-out infinite'};
        }
        
        .aura-fuchsia::before {
          content: "";
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at 50% 50%, #be185d 0%, #d946ef 30%, transparent 70%);
          filter: blur(180px);
          opacity: 0.4;
          animation: ${(isSpeaking || isProcessing) ? 'sparkUp 1.9s ease-in-out infinite' : 'breathe 8s ease-in-out infinite'};
        }
        
        .aura-violet::before {
          content: "";
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at 50% 50%, #7c2d12 0%, #a855f7 30%, transparent 70%);
          filter: blur(160px);
          opacity: 0.3;
          animation: ${(isSpeaking || isProcessing) ? 'sparkUp 1.6s ease-in-out infinite' : 'breathe 9s ease-in-out infinite'};
        }
        
        .aura-spiral::before {
          content: "";
          position: absolute;
          inset: 0;
          background: conic-gradient(from 0deg, #7c3aed 0%, #a855f7 30%, transparent 70%);
          filter: blur(300px);
          opacity: 0.25;
          animation: ${(isSpeaking || isProcessing) ? 'sparkUp 2.2s ease-in-out infinite' : 'breathe 10s ease-in-out infinite'};
        }
        
        @keyframes auraMove {
          0% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(50px, -50px) scale(1.1); }
          100% { transform: translate(0, 0) scale(1); }
        }
        
        @keyframes breathe {
          0%, 100% { 
            opacity: 0.3;
          }
          50% { 
            opacity: 0.7;
          }
        }
        
        @keyframes breatheBlob {
          0%, 100% { 
            opacity: 0.1;
            transform: scale(1);
          }
          50% { 
            opacity: 0.3;
            transform: scale(1.05);
          }
        }
        
        @keyframes sparkUp {
          0% { 
            opacity: 0.3;
            transform: scale(1);
            filter: blur(200px);
          }
          50% { 
            opacity: 0.7;
            transform: scale(1.6);
            filter: blur(100px);
          }
          100% { 
            opacity: 0.5;
            transform: scale(1.3);
            filter: blur(150px);
          }
        }
        
        @keyframes sparkGradient {
          0% { 
            opacity: 0.4;
            transform: scale(1);
          }
          50% { 
            opacity: 0.8;
            transform: scale(1.03);
          }
          100% { 
            opacity: 0.6;
            transform: scale(1.01);
          }
        }
      `}</style>
    </div>
    
  );
}

export default App;
