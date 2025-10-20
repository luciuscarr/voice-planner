import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HelpCircle, X, Mic, Calendar, AlertCircle, CheckCircle } from 'lucide-react';

// Just a simple overlay for the voice commands guide.
// No detailed functionality.

interface CommandHintProps {
  isVisible: boolean;
  onClose: () => void;
}

const exampleCommands = [
  {
    icon: <Mic className="w-4 h-4" />,
    text: "Add meeting with Alex tomorrow at 3pm",
    description: "Creates a new task with due date"
  },
  {
    icon: <AlertCircle className="w-4 h-4" />,
    text: "Remind me to call the dentist",
    description: "Creates a reminder task"
  },
  {
    icon: <Calendar className="w-4 h-4" />,
    text: "Schedule team standup for next Monday",
    description: "Creates a scheduled task"
  },
  {
    icon: <CheckCircle className="w-4 h-4" />,
    text: "Note: Project deadline is Friday",
    description: "Creates a note with high priority"
  }
];

const voiceTips = [
  "Speak clearly and at a normal pace",
  "Use natural language - the app understands context",
  "Include time references like 'tomorrow', 'next week', or 'at 3pm'",
  "Mention priority with words like 'urgent', 'important', or 'low priority'",
  "You can edit tasks after they're created"
];

export const CommandHint: React.FC<CommandHintProps> = ({ isVisible, onClose }) => {
  const [activeTab, setActiveTab] = useState<'examples' | 'tips'>('examples');

  if (!isVisible) return null;

  return (
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60]"
            onClick={onClose}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="relative bg-[#0a0015]/80 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_0_40px_-10px_rgba(128,0,255,0.4)] max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-white/10">
                <div className="flex items-center space-x-2">
                  <HelpCircle className="w-6 h-6 text-purple-400" />
                  <h2 className="text-xl font-semibold text-white">Voice Commands Guide</h2>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
    
              {/* Tabs */}
              <div className="flex border-b border-white/10">
                <button
                  onClick={() => setActiveTab('examples')}
                  className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
                    activeTab === 'examples'
                      ? 'text-purple-400 border-b-2 border-purple-400'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Example Commands
                </button>
                <button
                  onClick={() => setActiveTab('tips')}
                  className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
                    activeTab === 'tips'
                      ? 'text-purple-400 border-b-2 border-purple-400'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Voice Tips
                </button>
              </div>
    
              {/* Content */}
              <div className="p-6 max-h-96 overflow-y-auto text-gray-200">
                <AnimatePresence mode="wait">
                  {activeTab === 'examples' ? (
                    <motion.div
                      key="examples"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-4"
                    >
                      <p className="text-sm text-gray-400 mb-4">
                        Try these voice commands to get started:
                      </p>
                      {exampleCommands.map((command, index) => (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className="flex items-start space-x-3 p-4 bg-white/5 rounded-lg border border-white/10"
                        >
                          <div className="text-purple-400 mt-1">{command.icon}</div>
                          <div className="flex-1">
                            <p className="font-medium text-white">"{command.text}"</p>
                            <p className="text-sm text-gray-400 mt-1">{command.description}</p>
                          </div>
                        </motion.div>
                      ))}
                    </motion.div>
                  ) : (
                    <motion.div
                      key="tips"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-4"
                    >
                      <p className="text-sm text-gray-400 mb-4">
                        For best results when using voice commands:
                      </p>
                      {voiceTips.map((tip, index) => (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className="flex items-start space-x-3"
                        >
                          <div className="w-2 h-2 bg-purple-400 rounded-full mt-2 flex-shrink-0" />
                          <p className="text-sm text-gray-300">{tip}</p>
                        </motion.div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
    
              {/* Footer */}
              <div className="px-6 py-4 bg-white/5 border-t border-white/10 text-center">
                <p className="text-xs text-gray-400">
                  Click the microphone button to start recording your voice commands
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    );
    
};
