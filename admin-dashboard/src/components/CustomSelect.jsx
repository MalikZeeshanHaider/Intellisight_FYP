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
    <div ref={selectRef} className={`relative ${className}`} style={{ zIndex: isOpen ? 9999 : 'auto' }}>
      {/* Select Button */}
      <motion.button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 rounded-xl text-left flex items-center justify-between
                   bg-transparent border-2 transition-all duration-300 font-medium"
        style={{
          borderColor: isOpen 
            ? '#003d82' 
            : 'rgba(0, 61, 130, 0.2)',
          boxShadow: isOpen 
            ? '0 0 0 3px rgba(0, 61, 130, 0.1)' 
            : '0 2px 4px rgba(0, 61, 130, 0.05)',
          color: 'var(--text-main)'
        }}
        whileHover={{
          borderColor: '#305796',
          boxShadow: '0 0 0 3px rgba(48, 87, 150, 0.1)'
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
            style={{ color: '#305796' }}
            size={20}
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
            className="absolute w-full mt-2 rounded-xl overflow-hidden border-2"
            style={{
              zIndex: 99999,
              backdropFilter: 'blur(20px)',
              boxShadow: document.documentElement.classList.contains('dark')
                ? '0 8px 32px rgba(0, 0, 0, 0.3), 0 0 20px rgba(48, 87, 150, 0.2)'
                : '0 4px 16px rgba(0, 61, 130, 0.15), 0 0 0 1px rgba(0, 61, 130, 0.1)',
              borderColor: document.documentElement.classList.contains('dark')
                ? 'rgba(48, 87, 150, 0.3)'
                : 'rgba(0, 61, 130, 0.2)',
              maxHeight: '300px',
              overflowY: 'auto',
              background: document.documentElement.classList.contains('dark')
                ? 'rgba(13, 27, 36, 0.95)'
                : 'rgba(255, 255, 255, 0.98)'
            }}
          >
            {options.map((option, index) => (
              <motion.button
                key={option.value}
                type="button"
                onClick={() => handleSelect(option.value)}
                className="w-full px-4 py-3 text-left transition-all duration-300
                           font-medium border-b last:border-b-0"
                style={{
                  color: 'var(--text-main)',
                  background: value === option.value
                    ? (document.documentElement.classList.contains('dark')
                      ? 'rgba(48, 87, 150, 0.3)'
                      : 'rgba(0, 61, 130, 0.1)')
                    : 'transparent',
                  borderColor: document.documentElement.classList.contains('dark')
                    ? 'rgba(48, 87, 150, 0.1)'
                    : 'rgba(0, 61, 130, 0.08)'
                }}
                whileHover={{
                  background: document.documentElement.classList.contains('dark')
                    ? 'rgba(48, 87, 150, 0.25)'
                    : 'rgba(0, 61, 130, 0.08)',
                  color: '#003d82'
                }}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.02 }}
              >
                <span style={{
                  fontWeight: value === option.value ? 700 : 500
                }}>
                  {option.label}
                </span>
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Custom Scrollbar for dropdown */}
      <style jsx>{`
        .absolute::-webkit-scrollbar {
          width: 6px;
        }
        .absolute::-webkit-scrollbar-track {
          background: rgba(0, 61, 130, 0.1);
          border-radius: 10px;
        }
        .absolute::-webkit-scrollbar-thumb {
          background: rgba(0, 61, 130, 0.5);
          border-radius: 10px;
        }
        .absolute::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 61, 130, 0.7);
        }
      `}</style>
    </div>
  );
};

export default CustomSelect;
