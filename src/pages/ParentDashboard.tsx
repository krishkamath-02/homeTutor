import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Upload, FileText, CheckCircle, Clock, BarChart3, Book, Sparkles, Trash2, Image, AlertTriangle, Check, Info, Printer, Play, User as UserIcon, Zap, Lock, Users, TrendingUp, Calendar } from 'lucide-react';
import PrintableTest from '../components/PrintableTest';
import TestTaker from '../components/TestTaker';
import TestReview from '../components/TestReview';
import UpgradeModal from '../components/UpgradeModal';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import useAuthStore from '../store/authStore';
import useAppStore, { type Test } from '../store/appStore';
import { supabase } from '../lib/supabase';
import { detectSubjectFromImage, type Difficulty } from '../lib/gemini';
import { checkImageClarity, type ClarityResult } from '../utils/imageClarity';

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

const ParentDashboard = () => {
    const user = useAuthStore((state) => state.user);
    const userTrackedSubjects = (user?.subjects || []).map(s => s === 'Mathematics' ? 'Math' : s);
    const displaySubjects = userTrackedSubjects.length ? SUBJECTS.filter(s => userTrackedSubjects.includes(s)) : SUBJECTS;
    const tests = useAppStore((state) => state.tests);
    const progress = useAppStore((state) => state.progress);
    const childrenList = useAppStore((state) => state.childrenList);
    const uploadHomework = useAppStore((state) => state.uploadHomework);
    const generateTest = useAppStore((state) => state.generateTest);
    const generateRemedialTest = useAppStore((state) => state.generateRemedialTest);
    const deleteTest = useAppStore((state) => state.deleteTest);
    const isGenerating = useAppStore((state) => state.isGenerating);
    const fetchTests = useAppStore((state) => state.fetchTests);
    const fetchProgress = useAppStore((state) => state.fetchProgress);
    const fetchChildren = useAppStore((state) => state.fetchChildren);
    const logout = useAuthStore((state) => state.logout);
    const updateUser = useAuthStore((state) => state.updateUser);

    useEffect(() => {
        fetchTests();
        fetchProgress();
        fetchChildren();
    }, [fetchTests, fetchProgress, fetchChildren]);

    // Auto-generate invite code if missing for parent
    useEffect(() => {
        const ensureInviteCode = async () => {
            if (user && user.role === 'parent' && !user.inviteCode) {
                const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();
                try {
                    const { error } = await supabase
                        .from('profiles')
                        .update({ invite_code: newCode })
                        .eq('id', user.id);

                    if (!error) {
                        updateUser({ inviteCode: newCode });
                    }
                } catch (err) {
                    console.error('Failed to generate missing invite code:', err);
                }
            }
        };
        ensureInviteCode();
    }, [user, updateUser]);

    // Upload state
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [filePreviews, setFilePreviews] = useState<string[]>([]);
    const [selectedSubject, setSelectedSubject] = useState(displaySubjects[0] || 'Math');
    const [isDetectingSubject, setIsDetectingSubject] = useState(false);
    const [detectedSubject, setDetectedSubject] = useState<string | null>(null);
    const [isCustomSubject, setIsCustomSubject] = useState(false);
    const [customSubjectText, setCustomSubjectText] = useState('');
    const [dueDate, setDueDate] = useState<string>('');
    const [difficulty, setDifficulty] = useState<Difficulty>('basic');
    const [clarityResults, setClarityResults] = useState<Record<number, ClarityResult>>({});
    const [pendingTestId, setPendingTestId] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [generateError, setGenerateError] = useState<string | null>(null);
    const [customInstructions, setCustomInstructions] = useState('');
    const [questionCount, setQuestionCount] = useState(5);
    const [generateSuccess, setGenerateSuccess] = useState(false);
    const [generatedTestId, setGeneratedTestId] = useState<string | null>(null);
    const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
    const [upgradeReason, setUpgradeReason] = useState<'daily_limit' | 'child_limit' | 'analytics' | 'general'>('general');
    const [selectedChildId, setSelectedChildId] = useState<string | 'all'>('all');
    const [remedialGeneratingTopic, setRemedialGeneratingTopic] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const filteredTests = selectedChildId === 'all'
        ? tests
        : tests.filter(t => (t as any).student_id === selectedChildId || (t as any).studentId === selectedChildId);

    const completedTests = filteredTests.filter(t => t.status === 'completed');
    const averageScore = completedTests.length > 0
        ? Math.round(completedTests.reduce((acc, curr) => acc + (curr.score || 0), 0) / completedTests.length)
        : 0;
    const chartData = completedTests.slice(-7).map((t, idx) => ({ name: `T${idx + 1}`, score: t.score || 0 }));

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const filesArray = Array.from(e.target.files);
        const startIdx = selectedFiles.length;

        setSelectedFiles((prev: File[]) => [...prev, ...filesArray]);

        // Generate object URL previews for images
        const previews = filesArray.map(f => f.type.startsWith('image/') ? URL.createObjectURL(f) : '');
        setFilePreviews((prev: string[]) => [...prev, ...previews]);

        setPendingTestId(null);
        setGenerateSuccess(false);
        setGenerateError(null);

        // Run clarity checks in parallel
        filesArray.forEach(async (file, i) => {
            const result = await checkImageClarity(file);
            setClarityResults((prev: Record<number, ClarityResult>) => ({ ...prev, [startIdx + i]: result }));
        });

        // Run AI subject auto-recognition on first image
        const firstImg = filesArray.find(f => f.type.startsWith('image/'));
        if (firstImg) {
            setIsDetectingSubject(true);
            detectSubjectFromImage(firstImg).then(detected => {
                setIsDetectingSubject(false);
                if (detected) {
                    setDetectedSubject(detected);
                    setSelectedSubject(detected);
                }
            }).catch(() => {
                setIsDetectingSubject(false);
            });
        }

        // Reset input so same files can be re-selected
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const removeFile = (idx: number) => {
        setSelectedFiles(prev => prev.filter((_, i) => i !== idx));
        setFilePreviews(prev => prev.filter((_, i) => i !== idx));

        // Re-map clarity results
        setClarityResults((prev: Record<number, ClarityResult>) => {
            const next: Record<number, ClarityResult> = {};
            let newIdx = 0;
            for (let i = 0; i < selectedFiles.length; i++) {
                if (i === idx) continue;
                if (prev[i]) next[newIdx] = prev[i];
                newIdx++;
            }
            return next;
        });

        setPendingTestId(null);
    };

    const handleUploadAndPrepare = async () => {
        if (selectedFiles.length === 0 && !customInstructions.trim()) return;
        setIsUploading(true);
        const testId = await uploadHomework(selectedFiles, selectedSubject, dueDate || null);
        setIsUploading(false);
        if (testId) setPendingTestId(testId);
    };

    const handleGenerate = async () => {
        if (!pendingTestId) return;
        if (selectedFiles.length === 0 && !customInstructions.trim()) return;

        const unclearFiles = Object.values(clarityResults).filter((r: ClarityResult) => !r.isClear);
        if (unclearFiles.length > 0) {
            const confirm = window.confirm(`Warning: ${unclearFiles.length} of your images might be too blurry or dark. AI might fail to read them properly. Proceed anyway?`);
            if (!confirm) return;
        }

        setGenerateError(null);
        try {
            await generateTest(pendingTestId, selectedFiles, difficulty, customInstructions, questionCount);
            setGeneratedTestId(pendingTestId);
            setGenerateSuccess(true);
            setSelectedFiles([]);
            setFilePreviews([]);
            setClarityResults({});
            setCustomInstructions('');
            setPendingTestId(null);
        } catch (err: any) {
            setGenerateError(err.message || 'Failed to generate test. Please check your internet connection and try again.');
        }
    };

    const resetUpload = () => {
        setSelectedFiles([]);
        setFilePreviews([]);
        setClarityResults({});
        setCustomInstructions('');
        setDueDate('');
        setPendingTestId(null);
        setGenerateSuccess(false);
        setGeneratedTestId(null);
        setGenerateError(null);
        setDetectedSubject(null);
        setIsCustomSubject(false);
        setCustomSubjectText('');
    };

    const handleRemedialDrill = async (topic: string, subject: string) => {
        try {
            setRemedialGeneratingTopic(topic);
            setGenerateError(null);
            const testId = await generateRemedialTest(topic, subject);
            if (testId) {
                setGeneratedTestId(testId);
                setGenerateSuccess(true);
            }
        } catch (err: any) {
            setGenerateError(err.message || 'Failed to generate remedial test');
        } finally {
            setRemedialGeneratingTopic(null);
        }
    };

    const generatedTest = generatedTestId ? tests.find(t => t.id === generatedTestId) : null;
    const [takeTestInlineId, setTakeTestInlineId] = useState<string | null>(null);
    const [reviewTestId, setReviewTestId] = useState<string | null>(null);
    const [testToPrint, setTestToPrint] = useState<Test | null>(null);

    const activePrintTest = testToPrint || generatedTest;

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

    if (takeTestInlineId) {
        return (
            <div className="container animate-fade-in" style={{ maxWidth: '800px', margin: '2rem auto' }}>
                <TestTaker 
                    testId={takeTestInlineId} 
                    onComplete={() => {
                        setTakeTestInlineId(null);
                        resetUpload(); // return to clean dashboard
                    }} 
                    onCancel={() => setTakeTestInlineId(null)} 
                />
            </div>
        );
    }

    return (
        <>
        {activePrintTest && (
            <PrintableTest 
                test={activePrintTest} 
                curriculumBoard={user?.curriculumBoard} 
                gradeLevel={user?.gradeLevel} 
            />
        )}
        <div className="container animate-fade-in no-print">
            <header style={{ marginBottom: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h1 style={{ fontSize: '2.25rem', marginBottom: '0.25rem' }}>Parent Dashboard</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '1.125rem' }}>Welcome back, {user?.name || 'Parent'} 👋</p>
                </div>
                <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    {/* Subscription Plan Pill */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.35rem 0.85rem',
                        borderRadius: '2rem',
                        background: user?.subscriptionTier === 'pro'
                            ? 'rgba(79, 70, 229, 0.12)'
                            : user?.subscriptionTier === 'premium'
                            ? 'rgba(245, 158, 11, 0.15)'
                            : 'var(--surface-hover)',
                        border: `1px solid ${user?.subscriptionTier === 'pro' ? 'var(--primary)' : user?.subscriptionTier === 'premium' ? '#f59e0b' : 'var(--border)'}`,
                        fontSize: '0.82rem'
                    }}>
                        <Zap size={14} color={user?.subscriptionTier === 'pro' ? 'var(--primary)' : user?.subscriptionTier === 'premium' ? '#f59e0b' : '#64748b'} />
                        <span style={{ fontWeight: 700, textTransform: 'capitalize' }}>
                            {user?.subscriptionTier === 'pro' ? 'Pro Plan' : user?.subscriptionTier === 'premium' ? 'Family Premium' : 'Free Plan'}
                        </span>
                        {user?.subscriptionTier === 'free' && (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                                ({user?.dailyTestsCount ?? 0}/{user?.dailyTestLimit ?? 3} tests today)
                            </span>
                        )}
                        <button
                            onClick={() => {
                                setUpgradeReason('general');
                                setIsUpgradeModalOpen(true);
                            }}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--primary)',
                                fontWeight: 700,
                                cursor: 'pointer',
                                fontSize: '0.78rem',
                                padding: '0 0 0 0.35rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.25rem'
                            }}
                        >
                            <Sparkles size={12} /> {user?.subscriptionTier === 'free' ? 'Upgrade' : 'Manage'}
                        </button>
                    </div>

                    <Link to="/profile" className="btn" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-main)' }}>
                        {user?.avatarUrl ? <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>{user.avatarUrl}</span> : <UserIcon size={18} />} Profile
                    </Link>
                    <button className="btn btn-secondary" onClick={logout} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        Logout
                    </button>
                </div>
            </header>

            {/* Linked Children Bar (Phase 3) */}
            <div className="card" style={{ padding: '0.85rem 1.25rem', marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <Users size={16} /> Child Profile:
                        </span>
                        <button
                            onClick={() => setSelectedChildId('all')}
                            style={{
                                padding: '0.3rem 0.8rem',
                                borderRadius: '2rem',
                                border: `1.5px solid ${selectedChildId === 'all' ? 'var(--primary)' : 'var(--border)'}`,
                                background: selectedChildId === 'all' ? 'rgba(79, 70, 229, 0.1)' : 'transparent',
                                color: selectedChildId === 'all' ? 'var(--primary)' : 'var(--text-main)',
                                fontWeight: selectedChildId === 'all' ? 700 : 500,
                                fontSize: '0.82rem',
                                cursor: 'pointer'
                            }}
                        >
                            All ({childrenList.length})
                        </button>
                        {childrenList.map(child => (
                            <button
                                key={child.id}
                                onClick={() => setSelectedChildId(child.id)}
                                style={{
                                    padding: '0.3rem 0.8rem',
                                    borderRadius: '2rem',
                                    border: `1.5px solid ${selectedChildId === child.id ? 'var(--primary)' : 'var(--border)'}`,
                                    background: selectedChildId === child.id ? 'rgba(79, 70, 229, 0.1)' : 'transparent',
                                    color: selectedChildId === child.id ? 'var(--primary)' : 'var(--text-main)',
                                    fontWeight: selectedChildId === child.id ? 700 : 500,
                                    fontSize: '0.82rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.35rem'
                                }}
                            >
                                <span>{child.avatarUrl || '🎒'}</span> {child.name}
                            </button>
                        ))}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.8rem' }}>
                        <span style={{ color: 'var(--text-muted)' }}>
                            {childrenList.length} of {user?.maxChildrenAllowed ?? 2} child profiles linked
                        </span>
                        {childrenList.length >= (user?.maxChildrenAllowed ?? 2) && user?.subscriptionTier === 'free' ? (
                            <button
                                onClick={() => {
                                    setUpgradeReason('child_limit');
                                    setIsUpgradeModalOpen(true);
                                }}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--primary)',
                                    fontWeight: 700,
                                    fontSize: '0.8rem',
                                    cursor: 'pointer',
                                    textDecoration: 'underline'
                                }}
                            >
                                + Add More (Upgrade)
                            </button>
                        ) : null}
                    </div>
                </div>
            </div>

            {/* Quick Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '2.5rem' }}>
                <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ background: 'rgba(79, 70, 229, 0.1)', padding: '1rem', borderRadius: 'var(--radius-md)', color: 'var(--primary)' }}><FileText size={24} /></div>
                    <div><h3 style={{ fontSize: '1.5rem', margin: 0 }}>{tests.length}</h3><p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.875rem' }}>Total Assignments</p></div>
                </div>
                <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '1rem', borderRadius: 'var(--radius-md)', color: 'var(--secondary)' }}><CheckCircle size={24} /></div>
                    <div><h3 style={{ fontSize: '1.5rem', margin: 0 }}>{averageScore}%</h3><p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.875rem' }}>Average Test Score</p></div>
                </div>
                <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: '1rem', borderRadius: 'var(--radius-md)', color: '#f59e0b' }}><Clock size={24} /></div>
                    <div><h3 style={{ fontSize: '1.5rem', margin: 0 }}>{completedTests.length}</h3><p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.875rem' }}>Tests Completed</p></div>
                </div>
                <Link to="/calendar" className="card hover-lift" style={{ display: 'flex', alignItems: 'center', gap: '1rem', textDecoration: 'none', color: 'inherit' }}>
                    <div style={{ background: 'rgba(79, 70, 229, 0.1)', padding: '1rem', borderRadius: 'var(--radius-md)', color: 'var(--primary)' }}><Calendar size={24} /></div>
                    <div><h3 style={{ fontSize: '1.5rem', margin: 0 }}>Calendar</h3><p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.875rem' }}>Exams & Study Blocks →</p></div>
                </Link>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '2rem' }}>

                {/* Main Content */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

                    {/* Subject Tiles */}
                    <div className="card">
                        <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Book size={20} color="var(--primary)" /> Major Subjects
                        </h2>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '1rem' }}>
                            {displaySubjects.map(subject => (
                                <div key={subject} style={{ padding: '1.25rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', textAlign: 'center', transition: 'var(--transition)', cursor: 'pointer' }} className="hover-lift">
                                    <div style={{ background: 'var(--surface-hover)', width: '48px', height: '48px', margin: '0 auto 0.75rem', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
                                        <Book size={22} />
                                    </div>
                                    <h4 style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem' }}>{subject}</h4>
                                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                        {tests.filter(t => t.subject === subject && t.status === 'completed').length} completed
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Performance Chart */}
                    <div className="card">
                        <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <BarChart3 size={20} color="var(--primary)" /> Performance Overview
                        </h2>
                        <div style={{ height: '260px', width: '100%' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData.length > 0 ? chartData : [{ name: 'No Data', score: 0 }]}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)' }} />
                                    <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)' }} dx={-10} />
                                    <Tooltip cursor={{ fill: 'var(--surface-hover)' }} contentStyle={{ borderRadius: 'var(--radius-md)', border: 'none', boxShadow: 'var(--shadow-md)' }} />
                                    <Bar dataKey="score" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Topic Mastery & Weak Spot Analytics (Phase 2) */}
                    <div className="card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                            <div>
                                <h2 style={{ fontSize: '1.25rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <TrendingUp size={20} color="var(--primary)" /> Topic Mastery & Weak Spots
                                </h2>
                                <p style={{ margin: '0.25rem 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                                    Track concept understanding and learning gaps across topics.
                                </p>
                            </div>
                            {user?.subscriptionTier === 'free' && (
                                <span style={{
                                    background: 'rgba(79, 70, 229, 0.08)',
                                    color: 'var(--primary)',
                                    padding: '0.25rem 0.65rem',
                                    borderRadius: '1rem',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.35rem'
                                }}>
                                    <Lock size={12} /> Free Preview (3 Topics)
                                </span>
                            )}
                        </div>

                        {progress.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)' }}>
                                <p style={{ margin: 0, fontSize: '0.9rem' }}>No topic mastery records yet.</p>
                                <p style={{ margin: '0.35rem 0 0', fontSize: '0.8rem' }}>When your child completes tests, their strengths and weak topics will automatically appear here!</p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                                {(user?.subscriptionTier === 'free' ? progress.slice(0, 3) : progress).map((item) => {
                                    const isMastered = item.masteryScore >= 80;
                                    const isWeak = item.masteryScore < 60;
                                    const statusColor = isMastered ? '#10b981' : isWeak ? '#ef4444' : '#3b82f6';
                                    const statusBg = isMastered ? 'rgba(16, 185, 129, 0.1)' : isWeak ? 'rgba(239, 68, 68, 0.1)' : 'rgba(59, 130, 246, 0.1)';
                                    const statusText = isMastered ? 'Mastered 🎉' : isWeak ? 'Needs Practice ⚠️' : 'In Progress 👍';

                                    return (
                                        <div key={item.id} style={{
                                            padding: '1rem',
                                            border: '1px solid var(--border)',
                                            borderRadius: 'var(--radius-md)',
                                            background: 'var(--surface)'
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                                <div>
                                                    <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600, color: 'var(--text-muted)' }}>
                                                        {item.subject}
                                                    </span>
                                                    <h4 style={{ margin: '0.1rem 0 0', fontSize: '0.95rem', fontWeight: 600 }}>{item.topic}</h4>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                    <span style={{
                                                        padding: '0.2rem 0.6rem',
                                                        borderRadius: '1rem',
                                                        fontSize: '0.75rem',
                                                        fontWeight: 600,
                                                        background: statusBg,
                                                        color: statusColor
                                                    }}>
                                                        {statusText}
                                                    </span>
                                                    <span style={{ fontWeight: 700, fontSize: '1rem', color: statusColor }}>
                                                        {item.masteryScore}%
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Progress Bar */}
                                            <div style={{ width: '100%', height: '7px', background: 'var(--surface-hover)', borderRadius: '4px', overflow: 'hidden' }}>
                                                <div style={{
                                                    width: `${Math.min(item.masteryScore, 100)}%`,
                                                    height: '100%',
                                                    background: statusColor,
                                                    borderRadius: '4px',
                                                    transition: 'width 0.4s ease'
                                                }} />
                                            </div>

                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                <span>{item.attemptsCount} test{item.attemptsCount > 1 ? 's' : ''} taken</span>
                                                {isWeak && (
                                                    <button
                                                        disabled={remedialGeneratingTopic === item.topic}
                                                        onClick={() => handleRemedialDrill(item.topic, item.subject)}
                                                        className="hover-lift"
                                                        style={{
                                                            background: 'linear-gradient(135deg, var(--primary) 0%, #6366f1 100%)',
                                                            border: 'none',
                                                            color: 'white',
                                                            fontWeight: 600,
                                                            cursor: remedialGeneratingTopic === item.topic ? 'not-allowed' : 'pointer',
                                                            padding: '0.35rem 0.75rem',
                                                            borderRadius: 'var(--radius-sm)',
                                                            fontSize: '0.75rem',
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '0.35rem',
                                                            boxShadow: '0 2px 6px rgba(79, 70, 229, 0.25)',
                                                            opacity: remedialGeneratingTopic === item.topic ? 0.7 : 1
                                                        }}
                                                    >
                                                        <Zap size={13} />
                                                        {remedialGeneratingTopic === item.topic ? 'Generating Drill...' : '⚡ 1-Click Remedial Drill'}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}

                                {/* Pro Teaser Card for Free Tier */}
                                {user?.subscriptionTier === 'free' && (
                                    <div style={{
                                        marginTop: '0.75rem',
                                        padding: '1.25rem',
                                        borderRadius: 'var(--radius-md)',
                                        background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.08) 0%, rgba(129, 140, 248, 0.04) 100%)',
                                        border: '1px dashed var(--primary)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        flexWrap: 'wrap',
                                        gap: '1rem'
                                    }}>
                                        <div style={{ maxWidth: '440px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--primary)', fontWeight: 700, fontSize: '0.9rem' }}>
                                                <Sparkles size={16} /> Unlock Full Topic Mastery & Weak Spot Alerts
                                            </div>
                                            <p style={{ margin: '0.3rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                Free plan shows top 3 topics. Upgrade to Pro for unlimited topic tracking, automated remediation drills, and concept drift diagnostics.
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => {
                                                setUpgradeReason('analytics');
                                                setIsUpgradeModalOpen(true);
                                            }}
                                            className="btn btn-primary"
                                            style={{ fontSize: '0.82rem', padding: '0.5rem 1rem' }}
                                        >
                                            Upgrade to Pro
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Recent Assignments */}
                    <div className="card" id="tests-list-section">
                        <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>Recent Assignments</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {tests.slice(0, 5).map((test) => (
                                <div key={test.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', gap: '0.5rem' }}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <h4 style={{ fontWeight: 600, margin: '0 0 0.25rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{test.title}</h4>
                                        <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.8rem' }}>
                                            {test.questions.length > 0 ? `${test.questions.length} questions` : 'No questions yet'} •{' '}
                                            {test.status === 'completed' 
                                                ? `Done ${test.completedAt ? new Date(test.completedAt).toLocaleDateString() : ''}` 
                                                : test.dueDate ? `Due ${new Date(test.dueDate).toLocaleDateString()}` : 'Pending student'}
                                        </p>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
                                        {/* Print Worksheet Button */}
                                        {test.questions.length > 0 && (
                                            <button
                                                onClick={() => {
                                                    setTestToPrint(test);
                                                    setTimeout(() => window.print(), 50);
                                                }}
                                                className="hover-lift"
                                                title="Print paper worksheet"
                                                style={{
                                                    background: 'rgba(79, 70, 229, 0.08)',
                                                    color: 'var(--primary)',
                                                    border: '1px solid rgba(79, 70, 229, 0.2)',
                                                    cursor: 'pointer',
                                                    padding: '0.2rem 0.55rem',
                                                    borderRadius: '1rem',
                                                    fontWeight: 600,
                                                    fontSize: '0.74rem',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.25rem'
                                                }}
                                            >
                                                <Printer size={12} /> Worksheet
                                            </button>
                                        )}

                                        {test.status === 'completed' ? (
                                            <button onClick={() => setReviewTestId(test.id)} style={{
                                                background: 'rgba(16,185,129,0.1)', color: 'var(--secondary)', border: 'none', cursor: 'pointer',
                                                padding: '0.2rem 0.65rem', borderRadius: '1rem', fontWeight: 600, fontSize: '0.78rem', transition: 'var(--transition)',
                                                display: 'flex', alignItems: 'center', gap: '0.3rem'
                                            }} className="hover-lift">
                                                Review {test.score}% {test.roughWorkEvaluation ? '• ✍️' : ''}
                                            </button>
                                        ) : (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                                <span style={{
                                                    background: test.questions.length > 0 ? 'rgba(79,70,229,0.1)' : 'rgba(245,158,11,0.1)',
                                                    color: test.questions.length > 0 ? 'var(--primary)' : '#d97706',
                                                    padding: '0.2rem 0.65rem', borderRadius: '1rem', fontWeight: 600, fontSize: '0.78rem'
                                                }}>
                                                    {test.questions.length > 0 ? 'Ready ✓' : 'Draft'}
                                                </span>
                                                {test.questions.length > 0 && (
                                                    <button
                                                        onClick={() => setTakeTestInlineId(test.id)}
                                                        className="hover-lift"
                                                        style={{
                                                            background: 'var(--primary)',
                                                            color: 'white',
                                                            border: 'none',
                                                            cursor: 'pointer',
                                                            padding: '0.2rem 0.6rem',
                                                            borderRadius: '1rem',
                                                            fontWeight: 600,
                                                            fontSize: '0.75rem',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '0.25rem'
                                                        }}
                                                    >
                                                        <Play size={11} fill="white" /> Take
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                        {/* Allow deleting empty drafts */}
                                        {test.questions.length === 0 && test.status !== 'completed' && (
                                            <button onClick={() => deleteTest(test.id)} title="Delete draft"
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '0.25rem', borderRadius: '4px' }}>
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {tests.length === 0 && (
                                <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1rem 0' }}>No assignments yet. Upload homework to get started.</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Upload Sidebar */}
                <div>
                    <div className="card" style={{ position: 'sticky', top: '2rem' }}>
                        {/* Invite Code - Always Visible */}
                        {user?.inviteCode && (
                            <div style={{ background: 'var(--surface-hover)', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', border: '1px solid var(--border)' }}>
                                <p style={{ margin: '0 0 0.25rem', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Child's Invite Code</p>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <span style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '2px', color: 'var(--primary)' }}>{user.inviteCode}</span>
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(user.inviteCode!);
                                            alert('Invite code copied to clipboard!');
                                        }}
                                        style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                                    >
                                        Copy
                                    </button>
                                </div>
                                <p style={{ margin: '0.5rem 0 0', fontSize: '0.7rem', color: 'var(--text-muted)' }}>Share this with your child to link their account.</p>
                            </div>
                        )}

                        {generateSuccess ? (
                            <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                                <div style={{ background: 'rgba(16, 185, 129, 0.1)', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', color: 'var(--secondary)' }}>
                                    <CheckCircle size={32} />
                                </div>
                                <h3 style={{ marginBottom: '0.5rem' }}>Test Generated! 🎉</h3>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
                                    Your custom test is ready.
                                </p>
                                
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
                                    <button className="btn btn-primary" onClick={() => window.print()} style={{ width: '100%', justifyContent: 'center' }}>
                                        <Printer size={16} /> Download as PDF
                                    </button>
                                    <button className="btn btn-secondary" onClick={() => setTakeTestInlineId(generatedTestId)} style={{ width: '100%', justifyContent: 'center' }}>
                                        <Play size={16} /> Take Test Online
                                    </button>
                                </div>

                                <button onClick={resetUpload} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', textDecoration: 'underline', cursor: 'pointer', fontSize: '0.875rem' }}>
                                    Create Another Test
                                </button>
                            </div>
                        ) : (
                            <>
                                <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Generate a Test</h2>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
                                    Upload homework images, pick a subject & difficulty, then let AI generate a test.
                                </p>

                                <div style={{ marginBottom: '1.25rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                                        <label style={{ fontWeight: 500, fontSize: '0.875rem' }}>Subject</label>
                                        <Link to="/profile" style={{ fontSize: '0.78rem', color: 'var(--primary)', textDecoration: 'none' }}>
                                            Edit Tracked Subjects →
                                        </Link>
                                    </div>

                                    {/* AI Auto-Detected Subject Banner */}
                                    {isDetectingSubject && (
                                        <div style={{ padding: '0.5rem 0.75rem', background: 'rgba(79, 70, 229, 0.08)', borderRadius: 'var(--radius-sm)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--primary)' }}>
                                            <Sparkles size={14} className="animate-spin" />
                                            <span>AI analyzing uploaded worksheet to recognize subject...</span>
                                        </div>
                                    )}

                                    {detectedSubject && !isDetectingSubject && (
                                        <div style={{ padding: '0.5rem 0.75rem', background: 'rgba(16, 185, 129, 0.1)', borderRadius: 'var(--radius-sm)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem', color: '#047857' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                <Sparkles size={14} color="#10B981" />
                                                <span>✨ Auto-recognized: <strong>{detectedSubject}</strong></span>
                                            </div>
                                            <button 
                                                type="button" 
                                                onClick={() => setDetectedSubject(null)}
                                                style={{ background: 'none', border: 'none', color: '#047857', cursor: 'pointer', fontSize: '0.75rem', textDecoration: 'underline' }}
                                            >
                                                Dismiss
                                            </button>
                                        </div>
                                    )}

                                    {!isCustomSubject ? (
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <select 
                                                value={selectedSubject} 
                                                onChange={e => {
                                                    if (e.target.value === '__CUSTOM__') {
                                                        setIsCustomSubject(true);
                                                        setCustomSubjectText('');
                                                    } else {
                                                        setSelectedSubject(e.target.value);
                                                    }
                                                }}
                                                style={{ flex: 1, padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--surface)', fontSize: '0.95rem' }}
                                            >
                                                {/* 1. Tracked Subjects */}
                                                <optgroup label="📌 Tracked Subjects">
                                                    {displaySubjects.map(s => <option key={s} value={s}>{s}</option>)}
                                                </optgroup>

                                                {/* 2. Other Curriculum Subjects */}
                                                <optgroup label="📚 More Curriculum Subjects">
                                                    {SUBJECTS.filter(s => !displaySubjects.includes(s)).map(s => (
                                                        <option key={s} value={s}>{s}</option>
                                                    ))}
                                                </optgroup>

                                                {/* 3. Option to enter Custom */}
                                                <optgroup label="➕ Custom">
                                                    <option value="__CUSTOM__">+ Add Custom Subject...</option>
                                                </optgroup>
                                            </select>
                                            <button
                                                type="button"
                                                onClick={() => setIsCustomSubject(true)}
                                                className="btn btn-secondary"
                                                style={{ padding: '0.65rem 0.85rem', fontSize: '0.82rem', whiteSpace: 'nowrap' }}
                                                title="Type a custom subject"
                                            >
                                                + Custom
                                            </button>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <input
                                                type="text"
                                                className="input"
                                                placeholder="Enter custom subject (e.g. Coding, Art, French)..."
                                                value={customSubjectText}
                                                onChange={e => {
                                                    setCustomSubjectText(e.target.value);
                                                    setSelectedSubject(e.target.value);
                                                }}
                                                autoFocus
                                                style={{ flex: 1, padding: '0.65rem 0.85rem' }}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setIsCustomSubject(false);
                                                    if (!customSubjectText.trim()) {
                                                        setSelectedSubject(displaySubjects[0] || 'Math');
                                                    }
                                                }}
                                                className="btn btn-secondary"
                                                style={{ padding: '0.65rem 0.85rem', fontSize: '0.82rem' }}
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <div style={{ marginBottom: '1.25rem' }}>
                                    <label style={{ display: 'block', fontWeight: 500, fontSize: '0.875rem', marginBottom: '0.4rem' }}>Due By (Optional)</label>
                                    <input type="datetime-local" value={dueDate} onChange={e => setDueDate(e.target.value)}
                                        style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--surface)', fontSize: '0.95rem' }} />
                                </div>

                                <div style={{ marginBottom: '1.25rem' }}>
                                    <label style={{ display: 'block', fontWeight: 500, fontSize: '0.875rem', marginBottom: '0.4rem' }}>Difficulty</label>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                                        {(['basic', 'intermediate', 'advanced'] as Difficulty[]).map(d => (
                                            <button key={d} onClick={() => setDifficulty(d)}
                                                style={{
                                                    padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', border: `2px solid ${difficulty === d ? 'var(--primary)' : 'var(--border)'}`,
                                                    background: difficulty === d ? 'rgba(79,70,229,0.08)' : 'transparent',
                                                    color: difficulty === d ? 'var(--primary)' : 'var(--text-muted)',
                                                    fontWeight: difficulty === d ? 600 : 500, cursor: 'pointer', fontSize: '0.9rem', transition: 'var(--transition)', textTransform: 'capitalize',
                                                    textAlign: 'left'
                                                }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                    <span style={{
                                                        width: '10px', height: '10px', borderRadius: '50%',
                                                        background: d === 'basic' ? '#10b981' : d === 'intermediate' ? '#f59e0b' : '#ef4444',
                                                        display: 'inline-block', flexShrink: 0
                                                    }} />
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                            <span>{d === 'basic' ? 'Basic' : d === 'intermediate' ? 'Intermediate' : 'Advanced'}</span>
                                                            {difficulty === d && <Check size={16} />}
                                                        </div>
                                                        <p style={{ margin: '0.15rem 0 0', fontSize: '0.75rem', fontWeight: 400, opacity: 0.8, color: 'var(--text-muted)' }}>
                                                            {d === 'basic' ? 'Easy recall questions' : d === 'intermediate' ? 'Balanced conceptual mix' : 'Analytical challenges'}
                                                        </p>
                                                    </div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.4rem 0 0' }}>
                                        {difficulty === 'basic' ? 'Simple recall and comprehension questions.' :
                                            difficulty === 'intermediate' ? 'A balanced mix of recall and conceptual questions.' :
                                                'Analytical, hypothetical & challenging questions.'}
                                    </p>
                                </div>

                                <div style={{ marginBottom: '1.25rem' }}>
                                    <label style={{ display: 'block', fontWeight: 500, fontSize: '0.875rem', marginBottom: '0.4rem' }}>Number of Questions</label>
                                    <select value={questionCount} onChange={e => setQuestionCount(Number(e.target.value))}
                                        style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--surface)', fontSize: '0.95rem' }}>
                                        <option value={5}>5 Questions ({difficulty === 'basic' ? 'Quick Check' : difficulty === 'intermediate' ? 'Standard Check' : 'Deep Dive'})</option>
                                        <option value={10}>10 Questions (Standard Test)</option>
                                        <option value={15}>15 Questions (Comprehensive)</option>
                                    </select>
                                </div>

                                <div style={{ marginBottom: '1.25rem' }}>
                                    <label style={{ display: 'block', fontWeight: 500, fontSize: '0.875rem', marginBottom: '0.4rem' }}>Special Instructions (Optional)</label>
                                    <textarea
                                        value={customInstructions}
                                        onChange={e => setCustomInstructions(e.target.value)}
                                        placeholder="e.g. Focus on vocabulary, or include 2 word problems..."
                                        style={{
                                            width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
                                            background: 'var(--surface)', fontSize: '0.9rem', minHeight: '80px', resize: 'vertical'
                                        }}
                                    />
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.4rem 0 0' }}>
                                        Guide the AI on what to prioritize in the test.
                                    </p>
                                </div>

                                <div style={{ marginBottom: '1rem' }}>
                                    <label style={{ display: 'block', fontWeight: 500, fontSize: '0.875rem', marginBottom: '0.4rem' }}>Homework Images</label>
                                    <label style={{
                                        display: 'block', border: `2px dashed ${selectedFiles.length > 0 ? 'var(--primary)' : 'var(--border)'}`,
                                        borderRadius: 'var(--radius-md)', padding: '1.25rem 1rem', textAlign: 'center', cursor: 'pointer',
                                        background: selectedFiles.length > 0 ? 'rgba(79,70,229,0.04)' : 'transparent', transition: 'var(--transition)'
                                    }}>
                                        <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={handleFileChange} accept="image/*,.pdf" multiple />
                                        <div style={{ color: 'var(--text-muted)' }}>
                                            <Image size={24} style={{ margin: '0 auto 0.5rem' }} />
                                            <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 500 }}>Click to add files</p>
                                            <p style={{ margin: '0.2rem 0 0', fontSize: '0.75rem' }}>PNG, JPG or PDF • multiple allowed</p>
                                        </div>
                                    </label>
                                </div>

                                {selectedFiles.length > 0 && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginBottom: '1.25rem' }}>
                                        {selectedFiles.map((file: File, idx: number) => (
                                            <div key={idx} style={{ padding: '0.75rem', background: 'var(--surface-hover)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: clarityResults[idx] ? '0.5rem' : 0 }}>
                                                    {filePreviews[idx]
                                                        ? <img src={filePreviews[idx]} alt={file.name} style={{ width: '36px', height: '36px', objectFit: 'cover', borderRadius: '6px', flexShrink: 0 }} />
                                                        : <div style={{ width: '36px', height: '36px', background: 'var(--border)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><FileText size={16} /></div>
                                                    }
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <p style={{ margin: 0, fontWeight: 600, fontSize: '0.82rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</p>
                                                        <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-muted)' }}>{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                                                    </div>
                                                    <button onClick={() => removeFile(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0.25rem', flexShrink: 0 }} className="hover-red">
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>

                                                {clarityResults[idx] && (
                                                    <div style={{
                                                        display: 'flex', alignItems: 'center', gap: '0.4rem',
                                                        padding: '0.35rem 0.6rem', background: clarityResults[idx].isClear ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.08)',
                                                        borderRadius: '4px', border: `1px solid ${clarityResults[idx].isClear ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)'}`
                                                    }}>
                                                        {clarityResults[idx].isClear ? (
                                                            <Check size={12} color="var(--secondary)" />
                                                        ) : (
                                                            <Info size={12} color="#d97706" />
                                                        )}
                                                        <span style={{
                                                            fontSize: '0.72rem', fontWeight: 600,
                                                            color: clarityResults[idx].isClear ? 'var(--secondary)' : '#b45309'
                                                        }}>
                                                            {clarityResults[idx].isClear ? 'Clear Image' : clarityResults[idx].reason || 'Unclear'}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {generateError && (
                                    <div style={{ padding: '0.85rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-md)', marginBottom: '1rem', color: '#dc2626', fontSize: '0.85rem' }}>
                                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                                            <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                                            <span>{generateError}</span>
                                        </div>
                                        {(generateError.toLowerCase().includes('limit') || generateError.toLowerCase().includes('upgrade') || generateError.toLowerCase().includes('pro')) && (
                                            <button
                                                onClick={() => {
                                                    setUpgradeReason('daily_limit');
                                                    setIsUpgradeModalOpen(true);
                                                }}
                                                className="btn btn-primary"
                                                style={{ width: '100%', marginTop: '0.65rem', fontSize: '0.82rem', padding: '0.5rem', justifyContent: 'center', background: 'linear-gradient(135deg, var(--primary), #818cf8)' }}
                                            >
                                                <Sparkles size={14} /> Upgrade to Pro for Unlimited Tests
                                            </button>
                                        )}
                                    </div>
                                )}

                                {!pendingTestId ? (
                                    <button className="btn btn-primary" onClick={handleUploadAndPrepare}
                                        disabled={(selectedFiles.length === 0 && !customInstructions.trim()) || isUploading}
                                        style={{ width: '100%', justifyContent: 'center', opacity: (selectedFiles.length === 0 && !customInstructions.trim()) ? 0.5 : 1 }}>
                                        {isUploading
                                            ? <><span style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} /> Preparing…</>
                                            : <><Upload size={16} /> Prepare Test</>}
                                    </button>
                                ) : (
                                    <button className="btn btn-primary" onClick={handleGenerate}
                                        disabled={isGenerating}
                                        style={{ width: '100%', justifyContent: 'center', background: 'linear-gradient(135deg, var(--primary), #818cf8)' }}>
                                        {isGenerating
                                            ? <><span style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} /> AI is generating…</>
                                            : <><Sparkles size={16} /> Generate {difficulty === 'advanced' ? 'Advanced' : difficulty === 'intermediate' ? 'Mid' : 'Basic'} Test</>}
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
            <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
        </div>

        {/* Upgrade Modal */}
        <UpgradeModal
            isOpen={isUpgradeModalOpen}
            onClose={() => setIsUpgradeModalOpen(false)}
            highlightReason={upgradeReason}
        />
        </>
    );
};

export default ParentDashboard;
