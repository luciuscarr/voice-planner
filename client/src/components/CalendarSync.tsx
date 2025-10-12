import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Check, X, RefreshCw, Settings, ExternalLink } from 'lucide-react';

interface CalendarSyncProps {
  task: any;
  onSync: (task: any) => void;
  onUnsync: (taskId: string) => void;
}

export const CalendarSync: React.FC<CalendarSyncProps> = ({ task, onSync, onUnsync }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Check if Google Calendar is connected
  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    try {
      const token = localStorage.getItem('google_access_token');
      if (token) {
        setIsConnected(true);
        setSyncStatus('synced');
      }
    } catch (error) {
      console.error('Error checking connection:', error);
    }
  };

  const connectGoogleCalendar = async () => {
    try {
      setIsLoading(true);
      
      // Get authorization URL
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      console.log('🔗 Connecting to API:', apiUrl);
      
      const response = await fetch(`${apiUrl}/api/calendar/auth-url`);
      console.log('📡 Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API Error:', errorText);
        throw new Error(`Failed to get auth URL: ${response.status} - ${errorText}`);
      }
      
      const { authUrl } = await response.json();
      console.log('✅ Got auth URL:', authUrl);
      
      // Open popup window for OAuth
      const popup = window.open(
        authUrl,
        'google-auth',
        'width=500,height=600,scrollbars=yes,resizable=yes'
      );

      // Listen for popup completion
      const checkClosed = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkClosed);
          setIsLoading(false);
          checkConnection();
        }
      }, 1000);

    } catch (error) {
      console.error('❌ Error connecting to Google Calendar:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setErrorMessage(`Calendar error: ${errorMsg}`);
      setSyncStatus('error');
      setIsLoading(false);
      
      // Show alert to user
      alert(`Calendar Connection Error:\n${errorMsg}\n\nCheck console for details.`);
    }
  };

  const syncToCalendar = async () => {
    try {
      setIsLoading(true);
      setSyncStatus('syncing');

      const token = localStorage.getItem('google_access_token');
      if (!token) {
        await connectGoogleCalendar();
        return;
      }

      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/calendar/sync-task`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          task,
          accessToken: token
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setSyncStatus('synced');
        onSync({ ...task, calendarEventId: result.eventId });
      } else {
        setSyncStatus('error');
      }
    } catch (error) {
      console.error('Error syncing to calendar:', error);
      setSyncStatus('error');
    } finally {
      setIsLoading(false);
    }
  };

  const unsyncFromCalendar = async () => {
    try {
      setIsLoading(true);

      const token = localStorage.getItem('google_access_token');
      if (!token) return;

      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      
      if (task.calendarEventId) {
        await fetch(`${apiUrl}/api/calendar/events/${task.calendarEventId}?accessToken=${token}`, {
          method: 'DELETE',
        });
      }

      onUnsync(task.id);
      setSyncStatus('idle');
    } catch (error) {
      console.error('Error unsyncing from calendar:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getSyncButtonText = () => {
    if (isLoading) return 'Syncing...';
    if (syncStatus === 'synced') return 'Synced';
    if (syncStatus === 'error') return 'Retry';
    return 'Sync to Calendar';
  };

  const getSyncButtonIcon = () => {
    if (isLoading) return <RefreshCw className="w-4 h-4 animate-spin" />;
    if (syncStatus === 'synced') return <Check className="w-4 h-4" />;
    if (syncStatus === 'error') return <X className="w-4 h-4" />;
    return <Calendar className="w-4 h-4" />;
  };

  return (
    <div className="flex items-center space-x-2">
      {!isConnected ? (
        <motion.button
          onClick={connectGoogleCalendar}
          disabled={isLoading}
          className="flex items-center space-x-2 px-3 py-1.5 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Settings className="w-4 h-4" />
          <span>Connect Google Calendar</span>
        </motion.button>
      ) : (
        <div className="flex items-center space-x-2">
          <motion.button
            onClick={syncStatus === 'synced' ? unsyncFromCalendar : syncToCalendar}
            disabled={isLoading}
            className={`
              flex items-center space-x-2 px-3 py-1.5 text-sm rounded-lg transition-colors disabled:opacity-50
              ${syncStatus === 'synced' 
                ? 'bg-green-500 text-white hover:bg-green-600' 
                : syncStatus === 'error'
                ? 'bg-red-500 text-white hover:bg-red-600'
                : 'bg-blue-500 text-white hover:bg-blue-600'
              }
            `}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {getSyncButtonIcon()}
            <span>{getSyncButtonText()}</span>
          </motion.button>

          {syncStatus === 'synced' && (
            <motion.a
              href="https://calendar.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <ExternalLink className="w-4 h-4" />
            </motion.a>
          )}
        </div>
      )}

      <AnimatePresence>
        {syncStatus === 'synced' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="flex items-center space-x-1 text-green-600"
          >
            <Check className="w-4 h-4" />
            <span className="text-xs font-medium">Calendar</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
