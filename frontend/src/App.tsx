import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ToastProvider } from './contexts/ToastContext';
import ExamSelectPage from './pages/ExamSelectPage';
import DashboardPage from './pages/DashboardPage';
import QuizSetupPage from './pages/QuizSetupPage';
import QuizSessionPage from './pages/QuizSessionPage';
import QuizResultPage from './pages/QuizResultPage';
import TermsPage from './pages/TermsPage';
import AdminPage from './pages/AdminPage';

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <Routes>
          <Route path="/" element={<ExamSelectPage />} />
          <Route path="/exams/:examId" element={<DashboardPage />} />
          <Route path="/exams/:examId/quiz" element={<QuizSetupPage />} />
          <Route path="/quiz/sessions/:sessionId" element={<QuizSessionPage />} />
          <Route path="/quiz/sessions/:sessionId/result" element={<QuizResultPage />} />
          <Route path="/exams/:examId/terms" element={<TermsPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Routes>
      </ToastProvider>
    </BrowserRouter>
  );
}
