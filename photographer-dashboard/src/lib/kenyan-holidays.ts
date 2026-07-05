/**
 * Kenyan Public Holidays and Observances
 * Updated for 2024-2026
 */

export interface KenyanHoliday {
  name: string;
  date: string; // MM-DD format
  type: 'public' | 'observance' | 'religious';
  description?: string;
}

export const KENYAN_HOLIDAYS: KenyanHoliday[] = [
  // Public Holidays
  {
    name: "New Year's Day",
    date: "01-01",
    type: "public",
    description: "January 1st - National holiday"
  },
  {
    name: "Jamhuri Day",
    date: "12-12",
    type: "public",
    description: "December 12th - National Day (Independence Day)"
  },
  {
    name: "Madaraka Day",
    date: "06-01",
    type: "public",
    description: "June 1st - Celebrates internal self-rule"
  },
  {
    name: "Mashujaa Day",
    date: "10-20",
    type: "public",
    description: "October 20th - Heroes' Day"
  },
  {
    name: "Utamaduni Day",
    date: "10-10",
    type: "public",
    description: "October 10th - Cultural Diversity Day"
  },
  {
    name: "Labour Day",
    date: "05-01",
    type: "public",
    description: "May 1st - International Workers' Day"
  },
  {
    name: "Easter Friday",
    date: "variable",
    type: "religious",
    description: "Good Friday - Public holiday"
  },
  {
    name: "Easter Monday",
    date: "variable",
    type: "religious",
    description: "Easter Monday - Public holiday"
  },
  {
    name: "Christmas Day",
    date: "12-25",
    type: "public",
    description: "December 25th - Christmas Day"
  },
  {
    name: "Boxing Day",
    date: "12-26",
    type: "public",
    description: "December 26th - Day after Christmas"
  },
  // Religious Observances
  {
    name: "Eid al-Fitr",
    date: "variable",
    type: "religious",
    description: "End of Ramadan - Date varies"
  },
  {
    name: "Eid al-Adha",
    date: "variable",
    type: "religious",
    description: "Festival of Sacrifice - Date varies"
  },
  // Observances
  {
    name: "Africa Cup of Nations",
    date: "02-01",
    type: "observance",
    description: "Continental football championship"
  },
  {
    name: "Wangari Maathai Day",
    date: "04-01",
    type: "observance",
    description: "Environmental activist day"
  },
];

/**
 * Calculate Easter date for a given year (Western Christianity)
 */
export function getEasterDate(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  
  return new Date(year, month - 1, day);
}

/**
 * Get Eid al-Fitr date (approximate)
 */
export function getEidAlFitrDate(year: number): Date {
  const approxDates: Record<number, Date> = {
    2024: new Date(2024, 3, 10),
    2025: new Date(2025, 2, 30),
    2026: new Date(2026, 2, 20),
    2027: new Date(2027, 2, 9),
  };
  return approxDates[year] || new Date(year, 2, 20);
}

/**
 * Get Eid al-Adha date (approximate)
 */
export function getEidAlAdhaDate(year: number): Date {
  const approxDates: Record<number, Date> = {
    2024: new Date(2024, 5, 17),
    2025: new Date(2025, 5, 6),
    2026: new Date(2026, 4, 26),
    2027: new Date(2027, 4, 16),
  };
  return approxDates[year] || new Date(year, 4, 26);
}

/**
 * Get all holidays for a specific year (including variable dates)
 */
export function getHolidaysForYear(year: number): Array<{
  name: string;
  date: Date;
  type: string;
  description?: string;
}> {
  const holidays: Array<{
    name: string;
    date: Date;
    type: string;
    description?: string;
  }> = [];
  
  // Add fixed-date holidays
  KENYAN_HOLIDAYS.forEach(holiday => {
    if (holiday.date !== "variable") {
      const [month, day] = holiday.date.split("-").map(Number);
      holidays.push({
        name: holiday.name,
        date: new Date(year, month - 1, day),
        type: holiday.type,
        description: holiday.description,
      });
    }
  });
  
  // Add variable-date holidays
  const easter = getEasterDate(year);
  const goodFriday = new Date(easter);
  goodFriday.setDate(goodFriday.getDate() - 2);
  const easterMonday = new Date(easter);
  easterMonday.setDate(easterMonday.getDate() + 1);
  
  holidays.push({
    name: "Easter Friday",
    date: goodFriday,
    type: "religious",
    description: "Good Friday - Public holiday",
  });
  
  holidays.push({
    name: "Easter Monday",
    date: easterMonday,
    type: "religious",
    description: "Easter Monday - Public holiday",
  });
  
  // Add Eid dates
  holidays.push({
    name: "Eid al-Fitr",
    date: getEidAlFitrDate(year),
    type: "religious",
    description: "End of Ramadan - Date varies",
  });
  
  holidays.push({
    name: "Eid al-Adha",
    date: getEidAlAdhaDate(year),
    type: "religious",
    description: "Festival of Sacrifice - Date varies",
  });
  
  return holidays.sort((a, b) => a.date.getTime() - b.date.getTime());
}

/**
 * Check if a specific date is a holiday
 */
export function isHoliday(date: Date): {
  isHoliday: boolean;
  holiday?: KenyanHoliday;
} {
  const year = date.getFullYear();
  const holidays = getHolidaysForYear(year);
  
  const found = holidays.find(h => 
    h.date.getDate() === date.getDate() &&
    h.date.getMonth() === date.getMonth()
  );
  
  if (found) {
    return {
      isHoliday: true,
      holiday: KENYAN_HOLIDAYS.find(h => h.name === found.name),
    };
  }
  
  return { isHoliday: false };
}

/**
 * Get upcoming holidays from a given date
 */
export function getUpcomingHolidays(fromDate: Date = new Date(), count: number = 5): Array<{
  name: string;
  date: Date;
  daysUntil: number;
  type: string;
}> {
  const currentYear = fromDate.getFullYear();
  const nextYear = currentYear + 1;
  
  const allHolidays = [
    ...getHolidaysForYear(currentYear),
    ...getHolidaysForYear(nextYear),
  ];
  
  const upcoming = allHolidays
    .filter(h => h.date >= fromDate)
    .map(h => ({
      ...h,
      daysUntil: Math.ceil((h.date.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)),
    }))
    .sort((a, b) => a.daysUntil - b.daysUntil)
    .slice(0, count);
  
  return upcoming;
}

/**
 * Format holiday date for display
 */
export function formatHolidayDate(date: Date): string {
  return date.toLocaleDateString('en-KE', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Get holiday color based on type
 */
export function getHolidayColor(type: string): string {
  switch (type) {
    case 'public':
      return '#D4AF37'; // Gold
    case 'religious':
      return '#6C9AED'; // Blue
    case 'observance':
      return '#34C759'; // Green
    default:
      return '#8E8E93'; // Gray
  }
}
