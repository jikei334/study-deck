import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../App';

describe('App ルーティング', () => {
  it('ルートパス(/) で ExamSelectPage が表示される', () => {
    window.history.pushState({}, '', '/');
    render(<App />);
    expect(screen.getByText('ExamSelectPage')).toBeInTheDocument();
  });

  it('/admin で AdminPage が表示される', () => {
    window.history.pushState({}, '', '/admin');
    render(<App />);
    expect(screen.getByText('AdminPage')).toBeInTheDocument();
  });
});
