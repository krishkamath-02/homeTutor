import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Clock, Play, FileText, Award, Book, AlertCircle, User as UserIcon, Calendar, ArrowRight } from 'lucide-react';
import useAuthStore from '../store/authStore';
import useAppStore from '../store/appStore';
import useCalendarStore from '../store/calendarStore';
import { supabase } from '../lib/supabase';
import TestTaker from '../components/TestTaker';
import TestReview from '../components/TestReview';

const StudentDashboard = () => {
    const user = useAuthStore((state) => state.user);
    const tests = useAppStore((state) => state.tests);
    const fetchTests = useAppStore((state) => state.fetchTests);
    const { events, fetchEvents } = useCalendarStore();

    useEffect(() => {
        if (user?.parentId) {
            fetchTests();
            fetchEvents();
        }
    }, [fetchTests, fetchEvents, user?.parentId]);

    const logout = useAuthStore((state) => state.logout);

    const pendingTests = tests.filter(t => t.status === 'pending');
    const completedTests = tests.filter(t => t.status === 'completed');

    const SUBJECTS = [
        'Math', 
        'Science', 
        'English', 
        'Hindi',
        'Social Studies',
        'History',
        'Geography',
        'Physics',
        'Chemistry',
        'Biology',
        'Computer Science',
        'Economics',
        'Sanskrit',
        'French'
    ];

    const [activeTestId, setActiveTestId] = useState<string | null>(null);
    const [linkingCode, setLinkingCode] = useState('');
    const [isLinking, setIsLinking] = useState(false);
    const [linkError, setLinkError] = useState('');
    const [reviewTestId, setReviewTestId] = useState<string | null>(null);

    const userTracked = (user?.subjects || []).map(s => s === 'Mathematics' ? 'Math' : s);
    const displaySubjects = userTracked.length ? SUBJECTS.filter(s => userTracked.includes(s)) : SUBJECTS;

    const activeTest = tests.find(t => t.id === activeTestId);

    if (reviewTestId) {
        const reviewTest = tests.find(t => t.id === reviewTestId);
        if (reviewTest) {
            return (
                <div className="container animate-fade-in" style={{ maxWidth: '800px', margin: '2rem auto' }}>
                    <TestReview test={reviewTest} onClose={() => setReviewTestId(null)} />
                </div>
            );
        }
    }

    if (activeTestId && activeTest) {
        return (
            <div className="container animate-fade-in" style={{ maxWidth: '800px', margin: '2rem auto' }}>
                <TestTaker 
                    testId={activeTestId} 
                    onComplete={() => setActiveTestId(null)} 
                    onCancel={() => setActiveTestId(null)} 
                />
            </div>
        );
    }

    const handleLinkParent = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!linkingCode || !user) return;

        setIsLinking(true);
        setLinkError('');

        try {
            // 1. Try secure RPC function first
            if (typeof (supabase as any).rpc === 'function') {
                const { data: rpcResult, error: rpcError } = await (supabase as any).rpc('link_student_to_parent', {
                    p_invite_code: linkingCode.toUpperCase()
                });

                if (!rpcError && rpcResult) {
                    if (rpcResult.success) {
                        window.location.reload();
                        return;
                    } else if (rpcResult.message) {
                        throw new Error(rpcResult.message);
                    }
                }
            }

            // 2. Direct database query fallback
            const { data: parentProfile, error: parentError } = await supabase
                .from('profiles')
                .select('id, name, subscription_tier, max_children_allowed')
                .eq('invite_code', linkingCode.toUpperCase())
                .single();

            if (parentError || !parentProfile) {
                throw new Error('Invalid invite code. Please check with your parent.');
            }

            // Check parent's child profile limit
            const maxChildren = parentProfile.max_children_allowed ?? 2;
            const tier = parentProfile.subscription_tier ?? 'free';

            if (tier === 'free' || tier === 'pro') {
                const { count, error: countErr } = await supabase
                    .from('profiles')
                    .select('id', { count: 'exact', head: true })
                    .eq('parent_id', parentProfile.id);

                if (!countErr && count !== null && count >= maxChildren) {
                    throw new Error(`This parent has already reached their limit of ${maxChildren} child profile${maxChildren > 1 ? 's' : ''} on the ${tier.toUpperCase()} plan. Ask them to upgrade to add more children.`);
                }
            }

            // Update student's profile with parent_id
            const { error: updateError } = await supabase
                .from('profiles')
                .update({ parent_id: parentProfile.id })
                .eq('id', user.id);

            if (updateError) throw updateError;

            // Refresh app state
            window.location.reload();

        } catch (err: any) {
            setLinkError(err.message || 'Failed to link account');
        } finally {
            setIsLinking(false);
        }
    };

    return (
        <div className="container animate-fade-in">
            <header style={{ marginBottom: '1.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h1 style={{ fontSize: 'clamp(1.5rem, 4vw, 2rem)', marginBottom: '0.35rem' }}>Hello, {user?.name || 'Student'}! 👋</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: 'clamp(0.9rem, 2.5vw, 1.125rem)' }}>Ready for your next learning session?</p>
                </div>
                <div className="desktop-only items-center gap-3">
                    <Link to="/profile" className="btn" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-main)', padding: '0.45rem 0.85rem' }}>
                        {user?.avatarUrl ? <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>{user.avatarUrl}</span> : <UserIcon size={18} />} Profile
                    </Link>
                    <button className="btn btn-secondary" onClick={logout} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.45rem 0.85rem' }}>
                        Logout
                    </button>
                </div>
            </header>

            {!user?.parentId ? (
                <div style={{ maxWidth: '600px', margin: '2rem auto' }}>
                    <div className="card" style={{ padding: '3rem 2rem', textAlign: 'center' }}>
                        <div style={{ background: 'rgba(79, 70, 229, 0.1)', width: '80px', height: '80px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', color: 'var(--primary)' }}>
                            <BookOpen size={40} />
                        </div>
                        <h2 style={{ fontSize: '1.75rem', marginBottom: '1rem' }}>Connect to your Parent</h2>
                        <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', fontSize: '1.125rem' }}>
                            To see your lessons and tests, you need to link your account to your parent using their secret invite code.
                        </p>

                        <form onSubmit={handleLinkParent} style={{ maxWidth: '400px', margin: '0 auto' }}>
                            <div className="input-group" style={{ textAlign: 'left' }}>
                                <label style={{ fontWeight: 600 }}>Invite Code</label>
                                <input
                                    type="text"
                                    className="input"
                                    placeholder="e.g., A1B2C3"
                                    value={linkingCode}
                                    onChange={(e) => setLinkingCode(e.target.value.toUpperCase())}
                                    style={{ fontSize: '1.25rem', textAlign: 'center', letterSpacing: '4px', textTransform: 'uppercase' }}
                                    required
                                />
                                {linkError && <p style={{ color: 'var(--danger)', fontSize: '0.875rem', marginTop: '0.5rem' }}>{linkError}</p>}
                            </div>
                            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }} disabled={isLinking}>
                                {isLinking ? 'Linking...' : 'Link Account'}
                            </button>
                        </form>
                    </div>
                </div>
            ) : (
                <>
                    {/* Subject Tiles */}
                    <div className="card" style={{ marginBottom: '2.5rem' }}>
                        <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Book size={20} color="var(--primary)" /> Major Subjects
                        </h2>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
                            {displaySubjects.map(subject => (
                                <div key={subject} style={{ padding: '1.25rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', textAlign: 'center', transition: 'var(--transition)', cursor: 'pointer' }} className="hover-lift">
                                    <div style={{ background: 'var(--surface-hover)', width: '48px', height: '48px', margin: '0 auto 1rem', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
                                        <Book size={24} />
                                    </div>
                                    <h4 style={{ margin: 0, fontWeight: 600 }}>{subject}</h4>
                                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                                        {tests.filter(t => t.subject === subject && t.status === 'pending').length} tasks
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="stats-grid-responsive">
                        <div className="card" style={{ background: 'linear-gradient(135deg, var(--primary), #818cf8)', color: 'white', border: 'none' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                <div style={{ background: 'rgba(255,255,255,0.2)', padding: '0.75rem', borderRadius: 'var(--radius-md)' }}>
                                    <AlertCircle size={24} color="white" />
                                </div>
                                <span style={{ fontWeight: 600, fontSize: '1.5rem' }}>{pendingTests.length}</span>
                            </div>
                            <h3 style={{ fontSize: '1.25rem', marginBottom: '0.25rem', color: 'white' }}>Pending Tests</h3>
                            <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.875rem' }}>Awaiting completion</p>
                        </div>

                        <div className="card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--secondary)', padding: '0.75rem', borderRadius: 'var(--radius-md)' }}>
                                    <Award size={24} />
                                </div>
                                <span style={{ fontWeight: 600, fontSize: '1.5rem' }}>
                                    {completedTests.length > 0 ? Math.round(completedTests.reduce((acc, curr) => acc + (curr.score || 0), 0) / completedTests.length) : 0}%
                                </span>
                            </div>
                            <h3 style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>Average Score</h3>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Across all subjects</p>
                        </div>

                        <div className="card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                <div style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', padding: '0.75rem', borderRadius: 'var(--radius-md)' }}>
                                    <BookOpen size={24} />
                                </div>
                                <span style={{ fontWeight: 600, fontSize: '1.5rem' }}>{completedTests.length}</span>
                            </div>
                            <h3 style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>Topics Mastered</h3>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Keep up the good work!</p>
                        </div>

                        <Link to="/calendar" className="card hover-lift" style={{ textDecoration: 'none', color: 'inherit' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                <div style={{ background: 'rgba(79, 70, 229, 0.1)', color: 'var(--primary)', padding: '0.75rem', borderRadius: 'var(--radius-md)' }}>
                                    <Calendar size={24} />
                                </div>
                                <span style={{ fontWeight: 600, fontSize: '1.5rem', color: 'var(--primary)' }}>{events.length}</span>
                            </div>
                            <h3 style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>Study & Exams</h3>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Open schedule calendar →</p>
                        </Link>
                    </div>

                    {/* Upcoming Study Blocks & Exams Widget */}
                    <div className="card" style={{ marginBottom: '2.5rem', padding: '1.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                            <h2 style={{ fontSize: '1.3rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Calendar size={22} color="var(--primary)" /> Scheduled Study Time & Upcoming Exams
                            </h2>
                            <Link to="/calendar" className="btn btn-secondary" style={{ padding: '0.4rem 0.85rem', fontSize: '0.82rem' }}>
                                Full Calendar <ArrowRight size={14} />
                            </Link>
                        </div>
                        {events.length === 0 ? (
                            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>No exams or study blocks scheduled right now.</p>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
                                {events.slice(0, 3).map(evt => (
                                    <div key={evt.id} style={{
                                        padding: '1rem',
                                        borderRadius: 'var(--radius-sm)',
                                        background: evt.type === 'exam' ? 'rgba(239, 68, 68, 0.05)' : evt.type === 'test_prep' ? 'rgba(79, 70, 229, 0.05)' : 'rgba(16, 185, 129, 0.05)',
                                        borderLeft: `3px solid ${evt.type === 'exam' ? '#EF4444' : evt.type === 'test_prep' ? '#4F46E5' : '#10B981'}`,
                                        border: '1px solid var(--border)'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                                            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: evt.type === 'exam' ? '#B91C1C' : evt.type === 'test_prep' ? '#4338CA' : '#047857' }}>
                                                {evt.type === 'exam' ? '🎓 School Exam' : evt.type === 'test_prep' ? '📝 Test Prep' : '⏱️ Study Block'}
                                            </span>
                                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                                                {evt.date} {evt.startTime ? `• ${evt.startTime}` : ''}
                                            </span>
                                        </div>
                                        <h4 style={{ margin: '0 0 0.35rem', fontSize: '0.95rem' }}>{evt.title}</h4>
                                        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>{evt.subject} {evt.description ? `• ${evt.description}` : ''}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1fr)', gap: '2rem' }}>
                        <div>
                            <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                🚀 Up Next
                            </h2>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {pendingTests.map((test) => (
                                    <div key={test.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem' }}>
                                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                            <div style={{ background: 'var(--surface-hover)', padding: '1rem', borderRadius: 'var(--radius-md)', color: 'var(--primary)' }}>
                                                <FileText size={24} />
                                            </div>
                                            <div>
                                                <h4 style={{ fontSize: '1.125rem', margin: '0 0 0.25rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    {test.title}
                                                    {(() => {
                                                        if (!test.dueDate) return null;
                                                        const dueD = new Date(test.dueDate);
                                                        const now = new Date();
                                                        const diffHours = (dueD.getTime() - now.getTime()) / (1000 * 60 * 60);
                                                        if (diffHours < 0) return <span style={{ fontSize: '0.7rem', background: '#fee2e2', color: '#dc2626', padding: '0.15rem 0.5rem', borderRadius: '1rem', fontWeight: 600 }}>Overdue</span>;
                                                        if (diffHours < 48) return <span style={{ fontSize: '0.7rem', background: '#fef3c7', color: '#d97706', padding: '0.15rem 0.5rem', borderRadius: '1rem', fontWeight: 600 }}>Due Soon</span>;
                                                        return null;
                                                    })()}
                                                </h4>
                                                <div style={{ display: 'flex', gap: '1rem', color: 'var(--text-muted)', fontSize: '0.875rem', flexWrap: 'wrap' }}>
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                        <BookOpen size={14} /> {test.subject}
                                                    </span>
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                        <Clock size={14} /> {test.duration}
                                                    </span>
                                                    {test.dueDate && (
                                                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: new Date(test.dueDate) < new Date() ? '#dc2626' : 'inherit' }}>
                                                            <Calendar size={14} /> {new Date(test.dueDate).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <button className="btn btn-primary" onClick={() => setActiveTestId(test.id)} style={{ padding: '0.5rem 1rem', borderRadius: '2rem' }}>
                                            <Play size={16} /> Start
                                        </button>
                                    </div>
                                ))}
                                {pendingTests.length === 0 && (
                                    <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0' }}>No pending tests. Take a break!</p>
                                )}
                            </div>
                        </div>

                        <div>
                            <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>✅ completed</h2>
                            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                                {completedTests.map((test, idx) => (
                                    <div key={test.id} style={{
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        padding: '1rem 0', borderBottom: idx !== completedTests.length - 1 ? '1px solid var(--border)' : 'none'
                                    }}>
                                        <div>
                                            <h4 style={{ fontWeight: 600, margin: '0 0 0.25rem 0' }}>{test.title}</h4>
                                            <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.875rem' }}>
                                                {test.completedAt ? new Date(test.completedAt).toLocaleDateString() : 'Just now'} • {test.subject}
                                            </p>
                                        </div>
                                        <button onClick={() => setReviewTestId(test.id)} style={{
                                            background: (test.score || 0) >= 90 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(79, 70, 229, 0.1)',
                                            color: (test.score || 0) >= 90 ? 'var(--secondary)' : 'var(--primary)',
                                            padding: '0.25rem 0.75rem', borderRadius: '1rem', fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'var(--transition)'
                                        }} className="hover-lift" title="Review Test">
                                            {test.score}%
                                        </button>
                                    </div>
                                ))}
                                {completedTests.length === 0 && (
                                    <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0' }}>No completed tests yet.</p>
                                )}
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default StudentDashboard;
