import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Task } from '@shared/types';
import { importCalendarAsTasks } from '../utils/calendarHelper';
import { TaskItem } from './TaskItem';
import { Filter, Search, Plus } from 'lucide-react';

// Body of the task list, which deals with filtering and displaying tasks from /TaskItem.tsx.

// --------------------


interface TaskListProps {
  tasks: Task[];
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Task>) => void;
  onCreateTask: () => void;
  onSync: (task: Task) => void;
  onUnsync: (taskId: string) => void;
  onImportTasks: (tasks: Task[]) => void;
}

type FilterType = 'all' | 'pending' | 'completed' | 'high' | 'medium' | 'low';

export const TaskList: React.FC<TaskListProps> = ({ 
  tasks, 
  onToggle, 
  onDelete, 
  onUpdate, 
  onCreateTask,
  onSync,
  onUnsync,
  onImportTasks
}) => {
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTasks = useMemo(() => {
    let filtered = tasks;

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(task =>
        task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (task.description && task.description.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    // Apply status/priority filter
    switch (filter) {
      case 'pending':
        filtered = filtered.filter(task => !task.completed);
        break;
      case 'completed':
        filtered = filtered.filter(task => task.completed);
        break;
      case 'high':
        filtered = filtered.filter(task => task.priority === 'high');
        break;
      case 'medium':
        filtered = filtered.filter(task => task.priority === 'medium');
        break;
      case 'low':
        filtered = filtered.filter(task => task.priority === 'low');
        break;
    }


    return filtered;
  }, [tasks, filter, searchQuery]);

  const taskStats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter(task => task.completed).length;
    const pending = total - completed;
    const highPriority = tasks.filter(task => task.priority === 'high' && !task.completed).length;

    return { total, completed, pending, highPriority };
  }, [tasks]);

  const importCalendar = async () => {
    try {
      let token = localStorage.getItem('google_access_token');
      const apiUrl = import.meta.env.VITE_API_URL || 'https://voice-planner.onrender.com';

      // If not connected, prompt connection and then continue
      if (!token) {
        const response = await fetch(`${apiUrl}/api/calendar/auth-url`);
        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Failed to start Google auth: ${response.status} - ${errText}`);
        }
        const { authUrl } = await response.json();

        await new Promise<void>((resolve, reject) => {
          const handler = (event: MessageEvent) => {
            if (event.data && event.data.type === 'google-calendar-auth') {
              window.removeEventListener('message', handler);
              if (event.data.success && event.data.accessToken) {
                localStorage.setItem('google_access_token', event.data.accessToken);
                resolve();
              } else {
                reject(new Error('Google authentication failed'));
              }
            }
          };
          window.addEventListener('message', handler);
          const popup = window.open(authUrl, 'google-auth', 'width=500,height=600,scrollbars=yes,resizable=yes');
          const interval = setInterval(() => {
            if (popup && popup.closed) {
              clearInterval(interval);
              window.removeEventListener('message', handler);
              reject(new Error('Google auth window was closed'));
            }
          }, 1000);
        });
        token = localStorage.getItem('google_access_token');
        if (!token) throw new Error('Missing access token after authentication');
      }

      // Proceed with import
      // Range: today through the next 3 days
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 4); // +4 Days helps avoid edge cases with timezones, we just chop off whats not important.
      end.setHours(23, 59, 59, 999); 
      const imported = await importCalendarAsTasks(token, start, end);

      if (imported.length > 0) {
        // Dedup by id against current list
        const currentIds = new Set(tasks.map(t => t.id));
        const newOnes = imported.filter((t: Task) => !currentIds.has(t.id));
        if (newOnes.length > 0) {
          onImportTasks(newOnes);
          alert(`Imported ${newOnes.length} event${newOnes.length > 1 ? 's' : ''} from Google Calendar.`);
        } else {
          alert('No new events to import (already in your list).');
        }
      } else {
        alert('No events found to import.');
      }
    } catch (e) {
      console.error('Import error:', e);
      const msg = e instanceof Error ? e.message : 'Unknown error';
      alert(`Failed to import from Google Calendar. ${msg}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Tasks</h2>
          <p className="text-sm text-gray-600">
            {taskStats.pending} pending • {taskStats.completed} completed
            {taskStats.highPriority > 0 && ` • ${taskStats.highPriority} high priority`}
          </p>
        </div>
        
        <motion.button
          onClick={onCreateTask}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Plus className="w-4 h-4" />
          <span>Add Task</span>
        </motion.button>
        
        <motion.button
          onClick={importCalendar}
          className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 transition-colors"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Plus className="w-4 h-4" />
          <span>Import from Google</span>
        </motion.button>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Filter Buttons */}
        <div className="flex space-x-2">
          {(['all', 'pending', 'completed', 'high'] as FilterType[]).map((filterType) => (
            <motion.button
              key={filterType}
              onClick={() => setFilter(filterType)}
              className={`
                px-3 py-2 text-sm font-medium rounded-lg transition-colors
                ${filter === filterType
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }
              `}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {filterType === 'all' ? 'All' : 
               filterType === 'pending' ? 'Pending' :
               filterType === 'completed' ? 'Completed' :
               filterType === 'high' ? 'High Priority' : filterType}
            </motion.button>
          ))}
        </div>

      </div>

      {/* Task List */}
      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {filteredTasks.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12 text-gray-500"
            >
              <Filter className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium">No tasks found</p>
              <p className="text-sm">
                {searchQuery ? 'Try adjusting your search' : 'Start by adding a new task'}
              </p>
            </motion.div>
          ) : (
            filteredTasks.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                onToggle={onToggle}
                onDelete={onDelete}
                onUpdate={onUpdate}
                onSync={onSync}
                onUnsync={onUnsync}
              />
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
