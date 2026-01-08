
import React, { useState, useMemo } from 'react';
import { GermanWord, Gender } from '../types';

interface FlashcardSessionProps {
  words: GermanWord[];
  onFinish: (updatedWords: GermanWord[]) => void;
  onUpdateWord: (id: string, updatedFields: Partial<GermanWord>) => void;
}

const getGenderColor = (gender: Gender) => {
  switch (gender) {
    case 'der': return 'text-blue-600';
    case 'die': return 'text-red-600';
    case 'das': return 'text-green-600';
    default: return 'text-slate-400';
  }
};

const FlashcardSession: React.FC<FlashcardSessionProps> = ({ words, onFinish, onUpdateWord }) => {
  // Logic lọc từ: 
  // 1. Tìm các từ chưa thuộc (Mastery < 100)
  // 2. Nếu có, chỉ hiện những từ đó và xếp từ mới nhất (createdAt cao nhất) lên đầu
  // 3. Nếu không còn từ nào chưa thuộc, hiện toàn bộ từ và xáo trộn ngẫu nhiên
  const getInitialSessionWords = (allWords: GermanWord[]) => {
    const unmastered = allWords.filter(w => (w.masteryLevel || 0) < 100);
    
    if (unmastered.length > 0) {
      // Sắp xếp: Từ mới thêm vào (createdAt lớn hơn) sẽ hiện trước
      return [...unmastered].sort((a, b) => b.createdAt - a.createdAt);
    }
    
    // Nếu đã thuộc hết (tất cả >= 100), xáo trộn ngẫu nhiên để ôn tập
    return [...allWords].sort(() => Math.random() - 0.5);
  };

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [sessionWords, setSessionWords] = useState(() => getInitialSessionWords(words));
  const [isFinished, setIsFinished] = useState(false);

  // Xác định mode hiện tại để hiển thị giao diện
  const isReviewMode = useMemo(() => {
    return words.every(w => (w.masteryLevel || 0) >= 100);
  }, [words]);

  const currentWord = sessionWords[currentIndex];

  const handleRestart = () => {
    const nextSession = getInitialSessionWords(words);
    setSessionWords(nextSession);
    setCurrentIndex(0);
    setIsFlipped(false);
    setIsFinished(false);
  };

  const handleNext = (masteryDelta: number) => {
    if (!currentWord) return;

    // Cập nhật mastery
    const newMastery = Math.max(0, Math.min(120, (currentWord.masteryLevel || 0) + masteryDelta));
    onUpdateWord(currentWord.id, { masteryLevel: newMastery });

    // Cập nhật list tạm thời trong session
    const updatedSessionWords = sessionWords.map((w, idx) => {
      if (idx === currentIndex) {
        return { ...w, masteryLevel: newMastery };
      }
      return w;
    });
    setSessionWords(updatedSessionWords);

    if (currentIndex < sessionWords.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setIsFlipped(false);
    } else {
      setIsFinished(true);
      onFinish(updatedSessionWords);
    }
  };

  if (isFinished) {
    return (
      <div className="max-w-xl mx-auto py-20 text-center animate-in zoom-in-95 duration-500">
        <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-4xl mx-auto mb-6 shadow-lg shadow-green-100 animate-bounce">✨</div>
        <h2 className="text-3xl font-black text-slate-800 mb-2">Hoàn thành!</h2>
        <p className="text-slate-500 mb-10">
          {isReviewMode 
            ? "Bạn đã hoàn thành một lượt ôn tập các từ cũ." 
            : "Bạn đã học xong các từ mới/chưa thuộc. Tiến độ đã được lưu."}
        </p>
        <div className="flex flex-col gap-3">
          <button 
            onClick={handleRestart}
            className="px-10 py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 uppercase tracking-widest text-sm"
          >
            {isReviewMode ? "Tiếp tục ôn tập (Ngẫu nhiên)" : "Học tiếp các từ còn lại"}
          </button>
        </div>
      </div>
    );
  }

  if (!currentWord) return (
    <div className="text-center py-20 flex flex-col items-center">
      <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center text-3xl mb-4">📭</div>
      <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Thư viện của bạn đang trống</p>
      <p className="text-slate-400 text-sm mt-2">Hãy tra cứu từ vựng mới để bắt đầu học.</p>
    </div>
  );

  return (
    <div className="max-w-xl mx-auto py-10 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex justify-between items-center mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-xl font-bold text-slate-800">Chế độ Học thuộc</h2>
            <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-tighter ${isReviewMode ? 'bg-amber-100 text-amber-600 border border-amber-200' : 'bg-indigo-100 text-indigo-600 border border-indigo-200'}`}>
              {isReviewMode ? '🔄 Ôn tập từ cũ' : '✨ Học từ mới/chưa thuộc'}
            </span>
          </div>
          <p className="text-xs text-slate-400 font-medium">
            {isReviewMode 
              ? "Hiện các từ cũ theo trình tự ngẫu nhiên." 
              : "Đang ưu tiên các từ bạn chưa thuộc và từ mới tra cứu."}
          </p>
        </div>
        <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-bold">
          {currentIndex + 1} / {sessionWords.length}
        </span>
      </div>

      <div className="perspective-1000 w-full h-[400px] relative cursor-pointer" onClick={() => setIsFlipped(!isFlipped)}>
        <div className={`relative w-full h-full transition-transform duration-500 transform-style-3d ${isFlipped ? 'rotate-y-180' : ''}`}>
          
          <div className="absolute inset-0 backface-hidden bg-white border-2 border-slate-200 rounded-3xl shadow-xl flex flex-col items-center justify-center p-8 text-center">
            <span className={`text-[10px] font-black uppercase tracking-widest mb-4 px-3 py-1 rounded-full bg-slate-50 border border-slate-100 ${getGenderColor(currentWord.gender)}`}>
              {currentWord.gender !== 'none' ? currentWord.gender : (currentWord.partOfSpeech || 'German')}
            </span>
            <h3 className="text-5xl font-black text-slate-800 break-all px-4">{currentWord.word}</h3>
            
            {currentWord.ipa && (
              <p className="mt-2 text-indigo-400 font-mono text-sm">[{currentWord.ipa}]</p>
            )}

            <div className="mt-12 flex flex-col items-center gap-2">
               <div className="flex gap-1">
                 {[...Array(5)].map((_, i) => (
                   <div key={i} className={`w-2 h-2 rounded-full ${i < ((currentWord.masteryLevel || 0) / 20) ? 'bg-indigo-500' : 'bg-slate-200'}`} />
                 ))}
               </div>
               <p className="text-slate-400 text-[10px] font-black uppercase tracking-tighter">Độ thuộc: {Math.min(100, currentWord.masteryLevel || 0)}%</p>
            </div>
            <p className="absolute bottom-8 text-slate-300 text-[10px] font-black uppercase tracking-widest animate-pulse">Chạm để lật thẻ</p>
          </div>

          <div className="absolute inset-0 backface-hidden bg-white border-2 border-indigo-500 rounded-3xl shadow-xl flex flex-col items-center justify-center p-8 rotate-y-180 overflow-y-auto">
            <h3 className="text-3xl font-black text-slate-800 mb-2">{currentWord.meaning}</h3>
            <p className="text-indigo-500 font-medium mb-6">({currentWord.partOfSpeech})</p>
            
            {currentWord.verbForms && (
              <div className="mb-6 grid grid-cols-2 gap-4 w-full px-4">
                <div className="text-center p-3 bg-indigo-50 rounded-2xl border border-indigo-100">
                  <p className="text-[10px] font-bold text-indigo-400 uppercase mb-1">Präteritum</p>
                  <p className="text-sm font-black text-indigo-900">{currentWord.verbForms.praeteritum}</p>
                </div>
                <div className="text-center p-3 bg-indigo-50 rounded-2xl border border-indigo-100">
                  <p className="text-[10px] font-bold text-indigo-400 uppercase mb-1">Partizip II</p>
                  <p className="text-sm font-black text-indigo-900">{currentWord.verbForms.partizipII}</p>
                </div>
              </div>
            )}

            {currentWord.examples && currentWord.examples.length > 0 && (
              <div className="w-full bg-slate-50 p-5 rounded-2xl border-l-4 border-indigo-500 text-left">
                <p className="text-sm font-bold text-slate-800 mb-1 leading-relaxed">{currentWord.examples[0]?.german}</p>
                <p className="text-xs text-slate-500 italic">{currentWord.examples[0]?.vietnamese}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={`mt-10 grid grid-cols-2 gap-4 transition-all duration-300 ${isFlipped ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
        <button 
          onClick={(e) => { e.stopPropagation(); handleNext(-15); }}
          className="group flex flex-col items-center justify-center py-4 px-6 bg-white text-red-500 rounded-2xl font-bold border-2 border-red-100 hover:bg-red-50 transition-all shadow-sm hover:shadow-md"
        >
          <span className="text-2xl mb-1 group-hover:scale-125 transition-transform">🤔</span>
          <span className="text-xs uppercase tracking-widest font-black">Cần xem lại</span>
        </button>
        <button 
          onClick={(e) => { e.stopPropagation(); handleNext(34); }}
          className="group flex flex-col items-center justify-center py-4 px-6 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all"
        >
          <span className="text-2xl mb-1 group-hover:scale-125 transition-transform">✅</span>
          <span className="text-xs uppercase tracking-widest font-black">Đã thuộc</span>
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
