import React, { useState } from 'react';
import { X, Layers, Sparkles, Image } from 'lucide-react';
import useAppStore, { type SavedWorksheet } from '../store/appStore';
import type { Difficulty } from '../lib/gemini';

interface WorksheetLibraryModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectForPractice: (worksheet: SavedWorksheet, difficulty: Difficulty) => void;
}

export const WorksheetLibraryModal: React.FC<WorksheetLibraryModalProps> = ({
    isOpen,
    onClose,
    onSelectForPractice
}) => {
    const savedWorksheets = useAppStore(state => state.savedWorksheets);
    const [selectedSubject, setSelectedSubject] = useState<string>('all');
    const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>('basic');

    if (!isOpen) return null;

    const subjects = ['all', ...Array.from(new Set(savedWorksheets.map(w => w.subject)))];

    const filtered = selectedSubject === 'all'
        ? savedWorksheets
        : savedWorksheets.filter(w => w.subject === selectedSubject);

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
                    maxWidth: '620px',
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
                        <div style={{ background: 'rgba(59, 130, 246, 0.12)', padding: '0.5rem', borderRadius: 'var(--radius-md)', color: '#2563eb' }}>
                            <Layers size={22} />
                        </div>
                        <div>
                            <h2 style={{ fontSize: '1.15rem', margin: 0, fontWeight: 700 }}>
                                Saved Worksheet Library
                            </h2>
                            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                FR-11 · Reuse past worksheets to generate adaptive practice
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

                {/* Subject Filter Chips */}
                <div style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto', paddingBottom: '0.2rem' }}>
                    {subjects.map(s => (
                        <button
                            key={s}
                            type="button"
                            onClick={() => setSelectedSubject(s)}
                            style={{
                                padding: '0.35rem 0.8rem',
                                borderRadius: '2rem',
                                border: `1.5px solid ${selectedSubject === s ? 'var(--primary)' : 'var(--border)'}`,
                                background: selectedSubject === s ? 'var(--primary)' : 'var(--surface)',
                                color: selectedSubject === s ? 'white' : 'var(--text-muted)',
                                fontSize: '0.8rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            {s === 'all' ? 'All Worksheets' : s}
                        </button>
                    ))}
                </div>

                {/* Adaptive Difficulty Preference Chips */}
                <div style={{ background: 'var(--surface-hover)', padding: '0.75rem', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)' }}>
                        Default Practice Difficulty:
                    </span>
                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                        {[
                            { id: 'basic', label: 'Easy (Recall)' },
                            { id: 'intermediate', label: 'Medium' },
                            { id: 'advanced', label: 'Hard (Challenge)' }
                        ].map(d => (
                            <button
                                key={d.id}
                                type="button"
                                onClick={() => setSelectedDifficulty(d.id as Difficulty)}
                                style={{
                                    padding: '0.25rem 0.65rem',
                                    borderRadius: '1rem',
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    border: `1.5px solid ${selectedDifficulty === d.id ? 'var(--teal)' : 'var(--border)'}`,
                                    background: selectedDifficulty === d.id ? 'rgba(13, 148, 136, 0.15)' : 'var(--surface)',
                                    color: selectedDifficulty === d.id ? 'var(--teal)' : 'var(--text-muted)',
                                    cursor: 'pointer'
                                }}
                            >
                                {d.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Worksheets Grid */}
                {filtered.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        No worksheets saved in this category yet. Upload a homework or practice sheet to save it here automatically.
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '0.85rem', maxHeight: '52vh', overflowY: 'auto' }}>
                        {filtered.map(ws => (
                            <div key={ws.id} className="worksheet-library-card">
                                <div style={{ height: '110px', background: '#0F172A', overflow: 'hidden', position: 'relative' }}>
                                    {ws.imageUrls[0] ? (
                                        <img 
                                            src={ws.imageUrls[0]} 
                                            alt={ws.title} 
                                            style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.85 }} 
                                        />
                                    ) : (
                                        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                                            <Image size={24} />
                                        </div>
                                    )}
                                    <span style={{
                                        position: 'absolute',
                                        top: '8px',
                                        left: '8px',
                                        background: 'rgba(0,0,0,0.65)',
                                        color: 'white',
                                        backdropFilter: 'blur(4px)',
                                        padding: '0.15rem 0.5rem',
                                        borderRadius: '1rem',
                                        fontSize: '0.7rem',
                                        fontWeight: 700
                                    }}>
                                        {ws.subject}
                                    </span>
                                </div>
                                <div style={{ padding: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                                    <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 700, lineHeight: 1.3 }}>
                                        {ws.title}
                                    </h4>
                                    {ws.topic && (
                                        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                            {ws.topic}
                                        </p>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            onSelectForPractice(ws, selectedDifficulty);
                                            onClose();
                                        }}
                                        className="btn-teal"
                                        style={{ marginTop: 'auto', padding: '0.5rem 0.75rem', fontSize: '0.8rem', width: '100%' }}
                                    >
                                        <Sparkles size={14} />
                                        <span>Generate Practice Test</span>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
export default WorksheetLibraryModal;
