import React, { useState } from 'react';
import type { Test } from '../store/appStore';
import useAppStore from '../store/appStore';
import { Check, X, ArrowLeft, AlertTriangle, BookOpen, FileText, Camera, ExternalLink, Loader2 } from 'lucide-react';

interface TestReviewProps {
    test: Test;
    onClose: () => void;
}

const TestReview: React.FC<TestReviewProps> = ({ test, onClose }) => {
    const uploadAndEvaluateRoughWork = useAppStore(state => state.uploadAndEvaluateRoughWork);
    const [isUploadingRoughWork, setIsUploadingRoughWork] = useState(false);
    const [roughWorkError, setRoughWorkError] = useState<string | null>(null);
    const [showRoughWorkModal, setShowRoughWorkModal] = useState(false);

    const handleRetroactiveRoughWorkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploadingRoughWork(true);
        setRoughWorkError(null);
        try {
            await uploadAndEvaluateRoughWork(test.id, [file]);
        } catch (err: any) {
            setRoughWorkError(err.message || 'Failed to evaluate rough work');
        } finally {
            setIsUploadingRoughWork(false);
        }
    };

    const roughWorkEval = test.roughWorkEvaluation;

    return (
        <div className="card" style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-main)', padding: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', transition: 'var(--transition)' }} className="hover-lift">
                    <ArrowLeft size={20} />
                </button>
                <div style={{ flex: 1 }}>
                    <h2 style={{ fontSize: '1.5rem', margin: '0 0 0.25rem 0' }}>Diagnostic Review: {test.title}</h2>
                    <p style={{ color: 'var(--text-muted)', margin: 0 }}>Score: {test.score}% • {test.questions.length} Questions</p>
                </div>
            </div>

            {/* Phase 3: Handwritten Rough Work Evaluation Banner */}
            {roughWorkEval ? (
                <div style={{
                    marginBottom: '2rem',
                    padding: '1.25rem 1.5rem',
                    borderRadius: 'var(--radius-md)',
                    background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.08) 0%, rgba(129, 140, 248, 0.04) 100%)',
                    border: '1px solid rgba(79, 70, 229, 0.25)'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '0.75rem' }}>
                        <div>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <FileText size={15} /> Paper-to-Digital Handwriting Evaluation
                            </span>
                            <h3 style={{ margin: '0.25rem 0 0', fontSize: '1.1rem' }}>AI Rough Work & Step-by-Step Marking</h3>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            {roughWorkEval.accuracyScore !== undefined && (
                                <span style={{
                                    padding: '0.3rem 0.75rem',
                                    borderRadius: '1rem',
                                    fontWeight: 700,
                                    fontSize: '0.85rem',
                                    background: roughWorkEval.accuracyScore >= 70 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                    color: roughWorkEval.accuracyScore >= 70 ? 'var(--secondary)' : 'var(--danger)'
                                }}>
                                    Step Accuracy: {roughWorkEval.accuracyScore}%
                                </span>
                            )}
                            {test.roughWorkUrl && (
                                <button
                                    onClick={() => setShowRoughWorkModal(true)}
                                    className="btn btn-secondary"
                                    style={{ padding: '0.3rem 0.75rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                                >
                                    <ExternalLink size={13} /> View Paper
                                </button>
                            )}
                        </div>
                    </div>

                    <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.92rem', color: 'var(--text-main)', lineHeight: 1.5 }}>
                        <strong>Working Overview:</strong> {roughWorkEval.transcribedSummary}
                    </p>
                    {roughWorkEval.overallFeedback && (
                        <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--primary)', fontStyle: 'italic', lineHeight: 1.45 }}>
                            💡 <strong>Teacher Coaching Note:</strong> "{roughWorkEval.overallFeedback}"
                        </p>
                    )}
                </div>
            ) : (
                /* Prompt to upload rough work retroactively if missing */
                <div style={{
                    marginBottom: '2rem',
                    padding: '1rem 1.25rem',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--surface-hover)',
                    border: '1px dashed var(--border)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '1rem'
                }}>
                    <div style={{ maxWidth: '480px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>
                            <Camera size={16} color="var(--primary)" /> Evaluate Handwritten Scratch Work
                        </div>
                        <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            Have the student's handwritten working paper? Upload a photo now to get automatic step marks and intermediate calculation feedback.
                        </p>
                    </div>

                    <label className="btn btn-secondary" style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem', cursor: isUploadingRoughWork ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                        {isUploadingRoughWork ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
                        {isUploadingRoughWork ? 'Grading Steps...' : 'Upload Rough Work'}
                        <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            disabled={isUploadingRoughWork}
                            style={{ display: 'none' }}
                            onChange={handleRetroactiveRoughWorkUpload}
                        />
                    </label>
                </div>
            )}

            {roughWorkError && (
                <div style={{ color: '#ef4444', fontSize: '0.85rem', marginBottom: '1.5rem', padding: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: 'var(--radius-sm)' }}>
                    {roughWorkError}
                </div>
            )}

            {/* Questions Review List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {test.questions.map((q, i) => {
                    const studentAnswer = test.studentAnswers?.[q.id];
                    const isCorrect = studentAnswer === q.correctAnswerIndex;
                    
                    // Match step marks from rough work evaluation by ID, index, or question number
                    const stepMark = roughWorkEval?.stepMarks?.[q.id] 
                        || roughWorkEval?.stepMarks?.[String(i + 1)] 
                        || roughWorkEval?.stepMarks?.[`q${i + 1}`];

                    return (
                        <div key={q.id} style={{ padding: '1.5rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface)' }}>
                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                                <div style={{ 
                                    width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                    background: isCorrect ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                    color: isCorrect ? 'var(--secondary)' : 'var(--danger)'
                                }}>
                                    {isCorrect ? <Check size={16} /> : <X size={16} />}
                                </div>
                                <div>
                                    <h3 style={{ fontSize: '1.125rem', margin: '0 0 0.25rem 0', lineHeight: 1.5 }}>{i + 1}. {q.text}</h3>
                                    {q.topic && (
                                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--primary)', background: 'var(--surface-hover)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                                            Topic: {q.topic}
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingLeft: '2.75rem' }}>
                                {q.options.map((opt, j) => {
                                    const isSelected = studentAnswer === j;
                                    const isActuallyCorrect = q.correctAnswerIndex === j;
                                    
                                    let bg = 'transparent';
                                    let borderColor = 'var(--border)';
                                    
                                    if (isActuallyCorrect) {
                                        bg = 'rgba(16, 185, 129, 0.05)';
                                        borderColor = 'var(--secondary)';
                                    } else if (isSelected && !isActuallyCorrect) {
                                        bg = 'rgba(239, 68, 68, 0.05)';
                                        borderColor = 'var(--danger)';
                                    }

                                    return (
                                        <div key={j} style={{
                                            display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.85rem 1.25rem',
                                            border: `1px solid ${borderColor}`, borderRadius: 'var(--radius-sm)',
                                            background: bg, opacity: (!isSelected && !isActuallyCorrect) ? 0.6 : 1
                                        }}>
                                            <div style={{ 
                                                width: '18px', height: '18px', borderRadius: '50%', border: `2px solid ${borderColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                background: isSelected ? borderColor : 'transparent'
                                            }}>
                                                {isSelected && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'white' }} />}
                                            </div>
                                            <span style={{ fontSize: '1rem', color: isActuallyCorrect ? 'var(--secondary)' : (isSelected ? 'var(--danger)' : 'var(--text-main)'), fontWeight: isActuallyCorrect || isSelected ? 500 : 400 }}>
                                                {opt}
                                            </span>
                                            {isActuallyCorrect && <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', color: 'var(--secondary)', fontSize: '0.875rem', fontWeight: 600, gap: '0.35rem' }}><Check size={14}/> Correct Answer</div>}
                                            {isSelected && !isActuallyCorrect && <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', color: 'var(--danger)', fontSize: '0.875rem', fontWeight: 600, gap: '0.35rem' }}><X size={14}/> Your Answer</div>}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Phase 3: Handwritten Step Marks & Step Critique */}
                            {stepMark && (
                                <div style={{ marginTop: '1.25rem', paddingLeft: '2.75rem' }}>
                                    <div style={{
                                        padding: '1rem',
                                        borderRadius: 'var(--radius-sm)',
                                        background: 'rgba(79, 70, 229, 0.04)',
                                        border: '1px solid rgba(79, 70, 229, 0.2)',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '0.5rem'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                                            <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                                ✍️ Handwritten Step Evaluation:
                                            </span>
                                            <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.78rem', fontWeight: 600 }}>
                                                <span style={{ padding: '0.15rem 0.5rem', borderRadius: '4px', background: stepMark.methodMark === 1 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)', color: stepMark.methodMark === 1 ? 'var(--secondary)' : 'var(--danger)' }}>
                                                    Method: {stepMark.methodMark}/1
                                                </span>
                                                <span style={{ padding: '0.15rem 0.5rem', borderRadius: '4px', background: stepMark.calculationMark === 1 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)', color: stepMark.calculationMark === 1 ? 'var(--secondary)' : 'var(--danger)' }}>
                                                    Calculation: {stepMark.calculationMark}/1
                                                </span>
                                                <span style={{ padding: '0.15rem 0.5rem', borderRadius: '4px', background: stepMark.finalMark === 1 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)', color: stepMark.finalMark === 1 ? 'var(--secondary)' : 'var(--danger)' }}>
                                                    Final: {stepMark.finalMark}/1
                                                </span>
                                            </div>
                                        </div>

                                        {stepMark.transcribedSteps && stepMark.transcribedSteps.length > 0 && (
                                            <div style={{ background: 'var(--surface)', padding: '0.5rem 0.75rem', borderRadius: '4px', fontSize: '0.82rem', fontFamily: 'monospace', color: 'var(--text-main)', border: '1px solid var(--border)' }}>
                                                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem', textTransform: 'uppercase' }}>Transcribed Steps:</span>
                                                {stepMark.transcribedSteps.map((step, sIdx) => (
                                                    <div key={sIdx}>{step}</div>
                                                ))}
                                            </div>
                                        )}

                                        <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-main)', lineHeight: 1.45 }}>
                                            {stepMark.stepFeedback}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Pedagogical Diagnostic Feedback */}
                            <div style={{ marginTop: '1.25rem', paddingLeft: '2.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {!isCorrect && studentAnswer !== undefined && q.distractorAnalysis?.[String(studentAnswer)] && (
                                    <div style={{
                                        padding: '0.875rem 1rem',
                                        borderRadius: 'var(--radius-sm)',
                                        background: 'rgba(239, 68, 68, 0.08)',
                                        borderLeft: '4px solid var(--danger)',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '0.25rem'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--danger)', fontWeight: 600, fontSize: '0.875rem' }}>
                                            <AlertTriangle size={15} /> Diagnosed Misconception:
                                        </div>
                                        <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-main)', lineHeight: 1.45 }}>
                                            {q.distractorAnalysis[String(studentAnswer)]}
                                        </p>
                                    </div>
                                )}

                                {q.explanation && (
                                    <div style={{
                                        padding: '0.875rem 1rem',
                                        borderRadius: 'var(--radius-sm)',
                                        background: 'var(--surface-hover)',
                                        borderLeft: '4px solid var(--primary)',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '0.25rem'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)', fontWeight: 600, fontSize: '0.875rem' }}>
                                            <BookOpen size={15} /> Step-by-Step Pedagogical Solution:
                                        </div>
                                        <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-main)', lineHeight: 1.45 }}>
                                            {q.explanation}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Rough Work Image Viewer Modal */}
            {showRoughWorkModal && test.roughWorkUrl && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    zIndex: 9999,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '2rem'
                }} onClick={() => setShowRoughWorkModal(false)}>
                    <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
                        <img 
                            src={test.roughWorkUrl} 
                            alt="Student Rough Work" 
                            style={{ maxWidth: '100%', maxHeight: '85vh', borderRadius: '8px', objectFit: 'contain' }} 
                        />
                        <button 
                            onClick={() => setShowRoughWorkModal(false)}
                            style={{
                                position: 'absolute',
                                top: '-12px',
                                right: '-12px',
                                background: 'white',
                                color: 'black',
                                border: 'none',
                                borderRadius: '50%',
                                width: '32px',
                                height: '32px',
                                cursor: 'pointer',
                                fontWeight: 'bold'
                            }}
                        >
                            ✕
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TestReview;
