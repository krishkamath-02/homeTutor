import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import useAuthStore from './authStore';

export type CalendarEventType = 'exam' | 'test_prep' | 'study_block';
export type ReminderRule = '1_day_before' | '2_days_before' | 'same_morning';

export interface CalendarEvent {
    id: string;
    parentId: string;
    childId?: string | null;
    childName?: string;
    title: string;
    type: CalendarEventType;
    subject: string;
    date: string; // YYYY-MM-DD
    startTime?: string; // HH:MM (24h)
    endTime?: string;   // HH:MM (24h)
    description?: string;
    isCompleted?: boolean;
    testId?: string;
    reminderRule?: ReminderRule;
    isDictationOrTest?: boolean;
    createdAt?: string;
}

export const INITIAL_SAMPLE_EVENTS: CalendarEvent[] = [];

interface CalendarState {
    events: CalendarEvent[];
    isLoading: boolean;
    selectedChildFilter: string | 'all';
    setSelectedChildFilter: (childId: string | 'all') => void;
    fetchEvents: () => Promise<void>;
    addEvent: (eventData: Omit<CalendarEvent, 'id'>) => Promise<CalendarEvent>;
    updateEvent: (id: string, updates: Partial<CalendarEvent>) => Promise<void>;
    deleteEvent: (id: string) => Promise<void>;
    toggleComplete: (id: string) => Promise<void>;
}

const STORAGE_KEY = 'hometutor_calendar_events_v2';

const getStoredEvents = (): CalendarEvent[] => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            // Filter out any legacy superuser sample demo events
            if (Array.isArray(parsed)) {
                return parsed.filter(e => !e.id?.startsWith('evt-exam-') && !e.id?.startsWith('evt-test-') && !e.id?.startsWith('evt-study-'));
            }
        }
    } catch {}
    return [];
};

const saveStoredEvents = (events: CalendarEvent[]) => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
    } catch {}
};

export const useCalendarStore = create<CalendarState>((set, get) => ({
    events: getStoredEvents(),
    isLoading: false,
    selectedChildFilter: 'all',

    setSelectedChildFilter: (childId: string | 'all') => {
        set({ selectedChildFilter: childId });
    },

    fetchEvents: async () => {
        const user = useAuthStore.getState().user;
        if (!user) return;

        set({ isLoading: true });

        try {
            let query = supabase.from('calendar_events').select('*');

            if (user.role === 'parent') {
                query = query.eq('parent_id', user.id);
            } else if (user.role === 'student') {
                if (user.parentId) {
                    query = query.or(`child_id.eq.${user.id},parent_id.eq.${user.parentId}`);
                } else {
                    query = query.eq('child_id', user.id);
                }
            }

            const { data, error } = await query.order('date', { ascending: true });

            if (!error && data && data.length > 0) {
                const mapped: CalendarEvent[] = data.map((d: any) => ({
                    id: d.id,
                    parentId: d.parent_id,
                    childId: d.child_id,
                    title: d.title,
                    type: d.type,
                    subject: d.subject,
                    date: d.date,
                    startTime: d.start_time,
                    endTime: d.end_time,
                    description: d.description,
                    isCompleted: d.is_completed,
                    testId: d.test_id,
                    createdAt: d.created_at
                }));

                set({ events: mapped });
                saveStoredEvents(mapped);
            } else {
                // If remote DB table isn't migrated or has no records, fall back to local stored/sample events
                const current = getStoredEvents();
                set({ events: current });
            }
        } catch (err) {
            console.warn('Calendar fetch notice (using local store):', err);
            set({ events: getStoredEvents() });
        } finally {
            set({ isLoading: false });
        }
    },

    addEvent: async (eventData: Omit<CalendarEvent, 'id'>) => {
        const newId = `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const newEvent: CalendarEvent = {
            ...eventData,
            id: newId,
            createdAt: new Date().toISOString()
        };

        // Update local state immediately
        set(state => {
            const updated = [...state.events, newEvent];
            saveStoredEvents(updated);
            return { events: updated };
        });

        // Attempt remote database insertion
        try {
            const { data, error } = await supabase.from('calendar_events').insert([{
                parent_id: newEvent.parentId,
                child_id: newEvent.childId || null,
                title: newEvent.title,
                type: newEvent.type,
                subject: newEvent.subject,
                date: newEvent.date,
                start_time: newEvent.startTime || null,
                end_time: newEvent.endTime || null,
                description: newEvent.description || null,
                is_completed: false,
                test_id: newEvent.testId || null
            }]).select().single();

            if (!error && data?.id) {
                // Sync real Supabase ID if returned
                set(state => {
                    const synced = state.events.map(e => e.id === newId ? { ...e, id: data.id } : e);
                    saveStoredEvents(synced);
                    return { events: synced };
                });
                return { ...newEvent, id: data.id };
            }
        } catch (err) {
            console.warn('Supabase calendar event save notice (saved locally):', err);
        }

        return newEvent;
    },

    updateEvent: async (id: string, updates: Partial<CalendarEvent>) => {
        // Update local state
        set(state => {
            const updated = state.events.map(e => e.id === id ? { ...e, ...updates } : e);
            saveStoredEvents(updated);
            return { events: updated };
        });

        // Attempt database update
        try {
            const dbUpdates: any = {};
            if (updates.title !== undefined) dbUpdates.title = updates.title;
            if (updates.type !== undefined) dbUpdates.type = updates.type;
            if (updates.subject !== undefined) dbUpdates.subject = updates.subject;
            if (updates.date !== undefined) dbUpdates.date = updates.date;
            if (updates.startTime !== undefined) dbUpdates.start_time = updates.startTime;
            if (updates.endTime !== undefined) dbUpdates.end_time = updates.endTime;
            if (updates.description !== undefined) dbUpdates.description = updates.description;
            if (updates.childId !== undefined) dbUpdates.child_id = updates.childId;
            if (updates.isCompleted !== undefined) dbUpdates.is_completed = updates.isCompleted;

            await supabase.from('calendar_events').update(dbUpdates).eq('id', id);
        } catch (err) {
            console.warn('Calendar update DB notice:', err);
        }
    },

    deleteEvent: async (id: string) => {
        set(state => {
            const updated = state.events.filter(e => e.id !== id);
            saveStoredEvents(updated);
            return { events: updated };
        });

        try {
            await supabase.from('calendar_events').delete().eq('id', id);
        } catch (err) {
            console.warn('Calendar delete DB notice:', err);
        }
    },

    toggleComplete: async (id: string) => {
        const event = get().events.find(e => e.id === id);
        if (!event) return;
        await get().updateEvent(id, { isCompleted: !event.isCompleted });
    }
}));

export default useCalendarStore;

