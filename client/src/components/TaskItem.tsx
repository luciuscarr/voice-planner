import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Trash2, Edit3, Calendar, Clock, AlertCircle, Users, Plus, X } from 'lucide-react';
import { Task, Attendee } from '@shared/types';
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
  const [isAddingAttendee, setIsAddingAttendee] = useState(false);
  const [newAttendeeEmail, setNewAttendeeEmail] = useState('');
  const [newAttendeeName, setNewAttendeeName] = useState('');

  const handleSave = () => {
    if (editTitle.trim()) {
      onUpdate(task.id, { title: editTitle.trim() });
      setIsEditing(false);
    }
  };

  const handleAddAttendee = () => {
    if (newAttendeeEmail.trim()) {
      const newAttendee: Attendee = {
        email: newAttendeeEmail.trim(),
        displayName: newAttendeeName.trim() || undefined,
        responseStatus: 'needsAction'
      };
      
      const updatedAttendees = [...(task.attendees || []), newAttendee];
      onUpdate(task.id, { attendees: updatedAttendees });
      
      setNewAttendeeEmail('');
      setNewAttendeeName('');
      setIsAddingAttendee(false);
    }
  };

  const handleRemoveAttendee = (email: string) => {
    const updatedAttendees = (task.attendees || []).filter(attendee => attendee.email !== email);
    onUpdate(task.id, { attendees: updatedAttendees });
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

          {/* Attendees */}
          {task.attendees && task.attendees.length > 0 && (
            <div className="mt-2">
              <div className="flex items-center space-x-1 text-gray-500 mb-1">
                <Users className="w-4 h-4" />
                <span className="text-xs font-medium">Attendees:</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {task.attendees.map((attendee, index) => (
                  <div key={index} className="flex items-center space-x-1 bg-blue-50 text-blue-700 px-2 py-1 rounded-full text-xs">
                    <span>{attendee.displayName || attendee.email}</span>
                    <button
                      onClick={() => handleRemoveAttendee(attendee.email)}
                      className="hover:text-blue-900 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add Attendee */}
          {isAddingAttendee ? (
            <div className="mt-2 p-2 bg-gray-50 rounded-lg">
              <div className="flex flex-col space-y-2">
                <input
                  type="email"
                  placeholder="Email address"
                  value={newAttendeeEmail}
                  onChange={(e) => setNewAttendeeEmail(e.target.value)}
                  className="text-sm px-2 py-1 border border-gray-300 rounded"
                />
                <input
                  type="text"
                  placeholder="Display name (optional)"
                  value={newAttendeeName}
                  onChange={(e) => setNewAttendeeName(e.target.value)}
                  className="text-sm px-2 py-1 border border-gray-300 rounded"
                />
                <div className="flex space-x-2">
                  <button
                    onClick={handleAddAttendee}
                    className="text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600 transition-colors"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => {
                      setIsAddingAttendee(false);
                      setNewAttendeeEmail('');
                      setNewAttendeeName('');
                    }}
                    className="text-xs bg-gray-500 text-white px-2 py-1 rounded hover:bg-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setIsAddingAttendee(true)}
              className="mt-2 flex items-center space-x-1 text-xs text-blue-600 hover:text-blue-800 transition-colors"
            >
              <Plus className="w-3 h-3" />
              <span>Add attendee</span>
            </button>
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

            {/* Reminders */}
            {task.reminders && task.reminders.length > 0 && (
              <div className="flex items-center space-x-1 text-gray-500">
                <Clock className="w-4 h-4" />
                <span className="text-xs">
                  {task.reminders.map((m, i) => (i === 0 ? `${m}m` : `, ${m}m`))}
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
