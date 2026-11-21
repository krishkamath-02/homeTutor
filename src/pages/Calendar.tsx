import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    Calendar as CalendarIcon, Clock, Plus, ChevronLeft, ChevronRight, 
    GraduationCap, BookOpen, CheckCircle2, Circle, Trash2, X, 
    User, Edit2, Play
} from 'lucide-react';
import useAuthStore from '../store/authStore';
import useAppStore from '../store/appStore';
import useCalendarStore, { type CalendarEvent, type CalendarEventType, type ReminderRule } from '../store/calendarStore';

type ViewMode = 'day' | 'week' | 'month';

const SUBJECT_OPTIONS = [
    'Math', 'Science', 'English', 'Hindi', 'Social Studies', 
    'History', 'Geography', 'Physics', 'Chemistry', 'Biology', 
    'Computer Science', 'Economics', 'General Studies'
];

export const CalendarPage = () => {
    const user = useAuthStore((state) => state.user);
    const navigate = useNavigate();

    const { 
        events, 
        fetchEvents, 
        addEvent, 
        updateEvent, 
        deleteEvent, 
        toggleComplete,
        selectedChildFilter,
        setSelectedChildFilter 
    } = useCalendarStore();

    const childrenList = useAppStore((state) => state.childrenList);
    const tests = useAppStore((state) => state.tests);
    const fetchChildren = useAppStore((state) => state.fetchChildren);
    const fetchTests = useAppStore((state) => state.fetchTests);

    const isParent = user?.role === 'parent';

    // State for View and Date Navigation
    const [viewMode, setViewMode] = useState<ViewMode>('week');
    const [currentDate, setCurrentDate] = useState<Date>(new Date());

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
    const [selectedEventForView, setSelectedEventForView] = useState<CalendarEvent | null>(null);

    // Form state for Add/Edit
    const [formTitle, setFormTitle] = useState('');
    const [formType, setFormType] = useState<CalendarEventType>('study_block');
    const [formSubject, setFormSubject] = useState('Math');
    const [formChildId, setFormChildId] = useState<string>('');
    const [formDate, setFormDate] = useState('');
    const [formStartTime, setFormStartTime] = useState('16:00');
    const [formEndTime, setFormEndTime] = useState('17:15');
    const [formDescription, setFormDescription] = useState('');
    const [formTestId, setFormTestId] = useState<string>('');
    const [formReminderRule, setFormReminderRule] = useState<ReminderRule>('1_day_before');

    useEffect(() => {
        fetchEvents();
        if (isParent) {
            fetchChildren();
        }
        fetchTests();
    }, [fetchEvents, fetchChildren, fetchTests, isParent]);

    // Helpers for Date Calculations
    const formatDateKey = (d: Date): string => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const isSameDay = (d1: Date, d2: Date): boolean => {
        return (
            d1.getFullYear() === d2.getFullYear() &&
            d1.getMonth() === d2.getMonth() &&
            d1.getDate() === d2.getDate()
        );
    };

    const isToday = (d: Date): boolean => isSameDay(d, new Date());

    // Filter events based on role and child filter
    const visibleEvents = useMemo(() => {
        return events.filter(evt => {
            if (isParent) {
                if (selectedChildFilter === 'all') return true;
                return evt.childId === selectedChildFilter || !evt.childId;
            } else {
                // Student view: show events assigned to this student or unassigned (general family schedule)
                return evt.childId === user?.id || !evt.childId || evt.childId === 'superuser-student-001';
            }
        });
    }, [events, isParent, selectedChildFilter, user?.id]);

    // Navigation actions
    const handlePrev = () => {
        const newD = new Date(currentDate);
        if (viewMode === 'day') {
            newD.setDate(newD.getDate() - 1);
        } else if (viewMode === 'week') {
            newD.setDate(newD.getDate() - 7);
        } else {
            newD.setMonth(newD.getMonth() - 1);
        }
        setCurrentDate(newD);
    };

    const handleNext = () => {
        const newD = new Date(currentDate);
        if (viewMode === 'day') {
            newD.setDate(newD.getDate() + 1);
        } else if (viewMode === 'week') {
            newD.setDate(newD.getDate() + 7);
        } else {
            newD.setMonth(newD.getMonth() + 1);
        }
        setCurrentDate(newD);
    };

    const handleToday = () => {
        setCurrentDate(new Date());
    };

    // Calculate Week Days (Monday to Sunday)
    const weekDays = useMemo(() => {
        const curr = new Date(currentDate);
        const day = curr.getDay(); // 0 is Sunday
        const diff = curr.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
        const monday = new Date(curr.setDate(diff));

        const days: Date[] = [];
        for (let i = 0; i < 7; i++) {
            const nextDay = new Date(monday);
            nextDay.setDate(monday.getDate() + i);
            days.push(nextDay);
        }
        return days;
    }, [currentDate]);

    // Calculate Month Days grid
    const monthGrid = useMemo(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();

        const firstDayOfMonth = new Date(year, month, 1);
        const lastDayOfMonth = new Date(year, month + 1, 0);

        const daysInMonth = lastDayOfMonth.getDate();
        let startingDayOfWeek = firstDayOfMonth.getDay(); // 0 is Sun, 1 is Mon
        if (startingDayOfWeek === 0) startingDayOfWeek = 7; // Convert Sun to 7

        const grid: { date: Date; isCurrentMonth: boolean }[] = [];

        // Previous month padding
        const prevMonthLastDay = new Date(year, month, 0).getDate();
        for (let i = startingDayOfWeek - 1; i > 0; i--) {
            grid.push({
                date: new Date(year, month - 1, prevMonthLastDay - i + 1),
                isCurrentMonth: false
            });
        }

        // Current month days
        for (let i = 1; i <= daysInMonth; i++) {
            grid.push({
                date: new Date(year, month, i),
                isCurrentMonth: true
            });
        }

        // Next month padding to complete 35 or 42 cells
        const remaining = 35 - grid.length > 0 ? 35 - grid.length : 42 - grid.length;
        for (let i = 1; i <= remaining; i++) {
            grid.push({
                date: new Date(year, month + 1, i),
                isCurrentMonth: false
            });
        }

        return grid;
    }, [currentDate]);

    // Format current date label
    const headerTitle = useMemo(() => {
        if (viewMode === 'day') {
            return currentDate.toLocaleDateString('en-US', { 
                weekday: 'long', 
                month: 'short', 
                day: 'numeric', 
                year: 'numeric' 
            });
        }
        if (viewMode === 'week') {
            const start = weekDays[0];
            const end = weekDays[6];
            return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
        }
        return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }, [viewMode, currentDate, weekDays]);

    // Open Modal for Create
    const handleOpenCreateModal = (defaultDateStr?: string) => {
        setEditingEvent(null);
        setFormTitle('');
        setFormType('study_block');
        setFormSubject(SUBJECT_OPTIONS[0]);
        setFormChildId(childrenList[0]?.id || 'superuser-student-001');
        setFormDate(defaultDateStr || formatDateKey(currentDate));
        setFormStartTime('16:00');
        setFormEndTime('17:15');
        setFormDescription('');
        setFormTestId('');
        setFormReminderRule('1_day_before');
        setIsModalOpen(true);
    };

    // Open Modal for Edit (Parent only)
    const handleOpenEditModal = (event: CalendarEvent) => {
        setEditingEvent(event);
        setFormTitle(event.title);
        setFormType(event.type);
        setFormSubject(event.subject);
        setFormChildId(event.childId || childrenList[0]?.id || '');
        setFormDate(event.date);
        setFormStartTime(event.startTime || '16:00');
        setFormEndTime(event.endTime || '17:00');
        setFormDescription(event.description || '');
        setFormTestId(event.testId || '');
        setFormReminderRule(event.reminderRule || '1_day_before');
        setSelectedEventForView(null);
        setIsModalOpen(true);
    };

    const handleSaveEvent = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !formTitle.trim()) return;

        const childObj = childrenList.find(c => c.id === formChildId);
        const resolvedChildName = childObj ? childObj.name : 'All Children';

        if (editingEvent) {
            await updateEvent(editingEvent.id, {
                title: formTitle.trim(),
                type: formType,
                subject: formSubject,
                childId: formChildId || null,
                childName: resolvedChildName,
                date: formDate,
                startTime: formStartTime,
                endTime: formEndTime,
                description: formDescription.trim(),
                reminderRule: formReminderRule,
                testId: formType === 'test_prep' ? (formTestId || undefined) : undefined
            });
        } else {
            await addEvent({
                parentId: user.id,
                childId: formChildId || null,
                childName: resolvedChildName,
                title: formTitle.trim(),
                type: formType,
                subject: formSubject,
                date: formDate,
                startTime: formStartTime,
                endTime: formEndTime,
                description: formDescription.trim(),
                reminderRule: formReminderRule,
                isCompleted: false,
                testId: formType === 'test_prep' ? (formTestId || undefined) : undefined
            });
        }

        setIsModalOpen(false);
    };

    const handleDeleteEvent = async (id: string) => {
        if (window.confirm('Are you sure you want to remove this schedule event?')) {
            await deleteEvent(id);
            setSelectedEventForView(null);
            setIsModalOpen(false);
        }
    };

    // Event styling helper
    const getEventStyle = (type: CalendarEventType) => {
        switch (type) {
            case 'exam':
                return {
                    bg: 'rgba(239, 68, 68, 0.08)',
                    border: '#EF4444',
                    text: '#B91C1C',
                    icon: <GraduationCap size={14} color="#EF4444" />,
                    badge: 'School Exam'
                };
            case 'test_prep':
                return {
                    bg: 'rgba(79, 70, 229, 0.08)',
                    border: '#4F46E5',
                    text: '#4338CA',
                    icon: <BookOpen size={14} color="#4F46E5" />,
                    badge: 'Test Prep'
                };
            case 'study_block':
            default:
                return {
                    bg: 'rgba(16, 185, 129, 0.08)',
                    border: '#10B981',
                    text: '#047857',
                    icon: <Clock size={14} color="#10B981" />,
                    badge: 'Study Block'
                };
        }
    };

    return (
        <div className="container animate-fade-in" style={{ paddingBottom: '4rem' }}>
            {/* Top Header Card */}
            <div className="card" style={{ marginBottom: '1.5rem', padding: '1.75rem 2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.25rem' }}>
                            <div style={{ 
                                width: '38px', height: '38px', borderRadius: 'var(--radius-sm)', 
                                background: 'linear-gradient(135deg, var(--primary) 0%, #818cf8 100%)', 
                                display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' 
                            }}>
                                <CalendarIcon size={20} />
                            </div>
                            <h1 style={{ fontSize: '1.75rem', margin: 0 }}>Study Schedule & Exam Planner</h1>
                        </div>
                        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                            {isParent 
                                ? 'Schedule school exams, assign preparatory test drills, and block dedicated focus study hours for your kids.' 
                                : 'Your personalized study timetable, upcoming exams, and scheduled practice sessions.'}
                        </p>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                        {!isParent && (
                            <span style={{ 
                                padding: '0.4rem 0.85rem', 
                                background: 'rgba(79, 70, 229, 0.08)', 
                                color: 'var(--primary)', 
                                borderRadius: '2rem', 
                                fontSize: '0.8rem', 
                                fontWeight: 600,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.4rem'
                            }}>
                                👀 Student View (Read-Only)
                            </span>
                        )}

                        {isParent && (
                            <>
                                {childrenList.length > 0 && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <User size={15} color="var(--text-muted)" />
                                        <select
                                            className="input"
                                            style={{ padding: '0.45rem 0.85rem', fontSize: '0.85rem', width: 'auto' }}
                                            value={selectedChildFilter}
                                            onChange={(e) => setSelectedChildFilter(e.target.value)}
                                        >
                                            <option value="all">All Children</option>
                                            {childrenList.map(c => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                <button
                                    onClick={() => handleOpenCreateModal()}
                                    className="btn btn-primary hover-lift"
                                    style={{ padding: '0.55rem 1.15rem', fontSize: '0.9rem' }}
                                >
                                    <Plus size={16} /> Add Schedule / Exam
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Subheader Toolbar: Navigation & View Mode */}
                <div style={{ 
                    marginTop: '1.5rem', 
                    paddingTop: '1.25rem', 
                    borderTop: '1px solid var(--border)', 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    flexWrap: 'wrap', 
                    gap: '1rem' 
                }}>
                    {/* Navigation Controls */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--surface)' }}>
                            <button
                                onClick={handlePrev}
                                style={{ padding: '0.4rem 0.65rem', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-main)' }}
                                title="Previous"
                            >
                                <ChevronLeft size={18} />
                            </button>
                            <button
                                onClick={handleToday}
                                style={{ 
                                    padding: '0.4rem 0.85rem', 
                                    borderLeft: '1px solid var(--border)', 
                                    borderRight: '1px solid var(--border)', 
                                    borderTop: 'none', 
                                    borderBottom: 'none',
                                    background: 'transparent', 
                                    cursor: 'pointer', 
                                    fontWeight: 600, 
                                    fontSize: '0.82rem',
                                    color: 'var(--text-main)' 
                                }}
                            >
                                Today
                            </button>
                            <button
                                onClick={handleNext}
                                style={{ padding: '0.4rem 0.65rem', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-main)' }}
                                title="Next"
                            >
                                <ChevronRight size={18} />
                            </button>
                        </div>

                        <span style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)', minWidth: '180px' }}>
                            {headerTitle}
                        </span>
                    </div>

                    {/* View Mode Switcher */}
                    <div style={{ display: 'flex', background: 'var(--surface-hover)', padding: '0.2rem', borderRadius: 'var(--radius-sm)' }}>
                        <button
                            onClick={() => setViewMode('day')}
                            style={{
                                padding: '0.4rem 0.85rem',
                                border: 'none',
                                borderRadius: 'var(--radius-sm)',
                                cursor: 'pointer',
                                fontSize: '0.82rem',
                                fontWeight: viewMode === 'day' ? 600 : 500,
                                background: viewMode === 'day' ? 'white' : 'transparent',
                                color: viewMode === 'day' ? 'var(--primary)' : 'var(--text-muted)',
                                boxShadow: viewMode === 'day' ? 'var(--shadow-sm)' : 'none',
                                transition: 'var(--transition)'
                            }}
                        >
                            Day
                        </button>
                        <button
                            onClick={() => setViewMode('week')}
                            style={{
                                padding: '0.4rem 0.85rem',
                                border: 'none',
                                borderRadius: 'var(--radius-sm)',
                                cursor: 'pointer',
                                fontSize: '0.82rem',
                                fontWeight: viewMode === 'week' ? 600 : 500,
                                background: viewMode === 'week' ? 'white' : 'transparent',
                                color: viewMode === 'week' ? 'var(--primary)' : 'var(--text-muted)',
                                boxShadow: viewMode === 'week' ? 'var(--shadow-sm)' : 'none',
                                transition: 'var(--transition)'
                            }}
                        >
                            Week
                        </button>
                        <button
                            onClick={() => setViewMode('month')}
                            style={{
                                padding: '0.4rem 0.85rem',
                                border: 'none',
                                borderRadius: 'var(--radius-sm)',
                                cursor: 'pointer',
                                fontSize: '0.82rem',
                                fontWeight: viewMode === 'month' ? 600 : 500,
                                background: viewMode === 'month' ? 'white' : 'transparent',
                                color: viewMode === 'month' ? 'var(--primary)' : 'var(--text-muted)',
                                boxShadow: viewMode === 'month' ? 'var(--shadow-sm)' : 'none',
                                transition: 'var(--transition)'
                            }}
                        >
                            Month
                        </button>
                    </div>
                </div>
            </div>

            {/* ------------------------------------------------------------- */}
            {/* VIEW MODE 1: DAY VIEW */}
            {/* ------------------------------------------------------------- */}
            {viewMode === 'day' && (
                <div className="card animate-fade-in" style={{ padding: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                        <div>
                            <h2 style={{ fontSize: '1.25rem', margin: 0 }}>
                                {currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                            </h2>
                            <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                                {visibleEvents.filter(e => e.date === formatDateKey(currentDate)).length} scheduled item(s) for this day
                            </p>
                        </div>
                        {isParent && (
                            <button
                                onClick={() => handleOpenCreateModal(formatDateKey(currentDate))}
                                className="btn btn-secondary"
                                style={{ padding: '0.45rem 0.85rem', fontSize: '0.82rem' }}
                            >
                                <Plus size={14} /> Add Block For This Day
                            </button>
                        )}
                    </div>

                    {/* Day's Event List */}
                    {(() => {
                        const dayEvents = visibleEvents
                            .filter(e => e.date === formatDateKey(currentDate))
                            .sort((a, b) => (a.startTime || '00:00').localeCompare(b.startTime || '00:00'));

                        if (dayEvents.length === 0) {
                            return (
                                <div style={{ 
                                    padding: '3rem 1rem', 
                                    textAlign: 'center', 
                                    background: 'var(--surface-hover)', 
                                    borderRadius: 'var(--radius-md)',
                                    border: '1px dashed var(--border)'
                                }}>
                                    <Clock size={36} color="var(--text-muted)" style={{ margin: '0 auto 0.75rem' }} />
                                    <h3 style={{ fontSize: '1.1rem', margin: '0 0 0.35rem' }}>No events or study blocks scheduled for this day</h3>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0 0 1rem' }}>
                                        {isParent ? 'Block dedicated study time or schedule a test preparation session.' : 'Enjoy your free time or practice uncompleted drills!'}
                                    </p>
                                    {isParent && (
                                        <button
                                            onClick={() => handleOpenCreateModal(formatDateKey(currentDate))}
                                            className="btn btn-primary"
                                            style={{ padding: '0.45rem 1rem', fontSize: '0.85rem' }}
                                        >
                                            <Plus size={15} /> Block Study Time
                                        </button>
                                    )}
                                </div>
                            );
                        }

                        return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                                {dayEvents.map(evt => {
                                    const style = getEventStyle(evt.type);
                                    return (
                                        <div
                                            key={evt.id}
                                            onClick={() => setSelectedEventForView(evt)}
                                            className="hover-lift"
                                            style={{
                                                padding: '1.25rem',
                                                borderRadius: 'var(--radius-md)',
                                                background: evt.isCompleted ? 'rgba(16, 185, 129, 0.04)' : style.bg,
                                                border: `1.5px solid ${evt.isCompleted ? '#10B981' : style.border}`,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                gap: '1rem',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', flex: 1 }}>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        toggleComplete(evt.id);
                                                    }}
                                                    title={evt.isCompleted ? 'Mark as incomplete' : 'Mark as completed'}
                                                    style={{ 
                                                        background: 'transparent', 
                                                        border: 'none', 
                                                        cursor: 'pointer', 
                                                        padding: 0, 
                                                        marginTop: '0.2rem',
                                                        color: evt.isCompleted ? '#10B981' : 'var(--text-muted)' 
                                                    }}
                                                >
                                                    {evt.isCompleted ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                                                </button>

                                                <div style={{ flex: 1 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                                                        <span style={{
                                                            fontSize: '0.72rem',
                                                            fontWeight: 700,
                                                            padding: '0.15rem 0.55rem',
                                                            borderRadius: '1rem',
                                                            background: 'white',
                                                            color: style.text,
                                                            border: `1px solid ${style.border}`,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '0.3rem'
                                                        }}>
                                                            {style.icon} {style.badge}
                                                        </span>

                                                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                                                            {evt.subject}
                                                        </span>

                                                        {evt.childName && (
                                                            <span style={{ fontSize: '0.72rem', background: 'rgba(0,0,0,0.05)', padding: '0.1rem 0.45rem', borderRadius: '4px' }}>
                                                                For: {evt.childName}
                                                            </span>
                                                        )}
                                                    </div>

                                                    <h3 style={{ 
                                                        margin: 0, 
                                                        fontSize: '1.05rem', 
                                                        textDecoration: evt.isCompleted ? 'line-through' : 'none',
                                                        color: evt.isCompleted ? 'var(--text-muted)' : 'var(--text-main)'
                                                    }}>
                                                        {evt.title}
                                                    </h3>

                                                    {evt.description && (
                                                        <p style={{ margin: '0.35rem 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                                                            {evt.description}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>

                                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                                {evt.startTime && (
                                                    <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main)' }}>
                                                        {evt.startTime} {evt.endTime ? `– ${evt.endTime}` : ''}
                                                    </div>
                                                )}

                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                                                    {evt.testId && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                navigate(isParent ? '/parent/dashboard' : '/student/dashboard');
                                                            }}
                                                            className="btn btn-primary"
                                                            style={{ padding: '0.25rem 0.65rem', fontSize: '0.75rem' }}
                                                        >
                                                            <Play size={12} /> Start Test
                                                        </button>
                                                    )}

                                                    {isParent && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleOpenEditModal(evt);
                                                            }}
                                                            style={{
                                                                background: 'transparent',
                                                                border: '1px solid var(--border)',
                                                                borderRadius: 'var(--radius-sm)',
                                                                padding: '0.25rem 0.5rem',
                                                                cursor: 'pointer',
                                                                color: 'var(--text-muted)',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '0.25rem',
                                                                fontSize: '0.75rem'
                                                            }}
                                                        >
                                                            <Edit2 size={12} /> Edit
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })()}
                </div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* VIEW MODE 2: WEEK VIEW (7-Day Column Grid) */}
            {/* ------------------------------------------------------------- */}
            {viewMode === 'week' && (
                <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))', 
                    gap: '0.75rem',
                    overflowX: 'auto'
                }}>
                    {weekDays.map((dayDate) => {
                        const dateKey = formatDateKey(dayDate);
                        const dayEvents = visibleEvents
                            .filter(e => e.date === dateKey)
                            .sort((a, b) => (a.startTime || '00:00').localeCompare(b.startTime || '00:00'));
                        const isDayToday = isToday(dayDate);

                        return (
                            <div
                                key={dateKey}
                                className="card"
                                style={{
                                    padding: '0.85rem',
                                    minHeight: '420px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    background: isDayToday ? 'rgba(79, 70, 229, 0.02)' : 'var(--surface)',
                                    border: isDayToday ? '2px solid var(--primary)' : '1px solid var(--border)',
                                    borderRadius: 'var(--radius-md)'
                                }}
                            >
                                {/* Column Day Header */}
                                <div style={{ 
                                    paddingBottom: '0.65rem', 
                                    marginBottom: '0.65rem', 
                                    borderBottom: '1px solid var(--border)',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}>
                                    <div>
                                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: isDayToday ? 'var(--primary)' : 'var(--text-muted)', textTransform: 'uppercase' }}>
                                            {dayDate.toLocaleDateString('en-US', { weekday: 'short' })}
                                        </div>
                                        <div style={{ fontSize: '1.2rem', fontWeight: 700, color: isDayToday ? 'var(--primary)' : 'var(--text-main)' }}>
                                            {dayDate.getDate()}
                                        </div>
                                    </div>

                                    {isParent && (
                                        <button
                                            onClick={() => handleOpenCreateModal(dateKey)}
                                            style={{
                                                background: 'var(--surface-hover)',
                                                border: '1px solid var(--border)',
                                                borderRadius: '50%',
                                                width: '26px',
                                                height: '26px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                cursor: 'pointer',
                                                color: 'var(--text-muted)',
                                                transition: 'var(--transition)'
                                            }}
                                            title="Add schedule on this day"
                                        >
                                            <Plus size={14} />
                                        </button>
                                    )}
                                </div>

                                {/* Events in this day */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                                    {dayEvents.map(evt => {
                                        const style = getEventStyle(evt.type);
                                        return (
                                            <div
                                                key={evt.id}
                                                onClick={() => setSelectedEventForView(evt)}
                                                className="hover-lift"
                                                style={{
                                                    padding: '0.65rem',
                                                    borderRadius: 'var(--radius-sm)',
                                                    background: evt.isCompleted ? 'rgba(16, 185, 129, 0.06)' : style.bg,
                                                    borderLeft: `3px solid ${evt.isCompleted ? '#10B981' : style.border}`,
                                                    borderTop: '1px solid rgba(0,0,0,0.05)',
                                                    borderRight: '1px solid rgba(0,0,0,0.05)',
                                                    borderBottom: '1px solid rgba(0,0,0,0.05)',
                                                    cursor: 'pointer',
                                                    fontSize: '0.8rem',
                                                    position: 'relative'
                                                }}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.25rem', marginBottom: '0.25rem' }}>
                                                    <span style={{
                                                        fontSize: '0.68rem',
                                                        fontWeight: 700,
                                                        color: style.text,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '0.2rem'
                                                    }}>
                                                        {style.icon} {style.badge}
                                                    </span>

                                                    {evt.startTime && (
                                                        <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                                                            {evt.startTime}
                                                        </span>
                                                    )}
                                                </div>

                                                <div style={{ 
                                                    fontWeight: 600, 
                                                    color: evt.isCompleted ? 'var(--text-muted)' : 'var(--text-main)',
                                                    textDecoration: evt.isCompleted ? 'line-through' : 'none',
                                                    lineHeight: 1.3,
                                                    marginBottom: '0.2rem'
                                                }}>
                                                    {evt.title}
                                                </div>

                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.35rem' }}>
                                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                                        {evt.subject}
                                                    </span>
                                                    {evt.childName && (
                                                        <span style={{ fontSize: '0.65rem', background: 'rgba(0,0,0,0.04)', padding: '0.1rem 0.35rem', borderRadius: '3px' }}>
                                                            {evt.childName}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {dayEvents.length === 0 && (
                                        <div style={{ 
                                            flex: 1, 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            justifyContent: 'center', 
                                            color: 'var(--text-muted)', 
                                            fontSize: '0.75rem',
                                            border: '1px dashed var(--border)',
                                            borderRadius: 'var(--radius-sm)',
                                            padding: '1rem',
                                            textAlign: 'center'
                                        }}>
                                            No events
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* VIEW MODE 3: MONTH VIEW (Full Calendar Grid) */}
            {/* ------------------------------------------------------------- */}
            {viewMode === 'month' && (
                <div className="card mobile-scroll-x" style={{ padding: '1.25rem' }}>
                    <div style={{ minWidth: '600px' }}>
                    {/* Weekday Labels */}
                    <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(7, 1fr)', 
                        gap: '0.5rem', 
                        textAlign: 'center', 
                        fontWeight: 600, 
                        fontSize: '0.8rem', 
                        color: 'var(--text-muted)', 
                        paddingBottom: '0.75rem',
                        borderBottom: '1px solid var(--border)',
                        marginBottom: '0.5rem'
                    }}>
                        <div>Mon</div>
                        <div>Tue</div>
                        <div>Wed</div>
                        <div>Thu</div>
                        <div>Fri</div>
                        <div>Sat</div>
                        <div>Sun</div>
                    </div>

                    {/* Month Day Cells */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.5rem' }}>
                        {monthGrid.map(({ date: cellDate, isCurrentMonth }, idx) => {
                            const dateKey = formatDateKey(cellDate);
                            const dayEvents = visibleEvents.filter(e => e.date === dateKey);
                            const isCellToday = isToday(cellDate);

                            return (
                                <div
                                    key={idx}
                                    onClick={() => {
                                        setCurrentDate(cellDate);
                                        setViewMode('day');
                                    }}
                                    className="hover-lift"
                                    style={{
                                        minHeight: '105px',
                                        padding: '0.5rem',
                                        background: isCellToday ? 'rgba(79, 70, 229, 0.04)' : (isCurrentMonth ? 'var(--surface)' : 'var(--surface-hover)'),
                                        border: isCellToday ? '2px solid var(--primary)' : '1px solid var(--border)',
                                        borderRadius: 'var(--radius-sm)',
                                        cursor: 'pointer',
                                        opacity: isCurrentMonth ? 1 : 0.45,
                                        display: 'flex',
                                        flexDirection: 'column'
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                                        <span style={{ 
                                            fontWeight: isCellToday ? 700 : 500, 
                                            fontSize: '0.82rem', 
                                            width: isCellToday ? '22px' : 'auto',
                                            height: isCellToday ? '22px' : 'auto',
                                            borderRadius: isCellToday ? '50%' : 'none',
                                            background: isCellToday ? 'var(--primary)' : 'transparent',
                                            color: isCellToday ? 'white' : 'var(--text-main)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}>
                                            {cellDate.getDate()}
                                        </span>

                                        {dayEvents.length > 0 && (
                                            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                                                {dayEvents.length}
                                            </span>
                                        )}
                                    </div>

                                    {/* Event pills inside cell */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', overflow: 'hidden', flex: 1 }}>
                                        {dayEvents.slice(0, 2).map(evt => {
                                            const style = getEventStyle(evt.type);
                                            return (
                                                <div
                                                    key={evt.id}
                                                    style={{
                                                        padding: '0.15rem 0.35rem',
                                                        borderRadius: '3px',
                                                        background: style.bg,
                                                        borderLeft: `2px solid ${style.border}`,
                                                        fontSize: '0.68rem',
                                                        fontWeight: 600,
                                                        color: style.text,
                                                        whiteSpace: 'nowrap',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis'
                                                    }}
                                                    title={`${evt.title} (${evt.startTime || 'All day'})`}
                                                >
                                                    {evt.title}
                                                </div>
                                            );
                                        })}
                                        {dayEvents.length > 2 && (
                                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                                                +{dayEvents.length - 2} more
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    </div>
                </div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* VIEW EVENT DETAILS MODAL */}
            {/* ------------------------------------------------------------- */}
            {selectedEventForView && (
                <div 
                    style={{
                        position: 'fixed',
                        top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 100,
                        padding: '1rem',
                        backdropFilter: 'blur(4px)'
                    }}
                    onClick={() => setSelectedEventForView(null)}
                >
                    <div 
                        className="card animate-fade-in"
                        style={{ width: '100%', maxWidth: '520px', padding: '1.75rem', position: 'relative' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            onClick={() => setSelectedEventForView(null)}
                            style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                        >
                            <X size={20} />
                        </button>

                        {(() => {
                            const style = getEventStyle(selectedEventForView.type);
                            return (
                                <>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                        <span style={{
                                            fontSize: '0.75rem',
                                            fontWeight: 700,
                                            padding: '0.2rem 0.65rem',
                                            borderRadius: '1rem',
                                            background: style.bg,
                                            color: style.text,
                                            border: `1px solid ${style.border}`,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.35rem'
                                        }}>
                                            {style.icon} {style.badge}
                                        </span>
                                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                                            {selectedEventForView.subject}
                                        </span>
                                    </div>

                                    <h2 style={{ fontSize: '1.35rem', marginBottom: '0.5rem', lineHeight: 1.3 }}>
                                        {selectedEventForView.title}
                                    </h2>

                                    <div style={{ 
                                        padding: '0.75rem 1rem', 
                                        background: 'var(--surface-hover)', 
                                        borderRadius: 'var(--radius-sm)', 
                                        margin: '1rem 0',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '0.4rem',
                                        fontSize: '0.85rem'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <CalendarIcon size={15} color="var(--primary)" />
                                            <span><strong>Date:</strong> {selectedEventForView.date}</span>
                                        </div>
                                        {selectedEventForView.startTime && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <Clock size={15} color="var(--primary)" />
                                                <span><strong>Time:</strong> {selectedEventForView.startTime} {selectedEventForView.endTime ? `– ${selectedEventForView.endTime}` : ''}</span>
                                            </div>
                                        )}
                                        {selectedEventForView.childName && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <User size={15} color="var(--primary)" />
                                                <span><strong>Assigned to:</strong> {selectedEventForView.childName}</span>
                                            </div>
                                        )}
                                    </div>

                                    {selectedEventForView.description && (
                                        <div style={{ marginBottom: '1.5rem' }}>
                                            <h4 style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.35rem', textTransform: 'uppercase' }}>
                                                Study Instructions & Topics
                                            </h4>
                                            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-main)', background: 'var(--surface)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                                                {selectedEventForView.description}
                                            </p>
                                        </div>
                                    )}

                                    {/* Actions */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                                        <button
                                            onClick={() => toggleComplete(selectedEventForView.id)}
                                            className="btn"
                                            style={{
                                                background: selectedEventForView.isCompleted ? 'rgba(16, 185, 129, 0.1)' : 'var(--surface-hover)',
                                                color: selectedEventForView.isCompleted ? '#10B981' : 'var(--text-main)',
                                                border: '1px solid var(--border)',
                                                padding: '0.5rem 0.9rem',
                                                fontSize: '0.82rem'
                                            }}
                                        >
                                            {selectedEventForView.isCompleted ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                                            {selectedEventForView.isCompleted ? 'Completed' : 'Mark Complete'}
                                        </button>

                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            {selectedEventForView.testId && (
                                                <button
                                                    onClick={() => {
                                                        setSelectedEventForView(null);
                                                        navigate(isParent ? '/parent/dashboard' : '/student/dashboard');
                                                    }}
                                                    className="btn btn-primary"
                                                    style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                                                >
                                                    <Play size={15} /> Start Linked Test
                                                </button>
                                            )}

                                            {isParent && (
                                                <>
                                                    <button
                                                        onClick={() => handleOpenEditModal(selectedEventForView)}
                                                        className="btn btn-secondary"
                                                        style={{ padding: '0.5rem 0.85rem', fontSize: '0.85rem' }}
                                                    >
                                                        <Edit2 size={14} /> Edit
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteEvent(selectedEventForView.id)}
                                                        style={{
                                                            background: 'rgba(239, 68, 68, 0.1)',
                                                            color: 'var(--danger)',
                                                            border: 'none',
                                                            borderRadius: 'var(--radius-sm)',
                                                            padding: '0.5rem 0.85rem',
                                                            cursor: 'pointer',
                                                            fontSize: '0.85rem',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '0.35rem'
                                                        }}
                                                    >
                                                        <Trash2 size={14} /> Delete
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </>
                            );
                        })()}
                    </div>
                </div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* ADD / EDIT SCHEDULE MODAL (Parent Only) */}
            {/* ------------------------------------------------------------- */}
            {isModalOpen && isParent && (
                <div 
                    style={{
                        position: 'fixed',
                        top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 100,
                        padding: '1rem',
                        backdropFilter: 'blur(4px)'
                    }}
                    onClick={() => setIsModalOpen(false)}
                >
                    <div 
                        className="card animate-fade-in"
                        style={{ width: '100%', maxWidth: '540px', padding: '1.75rem', position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            onClick={() => setIsModalOpen(false)}
                            style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                        >
                            <X size={20} />
                        </button>

                        <h2 style={{ fontSize: '1.35rem', marginBottom: '0.35rem' }}>
                            {editingEvent ? 'Edit Scheduled Item' : 'Schedule Exam or Block Study Time'}
                        </h2>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                            Prepare your children for upcoming school exams and organize their daily study habits.
                        </p>

                        <form onSubmit={handleSaveEvent}>
                            {/* Type Selector (3 options) */}
                            <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.5rem' }}>
                                Schedule Type
                            </label>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginBottom: '1.25rem' }}>
                                <button
                                    type="button"
                                    onClick={() => setFormType('study_block')}
                                    style={{
                                        padding: '0.65rem 0.5rem',
                                        borderRadius: 'var(--radius-sm)',
                                        border: formType === 'study_block' ? '2px solid #10B981' : '1px solid var(--border)',
                                        background: formType === 'study_block' ? 'rgba(16, 185, 129, 0.1)' : 'var(--surface)',
                                        color: formType === 'study_block' ? '#047857' : 'var(--text-main)',
                                        fontWeight: formType === 'study_block' ? 700 : 500,
                                        cursor: 'pointer',
                                        fontSize: '0.78rem',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        gap: '0.35rem',
                                        transition: 'var(--transition)'
                                    }}
                                >
                                    <Clock size={18} color={formType === 'study_block' ? '#10B981' : 'var(--text-muted)'} />
                                    <span>⏱️ Study Block</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setFormType('test_prep')}
                                    style={{
                                        padding: '0.65rem 0.5rem',
                                        borderRadius: 'var(--radius-sm)',
                                        border: formType === 'test_prep' ? '2px solid #4F46E5' : '1px solid var(--border)',
                                        background: formType === 'test_prep' ? 'rgba(79, 70, 229, 0.1)' : 'var(--surface)',
                                        color: formType === 'test_prep' ? '#4338CA' : 'var(--text-main)',
                                        fontWeight: formType === 'test_prep' ? 700 : 500,
                                        cursor: 'pointer',
                                        fontSize: '0.78rem',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        gap: '0.35rem',
                                        transition: 'var(--transition)'
                                    }}
                                >
                                    <BookOpen size={18} color={formType === 'test_prep' ? '#4F46E5' : 'var(--text-muted)'} />
                                    <span>📝 Test Prep</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setFormType('exam')}
                                    style={{
                                        padding: '0.65rem 0.5rem',
                                        borderRadius: 'var(--radius-sm)',
                                        border: formType === 'exam' ? '2px solid #EF4444' : '1px solid var(--border)',
                                        background: formType === 'exam' ? 'rgba(239, 68, 68, 0.1)' : 'var(--surface)',
                                        color: formType === 'exam' ? '#B91C1C' : 'var(--text-main)',
                                        fontWeight: formType === 'exam' ? 700 : 500,
                                        cursor: 'pointer',
                                        fontSize: '0.78rem',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        gap: '0.35rem',
                                        transition: 'var(--transition)'
                                    }}
                                >
                                    <GraduationCap size={18} color={formType === 'exam' ? '#EF4444' : 'var(--text-muted)'} />
                                    <span>🎓 School Exam</span>
                                </button>
                            </div>

                            {/* Title */}
                            <div className="input-group" style={{ marginBottom: '1rem' }}>
                                <label>Title</label>
                                <input
                                    type="text"
                                    className="input"
                                    placeholder={
                                        formType === 'exam' 
                                            ? 'e.g., Mathematics Mid-Term Exam (Term 1)' 
                                            : formType === 'test_prep'
                                                ? 'e.g., Diagnostic Drill: Linear Equations'
                                                : 'e.g., Focus Study Block: Physics Chapter 4'
                                    }
                                    value={formTitle}
                                    onChange={(e) => setFormTitle(e.target.value)}
                                    required
                                />
                            </div>

                            {/* Subject & Child Selector */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                                <div className="input-group">
                                    <label>Subject</label>
                                    <select
                                        className="input"
                                        value={formSubject}
                                        onChange={(e) => setFormSubject(e.target.value)}
                                    >
                                        {SUBJECT_OPTIONS.map(s => (
                                            <option key={s} value={s}>{s}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="input-group">
                                    <label>Assign to Child</label>
                                    <select
                                        className="input"
                                        value={formChildId}
                                        onChange={(e) => setFormChildId(e.target.value)}
                                    >
                                        {childrenList.length > 0 ? (
                                            childrenList.map(c => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))
                                        ) : (
                                            <option value="superuser-student-001">Alex (Student)</option>
                                        )}
                                    </select>
                                </div>
                            </div>

                            {/* Date & Time Slot */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                                <div className="input-group">
                                    <label>Date</label>
                                    <input
                                        type="date"
                                        className="input"
                                        value={formDate}
                                        onChange={(e) => setFormDate(e.target.value)}
                                        required
                                    />
                                </div>

                                <div className="input-group">
                                    <label>Start Time</label>
                                    <input
                                        type="time"
                                        className="input"
                                        value={formStartTime}
                                        onChange={(e) => setFormStartTime(e.target.value)}
                                    />
                                </div>

                                <div className="input-group">
                                    <label>End Time</label>
                                    <input
                                        type="time"
                                        className="input"
                                        value={formEndTime}
                                        onChange={(e) => setFormEndTime(e.target.value)}
                                    />
                                </div>
                            </div>

                            {/* Optional Linked Test for Test Prep */}
                            {formType === 'test_prep' && tests.length > 0 && (
                                <div className="input-group" style={{ marginBottom: '1rem' }}>
                                    <label>Link to Test in Library (Optional)</label>
                                    <select
                                        className="input"
                                        value={formTestId}
                                        onChange={(e) => setFormTestId(e.target.value)}
                                    >
                                        <option value="">-- No linked test (General practice) --</option>
                                        {tests.map(t => (
                                            <option key={t.id} value={t.id}>{t.title} ({t.subject})</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Reminder Notification Choice Rule (FR-7) */}
                            <div className="input-group" style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <Clock size={14} color="var(--primary)" />
                                    <span>Reminder Rule (FR-7)</span>
                                </label>
                                <select
                                    className="input"
                                    value={formReminderRule}
                                    onChange={(e) => setFormReminderRule(e.target.value as ReminderRule)}
                                >
                                    <option value="1_day_before">1 day before (Default notification)</option>
                                    <option value="2_days_before">2 days before (Advance revision notice)</option>
                                    <option value="same_morning">Same morning (Day-of prompt)</option>
                                </select>
                            </div>

                            {/* Description / Instructions */}
                            <div className="input-group" style={{ marginBottom: '1.5rem' }}>
                                <label>Study Instructions / Exam Topics</label>
                                <textarea
                                    className="input"
                                    rows={3}
                                    placeholder="Add specific chapters, pages, or guidelines for your child..."
                                    value={formDescription}
                                    onChange={(e) => setFormDescription(e.target.value)}
                                    style={{ resize: 'vertical' }}
                                />
                            </div>

                            {/* Modal Buttons */}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="btn btn-secondary"
                                    style={{ padding: '0.55rem 1rem' }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    style={{ padding: '0.55rem 1.25rem' }}
                                >
                                    {editingEvent ? 'Save Changes' : 'Add to Calendar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CalendarPage;
