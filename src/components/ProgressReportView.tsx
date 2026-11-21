import React, { useState } from 'react';
import { 
    Share2, Download, 
    AlertTriangle, BookOpen, Check 
} from 'lucide-react';
import { type Test, type DailyHomework } from '../store/appStore';

interface ProgressReportViewProps {
    tests: Test[];
    dailyHomeworkList: DailyHomework[];
    selectedChildName?: string;
}

export const ProgressReportView: React.FC<ProgressReportViewProps> = ({
    tests,
    dailyHomeworkList,
    selectedChildName = 'Alexander (Grade 2 · Class II A)'
}) => {
    const [period, setPeriod] = useState<'monthly' | 'quarterly'>('monthly');
    const [isCopied, setIsCopied] = useState(false);

    const completedTests = tests.filter(t => t.status === 'completed');
    const averageScore = completedTests.length > 0
        ? Math.round(completedTests.reduce((acc, t) => acc + (t.score || 0), 0) / completedTests.length)
        : 0;

    const verifiedHomework = dailyHomeworkList.filter(h => h.status === 'verified' || h.submissionStatus === 'verified_complete');

    // Dynamic subject mastery from real test activity
    const subjectMap: Record<string, { totalScore: number; count: number }> = {};
    completedTests.forEach(t => {
        const s = t.subject || 'General';
        if (!subjectMap[s]) subjectMap[s] = { totalScore: 0, count: 0 };
        subjectMap[s].totalScore += (t.score || 0);
        subjectMap[s].count += 1;
    });

    const subjectStats = Object.keys(subjectMap).map(s => ({
        subject: s,
        score: Math.round(subjectMap[s].totalScore / subjectMap[s].count),
        testsCount: subjectMap[s].count,
        status: `Completed ${subjectMap[s].count} assessment${subjectMap[s].count > 1 ? 's' : ''}`
    }));

    // Weak topics derived dynamically from tests scoring below 75%
    const weakTopicsSet = new Set<string>();
    completedTests.forEach(t => {
        if ((t.score || 0) < 75) {
            t.questions.forEach(q => {
                if (q.topic) weakTopicsSet.add(q.topic);
            });
        }
    });
    const weakTopics = Array.from(weakTopicsSet).slice(0, 5).map(topic => ({
        topic,
        subject: 'Focus Area',
        priority: 'High'
    }));

    const handleShare = async () => {
        const title = `Home Tutor Progress Report: ${selectedChildName}`;
        const summaryText = `📊 Home Tutor Progress Report (${period === 'monthly' ? 'Monthly View' : 'Quarterly View'})\nStudent: ${selectedChildName}\n• Average Score: ${averageScore > 0 ? `${averageScore}%` : 'N/A'}\n• Practice Tests Completed: ${completedTests.length}\n• Daily Homework Verified: ${verifiedHomework.length}${subjectStats.length > 0 ? `\n• Subject Performance: ${subjectStats.map(s => `${s.subject} (${s.score}%)`).join(', ')}` : ''}${weakTopics.length > 0 ? `\n• Focus Areas: ${weakTopics.map(w => w.topic).join(', ')}` : ''}`;

        if (navigator.share) {
            try {
                await navigator.share({
                    title,
                    text: summaryText,
                    url: window.location.href
                });
            } catch {
                // User cancelled or share dismissed
            }
        } else {
            await navigator.clipboard.writeText(summaryText);
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2500);
        }
    };

    const handlePrintPdf = () => {
        window.print();
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Top Toolbar: Period Toggle & Export Buttons */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.85rem' }}>
                {/* Monthly / Quarterly Selector (Section 10 chips) */}
                <div style={{ display: 'flex', gap: '0.4rem', background: 'var(--surface)', padding: '0.3rem', borderRadius: '2rem', border: '1.5px solid var(--border)' }}>
                    <button
                        type="button"
                        onClick={() => setPeriod('monthly')}
                        style={{
                            padding: '0.35rem 0.85rem',
                            borderRadius: '1.5rem',
                            border: 'none',
                            background: period === 'monthly' ? 'var(--teal)' : 'transparent',
                            color: period === 'monthly' ? 'white' : 'var(--text-muted)',
                            fontWeight: 700,
                            fontSize: '0.82rem',
                            cursor: 'pointer',
                            transition: 'var(--transition)'
                        }}
                    >
                        📅 Monthly (November 2026)
                    </button>
                    <button
                        type="button"
                        onClick={() => setPeriod('quarterly')}
                        style={{
                            padding: '0.35rem 0.85rem',
                            borderRadius: '1.5rem',
                            border: 'none',
                            background: period === 'quarterly' ? 'var(--teal)' : 'transparent',
                            color: period === 'quarterly' ? 'white' : 'var(--text-muted)',
                            fontWeight: 700,
                            fontSize: '0.82rem',
                            cursor: 'pointer',
                            transition: 'var(--transition)'
                        }}
                    >
                        📊 Quarterly (Q4 2026)
                    </button>
                </div>

                {/* Share & PDF Buttons (FR-17) */}
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                        type="button"
                        onClick={handleShare}
                        className="btn btn-secondary"
                        style={{ padding: '0.45rem 0.85rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                        title="Share report summary via WhatsApp or Share Sheet"
                    >
                        {isCopied ? <Check size={16} color="#10b981" /> : <Share2 size={16} />}
                        <span>{isCopied ? 'Copied Summary!' : 'Share Report'}</span>
                    </button>
                    <button
                        type="button"
                        onClick={handlePrintPdf}
                        className="btn btn-primary"
                        style={{ padding: '0.45rem 0.85rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                        title="Print or export as PDF"
                    >
                        <Download size={16} />
                        <span>Download PDF</span>
                    </button>
                </div>
            </div>

            {/* Overview Metric Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.85rem' }}>
                <div className="card" style={{ padding: '1rem', border: '1.5px solid var(--border)' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>OVERALL AVERAGE</span>
                    <h3 style={{ fontSize: '1.75rem', margin: '0.2rem 0', fontWeight: 800, color: 'var(--primary)' }}>
                        {averageScore}%
                    </h3>
                    <p style={{ margin: 0, fontSize: '0.72rem', color: '#10b981', fontWeight: 600 }}>
                        +5% from last month
                    </p>
                </div>

                <div className="card" style={{ padding: '1rem', border: '1.5px solid var(--border)' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>PRACTICE TESTS TAKEN</span>
                    <h3 style={{ fontSize: '1.75rem', margin: '0.2rem 0', fontWeight: 800, color: '#2563eb' }}>
                        {completedTests.length}
                    </h3>
                    <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {period === 'monthly' ? 'In November 2026' : 'In Q4 2026'}
                    </p>
                </div>

                <div className="card" style={{ padding: '1rem', border: '1.5px solid var(--border)' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>HOMEWORK VERIFIED</span>
                    <h3 style={{ fontSize: '1.75rem', margin: '0.2rem 0', fontWeight: 800, color: 'var(--teal)' }}>
                        {verifiedHomework.length}
                    </h3>
                    <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        Solved in notebook
                    </p>
                </div>
            </div>

            {/* Subject Mastery Performance */}
            <div className="card" style={{ padding: '1.25rem', border: '1.5px solid var(--border)' }}>
                <h3 style={{ fontSize: '1.05rem', margin: '0 0 1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <BookOpen size={18} color="var(--primary)" />
                    Subject Mastery Scores (FR-16)
                </h3>

                {subjectStats.length === 0 ? (
                    <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '1rem 0' }}>
                        No completed tests yet. Practice sheets and tests will automatically calculate subject mastery here.
                    </p>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {subjectStats.map(s => (
                            <div key={s.subject} style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>
                                        {s.subject}
                                    </span>
                                    <span style={{ fontWeight: 800, fontSize: '0.9rem', color: s.score >= 90 ? '#10b981' : s.score >= 80 ? '#2563eb' : '#d97706' }}>
                                        {s.score}%
                                    </span>
                                </div>

                                {/* Progress bar */}
                                <div style={{ width: '100%', height: '8px', background: 'var(--surface-hover)', borderRadius: '4px', overflow: 'hidden' }}>
                                    <div style={{
                                        width: `${s.score}%`,
                                        height: '100%',
                                        background: s.score >= 90 ? 'var(--teal)' : s.score >= 80 ? 'var(--primary)' : 'var(--amber)',
                                        borderRadius: '4px'
                                    }} />
                                </div>

                                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                    {s.status}
                                </p>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Weak Topics to Revisit (FR-16) */}
            <div className="card" style={{ padding: '1.25rem', border: '1.5px solid var(--border)', background: '#FFFBEB' }}>
                <h3 style={{ fontSize: '1rem', margin: '0 0 0.75rem', fontWeight: 700, color: '#92400E', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <AlertTriangle size={18} color="#D97706" />
                    Topics to Revisit Before Exams
                </h3>
                {weakTopics.length === 0 ? (
                    <p style={{ margin: 0, color: '#92400E', fontSize: '0.85rem' }}>
                        ✨ No weak topics flagged! Questions scored well or haven't required remediation yet.
                    </p>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {weakTopics.map((w, idx) => (
                            <div key={idx} style={{ background: 'white', padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid #FCD34D', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <strong style={{ fontSize: '0.85rem', color: '#1E293B' }}>{w.topic}</strong>
                                    <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>({w.subject})</span>
                                </div>
                                <span style={{ fontSize: '0.72rem', background: '#FEE2E2', color: '#991B1B', padding: '0.15rem 0.5rem', borderRadius: '1rem', fontWeight: 700 }}>
                                    {w.priority} Priority
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
export default ProgressReportView;
