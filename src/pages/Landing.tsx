import { Link } from 'react-router-dom';
import { ArrowRight, Brain, Upload, LineChart } from 'lucide-react';

const Landing = () => {
    return (
        <div className="container animate-fade-in">
            <section style={{ textAlign: 'center', padding: 'clamp(2rem, 5vw, 4rem) 0', maxWidth: '800px', margin: '0 auto' }}>
                <h1 style={{ fontSize: 'clamp(2.1rem, 6vw, 3.5rem)', marginBottom: '1.25rem', lineHeight: 1.15 }}>
                    The AI-Powered <span style={{ color: 'var(--primary)' }}>Home Tutor</span> for Your Child
                </h1>
                <p style={{ fontSize: 'clamp(1rem, 2.5vw, 1.25rem)', color: 'var(--text-muted)', marginBottom: '2rem', padding: '0 0.5rem' }}>
                    Upload homework. Generate custom tests. Track progress automatically. Give your child the personalized learning experience they deserve.
                </p>
                <div className="flex justify-center gap-4">
                    <Link to="/login" className="btn btn-primary" style={{ fontSize: '1.05rem', padding: '0.85rem 1.85rem', width: 'auto', minHeight: '48px' }}>
                        Start for Free <ArrowRight size={18} />
                    </Link>
                </div>
            </section>

            <section style={{ padding: '1rem 0 3rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' }}>

                    <div className="card">
                        <div style={{ background: 'rgba(79, 70, 229, 0.1)', width: '44px', height: '44px', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem', color: 'var(--primary)' }}>
                            <Upload size={22} />
                        </div>
                        <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Effortless Uploads</h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Parents simply snap a picture with their phone or upload homework files.</p>
                    </div>

                    <div className="card">
                        <div style={{ background: 'rgba(16, 185, 129, 0.1)', width: '44px', height: '44px', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem', color: 'var(--secondary)' }}>
                            <Brain size={22} />
                        </div>
                        <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>AI Test Generation</h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Our engine parses the assignment and instantly generates similar practice tests to reinforce learning.</p>
                    </div>

                    <div className="card">
                        <div style={{ background: 'rgba(245, 158, 11, 0.1)', width: '44px', height: '44px', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem', color: '#f59e0b' }}>
                            <LineChart size={22} />
                        </div>
                        <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Track Progress</h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Detailed analytics and grading help you understand exactly where your child is improving.</p>
                    </div>

                </div>
            </section>
        </div>
    );
};

export default Landing;
