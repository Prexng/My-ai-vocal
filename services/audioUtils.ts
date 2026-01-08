
let sharedAudioCtx: AudioContext | null = null;

export const getSharedAudioContext = (): AudioContext => {
  if (!sharedAudioCtx) {
    sharedAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
  }
  return sharedAudioCtx;
};

export function decodeBase64(base64: string): Uint8Array {
  // Loại bỏ các ký tự lạ hoặc prefix nếu có
  const cleanBase64 = base64.replace(/^data:audio\/\w+;base64,/, '').replace(/\s/g, '');
  const binaryString = atob(cleanBase64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1,
): Promise<AudioBuffer> {
  // Mỗi mẫu (sample) là 2 bytes (16-bit)
  const frameCount = Math.floor(data.byteLength / (2 * numChannels));
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  const dataView = new DataView(data.buffer, data.byteOffset, data.byteLength);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      // Đọc 16-bit signed integer (Little Endian)
      const byteOffset = (i * numChannels + channel) * 2;
      if (byteOffset + 1 < data.byteLength) {
        // Chia cho 32768 để đưa về dải -1.0 đến 1.0
        channelData[i] = dataView.getInt16(byteOffset, true) / 32768.0;
      }
    }
  }
  return buffer;
}
