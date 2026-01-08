
import React, { useState, useEffect } from 'react';
import { AppTab, GermanWord, Gender } from './types';
import { lookupWord } from './services/geminiService';
import WordCard from './components/WordCard';
import QuizSession from './components/QuizSession';
import FlashcardSession from './components/FlashcardSession';
import ListeningSession from './components/ListeningSession';
import { useSpeechRecognition } from './hooks/useSpeechRecognition';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LineChart, Line } from 'recharts';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AppTab>(AppTab.SEARCH);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GermanWord | null>(null);
  const [savedWords, setSavedWords] = useState<GermanWord[]>([]);
  const [quizScore, setQuizScore] = useState<{score: number, total: number} | null>(null);
  const [showSavedToast, setShowSavedToast] = useState(false);
  const [finishedLearning, setFinishedLearning] = useState(false);

  const { isListening, startListening } = useSpeechRecognition('de-DE');

  useEffect(() => {
    const stored = localStorage.getItem('deutsch_words');
    if (stored) {
      setSavedWords(JSON.parse(stored));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('deutsch_words', JSON.stringify(savedWords));
  }, [savedWords]);

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
          setTimeout(() => setShowSavedToast(false), 3000);
          return [newWord, ...prev];
        }
        return prev;
      });

      setSearchQuery('');
    } catch (err) {
      console.error(err);
      alert("Đã có lỗi xảy ra khi tìm kiếm.");
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
    if (confirm("Bạn có chắc muốn xóa nội dung này?")) {
      setSavedWords(prev => prev.filter(w => w.id !== id));
    }
  };

  const exportToCSV = () => {
    if (savedWords.length === 0) return;
    const headers = ["Word/Phrase", "IPA", "Gender", "Part of Speech", "Meaning", "Created At"];
    const rows = savedWords.map(w => [
      `"${w.word}"`,
      `"${w.ipa || ''}"`,
      `"${w.gender}"`,
      `"${w.partOfSpeech}"`,
      `"${w.meaning}"`,
      new Date(w.createdAt).toLocaleDateString()
    ]);
    
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `deutsch_vocab_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Prepare Stats Data
  const categoryStats = [
    { name: 'Nouns', value: savedWords.filter(w => w.partOfSpeech.toLowerCase().includes('noun')).length, color: '#4f46e5' },
    { name: 'Verbs', value: savedWords.filter(w => w.partOfSpeech.toLowerCase().includes('verb')).length, color: '#06b6d4' },
    { name: 'Phrases', value: savedWords.filter(w => w.partOfSpeech.toLowerCase().includes('phrase') || w.partOfSpeech.toLowerCase().includes('expression')).length, color: '#10b981' },
    { name: 'Others', value: savedWords.filter(w => !['noun', 'verb', 'phrase', 'expression'].some(cat => w.partOfSpeech.toLowerCase().includes(cat))).length, color: '#f59e0b' },
  ];

  const getTimelineData = () => {
    const dates: Record<string, number> = {};
    savedWords.forEach(w => {
      const date = new Date(w.createdAt).toLocaleDateString();
      dates[date] = (dates[date] || 0) + 1;
    });
    return Object.entries(dates).map(([date, count]) => ({ date, count })).reverse();
  };

  return (
    <div className="min-h-screen pb-24 lg:pb-0 lg:pl-64 flex flex-col bg-slate-50 text-slate-900">
      {/* Sidebar */}
      <nav className="fixed left-0 top-0 bottom-0 w-64 bg-white border-r border-slate-200 hidden lg:flex flex-col p-6 z-50">
        <div className="flex items-center gap-3 mb-12">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-indigo-100">D</div>
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-cyan-500">DeutschMaster</h1>
        </div>
        <div className="space-y-2 flex-1">
          <NavItem active={activeTab === AppTab.SEARCH} onClick={() => setActiveTab(AppTab.SEARCH)} icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>} label="Tra cứu AI" />
          <NavItem active={activeTab === AppTab.COLLECTION} onClick={() => setActiveTab(AppTab.COLLECTION)} icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>} label="Thư viện" />
          <NavItem active={activeTab === AppTab.LEARN} onClick={() => { setActiveTab(AppTab.LEARN); setFinishedLearning(false); }} icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>} label="Học thuộc" />
          <NavItem active={activeTab === AppTab.QUIZ} onClick={() => { setActiveTab(AppTab.QUIZ); setQuizScore(null); }} icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.674a1 1 0 00.922-.617l2.104-5.145A1 1 0 0016.441 10h-2.104l.833-4.167A1 1 0 0014.204 4H9.796a1 1 0 00-.97 1.208l.833 4.167H7.559a1 1 0 00-.922 1.238l2.104 5.145A1 1 0 009.663 17z" /></svg>} label="Luyện tập AI" />
          <NavItem active={activeTab === AppTab.LISTENING} onClick={() => setActiveTab(AppTab.LISTENING)} icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>} label="Nghe & Nói" />
          <NavItem active={activeTab === AppTab.STATS} onClick={() => setActiveTab(AppTab.STATS)} icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>} label="Thống kê" />
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 p-4 lg:p-10 max-w-5xl mx-auto w-full overflow-y-auto">
        {activeTab === AppTab.SEARCH && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="text-center">
              <h2 className="text-3xl font-extrabold text-slate-800 mb-2">Tra cứu Từ & Cụm từ</h2>
              <p className="text-slate-500">AI sẽ tự động phân tích và lưu trữ nội dung vào bộ sưu tập.</p>
            </div>
            <form onSubmit={handleSearch} className="max-w-2xl mx-auto flex gap-2">
              <div className="relative flex-1">
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Nhập từ hoặc cụm từ tiếng Đức..."
                  className="w-full pl-6 pr-14 py-4 bg-white border-2 border-slate-200 rounded-2xl shadow-sm focus:border-indigo-500 outline-none transition-all"
                />
                <button type="button" onClick={handleMicClick} className={`absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-xl transition-all ${isListening ? 'bg-red-500 text-white animate-pulse' : 'text-slate-400 hover:text-indigo-600'}`}>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                </button>
              </div>
              <button type="submit" disabled={loading} className="px-8 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg hover:bg-indigo-700 disabled:opacity-50">
                {loading ? '...' : 'Tra cứu'}
              </button>
            </form>
            {showSavedToast && (
              <div className="max-w-md mx-auto bg-green-500 text-white px-6 py-3 rounded-2xl text-center shadow-lg animate-bounce">
                Đã lưu thành công!
              </div>
            )}
            {result && <div className="max-w-2xl mx-auto"><WordCard word={result} showActions={false} /></div>}
          </div>
        )}

        {activeTab === AppTab.COLLECTION && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Thư viện của bạn ({savedWords.length})</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {savedWords.map(word => <WordCard key={word.id} word={word} onDelete={deleteWord} />)}
            </div>
          </div>
        )}

        {activeTab === AppTab.LEARN && <FlashcardSession words={savedWords} onFinish={() => setFinishedLearning(true)} />}
        {activeTab === AppTab.QUIZ && <QuizSession words={savedWords} onFinish={(s) => setQuizScore({score: s, total: 5})} />}
        {activeTab === AppTab.LISTENING && <ListeningSession words={savedWords} />}

        {activeTab === AppTab.STATS && (
          <div className="space-y-10 animate-in fade-in duration-500 pb-10">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-slate-800">Phân tích & Quản lý</h2>
              <button 
                onClick={exportToCSV}
                className="px-4 py-2 bg-slate-800 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-slate-900 transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                Xuất CSV
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Chart 1: Categories */}
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                <h3 className="font-bold mb-6 text-slate-700">Cấu trúc từ vựng</h3>
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

              {/* Chart 2: Timeline */}
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                <h3 className="font-bold mb-6 text-slate-700">Tiến độ theo ngày</h3>
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

            {/* Vocabulary Manager List */}
            <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <h3 className="font-bold text-slate-800">Danh sách từ vựng chi tiết</h3>
                <span className="text-xs font-bold text-slate-400 uppercase">Tổng cộng: {savedWords.length}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-slate-400 text-xs uppercase font-bold">
                    <tr>
                      <th className="px-6 py-4">Từ/Cụm từ</th>
                      <th className="px-6 py-4">Loại</th>
                      <th className="px-6 py-4">Ý nghĩa</th>
                      <th className="px-6 py-4">Ngày lưu</th>
                      <th className="px-6 py-4"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {savedWords.map(word => (
                      <tr key={word.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 font-bold text-slate-800">{word.word}</td>
                        <td className="px-6 py-4 text-xs">
                          <span className={`px-2 py-1 rounded-full font-bold ${word.partOfSpeech.toLowerCase().includes('noun') ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'}`}>
                            {word.partOfSpeech}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600 max-w-xs truncate">{word.meaning}</td>
                        <td className="px-6 py-4 text-sm text-slate-400">{new Date(word.createdAt).toLocaleDateString()}</td>
                        <td className="px-6 py-4">
                           <button onClick={() => deleteWord(word.id)} className="text-red-400 hover:text-red-600">
                             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                           </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Mobile Nav */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-4 py-3 z-50 flex justify-between">
        <MobileNavItem active={activeTab === AppTab.SEARCH} onClick={() => setActiveTab(AppTab.SEARCH)} icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>} label="Tìm" />
        <MobileNavItem active={activeTab === AppTab.COLLECTION} onClick={() => setActiveTab(AppTab.COLLECTION)} icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253"/></svg>} label="Kho" />
        <MobileNavItem active={activeTab === AppTab.STATS} onClick={() => setActiveTab(AppTab.STATS)} icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2"/></svg>} label="Thống kê" />
      </div>
    </div>
  );
};

const NavItem: React.FC<{active: boolean, onClick: () => void, icon: React.ReactNode, label: string}> = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-all ${active ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>
    {icon} <span>{label}</span>
  </button>
);

const MobileNavItem: React.FC<{active: boolean, onClick: () => void, icon: React.ReactNode, label: string}> = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-1 ${active ? 'text-indigo-600' : 'text-slate-400'}`}>
    {icon} <span className="text-[10px] font-bold uppercase">{label}</span>
  </button>
);

export default App;
