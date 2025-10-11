import { motion } from 'framer-motion';
import { HelpCircle, Settings, Mic } from 'lucide-react';
import { VoiceRecorder } from './components/VoiceRecorder';
import { TaskList } from './components/TaskList';
import { CommandHint } from './components/CommandHint';
import { Task, VoiceCommand } from '@shared/types';
import React, { useState } from "react";


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

  // Handle voice commands
  const handleVoiceCommand = (command: VoiceCommand) => {
    setIsProcessing(true);
    
    // Simulate processing delay
    setTimeout(() => {
      if (command.intent === 'task' || command.intent === 'reminder' || command.intent === 'note') {
        const newTask: Task = {
          id: Date.now().toString(),
          title: command.extractedData?.title || command.text,
          description: command.intent === 'note' ? 'Voice note' : undefined,
          completed: false,
          priority: command.extractedData?.priority || 'medium',
          dueDate: command.extractedData?.dueDate,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        
        setTasks(prev => [newTask, ...prev]);
      }
      setIsProcessing(false);
    }, 1000);
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
              <h1 className="text-xl font-bold text-gray-900">Voice Planner</h1>
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
