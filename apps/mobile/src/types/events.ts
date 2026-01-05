export type EventTheme = "Travail" | "Sport" | "Social" | "Famille" | "Santé" | "Autre" | string;
export type RecurrenceType = 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';

export interface CalendarEvent {
    id?: string; // Optional for draft (unsaved) events
    userId: string;
    title: string;
    description?: string;
    startAt: string; // ISO String or "HH:MM" if simple
    endAt: string;   // ISO String or "HH:MM"
    theme: EventTheme;
    color: string;
    dayIndex: number; // 0-6 (Mon-Sun)
    // New theme system
    themeId?: string;   // Reference to UserTheme
    colorHex?: string;  // Direct color fallback
    // Recurrence
    recurrenceType?: RecurrenceType;
    recurrenceEndAt?: string;
}
