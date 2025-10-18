import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Check, X, RefreshCw, Settings, ExternalLink } from 'lucide-react';

interface CalendarSyncProps {
  task: any;
  onSync: (task: any) => void;
  onUnsync: (taskId: string) => void;
  compact?: boolean;
}

export const CalendarSync: React.FC<CalendarSyncProps> = ({ task, onSync, onUnsync, compact = false }) => {
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
      setErrorMessage('');
      
      // Get authorization URL
      const apiUrl = import.meta.env.VITE_API_URL || 'https://voice-planner.onrender.com';
      console.log('🔗 Connecting to API:', apiUrl);
      
      const response = await fetch(`${apiUrl}/api/calendar/auth-url`);
      console.log('📡 Response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('❌ API Error:', errorData);
        
        if (errorData.error?.includes('credentials not configured')) {
          setErrorMessage('Google Calendar integration is not configured on the server. Please contact the administrator.');
        } else {
          setErrorMessage(`Failed to connect to Google Calendar: ${errorData.error || 'Unknown error'}`);
        }
        setSyncStatus('error');
        return;
      }
      
      const { authUrl } = await response.json();
      console.log('✅ Got auth URL:', authUrl);
      
      // Listen for OAuth callback message
      const messageHandler = (event: MessageEvent) => {
        if (event.data.type === 'google-calendar-auth' && event.data.success) {
          // Store access token
          localStorage.setItem('google_access_token', event.data.accessToken);
          setIsConnected(true);
          setSyncStatus('idle');
          setIsLoading(false);
          window.removeEventListener('message', messageHandler);
        }
      };
      
      window.addEventListener('message', messageHandler);

      // Open popup window for OAuth
      const popup = window.open(
        authUrl,
        'google-auth',
        'width=500,height=600,scrollbars=yes,resizable=yes'
      );

      // Cleanup if popup is closed manually
      const checkClosed = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkClosed);
          setIsLoading(false);
          window.removeEventListener('message', messageHandler);
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

      const apiUrl = import.meta.env.VITE_API_URL || 'https://voice-planner.onrender.com';
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
        // If reminders exist and event already synced, call sync again to force patch (ensures overrides persist)
        if (task.reminders && task.reminders.length > 0) {
          await fetch(`${apiUrl}/api/calendar/sync-task`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ task: { ...task, calendarEventId: result.eventId }, accessToken: token })
          });
        }
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

      const apiUrl = import.meta.env.VITE_API_URL || 'https://voice-planner.onrender.com';
      
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
    if (compact) return '';
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
    <div className="relative flex items-center space-x-2">
      {!isConnected ? (
        <motion.button
          onClick={connectGoogleCalendar}
          disabled={isLoading}
          title="Connect Google Calendar"
          aria-label="Connect Google Calendar"
          className={
            compact
              ? 'p-1.5 text-gray-600 hover:text-blue-600 rounded-md transition-colors disabled:opacity-50'
              : 'flex items-center space-x-2 px-3 py-1.5 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50'
          }
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Settings className={compact ? 'w-4 h-4' : 'w-4 h-4'} />
          {!compact && <span>Connect Google Calendar</span>}
        </motion.button>
      ) : (
        <div className="flex items-center space-x-2">
          <motion.button
            onClick={syncStatus === 'synced' ? unsyncFromCalendar : syncToCalendar}
            disabled={isLoading}
            title={syncStatus === 'synced' ? 'Remove from Calendar' : 'Sync to Calendar'}
            aria-label={syncStatus === 'synced' ? 'Remove from Calendar' : 'Sync to Calendar'}
            className={
              compact
                ? `p-1.5 rounded-md disabled:opacity-50 transition-colors ${
                    syncStatus === 'synced'
                      ? 'text-green-600 hover:text-green-700'
                      : syncStatus === 'error'
                      ? 'text-red-600 hover:text-red-700'
                      : 'text-blue-600 hover:text-blue-700'
                  }`
                : `
              flex items-center space-x-2 px-3 py-1.5 text-sm rounded-lg transition-colors disabled:opacity-50
              ${syncStatus === 'synced' 
                ? 'bg-green-500 text-white hover:bg-green-600' 
                : syncStatus === 'error'
                ? 'bg-red-500 text-white hover:bg-red-600'
                : 'bg-blue-500 text-white hover:bg-blue-600'
              }
            `
            }
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {getSyncButtonIcon()}
            {!compact && <span>{getSyncButtonText()}</span>}
          </motion.button>

          {syncStatus === 'synced' && (
            <motion.a
              href="https://calendar.google.com"
              target="_blank"
              rel="noopener noreferrer"
              title="Open Google Calendar"
              aria-label="Open Google Calendar"
              className={compact ? 'p-1.5 text-gray-400 hover:text-blue-600 transition-colors' : 'p-1.5 text-gray-400 hover:text-blue-600 transition-colors'}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <ExternalLink className="w-4 h-4" />
            </motion.a>
          )}
        </div>
      )}

      <AnimatePresence>
        {syncStatus === 'synced' && !compact && (
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
        
        {syncStatus === 'error' && errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full left-0 mt-2 p-3 bg-red-50 border border-red-200 rounded-lg shadow-lg z-10 max-w-xs"
          >
            <div className="flex items-start space-x-2">
              <X className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-700">{errorMessage}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
