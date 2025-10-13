import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Trash2, Edit3, Calendar, Clock, AlertCircle } from 'lucide-react';
import { Task } from '@shared/types';
import { format, isToday, isTomorrow, isThisWeek } from 'date-fns';
import { CalendarSync } from './CalendarSync';

interface TaskItemProps {
  task: Task;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Task>) => void;
  onSync: (task: Task) => void;
  onUnsync: (taskId: string) => void;
}

export const TaskItem: React.FC<TaskItemProps> = ({ task, onToggle, onDelete, onUpdate, onSync, onUnsync }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);

  const handleSave = () => {
    if (editTitle.trim()) {
      onUpdate(task.id, { title: editTitle.trim() });
      setIsEditing(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setEditTitle(task.title);
      setIsEditing(false);
    }
  };

  const formatDueDate = (dateString: string) => {
    // dateString is ISO; convert to user's local time for display
    const date = new Date(dateString);
    const dateLabel = isToday(date)
      ? 'Today'
      : isTomorrow(date)
        ? 'Tomorrow'
        : isThisWeek(date)
          ? format(date, 'EEEE')
          : format(date, 'MMM d');

    const timeLabel = format(date, 'h:mm a');
    // Only show time if it is not midnight (meaning a time was likely specified)
    const showTime = !(date.getHours() === 0 && date.getMinutes() === 0);
    return showTime ? `${dateLabel} • ${timeLabel}` : dateLabel;
  };

  const getPriorityColor = (priority: Task['priority']) => {
    switch (priority) {
      case 'high': return 'text-red-500';
      case 'medium': return 'text-yellow-500';
      case 'low': return 'text-green-500';
      default: return 'text-gray-500';
    }
  };

  const getPriorityIcon = (priority: Task['priority']) => {
    switch (priority) {
      case 'high': return <AlertCircle className="w-4 h-4" />;
      case 'medium': return <Clock className="w-4 h-4" />;
      case 'low': return <Calendar className="w-4 h-4" />;
      default: return <Calendar className="w-4 h-4" />;
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className={`
        bg-white rounded-lg shadow-sm border border-gray-200 p-4
        transition-all duration-200 hover:shadow-md
        ${task.completed ? 'opacity-60' : ''}
      `}
    >
      <div className="flex items-start space-x-3">
        {/* Checkbox */}
        <motion.button
          onClick={() => onToggle(task.id)}
          className={`
            w-6 h-6 rounded-full border-2 flex items-center justify-center
            transition-all duration-200 hover:scale-110
            ${task.completed 
              ? 'bg-green-500 border-green-500 text-white' 
              : 'border-gray-300 hover:border-green-400'
            }
          `}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          {task.completed && <Check className="w-4 h-4" />}
        </motion.button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onBlur={handleSave}
              onKeyDown={handleKeyPress}
              className="w-full text-lg font-medium border-none outline-none bg-transparent"
              autoFocus
            />
          ) : (
            <h3 
              className={`
                text-lg font-medium cursor-pointer hover:text-blue-600 transition-colors
                ${task.completed ? 'line-through text-gray-500' : 'text-gray-900'}
              `}
              onClick={() => setIsEditing(true)}
            >
              {task.title}
            </h3>
          )}

          {task.description && (
            <p className="text-sm text-gray-600 mt-1">{task.description}</p>
          )}

          {/* Metadata */}
          <div className="flex items-center space-x-4 mt-2">
            {/* Priority */}
            <div className={`flex items-center space-x-1 ${getPriorityColor(task.priority)}`}>
              {getPriorityIcon(task.priority)}
              <span className="text-xs font-medium capitalize">{task.priority}</span>
            </div>

            {/* Due Date */}
            {task.dueDate && (
              <div className="flex items-center space-x-1 text-gray-500">
                <Calendar className="w-4 h-4" />
                <span className="text-xs">
                  {formatDueDate(task.dueDate)}
                </span>
              </div>
            )}

            {/* Created Date */}
            <div className="text-xs text-gray-400">
              {format(new Date(task.createdAt), 'MMM d')}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center space-x-2">
          <CalendarSync
            task={task}
            onSync={onSync}
            onUnsync={onUnsync}
          />
          
          <motion.button
            onClick={() => setIsEditing(true)}
            className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <Edit3 className="w-4 h-4" />
          </motion.button>

          <motion.button
            onClick={() => onDelete(task.id)}
            className="p-1 text-gray-400 hover:text-red-600 transition-colors"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <Trash2 className="w-4 h-4" />
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
};
