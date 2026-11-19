import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Lock, Mail, Loader2, Zap, Crown } from 'lucide-react';
import useAuthStore, { SUPERUSER_PARENT, SUPERUSER_STUDENT } from '../store/authStore';
import { supabase } from '../lib/supabase';

const Login = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [role, setRole] = useState<'parent' | 'student'>('parent');
    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [password, setPassword] = useState('');
    const [inviteCode, setInviteCode] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    const navigate = useNavigate();
    const login = useAuthStore((state) => state.login);
    const loginAsSuperuser = useAuthStore((state) => state.loginAsSuperuser);

    const handleSuperuserLogin = (targetRole: 'parent' | 'student' = 'parent') => {
        if (typeof loginAsSuperuser === 'function') {
            loginAsSuperuser(targetRole);
        } else {
            login(targetRole === 'parent' ? SUPERUSER_PARENT : SUPERUSER_STUDENT);
        }
        navigate(targetRole === 'parent' ? '/parent/dashboard' : '/student/dashboard');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setErrorMsg('');

        // 1. Direct superuser shortcut check
        const cleanEmail = email.trim().toLowerCase();
        if (cleanEmail === 'admin@hometutor.app' || cleanEmail === 'admin' || cleanEmail === 'superuser' || (isLogin && password === 'admin')) {
            handleSuperuserLogin('parent');
            setIsLoading(false);
            return;
        }

        if (cleanEmail === 'student@hometutor.app' || (isLogin && password === 'student')) {
            handleSuperuserLogin('student');
            setIsLoading(false);
            return;
        }

        try {
            if (isLogin) {
                // Sign In
                const { data, error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;

                // Fetch actual user profile immediately to populate role, name, subscription, etc.
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', data.user.id)
                    .single();

                const resolvedRole: 'parent' | 'student' = (profile?.role === 'student' ? 'student' : 'parent');

                login({
                    id: data.user.id,
                    email: data.user.email!,
                    name: profile?.name || 'User',
                    role: resolvedRole,
                    inviteCode: profile?.invite_code,
                    parentId: profile?.parent_id,
                    subjects: profile?.subjects || [],
                    avatarUrl: profile?.avatar_url,
                    subscriptionTier: profile?.subscription_tier || 'free',
                    subscriptionStatus: profile?.subscription_status || 'active',
                    dailyTestLimit: profile?.daily_test_limit ?? 3,
                    dailyTestsCount: profile?.daily_tests_count ?? 0,
                    maxChildrenAllowed: profile?.max_children_allowed ?? 2,
                    curriculumBoard: profile?.curriculum_board || 'CBSE',
                    gradeLevel: profile?.grade_level ?? 5,
                });

                navigate(resolvedRole === 'parent' ? '/parent/dashboard' : '/student/dashboard');
                return;
            } else {
                // Sign Up
                const { data, error } = await supabase.auth.signUp({ email, password });
                if (error) throw error;

                if (data.user) {
                    let finalInviteCode = '';
                    let parentId: string | null = null;

                    if (role === 'parent') {
                        // Generate a unique 6-digit invite code
                        finalInviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
                    } else if (role === 'student' && inviteCode) {
                        // Look up parent by invite code
                        const { data: parentProfile, error: parentError } = await supabase
                            .from('profiles')
                            .select('id')
                            .eq('invite_code', inviteCode.toUpperCase())
                            .single();

                        if (parentError || !parentProfile) {
                            throw new Error('Invalid invite code. Please ask your parent for their code.');
                        }
                        parentId = parentProfile.id;
                    }

                    // Insert into profiles table
                    const { error: profileError } = await supabase
                        .from('profiles')
                        .insert([{
                            id: data.user.id,
                            name,
                            role,
                            invite_code: role === 'parent' ? finalInviteCode : null,
                            parent_id: parentId
                        }]);

                    if (profileError) throw profileError;

                    login({
                        id: data.user.id,
                        email: data.user.email!,
                        name,
                        role,
                        inviteCode: finalInviteCode || undefined,
                        parentId: parentId || undefined
                    });
                }
            }

            // Route user
            navigate(role === 'parent' ? '/parent/dashboard' : '/student/dashboard');

        } catch (error: any) {
            console.error('Auth error:', error);
            const rawMsg = error.message || 'An error occurred during authentication';
            if (rawMsg.toLowerCase().includes('fetch') || rawMsg.includes('ENOTFOUND') || rawMsg.toLowerCase().includes('network')) {
                setErrorMsg('Supabase project is currently paused or unreachable on Supabase Cloud. You can click "Log in as Superuser" below to test the full application immediately in offline mode!');
            } else {
                setErrorMsg(rawMsg);
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="container flex justify-center items-center" style={{ minHeight: 'calc(100dvh - 140px)', padding: '1rem 0.5rem' }}>
            <div className="card animate-fade-in" style={{ width: '100%', maxWidth: '420px', padding: 'clamp(1.25rem, 4vw, 2.25rem)' }}>
                <h2 style={{ textAlign: 'center', marginBottom: '0.4rem', fontSize: 'clamp(1.4rem, 4vw, 1.75rem)' }}>
                    {isLogin ? 'Welcome Back' : 'Create Account'}
                </h2>
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                    {isLogin ? 'Please sign in to continue.' : 'Sign up to get started as a tutor.'}
                </p>

                {/* Role Toggle */}
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', background: 'var(--surface-hover)', padding: '0.25rem', borderRadius: 'var(--radius-md)' }}>
                    <button
                        type="button"
                        onClick={() => setRole('parent')}
                        style={{
                            flex: 1, padding: '0.65rem 0.5rem', minHeight: '44px', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                            background: role === 'parent' ? 'white' : 'transparent',
                            boxShadow: role === 'parent' ? 'var(--shadow-sm)' : 'none',
                            fontWeight: role === 'parent' ? 600 : 400,
                            color: role === 'parent' ? 'var(--text-main)' : 'var(--text-muted)',
                            transition: 'var(--transition)'
                        }}
                    >
                        Parent
                    </button>
                    <button
                        type="button"
                        onClick={() => setRole('student')}
                        style={{
                            flex: 1, padding: '0.65rem 0.5rem', minHeight: '44px', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                            background: role === 'student' ? 'white' : 'transparent',
                            boxShadow: role === 'student' ? 'var(--shadow-sm)' : 'none',
                            fontWeight: role === 'student' ? 600 : 400,
                            color: role === 'student' ? 'var(--text-main)' : 'var(--text-muted)',
                            transition: 'var(--transition)'
                        }}
                    >
                        Student
                    </button>
                </div>

                {errorMsg && (
                    <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
                        {errorMsg}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    {!isLogin && (
                        <div className="input-group">
                            <label>Full Name</label>
                            <div style={{ position: 'relative' }}>
                                <User size={20} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                <input
                                    type="text"
                                    className="input"
                                    style={{ paddingLeft: '2.75rem' }}
                                    placeholder="Enter your name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    required
                                />
                            </div>
                        </div>
                    )}

                    <div className="input-group">
                        <label>Email Address</label>
                        <div style={{ position: 'relative' }}>
                            <Mail size={20} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input
                                type="email"
                                className="input"
                                style={{ paddingLeft: '2.75rem' }}
                                placeholder="Enter your email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <div className="input-group" style={{ marginBottom: isLogin || role === 'parent' ? '2rem' : '1rem' }}>
                        <label>Password</label>
                        <div style={{ position: 'relative' }}>
                            <Lock size={20} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input
                                type="password"
                                className="input"
                                style={{ paddingLeft: '2.75rem' }}
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    {!isLogin && role === 'student' && (
                        <div className="input-group" style={{ marginBottom: '2rem' }}>
                            <label>Parent's Invite Code</label>
                            <div style={{ position: 'relative' }}>
                                <Lock size={20} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                <input
                                    type="text"
                                    className="input"
                                    style={{ paddingLeft: '2.75rem' }}
                                    placeholder="Enter parent's invite code"
                                    value={inviteCode}
                                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                                    required
                                />
                            </div>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                                Ask your parent for their 6-digit invite code.
                            </p>
                        </div>
                    )}

                    <button type="submit" className="btn btn-primary" style={{ width: '100%', marginBottom: '1rem' }} disabled={isLoading}>
                        {isLoading ? <Loader2 size={20} className="animate-spin" /> : (isLogin ? 'Sign In' : 'Create Account')}
                    </button>
                </form>
                <style>{`
                    .animate-spin { animation: spin 1s linear infinite; }
                    @keyframes spin { 100% { transform: rotate(360deg); } }
                `}</style>

                <p style={{ textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-muted)', margin: 0 }}>
                    {isLogin ? "Don't have an account? " : "Already have an account? "}
                    <button
                        type="button"
                        onClick={() => setIsLogin(!isLogin)}
                        style={{
                            background: 'none', border: 'none', color: 'var(--primary)',
                            fontWeight: 500, cursor: 'pointer', padding: 0
                        }}
                    >
                        {isLogin ? 'Sign up' : 'Log in'}
                    </button>
                </p>

                {/* 1-Click Superuser Testing Access */}
                <div style={{
                    marginTop: '1.75rem',
                    paddingTop: '1.25rem',
                    borderTop: '1px dashed var(--border)',
                }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.4rem',
                        marginBottom: '0.75rem',
                        color: 'var(--primary)',
                        fontWeight: 600,
                        fontSize: '0.85rem'
                    }}>
                        <Zap size={15} />
                        <span>1-Click Superuser Testing Access</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                        <button
                            type="button"
                            onClick={() => handleSuperuserLogin('parent')}
                            className="hover-lift"
                            style={{
                                width: '100%',
                                padding: '0.65rem 1rem',
                                background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.12) 0%, rgba(129, 140, 248, 0.08) 100%)',
                                border: '1px solid rgba(79, 70, 229, 0.3)',
                                borderRadius: 'var(--radius-sm)',
                                color: 'var(--primary)',
                                fontWeight: 600,
                                fontSize: '0.82rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.5rem'
                            }}
                        >
                            <Crown size={15} color="#d97706" />
                            Log in as Superuser (Parent • Premium)
                        </button>
                        <button
                            type="button"
                            onClick={() => handleSuperuserLogin('student')}
                            className="hover-lift"
                            style={{
                                width: '100%',
                                padding: '0.65rem 1rem',
                                background: 'var(--surface-hover)',
                                border: '1px solid var(--border)',
                                borderRadius: 'var(--radius-sm)',
                                color: 'var(--text-main)',
                                fontWeight: 500,
                                fontSize: '0.82rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.5rem'
                            }}
                        >
                            🎓 Log in as Student (Child • Alex)
                        </button>
                    </div>
                    <p style={{ margin: '0.75rem 0 0', fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                        Credentials: <strong>admin@hometutor.app</strong> / <strong>admin</strong>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Login;
