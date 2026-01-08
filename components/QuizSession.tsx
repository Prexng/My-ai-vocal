
import React, { useState, useEffect } from 'react';
import { QuizQuestion, GermanWord } from '../types';
import { generateQuiz } from '../services/geminiService';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';

interface QuizSessionProps {
  words: GermanWord[];
  onFinish: (score: number, updatedWords: GermanWord[]) => void;
}

const QuizSession: React.FC<QuizSessionProps> = ({ words, onFinish }) => {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [userInput, setUserInput] = useState('');
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [revealAnswer, setRevealAnswer] = useState(false);

  const { isListening, startListening } = useSpeechRecognition('de-DE');

  useEffect(() => {
    const initQuiz = async () => {
      try {
        const data = await generateQuiz(words);
        // Xáo trộn mảng câu hỏi để xuất hiện random
        const shuffledQuestions = [...data].sort(() => Math.random() - 0.5);
        setQuestions(shuffledQuestions);
      } catch (err) {
        console.error("Failed to load quiz", err);
      } finally {
        setLoading(false);
      }
    };
    initQuiz();
  }, [words]);

  const handleSubmit = (overrideInput?: string) => {
    const current = questions[currentIndex];
    const inputToTest = overrideInput || userInput;
    let correct = false;

    if (current.type === 'mcq') {
      correct = selectedOption === current.correctAnswer;
    } else {
      const cleanInput = inputToTest.trim().toLowerCase();
      const cleanAnswer = current.correctAnswer.toLowerCase();
      
      if (current.correctAnswer.includes('der ') || current.correctAnswer.includes('die ') || current.correctAnswer.includes('das ')) {
         correct = inputToTest.trim() === current.correctAnswer;
      } else {
         correct = cleanInput === cleanAnswer;
      }
    }

    setIsCorrect(correct);
    if (correct) {
      setScore(s => s + 1);
      setRevealAnswer(true); // Nếu đúng thì hiện luôn đáp án (feedback tích cực)
    }
    setShowFeedback(true);
  };

  const handleMicClick = () => {
    startListening((transcript) => {
      setUserInput(transcript);
      handleSubmit(transcript);
    });
  };

  const handleNext = () => {
    setShowFeedback(false);
    setRevealAnswer(false);
    setUserInput('');
    setSelectedOption(null);
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(c => c + 1);
    } else {
      onFinish(score, words);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
        <p className="text-slate-500 font-medium">Đang soạn câu hỏi cho bạn...</p>
      </div>
    );
  }

  if (questions.length === 0) {
    return <div className="text-center py-20">Không thể tạo quiz. Hãy thử lại sau.</div>;
  }

  const current = questions[currentIndex];

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8 flex justify-between items-center">
        <h2 className="text-xl font-bold text-slate-800">Ôn tập từ vựng</h2>
        <span className="text-slate-500 font-medium">Câu {currentIndex + 1} / {questions.length}</span>
      </div>

      <div className="w-full bg-slate-200 h-2 rounded-full mb-8 overflow-hidden">
        <div 
          className="bg-indigo-600 h-full transition-all duration-300"
          style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
        />
      </div>

      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
        <p className="text-xl font-semibold mb-2 text-center">{current.question}</p>
        {current.hint && (
          <p className="text-sm text-amber-600 text-center mb-8 italic">Gợi ý: {current.hint}</p>
        )}

        {current.type === 'mcq' ? (
          <div className="grid grid-cols-1 gap-3">
            {current.options?.map((opt, i) => (
              <button
                key={i}
                disabled={showFeedback}
                onClick={() => setSelectedOption(opt)}
                className={`p-4 rounded-xl text-left border-2 transition-all ${
                  selectedOption === opt 
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700' 
                    : 'border-slate-100 hover:border-indigo-200 text-slate-700'
                } ${revealAnswer && opt === current.correctAnswer ? 'border-green-500 bg-green-50 ring-2 ring-green-100' : ''}`}
              >
                {opt}
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-4 relative">
            <input
              type="text"
              autoFocus
              disabled={showFeedback}
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder="Nhập hoặc nhấn mic để trả lời..."
              className={`w-full pl-4 pr-14 py-4 text-lg border-2 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all outline-none ${showFeedback && !isCorrect ? 'border-red-200 bg-red-50' : 'border-slate-200'}`}
              onKeyDown={(e) => e.key === 'Enter' && userInput && handleSubmit()}
            />
            {!showFeedback && (
              <button 
                type="button"
                onClick={handleMicClick}
                className={`absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-xl transition-all ${isListening ? 'bg-red-500 text-white animate-pulse' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'}`}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
              </button>
            )}
          </div>
        )}

        {showFeedback && (
          <div className={`mt-6 p-4 rounded-xl animate-in fade-in slide-in-from-top-2 duration-300 ${isCorrect ? 'bg-green-100 text-green-800' : 'bg-red-50 text-red-800 border border-red-100'}`}>
            <div className="flex items-center gap-3">
              <span className="text-2xl">{isCorrect ? '✅' : '❌'}</span>
              <div className="flex-1">
                <p className="font-bold">{isCorrect ? 'Chính xác!' : 'Sai rồi! Bạn có muốn thử lại không?'}</p>
                {revealAnswer && (
                  <p className="mt-1">Đáp án đúng: <span className="font-mono bg-white px-2 py-0.5 rounded shadow-sm border border-slate-200">{current.correctAnswer}</span></p>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="mt-8 flex items-center justify-between gap-4">
           {showFeedback && !isCorrect && !revealAnswer && (
              <button 
                onClick={() => setRevealAnswer(true)}
                className="text-indigo-600 hover:text-indigo-800 font-bold text-sm transition-colors flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                Hiện đáp án
              </button>
            )}
            {showFeedback && !isCorrect && (
              <button 
                onClick={() => { setShowFeedback(false); setUserInput(''); }}
                className="text-slate-500 hover:text-slate-800 font-bold text-sm transition-colors"
              >
                Thử lại
              </button>
            )}
            <div className="flex-1"></div>
          {!showFeedback ? (
            <button
              disabled={current.type === 'mcq' ? !selectedOption : !userInput}
              onClick={() => handleSubmit()}
              className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-50 shadow-lg shadow-indigo-100 transition-all active:scale-95"
            >
              Kiểm tra
            </button>
          ) : (
            <button
              onClick={handleNext}
              className="px-8 py-3 bg-slate-800 text-white rounded-xl font-semibold hover:bg-slate-900 shadow-lg shadow-slate-200 transition-all active:scale-95"
            >
              {currentIndex < questions.length - 1 ? 'Tiếp tục' : 'Kết quả'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuizSession;
