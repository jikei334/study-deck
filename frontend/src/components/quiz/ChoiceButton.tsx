export type ChoiceState = 'default' | 'selected-correct' | 'selected-wrong' | 'correct' | 'disabled';

interface Props {
  text: string;
  state: ChoiceState;
  onClick?: () => void;
}

const stateStyles: Record<ChoiceState, string> = {
  default: 'border-gray-300 bg-white hover:border-blue-400 hover:bg-blue-50 cursor-pointer text-gray-800',
  'selected-correct': 'border-green-500 bg-green-50 text-green-800 font-semibold cursor-default',
  'selected-wrong': 'border-red-500 bg-red-50 text-red-800 font-semibold cursor-default',
  correct: 'border-green-400 bg-green-50 text-green-700 cursor-default',
  disabled: 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed',
};

const stateIcon: Record<ChoiceState, string> = {
  default: '',
  'selected-correct': '✓ ',
  'selected-wrong': '✗ ',
  correct: '✓ ',
  disabled: '',
};

export default function ChoiceButton({ text, state, onClick }: Props) {
  return (
    <button
      className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all duration-150 ${stateStyles[state]}`}
      onClick={state === 'default' ? onClick : undefined}
    >
      <span className="font-medium">{stateIcon[state]}</span>{text}
    </button>
  );
}
