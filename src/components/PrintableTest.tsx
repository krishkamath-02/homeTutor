import React from 'react';
import type { Test } from '../store/appStore';

interface PrintableTestProps {
    test: Test;
    includeWorkingSpace?: boolean;
    includeAnswerKey?: boolean;
    curriculumBoard?: string;
    gradeLevel?: number;
}

const PrintableTest: React.FC<PrintableTestProps> = ({ 
    test, 
    includeWorkingSpace = true,
    includeAnswerKey = true,
    curriculumBoard = 'CBSE / State Curriculum',
    gradeLevel
}) => {
    const refCode = `HT-${test.id ? test.id.slice(0, 8).toUpperCase() : 'PRINT'}`;
    const maxMarks = test.questions.length * 3; // 1 method + 1 calculation + 1 final answer

    return (
        <div className="print-only" style={{ padding: '2rem 3rem', fontFamily: 'serif', maxWidth: '800px', margin: '0 auto', color: '#000' }}>
            {/* Exam Header */}
            <div style={{ textAlign: 'center', marginBottom: '1.5rem', borderBottom: '2px solid black', paddingBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.5rem', color: '#444' }}>
                    <span>{curriculumBoard} {gradeLevel ? `• Grade ${gradeLevel}` : ''}</span>
                    <span style={{ fontWeight: 700, border: '1px solid #444', padding: '2px 6px', borderRadius: '3px' }}>REF: {refCode}</span>
                </div>

                <h1 style={{ fontSize: '26px', margin: '0 0 0.5rem 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{test.title}</h1>
                <p style={{ fontSize: '13px', margin: '0 0 1rem 0', fontStyle: 'italic', color: '#333' }}>
                    Subject: {test.subject} • Duration: {test.duration} • Maximum Marks: {maxMarks}
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '1rem', fontSize: '13px', textAlign: 'left', marginTop: '1rem' }}>
                    <div><strong>Student Name:</strong> ___________________________</div>
                    <div><strong>Date:</strong> _______________</div>
                    <div><strong>Roll No:</strong> __________</div>
                </div>
            </div>

            {/* General Instructions */}
            <div style={{ border: '1px solid #999', borderRadius: '4px', padding: '0.6rem 0.85rem', marginBottom: '1.75rem', fontSize: '12px', background: '#fafafa' }}>
                <strong style={{ display: 'block', marginBottom: '0.25rem' }}>INSTRUCTIONS FOR THE STUDENT:</strong>
                <ol style={{ margin: 0, paddingLeft: '1.25rem', lineHeight: 1.5 }}>
                    <li>Darken or mark the circle corresponding to your chosen option clearly.</li>
                    {includeWorkingSpace && <li><strong>Show all calculations & scratch steps in the designated working box</strong> below each question to earn step-wise credit.</li>}
                    <li>Write legibly in pen or dark pencil. Keep your rough work organized.</li>
                </ol>
            </div>

            {/* Questions List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {test.questions.map((q, index) => (
                    <div key={q.id || index} style={{ pageBreakInside: 'avoid', borderBottom: '1px dashed #ccc', paddingBottom: '1.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                            <p style={{ fontWeight: 'bold', fontSize: '15px', margin: 0, lineHeight: 1.5 }}>
                                Q{index + 1}. {q.text}
                            </p>
                            <span style={{ fontSize: '11px', fontWeight: 600, color: '#555', flexShrink: 0, marginLeft: '0.75rem' }}>
                                [3 Marks]
                            </span>
                        </div>

                        {/* Options */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.6rem', paddingLeft: '1rem', marginBottom: '0.75rem' }}>
                            {q.options.map((opt, optIndex) => (
                                <div key={optIndex} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
                                    <div style={{ 
                                        width: '16px', height: '16px', border: '1.5px solid black', borderRadius: '50%', 
                                        flexShrink: 0, marginTop: '2px' 
                                    }}></div>
                                    <span style={{ fontSize: '14px' }}>
                                        <strong>{String.fromCharCode(65 + optIndex)}.</strong> {opt}
                                    </span>
                                </div>
                            ))}
                        </div>

                        {/* Structured Working Space / Rough Work Box */}
                        {includeWorkingSpace && (
                            <div style={{
                                marginTop: '0.75rem',
                                border: '1px dashed #888',
                                borderRadius: '4px',
                                minHeight: '95px',
                                padding: '0.5rem 0.75rem',
                                background: '#fdfdfd',
                                position: 'relative'
                            }}>
                                <span style={{ fontSize: '10px', color: '#777', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
                                    ✍️ Show Working Steps & Rough Calculations Here (Method: 1M | Calc: 1M | Ans: 1M):
                                </span>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Detachable Teacher / Parent Answer & Solution Key (Page Break) */}
            {includeAnswerKey && (
                <div style={{ pageBreakBefore: 'always', marginTop: '3rem', paddingTop: '2rem' }}>
                    <div style={{ textAlign: 'center', marginBottom: '1.5rem', borderBottom: '2px solid black', paddingBottom: '0.75rem' }}>
                        <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#666', fontWeight: 600 }}>HomeTutor Diagnostic Solutions</span>
                        <h2 style={{ fontSize: '20px', margin: '0.25rem 0' }}>Teacher & Parent Answer Key: {test.title}</h2>
                        <span style={{ fontSize: '11px', color: '#888' }}>Ref Code: {refCode} • Detach before handing worksheet to student</span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        {test.questions.map((q, index) => (
                            <div key={q.id || index} style={{ border: '1px solid #ddd', borderRadius: '4px', padding: '0.75rem 1rem', background: '#fafafa', fontSize: '13px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                                    <strong>Q{index + 1}. Correct Answer: Option ({String.fromCharCode(65 + q.correctAnswerIndex)}) – {q.options[q.correctAnswerIndex]}</strong>
                                    {q.topic && <span style={{ fontSize: '11px', color: '#666', fontStyle: 'italic' }}>Topic: {q.topic}</span>}
                                </div>
                                {q.explanation && (
                                    <p style={{ margin: '0.25rem 0 0', color: '#333', lineHeight: 1.4, fontSize: '12px' }}>
                                        <strong>Step-by-step Solution:</strong> {q.explanation}
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
            
            <div style={{ marginTop: '3rem', textAlign: 'center', fontSize: '11px', color: '#888', borderTop: '1px solid #ddd', paddingTop: '0.75rem' }}>
                Generated by HomeTutor AI • The Smart Learning & Homework Diagnostic System
            </div>
        </div>
    );
};

export default PrintableTest;
