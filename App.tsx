
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AppTab, GermanWord, Gender } from './types';
import { lookupWord } from './services/geminiService';
import { syncFromSheets, saveToSheets } from './services/googleSheetsService';
import WordCard from './components/WordCard';
import QuizSession from './components/QuizSession';
import FlashcardSession from './components/FlashcardSession';
import ListeningSession from './components/ListeningSession';
import DictationSession from './components/DictationSession';
import { useSpeechRecognition } from './hooks/useSpeechRecognition';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LineChart, Line } from 'recharts';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AppTab>(AppTab.SEARCH);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GermanWord | null>(null);
  const [savedWords, setSavedWords] = useState<GermanWord[]>([]);
  const [showSavedToast, setShowSavedToast] = useState(false);
  const [finishedLearning, setFinishedLearning] = useState(false);
  
  // Google Sheets Config
  const [sheetsUrl, setSheetsUrl] = useState<string>(localStorage.getItem('gsheets_url') || '');
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(localStorage.getItem('last_sync_time'));

  const { isListening, startListening } = useSpeechRecognition('de-DE');
  const isInitialMount = useRef(true);

  // 1. Load Local Data
  useEffect(() => {
    const stored = localStorage.getItem('deutsch_words');
    if (stored) {
      try {
        setSavedWords(JSON.parse(stored));
      } catch (e) {
        console.error("Lỗi đọc dữ liệu local");
      }
    }
  }, []);

  // 2. Save Local Data
  useEffect(() => {
    if (!isInitialMount.current) {
      localStorage.setItem('deutsch_words', JSON.stringify(savedWords));
    }
    isInitialMount.current = false;
  }, [savedWords]);

  /**
   * ĐỒNG BỘ 2 CHIỀU THỰC SỰ:
   * 1. Pull: Lấy từ Sheets về.
   * 2. Merge: So sánh với local.
   * 3. Push: Gửi những từ local "mới" lên Sheets.
   */
  const handleSync = useCallback(async (forcedUrl?: string) => {
    const url = forcedUrl || sheetsUrl;
    if (!url) return;
    
    setIsSyncing(true);
    try {
      // BƯỚC 1: PULL (Lấy từ Sheets về)
      const remoteWords = await syncFromSheets(url);
      
      // BƯỚC 2: MERGE (Gộp dữ liệu)
      setSavedWords(localWords => {
        const merged = [...localWords];
        const pushQueue: GermanWord[] = [];

        // Kiểm tra từ remote có trong local chưa
        remoteWords.forEach(rw => {
          const localIdx = merged.findIndex(lw => lw.id === rw.id || lw.word.toLowerCase() === rw.word.toLowerCase());
          if (localIdx === -1) {
            merged.push(rw);
          } else {
            // Nếu có rồi, cập nhật mastery nếu remote cao hơn hoặc giữ nguyên
            merged[localIdx].masteryLevel = Math.max(merged[localIdx].masteryLevel, rw.masteryLevel || 0);
          }
        });

        // BƯỚC 3: PUSH (Tìm từ local chưa có trên remote để đẩy lên)
        localWords.forEach(lw => {
          const existsOnRemote = remoteWords.some(rw => rw.id === lw.id || rw.word.toLowerCase() === lw.word.toLowerCase());
          if (!existsOnRemote) {
            pushQueue.push(lw);
          }
        });

        // Thực thi đẩy lên (Async)
        if (pushQueue.length > 0) {
          console.log(`Đang đẩy ${pushQueue.length} từ mới lên Sheets...`);
          pushQueue.forEach(w => saveToSheets(url, 'ADD_WORD', w));
        }

        return merged.sort((a, b) => b.createdAt - a.createdAt);
      });

      const now = new Date().toLocaleTimeString();
      setLastSync(now);
      localStorage.setItem('last_sync_time', now);
    } catch (err) {
      console.error("Đồng bộ thất bại:", err);
    } finally {
      setIsSyncing(false);
    }
  }, [sheetsUrl]);

  // Tự động đồng bộ khi dán URL mới hoặc khởi động
  useEffect(() => {
    if (sheetsUrl && isInitialMount.current) {
      handleSync();
    }
  }, [sheetsUrl, handleSync]);

  const handleSearch = async (e?: React.FormEvent, overrideQuery?: string) => {
    if (e) e.preventDefault();
    const query = overrideQuery || searchQuery;
    if (!query.trim()) return;

    setLoading(true);
    setResult(null);
    setShowSavedToast(false);
    
    try {
      const data = await lookupWord(query);
      const newWord = data as GermanWord;
      setResult(newWord);

      setSavedWords(prev => {
        const isDuplicate = prev.some(w => w.word.toLowerCase() === newWord.word.toLowerCase());
        if (!isDuplicate) {
          setShowSavedToast(true);
          // Lưu lên Sheets lập tức
          if (sheetsUrl) {
            saveToSheets(sheetsUrl, 'ADD_WORD', newWord);
          }
          setTimeout(() => setShowSavedToast(false), 3000);
          return [newWord, ...prev];
        }
        return prev;
      });

      setSearchQuery('');
    } catch (err) {
      console.error(err);
      alert("Đã có lỗi xảy ra khi tra cứu.");
    } finally {
      setLoading(false);
    }
  };

  const handleMicClick = () => {
    startListening((transcript) => {
      setSearchQuery(transcript);
      handleSearch(undefined, transcript);
    });
  };

  const deleteWord = (id: string) => {
    if (confirm("Bạn có chắc chắn muốn xóa mục này không?")) {
      setSavedWords(prev => prev.filter(w => w.id !== id));
    }
  };

  const updateWord = (id: string, updatedFields: Partial<GermanWord>) => {
    setSavedWords(prev => {
      const updated = prev.map(w => w.id === id ? { ...w, ...updatedFields } : w);
      const targetWord = updated.find(w => w.id === id);
      if (targetWord && sheetsUrl && updatedFields.masteryLevel !== undefined) {
        saveToSheets(sheetsUrl, 'UPDATE_PROGRESS', {
          wordId: targetWord.id,
          word: targetWord.word,
          masteryLevel: targetWord.masteryLevel
        });
      }
      return updated;
    });
  };

  const handleSessionFinish = (updatedSessionWords: GermanWord[]) => {
    setSavedWords(prev => {
      const newWords = [...prev];
      updatedSessionWords.forEach(uw => {
        const idx = newWords.findIndex(w => w.id === uw.id);
        if (idx !== -1) {
          newWords[idx] = uw;
          if (sheetsUrl) {
            saveToSheets(sheetsUrl, 'UPDATE_PROGRESS', {
              wordId: uw.id,
              word: uw.word,
              masteryLevel: uw.masteryLevel
            });
          }
        }
      });
      return newWords;
    });
    setFinishedLearning(true);
  };

  const learnedWords = savedWords.filter(w => w.masteryLevel > 0);

  const categoryStats = [
    { name: 'Nouns', value: savedWords.filter(w => w.partOfSpeech.toLowerCase().includes('noun')).length, color: '#4f46e5' },
    { name: 'Verbs', value: savedWords.filter(w => w.partOfSpeech.toLowerCase().includes('verb')).length, color: '#06b6d4' },
    { name: 'Khác', value: savedWords.filter(w => !['noun', 'verb'].some(cat => w.partOfSpeech.toLowerCase().includes(cat))).length, color: '#f59e0b' },
  ];

  const getTimelineData = () => {
    const dates: Record<string, number> = {};
    const last7Days = [...Array(7)].map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toLocaleDateString();
    }).reverse();
    last7Days.forEach(date => dates[date] = 0);
    savedWords.forEach(w => {
      const date = new Date(w.createdAt).toLocaleDateString();
      if (dates.hasOwnProperty(date)) dates[date]++;
    });
    return Object.entries(dates).map(([date, count]) => ({ date: date.split('/')[0] + '/' + date.split('/')[1], count }));
  };

  const updateSheetsUrl = (url: string) => {
    setSheetsUrl(url);
    localStorage.setItem('gsheets_url', url);
  };

  const renderEmptyPractice = (msg: string) => (
    <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in zoom-in-95">
      <div className="w-24 h-24 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center text-4xl mb-6 border-2 border-amber-100">🔒</div>
      <h2 className="text-2xl font-black text-slate-800 mb-2">Chưa đủ dữ liệu</h2>
      <p className="text-slate-500 max-w-sm mb-8">{msg}</p>
      <button 
        onClick={() => setActiveTab(AppTab.LEARN)}
        className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all"
      >
        Đi tới phần Học thuộc ngay
      </button>
    </div>
  );

  return (
    <div className="min-h-screen pb-24 lg:pb-0 lg:pl-64 flex flex-col bg-slate-50 text-slate-900">
      <nav className="fixed left-0 top-0 bottom-0 w-64 bg-white border-r border-slate-200 hidden lg:flex flex-col p-6 z-50">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-xl">D</div>
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-cyan-500">DeutschMaster</h1>
        </div>
        <div className="space-y-1.5 flex-1 overflow-y-auto pr-2">
          <NavItem active={activeTab === AppTab.SEARCH} onClick={() => setActiveTab(AppTab.SEARCH)} icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>} label="Tra cứu AI" />
          <NavItem active={activeTab === AppTab.COLLECTION} onClick={() => setActiveTab(AppTab.COLLECTION)} icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.247 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>} label="Thư viện" />
          <NavItem active={activeTab === AppTab.LEARN} onClick={() => { setActiveTab(AppTab.LEARN); setFinishedLearning(false); }} icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>} label="Học thuộc" />
          {/* Fix: Removed non-existent setQuizScore(null) call */}
          <NavItem active={activeTab === AppTab.QUIZ} onClick={() => setActiveTab(AppTab.QUIZ)} icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.674a1 1 0 00.922-.617l2.104-5.145A1 1 0 0016.441 10h-2.104l.833-4.167A1 1 0 0014.204 4H9.796a1 1 0 00-.97 1.208l.833 4.167H7.559a1 1 0 00-.922 1.238l2.104 5.145A1 1 0 009.663 17z" /></svg>} label="Luyện tập AI" />
          <NavItem active={activeTab === AppTab.LISTENING} onClick={() => setActiveTab(AppTab.LISTENING)} icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>} label="Nghe & Nói" />
          <NavItem active={activeTab === AppTab.DICTATION} onClick={() => setActiveTab(AppTab.DICTATION)} icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>} label="Chép chính tả" />
          <NavItem active={activeTab === AppTab.STATS} onClick={() => setActiveTab(AppTab.STATS)} icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>} label="Thống kê" />
        </div>
        
        <div className="mt-auto pt-6 border-t border-slate-100">
           <div className={`p-4 rounded-2xl transition-all ${sheetsUrl ? 'bg-green-50' : 'bg-slate-50'}`}>
             <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Đã thuộc / Tổng</p>
             <div className="flex items-center gap-2 mb-2">
               <span className="text-xl font-black text-slate-800">{learnedWords.length}</span>
               <span className="text-slate-300">/</span>
               <span className="text-sm font-bold text-slate-400">{savedWords.length}</span>
             </div>
             <div className="w-full bg-slate-200 h-1 rounded-full overflow-hidden">
                <div className="bg-indigo-500 h-full" style={{ width: `${(learnedWords.length / Math.max(1, savedWords.length)) * 100}%` }}></div>
             </div>
           </div>
        </div>
      </nav>

      <main className="flex-1 p-4 lg:p-10 max-w-5xl mx-auto w-full overflow-y-auto">
        {activeTab === AppTab.SEARCH && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="text-center">
              <h2 className="text-3xl font-extrabold text-slate-800 mb-2">Tra cứu Từ & Cụm từ</h2>
              <p className="text-slate-500">Tìm kiếm từ vựng và nạp chúng vào kho lưu trữ của bạn.</p>
            </div>
            <form onSubmit={handleSearch} className="max-w-2xl mx-auto flex gap-2">
              <div className="relative flex-1">
                <input 
                  type="text" 
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Ví dụ: der Tisch, đi bộ là gì..."
                  className="w-full pl-6 pr-14 py-4 bg-white border-2 border-slate-200 rounded-2xl shadow-sm focus:border-indigo-500 outline-none transition-all"
                />
                <button type="button" onClick={handleMicClick} className={`absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-xl ${isListening ? 'bg-red-500 text-white animate-pulse' : 'text-slate-400'}`}>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                </button>
              </div>
              <button type="submit" disabled={loading} className="px-8 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg disabled:opacity-50 transition-all hover:bg-indigo-700">
                {loading ? '...' : 'Tra cứu'}
              </button>
            </form>
            {showSavedToast && <div className="max-w-md mx-auto bg-green-500 text-white px-6 py-3 rounded-2xl text-center animate-bounce">Đã lưu thành công!</div>}
            {result && <div className="max-w-2xl mx-auto"><WordCard word={result} showActions={false} autoPlay={true} /></div>}
          </div>
        )}

        {activeTab === AppTab.COLLECTION && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Thư viện của bạn ({savedWords.length})</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {savedWords.map(word => (
                <WordCard 
                  key={word.id} 
                  word={word} 
                  onDelete={deleteWord} 
                  onUpdate={updateWord}
                />
              ))}
              {savedWords.length === 0 && (
                <div className="col-span-full py-20 text-center">
                  <p className="text-slate-400">Thư viện đang trống. Hãy bắt đầu tra cứu từ mới!</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === AppTab.LEARN && (
          <FlashcardSession 
            words={savedWords} 
            onFinish={handleSessionFinish}
            onUpdateWord={updateWord}
          />
        )}

        {activeTab === AppTab.QUIZ && (
          learnedWords.length >= 3 
            ? <QuizSession words={learnedWords} onFinish={(s, updated) => { handleSessionFinish(updated); }} />
            : renderEmptyPractice("Bạn cần học thuộc ít nhất 3 từ trong phần 'Học thuộc' (đánh dấu 'Đã thuộc') để bắt đầu làm Quiz.")
        )}

        {activeTab === AppTab.LISTENING && (
          learnedWords.length >= 3
            ? <ListeningSession words={learnedWords} />
            : renderEmptyPractice("Bạn cần học thuộc ít nhất 3 từ trong phần 'Học thuộc' để có dữ liệu luyện nghe và nói.")
        )}

        {activeTab === AppTab.DICTATION && (
          learnedWords.length >= 3
            ? <DictationSession words={learnedWords} />
            : renderEmptyPractice("Chế độ chép chính tả yêu cầu AI soạn văn bản dựa trên các từ bạn đã học. Hãy học ít nhất 3 từ để bắt đầu.")
        )}

        {activeTab === AppTab.STATS && (
          <div className="space-y-10 animate-in fade-in duration-500 pb-10">
            <div className="bg-white p-6 rounded-3xl border-2 border-indigo-100 shadow-sm">
              <h3 className="font-bold text-indigo-600 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                Google Sheets Cloud (Đồng bộ 2 chiều)
              </h3>
              <div className="flex flex-col gap-4">
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={sheetsUrl}
                    onChange={(e) => updateSheetsUrl(e.target.value)}
                    placeholder="App Script URL..."
                    className="flex-1 px-4 py-3 text-sm border-2 border-slate-100 rounded-xl focus:border-indigo-500 outline-none transition-all"
                  />
                  <button onClick={() => handleSync()} disabled={!sheetsUrl || isSyncing} className="px-6 py-3 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all flex items-center gap-2">
                    {isSyncing ? (
                      <>
                        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Đang đồng bộ...
                      </>
                    ) : 'Đồng bộ ngay'}
                  </button>
                </div>
                {lastSync && <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Đồng bộ gần nhất: {lastSync}</p>}
                <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl">
                  <p className="text-xs text-indigo-700 leading-relaxed font-medium">
                    <strong>Mẹo:</strong> Khi bạn dán link, ứng dụng sẽ tự động tải các từ cũ từ Sheets về máy và đẩy các từ mới từ máy lên Sheets. Mọi tiến độ học tập (IPA, mạo từ, số nhiều) đều được bảo toàn.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                <h3 className="font-bold mb-6 text-slate-700">Loại từ vựng</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={categoryStats}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} />
                      <YAxis axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ borderRadius: '12px', border: 'none' }} />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                        {categoryStats.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                <h3 className="font-bold mb-6 text-slate-700">Tiến độ 7 ngày</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={getTimelineData()}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} />
                      <YAxis axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ borderRadius: '12px', border: 'none' }} />
                      <Line type="monotone" dataKey="count" stroke="#4f46e5" strokeWidth={3} dot={{ r: 4, fill: '#4f46e5' }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-4 py-3 z-50 flex justify-between overflow-x-auto gap-4">
        <MobileNavItem active={activeTab === AppTab.SEARCH} onClick={() => setActiveTab(AppTab.SEARCH)} icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>} label="Tìm" />
        <MobileNavItem active={activeTab === AppTab.COLLECTION} onClick={() => setActiveTab(AppTab.COLLECTION)} icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253"/></svg>} label="Thư viện" />
        <MobileNavItem active={activeTab === AppTab.LEARN} onClick={() => setActiveTab(AppTab.LEARN)} icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>} label="Học" />
        <MobileNavItem active={activeTab === AppTab.DICTATION} onClick={() => setActiveTab(AppTab.DICTATION)} icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>} label="Chép" />
        <MobileNavItem active={activeTab === AppTab.STATS} onClick={() => setActiveTab(AppTab.STATS)} icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2"/></svg>} label="Số liệu" />
      </div>
    </div>
  );
};

const NavItem: React.FC<{active: boolean, onClick: () => void, icon: React.ReactNode, label: string}> = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${active ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>
    {icon} <span className="text-sm">{label}</span>
  </button>
);

const MobileNavItem: React.FC<{active: boolean, onClick: () => void, icon: React.ReactNode, label: string}> = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-1 min-w-[60px] ${active ? 'text-indigo-600' : 'text-slate-400'}`}>
    {icon} <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
  </button>
);

export default App;
