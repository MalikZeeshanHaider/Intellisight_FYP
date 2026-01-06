import React from 'react';
import { motion } from 'framer-motion';
import { FiTrash2 } from 'react-icons/fi';

const DeleteConfirmModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title = "Delete Item",
  message = "Are you sure you want to delete this item? This action cannot be undone.",
  confirmText = "Delete",
  cancelText = "Cancel"
}) => {
  if (!isOpen) return null;

  const isDarkMode = document.documentElement.classList.contains('dark');

  return (
    <div 
      className="fixed inset-0 flex items-center justify-center z-50 p-4"
      style={{
        background: isDarkMode ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.4)',
        backdropFilter: 'blur(10px)'
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-2xl p-8 max-w-md w-full shadow-2xl"
        style={{
          background: isDarkMode 
            ? 'linear-gradient(135deg, rgba(15, 23, 42, 0.98), rgba(30, 41, 59, 0.95))'
            : 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(20px)',
          border: isDarkMode ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(185, 28, 28, 0.3)',
          boxShadow: isDarkMode 
            ? '0 20px 60px rgba(0, 0, 0, 0.7), 0 0 40px rgba(239, 68, 68, 0.1)'
            : '0 20px 60px rgba(0, 0, 0, 0.5)'
        }}
      >
        <div className="text-center">
          <div 
            className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4"
            style={{
              background: isDarkMode ? 'rgba(239, 68, 68, 0.2)' : 'rgba(185, 28, 28, 0.15)',
              border: isDarkMode ? '1px solid rgba(239, 68, 68, 0.5)' : '1px solid rgba(185, 28, 28, 0.4)',
              boxShadow: isDarkMode ? '0 0 20px rgba(239, 68, 68, 0.2)' : 'none'
            }}
          >
            <FiTrash2 className="text-3xl" style={{ color: isDarkMode ? '#f87171' : '#991b1b' }} />
          </div>
          <h2 className="text-2xl font-bold mb-2" style={{ color: isDarkMode ? '#c0f0f0' : '#182440' }}>
            {title}
          </h2>
          <p className="mb-6" style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.7)' : '#475569' }}>
            {message}
          </p>
          
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-6 py-3 rounded-xl font-medium transition-all duration-300"
              style={{
                background: isDarkMode ? 'rgba(100, 116, 139, 0.2)' : 'rgba(71, 85, 105, 0.15)',
                border: isDarkMode ? '1px solid rgba(148, 163, 184, 0.3)' : '1px solid rgba(71, 85, 105, 0.4)',
                color: isDarkMode ? '#94a3b8' : '#334155'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = isDarkMode ? 'rgba(100, 116, 139, 0.3)' : 'rgba(71, 85, 105, 0.25)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = isDarkMode ? 'rgba(100, 116, 139, 0.2)' : 'rgba(71, 85, 105, 0.15)';
              }}
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 px-6 py-3 rounded-xl font-medium transition-all duration-300"
              style={{
                background: isDarkMode ? 'rgba(239, 68, 68, 0.2)' : 'rgba(185, 28, 28, 0.15)',
                border: isDarkMode ? '1px solid rgba(239, 68, 68, 0.5)' : '1px solid rgba(185, 28, 28, 0.5)',
                color: isDarkMode ? '#f87171' : '#991b1b'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = isDarkMode ? 'rgba(239, 68, 68, 0.3)' : 'rgba(185, 28, 28, 0.25)';
                e.currentTarget.style.boxShadow = isDarkMode ? '0 0 20px rgba(239, 68, 68, 0.3)' : 'none';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = isDarkMode ? 'rgba(239, 68, 68, 0.2)' : 'rgba(185, 28, 28, 0.15)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default DeleteConfirmModal;
