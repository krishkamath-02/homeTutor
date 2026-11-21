import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
    Upload, FileText, CheckCircle, BarChart3, Book, BookOpen, Sparkles, 
    Trash2, Image, AlertTriangle, Printer, Play, 
    User as UserIcon, Zap, Lock, Users, TrendingUp, Calendar,
    Eye, X, Camera, CheckCircle2, Smartphone, History, Search, Award,
    CheckSquare, Layers, Volume2
} from 'lucide-react';
import PrintableTest from '../components/PrintableTest';
import TestTaker from '../components/TestTaker';
import TestReview from '../components/TestReview';
import UpgradeModal from '../components/UpgradeModal';
import TeamsUploadModal from '../components/TeamsUploadModal';
import ManualHomeworkModal from '../components/ManualHomeworkModal';
import SpellingListModal from '../components/SpellingListModal';
import WorksheetLibraryModal from '../components/WorksheetLibraryModal';
import TestCorrectionsModal from '../components/TestCorrectionsModal';
import ProgressReportView from '../components/ProgressReportView';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import useAuthStore from '../store/authStore';
import useAppStore, { type Test, type DailyHomework } from '../store/appStore';
import { supabase } from '../lib/supabase';
import { detectSubjectFromImage, extractTeamsPost, extractContentFromHomeworkPage, type Difficulty } from '../lib/gemini';
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
    const dailyHomeworkList = useAppStore((state) => state.dailyHomeworkList);
    const progress = useAppStore((state) => state.progress);
    const childrenList = useAppStore((state) => state.childrenList);
    const uploadHomework = useAppStore((state) => state.uploadHomework);
    const generateTest = useAppStore((state) => state.generateTest);
    const generateRemedialTest = useAppStore((state) => state.generateRemedialTest);
    const deleteTest = useAppStore((state) => state.deleteTest);
    const addDailyHomework = useAppStore((state) => state.addDailyHomework);
    const deleteDailyHomework = useAppStore((state) => state.deleteDailyHomework);
    const submitAndVerifyDailyHomework = useAppStore((state) => state.submitAndVerifyDailyHomework);
    const addSupportingFilesToHomework = useAppStore((state) => state.addSupportingFilesToHomework);
    const updateDailyHomework = useAppStore((state) => state.updateDailyHomework);
    const fetchDailyHomework = useAppStore((state) => state.fetchDailyHomework);
    const isGenerating = useAppStore((state) => state.isGenerating);
    const fetchTests = useAppStore((state) => state.fetchTests);
    const fetchProgress = useAppStore((state) => state.fetchProgress);
    const fetchChildren = useAppStore((state) => state.fetchChildren);
    const logout = useAuthStore((state) => state.logout);
    const updateUser = useAuthStore((state) => state.updateUser);

    useEffect(() => {
        fetchTests();
        fetchDailyHomework();
        fetchProgress();
        fetchChildren();
    }, [fetchTests, fetchDailyHomework, fetchProgress, fetchChildren]);

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

    const location = useLocation();

    // Dashboard Tabs aligned with PRD screens: Home (0), Today (2), Practice (4), Corrections (5), Progress (6), History
    type DashboardTab = 'home' | 'today' | 'practice' | 'corrections' | 'progress' | 'history' | 'homework_and_tests' | 'analytics';
    const [activeTab, setActiveTab] = useState<DashboardTab>('home');
    const [creationMode, setCreationMode] = useState<'daily_homework' | 'generate_test'>('daily_homework');
    const [historyFilter, setHistoryFilter] = useState<'all' | 'uploaded_homework' | 'completed_homework' | 'generated_tests' | 'completed_tests'>('all');
    const [historySearchQuery, setHistorySearchQuery] = useState('');

    // Synchronize tab with URL query parameter (e.g. from bottom bar)
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const tabParam = params.get('tab');
        if (tabParam === 'today') setActiveTab('today');
        else if (tabParam === 'practice') setActiveTab('practice');
        else if (tabParam === 'corrections') setActiveTab('corrections');
        else if (tabParam === 'progress') setActiveTab('progress');
        else if (tabParam === 'history') setActiveTab('history');
        else if (tabParam === 'home') setActiveTab('home');
    }, [location.search]);

    // PRD Prototype Modals State
    const [isTeamsModalOpen, setIsTeamsModalOpen] = useState(false);
    const [isManualModalOpen, setIsManualModalOpen] = useState(false);
    const [isSpellingModalOpen, setIsSpellingModalOpen] = useState(false);
    const [spellingChapterTitle, setSpellingChapterTitle] = useState('Chapter 4: The Friendly Whale');
    const [isWorksheetLibraryOpen, setIsWorksheetLibraryOpen] = useState(false);
    const [isCorrectionsModalOpen, setIsCorrectionsModalOpen] = useState(false);
    const [correctionsSubject, setCorrectionsSubject] = useState('Math');

    // Daily Homework Form State
    const [hwTitle, setHwTitle] = useState('');
    const [hwSubject, setHwSubject] = useState(displaySubjects[0] || 'Math');
    const [hwChildId, setHwChildId] = useState<string>('');
    const [hwSource, setHwSource] = useState<'whatsapp' | 'teams' | 'diary' | 'manual'>('whatsapp');
    const [hwDueDate, setHwDueDate] = useState('Today');
    const [hwDescription, setHwDescription] = useState('');
    const [hwFiles, setHwFiles] = useState<File[]>([]);
    const [hwPreviews, setHwPreviews] = useState<string[]>([]);
    const [hwIsSaving, setHwIsSaving] = useState(false);
    const [hwSuccessMsg, setHwSuccessMsg] = useState<string | null>(null);
    const [hwErrorMsg, setHwErrorMsg] = useState<string | null>(null);

    // Modal state for viewing homework & AI verification report
    const [viewingHomework, setViewingHomework] = useState<DailyHomework | null>(null);
    const [viewingFullImage, setViewingFullImage] = useState<string | null>(null);
    const hwFileInputRef = useRef<HTMLInputElement>(null);

    const filteredTests = selectedChildId === 'all'
        ? tests
        : tests.filter(t => (t as any).student_id === selectedChildId || (t as any).studentId === selectedChildId);

    const filteredHomework = selectedChildId === 'all'
        ? dailyHomeworkList
        : dailyHomeworkList.filter(h => h.childId === selectedChildId);

    const [isAutoReadingHw, setIsAutoReadingHw] = useState(false);
    const [verifyingHwId, setVerifyingHwId] = useState<string | null>(null);
    const [isVerifyingNotebook, setIsVerifyingNotebook] = useState(false);
    const parentNotebookInputRef = useRef<HTMLInputElement>(null);

    const autoReadHwFile = async (file: File) => {
        setIsAutoReadingHw(true);
        setHwErrorMsg(null);
        try {
            const extracted = await extractTeamsPost(file);
            if (extracted.tasks && extracted.tasks.length > 0) {
                const first = extracted.tasks[0];
                if (!hwTitle.trim()) setHwTitle(`${first.subject}: ${first.task.slice(0, 45)}`);
                if (first.subject) {
                    const match = displaySubjects.find(s => s.toLowerCase() === first.subject.toLowerCase());
                    if (match) setHwSubject(match);
                }
                if (first.dueDate && first.dueDate !== 'Tomorrow') setHwDueDate(first.dueDate);
                if (!hwDescription.trim()) setHwDescription(first.task);
                setHwSuccessMsg(`✨ AI auto-read: found ${extracted.tasks.length} task(s) from image!`);
                setTimeout(() => setHwSuccessMsg(null), 3500);
            }
        } catch (err: any) {
            console.warn('Auto-read image warning:', err);
        } finally {
            setIsAutoReadingHw(false);
        }
    };

    const handleHwFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const newFiles = Array.from(e.target.files);
        setHwFiles(prev => [...prev, ...newFiles]);
        const newPreviews = newFiles.map(f => f.type.startsWith('image/') ? URL.createObjectURL(f) : '');
        setHwPreviews(prev => [...prev, ...newPreviews]);
        setHwErrorMsg(null);

        // Auto-read details from first uploaded image if title is not yet set
        const firstImg = newFiles.find(f => f.type.startsWith('image/'));
        if (firstImg && !hwTitle.trim()) {
            autoReadHwFile(firstImg);
        }
    };

    const handleAutoReadClick = () => {
        const firstImg = hwFiles.find(f => f.type.startsWith('image/')) || hwFiles[0];
        if (firstImg) {
            autoReadHwFile(firstImg);
        }
    };

    const handleParentVerifySubmission = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!verifyingHwId || !e.target.files || e.target.files.length === 0) return;
        const files = Array.from(e.target.files);
        setIsVerifyingNotebook(true);
        try {
            const verified = await submitAndVerifyDailyHomework(verifyingHwId, files);
            if (verified) {
                setViewingHomework(verified);
            }
        } catch (err: any) {
            alert(err?.message || 'Failed to verify notebook pages.');
        } finally {
            setIsVerifyingNotebook(false);
            setVerifyingHwId(null);
            if (parentNotebookInputRef.current) parentNotebookInputRef.current.value = '';
        }
    };

    const [uploadingSupportingHwId, setUploadingSupportingHwId] = useState<string | null>(null);
    const [isUploadingSupporting, setIsUploadingSupporting] = useState(false);
    const [isExtractingQuestions, setIsExtractingQuestions] = useState<string | null>(null);
    const supportingFileInputRef = useRef<HTMLInputElement>(null);

    const handleSupportingFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!uploadingSupportingHwId || !e.target.files || e.target.files.length === 0) return;
        const files = Array.from(e.target.files);
        const hwId = uploadingSupportingHwId;
        setIsUploadingSupporting(true);
        try {
            const currentItem = dailyHomeworkList.find(h => h.id === hwId);
            const firstImg = files.find(f => f.type.startsWith('image/')) || files[0];
            
            // 1. Attach supporting files
            const updated = await addSupportingFilesToHomework(hwId, files);

            // 2. Automatically transcribe/extract questions from the textbook page if image provided
            if (firstImg && currentItem) {
                try {
                    setIsExtractingQuestions(hwId);
                    const questionsText = await extractContentFromHomeworkPage(
                        firstImg,
                        currentItem.subject,
                        currentItem.title
                    );
                    if (questionsText) {
                        updateDailyHomework(hwId, { extractedContent: questionsText });
                    }
                } catch (ocrErr) {
                    console.warn('OCR question extraction notice:', ocrErr);
                } finally {
                    setIsExtractingQuestions(null);
                }
            }

            if (updated) {
                setHwSuccessMsg(`🎉 Added ${files.length} supporting textbook page(s) to ${updated.subject} homework!`);
                setTimeout(() => setHwSuccessMsg(null), 3500);
            }
        } catch (err: any) {
            alert(err?.message || 'Failed to attach supporting material.');
        } finally {
            setIsUploadingSupporting(false);
            setUploadingSupportingHwId(null);
            if (supportingFileInputRef.current) supportingFileInputRef.current.value = '';
        }
    };

    const handleExtractQuestionsManually = async (hw: DailyHomework) => {
        const pages = [...(hw.supportingMaterialUrls || []), ...(hw.assignmentImageUrls || [])];
        if (pages.length === 0) {
            alert('Please upload a textbook page or worksheet photo first.');
            return;
        }

        setIsExtractingQuestions(hw.id);
        try {
            const url = pages[0];
            let file: File;
            if (url.startsWith('data:')) {
                const res = await fetch(url);
                const blob = await res.blob();
                file = new File([blob], `${hw.subject}-page.jpg`, { type: blob.type || 'image/jpeg' });
            } else {
                throw new Error('Please upload a fresh page photo to extract questions.');
            }

            const questionsText = await extractContentFromHomeworkPage(file, hw.subject, hw.title);
            if (questionsText) {
                updateDailyHomework(hw.id, { extractedContent: questionsText });
                setHwSuccessMsg(`✨ Transcribed questions from textbook page into ${hw.subject} homework!`);
                setTimeout(() => setHwSuccessMsg(null), 3500);
            }
        } catch (err: any) {
            alert(err?.message || 'Failed to extract questions from page.');
        } finally {
            setIsExtractingQuestions(null);
        }
    };

    const removeHwFile = (index: number) => {
        setHwFiles(prev => prev.filter((_, i) => i !== index));
        setHwPreviews(prev => prev.filter((_, i) => i !== index));
    };

    const handleSaveDailyHomework = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!hwTitle.trim()) {
            setHwErrorMsg('Please enter a title or chapter for this homework.');
            return;
        }
        if (hwFiles.length === 0) {
            setHwErrorMsg('Please upload or snap a photo of the school homework (from WhatsApp / Teams).');
            return;
        }

        setHwIsSaving(true);
        setHwErrorMsg(null);
        try {
            const assignedChild = childrenList.find(c => c.id === hwChildId) || childrenList[0];
            await addDailyHomework({
                childId: assignedChild?.id || (selectedChildId === 'all' ? childrenList[0]?.id : selectedChildId),
                childName: assignedChild?.name || 'Child',
                title: hwTitle.trim(),
                subject: hwSubject,
                description: hwDescription.trim(),
                source: hwSource,
                dueDate: hwDueDate,
                files: hwFiles
            });

            setHwSuccessMsg('🎉 Daily homework saved! It is now visible to your student.');
            setHwTitle('');
            setHwDescription('');
            setHwFiles([]);
            setHwPreviews([]);
            setTimeout(() => setHwSuccessMsg(null), 3500);
        } catch (err: any) {
            setHwErrorMsg(err.message || 'Failed to save daily homework');
        } finally {
            setHwIsSaving(false);
        }
    };

    const completedTests = filteredTests.filter(t => t.status === 'completed');
    const averageScore = completedTests.length > 0
        ? Math.round(completedTests.reduce((acc, curr) => acc + (curr.score || 0), 0) / completedTests.length)
        : 0;
    const chartData = completedTests.slice(-7).map((t, idx) => ({ name: `T${idx + 1}`, score: t.score || 0 }));

    const query = historySearchQuery.trim().toLowerCase();

    // 1. Uploaded Homework history
    const historyUploadedHw = filteredHomework.filter(h => {
        if (!query) return true;
        return (
            h.title.toLowerCase().includes(query) ||
            h.subject.toLowerCase().includes(query) ||
            (h.childName && h.childName.toLowerCase().includes(query)) ||
            (h.description && h.description.toLowerCase().includes(query))
        );
    });

    // 2. Completed Homework history (verified by AI)
    const historyCompletedHw = filteredHomework.filter(h => {
        const isDone = h.status === 'verified' || h.submissionStatus === 'verified_complete' || Boolean(h.verificationResult);
        if (!isDone) return false;
        if (!query) return true;
        return (
            h.title.toLowerCase().includes(query) ||
            h.subject.toLowerCase().includes(query) ||
            (h.childName && h.childName.toLowerCase().includes(query))
        );
    });

    // 3. Generated Practice Tests history
    const historyGeneratedTests = filteredTests.filter(t => {
        if (!query) return true;
        return (
            t.title.toLowerCase().includes(query) ||
            t.subject.toLowerCase().includes(query)
        );
    });

    // 4. Completed Practice Tests history
    const historyCompletedTests = filteredTests.filter(t => {
        if (t.status !== 'completed') return false;
        if (!query) return true;
        return (
            t.title.toLowerCase().includes(query) ||
            t.subject.toLowerCase().includes(query)
        );
    });

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
            <header style={{ marginBottom: '1.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h1 style={{ fontSize: 'clamp(1.5rem, 4vw, 2.25rem)', marginBottom: '0.25rem' }}>Parent Dashboard</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: 'clamp(0.9rem, 2.5vw, 1.125rem)' }}>Welcome back, {user?.name || 'Parent'} 👋</p>
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

                    <div className="desktop-only items-center gap-3">
                        <Link to="/profile" className="btn" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-main)', padding: '0.45rem 0.85rem' }}>
                            {user?.avatarUrl ? <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>{user.avatarUrl}</span> : <UserIcon size={18} />} Profile
                        </Link>
                        <button className="btn btn-secondary" onClick={logout} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.45rem 0.85rem' }}>
                            Logout
                        </button>
                    </div>
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
            <div className="stats-grid-responsive" style={{ marginBottom: '1.5rem' }}>
                <div
                    className="card hover-lift"
                    onClick={() => {
                        setActiveTab('history');
                        setHistoryFilter('uploaded_homework');
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', padding: '1rem', cursor: 'pointer' }}
                    title="Click to view all uploaded homework in history"
                >
                    <div style={{ background: 'rgba(79, 70, 229, 0.1)', padding: '0.75rem', borderRadius: 'var(--radius-md)', color: 'var(--primary)', flexShrink: 0 }}>
                        <Smartphone size={22} />
                    </div>
                    <div>
                        <h3 style={{ fontSize: '1.35rem', margin: 0, fontWeight: 700 }}>{filteredHomework.length}</h3>
                        <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.75rem' }}>
                            Daily Homework • {filteredHomework.filter(h => h.status === 'pending' || h.status === 'needs_revision').length} pending →
                        </p>
                    </div>
                </div>

                <div
                    className="card hover-lift"
                    onClick={() => {
                        setActiveTab('history');
                        setHistoryFilter('generated_tests');
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', padding: '1rem', cursor: 'pointer' }}
                    title="Click to view generated practice tests in history"
                >
                    <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '0.75rem', borderRadius: 'var(--radius-md)', color: '#2563eb', flexShrink: 0 }}>
                        <FileText size={22} />
                    </div>
                    <div>
                        <h3 style={{ fontSize: '1.35rem', margin: 0, fontWeight: 700 }}>{filteredTests.length}</h3>
                        <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.75rem' }}>
                            Practice Tests • {completedTests.length} done →
                        </p>
                    </div>
                </div>

                <div
                    className="card hover-lift"
                    onClick={() => {
                        setActiveTab('history');
                        setHistoryFilter('completed_tests');
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', padding: '1rem', cursor: 'pointer' }}
                    title="Click to view completed test scores in history"
                >
                    <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '0.75rem', borderRadius: 'var(--radius-md)', color: 'var(--secondary)', flexShrink: 0 }}>
                        <CheckCircle size={22} />
                    </div>
                    <div>
                        <h3 style={{ fontSize: '1.35rem', margin: 0, fontWeight: 700 }}>{averageScore}%</h3>
                        <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.75rem' }}>Avg Score • View history →</p>
                    </div>
                </div>

                <Link to="/calendar" className="card hover-lift" style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', padding: '1rem', textDecoration: 'none', color: 'inherit' }}>
                    <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: '0.75rem', borderRadius: 'var(--radius-md)', color: '#d97706', flexShrink: 0 }}>
                        <Calendar size={22} />
                    </div>
                    <div>
                        <h3 style={{ fontSize: '1.15rem', margin: 0, fontWeight: 700 }}>Calendar</h3>
                        <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.75rem' }}>Exams & Schedule →</p>
                    </div>
                </Link>
            </div>

            {/* Mobile-Friendly Segmented Tab Navigation Aligned with PRD Screens */}
            <div className="dashboard-tabs-container history-filter-scroll" role="tablist" aria-label="Parent Dashboard Views">
                <button
                    type="button"
                    role="tab"
                    id="tab-home"
                    aria-selected={activeTab === 'home'}
                    className={`dashboard-tab-btn ${activeTab === 'home' ? 'active' : ''}`}
                    onClick={() => setActiveTab('home')}
                >
                    <Book size={16} /> Home
                </button>
                <button
                    type="button"
                    role="tab"
                    id="tab-today"
                    aria-selected={activeTab === 'today'}
                    className={`dashboard-tab-btn ${activeTab === 'today' ? 'active' : ''}`}
                    onClick={() => setActiveTab('today')}
                >
                    <CheckSquare size={16} /> Today's Plan
                </button>
                <button
                    type="button"
                    role="tab"
                    id="tab-practice"
                    aria-selected={activeTab === 'practice' || activeTab === 'homework_and_tests'}
                    className={`dashboard-tab-btn ${activeTab === 'practice' || activeTab === 'homework_and_tests' ? 'active' : ''}`}
                    onClick={() => setActiveTab('practice')}
                >
                    <Layers size={16} /> Practice &amp; Library
                </button>
                <button
                    type="button"
                    role="tab"
                    id="tab-corrections"
                    aria-selected={activeTab === 'corrections'}
                    className={`dashboard-tab-btn ${activeTab === 'corrections' ? 'active' : ''}`}
                    onClick={() => setActiveTab('corrections')}
                >
                    <Award size={16} /> Test Corrections
                </button>
                <button
                    type="button"
                    role="tab"
                    id="tab-progress"
                    aria-selected={activeTab === 'progress' || activeTab === 'analytics'}
                    className={`dashboard-tab-btn ${activeTab === 'progress' || activeTab === 'analytics' ? 'active' : ''}`}
                    onClick={() => setActiveTab('progress')}
                >
                    <TrendingUp size={16} /> Progress Report
                </button>
                <button
                    type="button"
                    role="tab"
                    id="tab-history"
                    aria-selected={activeTab === 'history'}
                    className={`dashboard-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
                    onClick={() => setActiveTab('history')}
                >
                    <History size={16} /> Archive ({filteredHomework.length + filteredTests.length})
                </button>
            </div>

            {/* SCREEN 0: HOME DASHBOARD */}
            {activeTab === 'home' && (
                <div id="panel-home" role="tabpanel" aria-labelledby="tab-home" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    
                    {/* HERO ACTION: UPLOAD TODAY'S WORK (FR-1, FR-4) */}
                    <div style={{
                        background: 'linear-gradient(135deg, #0F766E 0%, #0D9488 50%, #14B8A6 100%)',
                        borderRadius: 'var(--radius-xl)',
                        padding: '1.75rem',
                        color: 'white',
                        boxShadow: '0 12px 32px rgba(13, 148, 136, 0.25)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1rem'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                            <span style={{ background: 'rgba(255, 255, 255, 0.2)', padding: '0.35rem 0.75rem', borderRadius: '1rem', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                                Class II A · Daily Flow
                            </span>
                        </div>

                        <div>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, color: 'white', letterSpacing: '-0.02em' }}>
                                Upload Today's School Work
                            </h2>
                            <p style={{ margin: '0.35rem 0 0', fontSize: '0.88rem', color: '#CCFBF1', lineHeight: 1.4, maxWidth: '520px' }}>
                                Take a screenshot of the teacher's Teams post or snap an almanac photo. The app turns it into today's plan, test reminders, and practice sheets.
                            </p>
                        </div>

                        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                            <button
                                type="button"
                                onClick={() => setIsTeamsModalOpen(true)}
                                style={{
                                    background: 'white',
                                    color: '#0F766E',
                                    border: 'none',
                                    padding: '0.75rem 1.25rem',
                                    borderRadius: 'var(--radius-md)',
                                    fontWeight: 700,
                                    fontSize: '0.9rem',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.45rem',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                                }}
                            >
                                <Camera size={18} />
                                <span>Upload Teams Post (Screen 1)</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setIsManualModalOpen(true)}
                                style={{
                                    background: 'rgba(255, 255, 255, 0.15)',
                                    color: 'white',
                                    border: '1.5px solid rgba(255, 255, 255, 0.35)',
                                    padding: '0.75rem 1.15rem',
                                    borderRadius: 'var(--radius-md)',
                                    fontWeight: 600,
                                    fontSize: '0.88rem',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.45rem'
                                }}
                            >
                                <BookOpen size={17} />
                                <span>Add from Almanac (Screen 0b)</span>
                            </button>
                        </div>
                    </div>

                    {/* SHORTCUT TILES (PRD Section 6 Screen 0) */}
                    <div>
                        <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 0.85rem', color: 'var(--text-main)' }}>
                            Quick Shortcuts
                        </h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.85rem' }}>
                            <div 
                                className="card hover-lift" 
                                onClick={() => setActiveTab('today')}
                                style={{ padding: '1rem', cursor: 'pointer', border: '1.5px solid var(--border)' }}
                            >
                                <div style={{ color: 'var(--teal)', marginBottom: '0.45rem' }}>
                                    <CheckSquare size={22} />
                                </div>
                                <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700 }}>Today's Plan</h4>
                                <p style={{ margin: '0.2rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                    {filteredHomework.length} homework items by subject
                                </p>
                            </div>

                            <div 
                                className="card hover-lift" 
                                onClick={() => setActiveTab('practice')}
                                style={{ padding: '1rem', cursor: 'pointer', border: '1.5px solid var(--border)' }}
                            >
                                <div style={{ color: 'var(--primary)', marginBottom: '0.45rem' }}>
                                    <Sparkles size={22} />
                                </div>
                                <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700 }}>Check Homework</h4>
                                <p style={{ margin: '0.2rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                    Compare notebook against answer steps
                                </p>
                            </div>

                            <div 
                                className="card hover-lift" 
                                onClick={() => setIsCorrectionsModalOpen(true)}
                                style={{ padding: '1rem', cursor: 'pointer', border: '1.5px solid var(--border)' }}
                            >
                                <div style={{ color: '#EF4444', marginBottom: '0.45rem' }}>
                                    <Award size={22} />
                                </div>
                                <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700 }}>Test Corrections</h4>
                                <p style={{ margin: '0.2rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                    "Do corrections" guided walkthrough
                                </p>
                            </div>

                            <div 
                                className="card hover-lift" 
                                onClick={() => setIsWorksheetLibraryOpen(true)}
                                style={{ padding: '1rem', cursor: 'pointer', border: '1.5px solid var(--border)' }}
                            >
                                <div style={{ color: '#2563EB', marginBottom: '0.45rem' }}>
                                    <Layers size={22} />
                                </div>
                                <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700 }}>Worksheet Library</h4>
                                <p style={{ margin: '0.2rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                    Saved worksheets for practice
                                </p>
                            </div>

                            <Link 
                                to="/calendar"
                                className="card hover-lift" 
                                style={{ padding: '1rem', textDecoration: 'none', color: 'inherit', border: '1.5px solid var(--border)' }}
                            >
                                <div style={{ color: '#D97706', marginBottom: '0.45rem' }}>
                                    <Calendar size={22} />
                                </div>
                                <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700 }}>Calendar</h4>
                                <p style={{ margin: '0.2rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                    Tests, dictation &amp; reminder rules
                                </p>
                            </Link>

                            <div 
                                className="card hover-lift" 
                                onClick={() => setActiveTab('progress')}
                                style={{ padding: '1rem', cursor: 'pointer', border: '1.5px solid var(--border)' }}
                            >
                                <div style={{ color: '#10B981', marginBottom: '0.45rem' }}>
                                    <TrendingUp size={22} />
                                </div>
                                <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700 }}>Progress Report</h4>
                                <p style={{ margin: '0.2rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                    Monthly &amp; quarterly share sheet
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* TODAY'S ACTIVE TASKS SUMMARY */}
                    <div className="card" style={{ padding: '1.25rem', border: '1.5px solid var(--border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                            <h3 style={{ fontSize: '1.05rem', margin: 0, fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                                <CheckSquare size={18} color="var(--teal)" />
                                Today's Homeroom Tasks ({filteredHomework.length})
                            </h3>
                            <button
                                type="button"
                                onClick={() => setActiveTab('today')}
                                style={{ background: 'none', border: 'none', color: 'var(--teal)', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}
                            >
                                View Detailed Plan →
                            </button>
                        </div>

                        {filteredHomework.length === 0 ? (
                            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                No tasks uploaded yet today. Tap "Upload Teams Post" above to begin.
                            </p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                                {filteredHomework.slice(0, 3).map(hw => (
                                    <div key={hw.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: 'var(--surface-hover)', borderRadius: 'var(--radius-sm)' }}>
                                        <div>
                                            <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-main)' }}>
                                                {hw.subject}: {hw.title}
                                            </span>
                                            <p style={{ margin: '0.15rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                {hw.description || 'Assigned in homeroom'}
                                            </p>
                                        </div>
                                        <span className="chip-amber">
                                            {hw.dueDate || 'Today'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* SCREEN 2: TODAY'S PLAN */}
            {activeTab === 'today' && (
                <div id="panel-today" role="tabpanel" aria-labelledby="tab-today" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                        <div>
                            <h2 style={{ fontSize: '1.25rem', margin: 0, fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                                <CheckSquare size={20} color="var(--teal)" />
                                Today's Plan by Subject
                            </h2>
                            <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                                Homework split by subject with due dates &amp; contextual actions (FR-5)
                            </p>
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                                type="button"
                                onClick={() => setIsTeamsModalOpen(true)}
                                className="btn-teal"
                                style={{ padding: '0.5rem 0.85rem', fontSize: '0.82rem' }}
                            >
                                <Camera size={15} />
                                <span>Upload Teams Post</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsManualModalOpen(true)}
                                className="btn btn-secondary"
                                style={{ padding: '0.5rem 0.85rem', fontSize: '0.82rem' }}
                            >
                                <BookOpen size={15} />
                                <span>Add from Almanac</span>
                            </button>
                        </div>
                    </div>

                    {filteredHomework.length === 0 ? (
                        <div className="card" style={{ padding: '2.5rem', textAlign: 'center' }}>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
                                No tasks in today's plan yet.
                            </p>
                            <button
                                type="button"
                                onClick={() => setIsTeamsModalOpen(true)}
                                className="btn-teal"
                                style={{ margin: '0 auto', padding: '0.65rem 1.25rem' }}
                            >
                                <Camera size={16} />
                                <span>Upload Teams Post to Generate Plan</span>
                            </button>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {filteredHomework.map(hw => (
                                <div 
                                    key={hw.id} 
                                    className="card" 
                                    style={{ 
                                        padding: '1.15rem', 
                                        border: '1.5px solid var(--border)',
                                        borderLeft: `5px solid ${hw.subject === 'English' ? '#10B981' : hw.subject === 'Math' ? '#4F46E5' : '#D97706'}`
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                <span style={{
                                                    background: hw.subject === 'Math' ? '#EEF2FF' : hw.subject === 'English' ? '#F0FDF4' : '#FEF3C7',
                                                    color: hw.subject === 'Math' ? '#4F46E5' : hw.subject === 'English' ? '#166534' : '#92400E',
                                                    padding: '0.2rem 0.6rem',
                                                    borderRadius: '1rem',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 700
                                                }}>
                                                    {hw.subject}
                                                </span>
                                                <span className="chip-amber">
                                                    📅 {hw.dueDate || 'Today'}
                                                </span>
                                                {hw.reminderRule && (
                                                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', background: 'var(--surface-hover)', padding: '0.15rem 0.5rem', borderRadius: '1rem' }}>
                                                        🔔 {hw.reminderRule.replace(/_/g, ' ')}
                                                    </span>
                                                )}
                                                {hw.hasCorrectionsNotice && (
                                                    <span style={{ background: '#FEE2E2', color: '#991B1B', padding: '0.15rem 0.55rem', borderRadius: '1rem', fontSize: '0.72rem', fontWeight: 700 }}>
                                                        ✍️ Sign &amp; Do Corrections
                                                    </span>
                                                )}
                                            </div>

                                            <h3 style={{ fontSize: '1rem', margin: '0.45rem 0 0.2rem', fontWeight: 700, color: 'var(--text-main)' }}>
                                                {hw.title}
                                            </h3>
                                            <p style={{ margin: 0, fontSize: '0.85rem', color: '#475569', lineHeight: 1.4 }}>
                                                {hw.description || 'Assigned in homeroom'}
                                            </p>
                                        </div>

                                        <span style={{
                                            fontSize: '0.75rem',
                                            fontWeight: 700,
                                            padding: '0.2rem 0.6rem',
                                            borderRadius: '1rem',
                                            background: hw.submissionStatus === 'verified_complete' ? '#DCFCE7' : '#FEF3C7',
                                            color: hw.submissionStatus === 'verified_complete' ? '#166534' : '#92400E'
                                        }}>
                                            {hw.submissionStatus === 'verified_complete' ? '✅ Complete' : '⏳ Pending'}
                                        </span>
                                    </div>

                                    {/* Supporting Material & Actual Homework Content (FR-5) */}
                                    <div style={{
                                        marginTop: '0.85rem',
                                        padding: '0.85rem',
                                        background: '#F8FAFC',
                                        borderRadius: 'var(--radius-md)',
                                        border: '1.5px dashed #CBD5E1',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '0.65rem'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                                                <FileText size={16} color="var(--teal)" />
                                                <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#1E293B' }}>
                                                    Supporting Material &amp; Homework Content
                                                </span>
                                                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                                                    ({((hw.supportingMaterialUrls?.length || 0) + (hw.assignmentImageUrls?.length || 0))} attached)
                                                </span>
                                            </div>

                                            <button
                                                type="button"
                                                disabled={isUploadingSupporting && uploadingSupportingHwId === hw.id}
                                                onClick={() => {
                                                    setUploadingSupportingHwId(hw.id);
                                                    supportingFileInputRef.current?.click();
                                                }}
                                                className="btn-teal"
                                                style={{
                                                    padding: '0.4rem 0.85rem',
                                                    fontSize: '0.8rem',
                                                    borderRadius: '1rem',
                                                    cursor: (isUploadingSupporting && uploadingSupportingHwId === hw.id) ? 'not-allowed' : 'pointer'
                                                }}
                                            >
                                                <Camera size={14} className={(isUploadingSupporting && uploadingSupportingHwId === hw.id) ? 'animate-spin' : ''} />
                                                <span>
                                                    {(isUploadingSupporting && uploadingSupportingHwId === hw.id) 
                                                        ? 'Uploading & Transcribing...' 
                                                        : '+ Upload Textbook Page / Content'}
                                                </span>
                                            </button>
                                        </div>

                                        {/* Prompt from Teacher / AI guidance */}
                                        {hw.requiredFilesPrompt && (
                                            <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', padding: '0.45rem 0.65rem', borderRadius: 'var(--radius-sm)', fontSize: '0.78rem', color: '#1D4ED8', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                <span>💡</span>
                                                <span><strong>Teacher note:</strong> {hw.requiredFilesPrompt}</span>
                                            </div>
                                        )}

                                        {/* Attached Supporting Images Thumbnails */}
                                        {((hw.supportingMaterialUrls && hw.supportingMaterialUrls.length > 0) || (hw.assignmentImageUrls && hw.assignmentImageUrls.length > 0)) ? (
                                            <div>
                                                <div style={{ display: 'flex', gap: '0.55rem', flexWrap: 'wrap', alignItems: 'center' }}>
                                                    {[...(hw.assignmentImageUrls || []), ...(hw.supportingMaterialUrls || [])].filter((url, idx, self) => self.indexOf(url) === idx).map((url, imgIdx) => (
                                                        <div 
                                                            key={imgIdx} 
                                                            onClick={() => setViewingFullImage(url)}
                                                            style={{ 
                                                                position: 'relative', 
                                                                width: '56px', 
                                                                height: '56px', 
                                                                borderRadius: 'var(--radius-sm)', 
                                                                overflow: 'hidden', 
                                                                border: '1.5px solid var(--border)',
                                                                cursor: 'pointer',
                                                                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                                                            }}
                                                            title="Click to view full size"
                                                        >
                                                            <img src={url} alt={`Supporting page ${imgIdx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                            <span style={{ position: 'absolute', bottom: 1, right: 1, background: 'rgba(0,0,0,0.65)', color: 'white', fontSize: '0.62rem', padding: '0 3px', borderRadius: '2px', fontWeight: 600 }}>
                                                                P{imgIdx + 1}
                                                            </span>
                                                        </div>
                                                    ))}

                                                    <button
                                                        type="button"
                                                        disabled={isExtractingQuestions === hw.id}
                                                        onClick={() => handleExtractQuestionsManually(hw)}
                                                        style={{
                                                            background: 'white',
                                                            border: '1px solid var(--border)',
                                                            borderRadius: 'var(--radius-sm)',
                                                            padding: '0.4rem 0.65rem',
                                                            fontSize: '0.75rem',
                                                            color: 'var(--text-main)',
                                                            cursor: isExtractingQuestions === hw.id ? 'not-allowed' : 'pointer',
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '0.35rem',
                                                            fontWeight: 600
                                                        }}
                                                    >
                                                        <Sparkles size={13} color="var(--teal)" className={isExtractingQuestions === hw.id ? 'animate-spin' : ''} />
                                                        <span>{isExtractingQuestions === hw.id ? 'Extracting questions...' : '✨ Transcribe Questions'}</span>
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <p style={{ margin: 0, fontSize: '0.76rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                                No textbook or worksheet photos attached yet. Tap "+ Upload Textbook Page / Content" above to attach pages and build the complete homework.
                                            </p>
                                        )}

                                        {/* Digitized Questions & Exercises */}
                                        {hw.extractedContent && (
                                            <div style={{ marginTop: '0.4rem', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 'var(--radius-sm)', padding: '0.65rem 0.85rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.35rem' }}>
                                                    <CheckCircle2 size={14} color="#059669" />
                                                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0F172A' }}>
                                                        Digitized Homework Questions (from Textbook / Worksheet):
                                                    </span>
                                                </div>
                                                <pre style={{ margin: 0, fontSize: '0.78rem', color: '#334155', fontFamily: 'inherit', whiteSpace: 'pre-wrap', lineHeight: 1.45 }}>
                                                    {hw.extractedContent}
                                                </pre>
                                            </div>
                                        )}
                                    </div>

                                    {/* CONTEXTUAL ACTION BUTTONS (FR-5) */}
                                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '1rem', paddingTop: '0.85rem', borderTop: '1px solid var(--border)' }}>
                                        {/* English: Build Spelling List */}
                                        {hw.subject === 'English' && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setSpellingChapterTitle(hw.title);
                                                    setIsSpellingModalOpen(true);
                                                }}
                                                className="btn-teal"
                                                style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem' }}
                                            >
                                                <Volume2 size={15} />
                                                <span>Build Spelling List</span>
                                            </button>
                                        )}

                                        {/* If Teacher marked "Do corrections" */}
                                        {hw.hasCorrectionsNotice && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setCorrectionsSubject(hw.subject);
                                                    setIsCorrectionsModalOpen(true);
                                                }}
                                                style={{
                                                    background: '#FEE2E2',
                                                    color: '#991B1B',
                                                    border: '1px solid #FCA5A5',
                                                    borderRadius: 'var(--radius-md)',
                                                    padding: '0.45rem 0.85rem',
                                                    fontSize: '0.8rem',
                                                    fontWeight: 700,
                                                    cursor: 'pointer',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '0.35rem'
                                                }}
                                            >
                                                <Award size={15} />
                                                <span>Guide Test Corrections</span>
                                            </button>
                                        )}

                                        {/* Check Solved Notebook */}
                                        <button
                                            type="button"
                                            onClick={() => setViewingHomework(hw)}
                                            className="btn btn-secondary"
                                            style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem' }}
                                        >
                                            <Eye size={15} />
                                            <span>Check Notebook &amp; Feedback</span>
                                        </button>

                                        {/* Adaptive Practice Sheet */}
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setCreationMode('generate_test');
                                                setSelectedSubject(hw.subject);
                                                setActiveTab('practice');
                                            }}
                                            className="btn btn-primary"
                                            style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem' }}
                                        >
                                            <Sparkles size={15} />
                                            <span>Generate Practice Sheet</span>
                                        </button>
                                    </div>
                                </div>
                            ))}
                            <input
                                ref={supportingFileInputRef}
                                type="file"
                                accept="image/*,.pdf"
                                multiple
                                style={{ display: 'none' }}
                                onChange={handleSupportingFileChange}
                            />
                        </div>
                    )}
                </div>
            )}

            {/* TAB PANEL: PRACTICE & WORKSHEET LIBRARY (SCREEN 4) */}
            {(activeTab === 'practice' || activeTab === 'homework_and_tests') && (
                <div id="panel-homework-tests" role="tabpanel" aria-labelledby="tab-practice" style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
                    
                    {/* Top Library Drawer Trigger Banner (FR-11) */}
                    <div style={{
                        background: 'linear-gradient(135deg, #1E293B, #0F172A)',
                        borderRadius: 'var(--radius-lg)',
                        padding: '1rem 1.25rem',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '0.75rem'
                    }}>
                        <div>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#38BDF8', textTransform: 'uppercase' }}>
                                FR-11 · Worksheet Reuse Library
                            </span>
                            <h3 style={{ margin: '0.2rem 0', fontSize: '1.1rem', fontWeight: 800 }}>
                                Browse All Saved Worksheets
                            </h3>
                            <p style={{ margin: 0, fontSize: '0.78rem', color: '#CBD5E1' }}>
                                Every uploaded worksheet is archived here to generate adaptive practice anytime.
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={() => setIsWorksheetLibraryOpen(true)}
                            className="btn-teal"
                            style={{ padding: '0.55rem 1rem', fontSize: '0.82rem' }}
                        >
                            <Layers size={16} />
                            <span>Open Worksheet Library</span>
                        </button>
                    </div>

                    {/* CREATION HUB CARD WITH TOGGLE */}
                    <div className="card" style={{ border: '1.5px solid var(--border)', boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.85rem', marginBottom: '1.25rem' }}>
                            <div>
                                <h2 style={{ fontSize: '1.25rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    {creationMode === 'daily_homework' ? <Smartphone size={20} color="var(--primary)" /> : <Sparkles size={20} color="var(--primary)" />}
                                    {creationMode === 'daily_homework' ? 'School Daily Homework' : 'AI Practice Test Generator'}
                                </h2>
                                <p style={{ margin: '0.25rem 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                                    {creationMode === 'daily_homework'
                                        ? 'Upload homework photos received via WhatsApp or MS Teams. Your student will upload their completed notebook for AI verification.'
                                        : 'Upload worksheet/book photos to generate timed, auto-graded practice tests.'}
                                </p>
                            </div>

                            {/* TOGGLE SWITCH */}
                            <div className="creation-mode-toggle" role="tablist" aria-label="Creation Mode">
                                <button
                                    type="button"
                                    role="tab"
                                    aria-selected={creationMode === 'daily_homework'}
                                    className={`creation-mode-btn ${creationMode === 'daily_homework' ? 'active' : ''}`}
                                    onClick={() => setCreationMode('daily_homework')}
                                >
                                    📲 Daily School Homework
                                </button>
                                <button
                                    type="button"
                                    role="tab"
                                    aria-selected={creationMode === 'generate_test'}
                                    className={`creation-mode-btn ${creationMode === 'generate_test' ? 'active' : ''}`}
                                    onClick={() => setCreationMode('generate_test')}
                                >
                                    ⚡ Generate Practice Test
                                </button>
                            </div>
                        </div>

                        {/* MODE A: DAILY SCHOOL HOMEWORK UPLOAD */}
                        {creationMode === 'daily_homework' && (
                            <form onSubmit={handleSaveDailyHomework} style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
                                {/* Source Selector */}
                                <div>
                                    <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.4rem' }}>
                                        Homework Source
                                    </label>
                                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                        {[
                                            { id: 'whatsapp', label: '🟢 WhatsApp Class Group' },
                                            { id: 'teams', label: '🟣 Microsoft Teams' },
                                            { id: 'diary', label: '📔 Student Diary' },
                                            { id: 'manual', label: '✏️ Manual Entry' }
                                        ].map(src => (
                                            <button
                                                key={src.id}
                                                type="button"
                                                onClick={() => setHwSource(src.id as any)}
                                                style={{
                                                    padding: '0.45rem 0.85rem',
                                                    borderRadius: '2rem',
                                                    border: `1.5px solid ${hwSource === src.id ? 'var(--primary)' : 'var(--border)'}`,
                                                    background: hwSource === src.id ? 'rgba(79, 70, 229, 0.08)' : 'var(--surface)',
                                                    color: hwSource === src.id ? 'var(--primary)' : 'var(--text-main)',
                                                    fontWeight: hwSource === src.id ? 700 : 500,
                                                    fontSize: '0.82rem',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                {src.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Child & Subject Row */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                                    {childrenList.length > 1 && (
                                        <div>
                                            <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.4rem' }}>
                                                Assign To Child
                                            </label>
                                            <select
                                                value={hwChildId || (childrenList[0]?.id || '')}
                                                onChange={e => setHwChildId(e.target.value)}
                                                style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--surface)', fontSize: '0.9rem' }}
                                            >
                                                {childrenList.map(c => (
                                                    <option key={c.id} value={c.id}>{c.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    <div>
                                        <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.4rem' }}>
                                            Subject
                                        </label>
                                        <select
                                            value={hwSubject}
                                            onChange={e => setHwSubject(e.target.value)}
                                            style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--surface)', fontSize: '0.9rem' }}
                                        >
                                            {displaySubjects.map(s => (
                                                <option key={s} value={s}>{s}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.4rem' }}>
                                            Due By
                                        </label>
                                        <input
                                            type="text"
                                            value={hwDueDate}
                                            onChange={e => setHwDueDate(e.target.value)}
                                            placeholder="e.g. Today, Tomorrow, or 25 Nov"
                                            style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--surface)', fontSize: '0.9rem' }}
                                        />
                                    </div>
                                </div>

                                {/* Homework Title / Topic */}
                                <div>
                                    <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.4rem' }}>
                                        Homework Title / Chapter
                                    </label>
                                    <input
                                        type="text"
                                        value={hwTitle}
                                        onChange={e => setHwTitle(e.target.value)}
                                        placeholder="e.g. Ex 4.2 Linear Equations Q1 to Q8, or Science Ch 5 Notes"
                                        style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--surface)', fontSize: '0.9rem' }}
                                    />
                                </div>

                                {/* Teacher Notes (Optional) */}
                                <div>
                                    <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.4rem' }}>
                                        Teacher's Notes or Specific Instructions (Optional)
                                    </label>
                                    <textarea
                                        value={hwDescription}
                                        onChange={e => setHwDescription(e.target.value)}
                                        placeholder="e.g. Write answers with complete steps in notebook. Rough work required on the right margin."
                                        rows={2}
                                        style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--surface)', fontSize: '0.88rem', resize: 'vertical' }}
                                    />
                                </div>

                                {/* Photo / Screenshot Upload */}
                                <div>
                                    <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.4rem' }}>
                                        School Homework Photo(s) / Screenshot(s)
                                    </label>
                                    <label style={{
                                        display: 'block',
                                        border: `2px dashed ${hwFiles.length > 0 ? 'var(--primary)' : 'var(--border)'}`,
                                        borderRadius: 'var(--radius-md)',
                                        padding: '1.25rem 1rem',
                                        textAlign: 'center',
                                        cursor: 'pointer',
                                        background: hwFiles.length > 0 ? 'rgba(79,70,229,0.03)' : 'var(--surface-hover)',
                                        transition: 'var(--transition)'
                                    }}>
                                        <input
                                            ref={hwFileInputRef}
                                            type="file"
                                            style={{ display: 'none' }}
                                            onChange={handleHwFileChange}
                                            accept="image/*,.pdf"
                                            multiple
                                        />
                                        <div style={{ color: 'var(--text-muted)' }}>
                                            <Camera size={26} style={{ margin: '0 auto 0.4rem', color: 'var(--primary)' }} />
                                            <p style={{ margin: 0, fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main)' }}>
                                                Snap Photo or Upload Screenshot
                                            </p>
                                            <p style={{ margin: '0.2rem 0 0', fontSize: '0.75rem' }}>
                                                WhatsApp screenshot, Teams photo, or diary page (JPG, PNG, PDF)
                                            </p>
                                        </div>
                                    </label>

                                    {/* Uploaded Previews */}
                                    {hwPreviews.length > 0 && (
                                        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
                                            {hwPreviews.map((preview, idx) => (
                                                <div key={idx} style={{ position: 'relative', width: '70px', height: '70px', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--border)' }}>
                                                    {preview ? (
                                                        <img src={preview} alt="Homework page" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                    ) : (
                                                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-hover)' }}>
                                                            <FileText size={20} />
                                                        </div>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={() => removeHwFile(idx)}
                                                        style={{
                                                            position: 'absolute',
                                                            top: '2px',
                                                            right: '2px',
                                                            background: 'rgba(0,0,0,0.65)',
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

                                    {hwFiles.length > 0 && (
                                        <div style={{ marginTop: '0.65rem' }}>
                                            <button
                                                type="button"
                                                onClick={handleAutoReadClick}
                                                disabled={isAutoReadingHw}
                                                style={{
                                                    background: 'rgba(13, 148, 136, 0.1)',
                                                    color: 'var(--teal)',
                                                    border: '1px solid var(--teal)',
                                                    borderRadius: 'var(--radius-sm)',
                                                    padding: '0.45rem 0.85rem',
                                                    fontSize: '0.82rem',
                                                    fontWeight: 600,
                                                    cursor: isAutoReadingHw ? 'not-allowed' : 'pointer',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '0.4rem'
                                                }}
                                            >
                                                <Sparkles size={14} className={isAutoReadingHw ? 'animate-spin' : ''} />
                                                {isAutoReadingHw ? 'Reading photo with AI OCR...' : 'Auto-read details from photo with AI'}
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Alerts */}
                                {hwErrorMsg && (
                                    <div style={{ padding: '0.75rem', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 'var(--radius-md)', color: '#dc2626', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <AlertTriangle size={16} />
                                        <span>{hwErrorMsg}</span>
                                    </div>
                                )}
                                {hwSuccessMsg && (
                                    <div style={{ padding: '0.75rem', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: 'var(--radius-md)', color: '#047857', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <CheckCircle2 size={16} />
                                        <span>{hwSuccessMsg}</span>
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={hwIsSaving}
                                    className="btn btn-primary"
                                    style={{ width: '100%', justifyContent: 'center', padding: '0.85rem', fontSize: '0.95rem' }}
                                >
                                    {hwIsSaving ? 'Saving Homework...' : '💾 Save School Homework'}
                                </button>
                            </form>
                        )}

                        {/* MODE B: AI PRACTICE TEST GENERATOR */}
                        {creationMode === 'generate_test' && (
                            <div>
                                {generateSuccess ? (
                                    <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
                                        <div style={{ background: 'rgba(16, 185, 129, 0.1)', width: '56px', height: '56px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', color: 'var(--secondary)' }}>
                                            <CheckCircle size={28} />
                                        </div>
                                        <h3 style={{ marginBottom: '0.5rem' }}>Test Generated! 🎉</h3>
                                        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
                                            Your custom test is ready for your child to practice.
                                        </p>
                                        
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', maxWidth: '320px', margin: '0 auto 1rem' }}>
                                            <button className="btn btn-primary" onClick={() => window.print()} style={{ width: '100%', justifyContent: 'center' }}>
                                                <Printer size={16} /> Download as PDF
                                            </button>
                                            <button className="btn btn-secondary" onClick={() => setTakeTestInlineId(generatedTestId)} style={{ width: '100%', justifyContent: 'center' }}>
                                                <Play size={16} /> Take Test Online
                                            </button>
                                        </div>

                                        <button onClick={resetUpload} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', textDecoration: 'underline', cursor: 'pointer', fontSize: '0.85rem' }}>
                                            Create Another Test
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <div style={{ marginBottom: '1.15rem' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                                                <label style={{ fontWeight: 600, fontSize: '0.85rem' }}>Subject</label>
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
                                                        style={{ flex: 1, padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--surface)', fontSize: '0.9rem' }}
                                                    >
                                                        <optgroup label="📌 Tracked Subjects">
                                                            {displaySubjects.map(s => <option key={s} value={s}>{s}</option>)}
                                                        </optgroup>
                                                        <optgroup label="📚 More Curriculum Subjects">
                                                            {SUBJECTS.filter(s => !displaySubjects.includes(s)).map(s => (
                                                                <option key={s} value={s}>{s}</option>
                                                            ))}
                                                        </optgroup>
                                                        <optgroup label="➕ Custom">
                                                            <option value="__CUSTOM__">+ Add Custom Subject...</option>
                                                        </optgroup>
                                                    </select>
                                                    <button
                                                        type="button"
                                                        onClick={() => setIsCustomSubject(true)}
                                                        className="btn btn-secondary"
                                                        style={{ padding: '0.65rem 0.85rem', fontSize: '0.82rem', whiteSpace: 'nowrap' }}
                                                    >
                                                        + Custom
                                                    </button>
                                                </div>
                                            ) : (
                                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                    <input
                                                        type="text"
                                                        className="input"
                                                        placeholder="Enter custom subject..."
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

                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.15rem' }}>
                                            <div>
                                                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.4rem' }}>Due By (Optional)</label>
                                                <input type="datetime-local" value={dueDate} onChange={e => setDueDate(e.target.value)}
                                                    style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--surface)', fontSize: '0.9rem' }} />
                                            </div>

                                            <div>
                                                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.4rem' }}>Number of Questions</label>
                                                <select value={questionCount} onChange={e => setQuestionCount(Number(e.target.value))}
                                                    style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--surface)', fontSize: '0.9rem' }}>
                                                    <option value={5}>5 Questions (Quick Check)</option>
                                                    <option value={10}>10 Questions (Standard Test)</option>
                                                    <option value={15}>15 Questions (Comprehensive)</option>
                                                </select>
                                            </div>
                                        </div>

                                        {/* Difficulty Selector */}
                                        <div style={{ marginBottom: '1.15rem' }}>
                                            <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.4rem' }}>Difficulty</label>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                                                {(['basic', 'intermediate', 'advanced'] as Difficulty[]).map(d => (
                                                    <button key={d} type="button" onClick={() => setDifficulty(d)}
                                                        style={{
                                                            padding: '0.55rem 0.65rem', borderRadius: 'var(--radius-md)', border: `2px solid ${difficulty === d ? 'var(--primary)' : 'var(--border)'}`,
                                                            background: difficulty === d ? 'rgba(79,70,229,0.08)' : 'transparent',
                                                            color: difficulty === d ? 'var(--primary)' : 'var(--text-muted)',
                                                            fontWeight: difficulty === d ? 700 : 500, cursor: 'pointer', fontSize: '0.82rem', textAlign: 'center', textTransform: 'capitalize'
                                                        }}>
                                                        {d}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Special Instructions */}
                                        <div style={{ marginBottom: '1.15rem' }}>
                                            <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.4rem' }}>Special Instructions (Optional)</label>
                                            <textarea
                                                value={customInstructions}
                                                onChange={e => setCustomInstructions(e.target.value)}
                                                placeholder="e.g. Focus on word problems, or include 2 tough geometry questions..."
                                                rows={2}
                                                style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--surface)', fontSize: '0.88rem', resize: 'vertical' }}
                                            />
                                        </div>

                                        {/* Images Upload */}
                                        <div style={{ marginBottom: '1rem' }}>
                                            <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.4rem' }}>Worksheet / Book Photos</label>
                                            <label style={{
                                                display: 'block', border: `2px dashed ${selectedFiles.length > 0 ? 'var(--primary)' : 'var(--border)'}`,
                                                borderRadius: 'var(--radius-md)', padding: '1.15rem 1rem', textAlign: 'center', cursor: 'pointer',
                                                background: selectedFiles.length > 0 ? 'rgba(79,70,229,0.04)' : 'var(--surface-hover)', transition: 'var(--transition)'
                                            }}>
                                                <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={handleFileChange} accept="image/*,.pdf" multiple />
                                                <div style={{ color: 'var(--text-muted)' }}>
                                                    <Image size={24} style={{ margin: '0 auto 0.4rem', color: 'var(--primary)' }} />
                                                    <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>Click to add files</p>
                                                    <p style={{ margin: '0.15rem 0 0', fontSize: '0.75rem' }}>PNG, JPG or PDF • multiple allowed</p>
                                                </div>
                                            </label>
                                        </div>

                                        {/* Previews */}
                                        {selectedFiles.length > 0 && (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                                                {selectedFiles.map((file: File, idx: number) => (
                                                    <div key={idx} style={{ padding: '0.65rem', background: 'var(--surface-hover)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                                                        {filePreviews[idx] ? (
                                                            <img src={filePreviews[idx]} alt={file.name} style={{ width: '32px', height: '32px', objectFit: 'cover', borderRadius: '4px', flexShrink: 0 }} />
                                                        ) : (
                                                            <FileText size={18} />
                                                        )}
                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            <p style={{ margin: 0, fontWeight: 600, fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</p>
                                                            <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-muted)' }}>{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                                                        </div>
                                                        <button onClick={() => removeFile(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0.2rem' }}>
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {generateError && (
                                            <div style={{ padding: '0.75rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-md)', marginBottom: '1rem', color: '#dc2626', fontSize: '0.85rem' }}>
                                                <span>{generateError}</span>
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
                                                    : <><Sparkles size={16} /> Generate {difficulty} Test</>}
                                            </button>
                                        )}
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    {/* SECTION: DAILY SCHOOL HOMEWORK FEED */}
                    <div className="card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                            <div>
                                <h2 style={{ fontSize: '1.25rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Smartphone size={20} color="var(--primary)" /> School Daily Homework (WhatsApp / Teams)
                                </h2>
                                <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                    Homework pages uploaded by parent vs solved notebook pages submitted by student
                                </p>
                            </div>
                            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                                {filteredHomework.length} assigned
                            </span>
                        </div>

                        {filteredHomework.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)' }}>
                                <Smartphone size={32} style={{ margin: '0 auto 0.5rem', opacity: 0.5 }} />
                                <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600 }}>No daily homework uploaded yet.</p>
                                <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem' }}>Use the toggle above to upload today's WhatsApp or Teams school assignment.</p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {filteredHomework.map(hw => {
                                    const sourceClass = hw.source === 'whatsapp' ? 'source-pill-whatsapp' : hw.source === 'teams' ? 'source-pill-teams' : 'source-pill-diary';
                                    const sourceLabel = hw.source === 'whatsapp' ? '🟢 WhatsApp' : hw.source === 'teams' ? '🟣 Teams' : hw.source === 'diary' ? '📔 Diary' : '✏️ Manual';
                                    const statusClass = hw.status === 'verified' ? 'badge-verified' : hw.status === 'needs_revision' ? 'badge-revision' : 'badge-pending';
                                    const statusLabel = hw.status === 'verified'
                                        ? `✓ Complete • ${hw.verificationResult?.completenessScore || 90}%`
                                        : hw.status === 'needs_revision'
                                        ? `⚠️ Revision • ${hw.verificationResult?.completenessScore || 50}%`
                                        : hw.status === 'submitted'
                                        ? '📸 Submitted • Verifying'
                                        : '⏳ Pending Student';

                                    return (
                                        <div key={hw.id} style={{
                                            padding: '1.15rem',
                                            border: '1px solid var(--border)',
                                            borderRadius: 'var(--radius-md)',
                                            background: 'var(--surface)',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '0.75rem'
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                                                <div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                                                        <span className={`source-pill ${sourceClass}`}>{sourceLabel}</span>
                                                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>{hw.subject}</span>
                                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>• {hw.childName}</span>
                                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>• Due {hw.dueDate}</span>
                                                    </div>
                                                    <h3 style={{ margin: '0 0 0.2rem', fontSize: '1.05rem', fontWeight: 600 }}>{hw.title}</h3>
                                                    {hw.description && (
                                                        <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>{hw.description}</p>
                                                    )}
                                                </div>

                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    <span className={`status-badge ${statusClass}`}>{statusLabel}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            if (window.confirm('Delete this homework item?')) {
                                                                deleteDailyHomework(hw.id);
                                                            }
                                                        }}
                                                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.25rem' }}
                                                        title="Delete homework"
                                                    >
                                                        <Trash2 size={15} />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Photo Previews (Original Assignment + Student Solved Notebook) */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', padding: '0.65rem', background: 'var(--surface-hover)', borderRadius: 'var(--radius-sm)' }}>
                                                {/* Original Assignment Photo */}
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    {hw.originalFiles && hw.originalFiles[0] ? (
                                                        <img
                                                            src={hw.originalFiles[0]}
                                                            alt="Teacher Assignment"
                                                            onClick={() => setViewingFullImage(hw.originalFiles![0])}
                                                            style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '4px', cursor: 'pointer', border: '1px solid var(--border)' }}
                                                        />
                                                    ) : (
                                                        <div style={{ width: '48px', height: '48px', background: 'var(--border)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                            <FileText size={20} />
                                                        </div>
                                                    )}
                                                    <div>
                                                        <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 600 }}>Teacher Assignment</p>
                                                        <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                                            {hw.originalFiles?.length || 1} page(s) uploaded
                                                        </p>
                                                    </div>
                                                </div>

                                                <div style={{ width: '1px', height: '36px', background: 'var(--border)' }} className="desktop-only" />

                                                {/* Student Solved Notebook Photo */}
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    {hw.studentSubmissionFiles && hw.studentSubmissionFiles[0] ? (
                                                        <img
                                                            src={hw.studentSubmissionFiles[0]}
                                                            alt="Student Notebook"
                                                            onClick={() => setViewingFullImage(hw.studentSubmissionFiles![0])}
                                                            style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '4px', cursor: 'pointer', border: '2px solid #10b981' }}
                                                        />
                                                    ) : (
                                                        <div style={{ width: '48px', height: '48px', background: 'var(--surface)', borderRadius: '4px', border: '1px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                                                            <Camera size={18} />
                                                        </div>
                                                    )}
                                                    <div>
                                                        <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 600 }}>Student Notebook</p>
                                                        <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                                            {hw.studentSubmissionFiles?.length
                                                                ? `${hw.studentSubmissionFiles.length} page(s) submitted`
                                                                : 'Awaiting student photo'}
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Verification CTAs */}
                                                {!hw.verificationResult ? (
                                                    <button
                                                        type="button"
                                                        disabled={isVerifyingNotebook && verifyingHwId === hw.id}
                                                        onClick={() => {
                                                            setVerifyingHwId(hw.id);
                                                            parentNotebookInputRef.current?.click();
                                                        }}
                                                        className="hover-lift"
                                                        style={{
                                                            marginLeft: 'auto',
                                                            background: 'rgba(16, 185, 129, 0.1)',
                                                            color: '#059669',
                                                            border: '1.5px solid #10b981',
                                                            borderRadius: 'var(--radius-sm)',
                                                            padding: '0.45rem 0.85rem',
                                                            fontWeight: 700,
                                                            fontSize: '0.8rem',
                                                            cursor: (isVerifyingNotebook && verifyingHwId === hw.id) ? 'not-allowed' : 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '0.4rem'
                                                        }}
                                                    >
                                                        <Sparkles size={14} className={(isVerifyingNotebook && verifyingHwId === hw.id) ? 'animate-spin' : ''} />
                                                        {(isVerifyingNotebook && verifyingHwId === hw.id) ? 'Verifying with AI...' : 'Check / Upload Solved Work'}
                                                    </button>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => setViewingHomework(hw)}
                                                        className="hover-lift"
                                                        style={{
                                                            marginLeft: 'auto',
                                                            background: 'linear-gradient(135deg, var(--primary) 0%, #6366f1 100%)',
                                                            color: 'white',
                                                            border: 'none',
                                                            borderRadius: 'var(--radius-sm)',
                                                            padding: '0.45rem 0.85rem',
                                                            fontWeight: 600,
                                                            fontSize: '0.8rem',
                                                            cursor: 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '0.4rem',
                                                            boxShadow: '0 2px 6px rgba(79, 70, 229, 0.25)'
                                                        }}
                                                    >
                                                        <Eye size={14} /> View AI Verification Report
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                                <input
                                    ref={parentNotebookInputRef}
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    style={{ display: 'none' }}
                                    onChange={handleParentVerifySubmission}
                                />
                            </div>
                        )}
                    </div>

                    {/* SECTION: AI PRACTICE TESTS & WORKSHEETS */}
                    <div className="card" id="tests-list-section">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                            <div>
                                <h2 style={{ fontSize: '1.25rem', margin: 0 }}>AI Practice Tests & Worksheets</h2>
                                <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Auto-generated tests with step-by-step grading</p>
                            </div>
                            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                                {filteredTests.length} tests
                            </span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                            {filteredTests.map((test) => (
                                <div key={test.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.9rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', gap: '0.5rem', flexWrap: 'wrap' }}>
                                    <div style={{ flex: 1, minWidth: '180px' }}>
                                        <h4 style={{ fontWeight: 600, margin: '0 0 0.2rem', fontSize: '0.95rem' }}>{test.title}</h4>
                                        <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.78rem' }}>
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
                                                    padding: '0.3rem 0.65rem',
                                                    borderRadius: '1rem',
                                                    fontWeight: 600,
                                                    fontSize: '0.75rem',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.25rem'
                                                }}
                                            >
                                                <Printer size={13} /> Worksheet
                                            </button>
                                        )}

                                        {test.status === 'completed' ? (
                                            <button onClick={() => setReviewTestId(test.id)} style={{
                                                background: 'rgba(16,185,129,0.1)', color: 'var(--secondary)', border: 'none', cursor: 'pointer',
                                                padding: '0.3rem 0.75rem', borderRadius: '1rem', fontWeight: 600, fontSize: '0.78rem',
                                                display: 'flex', alignItems: 'center', gap: '0.3rem'
                                            }} className="hover-lift">
                                                Review {test.score}% {test.roughWorkEvaluation ? '• ✍️' : ''}
                                            </button>
                                        ) : (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                                <span style={{
                                                    background: test.questions.length > 0 ? 'rgba(79,70,229,0.1)' : 'rgba(245,158,11,0.1)',
                                                    color: test.questions.length > 0 ? 'var(--primary)' : '#d97706',
                                                    padding: '0.25rem 0.65rem', borderRadius: '1rem', fontWeight: 600, fontSize: '0.78rem'
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
                                                            padding: '0.3rem 0.65rem',
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
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '0.25rem' }}>
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {filteredTests.length === 0 && (
                                <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1.5rem 0', margin: 0, fontSize: '0.85rem' }}>No practice tests yet. Use the generator above.</p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* TAB PANEL 2: ACTIVITY & HISTORY ARCHIVE */}
            {activeTab === 'history' && (
                <div id="panel-history" role="tabpanel" aria-labelledby="tab-history" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div className="card" style={{ padding: '1.25rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                            <div>
                                <h2 style={{ fontSize: '1.25rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <History size={20} color="var(--primary)" /> Activity & History Archive
                                </h2>
                                <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                                    Track full historical timeline of uploaded homework, completed submissions, generated tests, and test results.
                                </p>
                            </div>

                            {/* Search bar */}
                            <div style={{ position: 'relative', minWidth: '220px', flex: 1, maxWidth: '320px' }}>
                                <Search size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                <input
                                    type="text"
                                    value={historySearchQuery}
                                    onChange={e => setHistorySearchQuery(e.target.value)}
                                    placeholder="Search history by title, subject..."
                                    style={{
                                        width: '100%',
                                        padding: '0.45rem 0.75rem 0.45rem 2.2rem',
                                        borderRadius: '2rem',
                                        border: '1px solid var(--border)',
                                        background: 'var(--surface)',
                                        fontSize: '0.82rem'
                                    }}
                                />
                                {historySearchQuery && (
                                    <button
                                        type="button"
                                        onClick={() => setHistorySearchQuery('')}
                                        style={{ position: 'absolute', right: '0.6rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
                                    >
                                        <X size={14} />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Filter pills */}
                        <div className="history-filter-scroll" role="tablist" aria-label="History categories">
                            <button
                                type="button"
                                className={`history-filter-btn ${historyFilter === 'all' ? 'active' : ''}`}
                                onClick={() => setHistoryFilter('all')}
                            >
                                All Activity ({filteredHomework.length + filteredTests.length})
                            </button>
                            <button
                                type="button"
                                className={`history-filter-btn ${historyFilter === 'uploaded_homework' ? 'active' : ''}`}
                                onClick={() => setHistoryFilter('uploaded_homework')}
                            >
                                📲 Uploaded Homework ({historyUploadedHw.length})
                            </button>
                            <button
                                type="button"
                                className={`history-filter-btn ${historyFilter === 'completed_homework' ? 'active' : ''}`}
                                onClick={() => setHistoryFilter('completed_homework')}
                            >
                                ✅ Completed Homework ({historyCompletedHw.length})
                            </button>
                            <button
                                type="button"
                                className={`history-filter-btn ${historyFilter === 'generated_tests' ? 'active' : ''}`}
                                onClick={() => setHistoryFilter('generated_tests')}
                            >
                                ⚡ Generated Tests ({historyGeneratedTests.length})
                            </button>
                            <button
                                type="button"
                                className={`history-filter-btn ${historyFilter === 'completed_tests' ? 'active' : ''}`}
                                onClick={() => setHistoryFilter('completed_tests')}
                            >
                                📝 Completed Tests ({historyCompletedTests.length})
                            </button>
                        </div>
                    </div>

                    {/* HISTORY CONTENT CARDS */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {/* 1. UPLOADED HOMEWORK SECTION (shown when 'all' or 'uploaded_homework') */}
                        {(historyFilter === 'all' || historyFilter === 'uploaded_homework') && (
                            <div className="card">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                    <h3 style={{ fontSize: '1.1rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                                        <Smartphone size={18} color="var(--primary)" /> Uploaded School Homework ({historyUploadedHw.length})
                                    </h3>
                                    {historyFilter === 'all' && (
                                        <button
                                            type="button"
                                            onClick={() => setHistoryFilter('uploaded_homework')}
                                            style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}
                                        >
                                            View Only Uploads →
                                        </button>
                                    )}
                                </div>

                                {historyUploadedHw.length === 0 ? (
                                    <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '1rem 0' }}>
                                        No uploaded homework found.
                                    </p>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                        {historyUploadedHw.map(hw => {
                                            const sourceClass = hw.source === 'whatsapp' ? 'source-pill-whatsapp' : hw.source === 'teams' ? 'source-pill-teams' : 'source-pill-diary';
                                            const sourceLabel = hw.source === 'whatsapp' ? '🟢 WhatsApp' : hw.source === 'teams' ? '🟣 Teams' : hw.source === 'diary' ? '📔 Diary' : '✏️ Manual';
                                            const isDone = hw.status === 'verified' || hw.submissionStatus === 'verified_complete';

                                            return (
                                                <div key={hw.id} className="history-item-card">
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                                                        <div>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                                                                <span className={`source-pill ${sourceClass}`}>{sourceLabel}</span>
                                                                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>{hw.subject}</span>
                                                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>• {hw.childName}</span>
                                                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>• {new Date(hw.createdAt).toLocaleDateString()}</span>
                                                            </div>
                                                            <h4 style={{ margin: '0 0 0.2rem', fontSize: '1rem', fontWeight: 700 }}>{hw.title}</h4>
                                                            {hw.description && <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>{hw.description}</p>}
                                                        </div>

                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                            {isDone ? (
                                                                <span className="status-badge badge-verified">✓ Solved & Verified</span>
                                                            ) : (
                                                                <span className="status-badge badge-pending">⏳ Pending Student Notebook</span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border)' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                            {hw.originalFiles && hw.originalFiles[0] && (
                                                                <img
                                                                    src={hw.originalFiles[0]}
                                                                    alt="Uploaded sheet"
                                                                    onClick={() => setViewingFullImage(hw.originalFiles![0])}
                                                                    style={{ width: '38px', height: '38px', objectFit: 'cover', borderRadius: '4px', cursor: 'pointer', border: '1px solid var(--border)' }}
                                                                />
                                                            )}
                                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                                Due: <strong>{hw.dueDate}</strong>
                                                            </span>
                                                        </div>

                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                            {hw.verificationResult && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setViewingHomework(hw)}
                                                                    className="btn btn-secondary"
                                                                    style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem' }}
                                                                >
                                                                    <Eye size={12} /> View AI Report
                                                                </button>
                                                            )}
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    if (window.confirm('Delete this homework from history?')) {
                                                                        deleteDailyHomework(hw.id);
                                                                    }
                                                                }}
                                                                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.25rem' }}
                                                                title="Delete"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 2. COMPLETED HOMEWORK SECTION (shown when 'all' or 'completed_homework') */}
                        {(historyFilter === 'all' || historyFilter === 'completed_homework') && (
                            <div className="card">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                    <h3 style={{ fontSize: '1.1rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                                        <CheckCircle size={18} color="var(--secondary)" /> Completed & Verified Homework ({historyCompletedHw.length})
                                    </h3>
                                    {historyFilter === 'all' && (
                                        <button
                                            type="button"
                                            onClick={() => setHistoryFilter('completed_homework')}
                                            style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}
                                        >
                                            View Only Completed →
                                        </button>
                                    )}
                                </div>

                                {historyCompletedHw.length === 0 ? (
                                    <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '1rem 0' }}>
                                        No completed homework submissions yet.
                                    </p>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                        {historyCompletedHw.map(hw => (
                                            <div key={hw.id} className="history-item-card" style={{ borderLeft: '3px solid #10b981' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                                                    <div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)' }}>{hw.subject}</span>
                                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>• {hw.childName}</span>
                                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>• Completed {hw.submittedAt ? new Date(hw.submittedAt).toLocaleDateString() : 'Recently'}</span>
                                                        </div>
                                                        <h4 style={{ margin: '0 0 0.2rem', fontSize: '1rem', fontWeight: 700 }}>{hw.title}</h4>
                                                        {hw.verificationResult?.summary && (
                                                            <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-main)', lineHeight: '1.4' }}>
                                                                {hw.verificationResult.summary}
                                                            </p>
                                                        )}
                                                    </div>

                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        <span style={{
                                                            background: (hw.verificationResult?.completenessScore || 90) >= 80 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                                                            color: (hw.verificationResult?.completenessScore || 90) >= 80 ? '#047857' : '#b45309',
                                                            border: `1px solid ${(hw.verificationResult?.completenessScore || 90) >= 80 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
                                                            padding: '0.25rem 0.65rem',
                                                            borderRadius: '1rem',
                                                            fontWeight: 800,
                                                            fontSize: '0.8rem'
                                                        }}>
                                                            {hw.verificationResult?.completenessScore || 90}% Completeness
                                                        </span>
                                                    </div>
                                                </div>

                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border)' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                                                        {hw.originalFiles && hw.originalFiles[0] && (
                                                            <img
                                                                src={hw.originalFiles[0]}
                                                                alt="Original"
                                                                onClick={() => setViewingFullImage(hw.originalFiles![0])}
                                                                style={{ width: '38px', height: '38px', objectFit: 'cover', borderRadius: '4px', cursor: 'pointer', border: '1px solid var(--border)' }}
                                                                title="Teacher assignment"
                                                            />
                                                        )}
                                                        {hw.studentSubmissionFiles && hw.studentSubmissionFiles[0] && (
                                                            <img
                                                                src={hw.studentSubmissionFiles[0]}
                                                                alt="Student solved notebook"
                                                                onClick={() => setViewingFullImage(hw.studentSubmissionFiles![0])}
                                                                style={{ width: '38px', height: '38px', objectFit: 'cover', borderRadius: '4px', cursor: 'pointer', border: '2px solid #10b981' }}
                                                                title="Student solved notebook"
                                                            />
                                                        )}
                                                        <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                                                            {hw.verificationResult?.completedQuestions?.length || 0} sums solved
                                                        </span>
                                                    </div>

                                                    <button
                                                        type="button"
                                                        onClick={() => setViewingHomework(hw)}
                                                        className="hover-lift"
                                                        style={{
                                                            background: 'linear-gradient(135deg, var(--primary) 0%, #6366f1 100%)',
                                                            color: 'white',
                                                            border: 'none',
                                                            borderRadius: 'var(--radius-sm)',
                                                            padding: '0.35rem 0.75rem',
                                                            fontWeight: 600,
                                                            fontSize: '0.76rem',
                                                            cursor: 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '0.35rem'
                                                        }}
                                                    >
                                                        <Eye size={12} /> View Full AI Verification Report
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 3. GENERATED PRACTICE TESTS SECTION (shown when 'all' or 'generated_tests') */}
                        {(historyFilter === 'all' || historyFilter === 'generated_tests') && (
                            <div className="card">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                    <h3 style={{ fontSize: '1.1rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                                        <Sparkles size={18} color="var(--primary)" /> Generated Practice Tests ({historyGeneratedTests.length})
                                    </h3>
                                    {historyFilter === 'all' && (
                                        <button
                                            type="button"
                                            onClick={() => setHistoryFilter('generated_tests')}
                                            style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}
                                        >
                                            View Only Generated Tests →
                                        </button>
                                    )}
                                </div>

                                {historyGeneratedTests.length === 0 ? (
                                    <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '1rem 0' }}>
                                        No practice tests generated yet.
                                    </p>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                        {historyGeneratedTests.map(test => (
                                            <div key={test.id} className="history-item-card">
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                                                    <div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)' }}>{test.subject}</span>
                                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>• {test.questions.length} Questions</span>
                                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>• {test.duration}</span>
                                                        </div>
                                                        <h4 style={{ margin: '0 0 0.2rem', fontSize: '1rem', fontWeight: 700 }}>{test.title}</h4>
                                                        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                            {test.status === 'completed'
                                                                ? `Completed ${test.completedAt ? new Date(test.completedAt).toLocaleDateString() : ''}`
                                                                : test.dueDate ? `Due ${new Date(test.dueDate).toLocaleDateString()}` : 'Awaiting student'}
                                                        </p>
                                                    </div>

                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                        {test.questions.length > 0 && (
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setTestToPrint(test);
                                                                    setTimeout(() => window.print(), 50);
                                                                }}
                                                                className="hover-lift"
                                                                style={{
                                                                    background: 'rgba(79, 70, 229, 0.08)',
                                                                    color: 'var(--primary)',
                                                                    border: '1px solid rgba(79, 70, 229, 0.2)',
                                                                    cursor: 'pointer',
                                                                    padding: '0.3rem 0.65rem',
                                                                    borderRadius: '1rem',
                                                                    fontWeight: 600,
                                                                    fontSize: '0.75rem',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '0.25rem'
                                                                }}
                                                            >
                                                                <Printer size={12} /> Worksheet
                                                            </button>
                                                        )}

                                                        {test.status === 'completed' ? (
                                                            <button
                                                                type="button"
                                                                onClick={() => setReviewTestId(test.id)}
                                                                style={{
                                                                    background: 'rgba(16,185,129,0.1)', color: 'var(--secondary)', border: 'none', cursor: 'pointer',
                                                                    padding: '0.3rem 0.75rem', borderRadius: '1rem', fontWeight: 600, fontSize: '0.78rem'
                                                                }}
                                                                className="hover-lift"
                                                            >
                                                                Review {test.score}%
                                                            </button>
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                onClick={() => setTakeTestInlineId(test.id)}
                                                                className="btn btn-primary"
                                                                style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem' }}
                                                            >
                                                                <Play size={11} fill="white" /> Take Test
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 4. COMPLETED PRACTICE TESTS SECTION (shown when 'all' or 'completed_tests') */}
                        {(historyFilter === 'all' || historyFilter === 'completed_tests') && (
                            <div className="card">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                    <h3 style={{ fontSize: '1.1rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                                        <Award size={18} color="#f59e0b" /> Completed Practice Tests ({historyCompletedTests.length})
                                    </h3>
                                    {historyFilter === 'all' && (
                                        <button
                                            type="button"
                                            onClick={() => setHistoryFilter('completed_tests')}
                                            style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}
                                        >
                                            View Only Completed Tests →
                                        </button>
                                    )}
                                </div>

                                {historyCompletedTests.length === 0 ? (
                                    <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '1rem 0' }}>
                                        No completed tests recorded yet.
                                    </p>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                        {historyCompletedTests.map(test => (
                                            <div key={test.id} className="history-item-card" style={{ borderLeft: '3px solid #6366f1' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                                                    <div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)' }}>{test.subject}</span>
                                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>• Completed {test.completedAt ? new Date(test.completedAt).toLocaleDateString() : 'Recently'}</span>
                                                        </div>
                                                        <h4 style={{ margin: '0 0 0.2rem', fontSize: '1rem', fontWeight: 700 }}>{test.title}</h4>
                                                        {test.roughWorkEvaluation && (
                                                            <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--secondary)', fontWeight: 600 }}>
                                                                ✍️ Handwriting & Rough Work Accuracy: {test.roughWorkEvaluation.accuracyScore}%
                                                            </p>
                                                        )}
                                                    </div>

                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        <span style={{
                                                            background: (test.score || 0) >= 80 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                                                            color: (test.score || 0) >= 80 ? '#047857' : '#b45309',
                                                            border: `1px solid ${(test.score || 0) >= 80 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
                                                            padding: '0.25rem 0.65rem',
                                                            borderRadius: '1rem',
                                                            fontWeight: 800,
                                                            fontSize: '0.85rem'
                                                        }}>
                                                            Score: {test.score}%
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
                                                            Full Review →
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* SCREEN 5: TEST CORRECTIONS VIEW */}
            {activeTab === 'corrections' && (
                <div id="panel-corrections" role="tabpanel" aria-labelledby="tab-corrections" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                        <div>
                            <h2 style={{ fontSize: '1.25rem', margin: 0, fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                                <Award size={20} color="#EF4444" />
                                Test Corrections &amp; Remediation (FR-13 to FR-15)
                            </h2>
                            <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                                Triggered by teacher's "do corrections" note · guided correction walkthrough
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={() => setIsCorrectionsModalOpen(true)}
                            className="btn-teal"
                            style={{ padding: '0.55rem 1rem', fontSize: '0.85rem' }}
                        >
                            <Camera size={16} />
                            <span>Upload Marked Test Paper</span>
                        </button>
                    </div>

                    <div className="card" style={{ padding: '2rem 1.5rem', border: '1.5px solid var(--border)' }}>
                        <div style={{ textAlign: 'center', maxWidth: '460px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.85rem' }}>
                            <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', padding: '1rem', borderRadius: '50%' }}>
                                <Award size={36} />
                            </div>
                            <h3 style={{ fontSize: '1.15rem', margin: 0, fontWeight: 800 }}>
                                Teacher Said "Sign Test &amp; Do Corrections"?
                            </h3>
                            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                                Upload a photo of the marked test paper with red marks. HomeTutor will record the score, identify weak topics, and guide your child through each mistake with clear step-by-step methods and memory tips.
                            </p>
                            <button
                                type="button"
                                onClick={() => setIsCorrectionsModalOpen(true)}
                                className="btn-teal"
                                style={{ padding: '0.75rem 1.25rem', fontSize: '0.9rem', width: '100%', maxWidth: '320px' }}
                            >
                                <Sparkles size={18} />
                                <span>Start Test Corrections Walkthrough</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* SCREEN 6: PROGRESS REPORT & ANALYTICS */}
            {(activeTab === 'progress' || activeTab === 'analytics') && (
                <div id="panel-analytics" role="tabpanel" aria-labelledby="tab-progress" style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
                    <ProgressReportView 
                        tests={filteredTests} 
                        dailyHomeworkList={filteredHomework} 
                        selectedChildName={childrenList.find(c => c.id === selectedChildId)?.name || 'Alexander (Grade 2 · Class II A)'} 
                    />
                    {/* Subject Tiles */}
                    <div className="card">
                        <h2 style={{ fontSize: '1.25rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Book size={20} color="var(--primary)" /> Major Subjects
                        </h2>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.85rem' }}>
                            {displaySubjects.map(subject => (
                                <div key={subject} style={{ padding: '1rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', textAlign: 'center' }} className="hover-lift">
                                    <div style={{ background: 'var(--surface-hover)', width: '42px', height: '42px', margin: '0 auto 0.5rem', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
                                        <Book size={20} />
                                    </div>
                                    <h4 style={{ margin: 0, fontWeight: 600, fontSize: '0.88rem' }}>{subject}</h4>
                                    <p style={{ margin: '0.2rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                        {tests.filter(t => t.subject === subject && t.status === 'completed').length} completed
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Performance Chart */}
                    <div className="card">
                        <h2 style={{ fontSize: '1.25rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <BarChart3 size={20} color="var(--primary)" /> Performance Trend
                        </h2>
                        <div style={{ height: '240px', width: '100%' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData.length > 0 ? chartData : [{ name: 'No Data', score: 0 }]}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
                                    <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 12 }} dx={-10} />
                                    <Tooltip cursor={{ fill: 'var(--surface-hover)' }} contentStyle={{ borderRadius: 'var(--radius-md)', border: 'none', boxShadow: 'var(--shadow-md)' }} />
                                    <Bar dataKey="score" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Topic Mastery & Weak Spots */}
                    <div className="card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                            <div>
                                <h2 style={{ fontSize: '1.25rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <TrendingUp size={20} color="var(--primary)" /> Topic Mastery & Weak Spots
                                </h2>
                                <p style={{ margin: '0.25rem 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                                    Track understanding and auto-generate remedial practice drills
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

                                {user?.subscriptionTier === 'free' && (
                                    <div style={{
                                        marginTop: '0.75rem',
                                        padding: '1.15rem',
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
                </div>
            )}

            <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
        </div>

        {/* AI VERIFICATION REPORT MODAL */}
        {viewingHomework && (
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
                        maxWidth: '650px',
                        maxHeight: '90vh',
                        overflowY: 'auto',
                        padding: '1.5rem',
                        position: 'relative'
                    }}
                >
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                                    {viewingHomework.subject} • {viewingHomework.childName}
                                </span>
                            </div>
                            <h2 style={{ fontSize: '1.25rem', margin: 0, fontWeight: 700 }}>
                                {viewingHomework.title}
                            </h2>
                        </div>
                        <button
                            type="button"
                            onClick={() => setViewingHomework(null)}
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

                    {/* Completeness Banner */}
                    {viewingHomework.verificationResult && (
                        <div style={{
                            padding: '1rem',
                            borderRadius: 'var(--radius-md)',
                            background: viewingHomework.verificationResult.completenessScore >= 80 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                            border: `1.5px solid ${viewingHomework.verificationResult.completenessScore >= 80 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
                            marginBottom: '1.25rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: '0.75rem'
                        }}>
                            <div>
                                <span style={{
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    textTransform: 'uppercase',
                                    color: viewingHomework.verificationResult.completenessScore >= 80 ? '#047857' : '#b45309'
                                }}>
                                    {viewingHomework.verificationResult.status === 'verified_complete' ? '🎉 VERIFIED COMPLETE' : '⚠️ REVISION NEEDED'}
                                </span>
                                <h3 style={{ margin: '0.15rem 0 0', fontSize: '1.35rem', fontWeight: 800, color: viewingHomework.verificationResult.completenessScore >= 80 ? '#047857' : '#b45309' }}>
                                    {viewingHomework.verificationResult.completenessScore}% Completeness
                                </h3>
                            </div>
                            <div style={{
                                padding: '0.4rem 0.85rem',
                                borderRadius: '2rem',
                                background: viewingHomework.verificationResult.completenessScore >= 80 ? '#10b981' : '#f59e0b',
                                color: 'white',
                                fontWeight: 700,
                                fontSize: '0.85rem'
                            }}>
                                {viewingHomework.verificationResult.status === 'verified_complete' ? 'Marked Complete ✓' : 'Partial Work'}
                            </div>
                        </div>
                    )}

                    {/* AI Feedback & Coaching */}
                    {viewingHomework.verificationResult?.coachingFeedback && (
                        <div style={{ marginBottom: '1.25rem' }}>
                            <h4 style={{ fontSize: '0.9rem', margin: '0 0 0.4rem', display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--primary)' }}>
                                <Sparkles size={16} /> AI Teacher Evaluation & Coaching
                            </h4>
                            <div style={{
                                padding: '0.85rem 1rem',
                                background: 'var(--surface-hover)',
                                borderRadius: 'var(--radius-md)',
                                fontSize: '0.88rem',
                                lineHeight: '1.5',
                                border: '1px solid var(--border)'
                            }}>
                                {viewingHomework.verificationResult.coachingFeedback}
                            </div>
                        </div>
                    )}

                    {/* Questions Completed vs Missing Breakdown */}
                    {viewingHomework.verificationResult && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
                            {/* Completed */}
                            <div style={{ padding: '0.85rem', background: 'rgba(16, 185, 129, 0.05)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                                <h5 style={{ margin: '0 0 0.5rem', fontSize: '0.82rem', fontWeight: 700, color: '#047857', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                    <CheckCircle2 size={15} /> Completed in Notebook
                                </h5>
                                <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.8rem', color: 'var(--text-main)', lineHeight: '1.5' }}>
                                    {viewingHomework.verificationResult.completedQuestions.map((q, i) => (
                                        <li key={i}>{q}</li>
                                    ))}
                                </ul>
                            </div>

                            {/* Missing */}
                            <div style={{ padding: '0.85rem', background: 'rgba(239, 68, 68, 0.05)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                                <h5 style={{ margin: '0 0 0.5rem', fontSize: '0.82rem', fontWeight: 700, color: '#dc2626', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                    <AlertTriangle size={15} /> Missing / Incomplete
                                </h5>
                                {viewingHomework.verificationResult.missingQuestions.length > 0 ? (
                                    <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.8rem', color: 'var(--text-main)', lineHeight: '1.5' }}>
                                        {viewingHomework.verificationResult.missingQuestions.map((q, i) => (
                                            <li key={i}>{q}</li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p style={{ margin: 0, fontSize: '0.8rem', color: '#047857', fontWeight: 500 }}>All questions completed!</p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Side-by-Side Photo Comparison */}
                    <div style={{ marginBottom: '1.25rem' }}>
                        <h4 style={{ fontSize: '0.9rem', margin: '0 0 0.5rem', fontWeight: 600 }}>Visual Verification Photos</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
                            {/* Teacher's homework */}
                            <div style={{ textAlign: 'center' }}>
                                <p style={{ margin: '0 0 0.35rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>Teacher's Assignment</p>
                                {viewingHomework.originalFiles && viewingHomework.originalFiles[0] ? (
                                    <img
                                        src={viewingHomework.originalFiles[0]}
                                        alt="Assignment"
                                        onClick={() => setViewingFullImage(viewingHomework.originalFiles![0])}
                                        style={{ width: '100%', height: '140px', objectFit: 'cover', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', cursor: 'pointer' }}
                                    />
                                ) : (
                                    <div style={{ height: '140px', background: 'var(--surface-hover)', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>No image</div>
                                )}
                            </div>

                            {/* Student's notebook */}
                            <div style={{ textAlign: 'center' }}>
                                <p style={{ margin: '0 0 0.35rem', fontSize: '0.75rem', fontWeight: 600, color: '#10b981' }}>Student's Solved Notebook</p>
                                {viewingHomework.studentSubmissionFiles && viewingHomework.studentSubmissionFiles[0] ? (
                                    <img
                                        src={viewingHomework.studentSubmissionFiles[0]}
                                        alt="Student submission"
                                        onClick={() => setViewingFullImage(viewingHomework.studentSubmissionFiles![0])}
                                        style={{ width: '100%', height: '140px', objectFit: 'cover', borderRadius: 'var(--radius-sm)', border: '2px solid #10b981', cursor: 'pointer' }}
                                    />
                                ) : (
                                    <div style={{ height: '140px', background: 'var(--surface-hover)', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>No student submission</div>
                                )}
                            </div>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={() => setViewingHomework(null)}
                        className="btn btn-primary"
                        style={{ width: '100%', justifyContent: 'center' }}
                    >
                        Close Report
                    </button>
                </div>
            </div>
        )}

        {/* FULL IMAGE LIGHTBOX MODAL */}
        {viewingFullImage && (
            <div
                role="dialog"
                aria-modal="true"
                onClick={() => setViewingFullImage(null)}
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
                    src={viewingFullImage}
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

        {/* Upgrade Modal */}
        <UpgradeModal
            isOpen={isUpgradeModalOpen}
            onClose={() => setIsUpgradeModalOpen(false)}
            highlightReason={upgradeReason}
        />

        {/* PRD PROTOTYPE MODALS */}
        <TeamsUploadModal
            isOpen={isTeamsModalOpen}
            onClose={() => setIsTeamsModalOpen(false)}
            onSuccess={() => {
                setActiveTab('today');
            }}
        />

        <ManualHomeworkModal
            isOpen={isManualModalOpen}
            onClose={() => setIsManualModalOpen(false)}
            onSuccess={() => {
                setActiveTab('today');
            }}
        />

        <SpellingListModal
            isOpen={isSpellingModalOpen}
            onClose={() => setIsSpellingModalOpen(false)}
            defaultChapterTitle={spellingChapterTitle}
        />

        <WorksheetLibraryModal
            isOpen={isWorksheetLibraryOpen}
            onClose={() => setIsWorksheetLibraryOpen(false)}
            onSelectForPractice={(ws, diff) => {
                setCreationMode('generate_test');
                setSelectedSubject(ws.subject);
                setDifficulty(diff);
                setActiveTab('practice');
            }}
        />

        <TestCorrectionsModal
            isOpen={isCorrectionsModalOpen}
            onClose={() => setIsCorrectionsModalOpen(false)}
            defaultSubject={correctionsSubject}
            onStartPractice={(topic, diff) => {
                setCreationMode('generate_test');
                setCustomInstructions(`Focus specifically on remediation for weak topic: ${topic}`);
                setDifficulty(diff);
                setActiveTab('practice');
            }}
        />
        </>
    );
};

export default ParentDashboard;
