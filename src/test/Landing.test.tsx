import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Landing from '../pages/Landing';

const renderLanding = () =>
  render(
    <MemoryRouter>
      <Landing />
    </MemoryRouter>
  );

describe('Landing page', () => {
  it('renders the main hero heading', () => {
    renderLanding();
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toBeInTheDocument();
    expect(h1).toHaveTextContent(/AI-Powered/i);
  });

  it('renders "Home Tutor" text inside the h1', () => {
    renderLanding();
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(within(h1).getByText(/Home Tutor/i)).toBeInTheDocument();
  });

  it('renders the marketing tagline', () => {
    renderLanding();
    expect(screen.getByText(/Upload homework/i)).toBeInTheDocument();
  });

  it('renders "Start for Free" call-to-action link pointing to /login', () => {
    renderLanding();
    const cta = screen.getByRole('link', { name: /start for free/i });
    expect(cta).toBeInTheDocument();
    expect(cta).toHaveAttribute('href', '/login');
  });

  it('renders the "Effortless Uploads" feature card', () => {
    renderLanding();
    expect(screen.getByRole('heading', { name: /Effortless Uploads/i })).toBeInTheDocument();
  });

  it('renders the "AI Test Generation" feature card', () => {
    renderLanding();
    expect(screen.getByRole('heading', { name: /AI Test Generation/i })).toBeInTheDocument();
  });

  it('renders the "Track Progress" feature card', () => {
    renderLanding();
    expect(screen.getByRole('heading', { name: /Track Progress/i })).toBeInTheDocument();
  });
});
