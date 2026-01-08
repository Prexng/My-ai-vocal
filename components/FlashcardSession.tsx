
import React, { useState } from 'react';
import { GermanWord, Gender } from '../types';

interface FlashcardSessionProps {
  words: GermanWord[];
  onFinish: (updatedWords: GermanWord[]) => void;
}

const getGenderColor = (gender: Gender) => {
  switch (gender) {
    case 'der': return 'text-blue-600';
    case 'die': return 'text-red-600';
    case 'das': return 'text-green-600';
    default: return 'text-slate-400';
  }
};

const FlashcardSession: React.FC<FlashcardSessionProps> = ({ words, onFinish }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [sessionWords, setSessionWords] = useState([...words].sort(() => Math.random() - 0.5));

  const currentWord = sessionWords[currentIndex];

  const handleNext = (masteryDelta: number) => {
    const updatedWords = sessionWords.map((w, idx) => {
      if (idx === currentIndex) {
        return { ...w, masteryLevel: Math.max(0, Math.min(100, w.masteryLevel + masteryDelta)) };
      }
      return w;
    });
    setSessionWords(updatedWords);

    if (currentIndex < sessionWords.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setIsFlipped(false);
    } else {
      onFinish(updatedWords);
    }
  };

  return (
    <div className="max-w-xl mx-auto py-10">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-xl font-bold text-slate-800">Chế độ học thuộc</h2>
        <span className="text-slate-500 font-medium">{currentIndex + 1} / {sessionWords.length} từ</span>
      </div>

      <div className="perspective-1000 w-full h-[400px] relative cursor-pointer" onClick={() => setIsFlipped(!isFlipped)}>
        <div className={`relative w-full h-full transition-transform duration-500 transform-style-3d ${isFlipped ? 'rotate-y-180' : ''}`}>
          
          {/* Front Side */}
          <div className="absolute inset-0 backface-hidden bg-white border-2 border-slate-200 rounded-3xl shadow-xl flex flex-col items-center justify-center p-8">
            <span className={`text-xs font-black uppercase tracking-widest mb-2 ${getGenderColor(currentWord.gender)}`}>
              {currentWord.gender !== 'none' ? currentWord.gender : (currentWord.partOfSpeech || 'German')}
            </span>
            <h3 className="text-5xl font-black text-slate-800 text-center">{currentWord.word}</h3>
            <p className="mt-4 text-slate-400 text-sm font-medium">Nhấn để xem nghĩa</p>
          </div>

          {/* Back Side */}
          <div className="absolute inset-0 backface-hidden bg-white border-2 border-indigo-500 rounded-3xl shadow-xl flex flex-col items-center justify-center p-8 rotate-y-180">
            <h3 className="text-3xl font-bold text-slate-800 mb-2">{currentWord.meaning}</h3>
            <p className="text-slate-500 mb-4 italic">{currentWord.partOfSpeech}</p>
            
            {currentWord.verbForms && (
              <div className="mb-4 text-center">
                <p className="text-xs font-bold text-indigo-400 uppercase mb-1">Dạng quá khứ</p>
                <p className="text-sm font-bold text-indigo-900">
                  {currentWord.verbForms.praeteritum} | {currentWord.verbForms.partizipII}
                </p>
              </div>
            )}

            <div className="w-full bg-slate-50 p-4 rounded-xl border-l-4 border-indigo-400 text-center">
              <p className="text-sm font-bold text-slate-800">{currentWord.examples[0]?.german}</p>
              <p className="text-xs text-slate-500 italic">{currentWord.examples[0]?.vietnamese}</p>
            </div>
          </div>
        </div>
      </div>

      <div className={`mt-10 grid grid-cols-2 gap-4 transition-opacity duration-300 ${isFlipped ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <button 
          onClick={(e) => { e.stopPropagation(); handleNext(-5); }}
          className="flex items-center justify-center gap-2 py-4 px-6 bg-red-50 text-red-600 rounded-2xl font-bold border-2 border-red-100 hover:bg-red-100 transition-colors"
        >
          <span>✕</span> Cần xem lại
        </button>
        <button 
          onClick={(e) => { e.stopPropagation(); handleNext(15); }}
          className="flex items-center justify-center gap-2 py-4 px-6 bg-green-50 text-green-600 rounded-2xl font-bold border-2 border-green-100 hover:bg-green-100 transition-colors"
        >
          <span>✓</span> Đã thuộc
        </button>
      </div>

      <style>{`
        .perspective-1000 { perspective: 1000px; }
        .transform-style-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
        .rotate-y-180 { transform: rotateY(180deg); }
      `}</style>
    </div>
  );
};

export default FlashcardSession;
