import { Link } from 'react-router-dom';
import { ArrowRight, Brain, Upload, LineChart } from 'lucide-react';

const Landing = () => {
    return (
        <div className="container animate-fade-in">
            <section style={{ textAlign: 'center', padding: '4rem 0', maxWidth: '800px', margin: '0 auto' }}>
                <h1 style={{ fontSize: '3.5rem', marginBottom: '1.5rem', lineHeight: 1.1 }}>
                    The AI-Powered <span style={{ color: 'var(--primary)' }}>Home Tutor</span> for Your Child
                </h1>
                <p style={{ fontSize: '1.25rem', color: 'var(--text-muted)', marginBottom: '2.5rem' }}>
                    Upload homework. Generate custom tests. Track progress automatically. Give your child the personalized learning experience they deserve.
                </p>
                <div className="flex justify-center gap-4">
                    <Link to="/login" className="btn btn-primary" style={{ fontSize: '1.125rem', padding: '1rem 2rem' }}>
                        Start for Free <ArrowRight size={20} />
                    </Link>
                </div>
            </section>

            <section style={{ padding: '4rem 0' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>

                    <div className="card">
                        <div style={{ background: 'rgba(79, 70, 229, 0.1)', width: '48px', height: '48px', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem', color: 'var(--primary)' }}>
                            <Upload size={24} />
                        </div>
                        <h3 style={{ fontSize: '1.5rem', marginBottom: '0.75rem' }}>Effortless Uploads</h3>
                        <p style={{ color: 'var(--text-muted)' }}>Parents simply snap a picture or upload the current school homework.</p>
                    </div>

                    <div className="card">
                        <div style={{ background: 'rgba(16, 185, 129, 0.1)', width: '48px', height: '48px', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem', color: 'var(--secondary)' }}>
                            <Brain size={24} />
                        </div>
                        <h3 style={{ fontSize: '1.5rem', marginBottom: '0.75rem' }}>AI Test Generation</h3>
                        <p style={{ color: 'var(--text-muted)' }}>Our engine parses the assignment and instantly generates similar practice tests to reinforce learning.</p>
                    </div>

                    <div className="card">
                        <div style={{ background: 'rgba(245, 158, 11, 0.1)', width: '48px', height: '48px', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem', color: '#f59e0b' }}>
                            <LineChart size={24} />
                        </div>
                        <h3 style={{ fontSize: '1.5rem', marginBottom: '0.75rem' }}>Track Progress</h3>
                        <p style={{ color: 'var(--text-muted)' }}>Detailed analytics and grading help you understand exactly where your child is improving.</p>
                    </div>

                </div>
            </section>
        </div>
    );
};

export default Landing;
