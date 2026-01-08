
import React, { useState, useEffect } from 'react';
import { GermanWord } from '../types';
import { generateSpeech } from '../services/geminiService';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';

interface ListeningSessionProps {
  words: GermanWord[];
}

const ListeningSession: React.FC<ListeningSessionProps> = ({ words }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [userInput, setUserInput] = useState('');
  const [mode, setMode] = useState<'word' | 'sentence'>('word');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'none', msg: string }>({ type: 'none', msg: '' });
  const [speakingFeedback, setSpeakingFeedback] = useState<{ type: 'success' | 'error' | 'none', msg: string }>({ type: 'none', msg: '' });
  const [sessionWords, setSessionWords] = useState<GermanWord[]>([]);
  const [showTranscript, setShowTranscript] = useState(false);

  const { isListening, startListening } = useSpeechRecognition('de-DE');

  useEffect(() => {
    setSessionWords([...words].sort(() => Math.random() - 0.5));
  }, [words]);

  const currentWord = sessionWords[currentIndex];
  if (!currentWord) return null;

  const currentText = mode === 'word' ? currentWord.word : currentWord.examples[0]?.german || currentWord.word;

  const playAudio = async (text: string) => {
    if (isPlaying) return;
    setIsPlaying(true);
    try {
      const audioData = await generateSpeech(text);
      if (!audioData) return;
      
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const binaryString = atob(audioData);
      const dataInt16 = new Int16Array(new Uint8Array(binaryString.length).map((_, i) => binaryString.charCodeAt(i)).buffer);
      const buffer = audioCtx.createBuffer(1, dataInt16.length, 24000);
      const channelData = buffer.getChannelData(0);
      for (let i = 0; i < dataInt16.length; i++) {
        channelData[i] = dataInt16[i] / 32768.0;
      }

      const source = audioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(audioCtx.destination);
      source.onended = () => setIsPlaying(false);
      source.start();
    } catch (err) {
      console.error(err);
      setIsPlaying(false);
    }
  };

  const checkWriting = () => {
    const cleanInput = userInput.trim().toLowerCase().replace(/[.,!?]/g, '');
    const cleanTarget = currentText.toLowerCase().replace(/[.,!?]/g, '');
    
    if (cleanInput === cleanTarget) {
      setFeedback({ type: 'success', msg: 'Chính xác! Bạn đã nghe rất tốt.' });
      setShowTranscript(true);
    } else {
      setFeedback({ type: 'error', msg: `Chưa đúng rồi. Hãy nghe lại cẩn thận!` });
    }
  };

  const handleSpeechCheck = () => {
    startListening((transcript) => {
      const cleanTranscript = transcript.trim().toLowerCase().replace(/[.,!?]/g, '');
      const cleanTarget = currentText.toLowerCase().replace(/[.,!?]/g, '');
      
      // Kiểm tra độ tương đồng cơ bản
      if (cleanTranscript.includes(cleanTarget) || cleanTarget.includes(cleanTranscript) || cleanTranscript.split(' ').some(w => cleanTarget.includes(w))) {
        setSpeakingFeedback({ type: 'success', msg: `Khá tốt! Bạn phát âm: "${transcript}"` });
      } else {
        setSpeakingFeedback({ type: 'error', msg: `Bạn phát âm: "${transcript}". Thử lại nhé!` });
      }
    });
  };

  const handleNext = () => {
    setUserInput('');
    setFeedback({ type: 'none', msg: '' });
    setSpeakingFeedback({ type: 'none', msg: '' });
    setShowTranscript(false);
    // Random mode cho câu tiếp theo
    setMode(Math.random() > 0.5 ? 'sentence' : 'word');

    if (currentIndex < sessionWords.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setCurrentIndex(0);
      setSessionWords([...words].sort(() => Math.random() - 0.5));
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Luyện Nghe & Nói</h2>
        <p className="text-slate-500">
          Chế độ hiện tại: <span className="text-indigo-600 font-bold uppercase">{mode === 'word' ? 'Từ vựng' : 'Câu ví dụ'}</span>
        </p>
      </div>

      <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 flex flex-col items-center gap-6">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => playAudio(currentText)}
            disabled={isPlaying}
            className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${isPlaying ? 'bg-indigo-100 text-indigo-600 scale-110 shadow-inner' : 'bg-indigo-600 text-white shadow-xl shadow-indigo-100 hover:scale-105 hover:bg-indigo-700'}`}
          >
            <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M3 9v6c0 1.1.9 2 2 2h3l4.5 4.5c.3.3.8.1.8-.4v-18c0-.5-.5-.7-.8-.4L8 7H5c-1.1 0-2 .9-2 2zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
          </button>
          
          <button 
            onClick={() => setShowTranscript(!showTranscript)}
            className="p-3 rounded-xl bg-slate-50 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-all border border-slate-100"
            title="Xem nội dung"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
          </button>
        </div>

        {showTranscript && (
          <div className="text-center animate-in zoom-in-95 duration-200">
            <p className="text-2xl font-black text-indigo-600 mb-1">{currentText}</p>
            {mode === 'sentence' && <p className="text-slate-500 italic">{currentWord.examples[0]?.vietnamese}</p>}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <span className="p-1.5 bg-cyan-100 text-cyan-600 rounded-lg"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg></span>
            Luyện viết
          </h3>
          <textarea 
            rows={2}
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            placeholder={`Viết lại ${mode === 'word' ? 'từ' : 'câu'} bạn vừa nghe...`}
            className="w-full px-4 py-3 rounded-xl border-2 border-slate-100 focus:border-indigo-500 outline-none transition-all resize-none"
          />
          <button 
            onClick={checkWriting}
            className="w-full py-3 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-900 transition-all active:scale-95"
          >
            Kiểm tra văn bản
          </button>
          {feedback.type !== 'none' && (
            <div className={`text-sm font-medium p-3 rounded-lg flex gap-2 ${feedback.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
              <span className="text-lg">{feedback.type === 'success' ? '✨' : '🧐'}</span>
              <p>{feedback.msg}</p>
            </div>
          )}
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 text-center">
          <h3 className="font-bold text-slate-800 flex items-center gap-2 text-left">
            <span className="p-1.5 bg-amber-100 text-amber-600 rounded-lg"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/></svg></span>
            Luyện phát âm
          </h3>
          <div className="flex flex-col items-center py-2">
            <button 
              onClick={handleSpeechCheck}
              disabled={isListening}
              className={`p-6 rounded-full transition-all shadow-lg ${isListening ? 'bg-red-500 text-white animate-pulse ring-4 ring-red-100' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/></svg>
            </button>
            <p className="mt-4 text-xs text-slate-400 font-bold uppercase tracking-widest">{isListening ? 'Hãy nói ngay...' : 'Nhấn mic và đọc to'}</p>
          </div>
          {speakingFeedback.type !== 'none' && (
            <div className={`text-sm font-medium p-3 rounded-lg flex gap-2 text-left ${speakingFeedback.type === 'success' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'bg-amber-50 text-amber-700 border border-amber-100'}`}>
              <span className="text-lg">{speakingFeedback.type === 'success' ? '🎧' : '💡'}</span>
              <p>{speakingFeedback.msg}</p>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-center pt-6">
        <button 
          onClick={handleNext}
          className="px-12 py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-xl shadow-indigo-100 hover:bg-indigo-700 hover:-translate-y-1 transition-all flex items-center gap-2 active:translate-y-0"
        >
          Tiếp tục từ khác
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3"/></svg>
        </button>
      </div>
    </div>
  );
};

export default ListeningSession;
