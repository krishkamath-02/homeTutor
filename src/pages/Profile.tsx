import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User as UserIcon, Save, Mail, Shield, CheckCircle, ArrowLeft, Key, Book, GraduationCap } from 'lucide-react';
import useAuthStore from '../store/authStore';

const AVAILABLE_BOARDS = [
    { id: 'CBSE', name: 'CBSE (Central Board of Secondary Education)' },
    { id: 'ICSE', name: 'ICSE (Indian Certificate of Secondary Education)' },
    { id: 'State Board', name: 'State Board (State Syllabus)' },
    { id: 'US Common Core', name: 'US Common Core / State Standards' },
    { id: 'IB', name: 'IB (International Baccalaureate)' },
    { id: 'Cambridge', name: 'Cambridge (IGCSE / O-Levels)' },
];

const AVAILABLE_SUBJECTS = [
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

const AVATAR_OPTIONS = ['🦊', '🐼', '🦁', '🐯', '🐰', '🐶', '🦄', '🦖'];

const Profile = () => {
    const user = useAuthStore(state => state.user);
    const updateProfileData = useAuthStore(state => state.updateProfileData);
    const navigate = useNavigate();

    const [name, setName] = useState(user?.name || '');
    const [selectedSubjects, setSelectedSubjects] = useState<string[]>(user?.subjects || []);
    const [curriculumBoard, setCurriculumBoard] = useState<string>(user?.curriculumBoard || 'CBSE');
    const [gradeLevel, setGradeLevel] = useState<number>(user?.gradeLevel || 5);
    const [selectedAvatar, setSelectedAvatar] = useState<string>(user?.avatarUrl || '');
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!user) {
            navigate('/login');
        } else {
            setName(user.name);
            setSelectedSubjects(user.subjects || []);
            setCurriculumBoard(user.curriculumBoard || 'CBSE');
            setGradeLevel(user.gradeLevel || 5);
        }
    }, [user, navigate]);

    if (!user) return null;

    const toggleSubject = (subject: string) => {
        setSelectedSubjects(prev => 
            prev.includes(subject) ? prev.filter(s => s !== subject) : [...prev, subject]
        );
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;
        
        setIsSaving(true);
        setError(null);
        setSaveSuccess(false);

        try {
            await updateProfileData({ 
                name: name.trim(), 
                subjects: selectedSubjects, 
                avatarUrl: selectedAvatar,
                curriculumBoard,
                gradeLevel
            });
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (err: any) {
            setError(err.message || 'Failed to update profile');
        } finally {
            setIsSaving(false);
        }
    };

    const hasChanges = name.trim() !== user.name || 
        JSON.stringify(selectedSubjects.slice().sort()) !== JSON.stringify([...(user.subjects || [])].sort()) ||
        selectedAvatar !== (user.avatarUrl || '') ||
        curriculumBoard !== (user.curriculumBoard || 'CBSE') ||
        gradeLevel !== (user.gradeLevel || 5);

    return (
        <div className="container animate-fade-in" style={{ maxWidth: '600px', margin: '2rem auto' }}>
            <button 
                onClick={() => navigate(`/${user.role}/dashboard`)} 
                className="btn btn-secondary"
                style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'transparent', border: '1px solid var(--border)' }}
            >
                <ArrowLeft size={16} /> Back to Dashboard
            </button>

            <div className="card" style={{ padding: '2.5rem 2rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '2.5rem' }}>
                    <div style={{ 
                        width: '80px', height: '80px', borderRadius: '50%', 
                        background: 'linear-gradient(135deg, var(--primary), #818cf8)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'white', marginBottom: '1rem',
                        boxShadow: '0 10px 25px -5px rgba(79, 70, 229, 0.4)',
                        fontSize: selectedAvatar ? '3rem' : 'initial'
                    }}>
                        {selectedAvatar ? selectedAvatar : <UserIcon size={40} />}
                    </div>
                    <h1 style={{ fontSize: '1.75rem', margin: '0 0 0.5rem 0' }}>Your Profile</h1>
                    <span style={{ 
                        padding: '0.25rem 0.75rem', borderRadius: '2rem', 
                        background: user.role === 'parent' ? 'rgba(79,70,229,0.1)' : 'rgba(16,185,129,0.1)',
                        color: user.role === 'parent' ? 'var(--primary)' : 'var(--secondary)',
                        fontWeight: 600, fontSize: '0.875rem', textTransform: 'capitalize'
                    }}>
                        {user.role} Account
                    </span>
                </div>

                <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    
                    {/* Read-only Email Field */}
                    <div className="input-group">
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)' }}>
                            <Mail size={16} /> Email Address
                        </label>
                        <input 
                            type="email" 
                            className="input" 
                            value={user.email} 
                            disabled 
                            style={{ background: 'var(--surface-hover)', cursor: 'not-allowed', color: 'var(--text-muted)' }}
                        />
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>Email cannot be changed directly.</p>
                    </div>

                    {/* Editable Name Field */}
                    <div className="input-group">
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <UserIcon size={16} /> Full Name
                        </label>
                        <input 
                            type="text" 
                            className="input" 
                            value={name} 
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Enter your full name"
                            required
                        />
                    </div>

                    {/* Curriculum Board & Grade Selection */}
                    <div style={{ 
                        padding: '1.25rem', borderRadius: 'var(--radius-md)', 
                        background: 'var(--surface)', border: '1px solid var(--border)',
                        marginTop: '0.5rem'
                    }}>
                        <h3 style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 0.5rem 0' }}>
                            <GraduationCap size={18} color="var(--primary)" /> Academic Standards & Board Alignment
                        </h3>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                            AI test generation and diagnostic questions will automatically align to this syllabus and difficulty standard.
                        </p>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.35rem' }}>
                                    Curriculum Board
                                </label>
                                <select 
                                    className="input" 
                                    value={curriculumBoard}
                                    onChange={(e) => setCurriculumBoard(e.target.value)}
                                    style={{ width: '100%', cursor: 'pointer' }}
                                >
                                    {AVAILABLE_BOARDS.map(b => (
                                        <option key={b.id} value={b.id}>{b.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.35rem' }}>
                                    Grade Level
                                </label>
                                <select 
                                    className="input" 
                                    value={gradeLevel}
                                    onChange={(e) => setGradeLevel(Number(e.target.value))}
                                    style={{ width: '100%', cursor: 'pointer' }}
                                >
                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(g => (
                                        <option key={g} value={g}>Grade {g}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Subjects Selection */}
                    <div style={{ 
                        padding: '1.25rem', borderRadius: 'var(--radius-md)', 
                        background: 'var(--surface)', border: '1px solid var(--border)',
                        marginTop: '0.5rem'
                    }}>
                        <h3 style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 1rem 0' }}>
                            <Book size={18} color="var(--primary)" /> Tracked Subjects
                        </h3>
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                            Select the specific subjects you want to track for your child. Only these subjects will appear on your dashboard.
                        </p>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
                            {AVAILABLE_SUBJECTS.map(subject => (
                                <label key={subject} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                                    <input 
                                        type="checkbox" 
                                        checked={selectedSubjects.includes(subject)}
                                        onChange={() => toggleSubject(subject)}
                                        style={{ accentColor: 'var(--primary)', width: '16px', height: '16px', cursor: 'pointer' }}
                                    />
                                    {subject}
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Avatar Selection */}
                    <div style={{ 
                        padding: '1.25rem', borderRadius: 'var(--radius-md)', 
                        background: 'var(--surface)', border: '1px solid var(--border)',
                        marginTop: '0.5rem'
                    }}>
                        <h3 style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 1rem 0' }}>
                            <UserIcon size={18} color="var(--primary)" /> Choose Avatar
                        </h3>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <button 
                                type="button"
                                onClick={() => setSelectedAvatar('')}
                                style={{ 
                                    width: '40px', height: '40px', borderRadius: '50%', 
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', 
                                    border: selectedAvatar === '' ? '2px solid var(--primary)' : '1px solid var(--border)',
                                    background: selectedAvatar === '' ? 'rgba(79,70,229,0.1)' : 'var(--surface-hover)',
                                    cursor: 'pointer'
                                }}
                            >
                                <UserIcon size={20} />
                            </button>
                            {AVATAR_OPTIONS.map(emoji => (
                                <button 
                                    key={emoji}
                                    type="button"
                                    onClick={() => setSelectedAvatar(emoji)}
                                    style={{ 
                                        width: '40px', height: '40px', borderRadius: '50%', fontSize: '1.5rem',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', 
                                        border: selectedAvatar === emoji ? '2px solid var(--primary)' : '1px solid var(--border)',
                                        background: selectedAvatar === emoji ? 'rgba(79,70,229,0.1)' : 'var(--surface-hover)',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {emoji}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Role-specific Info */}
                    <div style={{ 
                        padding: '1.25rem', borderRadius: 'var(--radius-md)', 
                        background: 'var(--surface)', border: '1px solid var(--border)',
                        marginTop: '0.5rem'
                    }}>
                        <h3 style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 1rem 0' }}>
                            <Shield size={18} color="var(--primary)" /> Account Details
                        </h3>
                        
                        {user.role === 'parent' ? (
                            <div>
                                <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Your strict Invite Code for linking students:</p>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface-hover)', padding: '0.75rem', borderRadius: 'var(--radius-sm)' }}>
                                    <span style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '2px', color: 'var(--primary)' }}>
                                        {user.inviteCode || 'N/A'}
                                    </span>
                                    {user.inviteCode && (
                                        <button 
                                            type="button"
                                            onClick={() => navigator.clipboard.writeText(user.inviteCode!)}
                                            style={{ color: 'var(--primary)', background: 'none', border: 'none', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem' }}
                                        >
                                            Copy
                                        </button>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                    <Key size={16} color="var(--text-muted)" />
                                    <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>Linking Status:</span>
                                </div>
                                {user.parentId ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--secondary)' }}>
                                        <CheckCircle size={16} />
                                        <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Successfully linked to Parent</span>
                                    </div>
                                ) : (
                                    <div style={{ color: '#f59e0b', fontSize: '0.9rem' }}>
                                        Not linked yet. Enter a parent's invite code on the dashboard.
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {error && (
                        <div style={{ color: '#ef4444', fontSize: '0.875rem', padding: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: 'var(--radius-sm)' }}>
                            {error}
                        </div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
                        {saveSuccess && (
                            <span style={{ color: 'var(--secondary)', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.9rem', fontWeight: 500, animation: 'fade-in 0.3s' }}>
                                <CheckCircle size={16} /> Profile Saved!
                            </span>
                        )}
                        <button 
                            type="submit" 
                            className="btn btn-primary" 
                            disabled={isSaving || !hasChanges}
                            style={{ padding: '0.75rem 2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                        >
                            <Save size={18} /> {isSaving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>

                </form>
            </div>
            <style>{`
                @keyframes fade-in { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
            `}</style>
        </div>
    );
};

export default Profile;
