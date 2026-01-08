
import React, { useState, useEffect, useRef } from 'react';
import { GermanWord } from '../types';
import { generateDictationText } from '../services/geminiService';
import { playGermanAudio } from '../services/audioService';

interface DictationSessionProps {
  words: GermanWord[];
}

type Difficulty = 'easy' | 'medium' | 'hard';

const DictationSession: React.FC<DictationSessionProps> = ({ words }) => {
  const [fullText, setFullText] = useState('');
  const [sentences, setSentences] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userInput, setUserInput] = useState('');
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'none', msg: string }>({ type: 'none', msg: '' });
  const [loading, setLoading] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [showAnswer, setShowAnswer] = useState(false);
  const [wordFeedbacks, setWordFeedbacks] = useState<{word: string, isCorrect: boolean}[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const splitIntoSentences = (text: string) => {
    return text.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0);
  };

  const handleGenerateAI = async (diff: Difficulty) => {
    setLoading(true);
    setDifficulty(diff);
    try {
      const text = await generateDictationText(words, diff);
      setFullText(text);
      setSentences(splitIntoSentences(text));
      setCurrentIndex(0);
      setUserInput('');
      setFeedback({ type: 'none', msg: '' });
      setWordFeedbacks([]);
      setShowAnswer(false);
      setIsFinished(false);
    } catch (err) {
      alert("Không thể tạo văn bản AI.");
    } finally {
      setLoading(false);
    }
  };

  const handlePlay = () => {
    if (!sentences[currentIndex]) return;
    playGermanAudio(
      sentences[currentIndex],
      () => setIsAudioPlaying(true),
      () => setIsAudioPlaying(false)
    );
  };

  // Làm sạch chuỗi triệt để để so sánh (loại bỏ dấu câu, mạo từ thừa, khoảng trắng)
  const normalize = (str: string) => {
    return str
      .toLowerCase()
      .trim()
      .replace(/[.,!?;:"'«»„“()]/g, '') // Xóa dấu câu
      .replace(/\s+/g, ' '); // Chuẩn hóa khoảng trắng
  };

  const moveToNextSentence = () => {
    if (currentIndex < sentences.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setUserInput('');
      setFeedback({ type: 'none', msg: '' });
      setWordFeedbacks([]);
      setShowAnswer(false);
    } else {
      setIsFinished(true);
    }
  };

  const checkSentence = () => {
    const targetText = sentences[currentIndex];
    const targetNorm = normalize(targetText);
    const inputNorm = normalize(userInput);

    const targetWords = targetNorm.split(' ');
    const inputWords = userInput.trim().split(/\s+/);
    
    const analysis = inputWords.map(word => {
      const normWord = normalize(word);
      return {
        word: word,
        isCorrect: targetWords.includes(normWord)
      };
    });
    setWordFeedbacks(analysis);

    if (targetNorm === inputNorm) {
      setFeedback({ type: 'success', msg: 'Chính xác! Bạn có thể chuyển sang câu tiếp theo.' });
    } else {
      setFeedback({ type: 'error', msg: 'Có một số lỗi sai hoặc thiếu từ. Hãy kiểm tra lại những từ màu đỏ!' });
    }
  };

  useEffect(() => {
    if (sentences.length > 0 && !isFinished) {
      handlePlay();
    }
  }, [currentIndex, sentences]);

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="text-center">
        <h2 className="text-3xl font-black text-slate-800 mb-2">Luyện nghe chép chính tả</h2>
        <p className="text-slate-500">Chế độ AI giúp bạn làm quen với ngữ điệu và cấu trúc câu.</p>
      </div>

      {!fullText ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(['easy', 'medium', 'hard'] as Difficulty[]).map((level) => (
              <button
                key={level}
                onClick={() => handleGenerateAI(level)}
                disabled={loading}
                className={`p-6 rounded-3xl border-2 transition-all flex flex-col items-center gap-3 shadow-sm hover:shadow-md ${
                  level === 'easy' ? 'bg-green-50 border-green-100 text-green-700' :
                  level === 'medium' ? 'bg-indigo-50 border-indigo-100 text-indigo-700' :
                  'bg-red-50 border-red-100 text-red-700'
                }`}
              >
                <span className="text-3xl">
                  {level === 'easy' ? '🌱' : level === 'medium' ? '🚀' : '🔥'}
                </span>
                <div className="text-center">
                  <p className="font-black uppercase tracking-widest text-[10px] mb-1">
                    {level === 'easy' ? 'Dễ' : level === 'medium' ? 'Vừa' : 'Khó'}
                  </p>
                  <p className="text-xs opacity-70">Cấp độ: {level}</p>
                </div>
              </button>
            ))}
          </div>
          
          {loading && (
            <div className="text-center animate-pulse flex flex-col items-center">
              <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
              <p className="text-indigo-600 font-bold">AI đang soạn nội dung dựa trên từ vựng bạn đã thuộc...</p>
            </div>
          )}
        </div>
      ) : isFinished ? (
        <div className="bg-white p-10 rounded-3xl border-2 border-green-100 shadow-xl text-center space-y-6">
          <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-4xl mx-auto animate-bounce">🏆</div>
          <h3 className="text-3xl font-black text-slate-800">Hoàn thành bài tập!</h3>
          <p className="text-slate-600">Bạn đã hoàn thành đoạn văn cấp độ {difficulty}.</p>
          <div className="p-6 bg-slate-50 rounded-2xl text-left italic text-slate-700 border border-slate-100">
            {fullText}
          </div>
          <button 
            onClick={() => { setFullText(''); setSentences([]); setIsFinished(false); }}
            className="px-10 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg"
          >
            Làm bài mới
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex justify-between items-center px-2">
             <div className="flex items-center gap-3">
               <span className="text-[10px] font-black uppercase px-3 py-1 rounded-full border bg-indigo-50 text-indigo-600 border-indigo-100">
                 Câu {currentIndex + 1} / {sentences.length}
               </span>
               <button onClick={() => setFullText('')} className="text-[10px] text-slate-400 hover:text-red-500 font-black uppercase tracking-widest">Thoát</button>
             </div>
             <div className="flex-1 max-w-[200px] h-2 bg-slate-200 rounded-full ml-4 overflow-hidden">
                <div 
                  className="h-full bg-indigo-500 transition-all duration-500"
                  style={{ width: `${((currentIndex + 1) / sentences.length) * 100}%` }}
                />
             </div>
          </div>

          <div className="bg-white p-8 rounded-3xl border-2 border-slate-100 shadow-sm space-y-6 flex flex-col items-center">
            <div className="flex items-center gap-4">
              <button 
                onClick={handlePlay}
                disabled={isAudioPlaying}
                className={`w-24 h-24 rounded-full flex items-center justify-center transition-all ${isAudioPlaying ? 'bg-indigo-100 text-indigo-600 scale-110 shadow-inner' : 'bg-indigo-600 text-white shadow-xl shadow-indigo-100 hover:scale-105 hover:bg-indigo-700'}`}
              >
                <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 24 24"><path d="M3 9v6c0 1.1.9 2 2 2h3l4.5 4.5c.3.3.8.1.8-.4v-18c0-.5-.5-.7-.8-.4L8 7H5c-1.1 0-2 .9-2 2zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>
              </button>
              <button 
                onClick={() => setShowAnswer(!showAnswer)}
                className={`p-4 rounded-2xl transition-all border ${showAnswer ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-slate-50 text-slate-400 border-slate-200 hover:text-indigo-600 hover:bg-indigo-50'}`}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
              </button>
            </div>

            {showAnswer && (
              <div className="w-full p-4 bg-amber-50 border border-amber-200 rounded-2xl text-center animate-in zoom-in-95">
                <p className="text-amber-800 font-bold">{sentences[currentIndex]}</p>
              </div>
            )}

            <div className="w-full space-y-4">
              <textarea 
                ref={inputRef}
                autoFocus
                value={userInput}
                onChange={(e) => {
                  setUserInput(e.target.value);
                  if (feedback.type !== 'none') setFeedback({type: 'none', msg: ''});
                }}
                placeholder="Nghe và gõ lại câu tiếng Đức..."
                className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 outline-none text-lg font-medium transition-all min-h-[140px] resize-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (feedback.type === 'success') moveToNextSentence();
                    else checkSentence();
                  }
                }}
              />
              
              {wordFeedbacks.length > 0 && (
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-wrap gap-x-2 gap-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase w-full mb-1">Kết quả so sánh:</span>
                  {wordFeedbacks.map((fb, i) => (
                    <span key={i} className={`text-lg font-medium ${fb.isCorrect ? 'text-slate-800' : 'text-red-500 underline decoration-red-300'}`}>
                      {fb.word}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="w-full flex gap-3">
              <button 
                onClick={checkSentence}
                disabled={!userInput.trim() || feedback.type === 'success'}
                className="flex-1 py-4 bg-slate-800 text-white rounded-2xl font-bold shadow-lg hover:bg-slate-900 transition-all active:scale-95 disabled:opacity-50"
              >
                Kiểm tra câu
              </button>
              
              {(feedback.type === 'success' || showAnswer) && (
                <button 
                  onClick={moveToNextSentence}
                  className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg hover:bg-indigo-700 transition-all animate-in slide-in-from-right-4"
                >
                  Câu tiếp theo →
                </button>
              )}
            </div>

            {feedback.type !== 'none' && (
              <div className={`w-full p-4 rounded-2xl flex items-start gap-3 animate-in slide-in-from-top-2 ${feedback.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                <span className="text-2xl mt-0.5">{feedback.type === 'success' ? '✅' : '❌'}</span>
                <p className="font-bold text-sm">{feedback.msg}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DictationSession;
