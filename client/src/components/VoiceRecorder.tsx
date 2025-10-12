import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Square } from 'lucide-react';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { parseIntent } from '../utils/parseIntent';
import { VoiceCommand } from '@shared/types';

interface VoiceRecorderProps {
  onCommand: (command: VoiceCommand | VoiceCommand[]) => void;
  onTranscription: (text: string) => void;
}

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({ onCommand, onTranscription }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const { isSupported, startListening, stopListening, reset } = useSpeechRecognition({
    onResult: (result) => {
      setTranscript(result.transcript);
      onTranscription(result.transcript);
      
      if (result.isFinal) {
        setIsProcessing(true);
        const command = parseIntent(result.transcript);
        onCommand(command);
        
        // Reset after processing
        setTimeout(() => {
          setIsProcessing(false);
          setTranscript('');
          reset();
        }, 1000);
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
      startListening();
      setIsRecording(true);
    }
  };

  const handleReset = () => {
    reset();
    setTranscript('');
    setIsRecording(false);
    setIsProcessing(false);
  };

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
            ? 'bg-red-500 hover:bg-red-600 scale-110' 
            : 'bg-blue-500 hover:bg-blue-600 hover:scale-105'
          }
          ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          shadow-lg hover:shadow-xl
        `}
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
        <p className="text-sm text-gray-600 mb-2">
          {isProcessing ? 'Processing...' : isRecording ? 'Listening...' : 'Click to start recording'}
        </p>
        
        {transcript && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gray-100 rounded-lg p-3 max-w-md"
          >
            <p className="text-sm text-gray-700 italic">"{transcript}"</p>
          </motion.div>
        )}
      </motion.div>

      {/* Reset Button */}
      {(transcript || isProcessing) && (
        <motion.button
          onClick={handleReset}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
        >
          Clear
        </motion.button>
      )}
    </div>
  );
};
