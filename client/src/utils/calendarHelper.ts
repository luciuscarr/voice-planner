// Helper functions for Google Calendar integration

export interface CalendarEvent {
  id: string;
  summary: string;
  start: string;
  end: string;
}

export interface TimeSlot {
  start: Date;
  end: Date;
  duration: number; // in minutes
}

// Fetch events from Google Calendar
export async function fetchCalendarEvents(
  accessToken: string,
  startDate: Date,
  endDate: Date
): Promise<CalendarEvent[]> {
  try {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    const response = await fetch(
      `${apiUrl}/api/calendar/events?accessToken=${accessToken}&timeMin=${startDate.toISOString()}&timeMax=${endDate.toISOString()}`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch calendar events');
    }

    const data = await response.json();
    return data.events || [];
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    return [];
  }
}

// Import Google events as local tasks
export async function importCalendarAsTasks(accessToken: string, startDate: Date, endDate: Date) {
  try {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    const response = await fetch(
      `${apiUrl}/api/calendar/events?accessToken=${accessToken}&timeMin=${startDate.toISOString()}&timeMax=${endDate.toISOString()}`
    );
    const data = await response.json();
    return data.tasks || [];
  } catch (e) {
    console.error('Error importing calendar as tasks', e);
    return [];
  }
}

// Find free time slots in a day
export function findFreeTimeSlots(
  events: CalendarEvent[],
  date: Date,
  minDuration: number = 30, // minimum slot duration in minutes
  workingHours: { start: number; end: number } = { start: 0, end: 24 } // Full day by default
): TimeSlot[] {
  const freeSlots: TimeSlot[] = [];
  
  // Set up working day boundaries
  const dayStart = new Date(date);
  dayStart.setHours(workingHours.start, 0, 0, 0);
  
  const dayEnd = new Date(date);
  dayEnd.setHours(workingHours.end, 0, 0, 0);

  // Sort events by start time
  const sortedEvents = events
    .map(event => ({
      start: new Date(event.start),
      end: new Date(event.end)
    }))
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  let currentTime = dayStart;

  // Find gaps between events
  for (const event of sortedEvents) {
    if (event.start > currentTime) {
      const gapDuration = (event.start.getTime() - currentTime.getTime()) / (1000 * 60);
      
      if (gapDuration >= minDuration) {
        freeSlots.push({
          start: new Date(currentTime),
          end: new Date(event.start),
          duration: gapDuration
        });
      }
    }
    
    // Move current time to end of this event
    if (event.end > currentTime) {
      currentTime = new Date(event.end);
    }
  }

  // Check for free time after last event
  if (currentTime < dayEnd) {
    const remainingDuration = (dayEnd.getTime() - currentTime.getTime()) / (1000 * 60);
    
    if (remainingDuration >= minDuration) {
      freeSlots.push({
        start: new Date(currentTime),
        end: new Date(dayEnd),
        duration: remainingDuration
      });
    }
  }

  return freeSlots;
}

// Find the best time slot for a task
export function findBestTimeSlot(
  freeSlots: TimeSlot[],
  preferredTime?: 'morning' | 'afternoon' | 'evening',
  duration: number = 60 // task duration in minutes
): TimeSlot | null {
  // Filter slots that can fit the task at all
  const suitableSlots = freeSlots.filter(slot => slot.duration >= duration);
  if (suitableSlots.length === 0) return null;

  // Define preference windows on the same day as the slot
  const timeRanges = {
    morning: { start: 6, end: 12 },
    afternoon: { start: 12, end: 17 },
    evening: { start: 17, end: 23 }
  } as const;

  const clampToDuration = (slot: TimeSlot, start: Date): TimeSlot => {
    const end = new Date(start.getTime() + duration * 60 * 1000);
    return { start, end, duration };
  };

  // Try to place the block within a preferred window
  if (preferredTime) {
    const range = timeRanges[preferredTime];
    for (const slot of suitableSlots) {
      const windowStart = new Date(slot.start);
      windowStart.setHours(range.start, 0, 0, 0);
      const windowEnd = new Date(slot.start);
      windowEnd.setHours(range.end, 0, 0, 0);

      // Candidate start is the later of slot.start and windowStart
      const candidateStart = new Date(Math.max(slot.start.getTime(), windowStart.getTime()));
      const latestEnd = new Date(Math.min(slot.end.getTime(), windowEnd.getTime()));
      if (candidateStart.getTime() + duration * 60 * 1000 <= latestEnd.getTime()) {
        return clampToDuration(slot, candidateStart);
      }
    }
  }

  // Fallback: take earliest slot and clamp to requested duration
  const first = suitableSlots[0];
  return clampToDuration(first, new Date(first.start));
}

// Format time slot for display
export function formatTimeSlot(slot: TimeSlot): string {
  const startTime = slot.start.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  });
  
  const endTime = slot.end.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  });

  return `${startTime} - ${endTime}`;
}

// Parse "find time" commands
export function parseTimePreference(text: string): {
  duration?: number;
  preference?: 'morning' | 'afternoon' | 'evening';
  date?: Date;
  window?: { start?: Date; end?: Date };
} {
  const lowerText = text.toLowerCase();
  const result: any = {};

  // Detect time preference
  if (lowerText.includes('morning')) {
    result.preference = 'morning';
  } else if (lowerText.includes('afternoon')) {
    result.preference = 'afternoon';
  } else if (lowerText.includes('evening') || lowerText.includes('tonight')) {
    result.preference = 'evening';
  }

  // Detect duration (in minutes or hours)
  const hourMatch = lowerText.match(/(\d+)\s*hour/);
  if (hourMatch) {
    result.duration = parseInt(hourMatch[1]) * 60;
  }

  const minuteMatch = lowerText.match(/(\d+)\s*minute/);
  if (minuteMatch) {
    result.duration = parseInt(minuteMatch[1]);
  }

  // Detect optional time window like "between 2:00 and 4:00 p.m."
  const windowMatch = text.match(/between\s+([0-9]{1,2}(:[0-9]{2})?\s*(am|pm)?)\s+and\s+([0-9]{1,2}(:[0-9]{2})?\s*(am|pm)?)/i);
  if (windowMatch) {
    const parseClock = (s: string): { h: number; m: number; ampm?: string } => {
      const m = s.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
      const h = m && m[1] ? parseInt(m[1]) : 0;
      const mi = m && m[2] ? parseInt(m[2]) : 0;
      const ap = m && m[3] ? m[3].toLowerCase() : undefined;
      return { h, m: mi, ampm: ap };
    };
    const startClock = parseClock(windowMatch[1]);
    const endClock = parseClock(windowMatch[4]);
    const anchor = new Date();
    const start = new Date(anchor);
    let sh = startClock.h;
    if (startClock.ampm === 'pm' && sh !== 12) sh += 12;
    if (startClock.ampm === 'am' && sh === 12) sh = 0;
    start.setHours(sh, startClock.m, 0, 0);
    const end = new Date(anchor);
    let eh = endClock.h;
    if (endClock.ampm === 'pm' && eh !== 12) eh += 12;
    if (endClock.ampm === 'am' && eh === 12) eh = 0;
    end.setHours(eh, endClock.m, 0, 0);
    result.window = { start, end };
  }

  // Detect date
  if (lowerText.includes('tomorrow')) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    result.date = tomorrow;
  } else if (lowerText.includes('today')) {
    result.date = new Date();
  }

  return result;
}
