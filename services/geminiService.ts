
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { GermanWord, Gender } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const lookupWord = async (word: string): Promise<Partial<GermanWord>> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Bạn là một giáo sư ngôn ngữ Đức chuyên nghiệp. Hãy phân tích nội dung sau: "${word}".

    NHIỆM VỤ QUAN TRỌNG:
    1. Nếu người dùng nhập SAI ngữ pháp (sai mạo từ der/die/das, sai chia động từ, sai cách (Kasu), hoặc sai chính tả), hãy TỰ ĐỘNG SỬA lại cho đúng hoàn toàn.
    2. Trong trường 'word', hãy trả về nội dung ĐÃ ĐƯỢC SỬA.
    3. Trong trường 'correctionNote', hãy giải thích ngắn gọn lỗi sai bằng tiếng Việt (Ví dụ: "Bạn đã dùng sai mạo từ, Tisch là giống đực nên phải là 'der Tisch'"). Nếu người dùng nhập đúng, hãy để trống.
    4. Phân tích chi tiết nội dung đã sửa: mạo từ, IPA, loại từ, nghĩa tiếng Việt, và 2-3 ví dụ.
    5. Nếu là cụm từ hoặc câu, hãy giữ nguyên cấu trúc chuẩn trong trường 'word'.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          word: { type: Type.STRING, description: "Nội dung đã được sửa lỗi ngữ pháp" },
          correctionNote: { type: Type.STRING, description: "Giải thích lỗi ngữ pháp nếu người dùng nhập sai" },
          ipa: { type: Type.STRING },
          gender: { type: Type.STRING, description: "der, die, das, hoặc none" },
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
        required: ["word", "gender", "meaning", "partOfSpeech", "examples"]
      }
    }
  });

  const data = JSON.parse(response.text || '{}');
  return {
    ...data,
    originalInput: word,
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
  
  // Thuật toán chọn từ thông minh (Spaced Repetition)
  // Chia từ thành 2 nhóm: Chưa thuộc (<100) và Đã thuộc (>=100)
  const unmastered = words.filter(w => w.masteryLevel < 100);
  const mastered = words.filter(w => w.masteryLevel >= 100);
  
  let selectedWords: GermanWord[] = [];
  
  // Ưu tiên lấy từ chưa thuộc (tối đa 15 từ)
  selectedWords = [...unmastered]
    .sort((a, b) => a.masteryLevel - b.masteryLevel)
    .slice(0, 15);
    
  // Lấy thêm 5 từ đã thuộc ngẫu nhiên để ôn tập (Review)
  if (mastered.length > 0) {
    const randomMastered = [...mastered]
      .sort(() => Math.random() - 0.5)
      .slice(0, 5);
    selectedWords = [...selectedWords, ...randomMastered];
  }
  
  // Xáo trộn cuối cùng
  selectedWords = selectedWords.sort(() => Math.random() - 0.5);

  const wordDetails = selectedWords.map(w => 
    `{id: "${w.id}", word: "${w.word}", meaning: "${w.meaning}", type: "${w.partOfSpeech}"}`
  ).join(', ');
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Dựa trên danh sách các từ vựng sau: [${wordDetails}].
    
    YÊU CẦU:
    1. Tạo đúng 10 câu hỏi ôn tập.
    2. Phải bao gồm cả 5 câu trắc nghiệm (mcq) và 5 câu tự luận (write).
    3. QUAN TRỌNG: Với mỗi câu hỏi, bạn PHẢI gán đúng trường 'wordId' tương ứng với 'id' của từ được dùng để tạo câu hỏi đó từ danh sách trên.
    4. Câu hỏi đa dạng: hỏi nghĩa, hỏi mạo từ, hoàn thành câu.
    5. Trả về định dạng JSON array.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            type: { type: Type.STRING, description: "'mcq' hoặc 'write'" },
            question: { type: Type.STRING },
            correctAnswer: { type: Type.STRING },
            hint: { type: Type.STRING },
            options: { type: Type.ARRAY, items: { type: Type.STRING } },
            wordId: { type: Type.STRING, description: "Bắt buộc phải có ID từ danh sách cung cấp" }
          },
          required: ["type", "question", "correctAnswer", "wordId"]
        }
      }
    }
  });

  return JSON.parse(response.text || '[]');
};

export const generateDictationText = async (words: GermanWord[], difficulty: 'easy' | 'medium' | 'hard' = 'medium'): Promise<string> => {
  if (words.length === 0) return "Guten Tag! Wie geht es dir?";
  
  const sampleWords = [...words].sort(() => Math.random() - 0.5).slice(0, 10).map(w => w.word).join(', ');
  
  let difficultyInstruction = "";
  switch(difficulty) {
    case 'easy': difficultyInstruction = "Mỗi câu chỉ nên có từ 4 đến 7 từ. Cấu trúc đơn giản."; break;
    case 'medium': difficultyInstruction = "Mỗi câu nên có từ 8 đến 12 từ. Cấu trúc vừa phải."; break;
    case 'hard': difficultyInstruction = "Mỗi câu nên có trên 13 từ. Sử dụng cấu trúc phức tạp, câu ghép."; break;
  }

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Hãy viết một đoạn văn ngắn (khoảng 3-5 câu) bằng tiếng Đức sử dụng một số từ trong danh sách sau: ${sampleWords}. 
    YÊU CẦU CẤP ĐỘ (${difficulty.toUpperCase()}): ${difficultyInstruction}
    Đoạn văn nên có ý nghĩa logic. CHỈ TRẢ VỀ ĐOẠN VĂN TIẾNG ĐỨC.`,
  });

  return response.text.trim();
};
