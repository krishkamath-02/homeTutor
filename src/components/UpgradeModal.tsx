import React, { useState } from 'react';
import { Check, Sparkles, X, Zap, Users, BookOpen, FileCheck, ShieldCheck } from 'lucide-react';
import useAuthStore from '../store/authStore';
import { supabase } from '../lib/supabase';

interface UpgradeModalProps {
    isOpen: boolean;
    onClose: () => void;
    highlightReason?: 'daily_limit' | 'child_limit' | 'analytics' | 'general';
}

const UpgradeModal: React.FC<UpgradeModalProps> = ({ isOpen, onClose, highlightReason = 'general' }) => {
    const user = useAuthStore(state => state.user);
    const updateUser = useAuthStore(state => state.updateUser);
    const [currency, setCurrency] = useState<'INR' | 'USD'>('INR');
    const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('annual');
    const [isUpgrading, setIsUpgrading] = useState(false);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    if (!isOpen) return null;

    const currentTier = user?.subscriptionTier || 'free';

    const handleSelectPlan = async (tier: 'pro' | 'premium') => {
        setIsUpgrading(true);
        try {
            if (user?.id) {
                // Update in Supabase profile
                const maxChildren = tier === 'pro' ? 3 : 999;
                const { error } = await supabase
                    .from('profiles')
                    .update({
                        subscription_tier: tier,
                        subscription_status: 'active',
                        daily_test_limit: 9999, // unlimited
                        max_children_allowed: maxChildren
                    })
                    .eq('id', user.id);

                if (!error) {
                    updateUser({
                        subscriptionTier: tier,
                        dailyTestLimit: 9999,
                        maxChildrenAllowed: maxChildren
                    });
                }
            }
            setSuccessMessage(`🎉 Successfully upgraded to ${tier === 'pro' ? 'Pro' : 'Family Premium'}!`);
            setTimeout(() => {
                setSuccessMessage(null);
                onClose();
            }, 1800);
        } catch (err: any) {
            console.error('Upgrade error:', err);
        } finally {
            setIsUpgrading(false);
        }
    };

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(6px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
            overflowY: 'auto'
        }}>
            <div style={{
                background: 'var(--surface, #ffffff)',
                color: 'var(--text-main, #0f172a)',
                borderRadius: 'var(--radius-lg, 16px)',
                width: '100%',
                maxWidth: '920px',
                border: '1px solid var(--border, #e2e8f0)',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                position: 'relative',
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
            }} className="animate-fade-in">

                {/* Modal Header */}
                <div style={{
                    padding: '1.75rem 2rem 1.25rem',
                    borderBottom: '1px solid var(--border, #e2e8f0)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    background: 'linear-gradient(180deg, rgba(79, 70, 229, 0.05) 0%, transparent 100%)'
                }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                            <span style={{
                                background: 'linear-gradient(135deg, var(--primary, #4f46e5), #818cf8)',
                                color: 'white',
                                padding: '0.2rem 0.6rem',
                                borderRadius: '9999px',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px'
                            }}>
                                HomeTutor Plans
                            </span>
                            {highlightReason === 'daily_limit' && (
                                <span style={{ color: '#ef4444', fontSize: '0.85rem', fontWeight: 600 }}>
                                    ⚠️ Daily Limit Reached (3/3 Free Tests)
                                </span>
                            )}
                            {highlightReason === 'child_limit' && (
                                <span style={{ color: '#f59e0b', fontSize: '0.85rem', fontWeight: 600 }}>
                                    ⚠️ Child Limit Reached (2 Kids on Free Tier)
                                </span>
                            )}
                        </div>
                        <h2 style={{ fontSize: '1.65rem', margin: 0, fontWeight: 700 }}>
                            Supercharge Your Child's Learning
                        </h2>
                        <p style={{ margin: '0.35rem 0 0', color: 'var(--text-muted, #64748b)', fontSize: '0.92rem' }}>
                            Generate unlimited custom tests, unlock in-depth topic analytics, and support multiple children.
                        </p>
                    </div>

                    <button
                        onClick={onClose}
                        style={{
                            background: 'var(--surface-hover, #f1f5f9)',
                            border: 'none',
                            borderRadius: '50%',
                            width: '36px',
                            height: '36px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            color: 'var(--text-muted, #64748b)'
                        }}
                        aria-label="Close"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Currency & Billing Toggles */}
                <div style={{
                    padding: '1rem 2rem',
                    background: 'var(--surface-hover, #f8fafc)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '1rem',
                    borderBottom: '1px solid var(--border, #e2e8f0)'
                }}>
                    {/* Billing Cycle Switch */}
                    <div style={{ display: 'flex', alignItems: 'center', background: 'var(--surface, #ffffff)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border, #e2e8f0)' }}>
                        <button
                            onClick={() => setBillingCycle('annual')}
                            style={{
                                padding: '0.4rem 0.85rem',
                                borderRadius: '6px',
                                border: 'none',
                                background: billingCycle === 'annual' ? 'var(--primary, #4f46e5)' : 'transparent',
                                color: billingCycle === 'annual' ? '#ffffff' : 'var(--text-muted, #64748b)',
                                fontWeight: 600,
                                fontSize: '0.82rem',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                            }}
                        >
                            Annual <span style={{ background: '#10b981', color: 'white', padding: '1px 5px', borderRadius: '4px', fontSize: '0.68rem', marginLeft: '4px' }}>Save 40%</span>
                        </button>
                        <button
                            onClick={() => setBillingCycle('monthly')}
                            style={{
                                padding: '0.4rem 0.85rem',
                                borderRadius: '6px',
                                border: 'none',
                                background: billingCycle === 'monthly' ? 'var(--primary, #4f46e5)' : 'transparent',
                                color: billingCycle === 'monthly' ? '#ffffff' : 'var(--text-muted, #64748b)',
                                fontWeight: 600,
                                fontSize: '0.82rem',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                            }}
                        >
                            Monthly
                        </button>
                    </div>

                    {/* Currency Selector */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted, #64748b)' }}>
                        <span>Currency:</span>
                        <div style={{ display: 'flex', background: 'var(--surface, #ffffff)', padding: '2px', borderRadius: '6px', border: '1px solid var(--border, #e2e8f0)' }}>
                            <button
                                onClick={() => setCurrency('INR')}
                                style={{
                                    padding: '0.3rem 0.65rem',
                                    borderRadius: '4px',
                                    border: 'none',
                                    background: currency === 'INR' ? 'rgba(79, 70, 229, 0.12)' : 'transparent',
                                    color: currency === 'INR' ? 'var(--primary, #4f46e5)' : 'var(--text-muted, #64748b)',
                                    fontWeight: 700,
                                    fontSize: '0.8rem',
                                    cursor: 'pointer'
                                }}
                            >
                                ₹ INR (India)
                            </button>
                            <button
                                onClick={() => setCurrency('USD')}
                                style={{
                                    padding: '0.3rem 0.65rem',
                                    borderRadius: '4px',
                                    border: 'none',
                                    background: currency === 'USD' ? 'rgba(79, 70, 229, 0.12)' : 'transparent',
                                    color: currency === 'USD' ? 'var(--primary, #4f46e5)' : 'var(--text-muted, #64748b)',
                                    fontWeight: 700,
                                    fontSize: '0.8rem',
                                    cursor: 'pointer'
                                }}
                            >
                                $ USD (Global)
                            </button>
                        </div>
                    </div>
                </div>

                {successMessage && (
                    <div style={{
                        padding: '1rem 2rem',
                        background: 'rgba(16, 185, 129, 0.15)',
                        color: '#065f46',
                        borderBottom: '1px solid rgba(16, 185, 129, 0.3)',
                        fontWeight: 600,
                        textAlign: 'center',
                        fontSize: '0.95rem'
                    }}>
                        {successMessage}
                    </div>
                )}

                {/* Pricing Cards Grid */}
                <div style={{
                    padding: '2rem',
                    overflowY: 'auto',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                    gap: '1.5rem',
                    alignItems: 'stretch'
                }}>

                    {/* FREE TIER */}
                    <div style={{
                        border: '1px solid var(--border, #e2e8f0)',
                        borderRadius: 'var(--radius-md, 12px)',
                        padding: '1.5rem',
                        display: 'flex',
                        flexDirection: 'column',
                        background: 'var(--surface, #ffffff)',
                        position: 'relative'
                    }}>
                        <div style={{ marginBottom: '1rem' }}>
                            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted, #64748b)', textTransform: 'uppercase' }}>
                                🥉 Free Plan
                            </span>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem', marginTop: '0.5rem' }}>
                                <span style={{ fontSize: '2rem', fontWeight: 700 }}>
                                    {currency === 'INR' ? '₹0' : '$0'}
                                </span>
                                <span style={{ color: 'var(--text-muted, #64748b)', fontSize: '0.82rem' }}>/ forever</span>
                            </div>
                            <p style={{ margin: '0.4rem 0 0', fontSize: '0.82rem', color: 'var(--text-muted, #64748b)' }}>
                                Essential practice for 1–2 children.
                            </p>
                        </div>

                        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1.5rem 0', display: 'flex', flexDirection: 'column', gap: '0.65rem', flex: 1, fontSize: '0.84rem' }}>
                            <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Check size={16} color="#10b981" /> <strong>Up to 2 Children</strong>
                            </li>
                            <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Check size={16} color="#10b981" /> <strong>3 Test Generations / Day</strong>
                            </li>
                            <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Check size={16} color="#10b981" /> Standard 5-Question Tests
                            </li>
                            <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Check size={16} color="#10b981" /> Basic Scores & Online Review
                            </li>
                        </ul>

                        <button
                            disabled={currentTier === 'free'}
                            style={{
                                width: '100%',
                                padding: '0.65rem',
                                borderRadius: '8px',
                                border: '1px solid var(--border, #e2e8f0)',
                                background: currentTier === 'free' ? 'var(--surface-hover, #f1f5f9)' : 'transparent',
                                color: currentTier === 'free' ? 'var(--text-muted, #64748b)' : 'var(--text-main, #0f172a)',
                                fontWeight: 600,
                                fontSize: '0.875rem',
                                cursor: currentTier === 'free' ? 'default' : 'pointer'
                            }}
                        >
                            {currentTier === 'free' ? 'Current Plan' : 'Downgrade to Free'}
                        </button>
                    </div>

                    {/* PRO TIER (Popular) */}
                    <div style={{
                        border: '2px solid var(--primary, #4f46e5)',
                        borderRadius: 'var(--radius-md, 12px)',
                        padding: '1.5rem',
                        display: 'flex',
                        flexDirection: 'column',
                        background: 'linear-gradient(180deg, rgba(79, 70, 229, 0.04) 0%, transparent 100%)',
                        position: 'relative',
                        boxShadow: '0 10px 25px -5px rgba(79, 70, 229, 0.15)'
                    }}>
                        <div style={{
                            position: 'absolute',
                            top: '-11px',
                            right: '1.25rem',
                            background: 'var(--primary, #4f46e5)',
                            color: 'white',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '9999px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                        }}>
                            Most Popular
                        </div>

                        <div style={{ marginBottom: '1rem' }}>
                            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--primary, #4f46e5)', textTransform: 'uppercase' }}>
                                🥈 Pro Plan
                            </span>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem', marginTop: '0.5rem' }}>
                                <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--primary, #4f46e5)' }}>
                                    {currency === 'INR'
                                        ? (billingCycle === 'annual' ? '₹166' : '₹299')
                                        : (billingCycle === 'annual' ? '$6.58' : '$9.99')
                                    }
                                </span>
                                <span style={{ color: 'var(--text-muted, #64748b)', fontSize: '0.82rem' }}>
                                    / mo {billingCycle === 'annual' && '(billed annually)'}
                                </span>
                            </div>
                            <p style={{ margin: '0.4rem 0 0', fontSize: '0.82rem', color: 'var(--text-muted, #64748b)' }}>
                                {currency === 'INR'
                                    ? (billingCycle === 'annual' ? '₹1,999 / year — Less than 1 tuition class!' : 'Flexible monthly plan')
                                    : (billingCycle === 'annual' ? '$79 / year — Save $40 vs monthly' : 'Flexible monthly plan')
                                }
                            </p>
                        </div>

                        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1.5rem 0', display: 'flex', flexDirection: 'column', gap: '0.65rem', flex: 1, fontSize: '0.84rem' }}>
                            <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Zap size={16} color="var(--primary, #4f46e5)" /> <strong>Unlimited Daily Tests</strong>
                            </li>
                            <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Users size={16} color="var(--primary, #4f46e5)" /> <strong>Up to 3 Children</strong>
                            </li>
                            <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Check size={16} color="#10b981" /> <strong>Full Topic Mastery Analytics</strong>
                            </li>
                            <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Check size={16} color="#10b981" /> <strong>Weak Spot Diagnostic Alerts</strong>
                            </li>
                            <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Check size={16} color="#10b981" /> 5, 10, or 15 Question Tests
                            </li>
                            <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <FileCheck size={16} color="#10b981" /> Printable PDF Worksheets + Answers
                            </li>
                        </ul>

                        <button
                            onClick={() => handleSelectPlan('pro')}
                            disabled={isUpgrading || currentTier === 'pro'}
                            style={{
                                width: '100%',
                                padding: '0.75rem',
                                borderRadius: '8px',
                                border: 'none',
                                background: currentTier === 'pro' ? 'var(--surface-hover, #f1f5f9)' : 'linear-gradient(135deg, var(--primary, #4f46e5), #6366f1)',
                                color: currentTier === 'pro' ? 'var(--text-muted, #64748b)' : '#ffffff',
                                fontWeight: 700,
                                fontSize: '0.9rem',
                                cursor: currentTier === 'pro' ? 'default' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.4rem',
                                boxShadow: currentTier === 'pro' ? 'none' : '0 4px 12px rgba(79, 70, 229, 0.3)'
                            }}
                        >
                            {currentTier === 'pro' ? 'Current Plan' : isUpgrading ? 'Upgrading…' : <><Sparkles size={16} /> Upgrade to Pro</>}
                        </button>
                    </div>

                    {/* PREMIUM FAMILY TIER */}
                    <div style={{
                        border: '1px solid var(--border, #e2e8f0)',
                        borderRadius: 'var(--radius-md, 12px)',
                        padding: '1.5rem',
                        display: 'flex',
                        flexDirection: 'column',
                        background: 'var(--surface, #ffffff)',
                        position: 'relative'
                    }}>
                        <div style={{ marginBottom: '1rem' }}>
                            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#f59e0b', textTransform: 'uppercase' }}>
                                🥇 Premium (Family)
                            </span>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem', marginTop: '0.5rem' }}>
                                <span style={{ fontSize: '2rem', fontWeight: 700 }}>
                                    {currency === 'INR'
                                        ? (billingCycle === 'annual' ? '₹333' : '₹599')
                                        : (billingCycle === 'annual' ? '$12.42' : '$19.99')
                                    }
                                </span>
                                <span style={{ color: 'var(--text-muted, #64748b)', fontSize: '0.82rem' }}>
                                    / mo {billingCycle === 'annual' && '(billed annually)'}
                                </span>
                            </div>
                            <p style={{ margin: '0.4rem 0 0', fontSize: '0.82rem', color: 'var(--text-muted, #64748b)' }}>
                                {currency === 'INR'
                                    ? (billingCycle === 'annual' ? '₹3,999 / year for entire family' : 'Flexible monthly family plan')
                                    : (billingCycle === 'annual' ? '$149 / year for entire family' : 'Flexible monthly family plan')
                                }
                            </p>
                        </div>

                        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1.5rem 0', display: 'flex', flexDirection: 'column', gap: '0.65rem', flex: 1, fontSize: '0.84rem' }}>
                            <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Users size={16} color="#f59e0b" /> <strong>Unlimited Children</strong>
                            </li>
                            <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Zap size={16} color="#f59e0b" /> <strong>Priority Fast AI Generation</strong>
                            </li>
                            <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Check size={16} color="#10b981" /> Everything in Pro included
                            </li>
                            <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Check size={16} color="#10b981" /> <strong>Dual Parent Accounts (Mom & Dad)</strong>
                            </li>
                            <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <BookOpen size={16} color="#10b981" /> Exportable Monthly Report Cards
                            </li>
                            <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <ShieldCheck size={16} color="#10b981" /> Dedicated Priority Support
                            </li>
                        </ul>

                        <button
                            onClick={() => handleSelectPlan('premium')}
                            disabled={isUpgrading || currentTier === 'premium'}
                            style={{
                                width: '100%',
                                padding: '0.75rem',
                                borderRadius: '8px',
                                border: '1px solid #f59e0b',
                                background: currentTier === 'premium' ? 'var(--surface-hover, #f1f5f9)' : 'rgba(245, 158, 11, 0.1)',
                                color: currentTier === 'premium' ? 'var(--text-muted, #64748b)' : '#b45309',
                                fontWeight: 700,
                                fontSize: '0.9rem',
                                cursor: currentTier === 'premium' ? 'default' : 'pointer'
                            }}
                        >
                            {currentTier === 'premium' ? 'Current Plan' : isUpgrading ? 'Upgrading…' : 'Upgrade to Family Premium'}
                        </button>
                    </div>

                </div>

                {/* Footer Assurance */}
                <div style={{
                    padding: '0.85rem 2rem',
                    background: 'var(--surface-hover, #f8fafc)',
                    borderTop: '1px solid var(--border, #e2e8f0)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '0.78rem',
                    color: 'var(--text-muted, #64748b)',
                    flexWrap: 'wrap',
                    gap: '0.5rem'
                }}>
                    <span>🔒 Safe & Secure checkout • Cancel anytime with 1-click</span>
                    <span>Accepted: UPI, Cards, NetBanking, Google Pay</span>
                </div>

            </div>
        </div>
    );
};

export default UpgradeModal;
