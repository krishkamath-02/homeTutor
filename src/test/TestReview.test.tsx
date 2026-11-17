import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TestReview from '../components/TestReview';
import type { Test } from '../store/appStore';

// ─── Sample test data ─────────────────────────────────────────────────────────
const MOCK_TEST: Test = {
  id: 'test-1',
  title: 'Science Quiz',
  subject: 'Science',
  duration: '10 mins',
  status: 'completed',
  score: 75,
  questions: [
    { id: 'q1', text: 'What is H2O?', options: ['Fire', 'Water', 'Earth', 'Air'], correctAnswerIndex: 1 },
    { id: 'q2', text: 'What is the sun?', options: ['Planet', 'Moon', 'Star', 'Comet'], correctAnswerIndex: 2 },
    { id: 'q3', text: 'What is gravity?', options: ['A push', 'A pull', 'A spin', 'A jump'], correctAnswerIndex: 1 },
    { id: 'q4', text: 'Plants produce?', options: ['Oil', 'Oxygen', 'Carbon dioxide', 'Nitrogen'], correctAnswerIndex: 1 },
  ],
  studentAnswers: {
    q1: 1,  // correct
    q2: 0,  // wrong (answered Planet, correct is Star)
    q3: 1,  // correct
    q4: 2,  // wrong (answered Carbon dioxide, correct is Oxygen)
  },
};

const mockOnClose = vi.fn();

const renderReview = (test = MOCK_TEST) =>
  render(<TestReview test={test} onClose={mockOnClose} />);

describe('TestReview', () => {
  it('renders the review heading with test title', () => {
    renderReview();
    expect(screen.getByText(/Review: Science Quiz/i)).toBeInTheDocument();
  });

  it('displays the score percentage', () => {
    renderReview();
    expect(screen.getByText(/Score: 75%/i)).toBeInTheDocument();
  });

  it('renders all questions', () => {
    renderReview();
    expect(screen.getByText(/What is H2O\?/)).toBeInTheDocument();
    expect(screen.getByText(/What is the sun\?/)).toBeInTheDocument();
    expect(screen.getByText(/What is gravity\?/)).toBeInTheDocument();
    expect(screen.getByText(/Plants produce\?/)).toBeInTheDocument();
  });

  it('renders all answer options for each question', () => {
    renderReview();
    expect(screen.getByText('Water')).toBeInTheDocument();
    expect(screen.getByText('Star')).toBeInTheDocument();
    expect(screen.getByText('Oxygen')).toBeInTheDocument();
  });

  it('shows "Correct Answer" badge next to the correct option', () => {
    renderReview();
    const correctBadges = screen.getAllByText(/Correct Answer/i);
    // 4 questions, each has a correct answer badge
    expect(correctBadges).toHaveLength(4);
  });

  it('shows "Your Answer" badge next to the student\'s wrong selections', () => {
    renderReview();
    const yourAnswerBadges = screen.getAllByText(/Your Answer/i);
    // q2 and q4 were answered wrongly
    expect(yourAnswerBadges).toHaveLength(2);
  });

  it('does NOT show "Your Answer" badge for correctly answered questions', () => {
    renderReview();
    // q1 and q3 correct — their chosen option should NOT show "Your Answer"
    // We verify by count above (only 2 wrong answers)
    const yourAnswerBadges = screen.getAllByText(/Your Answer/i);
    expect(yourAnswerBadges.length).toBe(2);
  });

  it('calls onClose when the back button is clicked', async () => {
    renderReview();
    // The back button is the ArrowLeft icon button
    const backButton = screen.getByRole('button');
    await userEvent.click(backButton);
    expect(mockOnClose).toHaveBeenCalledOnce();
  });

  it('renders question numbers correctly (1-indexed)', () => {
    renderReview();
    expect(screen.getByText(/1\. What is H2O\?/)).toBeInTheDocument();
    expect(screen.getByText(/4\. Plants produce\?/)).toBeInTheDocument();
  });

  it('handles undefined studentAnswers gracefully (no crash)', () => {
    const testNoAnswers: Test = { ...MOCK_TEST, studentAnswers: undefined };
    expect(() => renderReview(testNoAnswers)).not.toThrow();
  });

  it('renders retroactive rough work upload section when roughWorkEvaluation is absent', () => {
    renderReview();
    expect(screen.getByText(/Evaluate Handwritten Scratch Work/i)).toBeInTheDocument();
    expect(screen.getByText(/Upload Rough Work/i)).toBeInTheDocument();
  });

  it('renders handwritten working analysis banner and step marks when roughWorkEvaluation is present', () => {
    const testWithRoughWork: Test = {
      ...MOCK_TEST,
      roughWorkUrl: 'https://example.com/rough_work.jpg',
      roughWorkEvaluation: {
        transcribedSummary: 'Student calculated 2x + 6 = 14 with intermediate steps.',
        overallFeedback: 'Clear logical structure and great method.',
        accuracyScore: 95,
        evaluatedAt: '2026-10-24T00:00:00.000Z',
        stepMarks: {
          q1: {
            questionNumber: 1,
            questionId: 'q1',
            methodMark: 1,
            calculationMark: 1,
            finalMark: 1,
            maxMarks: 3,
            transcribedSteps: ['Line 1: 2x = 8', 'Line 2: x = 4'],
            stepFeedback: 'Correct deduction.',
            identifiedErrorType: null
          }
        }
      }
    };

    renderReview(testWithRoughWork);

    expect(screen.getByText(/Paper-to-Digital Handwriting Evaluation/i)).toBeInTheDocument();
    expect(screen.getByText(/Step Accuracy:\s*95%/i)).toBeInTheDocument();
    expect(screen.getByText(/Student calculated 2x \+ 6 = 14 with intermediate steps\./i)).toBeInTheDocument();
    expect(screen.getByText(/Clear logical structure and great method\./i)).toBeInTheDocument();
    expect(screen.getByText(/Method: 1\/1/i)).toBeInTheDocument();
    expect(screen.getByText(/Calculation: 1\/1/i)).toBeInTheDocument();
    expect(screen.getByText(/Final: 1\/1/i)).toBeInTheDocument();
    expect(screen.getByText(/Line 1: 2x = 8/i)).toBeInTheDocument();
  });
});
