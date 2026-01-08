
import React, { useState } from 'react';
import { GermanWord, Gender } from '../types';
import { generateSpeech } from '../services/geminiService';

interface WordCardProps {
  word: GermanWord;
  onDelete?: (id: string) => void;
  showActions?: boolean;
}

const getGenderColor = (gender: Gender) => {
  switch (gender) {
    case 'der': return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'die': return 'bg-red-100 text-red-800 border-red-200';
    case 'das': return 'bg-green-100 text-green-800 border-green-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const WordCard: React.FC<WordCardProps> = ({ word, onDelete, showActions = true }) => {
  const [isPlaying, setIsPlaying] = useState(false);

  const decodeBase64Audio = (base64: string) => {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  };

  const decodeAudioData = async (
    data: Uint8Array,
    ctx: AudioContext,
    sampleRate: number,
    numChannels: number,
  ): Promise<AudioBuffer> => {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < frameCount; i++) {
        channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
      }
    }
    return buffer;
  };

  const playPronunciation = async () => {
    if (isPlaying) return;
    setIsPlaying(true);
    try {
      const audioData = await generateSpeech(word.word);
      if (!audioData) throw new Error("No audio data received");

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const decodedData = decodeBase64Audio(audioData);
      const audioBuffer = await decodeAudioData(decodedData, audioCtx, 24000, 1);
      
      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioCtx.destination);
      source.onended = () => setIsPlaying(false);
      source.start();
    } catch (err) {
      console.error("Failed to play pronunciation", err);
      setIsPlaying(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-all">
      <div className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              {word.gender !== 'none' && (
                <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase border ${getGenderColor(word.gender)}`}>
                  {word.gender}
                </span>
              )}
              <h2 className="text-2xl font-bold text-slate-800">{word.word}</h2>
              <button 
                onClick={playPronunciation}
                disabled={isPlaying}
                className={`p-2 rounded-full transition-all ${isPlaying ? 'bg-indigo-100 text-indigo-600 scale-110' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'}`}
                title="Nghe phát âm"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M14.659 6.2c-.4.4-.4 1.059 0 1.459L17.2 10.2c.4.4 1.059.4 1.459 0 .4-.4.4-1.059 0-1.459L16.118 6.2c-.4-.4-1.059-.4-1.459 0zm2.718 2.718L20.1 11.641a1.031 1.031 0 010 1.459l-2.723 2.723a1.031 1.031 0 01-1.459 0c-.4-.4-.4-1.059 0-1.459l1.994-1.994-1.994-1.994c-.4-.4-.4-1.059 0-1.459a1.031 1.031 0 011.459 0zM3 9v6c0 1.1.9 2 2 2h3l4.5 4.5c.3.3.8.1.8-.4v-18c0-.5-.5-.7-.8-.4L8 7H5c-1.1 0-2 .9-2 2zm11 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>
              </button>
            </div>
            <div className="flex items-center gap-2">
              <p className="text-slate-500 italic text-sm">
                {word.partOfSpeech} 
                {word.plural && word.plural !== 'none' && ` • Plural: ${word.plural}`}
              </p>
              {word.ipa && (
                <span className="text-indigo-500 font-mono text-sm bg-indigo-50 px-2 rounded">
                  [{word.ipa}]
                </span>
              )}
            </div>
          </div>
          {showActions && onDelete && (
            <button 
              onClick={() => onDelete(word.id)}
              className="p-2 rounded-full hover:bg-red-50 text-red-600 transition-colors"
              title="Xóa từ vựng"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
          )}
        </div>

        <div className="mb-6">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2">Ý nghĩa</h3>
          <p className="text-lg text-slate-700 font-medium">{word.meaning}</p>
        </div>

        {word.verbForms && (
          <div className="mb-6 p-3 bg-indigo-50 rounded-xl border border-indigo-100">
            <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-2">Dạng quá khứ (Verb Forms)</h3>
            <div className="flex gap-4 text-sm">
              <div>
                <span className="text-indigo-300 font-medium">Präteritum:</span>
                <span className="ml-2 text-indigo-900 font-bold">{word.verbForms.praeteritum}</span>
              </div>
              <div>
                <span className="text-indigo-300 font-medium">Partizip II:</span>
                <span className="ml-2 text-indigo-900 font-bold">{word.verbForms.partizipII}</span>
              </div>
            </div>
          </div>
        )}

        {word.synonyms.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2">Từ đồng nghĩa</h3>
            <div className="flex flex-wrap gap-2">
              {word.synonyms.map((s, i) => (
                <span key={i} className="px-3 py-1 bg-slate-100 rounded-full text-sm text-slate-600">
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        <div>
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Ví dụ</h3>
          <ul className="space-y-3">
            {word.examples.map((ex, i) => (
              <li key={i} className="bg-slate-50 p-3 rounded-lg border-l-4 border-indigo-400">
                <p className="font-medium text-slate-800">{ex.german}</p>
                <p className="text-sm text-slate-600 italic">{ex.vietnamese}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default WordCard;
