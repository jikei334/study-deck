import ChoiceButton from './ChoiceButton';
import type { ChoiceState } from './ChoiceButton';
import type { AnswerResult, QuizSessionQuestion } from '../../types';

interface Props {
  question: QuizSessionQuestion;
  selectedChoiceId: number | null;
  answerResult: AnswerResult | null;
  onAnswer: (choiceId: number) => void;
}

function choiceState(
  choiceId: number,
  selectedChoiceId: number | null,
  answerResult: AnswerResult | null
): ChoiceState {
  if (!answerResult || selectedChoiceId === null) return 'default';
  if (choiceId === selectedChoiceId) {
    return answerResult.isCorrect ? 'selected-correct' : 'selected-wrong';
  }
  if (choiceId === answerResult.correctChoiceId) return 'correct';
  return 'disabled';
}

export default function QuizCard({ question, selectedChoiceId, answerResult, onAnswer }: Props) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
      <p className="text-base font-medium text-gray-900 leading-relaxed whitespace-pre-wrap">
        {question.text}
      </p>
      <div className="space-y-2">
        {question.choices.map((choice) => (
          <ChoiceButton
            key={choice.id}
            text={choice.text}
            state={choiceState(choice.id, selectedChoiceId, answerResult)}
            onClick={() => onAnswer(choice.id)}
          />
        ))}
      </div>
      {answerResult && (
        <div className={`mt-4 p-4 rounded-lg text-sm ${answerResult.isCorrect ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
          <p className="font-semibold mb-1">{answerResult.isCorrect ? '正解！' : '不正解'}</p>
          {answerResult.questionExplanation && (
            <p className="text-gray-700">{answerResult.questionExplanation}</p>
          )}
          {!answerResult.isCorrect && (
            <div className="mt-2 space-y-1">
              {answerResult.choices.map((c) => c.isCorrect && (
                <p key={c.id} className="text-green-700">
                  <span className="font-medium">正解: </span>{c.text}
                  {c.explanation && <span className="ml-1 text-gray-600">— {c.explanation}</span>}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
