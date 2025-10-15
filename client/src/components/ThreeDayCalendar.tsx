import React from 'react';
import { Task } from '@shared/types';
import { format } from 'date-fns';

interface ThreeDayCalendarProps {
  tasks: Task[];
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

export const ThreeDayCalendar: React.FC<ThreeDayCalendarProps> = ({ tasks }) => {
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

  return (
    <div className="space-y-4">
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
                    <div className="text-xs text-blue-600 font-medium">{timeLabel(t.dueDate) || 'All day'}</div>
                    <div className="text-sm text-gray-900 font-semibold truncate">{t.title}</div>
                    {t.description && (
                      <div className="text-xs text-gray-500 truncate">{t.description}</div>
                    )}
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


