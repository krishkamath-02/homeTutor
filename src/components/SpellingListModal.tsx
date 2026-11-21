import React, { useState } from 'react';
import { X, Volume2, Sparkles, BookOpen, Camera } from 'lucide-react';
import { generateSpellingList, type SpellingListResult } from '../lib/gemini';
import useAppStore from '../store/appStore';

interface SpellingListModalProps {
    isOpen: boolean;
    onClose: () => void;
    defaultChapterTitle?: string;
}

export const SpellingListModal: React.FC<SpellingListModalProps> = ({
    isOpen,
    onClose,
    defaultChapterTitle = 'Chapter 4: The Friendly Whale'
}) => {
    const saveSpellingList = useAppStore(state => state.saveSpellingList);

    const [chapterTitle, setChapterTitle] = useState(defaultChapterTitle);
    const [files, setFiles] = useState<File[]>([]);
    const [previews, setPreviews] = useState<string[]>([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [spellingResult, setSpellingResult] = useState<SpellingListResult | null>(null);
    const [playingWord, setPlayingWord] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files) return;
        const newFiles = Array.from(e.target.files);
        setFiles(prev => [...prev, ...newFiles]);
        const newPreviews = newFiles.map(f => URL.createObjectURL(f));
        setPreviews(prev => [...prev, ...newPreviews]);
    };

    const handleGenerate = async () => {
        setIsGenerating(true);
        try {
            const result = await generateSpellingList(files, chapterTitle);
            setSpellingResult(result);
            saveSpellingList(result);
        } catch (err) {
            console.error('Spelling generation error:', err);
        } finally {
            setIsGenerating(false);
        }
    };

    const speak = (word: string) => {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            setPlayingWord(word);
            const utterance = new SpeechSynthesisUtterance(word);
            utterance.rate = 0.85; // young learner speed
            utterance.onend = () => setPlayingWord(null);
            utterance.onerror = () => setPlayingWord(null);
            window.speechSynthesis.speak(utterance);
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
                    maxWidth: '560px',
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
                        <div style={{ background: 'rgba(16, 185, 129, 0.12)', padding: '0.5rem', borderRadius: 'var(--radius-md)', color: '#10b981' }}>
                            <BookOpen size={22} />
                        </div>
                        <div>
                            <h2 style={{ fontSize: '1.15rem', margin: 0, fontWeight: 700 }}>
                                English Spelling &amp; Vocabulary
                            </h2>
                            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                Section 10 · Adaptive word cards with audio pronunciation
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

                {!spellingResult ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div>
                            <label style={{ display: 'block', fontWeight: 600, fontSize: '0.82rem', marginBottom: '0.35rem' }}>
                                Chapter Name / Topic
                            </label>
                            <input 
                                type="text"
                                value={chapterTitle}
                                onChange={e => setChapterTitle(e.target.value)}
                                style={{ width: '100%', padding: '0.55rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', fontWeight: 600, fontSize: '0.82rem', marginBottom: '0.35rem' }}>
                                Upload English Textbook / Reader Pages
                            </label>
                            <label 
                                style={{
                                    border: '2px dashed var(--border)',
                                    borderRadius: 'var(--radius-md)',
                                    padding: '1.25rem',
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
                                <Camera size={24} color="var(--primary)" />
                                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Snap textbook pages</span>
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                    {files.length > 0 ? `${files.length} pages selected` : 'Or tap "Generate" to use standard Grade 2 list'}
                                </span>
                            </label>
                        </div>

                        {previews.length > 0 && (
                            <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
                                {previews.map((src, i) => (
                                    <img key={i} src={src} alt="Chapter" style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '6px' }} />
                                ))}
                            </div>
                        )}

                        <button
                            type="button"
                            onClick={handleGenerate}
                            disabled={isGenerating}
                            className="btn-teal"
                            style={{ width: '100%', padding: '0.8rem', fontSize: '0.92rem' }}
                        >
                            {isGenerating ? (
                                <>
                                    <Sparkles size={18} className="animate-spin" />
                                    <span>Building Grade 2 Spelling List...</span>
                                </>
                            ) : (
                                <>
                                    <Sparkles size={18} />
                                    <span>Generate Spelling List</span>
                                </>
                            )}
                        </button>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h3 style={{ fontSize: '0.95rem', margin: 0, fontWeight: 700, color: 'var(--text-main)' }}>
                                    {spellingResult.chapterTitle}
                                </h3>
                                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--teal)' }}>
                                    ✨ {spellingResult.words.length} key spelling words for Grade 2
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSpellingResult(null)}
                                style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 }}
                            >
                                New Chapter
                            </button>
                        </div>

                        {/* Word Cards Grid */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '52vh', overflowY: 'auto' }}>
                            {spellingResult.words.map((w, idx) => (
                                <div key={idx} className="spelling-card">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)' }}>
                                                    {w.word}
                                                </span>
                                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', background: 'var(--surface-hover)', padding: '0.1rem 0.45rem', borderRadius: '4px' }}>
                                                    {w.syllables}
                                                </span>
                                            </div>
                                            <p style={{ margin: '0.25rem 0 0', fontSize: '0.82rem', color: '#334155' }}>
                                                {w.meaning}
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => speak(w.word)}
                                            title="Listen to pronunciation"
                                            style={{
                                                background: playingWord === w.word ? 'var(--teal)' : 'rgba(13, 148, 136, 0.1)',
                                                color: playingWord === w.word ? 'white' : 'var(--teal)',
                                                border: 'none',
                                                borderRadius: '50%',
                                                width: '36px',
                                                height: '36px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                cursor: 'pointer',
                                                flexShrink: 0,
                                                transition: 'all 0.15s ease'
                                            }}
                                        >
                                            <Volume2 size={18} />
                                        </button>
                                    </div>

                                    <div style={{ background: '#F8FAFC', padding: '0.45rem 0.65rem', borderRadius: '6px', fontSize: '0.78rem' }}>
                                        <p style={{ margin: 0, color: '#475569' }}>
                                            💬 <strong>Example:</strong> "{w.exampleSentence}"
                                        </p>
                                        {w.phoneticTip && (
                                            <p style={{ margin: '0.2rem 0 0', color: 'var(--amber-text)', fontSize: '0.74rem' }}>
                                                💡 <strong>Spelling Tip:</strong> {w.phoneticTip}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <button
                            type="button"
                            onClick={onClose}
                            className="btn btn-primary"
                            style={{ width: '100%', justifyContent: 'center' }}
                        >
                            Done Practicing
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
export default SpellingListModal;
