import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiChevronDown } from 'react-icons/fi';

const CustomSelect = ({ 
  value, 
  onChange, 
  options, 
  placeholder = 'Select...', 
  className = '' 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (selectRef.current && !selectRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (optionValue) => {
    onChange({ target: { value: optionValue } });
    setIsOpen(false);
  };

  const selectedOption = options.find(opt => opt.value === value);

  return (
    <div ref={selectRef} className={`relative ${className}`}>
      {/* Select Button */}
      <motion.button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 rounded-xl text-left flex items-center justify-between
                   bg-transparent border-2 transition-all duration-300
                   dark:text-gray-200 text-gray-800"
        style={{
          borderColor: isOpen 
            ? 'rgba(139, 92, 246, 0.6)' 
            : 'rgba(139, 92, 246, 0.3)',
          boxShadow: isOpen 
            ? '0 0 20px rgba(139, 92, 246, 0.4), inset 0 0 20px rgba(139, 92, 246, 0.1)' 
            : 'none'
        }}
        whileHover={{
          borderColor: 'rgba(139, 92, 246, 0.5)',
          boxShadow: '0 0 15px rgba(139, 92, 246, 0.3)'
        }}
      >
        <span className={!selectedOption ? 'opacity-50' : ''}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.3 }}
        >
          <FiChevronDown 
            className="text-purple-400" 
            size={20}
            style={{
              filter: 'drop-shadow(0 0 4px rgba(139, 92, 246, 0.6))'
            }}
          />
        </motion.div>
      </motion.button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="absolute w-full mt-2 rounded-xl overflow-hidden border-2 border-purple-500/30"
            style={{
              zIndex: 9999,
              backdropFilter: 'blur(20px)',
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3), 0 0 20px rgba(139, 92, 246, 0.2)',
              maxHeight: '300px',
              overflowY: 'auto'
            }}
          >
            <div className="dark:bg-[#0D1B24]/95 bg-white/95">
              {options.map((option, index) => (
                <motion.button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option.value)}
                  className="w-full px-4 py-3 text-left transition-all duration-300
                             dark:text-gray-200 text-gray-800 font-medium
                             border-b border-purple-500/10 last:border-b-0"
                  style={{
                    background: value === option.value
                      ? 'linear-gradient(135deg, rgba(139, 92, 246, 0.4) 0%, rgba(168, 85, 247, 0.4) 100%)'
                      : 'transparent'
                  }}
                  whileHover={{
                    background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.3) 0%, rgba(168, 85, 247, 0.3) 100%)',
                    color: '#c4b5fd',
                    textShadow: '0 0 10px rgba(139, 92, 246, 0.8), 0 0 20px rgba(139, 92, 246, 0.5)'
                  }}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.02 }}
                >
                  <span style={{
                    textShadow: value === option.value 
                      ? '0 0 12px rgba(139, 92, 246, 1), 0 0 24px rgba(139, 92, 246, 0.6)'
                      : 'none',
                    fontWeight: value === option.value ? 700 : 500
                  }}>
                    {option.label}
                  </span>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Custom Scrollbar for dropdown */}
      <style jsx>{`
        .absolute::-webkit-scrollbar {
          width: 6px;
        }
        .absolute::-webkit-scrollbar-track {
          background: rgba(139, 92, 246, 0.1);
          border-radius: 10px;
        }
        .absolute::-webkit-scrollbar-thumb {
          background: rgba(139, 92, 246, 0.5);
          border-radius: 10px;
        }
        .absolute::-webkit-scrollbar-thumb:hover {
          background: rgba(139, 92, 246, 0.7);
        }
      `}</style>
    </div>
  );
};

export default CustomSelect;
