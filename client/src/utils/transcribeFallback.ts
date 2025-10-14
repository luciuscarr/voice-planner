export async function transcribeFallback(blob: Blob): Promise<string> {
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
  const form = new FormData();
  const file = new File([blob], 'audio.webm', { type: blob.type || 'audio/webm' });
  form.append('audio', file);

  const res = await fetch(`${API_URL}/api/ai/transcribe`, {
    method: 'POST',
    body: form
  });
  if (!res.ok) {
    throw new Error('Transcription failed');
  }
  const data = await res.json();
  return data.transcript || '';
}


