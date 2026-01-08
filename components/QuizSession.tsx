
import React, { useState, useEffect, useRef } from 'react';
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
  const [hasAttempted, setHasAttempted] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [sessionWordUpdates, setSessionWordUpdates] = useState<GermanWord[]>([...words]);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const { isListening, startListening } = useSpeechRecognition('de-DE');

  const initQuiz = async () => {
    setLoading(true);
    setIsFinished(false);
    setScore(0);
    setCurrentIndex(0);
    setSessionWordUpdates([...words]);
    try {
      const data = await generateQuiz(words);
      setQuestions(data);
    } catch (err) {
      console.error("Failed to load quiz", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    initQuiz();
  }, [words]);

  // Tự động focus vào ô nhập liệu khi chuyển câu
  useEffect(() => {
    if (!loading && !isFinished && inputRef.current) {
      inputRef.current.focus();
    }
  }, [currentIndex, loading, isFinished]);

  const canGoNext = isCorrect || revealAnswer;

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Chỉ xử lý Enter toàn cục nếu không đang focus vào input (input đã có handler riêng)
      if (e.key === 'Enter' && document.activeElement !== inputRef.current) {
        if (showFeedback && canGoNext) {
          handleNext();
        } else if (!showFeedback) {
          handleSubmit();
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [showFeedback, isCorrect, revealAnswer, currentIndex, questions.length]);

  const updateWordMastery = (wordId: string, correct: boolean) => {
    setSessionWordUpdates(prev => prev.map(w => {
      if (w.id === wordId) {
        // Chỉ cập nhật điểm mastery một lần duy nhất cho mỗi câu hỏi trong phiên này
        if (hasAttempted && !correct) return w; 
        
        const delta = correct ? 20 : -10;
        const newMastery = Math.max(0, Math.min(120, w.masteryLevel + delta));
        return { ...w, masteryLevel: newMastery };
      }
      return w;
    }));
  };

  const handleSubmit = (overrideInput?: string) => {
    const current = questions[currentIndex];
    const inputToTest = (overrideInput || userInput).trim();
    
    // Ngăn chặn kiểm tra nếu không có input (trừ khi là MCQ và đã chọn option)
    if (current.type === 'write' && !inputToTest && !overrideInput) return;
    if (current.type === 'mcq' && !selectedOption && !overrideInput) return;

    let correct = false;

    if (current.type === 'mcq') {
      correct = (overrideInput || selectedOption) === current.correctAnswer;
    } else {
      const cleanInput = inputToTest.toLowerCase();
      const cleanAnswer = current.correctAnswer.toLowerCase();
      
      // Kiểm tra chính xác mạo từ nếu có
      if (current.correctAnswer.includes('der ') || current.correctAnswer.includes('die ') || current.correctAnswer.includes('das ')) {
         correct = inputToTest === current.correctAnswer;
      } else {
         correct = cleanInput === cleanAnswer;
      }
    }

    setIsCorrect(correct);
    setShowFeedback(true);

    if (correct) {
      if (!hasAttempted) {
        setScore(s => s + 1);
        updateWordMastery(current.wordId, true);
      }
      setRevealAnswer(true); 
    } else {
      if (!hasAttempted) {
        updateWordMastery(current.wordId, false);
      }
      setHasAttempted(true);
    }
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
    setIsCorrect(false);
    setUserInput('');
    setSelectedOption(null);
    setHasAttempted(false);
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(c => c + 1);
    } else {
      setIsFinished(true);
      onFinish(score, sessionWordUpdates);
    }
  };

  const handleInputChange = (val: string) => {
    setUserInput(val);
    // Khi người dùng bắt đầu "viết lại" (sai và sửa), ẩn feedback để họ chuẩn bị nhấn Enter lần nữa
    if (showFeedback && !isCorrect) {
      setShowFeedback(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
        <p className="text-slate-500 font-medium">AI đang thiết kế bài kiểm tra cho bạn...</p>
      </div>
    );
  }

  if (isFinished) {
    const percentage = Math.round((score / questions.length) * 100);
    return (
      <div className="max-w-2xl mx-auto py-16 animate-in zoom-in-95 duration-500 text-center">
        <div className="relative inline-block mb-8">
          <svg className="w-32 h-32 transform -rotate-90">
            <circle cx="64" cy="64" r="60" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-100" />
            <circle cx="64" cy="64" r="60" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray={377} strokeDashoffset={377 - (377 * percentage) / 100} className="text-indigo-600 transition-all duration-1000 ease-out" />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center flex-col">
            <span className="text-2xl font-black text-slate-800">{score}/{questions.length}</span>
            <span className="text-[10px] font-bold text-slate-400 uppercase">Điểm</span>
          </div>
        </div>
        
        <h2 className="text-3xl font-black text-slate-800 mb-2">Bài luyện tập hoàn tất!</h2>
        <p className="text-slate-500 mb-8">Dựa trên kết quả này, AI đã điều chỉnh độ ưu tiên cho các từ vựng của bạn.</p>

        <div className="bg-slate-50 rounded-3xl p-6 mb-10 text-left border border-slate-100">
           <p className="text-xs font-black uppercase text-slate-400 tracking-widest mb-4">Cập nhật độ thuộc từ vựng</p>
           <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {questions.map((q, idx) => {
                 const word = sessionWordUpdates.find(w => w.id === q.wordId);
                 if (!word) return null;
                 return (
                   <div key={idx} className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
                      <span className="font-bold text-slate-700">{word.word}</span>
                      <div className="flex items-center gap-2">
                         <div className="w-16 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-indigo-500 h-full" style={{ width: `${Math.min(100, word.masteryLevel)}%` }} />
                         </div>
                         <span className="text-[10px] font-black text-indigo-600">{Math.min(100, word.masteryLevel)}%</span>
                      </div>
                   </div>
                 );
              })}
           </div>
        </div>
        
        <div className="flex flex-col items-center gap-4">
          <button 
            onClick={initQuiz}
            className="px-10 py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 uppercase tracking-widest text-sm w-full max-sm"
          >
            Làm bài mới (AI chọn từ khác)
          </button>
        </div>
      </div>
    );
  }

  const current = questions[currentIndex];

  return (
    <div className="max-w-2xl mx-auto animate-in fade-in duration-500">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Luyện tập AI Thông minh</h2>
          <p className="text-xs text-slate-400 font-medium">
            {canGoNext ? "Nhấn Enter để sang câu tiếp theo" : "Nhập câu trả lời và nhấn Enter"}
          </p>
        </div>
        <span className="bg-indigo-50 text-indigo-600 px-4 py-1 rounded-full text-xs font-black border border-indigo-100">
          CÂU {currentIndex + 1} / {questions.length}
        </span>
      </div>

      <div className="w-full bg-slate-200 h-2 rounded-full mb-8 overflow-hidden">
        <div 
          className="bg-indigo-600 h-full transition-all duration-700 ease-out"
          style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
        />
      </div>

      <div className="bg-white p-8 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100">
        <p className="text-2xl font-black mb-4 text-center text-slate-800 leading-tight">{current.question}</p>
        
        {current.hint && !showFeedback && (
          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-3 mb-8 flex items-center justify-center gap-2 animate-in fade-in">
            <span className="text-amber-500">💡</span>
            <p className="text-xs text-amber-700 font-bold uppercase tracking-widest italic">Gợi ý: {current.hint}</p>
          </div>
        )}

        {current.type === 'mcq' ? (
          <div className="grid grid-cols-1 gap-3">
            {current.options?.map((opt, i) => (
              <button
                key={i}
                disabled={canGoNext}
                onClick={() => {
                  setSelectedOption(opt);
                  if (showFeedback && !isCorrect) setShowFeedback(false);
                }}
                className={`p-5 rounded-2xl text-left border-2 transition-all font-bold ${
                  selectedOption === opt 
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700' 
                    : 'border-slate-50 hover:border-indigo-200 bg-slate-50 text-slate-700'
                } ${revealAnswer && opt === current.correctAnswer ? 'border-green-500 bg-green-50 ring-4 ring-green-100' : ''}
                  ${showFeedback && !isCorrect && selectedOption === opt ? 'border-red-400 bg-red-50' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <span>{opt}</span>
                  {revealAnswer && opt === current.correctAnswer && <span className="text-green-600">✓</span>}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-4 relative">
            <input
              ref={inputRef}
              type="text"
              autoFocus
              disabled={canGoNext}
              value={userInput}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder="Gõ câu trả lời của bạn..."
              className={`w-full pl-6 pr-14 py-5 text-xl font-bold border-2 rounded-2xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 transition-all outline-none 
                ${showFeedback && !isCorrect ? 'border-red-200 bg-red-50' : 'border-slate-100 bg-slate-50'}
                ${isCorrect ? 'border-green-500 bg-green-50 text-green-700' : ''}`}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (canGoNext) {
                    handleNext();
                  } else {
                    handleSubmit();
                  }
                }
              }}
            />
            {!canGoNext && (
              <button 
                type="button"
                onClick={handleMicClick}
                className={`absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-xl transition-all ${isListening ? 'bg-red-500 text-white animate-pulse' : 'text-slate-400 hover:text-indigo-600'}`}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
              </button>
            )}
          </div>
        )}

        {showFeedback && (
          <div className={`mt-8 p-6 rounded-2xl animate-in slide-in-from-bottom-4 duration-300 ${isCorrect ? 'bg-green-50 text-green-800 border-2 border-green-100' : 'bg-red-50 text-red-800 border-2 border-red-100'}`}>
            <div className="flex items-center gap-4">
              <span className="text-4xl">{isCorrect ? '🎉' : '🤔'}</span>
              <div className="flex-1">
                <p className="text-lg font-black">{isCorrect ? 'CHÍNH XÁC!' : 'CỐ GẮNG LÊN'}</p>
                {revealAnswer ? (
                  <p className="mt-2 text-sm font-medium">
                    Đáp án đúng: <span className="font-black bg-white px-3 py-1 rounded-lg shadow-sm border border-slate-200 ml-1">{current.correctAnswer}</span>
                  </p>
                ) : (
                  <p className="mt-1 text-sm opacity-80">
                    {isCorrect ? "Bạn đã làm rất tốt." : "Câu trả lời chưa đúng, hãy thử nhập lại hoặc xem đáp án."}
                  </p>
                )}
                {canGoNext && <p className="mt-3 text-[10px] font-black uppercase tracking-widest opacity-60 italic">Nhấn Enter để tiếp tục</p>}
              </div>
            </div>
          </div>
        )}

        <div className="mt-10 flex items-center justify-between gap-4">
           {showFeedback && !isCorrect && !revealAnswer && (
              <button 
                onClick={() => {
                  setRevealAnswer(true);
                  setShowFeedback(true);
                }}
                className="px-6 py-4 bg-amber-100 text-amber-700 rounded-2xl font-black text-xs uppercase tracking-widest transition-all hover:bg-amber-200 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                Xem đáp án
              </button>
            )}
            
            <div className="flex-1"></div>
            
          {!canGoNext ? (
            <button
              disabled={current.type === 'mcq' ? !selectedOption : !userInput.trim()}
              onClick={() => handleSubmit()}
              className="px-10 py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-xl shadow-indigo-100 hover:bg-indigo-700 disabled:opacity-30 transition-all active:scale-95 uppercase tracking-widest text-sm"
            >
              Kiểm tra
            </button>
          ) : (
            <button
              onClick={handleNext}
              className="px-10 py-4 bg-slate-800 text-white rounded-2xl font-black shadow-xl shadow-slate-200 transition-all active:scale-95 flex items-center gap-2 uppercase tracking-widest text-sm"
            >
              {currentIndex < questions.length - 1 ? 'Câu tiếp theo' : 'Xem kết quả'}
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuizSession;
