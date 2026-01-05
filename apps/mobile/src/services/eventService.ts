import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';
import { CalendarEvent } from '../types/events';

// ============================================================
// EVENT SERVICE - API + Cache
// ============================================================

const CACHE_KEY_PREFIX = 'events_cache_';

function getCacheKey(userId: string): string {
    return `${CACHE_KEY_PREFIX}${userId}`;
}

// ============================================================
// API FUNCTIONS
// ============================================================

export interface CreateEventData {
    title: string;
    description?: string;
    startAt: string;
    endAt: string;
    themeId?: string;
    colorHex?: string;
    recurrenceType?: 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
    recurrenceEndAt?: string;
}

export interface UpdateEventData extends Partial<CreateEventData> {
    id: string;
}

/**
 * Get events for a date range (overlap query)
 */
export async function getEvents(from: string, to: string): Promise<any[]> {
    try {
        const { data } = await api.get('/events', {
            params: { from, to }
        });
        return data;
    } catch (error) {
        console.error('[EventService] Error fetching events:', error);
        throw error;
    }
}

/**
 * Get all events for the user (no date filter)
 */
export async function getAllEvents(): Promise<any[]> {
    try {
        const { data } = await api.get('/events');
        return data;
    } catch (error) {
        console.error('[EventService] Error fetching all events:', error);
        throw error;
    }
}

/**
 * Get event feed from followed users
 */
export interface FeedEvent {
    id: string;
    title: string;
    description?: string;
    startAt: string;
    endAt?: string;
    colorHex?: string;
    themeId?: string;
    createdAt: string;
    owner: {
        id: string;
        username: string;
        avatarUrl?: string;
    };
}

export interface EventFeedResponse {
    items: FeedEvent[];
    nextCursor: string | null;
}

export async function getEventFeed(cursor?: string, limit = 10): Promise<EventFeedResponse> {
    try {
        const { data } = await api.get('/feed/events', {
            params: { cursor, limit }
        });
        return data;
    } catch (error) {
        console.error('[EventService] Error fetching event feed:', error);
        throw error;
    }
}

/**
 * Create a new event
 */
export async function createEvent(eventData: CreateEventData): Promise<any> {
    try {
        const { data } = await api.post('/events', eventData);
        return data;
    } catch (error) {
        console.error('[EventService] Error creating event:', error);
        throw error;
    }
}

/**
 * Update an existing event
 */
export async function updateEvent(id: string, eventData: Partial<CreateEventData>): Promise<any> {
    try {
        const { data } = await api.put(`/events/${id}`, eventData);
        return data;
    } catch (error) {
        console.error('[EventService] Error updating event:', error);
        throw error;
    }
}

/**
 * Delete an event (use deleteAll=true to delete all recurring instances)
 */
export async function deleteEvent(id: string, deleteAll = false): Promise<void> {
    try {
        await api.delete(`/events/${id}`, { params: deleteAll ? { deleteAll: 'true' } : {} });
    } catch (error) {
        console.error('[EventService] Error deleting event:', error);
        throw error;
    }
}

// ============================================================
// CACHE FUNCTIONS
// ============================================================

/**
 * Get cached events for a user
 */
export async function getCachedEvents(userId: string): Promise<CalendarEvent[]> {
    try {
        const cacheKey = getCacheKey(userId);
        const json = await AsyncStorage.getItem(cacheKey);
        if (!json) return [];
        return JSON.parse(json) as CalendarEvent[];
    } catch (error) {
        console.error('[EventService] Error reading cache:', error);
        return [];
    }
}

/**
 * Save events to cache for a user
 */
export async function setCachedEvents(userId: string, events: CalendarEvent[]): Promise<void> {
    try {
        const cacheKey = getCacheKey(userId);
        await AsyncStorage.setItem(cacheKey, JSON.stringify(events));
    } catch (error) {
        console.error('[EventService] Error writing cache:', error);
    }
}

/**
 * Clear cached events for a user
 */
export async function clearCachedEvents(userId: string): Promise<void> {
    try {
        const cacheKey = getCacheKey(userId);
        await AsyncStorage.removeItem(cacheKey);
    } catch (error) {
        console.error('[EventService] Error clearing cache:', error);
    }
}

// ============================================================
// HELPERS - Convert API Event to CalendarEvent
// ============================================================

/**
 * Convert backend event to CalendarEvent format used by the timeline
 */
export function apiEventToCalendarEvent(apiEvent: any): CalendarEvent {
    const startDate = new Date(apiEvent.startAt);
    const endDate = apiEvent.endAt ? new Date(apiEvent.endAt) : new Date(startDate.getTime() + 3600000); // Default 1h

    return {
        id: apiEvent.id,
        userId: apiEvent.ownerId,
        title: apiEvent.title,
        description: apiEvent.description || '',
        startAt: apiEvent.startAt,
        endAt: apiEvent.endAt || new Date(startDate.getTime() + 3600000).toISOString(),
        theme: apiEvent.themeId || 'Travail',
        color: apiEvent.colorHex || '#5B8DEF',
        themeId: apiEvent.themeId,
        colorHex: apiEvent.colorHex,
        dayIndex: (startDate.getDay() + 6) % 7, // Convert Sunday=0 to Monday=0
    };
}
