import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { 
    BookOpen, Clock, Play, FileText, Award, Book, AlertCircle, 
    User as UserIcon, Calendar, ArrowRight, Camera, CheckCircle2, 
    Sparkles, Smartphone, X, Eye, AlertTriangle, History
} from 'lucide-react';
import useAuthStore from '../store/authStore';
import useAppStore, { type DailyHomework } from '../store/appStore';
import useCalendarStore from '../store/calendarStore';
import { supabase } from '../lib/supabase';
import TestTaker from '../components/TestTaker';
import TestReview from '../components/TestReview';

const StudentDashboard = () => {
    const user = useAuthStore((state) => state.user);
    const tests = useAppStore((state) => state.tests);
    const fetchTests = useAppStore((state) => state.fetchTests);
    const dailyHomeworkList = useAppStore((state) => state.dailyHomeworkList);
    const fetchDailyHomework = useAppStore((state) => state.fetchDailyHomework);
    const submitAndVerifyDailyHomework = useAppStore((state) => state.submitAndVerifyDailyHomework);
    const { events, fetchEvents } = useCalendarStore();

    useEffect(() => {
        fetchDailyHomework();
        if (user?.parentId) {
            fetchTests();
            fetchEvents();
        }
    }, [fetchDailyHomework, fetchTests, fetchEvents, user?.parentId]);

    const logout = useAuthStore((state) => state.logout);

    const pendingTests = tests.filter(t => t.status === 'pending');
    const completedTests = tests.filter(t => t.status === 'completed');

    // Filter homework for this student, or all if demo/unassigned
    const studentHomework = dailyHomeworkList.filter(h => {
        if (!user) return true;
        if (!h.childId || h.childId === user.id) return true;
        if (h.childName && user.name && h.childName.toLowerCase().includes(user.name.toLowerCase())) return true;
        return true;
    });

    const pendingHomeworkCount = studentHomework.filter(h => h.status === 'pending' || h.status === 'needs_revision').length;

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

    // Homework submission modal state
    const [submittingHw, setSubmittingHw] = useState<DailyHomework | null>(null);
    const [submissionFiles, setSubmissionFiles] = useState<File[]>([]);
    const [submissionPreviews, setSubmissionPreviews] = useState<string[]>([]);
    const [submissionNotes, setSubmissionNotes] = useState('');
    const [isVerifyingHw, setIsVerifyingHw] = useState(false);
    const [verifyError, setVerifyError] = useState<string | null>(null);
    const [verifySuccessResult, setVerifySuccessResult] = useState<any | null>(null);
    const notebookInputRef = useRef<HTMLInputElement>(null);

    // Lightbox & detail modal state
    const [studentTab, setStudentTab] = useState<'active' | 'history'>('active');
    const [viewingHwModal, setViewingHwModal] = useState<DailyHomework | null>(null);
    const [viewingLightboxImg, setViewingLightboxImg] = useState<string | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const newFiles = Array.from(e.target.files);
        setSubmissionFiles(prev => [...prev, ...newFiles]);
        const newPreviews = newFiles.map(f => f.type.startsWith('image/') ? URL.createObjectURL(f) : '');
        setSubmissionPreviews(prev => [...prev, ...newPreviews]);
        setVerifyError(null);
    };

    const removeSubmissionFile = (index: number) => {
        setSubmissionFiles(prev => prev.filter((_, i) => i !== index));
        setSubmissionPreviews(prev => prev.filter((_, i) => i !== index));
    };

    const handleVerifyHomework = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!submittingHw) return;
        if (submissionFiles.length === 0) {
            setVerifyError('Please snap or upload photos of your completed notebook.');
            return;
        }

        setIsVerifyingHw(true);
        setVerifyError(null);
        try {
            const verifiedItem = await submitAndVerifyDailyHomework(
                submittingHw.id,
                submissionFiles,
                submissionNotes
            );
            if (verifiedItem) {
                setVerifySuccessResult(verifiedItem.verificationResult);
            }
            fetchDailyHomework();
        } catch (err: any) {
            setVerifyError(err.message || 'Verification failed. Please try again.');
        } finally {
            setIsVerifyingHw(false);
        }
    };

    const closeSubmissionModal = () => {
        setSubmittingHw(null);
        setSubmissionFiles([]);
        setSubmissionPreviews([]);
        setSubmissionNotes('');
        setVerifySuccessResult(null);
        setVerifyError(null);
    };

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

                    <div className="stats-grid-responsive" style={{ marginBottom: '1.5rem' }}>
                        <div
                            className="card hover-lift"
                            onClick={() => setStudentTab('active')}
                            style={{ background: 'linear-gradient(135deg, var(--primary), #818cf8)', color: 'white', border: 'none', padding: '1.15rem', cursor: 'pointer' }}
                            title="View today's daily homework"
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                                <div style={{ background: 'rgba(255,255,255,0.2)', padding: '0.65rem', borderRadius: 'var(--radius-md)' }}>
                                    <Smartphone size={22} color="white" />
                                </div>
                                <span style={{ fontWeight: 700, fontSize: '1.4rem' }}>{pendingHomeworkCount}</span>
                            </div>
                            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.15rem', color: 'white' }}>Daily Homework</h3>
                            <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.78rem', margin: 0 }}>
                                {pendingHomeworkCount > 0 ? `${pendingHomeworkCount} pending notebook snap` : 'All caught up! 🎉'}
                            </p>
                        </div>

                        <div
                            className="card hover-lift"
                            onClick={() => setStudentTab('active')}
                            style={{ padding: '1.15rem', cursor: 'pointer' }}
                            title="View pending practice tests"
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                                <div style={{ background: 'rgba(79, 70, 229, 0.1)', color: 'var(--primary)', padding: '0.65rem', borderRadius: 'var(--radius-md)' }}>
                                    <AlertCircle size={22} />
                                </div>
                                <span style={{ fontWeight: 700, fontSize: '1.4rem' }}>{pendingTests.length}</span>
                            </div>
                            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.15rem' }}>Practice Tests</h3>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', margin: 0 }}>Awaiting online completion</p>
                        </div>

                        <div
                            className="card hover-lift"
                            onClick={() => setStudentTab('history')}
                            style={{ padding: '1.15rem', cursor: 'pointer' }}
                            title="View completed tests and homework history"
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                                <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--secondary)', padding: '0.65rem', borderRadius: 'var(--radius-md)' }}>
                                    <Award size={22} />
                                </div>
                                <span style={{ fontWeight: 700, fontSize: '1.4rem' }}>
                                    {completedTests.length > 0 ? Math.round(completedTests.reduce((acc, curr) => acc + (curr.score || 0), 0) / completedTests.length) : 0}%
                                </span>
                            </div>
                            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.15rem' }}>Average Score</h3>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', margin: 0 }}>View completed history →</p>
                        </div>

                        <Link to="/calendar" className="card hover-lift" style={{ textDecoration: 'none', color: 'inherit', padding: '1.15rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                                <div style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#d97706', padding: '0.65rem', borderRadius: 'var(--radius-md)' }}>
                                    <Calendar size={22} />
                                </div>
                                <span style={{ fontWeight: 700, fontSize: '1.4rem', color: '#d97706' }}>{events.length}</span>
                            </div>
                            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.15rem' }}>Study & Exams</h3>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', margin: 0 }}>Schedule calendar →</p>
                        </Link>
                    </div>

                    {/* Student View Switcher */}
                    <div className="dashboard-tabs-container" role="tablist" aria-label="Student View Switcher" style={{ marginBottom: '1.75rem' }}>
                        <button
                            type="button"
                            role="tab"
                            id="student-tab-active"
                            aria-selected={studentTab === 'active'}
                            className={`dashboard-tab-btn ${studentTab === 'active' ? 'active' : ''}`}
                            onClick={() => setStudentTab('active')}
                        >
                            <BookOpen size={16} /> Active Tasks & Homework ({pendingHomeworkCount + pendingTests.length})
                        </button>
                        <button
                            type="button"
                            role="tab"
                            id="student-tab-history"
                            aria-selected={studentTab === 'history'}
                            className={`dashboard-tab-btn ${studentTab === 'history' ? 'active' : ''}`}
                            onClick={() => setStudentTab('history')}
                        >
                            <History size={16} /> Completed History ({studentHomework.filter(h => h.status === 'verified' || h.submissionStatus === 'verified_complete' || h.verificationResult).length + completedTests.length})
                        </button>
                    </div>

                    {/* VIEW A: ACTIVE TASKS & HOMEWORK */}
                    {studentTab === 'active' && (
                        <>
                            {/* SECTION: TODAY'S SCHOOL DAILY HOMEWORK (WHATSAPP / TEAMS) */}
                            <div className="card" style={{ marginBottom: '2rem', border: '1.5px solid var(--border)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                                    <div>
                                        <h2 style={{ fontSize: '1.3rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <Smartphone size={22} color="var(--primary)" /> Today's School Daily Homework
                                        </h2>
                                        <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                                            Homework from WhatsApp / Teams. Snap photos of your solved notebook to verify completion!
                                        </p>
                                    </div>
                                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                                        {studentHomework.length} assigned
                                    </span>
                                </div>

                                {studentHomework.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)' }}>
                                        <Smartphone size={32} style={{ margin: '0 auto 0.5rem', opacity: 0.5 }} />
                                        <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600 }}>No school homework uploaded by parent yet.</p>
                                        <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem' }}>When your parent uploads homework from WhatsApp or Teams, it will appear here.</p>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                        {studentHomework.map(hw => {
                                            const sourceClass = hw.source === 'whatsapp' ? 'source-pill-whatsapp' : hw.source === 'teams' ? 'source-pill-teams' : 'source-pill-diary';
                                            const sourceLabel = hw.source === 'whatsapp' ? '🟢 WhatsApp' : hw.source === 'teams' ? '🟣 Teams' : hw.source === 'diary' ? '📔 Diary' : '✏️ Manual';
                                            const isDone = hw.status === 'verified' || hw.submissionStatus === 'verified_complete';
                                            const needsRev = hw.status === 'needs_revision' || hw.submissionStatus === 'needs_revision';

                                            return (
                                                <div key={hw.id} style={{
                                                    padding: '1.15rem',
                                                    border: `1.5px solid ${isDone ? 'rgba(16, 185, 129, 0.3)' : needsRev ? 'rgba(239, 68, 68, 0.3)' : 'var(--border)'}`,
                                                    borderRadius: 'var(--radius-md)',
                                                    background: isDone ? 'rgba(16, 185, 129, 0.02)' : 'var(--surface)',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    gap: '0.85rem'
                                                }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                                                        <div>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                                                                <span className={`source-pill ${sourceClass}`}>{sourceLabel}</span>
                                                                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--primary)' }}>{hw.subject}</span>
                                                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>• Due {hw.dueDate}</span>
                                                            </div>
                                                            <h3 style={{ margin: '0 0 0.25rem', fontSize: '1.1rem', fontWeight: 700 }}>{hw.title}</h3>
                                                            {hw.description && (
                                                                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>{hw.description}</p>
                                                            )}
                                                        </div>

                                                        <div>
                                                            {isDone ? (
                                                                <span className="status-badge badge-verified">
                                                                    ✓ Verified Complete • {hw.verificationResult?.completenessScore || 90}%
                                                                </span>
                                                            ) : needsRev ? (
                                                                <span className="status-badge badge-revision">
                                                                    ⚠️ Revision Needed • {hw.verificationResult?.completenessScore || 50}%
                                                                </span>
                                                            ) : (
                                                                <span className="status-badge badge-pending">
                                                                    ⏳ Solved Notebook Needed
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Image previews and Action Row */}
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.85rem', padding: '0.75rem', background: 'var(--surface-hover)', borderRadius: 'var(--radius-sm)' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                                                            {/* Teacher Assignment Preview */}
                                                            {hw.originalFiles && hw.originalFiles[0] && (
                                                                <div
                                                                    onClick={() => setViewingLightboxImg(hw.originalFiles![0])}
                                                                    style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}
                                                                    title="Click to view full image"
                                                                >
                                                                    <img
                                                                        src={hw.originalFiles[0]}
                                                                        alt="Assignment page"
                                                                        style={{ width: '42px', height: '42px', objectFit: 'cover', borderRadius: '4px', border: '1px solid var(--border)' }}
                                                                    />
                                                                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                                                                        Teacher's Homework 🔍
                                                                    </span>
                                                                </div>
                                                            )}

                                                            {/* Student Notebook Preview (if already submitted) */}
                                                            {hw.studentSubmissionFiles && hw.studentSubmissionFiles[0] && (
                                                                <div
                                                                    onClick={() => setViewingLightboxImg(hw.studentSubmissionFiles![0])}
                                                                    style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}
                                                                    title="Click to view solved notebook"
                                                                >
                                                                    <img
                                                                        src={hw.studentSubmissionFiles[0]}
                                                                        alt="Solved notebook"
                                                                        style={{ width: '42px', height: '42px', objectFit: 'cover', borderRadius: '4px', border: '2px solid #10b981' }}
                                                                    />
                                                                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#10b981' }}>
                                                                        Your Solved Notebook ✍️
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Actions */}
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                            {isDone || hw.verificationResult ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setViewingHwModal(hw)}
                                                                    className="hover-lift"
                                                                    style={{
                                                                        background: 'rgba(16, 185, 129, 0.1)',
                                                                        color: '#047857',
                                                                        border: '1px solid rgba(16, 185, 129, 0.3)',
                                                                        borderRadius: '2rem',
                                                                        padding: '0.45rem 0.95rem',
                                                                        fontWeight: 600,
                                                                        fontSize: '0.82rem',
                                                                        cursor: 'pointer',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        gap: '0.35rem'
                                                                    }}
                                                                >
                                                                    <Eye size={14} /> View AI Teacher Feedback
                                                                </button>
                                                            ) : null}

                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setSubmittingHw(hw);
                                                                    setSubmissionFiles([]);
                                                                    setSubmissionPreviews([]);
                                                                    setSubmissionNotes('');
                                                                    setVerifySuccessResult(null);
                                                                    setVerifyError(null);
                                                                }}
                                                                className="hover-lift"
                                                                style={{
                                                                    background: isDone
                                                                        ? 'var(--surface)'
                                                                        : 'linear-gradient(135deg, var(--primary) 0%, #6366f1 100%)',
                                                                    color: isDone ? 'var(--text-main)' : 'white',
                                                                    border: isDone ? '1px solid var(--border)' : 'none',
                                                                    borderRadius: '2rem',
                                                                    padding: '0.5rem 1rem',
                                                                    fontWeight: 700,
                                                                    fontSize: '0.84rem',
                                                                    cursor: 'pointer',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '0.4rem',
                                                                    boxShadow: isDone ? 'none' : '0 2px 8px rgba(79, 70, 229, 0.3)'
                                                                }}
                                                            >
                                                                <Camera size={15} />
                                                                {isDone ? 'Re-upload Notebook' : needsRev ? '📸 Re-snap & Verify' : '📸 Snap Solved Notebook & Verify'}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Upcoming Study Blocks & Exams Widget */}
                            <div className="card" style={{ marginBottom: '2rem', padding: '1.25rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                                    <h2 style={{ fontSize: '1.2rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <Calendar size={20} color="var(--primary)" /> Scheduled Study Time & Upcoming Exams
                                    </h2>
                                    <Link to="/calendar" className="btn btn-secondary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}>
                                        Full Calendar <ArrowRight size={13} />
                                    </Link>
                                </div>
                                {events.length === 0 ? (
                                    <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' }}>No exams or study blocks scheduled right now.</p>
                                ) : (
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.85rem' }}>
                                        {events.slice(0, 3).map(evt => (
                                            <div key={evt.id} style={{
                                                padding: '0.85rem',
                                                borderRadius: 'var(--radius-sm)',
                                                background: evt.type === 'exam' ? 'rgba(239, 68, 68, 0.05)' : evt.type === 'test_prep' ? 'rgba(79, 70, 229, 0.05)' : 'rgba(16, 185, 129, 0.05)',
                                                borderLeft: `3px solid ${evt.type === 'exam' ? '#EF4444' : evt.type === 'test_prep' ? '#4F46E5' : '#10B981'}`,
                                                border: '1px solid var(--border)'
                                            }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                                                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: evt.type === 'exam' ? '#B91C1C' : evt.type === 'test_prep' ? '#4338CA' : '#047857' }}>
                                                        {evt.type === 'exam' ? '🎓 School Exam' : evt.type === 'test_prep' ? '📝 Test Prep' : '⏱️ Study Block'}
                                                    </span>
                                                    <span style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                                                        {evt.date} {evt.startTime ? `• ${evt.startTime}` : ''}
                                                    </span>
                                                </div>
                                                <h4 style={{ margin: '0 0 0.25rem', fontSize: '0.92rem' }}>{evt.title}</h4>
                                                <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>{evt.subject} {evt.description ? `• ${evt.description}` : ''}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Up Next: Pending Practice Tests */}
                            <div className="card" style={{ marginBottom: '2rem' }}>
                                <h2 style={{ fontSize: '1.3rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    🚀 Practice Tests To Complete
                                </h2>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                                    {pendingTests.map((test) => (
                                        <div key={test.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', flexWrap: 'wrap', gap: '0.5rem' }}>
                                            <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'center' }}>
                                                <div style={{ background: 'var(--surface-hover)', padding: '0.75rem', borderRadius: 'var(--radius-md)', color: 'var(--primary)' }}>
                                                    <FileText size={22} />
                                                </div>
                                                <div>
                                                    <h4 style={{ fontSize: '1.05rem', margin: '0 0 0.2rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        {test.title}
                                                    </h4>
                                                    <div style={{ display: 'flex', gap: '0.75rem', color: 'var(--text-muted)', fontSize: '0.8rem', flexWrap: 'wrap' }}>
                                                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                            <BookOpen size={13} /> {test.subject}
                                                        </span>
                                                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                            <Clock size={13} /> {test.duration}
                                                        </span>
                                                        {test.dueDate && (
                                                            <span>• Due: {new Date(test.dueDate).toLocaleDateString()}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <button className="btn btn-primary" onClick={() => setActiveTestId(test.id)} style={{ padding: '0.45rem 1rem', borderRadius: '2rem' }}>
                                                <Play size={14} /> Start
                                            </button>
                                        </div>
                                    ))}
                                    {pendingTests.length === 0 && (
                                        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1.5rem 0', margin: 0, fontSize: '0.85rem' }}>
                                            No pending practice tests right now. Great job!
                                        </p>
                                    )}
                                </div>
                            </div>
                        </>
                    )}

                    {/* VIEW B: COMPLETED HISTORY */}
                    {studentTab === 'history' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2rem' }}>
                            {/* Completed School Homework */}
                            <div className="card">
                                <h2 style={{ fontSize: '1.25rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <CheckCircle2 size={20} color="#10b981" /> Completed School Homework ({studentHomework.filter(h => h.status === 'verified' || h.submissionStatus === 'verified_complete' || h.verificationResult).length})
                                </h2>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                                    {studentHomework.filter(h => h.status === 'verified' || h.submissionStatus === 'verified_complete' || h.verificationResult).map(hw => (
                                        <div key={hw.id} className="history-item-card" style={{ borderLeft: '3px solid #10b981' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                                                <div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                                                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)' }}>{hw.subject}</span>
                                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>• Done {hw.submittedAt ? new Date(hw.submittedAt).toLocaleDateString() : 'Recently'}</span>
                                                    </div>
                                                    <h4 style={{ margin: '0 0 0.2rem', fontSize: '1rem', fontWeight: 700 }}>{hw.title}</h4>
                                                    {hw.verificationResult?.summary && (
                                                        <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-main)' }}>{hw.verificationResult.summary}</p>
                                                    )}
                                                </div>
                                                <span style={{
                                                    background: 'rgba(16, 185, 129, 0.12)',
                                                    color: '#047857',
                                                    border: '1px solid rgba(16, 185, 129, 0.3)',
                                                    padding: '0.25rem 0.65rem',
                                                    borderRadius: '1rem',
                                                    fontWeight: 800,
                                                    fontSize: '0.8rem'
                                                }}>
                                                    {hw.verificationResult?.completenessScore || 90}% Completeness
                                                </span>
                                            </div>

                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.5rem', borderTop: '1px solid var(--border)', flexWrap: 'wrap', gap: '0.5rem' }}>
                                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                    {hw.verificationResult?.completedQuestions?.length || 0} questions completed in notebook
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => setViewingHwModal(hw)}
                                                    className="btn btn-secondary"
                                                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}
                                                >
                                                    <Eye size={13} /> View AI Teacher Feedback
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    {studentHomework.filter(h => h.status === 'verified' || h.submissionStatus === 'verified_complete' || h.verificationResult).length === 0 && (
                                        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1.5rem 0', margin: 0, fontSize: '0.85rem' }}>
                                            No completed school homework yet. Snap and submit your notebook above!
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Completed Practice Tests */}
                            <div className="card">
                                <h2 style={{ fontSize: '1.25rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Award size={20} color="var(--primary)" /> Completed Practice Tests ({completedTests.length})
                                </h2>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                                    {completedTests.map(test => (
                                        <div key={test.id} className="history-item-card" style={{ borderLeft: '3px solid var(--primary)' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                                                <div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                                                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)' }}>{test.subject}</span>
                                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>• Taken {test.completedAt ? new Date(test.completedAt).toLocaleDateString() : 'Recently'}</span>
                                                    </div>
                                                    <h4 style={{ margin: '0 0 0.2rem', fontSize: '1rem', fontWeight: 700 }}>{test.title}</h4>
                                                    {test.roughWorkEvaluation && (
                                                        <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--secondary)', fontWeight: 600 }}>
                                                            ✍️ Step & Rough Work Score: {test.roughWorkEvaluation.accuracyScore}%
                                                        </p>
                                                    )}
                                                </div>

                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    <span style={{
                                                        background: (test.score || 0) >= 80 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(79, 70, 229, 0.12)',
                                                        color: (test.score || 0) >= 80 ? '#047857' : 'var(--primary)',
                                                        padding: '0.25rem 0.65rem',
                                                        borderRadius: '1rem',
                                                        fontWeight: 800,
                                                        fontSize: '0.85rem'
                                                    }}>
                                                        {test.score}%
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => setReviewTestId(test.id)}
                                                        className="hover-lift"
                                                        style={{
                                                            background: 'var(--surface-hover)',
                                                            color: 'var(--text-main)',
                                                            border: '1px solid var(--border)',
                                                            borderRadius: 'var(--radius-sm)',
                                                            padding: '0.35rem 0.75rem',
                                                            fontWeight: 600,
                                                            fontSize: '0.78rem',
                                                            cursor: 'pointer'
                                                        }}
                                                    >
                                                        Review Answers →
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {completedTests.length === 0 && (
                                        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1.5rem 0', margin: 0, fontSize: '0.85rem' }}>
                                            No completed tests yet. Start a test from the Active Tasks tab!
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* MODAL: SUBMIT SOLVED NOTEBOOK & AI VERIFICATION */}
                    {submittingHw && (
                        <div
                            role="dialog"
                            aria-modal="true"
                            style={{
                                position: 'fixed',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                background: 'rgba(0,0,0,0.65)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '1rem',
                                zIndex: 9999,
                                backdropFilter: 'blur(4px)'
                            }}
                        >
                            <div
                                className="card animate-fade-in"
                                style={{
                                    width: '100%',
                                    maxWidth: '600px',
                                    maxHeight: '92vh',
                                    overflowY: 'auto',
                                    padding: '1.5rem',
                                    position: 'relative'
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                                    <div>
                                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase' }}>
                                            {submittingHw.subject} • School Homework
                                        </span>
                                        <h2 style={{ fontSize: '1.25rem', margin: '0.2rem 0 0', fontWeight: 700 }}>
                                            📸 Submit Solved Notebook
                                        </h2>
                                        <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                            {submittingHw.title}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={closeSubmissionModal}
                                        style={{
                                            background: 'var(--surface-hover)',
                                            border: 'none',
                                            borderRadius: '50%',
                                            width: '32px',
                                            height: '32px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            cursor: 'pointer',
                                            color: 'var(--text-muted)'
                                        }}
                                    >
                                        <X size={18} />
                                    </button>
                                </div>

                                {/* Verification Result View if already verified */}
                                {verifySuccessResult ? (
                                    <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
                                        <div style={{
                                            background: verifySuccessResult.completenessScore >= 80 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                                            width: '64px',
                                            height: '64px',
                                            borderRadius: '50%',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            margin: '0 auto 1rem',
                                            color: verifySuccessResult.completenessScore >= 80 ? 'var(--secondary)' : '#d97706'
                                        }}>
                                            {verifySuccessResult.completenessScore >= 80 ? <CheckCircle2 size={36} /> : <AlertTriangle size={36} />}
                                        </div>

                                        <span style={{
                                            fontSize: '0.8rem',
                                            fontWeight: 700,
                                            textTransform: 'uppercase',
                                            color: verifySuccessResult.completenessScore >= 80 ? '#047857' : '#b45309'
                                        }}>
                                            {verifySuccessResult.status === 'verified_complete' ? '🎉 VERIFIED COMPLETE!' : '⚠️ REVISION NEEDED'}
                                        </span>
                                        <h3 style={{ margin: '0.25rem 0 0.5rem', fontSize: '1.5rem', fontWeight: 800 }}>
                                            {verifySuccessResult.completenessScore}% Completeness
                                        </h3>

                                        {/* Coaching Feedback */}
                                        <div style={{
                                            padding: '1rem',
                                            background: 'var(--surface-hover)',
                                            borderRadius: 'var(--radius-md)',
                                            border: '1px solid var(--border)',
                                            textAlign: 'left',
                                            margin: '1.25rem 0',
                                            fontSize: '0.88rem',
                                            lineHeight: '1.5'
                                        }}>
                                            <p style={{ margin: '0 0 0.4rem', fontWeight: 700, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                                <Sparkles size={16} /> AI Teacher Feedback:
                                            </p>
                                            {verifySuccessResult.coachingFeedback}
                                        </div>

                                        <button
                                            type="button"
                                            onClick={closeSubmissionModal}
                                            className="btn btn-primary"
                                            style={{ width: '100%', justifyContent: 'center' }}
                                        >
                                            Awesome, Done!
                                        </button>
                                    </div>
                                ) : (
                                    <form onSubmit={handleVerifyHomework} style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
                                        {/* Reference to teacher's original assignment */}
                                        {submittingHw.originalFiles && submittingHw.originalFiles[0] && (
                                            <div style={{ padding: '0.75rem', background: 'var(--surface-hover)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                <img
                                                    src={submittingHw.originalFiles[0]}
                                                    alt="Original assignment"
                                                    style={{ width: '44px', height: '44px', objectFit: 'cover', borderRadius: '4px' }}
                                                />
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                                                        COMPARE AGAINST TEACHER'S HOMEWORK:
                                                    </p>
                                                    <p style={{ margin: '0.1rem 0 0', fontSize: '0.85rem', fontWeight: 600 }}>{submittingHw.title}</p>
                                                </div>
                                            </div>
                                        )}

                                        {/* Student Notebook Photo Upload */}
                                        <div>
                                            <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.4rem' }}>
                                                Photos of your Solved Notebook
                                            </label>
                                            <label style={{
                                                display: 'block',
                                                border: `2px dashed ${submissionFiles.length > 0 ? '#10b981' : 'var(--primary)'}`,
                                                borderRadius: 'var(--radius-md)',
                                                padding: '1.5rem 1rem',
                                                textAlign: 'center',
                                                cursor: 'pointer',
                                                background: submissionFiles.length > 0 ? 'rgba(16, 185, 129, 0.04)' : 'rgba(79, 70, 229, 0.04)',
                                                transition: 'var(--transition)'
                                            }}>
                                                <input
                                                    ref={notebookInputRef}
                                                    type="file"
                                                    style={{ display: 'none' }}
                                                    onChange={handleFileChange}
                                                    accept="image/*"
                                                    capture="environment"
                                                    multiple
                                                />
                                                <div style={{ color: 'var(--text-muted)' }}>
                                                    <Camera size={32} style={{ margin: '0 auto 0.4rem', color: submissionFiles.length > 0 ? '#10b981' : 'var(--primary)' }} />
                                                    <p style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-main)' }}>
                                                        Snap Photo with Phone Camera or Pick File
                                                    </p>
                                                    <p style={{ margin: '0.2rem 0 0', fontSize: '0.78rem' }}>
                                                        Take clear photos of all solved pages in your notebook
                                                    </p>
                                                </div>
                                            </label>

                                            {/* Previews */}
                                            {submissionPreviews.length > 0 && (
                                                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
                                                    {submissionPreviews.map((preview, idx) => (
                                                        <div key={idx} style={{ position: 'relative', width: '75px', height: '75px', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '2px solid #10b981' }}>
                                                            <img src={preview} alt={`Page ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                            <button
                                                                type="button"
                                                                onClick={() => removeSubmissionFile(idx)}
                                                                style={{
                                                                    position: 'absolute',
                                                                    top: '2px',
                                                                    right: '2px',
                                                                    background: 'rgba(0,0,0,0.7)',
                                                                    color: 'white',
                                                                    border: 'none',
                                                                    borderRadius: '50%',
                                                                    width: '20px',
                                                                    height: '20px',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    cursor: 'pointer'
                                                                }}
                                                            >
                                                                <X size={12} />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {/* Notes from student */}
                                        <div>
                                            <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.4rem' }}>
                                                Notes (Optional)
                                            </label>
                                            <input
                                                type="text"
                                                value={submissionNotes}
                                                onChange={e => setSubmissionNotes(e.target.value)}
                                                placeholder="e.g. Solved all 8 questions, rough calculations on page 2"
                                                style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--surface)', fontSize: '0.9rem' }}
                                            />
                                        </div>

                                        {verifyError && (
                                            <div style={{ padding: '0.75rem', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 'var(--radius-md)', color: '#dc2626', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <AlertTriangle size={16} />
                                                <span>{verifyError}</span>
                                            </div>
                                        )}

                                        <button
                                            type="submit"
                                            disabled={isVerifyingHw || submissionFiles.length === 0}
                                            className="btn btn-primary"
                                            style={{
                                                width: '100%',
                                                justifyContent: 'center',
                                                padding: '0.85rem',
                                                fontSize: '0.95rem',
                                                background: 'linear-gradient(135deg, var(--primary) 0%, #6366f1 100%)',
                                                opacity: submissionFiles.length === 0 ? 0.6 : 1
                                            }}
                                        >
                                            {isVerifyingHw ? (
                                                <>
                                                    <span style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
                                                    AI is verifying your notebook against homework...
                                                </>
                                            ) : (
                                                <>
                                                    <Sparkles size={16} />
                                                    Verify & Mark as Complete
                                                </>
                                            )}
                                        </button>
                                    </form>
                                )}
                            </div>
                        </div>
                    )}

                    {/* MODAL: VIEW HOMEWORK EVALUATION */}
                    {viewingHwModal && (
                        <div
                            role="dialog"
                            aria-modal="true"
                            style={{
                                position: 'fixed',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                background: 'rgba(0,0,0,0.65)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '1rem',
                                zIndex: 9999,
                                backdropFilter: 'blur(4px)'
                            }}
                        >
                            <div
                                className="card animate-fade-in"
                                style={{
                                    width: '100%',
                                    maxWidth: '600px',
                                    maxHeight: '90vh',
                                    overflowY: 'auto',
                                    padding: '1.5rem',
                                    position: 'relative'
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                                    <div>
                                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase' }}>
                                            {viewingHwModal.subject} • Evaluation
                                        </span>
                                        <h2 style={{ fontSize: '1.25rem', margin: '0.2rem 0 0', fontWeight: 700 }}>
                                            {viewingHwModal.title}
                                        </h2>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setViewingHwModal(null)}
                                        style={{
                                            background: 'var(--surface-hover)',
                                            border: 'none',
                                            borderRadius: '50%',
                                            width: '32px',
                                            height: '32px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            cursor: 'pointer',
                                            color: 'var(--text-muted)'
                                        }}
                                    >
                                        <X size={18} />
                                    </button>
                                </div>

                                {viewingHwModal.verificationResult && (
                                    <>
                                        <div style={{
                                            padding: '1rem',
                                            borderRadius: 'var(--radius-md)',
                                            background: viewingHwModal.verificationResult.completenessScore >= 80 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                                            border: `1.5px solid ${viewingHwModal.verificationResult.completenessScore >= 80 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
                                            marginBottom: '1.25rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            flexWrap: 'wrap',
                                            gap: '0.75rem'
                                        }}>
                                            <div>
                                                <h3 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: viewingHwModal.verificationResult.completenessScore >= 80 ? '#047857' : '#b45309' }}>
                                                    {viewingHwModal.verificationResult.completenessScore}% Completeness
                                                </h3>
                                                <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                    {viewingHwModal.verificationResult.status === 'verified_complete' ? 'Marked complete by AI' : 'Needs additional practice'}
                                                </p>
                                            </div>
                                            <span style={{
                                                padding: '0.35rem 0.85rem',
                                                borderRadius: '2rem',
                                                background: viewingHwModal.verificationResult.completenessScore >= 80 ? '#10b981' : '#f59e0b',
                                                color: 'white',
                                                fontWeight: 700,
                                                fontSize: '0.82rem'
                                            }}>
                                                {viewingHwModal.verificationResult.status === 'verified_complete' ? 'Completed ✓' : 'Partial'}
                                            </span>
                                        </div>

                                        {viewingHwModal.verificationResult.coachingFeedback && (
                                            <div style={{ marginBottom: '1.25rem' }}>
                                                <h4 style={{ fontSize: '0.9rem', margin: '0 0 0.4rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                                    <Sparkles size={16} /> Teacher's Coaching Feedback
                                                </h4>
                                                <div style={{ padding: '0.85rem 1rem', background: 'var(--surface-hover)', borderRadius: 'var(--radius-md)', fontSize: '0.88rem', lineHeight: '1.5', border: '1px solid var(--border)' }}>
                                                    {viewingHwModal.verificationResult.coachingFeedback}
                                                </div>
                                            </div>
                                        )}

                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem', marginBottom: '1.25rem' }}>
                                            <div style={{ padding: '0.85rem', background: 'rgba(16, 185, 129, 0.05)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                                                <h5 style={{ margin: '0 0 0.4rem', fontSize: '0.82rem', fontWeight: 700, color: '#047857' }}>Completed Questions</h5>
                                                <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.8rem', lineHeight: '1.5' }}>
                                                    {viewingHwModal.verificationResult.completedQuestions.map((q, i) => (
                                                        <li key={i}>{q}</li>
                                                    ))}
                                                </ul>
                                            </div>

                                            <div style={{ padding: '0.85rem', background: 'rgba(239, 68, 68, 0.05)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                                                <h5 style={{ margin: '0 0 0.4rem', fontSize: '0.82rem', fontWeight: 700, color: '#dc2626' }}>Missing / Need Practice</h5>
                                                {viewingHwModal.verificationResult.missingQuestions.length > 0 ? (
                                                    <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.8rem', lineHeight: '1.5' }}>
                                                        {viewingHwModal.verificationResult.missingQuestions.map((q, i) => (
                                                            <li key={i}>{q}</li>
                                                        ))}
                                                    </ul>
                                                ) : (
                                                    <p style={{ margin: 0, fontSize: '0.8rem', color: '#047857' }}>All questions solved!</p>
                                                )}
                                            </div>
                                        </div>
                                    </>
                                )}

                                <button
                                    type="button"
                                    onClick={() => setViewingHwModal(null)}
                                    className="btn btn-primary"
                                    style={{ width: '100%', justifyContent: 'center' }}
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    )}

                    {/* LIGHTBOX MODAL */}
                    {viewingLightboxImg && (
                        <div
                            role="dialog"
                            aria-modal="true"
                            onClick={() => setViewingLightboxImg(null)}
                            style={{
                                position: 'fixed',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                background: 'rgba(0,0,0,0.85)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '1.5rem',
                                zIndex: 10000,
                                cursor: 'zoom-out'
                            }}
                        >
                            <img
                                src={viewingLightboxImg}
                                alt="Full preview"
                                style={{
                                    maxWidth: '95vw',
                                    maxHeight: '92vh',
                                    objectFit: 'contain',
                                    borderRadius: 'var(--radius-md)',
                                    boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
                                }}
                            />
                        </div>
                    )}
                </>
            )}
            <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
        </div>
    );
};

export default StudentDashboard;
