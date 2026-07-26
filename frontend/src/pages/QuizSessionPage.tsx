import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchQuizSession, submitAnswer, completeQuizSession } from '../api/quiz';
import { useToast } from '../contexts/ToastContext';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ProgressBar from '../components/quiz/ProgressBar';
import QuizCard from '../components/quiz/QuizCard';
import type { QuizSession, AnswerResult } from '../types';

export default function QuizSessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [session, setSession] = useState<QuizSession | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedChoiceId, setSelectedChoiceId] = useState<number | null>(null);
  const [answerResult, setAnswerResult] = useState<AnswerResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [answering, setAnswering] = useState(false);
  const [completing, setCompleting] = useState(false);

  const id = Number(sessionId);

  useEffect(() => {
    fetchQuizSession(id)
      .then(setSession)
      .catch((e: Error) => { showToast(e.message); navigate('/'); })
      .finally(() => setLoading(false));
  }, [sessionId]);

  async function handleAnswer(choiceId: number) {
    if (!session || answering || selectedChoiceId !== null) return;
    setAnswering(true);
    setSelectedChoiceId(choiceId);
    try {
      const result = await submitAnswer(id, session.questions[currentIndex].id, choiceId);
      setAnswerResult(result);
    } catch (e) {
      showToast((e as Error).message);
      setSelectedChoiceId(null);
    } finally {
      setAnswering(false);
    }
  }

  async function handleNext() {
    if (!session) return;
    const isLast = currentIndex === session.questions.length - 1;
    if (isLast) {
      setCompleting(true);
      try {
        await completeQuizSession(id);
        navigate(`/quiz/sessions/${id}/result`);
      } catch (e) {
        showToast((e as Error).message);
        setCompleting(false);
      }
    } else {
      setCurrentIndex((i) => i + 1);
      setSelectedChoiceId(null);
      setAnswerResult(null);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <LoadingSpinner />
      </div>
    );
  }

  if (!session || session.questions.length === 0) return null;

  const question = session.questions[currentIndex];
  const isLast = currentIndex === session.questions.length - 1;
  const answered = selectedChoiceId !== null && answerResult !== null;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-2xl mx-auto px-6 py-10 space-y-6">
        <ProgressBar current={currentIndex + 1} total={session.questions.length} />

        <QuizCard
          question={question}
          selectedChoiceId={selectedChoiceId}
          answerResult={answerResult}
          onAnswer={handleAnswer}
        />

        {answered && (
          <button
            onClick={handleNext}
            disabled={completing}
            className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {completing ? '完了中...' : isLast ? '結果を見る' : '次の問題'}
          </button>
        )}
      </main>
    </div>
  );
}

function Header() {
  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <h1 className="text-2xl font-bold text-blue-600 tracking-tight">study-deck</h1>
    </header>
  );
}
