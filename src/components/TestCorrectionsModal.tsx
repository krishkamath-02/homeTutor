import React, { useState } from 'react';
import { 
    X, Camera, Sparkles, Award
} from 'lucide-react';
import { analyzeMarkedTest, type MarkedTestAnalysisResult } from '../lib/gemini';
import useAppStore from '../store/appStore';
import type { Difficulty } from '../lib/gemini';

interface TestCorrectionsModalProps {
    isOpen: boolean;
    onClose: () => void;
    defaultSubject?: string;
    onStartPractice?: (weakTopic: string, recommendedDifficulty: Difficulty) => void;
}

export const TestCorrectionsModal: React.FC<TestCorrectionsModalProps> = ({
    isOpen,
    onClose,
    defaultSubject = 'Math',
    onStartPractice
}) => {
    const saveTestCorrection = useAppStore(state => state.saveTestCorrection);

    const [subject, setSubject] = useState(defaultSubject);
    const [files, setFiles] = useState<File[]>([]);
    const [previews, setPreviews] = useState<string[]>([]);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<MarkedTestAnalysisResult | null>(null);

    if (!isOpen) return null;

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files) return;
        const newFiles = Array.from(e.target.files);
        setFiles(prev => [...prev, ...newFiles]);
        setPreviews(prev => [...prev, ...newFiles.map(f => URL.createObjectURL(f))]);
    };

    const handleAnalyze = async () => {
        setIsAnalyzing(true);
        try {
            const result = await analyzeMarkedTest(files, subject);
            setAnalysisResult(result);
            saveTestCorrection(result);
        } catch (err) {
            console.error('Marked test analysis error:', err);
        } finally {
            setIsAnalyzing(false);
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
                    maxWidth: '580px',
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
                        <div style={{ background: 'rgba(239, 68, 68, 0.12)', padding: '0.5rem', borderRadius: 'var(--radius-md)', color: '#ef4444' }}>
                            <Award size={22} />
                        </div>
                        <div>
                            <h2 style={{ fontSize: '1.15rem', margin: 0, fontWeight: 700 }}>
                                Test Corrections &amp; Remediation
                            </h2>
                            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                Screen 5 (FR-13 to FR-15) · Walk through marked test mistakes with steps
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

                {!analysisResult ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div>
                            <label style={{ display: 'block', fontWeight: 600, fontSize: '0.82rem', marginBottom: '0.35rem' }}>
                                Subject
                            </label>
                            <select 
                                value={subject} 
                                onChange={e => setSubject(e.target.value)}
                                style={{ width: '100%', padding: '0.55rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}
                            >
                                {['Math', 'English', 'Science', 'Hindi', 'Social Studies'].map(s => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label style={{ display: 'block', fontWeight: 600, fontSize: '0.82rem', marginBottom: '0.35rem' }}>
                                Upload Photos of Marked Test Paper
                            </label>
                            <label 
                                style={{
                                    border: '2px dashed var(--border)',
                                    borderRadius: 'var(--radius-md)',
                                    padding: '1.5rem',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    cursor: 'pointer',
                                    background: 'var(--surface-hover)',
                                    gap: '0.4rem',
                                    textAlign: 'center'
                                }}
                            >
                                <input type="file" multiple accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
                                <Camera size={26} color="#ef4444" />
                                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Snap marked test with teacher's red pen</span>
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                    {files.length > 0 ? `${files.length} pages attached` : 'Upload test pages showing marks and teacher feedback'}
                                </span>
                            </label>
                        </div>

                        {previews.length > 0 && (
                            <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
                                {previews.map((src, i) => (
                                    <img key={i} src={src} alt="Marked test" style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '6px' }} />
                                ))}
                            </div>
                        )}

                        <button
                            type="button"
                            onClick={handleAnalyze}
                            disabled={isAnalyzing}
                            className="btn-teal"
                            style={{ width: '100%', padding: '0.8rem', fontSize: '0.92rem' }}
                        >
                            {isAnalyzing ? (
                                <>
                                    <Sparkles size={18} className="animate-spin" />
                                    <span>AI Inspecting Teacher Marks &amp; Circles...</span>
                                </>
                            ) : (
                                <>
                                    <Sparkles size={18} />
                                    <span>Analyze Test &amp; Guide Corrections</span>
                                </>
                            )}
                        </button>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {/* Score Banner */}
                        <div style={{
                            background: 'linear-gradient(135deg, #1E293B, #0F172A)',
                            borderRadius: 'var(--radius-lg)',
                            padding: '1rem',
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                        }}>
                            <div>
                                <span style={{ fontSize: '0.75rem', color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase' }}>
                                    {analysisResult.subject} Assessment Result
                                </span>
                                <h3 style={{ fontSize: '1.6rem', margin: '0.15rem 0', fontWeight: 800 }}>
                                    {analysisResult.marksObtained} / {analysisResult.totalMarks}
                                    <span style={{ fontSize: '1rem', color: '#38BDF8', marginLeft: '0.5rem' }}>
                                        ({analysisResult.percentage}%)
                                    </span>
                                </h3>
                                <p style={{ margin: 0, fontSize: '0.75rem', color: '#CBD5E1' }}>
                                    Adaptive difficulty recommended: <strong style={{ color: '#4ADE80', textTransform: 'uppercase' }}>{analysisResult.recommendedDifficulty}</strong>
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() => setAnalysisResult(null)}
                                style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', padding: '0.35rem 0.65rem', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer' }}
                            >
                                Re-upload
                            </button>
                        </div>

                        {/* Weak topics chips */}
                        <div>
                            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#991B1B', textTransform: 'uppercase' }}>
                                ⚠️ Weak Topics Identified from Deductions:
                            </span>
                            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.35rem' }}>
                                {analysisResult.weakTopics.map((topic, i) => (
                                    <span key={i} style={{ background: '#FEE2E2', color: '#991B1B', border: '1px solid #FCA5A5', padding: '0.25rem 0.65rem', borderRadius: '1rem', fontSize: '0.75rem', fontWeight: 600 }}>
                                        {topic}
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* Corrections Walkthrough List */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '45vh', overflowY: 'auto' }}>
                            {analysisResult.corrections.map((corr, idx) => (
                                <div key={idx} style={{ border: '1.5px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '0.85rem', background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '0.85rem' }}>
                                            {corr.questionNumber}: {corr.originalQuestion}
                                        </span>
                                        <span style={{ fontSize: '0.72rem', background: 'var(--surface-hover)', padding: '0.1rem 0.45rem', borderRadius: '4px', color: 'var(--text-muted)' }}>
                                            {corr.topic}
                                        </span>
                                    </div>

                                    {/* Child mistake */}
                                    <div style={{ background: '#FFF1F2', padding: '0.45rem 0.65rem', borderRadius: '6px', fontSize: '0.78rem', color: '#9F1239' }}>
                                        ❌ <strong>Student's Slip:</strong> {corr.childMistake}
                                    </div>

                                    {/* Correct Solution */}
                                    <div style={{ background: '#F0FDF4', padding: '0.45rem 0.65rem', borderRadius: '6px', fontSize: '0.78rem', color: '#166534', whiteSpace: 'pre-line' }}>
                                        ✅ <strong>Correct Steps:</strong>
                                        <div>{corr.correctSolution}</div>
                                    </div>

                                    {/* Learning tip */}
                                    <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--amber-text)', fontStyle: 'italic' }}>
                                        💡 <strong>Teacher Tip:</strong> {corr.learningTip}
                                    </p>
                                </div>
                            ))}
                        </div>

                        {/* Action: Practice Weak Topic */}
                        {onStartPractice && analysisResult.weakTopics.length > 0 && (
                            <button
                                type="button"
                                onClick={() => {
                                    onStartPractice(analysisResult.weakTopics[0], analysisResult.recommendedDifficulty);
                                    onClose();
                                }}
                                className="btn-teal"
                                style={{ width: '100%', padding: '0.8rem', fontSize: '0.92rem' }}
                            >
                                <Sparkles size={18} />
                                <span>Practice Weak Topic: "{analysisResult.weakTopics[0]}" ({analysisResult.recommendedDifficulty})</span>
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
export default TestCorrectionsModal;
