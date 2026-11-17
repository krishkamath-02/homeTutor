import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PrintableTest from '../components/PrintableTest';
import type { Test } from '../store/appStore';

const MOCK_PRINT_TEST: Test = {
  id: 'test-print-123',
  title: 'Algebra Foundations',
  subject: 'Mathematics',
  duration: '30 mins',
  status: 'pending',
  questions: [
    {
      id: 'q1',
      text: 'Solve for x: 3x - 5 = 10',
      options: ['3', '5', '7', '15'],
      correctAnswerIndex: 1,
      topic: 'Linear Equations',
      explanation: 'Add 5 to both sides to get 3x = 15, then divide by 3 to get x = 5.'
    },
    {
      id: 'q2',
      text: 'What is the square root of 81?',
      options: ['7', '8', '9', '11'],
      correctAnswerIndex: 2,
      topic: 'Exponents & Roots',
      explanation: '9 * 9 = 81, so sqrt(81) = 9.'
    }
  ]
};

describe('PrintableTest Component (Worksheet Generator)', () => {
  it('renders exam header with board, grade level, and reference code', () => {
    render(
      <PrintableTest
        test={MOCK_PRINT_TEST}
        curriculumBoard="ICSE"
        gradeLevel={7}
      />
    );

    expect(screen.getByText(/ICSE • Grade 7/i)).toBeInTheDocument();
    expect(screen.getByText(/REF: HT-TEST-PRI/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: /Algebra Foundations/i })).toBeInTheDocument();
    expect(screen.getByText(/Subject: Mathematics • Duration: 30 mins • Maximum Marks: 6/i)).toBeInTheDocument();
  });

  it('renders student metadata lines for Name, Date, and Roll Number', () => {
    render(<PrintableTest test={MOCK_PRINT_TEST} />);

    expect(screen.getByText(/Student Name:/i)).toBeInTheDocument();
    expect(screen.getByText(/Date:/i)).toBeInTheDocument();
    expect(screen.getByText(/Roll No:/i)).toBeInTheDocument();
  });

  it('renders exam instructions and working space boxes for rough work', () => {
    render(<PrintableTest test={MOCK_PRINT_TEST} includeWorkingSpace={true} />);

    expect(screen.getByText(/INSTRUCTIONS FOR THE STUDENT:/i)).toBeInTheDocument();
    expect(screen.getByText(/Show all calculations & scratch steps in the designated working box/i)).toBeInTheDocument();

    const roughWorkBoxes = screen.getAllByText(/Show Working Steps & Rough Calculations Here/i);
    expect(roughWorkBoxes).toHaveLength(2);
  });

  it('can hide working space boxes when includeWorkingSpace is false', () => {
    render(<PrintableTest test={MOCK_PRINT_TEST} includeWorkingSpace={false} />);

    expect(screen.queryByText(/Show Working Steps & Rough Calculations Here/i)).not.toBeInTheDocument();
  });

  it('renders all questions and multiple choice options with letter prefixes', () => {
    render(<PrintableTest test={MOCK_PRINT_TEST} />);

    expect(screen.getByText(/Q1\. Solve for x: 3x - 5 = 10/i)).toBeInTheDocument();
    expect(screen.getByText(/Q2\. What is the square root of 81\?/i)).toBeInTheDocument();

    // Check letter options across questions
    expect(screen.getAllByText(/A\./i)).toHaveLength(2);
    expect(screen.getAllByText(/B\./i)).toHaveLength(2);
  });

  it('renders detachable answer key with step-by-step solutions', () => {
    render(<PrintableTest test={MOCK_PRINT_TEST} includeAnswerKey={true} />);

    expect(screen.getByText(/Teacher & Parent Answer Key: Algebra Foundations/i)).toBeInTheDocument();
    expect(screen.getByText(/Detach before handing worksheet to student/i)).toBeInTheDocument();
    expect(screen.getByText(/Q1\. Correct Answer: Option \(B\) – 5/i)).toBeInTheDocument();
    expect(screen.getByText(/Add 5 to both sides to get 3x = 15/i)).toBeInTheDocument();
    expect(screen.getByText(/Topic: Linear Equations/i)).toBeInTheDocument();
  });

  it('can omit answer key when includeAnswerKey is false', () => {
    render(<PrintableTest test={MOCK_PRINT_TEST} includeAnswerKey={false} />);

    expect(screen.queryByText(/Teacher & Parent Answer Key/i)).not.toBeInTheDocument();
  });
});
