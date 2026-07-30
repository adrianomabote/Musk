import { useState, useRef, useCallback, useEffect } from 'react';
import { Platform } from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { fetch } from 'expo/fetch';
import type { Message, AssistantResponse, Action } from '@/types';

const MAX_HISTORY = 10;
const WAKE_WORD = 'replit';
const SILENCE_THRESHOLD = -50; // dB — below this = silence
const CHUNK_DURATION_MS = 4000;

function makeId() {
  return Date.now().toString() + Math.random().toString(36).substring(2, 7);
}

function getBaseUrl(): string {
  // EXPO_PUBLIC_API_URL is set when building for production (e.g. Render)
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  return domain ? `https://${domain}` : '';
}

async function playAudioBase64(base64: string) {
  if (!base64) return;
  try {
    const uri = (FileSystem.cacheDirectory ?? '') + `tts_${Date.now()}.mp3`;
    await FileSystem.writeAsStringAsync(uri, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const { sound } = await Audio.Sound.createAsync(
      { uri },
      { shouldPlay: true },
    );
    // Unload when done
    sound.setOnPlaybackStatusUpdate((s) => {
      if (s.isLoaded && s.didJustFinish) {
        sound.unloadAsync().catch(() => {});
        FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
      }
    });
  } catch (e) {
    console.warn('Audio playback error', e);
  }
}

export interface UseAssistantResult {
  messages: Message[];
  isRecording: boolean;
  isLoading: boolean;
  alwaysListening: boolean;
  hasMicPermission: boolean | null;
  sendText: (text: string) => Promise<Action | undefined>;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<Action | undefined>;
  toggleAlwaysListening: () => void;
  clearMessages: () => void;
}

export function useAssistant(): UseAssistantResult {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [alwaysListening, setAlwaysListening] = useState(false);
  const [hasMicPermission, setHasMicPermission] = useState<boolean | null>(null);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const alwaysListeningRef = useRef(false);
  const isProcessingRef = useRef(false);

  // Request microphone permission on mount
  useEffect(() => {
    Audio.requestPermissionsAsync().then(({ granted }) => {
      setHasMicPermission(granted);
    });
    Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });
  }, []);

  const addMessage = useCallback((msg: Message) => {
    setMessages((prev) => [msg, ...prev]);
  }, []);

  const updateLastAssistantMessage = useCallback((text: string, action?: Action) => {
    setMessages((prev) => {
      const updated = [...prev];
      const idx = updated.findIndex((m) => m.role === 'assistant' && m.content === '...');
      if (idx !== -1) {
        updated[idx] = { ...updated[idx], content: text, action };
      }
      return updated;
    });
  }, []);

  const getHistory = useCallback(() => {
    return messages
      .slice(0, MAX_HISTORY)
      .reverse()
      .map((m) => ({ role: m.role, content: m.content }));
  }, [messages]);

  const sendText = useCallback(async (text: string): Promise<Action | undefined> => {
    const userMsg: Message = {
      id: makeId(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };
    addMessage(userMsg);

    const placeholder: Message = {
      id: makeId(),
      role: 'assistant',
      content: '...',
      timestamp: Date.now(),
    };
    addMessage(placeholder);
    setIsLoading(true);

    try {
      const resp = await fetch(`${getBaseUrl()}/api/assistant/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history: getHistory() }),
      });

      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data: AssistantResponse = await resp.json();

      updateLastAssistantMessage(data.text, data.action);
      await playAudioBase64(data.audioBase64);
      return data.action;
    } catch (err) {
      console.error('sendText error', err);
      updateLastAssistantMessage('Erro ao conectar. Verifique sua conexão.');
      return undefined;
    } finally {
      setIsLoading(false);
    }
  }, [addMessage, updateLastAssistantMessage, getHistory]);

  const sendVoice = useCallback(async (audioUri: string): Promise<Action | undefined> => {
    let base64: string;
    try {
      base64 = await FileSystem.readAsStringAsync(audioUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
    } catch {
      return undefined;
    }

    const userMsg: Message = {
      id: makeId(),
      role: 'user',
      content: 'Mensagem de voz',
      isVoice: true,
      timestamp: Date.now(),
    };
    addMessage(userMsg);

    const placeholder: Message = {
      id: makeId(),
      role: 'assistant',
      content: '...',
      timestamp: Date.now(),
    };
    addMessage(placeholder);
    setIsLoading(true);

    try {
      const resp = await fetch(`${getBaseUrl()}/api/assistant/voice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioBase64: base64,
          mimeType: 'audio/m4a',
          history: getHistory(),
        }),
      });

      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data: AssistantResponse = await resp.json();

      // Update user message with transcript if available
      if (data.transcript) {
        setMessages((prev) => {
          const updated = [...prev];
          const idx = updated.findIndex((m) => m.id === userMsg.id);
          if (idx !== -1) updated[idx] = { ...updated[idx], content: data.transcript! };
          return updated;
        });
      }

      updateLastAssistantMessage(data.text, data.action);
      await playAudioBase64(data.audioBase64);
      return data.action;
    } catch (err) {
      console.error('sendVoice error', err);
      updateLastAssistantMessage('Erro ao processar áudio.');
      return undefined;
    } finally {
      setIsLoading(false);
    }
  }, [addMessage, updateLastAssistantMessage, getHistory]);

  const startRecording = useCallback(async () => {
    if (!hasMicPermission || isRecording) return;
    try {
      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await rec.startAsync();
      recordingRef.current = rec;
      setIsRecording(true);
    } catch (err) {
      console.error('startRecording error', err);
    }
  }, [hasMicPermission, isRecording]);

  const stopRecording = useCallback(async (): Promise<Action | undefined> => {
    if (!recordingRef.current) return;
    setIsRecording(false);
    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      if (!uri) return;
      return await sendVoice(uri);
    } catch (err) {
      console.error('stopRecording error', err);
      recordingRef.current = null;
      return undefined;
    }
  }, [sendVoice]);

  // ── Always-listening loop ────────────────────────────────────────────────
  useEffect(() => {
    alwaysListeningRef.current = alwaysListening;
  }, [alwaysListening]);

  useEffect(() => {
    if (!alwaysListening || !hasMicPermission || Platform.OS === 'web') return;

    let cancelled = false;

    const loop = async () => {
      while (!cancelled && alwaysListeningRef.current) {
        if (isProcessingRef.current) {
          await new Promise((r) => setTimeout(r, 500));
          continue;
        }

        try {
          const rec = new Audio.Recording();
          await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);

          let hasSpeech = false;
          rec.setOnRecordingStatusUpdate((s) => {
            if (s.isRecording && (s.metering ?? -160) > SILENCE_THRESHOLD) {
              hasSpeech = true;
            }
          });

          await rec.startAsync();
          await new Promise((r) => setTimeout(r, CHUNK_DURATION_MS));
          await rec.stopAndUnloadAsync();

          if (!hasSpeech || cancelled) continue;

          const uri = rec.getURI();
          if (!uri) continue;

          let b64: string;
          try {
            b64 = await FileSystem.readAsStringAsync(uri, {
              encoding: FileSystem.EncodingType.Base64,
            });
          } catch {
            continue;
          }

          // Quick transcription to check for wake word
          const checkResp = await fetch(`${getBaseUrl()}/api/assistant/transcribe`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ audioBase64: b64, mimeType: 'audio/m4a' }),
          });

          if (!checkResp.ok) continue;
          const { transcript } = await checkResp.json();
          const lower = (transcript ?? '').toLowerCase();

          if (!lower.includes(WAKE_WORD)) continue;

          // Wake word detected — process as command
          isProcessingRef.current = true;
          const command = lower.replace(/.*replit[,.]?\s*/i, '').trim();

          if (command.length > 2) {
            await sendText(command);
          } else {
            // Just acknowledge
            await sendText('Replit, oi');
          }
          isProcessingRef.current = false;

        } catch (err) {
          isProcessingRef.current = false;
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    };

    loop();
    return () => { cancelled = true; };
  }, [alwaysListening, hasMicPermission, sendText]);

  const toggleAlwaysListening = useCallback(() => {
    setAlwaysListening((v) => !v);
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    messages,
    isRecording,
    isLoading,
    alwaysListening,
    hasMicPermission,
    sendText,
    startRecording,
    stopRecording,
    toggleAlwaysListening,
    clearMessages,
  };
}
