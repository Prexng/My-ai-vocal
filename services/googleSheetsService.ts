
import { GermanWord } from "../types";

export interface SheetsPayload {
  action: 'ADD_WORD' | 'UPDATE_PROGRESS' | 'DELETE_WORD';
  data: any;
  timestamp: number;
}

/**
 * Lấy toàn bộ dữ liệu từ Google Sheets (Yêu cầu Apps Script có hàm doGet)
 */
export const syncFromSheets = async (url: string): Promise<GermanWord[]> => {
  if (!url) return [];
  try {
    const syncUrl = new URL(url);
    syncUrl.searchParams.set('_t', Date.now().toString());

    const response = await fetch(syncUrl.toString());
    if (!response.ok) throw new Error("Không thể kết nối với Google Sheets");
    
    const text = await response.text();
    try {
      const data = JSON.parse(text);
      if (Array.isArray(data)) {
        return data.map(item => ({
          id: item.id || crypto.randomUUID(),
          word: item.word || "",
          gender: (item.gender || "none") as any,
          meaning: item.meaning || "",
          ipa: item.ipa || "",
          partOfSpeech: item.partOfSpeech || "noun",
          plural: item.plural || "",
          createdAt: item.createdAt ? Number(item.createdAt) : Date.now(),
          masteryLevel: Number(item.masteryLevel) || 0,
          synonyms: Array.isArray(item.synonyms) ? item.synonyms : [],
          examples: Array.isArray(item.examples) ? item.examples : []
        }));
      }
    } catch (e) {
      console.error("Dữ liệu trả về không phải JSON hợp lệ:", text);
    }
    return [];
  } catch (err) {
    console.error("Lỗi đồng bộ từ Sheets:", err);
    return [];
  }
};

/**
 * Lưu dữ liệu lên Google Sheets. 
 */
export const saveToSheets = async (url: string, action: 'ADD_WORD' | 'UPDATE_PROGRESS' | 'DELETE_WORD', data: any): Promise<boolean> => {
  if (!url) return false;
  
  try {
    const payload: SheetsPayload = {
      action,
      data: action === 'ADD_WORD' ? {
        id: data.id,
        word: data.word,
        gender: data.gender,
        meaning: data.meaning,
        ipa: data.ipa || "",
        partOfSpeech: data.partOfSpeech || "",
        plural: data.plural || "",
        createdAt: data.createdAt,
        masteryLevel: data.masteryLevel || 0
      } : action === 'DELETE_WORD' ? {
        id: data.id,
        word: data.word
      } : data,
      timestamp: Date.now()
    };

    await fetch(url, {
      method: "POST",
      mode: "no-cors",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    return true;
  } catch (err) {
    console.error("Lỗi gửi dữ liệu lên Sheets:", err);
    return false;
  }
};
