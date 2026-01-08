
import React, { useState, useEffect } from 'react';
import { GermanWord, Gender } from '../types';
import { playGermanAudio } from '../services/audioService';

interface WordCardProps {
  word: GermanWord;
  onDelete?: (id: string) => void;
  onUpdate?: (id: string, updatedFields: Partial<GermanWord>) => void;
  showActions?: boolean;
  autoPlay?: boolean;
}

const getGenderColor = (gender: Gender) => {
  switch (gender) {
    case 'der': return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'die': return 'bg-red-100 text-red-800 border-red-200';
    case 'das': return 'bg-green-100 text-green-800 border-green-200';
    default: return 'bg-slate-100 text-slate-500 border-slate-200';
  }
};

const WordCard: React.FC<WordCardProps> = ({ word, onDelete, onUpdate, showActions = true, autoPlay = false }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedMeaning, setEditedMeaning] = useState(word.meaning);

  const handlePlay = () => {
    playGermanAudio(
      word.word, 
      () => setIsPlaying(true), 
      () => setIsPlaying(false)
    );
  };

  useEffect(() => {
    if (autoPlay) {
      const timer = setTimeout(() => handlePlay(), 500);
      return () => clearTimeout(timer);
    }
  }, [word.id, autoPlay]);

  const handleSave = () => {
    if (onUpdate) {
      onUpdate(word.id, { meaning: editedMeaning });
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedMeaning(word.meaning);
    setIsEditing(false);
  };

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-xl transition-all group duration-300">
      <div className="p-6">
        {word.correctionNote && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-2 animate-in slide-in-from-top-2">
            <span className="text-xl">💡</span>
            <div>
              <p className="text-[10px] font-black uppercase text-amber-600 tracking-widest">Ghi chú ngữ pháp</p>
              <p className="text-xs text-amber-800 leading-snug">{word.correctionNote}</p>
              <p className="text-[9px] text-amber-400 mt-1 italic">Bạn đã nhập: "{word.originalInput}"</p>
            </div>
          </div>
        )}

        <div className="flex justify-between items-start mb-6">
          <div className="flex-1 pr-4">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              {word.gender !== 'none' && (
                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase border ${getGenderColor(word.gender)}`}>
                  {word.gender}
                </span>
              )}
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                {word.partOfSpeech}
              </span>
            </div>
            <h2 className="text-2xl font-black text-slate-800 leading-tight group-hover:text-indigo-600 transition-colors">
              {word.word}
            </h2>
            {word.ipa && <p className="text-xs font-mono text-indigo-400 mt-1">[{word.ipa}]</p>}
          </div>
          <div className="flex flex-col gap-2">
            <button 
              onClick={handlePlay}
              disabled={isPlaying}
              className={`p-3 rounded-2xl transition-all shadow-sm ${isPlaying ? 'bg-indigo-600 text-white animate-pulse' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M3 9v6c0 1.1.9 2 2 2h3l4.5 4.5c.3.3.8.1.8-.4v-18c0-.5-.5-.7-.8-.4L8 7H5c-1.1 0-2 .9-2 2zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>
            </button>
            {showActions && (
              <div className="flex flex-col gap-2">
                <button 
                  onClick={() => setIsEditing(!isEditing)}
                  className={`p-3 rounded-2xl transition-all shadow-sm ${isEditing ? 'bg-amber-100 text-amber-600' : 'bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-indigo-600'}`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                </button>
                {onDelete && (
                  <button 
                    onClick={() => onDelete(word.id)}
                    className="p-3 rounded-2xl bg-red-50 text-red-400 hover:bg-red-500 hover:text-white transition-all shadow-sm"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-1">Ý nghĩa</p>
            {isEditing ? (
              <div className="space-y-2">
                <textarea
                  value={editedMeaning}
                  onChange={(e) => setEditedMeaning(e.target.value)}
                  className="w-full p-3 bg-amber-50 border-2 border-amber-200 rounded-2xl focus:border-amber-400 outline-none text-slate-800 text-lg font-bold"
                  rows={2}
                />
                <div className="flex gap-2">
                  <button onClick={handleSave} className="flex-1 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold">Lưu</button>
                  <button onClick={handleCancel} className="flex-1 py-2 bg-slate-100 text-slate-500 rounded-xl text-xs font-bold">Hủy</button>
                </div>
              </div>
            ) : (
              <p className="text-lg font-bold text-slate-700 leading-snug">{word.meaning}</p>
            )}
          </div>

          {word.verbForms && (
            <div className="grid grid-cols-2 gap-3 p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100">
              <div>
                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Präteritum</p>
                <p className="text-sm font-black text-indigo-900">{word.verbForms.praeteritum}</p>
              </div>
              <div>
                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Partizip II</p>
                <p className="text-sm font-black text-indigo-900">{word.verbForms.partizipII}</p>
              </div>
            </div>
          )}

          {word.examples && word.examples.length > 0 && (
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">Ví dụ thực tế</p>
              <ul className="space-y-3">
                {word.examples.map((ex, i) => (
                  <li key={i} className="bg-slate-50 p-4 rounded-2xl border-l-4 border-indigo-500 shadow-sm">
                    <p className="font-bold text-slate-800 mb-1">{ex.german}</p>
                    <p className="text-xs text-slate-500 italic">{ex.vietnamese}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WordCard;
