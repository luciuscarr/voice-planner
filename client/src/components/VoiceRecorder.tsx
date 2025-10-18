import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Square } from 'lucide-react';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { VoiceCommand } from '@shared/types';
import { transcribeFallback } from '../utils/transcribeFallback';

// Server-side AI parsing functions
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

async function parseWithServerAI(transcript: string, multipleCommands = true): Promise<VoiceCommand | VoiceCommand[]> {
  try {
    const response = await fetch(`${API_URL}/api/ai/parse`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transcript,
        multipleCommands,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        offsetMinutes: new Date().getTimezoneOffset()
      })
    });

    if (!response.ok) {
      throw new Error(`Server AI parsing failed: ${response.status}`);
    }

    const result = await response.json();
    return result.data;
  } catch (error) {
    console.error('Server AI parsing error:', error);
    // Fallback to basic parsing if server AI fails
    return {
      text: transcript,
      intent: 'unknown',
      confidence: 0.3,
      extractedData: { title: transcript, priority: 'medium' }
    };
  }
}

async function checkServerAIStatus(): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/api/ai/status`);
    if (!response.ok) return false;
    const result = await response.json();
    return result.available;
  } catch (error) {
    console.error('Error checking server AI status:', error);
    return false;
  }
}

interface VoiceRecorderProps {
  onCommand: (command: VoiceCommand | VoiceCommand[]) => void;
  onTranscription: (text: string) => void;
  onProcessingChange?: (isProcessing: boolean) => void;
}

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({ onCommand, onTranscription, onProcessingChange }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [useAI, setUseAI] = useState(true);
  const [aiAvailable, setAiAvailable] = useState(false);
  const aiAvailableRef = React.useRef(false);

  // Check server AI availability on mount
  useEffect(() => {
    console.log('🔍 Checking server AI availability...');
    checkServerAIStatus().then(available => {
      console.log('✅ Server AI Available:', available);
      setAiAvailable(available);
      aiAvailableRef.current = available;
      if (!available) {
        console.warn('⚠️ Server AI parsing not available, using fallback parser');
      } else {
        console.log('🤖 Server AI parsing enabled!');
      }
    }).catch(error => {
      console.error('❌ Error checking server AI status:', error);
      setAiAvailable(false);
      aiAvailableRef.current = false;
    });
  }, []);

  const { isSupported, startListening, stopListening, reset } = useSpeechRecognition({
    onResult: async (result) => {
      setTranscript(result.transcript);
      onTranscription(result.transcript);
      
      // Debounce finalization slightly to allow short pauses
      if (result.isFinal) {
        setIsProcessing(true);
        onProcessingChange?.(true);
        
        try {
          // Use server AI parsing if available and enabled
          console.log('🎤 Parsing transcript with server AI:', result.transcript);
          console.log('🤖 Server AI Available:', aiAvailableRef.current, 'Use AI:', useAI);
          
          const command = (useAI && aiAvailableRef.current) 
            ? await parseWithServerAI(result.transcript)
            : await parseWithServerAI(result.transcript); // Always use server AI parsing
          
          console.log('📊 Parsed command:', command);
          onCommand(command);
        } catch (error) {
          console.error('❌ Error parsing command:', error);
          // Fallback parsing on error
          const command = await parseWithServerAI(result.transcript);
          onCommand(command);
        }
        
        // Reset immediately after processing - no delay
        setIsProcessing(false);
        onProcessingChange?.(false);
        setTranscript('');
        reset();
      }
    },
    onError: (error) => {
      console.error('Speech recognition error:', error);
      setIsRecording(false);
    }
  });

  const handleToggleRecording = () => {
    if (isRecording) {
      stopListening();
      setIsRecording(false);
    } else {
      if (isSupported) {
        startListening();
        setIsRecording(true);
      } else {
        // Fallback: record audio and send to server for transcription
        startMediaRecorderFallback();
      }
    }
  };

  const handleReset = () => {
    reset();
    setTranscript('');
    setIsRecording(false);
    setIsProcessing(false);
  };

  // MediaRecorder fallback for browsers without Web Speech API
  let mediaRecorder: MediaRecorder | null = null;
  const chunks: BlobPart[] = [];
  async function startMediaRecorderFallback() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };
      mediaRecorder.onstop = async () => {
        setIsProcessing(true);
        onProcessingChange?.(true);
        const blob = new Blob(chunks, { type: 'audio/webm' });
        try {
          const text = await transcribeFallback(blob);
          setTranscript(text);
          onTranscription(text);
          const command = await parseWithServerAI(text);
          onCommand(command);
        } catch (e) {
          console.error('Transcription fallback error', e);
        } finally {
          setIsProcessing(false);
          onProcessingChange?.(false);
          setTranscript('');
        }
      };
      mediaRecorder.start();
      setIsRecording(true);
      // Auto stop after 10s to avoid long recordings
      setTimeout(() => {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
        setIsRecording(false);
      }, 10000);
    } catch (e) {
      console.error('MediaRecorder not available', e);
    }
  }

  if (!isSupported) {
    return (
      <div className="flex items-center justify-center p-8 text-center">
        <div className="text-red-500">
          <MicOff className="w-8 h-8 mx-auto mb-2" />
          <p>Speech recognition not supported in this browser</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center space-y-4">
      {/* Recording Button */}
      <motion.button
        onClick={handleToggleRecording}
        disabled={isProcessing}
        className={`
          relative w-20 h-20 rounded-full flex items-center justify-center
          transition-all duration-300 transform
          ${isRecording 
            ? 'bg-red-500 hover:bg-red-600 scale-110 shadow-red-500/50 shadow-2xl' 
            : 'bg-blue-500 hover:bg-blue-600 hover:scale-105 shadow-blue-500/30 shadow-xl'
          }
          ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          shadow-lg hover:shadow-xl
        `}
        style={{
          boxShadow: isRecording 
            ? '0 0 20px rgba(239, 68, 68, 0.4), 0 0 40px rgba(239, 68, 68, 0.2)' 
            : '0 0 15px rgba(59, 130, 246, 0.3), 0 0 30px rgba(59, 130, 246, 0.15)'
        }}
        whileHover={{ scale: isProcessing ? 1 : 1.05 }}
        whileTap={{ scale: isProcessing ? 1 : 0.95 }}
        animate={isRecording ? { scale: [1, 1.1, 1] } : {}}
        transition={{ duration: 1, repeat: isRecording ? Infinity : 0 }}
      >
        <AnimatePresence mode="wait">
          {isRecording ? (
            <motion.div
              key="stop"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
            >
              <Square className="w-8 h-8 text-white" />
            </motion.div>
          ) : (
            <motion.div
              key="mic"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
            >
              <Mic className="w-8 h-8 text-white" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Status Text */}
      <motion.div
        className="text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <div className="flex items-center justify-center gap-2 mb-2">
          <p className="text-sm text-gray-600">
            {isProcessing ? 'Processing...' : isRecording ? 'Listening...' : 'Click to start recording'}
          </p>
          {aiAvailable && (
            <span className="px-2 py-1 text-xs font-medium bg-gradient-to-r from-purple-400 to-fuchsia-500 text-white rounded-full border border-purple-300 shadow-sm">
              AI Powered
            </span>

          )}
        </div>
        

      </motion.div>


    </div>
  );
};
