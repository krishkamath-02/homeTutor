import React, { useState } from 'react';
import { AlertCircle, Clock, Lightbulb, ChevronDown, ChevronUp, Camera, FileText, CheckCircle, Loader2 } from 'lucide-react';
import useAppStore from '../store/appStore';

interface TestTakerProps {
    testId: string;
    onComplete: () => void;
    onCancel: () => void;
}

const TestTaker: React.FC<TestTakerProps> = ({ testId, onComplete, onCancel }) => {
    const tests = useAppStore(state => state.tests);
    const submitTest = useAppStore(state => state.submitTest);
    const uploadAndEvaluateRoughWork = useAppStore(state => state.uploadAndEvaluateRoughWork);
    
    const activeTest = tests.find(t => t.id === testId);
    
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [answers, setAnswers] = useState<Record<string, number>>({});
    const [showHint, setShowHint] = useState<boolean>(false);
    const [hintsOpened, setHintsOpened] = useState<Record<string, boolean>>({});

    // Phase 3: Handwritten rough work upload & vision evaluation state
    const [roughWorkFile, setRoughWorkFile] = useState<File | null>(null);
    const [roughWorkPreview, setRoughWorkPreview] = useState<string | null>(null);
    const [isEvaluatingRoughWork, setIsEvaluatingRoughWork] = useState(false);

    if (!activeTest) return null;

    const currentQ = activeTest.questions?.[currentQuestionIndex];

    if (!currentQ) {
        return (
            <div className="card" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
                <AlertCircle size={48} color="var(--primary)" style={{ margin: '0 auto 1rem' }} />
                <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>No questions found</h2>
                <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>This test appears to be empty.</p>
                <button className="btn btn-primary" onClick={onCancel}>Go Back</button>
            </div>
        );
    }

    const toggleHint = () => {
        setShowHint(prev => {
            const next = !prev;
            if (next && currentQ) {
                setHintsOpened(h => ({ ...h, [currentQ.id]: true }));
            }
            return next;
        });
    };

    const handleNext = async () => {
        setShowHint(false);
        if (currentQuestionIndex < activeTest.questions.length - 1) {
            setCurrentQuestionIndex(curr => curr + 1);
        } else {
            // Final submission
            if (roughWorkFile) {
                setIsEvaluatingRoughWork(true);
                try {
                    await uploadAndEvaluateRoughWork(activeTest.id, [roughWorkFile]);
                } catch (err: any) {
                    console.warn('Rough work evaluation note:', err);
                } finally {
                    setIsEvaluatingRoughWork(false);
                }
            }
            await submitTest(activeTest.id, answers);
            onComplete();
        }
    };

    const isLastQuestion = currentQuestionIndex === activeTest.questions.length - 1;

    return (
        <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border)' }}>
                <div>
                    <h2 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>{activeTest.title}</h2>
                    <p style={{ color: 'var(--text-muted)' }}>Question {currentQuestionIndex + 1} of {activeTest.questions.length}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f59e0b', fontWeight: 600, background: 'rgba(245, 158, 11, 0.1)', padding: '0.5rem 1rem', borderRadius: '2rem' }}>
                    <Clock size={18} /> {activeTest.duration}
                </div>
            </div>

            <div style={{ marginBottom: '2.5rem' }}>
                <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', lineHeight: 1.5 }}>
                    {currentQ.text}
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {currentQ.options.map((opt, i) => (
                        <label key={i} style={{
                            display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.5rem',
                            border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                            cursor: 'pointer', transition: 'var(--transition)',
                            backgroundColor: answers[currentQ.id] === i ? 'var(--surface-hover)' : 'transparent',
                            borderColor: answers[currentQ.id] === i ? 'var(--primary)' : 'var(--border)'
                        }}>
                            <input
                                type="radio"
                                name={`q-${currentQ.id}`}
                                checked={answers[currentQ.id] === i}
                                onChange={() => setAnswers(prev => ({ ...prev, [currentQ.id]: i }))}
                                style={{ width: '1.25rem', height: '1.25rem' }}
                            />
                            <span style={{ fontSize: '1.125rem' }}>{opt}</span>
                        </label>
                    ))}
                </div>

                {/* Socratic Hint Section */}
                {currentQ.socraticHint && (
                    <div style={{ marginTop: '1.5rem' }}>
                        <button
                            type="button"
                            onClick={toggleHint}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                background: showHint ? 'rgba(245, 158, 11, 0.15)' : 'rgba(245, 158, 11, 0.08)',
                                border: '1px solid rgba(245, 158, 11, 0.3)',
                                color: '#d97706',
                                borderRadius: 'var(--radius-md)',
                                padding: '0.5rem 0.875rem',
                                fontSize: '0.875rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                            }}
                        >
                            <Lightbulb size={16} />
                            {showHint ? 'Hide Socratic Hint' : hintsOpened[currentQ.id] ? 'Revisit Hint' : '💡 Need a Hint?'}
                            {showHint ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>

                        {showHint && (
                            <div style={{
                                marginTop: '0.75rem',
                                padding: '1rem 1.25rem',
                                borderRadius: 'var(--radius-md)',
                                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(217, 119, 6, 0.04) 100%)',
                                border: '1px solid rgba(245, 158, 11, 0.25)',
                                color: 'var(--text-main)',
                                animation: 'fadeIn 0.2s ease'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem', color: '#d97706', fontWeight: 600, fontSize: '0.875rem' }}>
                                    <Lightbulb size={15} /> Guided Thinking Nudge:
                                </div>
                                <p style={{ fontSize: '0.95rem', lineHeight: 1.5, margin: 0, fontStyle: 'italic', color: 'var(--text-main)' }}>
                                    "{currentQ.socraticHint}"
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {/* Phase 3: Handwritten Rough Work & Step Evaluation Upload */}
                {isLastQuestion && (
                    <div style={{
                        marginTop: '2rem',
                        padding: '1.25rem',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--surface-hover)',
                        border: '1px dashed var(--border)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <FileText size={18} color="var(--primary)" />
                                <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                                    ✍️ Paper Rough Work & Step Evaluation (Optional)
                                </span>
                            </div>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                Gemini Vision Step-by-Step Marking
                            </span>
                        </div>
                        <p style={{ margin: '0 0 1rem 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                            Did you solve these problems on paper? Take a photo of your working sheet so AI can evaluate your intermediate algebraic and arithmetic steps!
                        </p>

                        {roughWorkPreview ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'var(--surface)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                                <img src={roughWorkPreview} alt="Rough work preview" style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '4px' }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <p style={{ margin: 0, fontWeight: 600, fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {roughWorkFile?.name}
                                    </p>
                                    <p style={{ margin: '0.15rem 0 0', fontSize: '0.75rem', color: 'var(--secondary)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                        <CheckCircle size={12} /> Ready for Vision Step Evaluation
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setRoughWorkFile(null);
                                        setRoughWorkPreview(null);
                                    }}
                                    style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}
                                >
                                    Remove
                                </button>
                            </div>
                        ) : (
                            <label style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.5rem',
                                padding: '0.85rem',
                                border: '2px dashed var(--primary)',
                                borderRadius: 'var(--radius-md)',
                                background: 'rgba(79, 70, 229, 0.04)',
                                cursor: 'pointer',
                                transition: 'var(--transition)'
                            }}>
                                <Camera size={18} color="var(--primary)" />
                                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--primary)' }}>
                                    Upload or Snap Photo of Rough Work Paper
                                </span>
                                <input
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    style={{ display: 'none' }}
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                            setRoughWorkFile(file);
                                            setRoughWorkPreview(URL.createObjectURL(file));
                                        }
                                    }}
                                />
                            </label>
                        )}
                    </div>
                )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button className="btn btn-secondary" onClick={onCancel} disabled={isEvaluatingRoughWork}>Quit Test</button>
                <button 
                    className="btn btn-primary" 
                    onClick={handleNext} 
                    disabled={answers[currentQ.id] === undefined || isEvaluatingRoughWork}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                >
                    {isEvaluatingRoughWork && <Loader2 size={16} className="animate-spin" />}
                    {isEvaluatingRoughWork ? 'Evaluating Rough Work...' : currentQuestionIndex < activeTest.questions.length - 1 ? 'Next Question' : 'Submit Test'}
                </button>
            </div>
        </div>
    );
};

export default TestTaker;
