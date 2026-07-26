import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider, useToast } from '../contexts/ToastContext';

function ToastTrigger({ message, type }: { message: string; type?: 'success' | 'error' }) {
  const { showToast } = useToast();
  return <button onClick={() => showToast(message, type)}>show</button>;
}

describe('ToastContext', () => {
  it('showToast でエラートーストが表示される', async () => {
    render(
      <ToastProvider>
        <ToastTrigger message="エラーが発生しました" type="error" />
      </ToastProvider>
    );
    await userEvent.click(screen.getByText('show'));
    expect(screen.getByText('エラーが発生しました')).toBeInTheDocument();
  });

  it('showToast で成功トーストが表示される', async () => {
    render(
      <ToastProvider>
        <ToastTrigger message="保存しました" type="success" />
      </ToastProvider>
    );
    await userEvent.click(screen.getByText('show'));
    expect(screen.getByText('保存しました')).toBeInTheDocument();
  });

  it('ToastProvider 外で useToast を呼ぶとエラーになる', () => {
    function BadComponent() {
      useToast();
      return null;
    }
    expect(() => render(<BadComponent />)).toThrow(
      'useToast は ToastProvider 内で使用してください'
    );
  });

  it('type を省略するとデフォルトで error トーストが表示される', async () => {
    render(
      <ToastProvider>
        <ToastTrigger message="デフォルトエラー" />
      </ToastProvider>
    );
    await userEvent.click(screen.getByText('show'));
    const toast = screen.getByText('デフォルトエラー');
    expect(toast).toHaveClass('bg-red-500');
  });
});
