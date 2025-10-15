import React, { useCallback } from 'react';
import { Task } from '@shared/types';
import { format } from 'date-fns';
import { CalendarSync } from './CalendarSync';
import { Plus } from 'lucide-react';
import { importCalendarAsTasks } from '../utils/calendarHelper';

interface ThreeDayCalendarProps {
  tasks: Task[];
  onSync: (task: Task) => void;
  onUnsync: (taskId: string) => void;
  onImportTasks: (tasks: Task[]) => void;
}

function getStartOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getEndOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function withinDay(due?: string, day?: Date): boolean {
  if (!due || !day) return false;
  const dt = new Date(due);
  if (isNaN(dt.getTime())) return false;
  return dt >= getStartOfDay(day) && dt <= getEndOfDay(day);
}

function timeLabel(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

export const ThreeDayCalendar: React.FC<ThreeDayCalendarProps> = ({ tasks, onSync, onUnsync, onImportTasks }) => {
  const today = getStartOfDay(new Date());
  const days = [0, 1, 2].map((offset) => new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset));

  const byDay = days.map((day) => {
    const items = tasks
      .filter(t => withinDay(t.dueDate, day))
      .sort((a, b) => {
        const ta = a.dueDate ? new Date(a.dueDate).getTime() : 0;
        const tb = b.dueDate ? new Date(b.dueDate).getTime() : 0;
        return ta - tb;
      });
    return { day, items };
  });

  const dayLabel = (d: Date) => format(d, 'EEE'); // Mon, Tue, Wed
  const dateLabel = (d: Date) => format(d, 'MMM d');

  const importCalendar = useCallback(async () => {
    try {
      let token = localStorage.getItem('google_access_token');
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';

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

      // Range: today through the next 3 days
      const start = getStartOfDay(new Date());
      const end = getEndOfDay(new Date(start));
      end.setDate(end.getDate() + 3);

      const imported = await importCalendarAsTasks(token, start, end);
      if (imported.length > 0) {
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
  }, [tasks, onImportTasks]);

  const exportAll = useCallback(async () => {
    try {
      let token = localStorage.getItem('google_access_token');
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
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

      // Range: today through the next 3 days
      const start = getStartOfDay(new Date());
      const end = getEndOfDay(new Date(start));
      end.setDate(end.getDate() + 3);

      // Export tasks: dueDate within range, not imported (id without ':'), not already synced
      const eligible = tasks.filter(t => {
        if (!t.dueDate) return false;
        const dt = new Date(t.dueDate);
        if (isNaN(dt.getTime())) return false;
        if (dt < start || dt > end) return false;
        if (t.calendarEventId) return false; // already synced
        if (t.id.includes(':')) return false; // imported item
        return true;
      });

      if (eligible.length === 0) {
        alert('No local items to export in the next 3 days.');
        return;
      }

      let success = 0;
      for (const task of eligible) {
        const resp = await fetch(`${apiUrl}/api/calendar/sync-task`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ task, accessToken: token })
        });
        if (resp.ok) {
          const result = await resp.json();
          onSync({ ...task, calendarEventId: result.eventId });
          // If reminders exist, send a patch to ensure overrides persist
          if (task.reminders && task.reminders.length > 0) {
            await fetch(`${apiUrl}/api/calendar/sync-task`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ task: { ...task, calendarEventId: result.eventId }, accessToken: token })
            });
          }
          success += 1;
        }
      }

      alert(`Exported ${success} item${success === 1 ? '' : 's'} to Google Calendar.`);
    } catch (e) {
      console.error('Export error:', e);
      const msg = e instanceof Error ? e.message : 'Unknown error';
      alert(`Failed to export to Google Calendar. ${msg}`);
    }
  }, [tasks, onSync]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end mb-2 gap-2">
        <button
          onClick={importCalendar}
          className="flex items-center space-x-2 px-3 py-1.5 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Import from Google</span>
        </button>
        <button
          onClick={exportAll}
          className="flex items-center space-x-2 px-3 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Export all</span>
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {byDay.map(({ day, items }) => (
          <div key={day.toISOString()} className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-4 py-3 border-b border-gray-100 flex items-baseline justify-between">
              <h3 className="text-lg font-semibold text-gray-900">{dayLabel(day)}</h3>
              <span className="text-sm text-gray-500">{dateLabel(day)}</span>
            </div>
            <div className="p-4 space-y-3 min-h-[300px]">
              {items.length === 0 ? (
                <div className="text-sm text-gray-400 italic">No events</div>
              ) : (
                items.map((t) => (
                  <div key={t.id} className="border border-gray-200 rounded-lg p-3 hover:border-blue-300 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs text-blue-600 font-medium">{timeLabel(t.dueDate) || 'All day'}</div>
                        <div className="text-sm text-gray-900 font-semibold truncate">{t.title}</div>
                        {t.description && (
                          <div className="text-xs text-gray-500 truncate">{t.description}</div>
                        )}
                        {Array.isArray(t.reminders) && t.reminders.length > 0 && (
                          <div className="mt-1 text-[11px] text-gray-600">Reminders: {t.reminders.map((m, i) => (i === 0 ? `${m}m` : `, ${m}m`))}</div>
                        )}
                      </div>
                      <div className="shrink-0">
                        <CalendarSync task={t as any} onSync={onSync as any} onUnsync={onUnsync as any} />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};


