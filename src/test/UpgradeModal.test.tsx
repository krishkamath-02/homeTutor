import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import UpgradeModal from '../components/UpgradeModal';

// Mock Supabase
vi.mock('../lib/supabase', () => ({
    supabase: {
        from: vi.fn(() => ({
            update: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ error: null })
            })
        }))
    }
}));

describe('UpgradeModal Component', () => {
    it('does not render when isOpen is false', () => {
        const { container } = render(<UpgradeModal isOpen={false} onClose={vi.fn()} />);
        expect(container).toBeEmptyDOMElement();
    });

    it('renders heading and all 3 subscription tiers when isOpen is true', () => {
        render(<UpgradeModal isOpen={true} onClose={vi.fn()} />);
        expect(screen.getByText(/Supercharge Your Child's Learning/i)).toBeInTheDocument();
        expect(screen.getByText(/Free Plan/i)).toBeInTheDocument();
        expect(screen.getByText(/Pro Plan/i)).toBeInTheDocument();
        expect(screen.getByText(/Premium \(Family\)/i)).toBeInTheDocument();
    });

    it('renders INR by default and switches to USD when clicked', () => {
        render(<UpgradeModal isOpen={true} onClose={vi.fn()} />);
        // Default INR
        expect(screen.getByText('₹0')).toBeInTheDocument();

        // Switch to USD
        const usdBtn = screen.getByRole('button', { name: /\$ USD/i });
        fireEvent.click(usdBtn);

        expect(screen.getByText('$0')).toBeInTheDocument();
    });

    it('displays daily limit warning when highlightReason is daily_limit', () => {
        render(<UpgradeModal isOpen={true} onClose={vi.fn()} highlightReason="daily_limit" />);
        expect(screen.getByText(/Daily Limit Reached/i)).toBeInTheDocument();
    });

    it('displays child limit warning when highlightReason is child_limit', () => {
        render(<UpgradeModal isOpen={true} onClose={vi.fn()} highlightReason="child_limit" />);
        expect(screen.getByText(/Child Limit Reached/i)).toBeInTheDocument();
    });

    it('calls onClose when close button is clicked', () => {
        const handleClose = vi.fn();
        render(<UpgradeModal isOpen={true} onClose={handleClose} />);
        const closeBtn = screen.getByLabelText(/close/i);
        fireEvent.click(closeBtn);
        expect(handleClose).toHaveBeenCalledOnce();
    });
});
