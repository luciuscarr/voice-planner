import { useState, useRef, useCallback } from 'react';
import { SpeechRecognitionResult } from '@shared/types';

interface UseSpeechRecognitionOptions {
  onResult?: (result: SpeechRecognitionResult) => void;
  onError?: (error: string) => void;
  continuous?: boolean;
  interimResults?: boolean;
  language?: string;
}

interface UseSpeechRecognitionReturn {
  isListening: boolean;
  isSupported: boolean;
  transcript: string;
  confidence: number;
  startListening: () => void;
  stopListening: () => void;
  reset: () => void;
}

export const useSpeechRecognition = (options: UseSpeechRecognitionOptions = {}): UseSpeechRecognitionReturn => {
  const {
    onResult,
    onError,
    continuous = true,
    interimResults = true,
    language = 'en-US'
  } = options;

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [confidence, setConfidence] = useState(0);
  
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const isSupported = typeof window !== 'undefined' && 'webkitSpeechRecognition' in window;

  const startListening = useCallback(() => {
    if (!isSupported || !recognitionRef.current) {
      onError?.('Speech recognition not supported');
      return;
    }

    try {
      recognitionRef.current.start();
      setIsListening(true);
    } catch (error) {
      onError?.(`Failed to start speech recognition: ${error}`);
    }
  }, [isSupported, onResult]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  }, [isListening]);

  const reset = useCallback(() => {
    setTranscript('');
    setConfidence(0);
    stopListening();
  }, [stopListening]);

  // Initialize speech recognition
  useState(() => {
    if (isSupported) {
      const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      
      const recognition = recognitionRef.current;
      recognition.continuous = continuous;
      recognition.interimResults = interimResults;
      recognition.lang = language;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event) => {
        let finalTranscript = '';
        let interimTranscript = '';
        let maxConfidence = 0;

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const transcript = result[0].transcript;
          const confidence = result[0].confidence || 0;

          if (result.isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }

          maxConfidence = Math.max(maxConfidence, confidence);
        }

        const fullTranscript = finalTranscript || interimTranscript;
        setTranscript(fullTranscript);
        setConfidence(maxConfidence);

        onResult?.({
          transcript: fullTranscript,
          confidence: maxConfidence,
          isFinal: finalTranscript.length > 0
        });
      };

      recognition.onerror = (event) => {
        const errorMessage = `Speech recognition error: ${event.error}`;
        onError?.(errorMessage);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };
    }
  });

  return {
    isListening,
    isSupported,
    transcript,
    confidence,
    startListening,
    stopListening,
    reset
  };
};
