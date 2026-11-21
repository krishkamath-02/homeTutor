import React, { useState } from 'react';
import { X, BookOpen } from 'lucide-react';
import useAppStore from '../store/appStore';
import useCalendarStore, { type ReminderRule } from '../store/calendarStore';
import useAuthStore from '../store/authStore';

interface ManualHomeworkModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const SUBJECT_OPTIONS = ['Math', 'English', 'Science', 'Hindi', 'Social Studies', 'Computer'];

export const ManualHomeworkModal: React.FC<ManualHomeworkModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const user = useAuthStore(state => state.user);
    const childrenList = useAppStore(state => state.childrenList);
    const addDailyHomework = useAppStore(state => state.addDailyHomework);
    const addCalendarEvent = useCalendarStore(state => state.addEvent);

    const [subject, setSubject] = useState('Math');
    const [task, setTask] = useState('');
    const [dueDate, setDueDate] = useState('Tomorrow');
    const [reminderRule, setReminderRule] = useState<ReminderRule>('1_day_before');
    const [isTestNotice, setIsTestNotice] = useState(false);
    const [selectedChildId] = useState<string>(childrenList[0]?.id || '');
    const [isSaving, setIsSaving] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!task.trim()) {
            setErrorMsg('Please enter the homework task written in the almanac.');
            return;
        }

        setIsSaving(true);
        setErrorMsg(null);
        try {
            const assignedChild = childrenList.find(c => c.id === selectedChildId) || childrenList[0];
            const childName = assignedChild?.name || 'Alexander';

            await addDailyHomework({
                childId: assignedChild?.id,
                childName,
                title: `${subject}: ${task.slice(0, 35)}`,
                subject,
                description: task.trim(),
                source: 'manual',
                dueDate,
                reminderRule,
                isTestOrDictation: isTestNotice,
                files: []
            });

            if (isTestNotice) {
                await addCalendarEvent({
                    parentId: user?.id || 'parent-user',
                    childId: assignedChild?.id,
                    childName,
                    title: `${subject} Test / Assessment (${dueDate})`,
                    type: 'exam',
                    subject,
                    date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
                    startTime: '09:00',
                    endTime: '10:00',
                    description: task.trim(),
                    reminderRule,
                    isCompleted: false
                });
            }

            onSuccess();
            onClose();
        } catch (err: any) {
            setErrorMsg(err?.message || 'Error saving almanac homework.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div 
            role="dialog" 
            aria-modal="true" 
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(15, 23, 42, 0.65)',
                backdropFilter: 'blur(4px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '1rem',
                zIndex: 9999
            }}
        >
            <div 
                className="card" 
                style={{
                    background: 'var(--surface)',
                    width: '100%',
                    maxWidth: '460px',
                    borderRadius: 'var(--radius-xl)',
                    padding: '1.5rem',
                    boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1.25rem'
                }}
            >
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <div style={{ background: 'rgba(217, 119, 6, 0.12)', padding: '0.5rem', borderRadius: 'var(--radius-md)', color: '#d97706' }}>
                            <BookOpen size={22} />
                        </div>
                        <div>
                            <h2 style={{ fontSize: '1.15rem', margin: 0, fontWeight: 700 }}>
                                Add from Almanac
                            </h2>
                            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                Screen 0b · Capture school diary notes by hand
                            </p>
                        </div>
                    </div>
                    <button 
                        type="button" 
                        onClick={onClose} 
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                    >
                        <X size={20} />
                    </button>
                </div>

                {errorMsg && (
                    <div style={{ background: '#FEE2E2', color: '#991B1B', padding: '0.65rem', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem' }}>
                        {errorMsg}
                    </div>
                )}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {/* Subject Chips */}
                    <div>
                        <label style={{ display: 'block', fontWeight: 600, fontSize: '0.82rem', marginBottom: '0.4rem' }}>
                            Subject
                        </label>
                        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                            {SUBJECT_OPTIONS.map(subj => (
                                <button
                                    key={subj}
                                    type="button"
                                    onClick={() => setSubject(subj)}
                                    style={{
                                        padding: '0.35rem 0.75rem',
                                        borderRadius: '2rem',
                                        border: `1.5px solid ${subject === subj ? 'var(--teal)' : 'var(--border)'}`,
                                        background: subject === subj ? 'rgba(13, 148, 136, 0.1)' : 'var(--surface)',
                                        color: subject === subj ? 'var(--teal)' : 'var(--text-main)',
                                        fontWeight: 600,
                                        fontSize: '0.8rem',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {subj}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Task Description */}
                    <div>
                        <label style={{ display: 'block', fontWeight: 600, fontSize: '0.82rem', marginBottom: '0.4rem' }}>
                            Task Description
                        </label>
                        <textarea
                            value={task}
                            onChange={e => setTask(e.target.value)}
                            placeholder="e.g. Read Lesson 3 pg 25; Do Q1 to Q4 in notebook."
                            rows={3}
                            style={{
                                width: '100%',
                                padding: '0.65rem',
                                borderRadius: 'var(--radius-md)',
                                border: '1.5px solid var(--border)',
                                fontSize: '0.85rem',
                                fontFamily: 'inherit'
                            }}
                        />
                    </div>

                    {/* Due Date Chips */}
                    <div>
                        <label style={{ display: 'block', fontWeight: 600, fontSize: '0.82rem', marginBottom: '0.4rem' }}>
                            Due Date
                        </label>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                            {['Today', 'Tomorrow', 'This Friday', 'Next Monday'].map(d => (
                                <button
                                    key={d}
                                    type="button"
                                    onClick={() => setDueDate(d)}
                                    className={dueDate === d ? 'chip-amber' : ''}
                                    style={{
                                        padding: '0.35rem 0.65rem',
                                        borderRadius: '1rem',
                                        border: `1.5px solid ${dueDate === d ? '#FCD34D' : 'var(--border)'}`,
                                        background: dueDate === d ? '#FEF3C7' : 'var(--surface)',
                                        color: dueDate === d ? '#92400E' : 'var(--text-muted)',
                                        fontWeight: 600,
                                        fontSize: '0.78rem',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {d}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Reminder Rule (FR-7) */}
                    <div>
                        <label style={{ display: 'block', fontWeight: 600, fontSize: '0.82rem', marginBottom: '0.4rem' }}>
                            Reminder Notification Rule (FR-7)
                        </label>
                        <select
                            value={reminderRule}
                            onChange={e => setReminderRule(e.target.value as ReminderRule)}
                            style={{ width: '100%', padding: '0.55rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: '0.85rem' }}
                        >
                            <option value="1_day_before">1 day before (Default)</option>
                            <option value="2_days_before">2 days before</option>
                            <option value="same_morning">Same morning</option>
                        </select>
                    </div>

                    {/* Test/Dictation check */}
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.82rem', color: 'var(--text-main)' }}>
                        <input
                            type="checkbox"
                            checked={isTestNotice}
                            onChange={e => setIsTestNotice(e.target.checked)}
                            style={{ width: '16px', height: '16px', accentColor: 'var(--teal)' }}
                        />
                        <span>This is a Test or Dictation date (syncs to calendar)</span>
                    </label>

                    <button
                        type="submit"
                        disabled={isSaving}
                        className="btn-teal"
                        style={{ width: '100%', padding: '0.8rem', fontSize: '0.92rem' }}
                    >
                        {isSaving ? 'Saving...' : 'Save to Today\'s Plan'}
                    </button>
                </form>
            </div>
        </div>
    );
};
export default ManualHomeworkModal;
