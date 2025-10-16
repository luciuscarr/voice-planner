import React, { useCallback } from 'react';
import { Task } from '@shared/types';
import { format } from 'date-fns';
import { CalendarSync } from './CalendarSync';
import { Plus, Trash2 } from 'lucide-react';
import { importCalendarAsTasks } from '../utils/calendarHelper';

interface ThreeDayCalendarProps {
  tasks: Task[];
  onSync: (task: Task) => void;
  onUnsync: (taskId: string) => void;
  onImportTasks: (tasks: Task[]) => void;
  onDelete: (id: string) => void;
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

export const ThreeDayCalendar: React.FC<ThreeDayCalendarProps> = ({ tasks, onSync, onUnsync, onImportTasks, onDelete }) => {
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
  const dateLabel = (d: Date) => format(d, 'MMMM d');

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
      end.setDate(end.getDate() + 4);

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

  const deleteItem = useCallback(async (t: Task) => {
    try {
      // If synced/imported (has calendarEventId), attempt to delete from Google first
      if (t.calendarEventId) {
        const token = localStorage.getItem('google_access_token');
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
        if (token) {
          await fetch(`${apiUrl}/api/calendar/events/${t.calendarEventId}?accessToken=${token}`, { method: 'DELETE' });
        }
      }
    } catch (e) {
      console.warn('Failed to delete from Google Calendar, removing locally anyway');
    } finally {
      onDelete(t.id);
    }
  }, [onDelete]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end mb-2 gap-2">
        <button
          onClick={importCalendar}
          className="flex items-center justify-center space-x-2 px-3 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors mobile-tap"
        >
          <Plus className="w-4 h-4" />
          <span className="text-sm">Import from Google</span>
        </button>
        <button
          onClick={exportAll}
          className="flex items-center justify-center space-x-2 px-3 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors mobile-tap"
        >
          <Plus className="w-4 h-4" />
          <span className="text-sm">Export Created Tasks</span>
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mobile-scroll">
        {byDay.map(({ day, items }) => (
          <div key={day.toISOString()} className="bg-card rounded-lg shadow-sm border border-border">
            <div className="px-3 sm:px-4 py-3 border-b border-border flex items-baseline justify-between">
              <h3 className="text-base sm:text-lg font-semibold text-card-foreground">{dayLabel(day)}</h3>
              <span className="text-xs sm:text-sm text-muted-foreground">{dateLabel(day)}</span>
            </div>
            <div className="p-3 sm:p-4 space-y-3 min-h-[200px] sm:min-h-[300px] mobile-scroll">
              {items.length === 0 ? (
                <div className="text-sm text-muted-foreground italic">No events</div>
              ) : (
                items.map((t) => (
                  <div key={t.id} className="border border-border rounded-lg p-3 hover:border-primary/50 transition-colors mobile-tap">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-xs text-primary font-medium">{timeLabel(t.dueDate) || 'All day'}</div>
                        <div className="text-sm text-card-foreground font-semibold truncate">{t.title}</div>
                        {t.description && (
                          <div className="text-xs text-muted-foreground truncate">{t.description}</div>
                        )}
                        {Array.isArray(t.reminders) && t.reminders.length > 0 && (
                          <div className="mt-1 text-[11px] text-muted-foreground">Reminders: {t.reminders.map((m, i) => (i === 0 ? `${m}m` : `, ${m}m`))}</div>
                        )}
                      </div>
                      <div className="shrink-0 flex items-center gap-1">
                        <button
                          onClick={() => deleteItem(t)}
                          title="Delete"
                          aria-label="Delete"
                          className="p-1.5 rounded-md text-muted-foreground hover:text-destructive transition-colors mobile-tap"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <CalendarSync compact task={t as any} onSync={onSync as any} onUnsync={onUnsync as any} />
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


