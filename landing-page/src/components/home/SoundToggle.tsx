'use client';

import { Volume2, VolumeX } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

interface SoundToggleProps {
  isMuted: boolean;
  onToggle: () => void;
  className?: string;
}

const SoundToggle: React.FC<SoundToggleProps> = ({ isMuted, onToggle, className }) => {
  return (
    <motion.button
      className={cn(
        'fixed bottom-6 right-6 z-50 p-3 rounded-full glass-premium',
        'hover:scale-110 transition-transform duration-300',
        className
      )}
      onClick={onToggle}
      whileTap={{ scale: 0.95 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1, duration: 0.5 }}
      aria-label={isMuted ? 'Unmute sounds' : 'Mute sounds'}
    >
      <motion.div
        initial={false}
        animate={{ rotate: isMuted ? 0 : 360 }}
        transition={{ duration: 0.3 }}
      >
        {isMuted ? (
          <VolumeX className="w-5 h-5 text-muted-foreground" />
        ) : (
          <Volume2 className="w-5 h-5 text-primary" />
        )}
      </motion.div>
      
      {/* Animated ring when sound is on */}
      {!isMuted && (
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-primary"
          initial={{ scale: 1, opacity: 0.5 }}
          animate={{ scale: 1.5, opacity: 0 }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      )}
    </motion.button>
  );
};

export default SoundToggle;
