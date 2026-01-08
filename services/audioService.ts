
import { generateSpeech } from './geminiService';
import { decodeBase64, decodeAudioData, getSharedAudioContext } from './audioUtils';

// Bộ nhớ đệm lưu trữ AudioBuffer
const audioCache: Map<string, AudioBuffer> = new Map();

/**
 * Phát âm thanh bằng Web Speech API (Dự phòng khi AI lỗi)
 */
const playFallback = (text: string, lang: string = 'de-DE'): Promise<void> => {
  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 0.9; // Chậm lại một chút để dễ nghe
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve(); // Vẫn resolve để không làm treo UI
    window.speechSynthesis.speak(utterance);
  });
};

/**
 * Hàm phát âm thanh thông minh: AI -> Cache -> Retry -> Fallback
 */
export const playGermanAudio = async (text: string, onStart?: () => void, onEnd?: () => void): Promise<void> => {
  const audioCtx = getSharedAudioContext();
  
  if (onStart) onStart();

  // 1. Kiểm tra Cache
  if (audioCache.has(text)) {
    const buffer = audioCache.get(text)!;
    await playBuffer(buffer, audioCtx, onEnd);
    return;
  }

  // 2. Thử gọi Gemini API với cơ chế Retry
  let audioData: string | undefined;
  const maxRetries = 2;
  
  for (let i = 0; i <= maxRetries; i++) {
    try {
      audioData = await generateSpeech(text);
      if (audioData) break;
    } catch (err) {
      console.warn(`Lần thử ${i + 1} thất bại:`, err);
      if (i < maxRetries) {
        await new Promise(r => setTimeout(r, 1000 * (i + 1))); // Chờ trước khi thử lại
      }
    }
  }

  // 3. Xử lý kết quả hoặc chuyển sang Fallback
  try {
    if (audioData) {
      const decodedData = decodeBase64(audioData);
      const buffer = await decodeAudioData(decodedData, audioCtx, 24000, 1);
      
      // Lưu vào cache
      audioCache.set(text, buffer);
      
      await playBuffer(buffer, audioCtx, onEnd);
    } else {
      throw new Error("Gemini API returned no data after retries");
    }
  } catch (err) {
    console.error("Chuyển sang giọng nói dự phòng của trình duyệt:", err);
    await playFallback(text);
    if (onEnd) onEnd();
  }
};

/**
 * Thực hiện phát AudioBuffer
 */
const playBuffer = async (buffer: AudioBuffer, ctx: AudioContext, onEnd?: () => void): Promise<void> => {
  if (ctx.state === 'suspended') {
    await ctx.resume();
  }
  
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  source.onended = () => {
    if (onEnd) onEnd();
  };
  source.start();
};
