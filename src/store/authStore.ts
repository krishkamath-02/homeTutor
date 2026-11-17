import { create } from 'zustand';
import { supabase } from '../lib/supabase';

export type UserRole = 'parent' | 'student';

export interface User {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    inviteCode?: string;
    parentId?: string;
    subjects?: string[];
    avatarUrl?: string;
    subscriptionTier?: 'free' | 'pro' | 'premium';
    subscriptionStatus?: 'active' | 'past_due' | 'canceled' | 'trialing';
    dailyTestLimit?: number;
    dailyTestsCount?: number;
    maxChildrenAllowed?: number;
    curriculumBoard?: string;
    gradeLevel?: number;
}

export const SUPERUSER_PARENT: User = {
    id: 'superuser-parent-001',
    name: 'Admin Parent (Superuser)',
    email: 'admin@hometutor.app',
    role: 'parent',
    inviteCode: 'HT-SUPER',
    subjects: ['Math', 'Science', 'English'],
    subscriptionTier: 'premium',
    subscriptionStatus: 'active',
    dailyTestLimit: 999,
    dailyTestsCount: 0,
    maxChildrenAllowed: 10,
    curriculumBoard: 'CBSE',
    gradeLevel: 6,
};

export const SUPERUSER_STUDENT: User = {
    id: 'superuser-student-001',
    name: 'Alex (Superuser Student)',
    email: 'student@hometutor.app',
    role: 'student',
    parentId: 'superuser-parent-001',
    subjects: ['Math', 'Science'],
    subscriptionTier: 'premium',
    subscriptionStatus: 'active',
    dailyTestLimit: 999,
    dailyTestsCount: 0,
    maxChildrenAllowed: 10,
    curriculumBoard: 'CBSE',
    gradeLevel: 6,
};

interface AuthState {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (user: User) => void;
    loginAsSuperuser: (role?: 'parent' | 'student') => void;
    updateUser: (updates: Partial<User>) => void;
    updateProfileData: (updates: {
        name?: string;
        subjects?: string[];
        avatarUrl?: string;
        curriculumBoard?: string;
        gradeLevel?: number;
    }) => Promise<void>;
    logout: () => Promise<void>;
    checkSession: () => Promise<void>;
}

const useAuthStore = create<AuthState>((set, get) => ({
    user: null,
    isAuthenticated: false,
    isLoading: true,

    login: (user) => {
        try {
            localStorage.setItem('hometutor_active_user', JSON.stringify(user));
        } catch {}
        set({ user, isAuthenticated: true, isLoading: false });
    },

    loginAsSuperuser: (role: 'parent' | 'student' = 'parent') => {
        const superuser = role === 'parent' ? SUPERUSER_PARENT : SUPERUSER_STUDENT;
        try {
            localStorage.setItem('hometutor_active_user', JSON.stringify(superuser));
        } catch {}
        set({ user: superuser, isAuthenticated: true, isLoading: false });
    },
    updateUser: (updates) => set((state) => ({ user: state.user ? { ...state.user, ...updates } : null })),

    updateProfileData: async (updates) => {
        set((state) => {
            if (!state.user) return state;
            return { user: { ...state.user, ...updates } };
        });
        const currentUser = get().user;
        if (!currentUser) return;
        
        const dbUpdates: any = {};
        if (updates.name !== undefined) dbUpdates.name = updates.name;
        if (updates.subjects !== undefined) dbUpdates.subjects = updates.subjects;
        if (updates.avatarUrl !== undefined) dbUpdates.avatar_url = updates.avatarUrl;
        if (updates.curriculumBoard !== undefined) dbUpdates.curriculum_board = updates.curriculumBoard;
        if (updates.gradeLevel !== undefined) dbUpdates.grade_level = updates.gradeLevel;

        try {
            const { error } = await supabase
                .from('profiles')
                .update(dbUpdates)
                .eq('id', currentUser.id);
                
            if (error) {
                console.warn('Profile update notice (columns may be pending in schema):', error.message);
            }
        } catch (err) {
            console.warn('Profile update network/schema notice:', err);
        }
    },

    logout: async () => {
        try {
            localStorage.removeItem('hometutor_active_user');
        } catch {}
        try {
            await supabase.auth.signOut();
        } catch (e) {
            console.warn('Sign out notice:', e);
        }
        set({ user: null, isAuthenticated: false });
    },

    checkSession: async () => {
        try {
            // 1. Check local session first
            try {
                const stored = localStorage.getItem('hometutor_active_user');
                if (stored) {
                    const parsed = JSON.parse(stored);
                    if (parsed && parsed.id) {
                        if (parsed.subjects && Array.isArray(parsed.subjects)) {
                            parsed.subjects = parsed.subjects.map((s: string) => s === 'Mathematics' ? 'Math' : s);
                        }
                        set({ user: parsed, isAuthenticated: true, isLoading: false });
                        return;
                    }
                }
            } catch {}

            // 2. Fall back to Supabase session with network error handling
            const { data: { session } } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }));

            if (session?.user) {
                // Fetch user profile to get name and role
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', session.user.id)
                    .single();

                if (profile) {
                    const userObj: User = {
                        id: session.user.id,
                        email: session.user.email!,
                        name: profile.name,
                        role: profile.role as UserRole,
                        inviteCode: profile.invite_code,
                        parentId: profile.parent_id,
                        subjects: profile.subjects || [],
                        avatarUrl: profile.avatar_url || undefined,
                        subscriptionTier: profile.subscription_tier || 'free',
                        subscriptionStatus: profile.subscription_status || 'active',
                        dailyTestLimit: profile.daily_test_limit ?? 3,
                        dailyTestsCount: profile.daily_tests_count ?? 0,
                        maxChildrenAllowed: profile.max_children_allowed ?? 2,
                        curriculumBoard: profile.curriculum_board || 'CBSE',
                        gradeLevel: profile.grade_level ?? 5,
                    };
                    try {
                        localStorage.setItem('hometutor_active_user', JSON.stringify(userObj));
                    } catch {}
                    set({
                        user: userObj,
                        isAuthenticated: true
                    });
                } else {
                    // No profile found — treat as unauthenticated
                    await supabase.auth.signOut().catch(() => {});
                    set({ user: null, isAuthenticated: false });
                }
            } else {
                set({ user: null, isAuthenticated: false });
            }
        } catch (error) {
            console.warn('Error checking session (Supabase may be offline):', error);
            set({ user: null, isAuthenticated: false });
        } finally {
            set({ isLoading: false });
        }
    }
}));

export default useAuthStore;
