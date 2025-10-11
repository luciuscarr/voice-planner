import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Task } from '@shared/types';
import { TaskItem } from './TaskItem';
import { Filter, Search, Plus } from 'lucide-react';

interface TaskListProps {
  tasks: Task[];
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Task>) => void;
  onCreateTask: () => void;
  onSync: (task: Task) => void;
  onUnsync: (taskId: string) => void;
}

type FilterType = 'all' | 'pending' | 'completed' | 'high' | 'medium' | 'low';

export const TaskList: React.FC<TaskListProps> = ({ 
  tasks, 
  onToggle, 
  onDelete, 
  onUpdate, 
  onCreateTask,
  onSync,
  onUnsync
}) => {
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'created' | 'due' | 'priority'>('created');

  const filteredAndSortedTasks = useMemo(() => {
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

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'due':
          if (!a.dueDate && !b.dueDate) return 0;
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        case 'priority':
          const priorityOrder = { high: 3, medium: 2, low: 1 };
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        case 'created':
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

    return filtered;
  }, [tasks, filter, searchQuery, sortBy]);

  const taskStats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter(task => task.completed).length;
    const pending = total - completed;
    const highPriority = tasks.filter(task => task.priority === 'high' && !task.completed).length;

    return { total, completed, pending, highPriority };
  }, [tasks]);

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

        {/* Sort */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as 'created' | 'due' | 'priority')}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="created">Sort by Created</option>
          <option value="due">Sort by Due Date</option>
          <option value="priority">Sort by Priority</option>
        </select>
      </div>

      {/* Task List */}
      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {filteredAndSortedTasks.length === 0 ? (
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
            filteredAndSortedTasks.map((task) => (
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
