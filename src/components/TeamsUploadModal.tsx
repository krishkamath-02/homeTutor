import React, { useState } from 'react';
import { 
    X, Upload, Sparkles, Clock, 
    AlertCircle, Trash2, Camera
} from 'lucide-react';
import { extractTeamsPost, type ExtractedTeamsPost, type ExtractedTeamsTask } from '../lib/gemini';
import useAppStore from '../store/appStore';
import useCalendarStore from '../store/calendarStore';
import useAuthStore from '../store/authStore';

interface TeamsUploadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (count: number) => void;
}

export const TeamsUploadModal: React.FC<TeamsUploadModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const user = useAuthStore(state => state.user);
    const childrenList = useAppStore(state => state.childrenList);
    const addDailyHomework = useAppStore(state => state.addDailyHomework);
    const addCalendarEvent = useCalendarStore(state => state.addEvent);

    const [step, setStep] = useState<'upload' | 'review'>('upload');
    const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isExtracting, setIsExtracting] = useState(false);
    const [extractedPost, setExtractedPost] = useState<ExtractedTeamsPost | null>(null);
    const [tasks, setTasks] = useState<ExtractedTeamsTask[]>([]);
    const [selectedChildId, setSelectedChildId] = useState<string>(childrenList[0]?.id || '');
    const [isSaving, setIsSaving] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];
        setScreenshotFile(file);
        setPreviewUrl(URL.createObjectURL(file));
        setErrorMsg(null);
    };

    const handleExtract = async () => {
        if (!screenshotFile) {
            setErrorMsg('Please select or capture a screenshot first.');
            return;
        }
        setIsExtracting(true);
        setErrorMsg(null);
        try {
            const result = await extractTeamsPost(screenshotFile);
            if (!result.tasks || result.tasks.length === 0) {
                setErrorMsg('No homework tasks could be extracted from this image. Please check image clarity or orientation.');
                return;
            }
            setExtractedPost(result);
            setTasks(result.tasks);
            setStep('review');
        } catch (err: any) {
            setErrorMsg(err?.message || 'Failed to extract homework from screenshot.');
        } finally {
            setIsExtracting(false);
        }
    };

    const handleTaskChange = (index: number, field: keyof ExtractedTeamsTask, val: any) => {
        setTasks(prev => {
            const next = [...prev];
            next[index] = { ...next[index], [field]: val };
            return next;
        });
    };

    const removeTask = (index: number) => {
        setTasks(prev => prev.filter((_, i) => i !== index));
    };

    const handleSaveAll = async () => {
        if (tasks.length === 0) {
            setErrorMsg('No tasks to save.');
            return;
        }

        setIsSaving(true);
        setErrorMsg(null);
        try {
            const assignedChild = childrenList.find(c => c.id === selectedChildId) || childrenList[0];
            const childName = assignedChild?.name || 'Alexander';

            for (const task of tasks) {
                // 1. Add to Daily Homework Store
                await addDailyHomework({
                    childId: assignedChild?.id,
                    childName,
                    title: `${task.subject}: ${task.task.slice(0, 40)}`,
                    subject: task.subject,
                    description: task.task,
                    source: 'teams',
                    dueDate: task.dueDate,
                    reminderRule: task.reminderRule,
                    isTestOrDictation: task.isTestOrDictation,
                    hasCorrectionsNotice: task.hasCorrectionsNotice,
                    requiredFilesPrompt: task.requiredFilesPrompt,
                    files: screenshotFile ? [screenshotFile] : []
                });

                // 2. If it is a test or dictation notice, add to Calendar
                if (task.isTestOrDictation) {
                    await addCalendarEvent({
                        parentId: user?.id || 'parent-user',
                        childId: assignedChild?.id,
                        childName,
                        title: `${task.subject} Test / Dictation (${task.dueDate})`,
                        type: 'exam',
                        subject: task.subject,
                        date: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
                        startTime: '09:00',
                        endTime: '10:00',
                        description: task.task,
                        reminderRule: task.reminderRule,
                        isCompleted: false
                    });
                }
            }

            onSuccess(tasks.length);
            onClose();
        } catch (err: any) {
            setErrorMsg(err?.message || 'Error saving extracted plan.');
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
                    maxWidth: '540px',
                    maxHeight: '90vh',
                    overflowY: 'auto',
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
                        <div style={{ background: 'rgba(99, 102, 241, 0.12)', padding: '0.5rem', borderRadius: 'var(--radius-md)', color: '#4f46e5' }}>
                            <Upload size={22} />
                        </div>
                        <div>
                            <h2 style={{ fontSize: '1.15rem', margin: 0, fontWeight: 700 }}>
                                {step === 'upload' ? 'Upload Teams Post' : 'Review Extracted Plan'}
                            </h2>
                            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                {step === 'upload' ? 'Turn your teacher’s screenshot into today’s plan' : 'Review & edit before saving (FR-3)'}
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
                    <div style={{ background: '#FEE2E2', color: '#991B1B', padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <AlertCircle size={16} />
                        <span>{errorMsg}</span>
                    </div>
                )}

                {/* STEP 1: UPLOAD & TEACHER POST GUIDANCE */}
                {step === 'upload' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
                        {/* Guidance Card: Real Teacher Post Example */}
                        <div style={{
                            background: '#F8FAFC',
                            border: '1.5px dashed #CBD5E1',
                            borderRadius: 'var(--radius-md)',
                            padding: '0.85rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.4rem'
                        }}>
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: '#6366F1', letterSpacing: '0.04em' }}>
                                💡 Example of Teacher's Teams Message (Grade 2 · Class II A)
                            </span>
                            <p style={{ margin: 0, fontSize: '0.82rem', fontStyle: 'italic', color: '#334155', lineHeight: 1.4 }}>
                                "Good afternoon parents. Homework for today: <strong>Math</strong> Ex 4.2 fractions Q1-6 in notebook; <strong>English</strong> Read Ch 4 'The Friendly Whale'; <strong>Dictation</strong> on Friday. Please sign Math Unit Test papers and do corrections in classwork notebook."
                            </p>
                        </div>

                        {/* Screenshot Uploader */}
                        <div>
                            <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.4rem' }}>
                                Screenshot of Teams Post
                            </label>
                            <label 
                                style={{
                                    border: '2px dashed var(--border)',
                                    borderRadius: 'var(--radius-lg)',
                                    padding: '1.5rem 1rem',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    background: previewUrl ? 'transparent' : 'var(--surface-hover)',
                                    textAlign: 'center',
                                    gap: '0.5rem'
                                }}
                            >
                                <input 
                                    type="file" 
                                    accept="image/*" 
                                    onChange={handleFileChange} 
                                    style={{ display: 'none' }} 
                                />
                                {previewUrl ? (
                                    <div style={{ position: 'relative', width: '100%' }}>
                                        <img 
                                            src={previewUrl} 
                                            alt="Teams screenshot" 
                                            style={{ maxHeight: '180px', maxWidth: '100%', objectFit: 'contain', borderRadius: 'var(--radius-sm)' }} 
                                        />
                                        <p style={{ margin: '0.4rem 0 0', fontSize: '0.78rem', color: 'var(--primary)', fontWeight: 600 }}>
                                            Tap to replace screenshot
                                        </p>
                                    </div>
                                ) : (
                                    <>
                                        <div style={{ background: 'rgba(13, 148, 136, 0.1)', color: 'var(--teal)', padding: '0.75rem', borderRadius: '50%' }}>
                                            <Camera size={24} />
                                        </div>
                                        <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem' }}>
                                            Upload or take screenshot
                                        </p>
                                        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                            Supports JPG, PNG photos from Teams app
                                        </p>
                                    </>
                                )}
                            </label>
                        </div>

                        {/* Child selector if multiple */}
                        {childrenList.length > 1 && (
                            <div>
                                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.82rem', marginBottom: '0.35rem' }}>
                                    Assign to Student
                                </label>
                                <select 
                                    value={selectedChildId} 
                                    onChange={e => setSelectedChildId(e.target.value)}
                                    style={{ width: '100%', padding: '0.55rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}
                                >
                                    {childrenList.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <button 
                            type="button" 
                            onClick={handleExtract}
                            disabled={!screenshotFile || isExtracting}
                            className="btn-teal"
                            style={{ 
                                width: '100%', 
                                padding: '0.85rem', 
                                fontSize: '0.95rem',
                                opacity: (!screenshotFile || isExtracting) ? 0.6 : 1,
                                cursor: (!screenshotFile || isExtracting) ? 'not-allowed' : 'pointer'
                            }}
                        >
                            {isExtracting ? (
                                <>
                                    <Sparkles size={18} className="animate-spin" />
                                    <span>Reading Teams Screenshot with AI...</span>
                                </>
                            ) : (
                                <>
                                    <Sparkles size={18} />
                                    <span>Read my screenshot</span>
                                </>
                            )}
                        </button>
                    </div>
                )}

                {/* STEP 2: REVIEW & EDIT (FR-3) */}
                {step === 'review' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--teal)' }}>
                                ✨ {tasks.length} items extracted for {extractedPost?.gradeClass || 'Class II A'}
                            </span>
                            <button 
                                type="button" 
                                onClick={() => setStep('upload')} 
                                style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 }}
                            >
                                Re-upload
                            </button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '50vh', overflowY: 'auto' }}>
                            {tasks.map((task, idx) => (
                                <div 
                                    key={task.id} 
                                    style={{
                                        border: '1.5px solid var(--border)',
                                        borderRadius: 'var(--radius-md)',
                                        padding: '0.85rem',
                                        background: 'var(--surface)',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '0.5rem'
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                            <span style={{
                                                background: task.subject === 'Math' ? '#EEF2FF' : task.subject === 'English' ? '#F0FDF4' : '#FEF3C7',
                                                color: task.subject === 'Math' ? '#4F46E5' : task.subject === 'English' ? '#166534' : '#92400E',
                                                padding: '0.2rem 0.55rem',
                                                borderRadius: '1rem',
                                                fontSize: '0.75rem',
                                                fontWeight: 700
                                            }}>
                                                {task.subject}
                                            </span>
                                            <span className="chip-amber">
                                                📅 {task.dueDate}
                                            </span>
                                            {task.hasCorrectionsNotice && (
                                                <span style={{ background: '#FEE2E2', color: '#991B1B', padding: '0.15rem 0.5rem', borderRadius: '1rem', fontSize: '0.72rem', fontWeight: 700 }}>
                                                    ✍️ Corrections Required
                                                </span>
                                            )}
                                            {task.isTestOrDictation && (
                                                <span style={{ background: '#E0E7FF', color: '#3730A3', padding: '0.15rem 0.5rem', borderRadius: '1rem', fontSize: '0.72rem', fontWeight: 700 }}>
                                                    🔔 Test Notice
                                                </span>
                                            )}
                                        </div>
                                        <button 
                                            type="button" 
                                            onClick={() => removeTask(idx)}
                                            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '0.2rem' }}
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>

                                    {/* Task description editor */}
                                    <textarea 
                                        value={task.task}
                                        onChange={e => handleTaskChange(idx, 'task', e.target.value)}
                                        rows={2}
                                        style={{
                                            width: '100%',
                                            padding: '0.45rem',
                                            borderRadius: 'var(--radius-sm)',
                                            border: '1px solid var(--border)',
                                            fontSize: '0.85rem',
                                            fontFamily: 'inherit',
                                            resize: 'vertical'
                                        }}
                                    />

                                    {/* Reminder choice rule (FR-7) */}
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                            <Clock size={13} /> Reminder:
                                        </span>
                                        <select 
                                            value={task.reminderRule}
                                            onChange={e => handleTaskChange(idx, 'reminderRule', e.target.value)}
                                            style={{ padding: '0.2rem 0.4rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: '0.75rem' }}
                                        >
                                            <option value="1_day_before">1 day before (Default)</option>
                                            <option value="2_days_before">2 days before</option>
                                            <option value="same_morning">Same morning</option>
                                        </select>
                                    </div>

                                    {/* Next required file prompt (FR-5) */}
                                    {task.requiredFilesPrompt && (
                                        <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--teal)', fontStyle: 'italic' }}>
                                            📎 Next step: {task.requiredFilesPrompt}
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>

                        <button 
                            type="button" 
                            onClick={handleSaveAll}
                            disabled={isSaving}
                            className="btn-teal"
                            style={{ 
                                width: '100%', 
                                padding: '0.85rem', 
                                fontSize: '0.95rem',
                                opacity: isSaving ? 0.7 : 1
                            }}
                        >
                            {isSaving ? 'Saving to Plan & Calendar...' : `Save ${tasks.length} items to Today's Plan`}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
export default TeamsUploadModal;
