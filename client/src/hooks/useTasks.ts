import { useState, useEffect, useCallback } from 'react';
import { Task, WebSocketMessage } from '@voice-planner/shared';
import { useWebSocket } from './useWebSocket';

const API_URL = import.meta.env.VITE_API_URL || 'https://voice-planner.onrender.com';

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleTaskUpdate = useCallback((message: WebSocketMessage) => {
    setTasks(prevTasks => {
      switch (message.type) {
        case 'task_created':
          return [message.payload, ...prevTasks];
        case 'task_updated':
          return prevTasks.map(task => 
            task.id === message.payload.id ? message.payload : task
          );
        case 'task_deleted':
          return prevTasks.filter(task => task.id !== message.payload.id);
        case 'task_completed':
          return prevTasks.map(task => 
            task.id === message.payload.id ? message.payload : task
          );
        default:
          return prevTasks;
      }
    });
  }, []);

  useWebSocket(handleTaskUpdate);

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/tasks`);
      const data = await response.json();
      
      if (data.success) {
        setTasks(data.data);
      } else {
        setError(data.error || 'Failed to fetch tasks');
      }
    } catch (err) {
      setError('Failed to fetch tasks');
      console.error('Error fetching tasks:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const createTask = useCallback(async (text: string) => {
    try {
      const response = await fetch(`${API_URL}/api/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      });
      
      const data = await response.json();
      
      if (!data.success) {
        setError(data.error || 'Failed to create task');
        return false;
      }
      
      return true;
    } catch (err) {
      setError('Failed to create task');
      console.error('Error creating task:', err);
      return false;
    }
  }, []);

  const updateTask = useCallback(async (id: string, updates: Partial<Task>) => {
    try {
      const response = await fetch(`${API_URL}/api/tasks/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });
      
      const data = await response.json();
      
      if (!data.success) {
        setError(data.error || 'Failed to update task');
        return false;
      }
      
      return true;
    } catch (err) {
      setError('Failed to update task');
      console.error('Error updating task:', err);
      return false;
    }
  }, []);

  const deleteTask = useCallback(async (id: string) => {
    try {
      const response = await fetch(`${API_URL}/api/tasks/${id}`, {
        method: 'DELETE',
      });
      
      const data = await response.json();
      
      if (!data.success) {
        setError(data.error || 'Failed to delete task');
        return false;
      }
      
      return true;
    } catch (err) {
      setError('Failed to delete task');
      console.error('Error deleting task:', err);
      return false;
    }
  }, []);

  const completeTask = useCallback(async (id: string) => {
    try {
      const response = await fetch(`${API_URL}/api/tasks/${id}/complete`, {
        method: 'POST',
      });
      
      const data = await response.json();
      
      if (!data.success) {
        setError(data.error || 'Failed to complete task');
        return false;
      }
      
      return true;
    } catch (err) {
      setError('Failed to complete task');
      console.error('Error completing task:', err);
      return false;
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  return {
    tasks,
    loading,
    error,
    createTask,
    updateTask,
    deleteTask,
    completeTask,
    refetch: fetchTasks
  };
}
