
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { GermanWord, Gender } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const lookupWord = async (word: string): Promise<Partial<GermanWord>> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Hãy phân tích nội dung tiếng Đức sau: "${word}". 
    Đây có thể là một từ đơn, một cụm từ (phrase), một thành ngữ (idiom) hoặc một câu ngắn.
    
    Yêu cầu phân tích chi tiết bằng tiếng Việt:
    1. Nếu là cụm từ hoặc câu, hãy giữ nguyên toàn bộ chuỗi ký tự trong trường 'word'.
    2. Nếu nội dung có Danh từ chính, hãy xác định 'gender' (der/die/das). Nếu là cụm từ không có mạo từ xác định cụ thể cho cả cụm, hãy để 'none'.
    3. Cung cấp phiên âm quốc tế IPA cho từ chính hoặc cách đọc cho cả cụm trong trường 'ipa'.
    4. Xác định 'partOfSpeech' (VD: Noun, Verb, Phrase, Expression, Sentence).
    5. Cung cấp 'meaning' (nghĩa) chính xác nhất trong ngữ cảnh.
    6. Luôn cung cấp 2-3 ví dụ thực tế sử dụng nội dung này.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          word: { type: Type.STRING },
          ipa: { type: Type.STRING },
          gender: { 
            type: Type.STRING, 
            description: "der, die, das, hoặc none" 
          },
          plural: { type: Type.STRING },
          meaning: { type: Type.STRING },
          partOfSpeech: { type: Type.STRING },
          synonyms: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          },
          verbForms: {
            type: Type.OBJECT,
            properties: {
              praeteritum: { type: Type.STRING },
              partizipII: { type: Type.STRING }
            }
          },
          examples: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                german: { type: Type.STRING },
                vietnamese: { type: Type.STRING }
              },
              required: ["german", "vietnamese"]
            }
          }
        },
        required: ["word", "ipa", "gender", "meaning", "partOfSpeech", "synonyms", "examples"]
      }
    }
  });

  const data = JSON.parse(response.text || '{}');
  return {
    ...data,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    masteryLevel: 0
  };
};

export const generateSpeech = async (text: string): Promise<string | undefined> => {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: `Say clearly in German: ${text}` }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Kore' },
        },
      },
    },
  });

  return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
};

export const generateQuiz = async (words: GermanWord[]): Promise<any[]> => {
  if (words.length === 0) return [];
  
  const prioritizedWords = [...words]
    .sort((a, b) => a.masteryLevel - b.masteryLevel)
    .slice(0, 10);

  const wordDetails = prioritizedWords.map(w => {
    let detail = `${w.word} (${w.partOfSpeech}, nghĩa: ${w.meaning})`;
    return detail;
  }).join('; ');
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Tạo 5 câu hỏi trắc nghiệm hoặc điền từ dựa trên: ${wordDetails}. 
    Tập trung vào nghĩa và cách sử dụng trong câu. 
    Nếu là cụm từ, hãy hỏi về nghĩa hoặc từ còn thiếu trong cụm.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            type: { type: Type.STRING },
            question: { type: Type.STRING },
            correctAnswer: { type: Type.STRING },
            hint: { type: Type.STRING },
            options: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            wordId: { type: Type.STRING }
          },
          required: ["type", "question", "correctAnswer", "wordId"]
        }
      }
    }
  });

  return JSON.parse(response.text || '[]');
};
