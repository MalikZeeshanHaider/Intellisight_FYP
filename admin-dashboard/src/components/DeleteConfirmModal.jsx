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

  return (
    <div 
      className="fixed inset-0 flex items-center justify-center z-50 p-4"
      style={{
        background: 'rgba(0, 0, 0, 0.4)',
        backdropFilter: 'blur(10px)'
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-2xl p-8 max-w-md w-full shadow-2xl"
        style={{
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(185, 28, 28, 0.3)',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)'
        }}
      >
        <div className="text-center">
          <div 
            className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4"
            style={{
              background: 'rgba(185, 28, 28, 0.15)',
              border: '1px solid rgba(185, 28, 28, 0.4)'
            }}
          >
            <FiTrash2 className="text-3xl" style={{ color: '#991b1b' }} />
          </div>
          <h2 className="text-2xl font-bold mb-2" style={{ color: '#182440' }}>
            {title}
          </h2>
          <p className="mb-6" style={{ color: '#475569' }}>
            {message}
          </p>
          
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-6 py-3 rounded-xl font-medium transition-all duration-300"
              style={{
                background: 'rgba(71, 85, 105, 0.15)',
                border: '1px solid rgba(71, 85, 105, 0.4)',
                color: '#334155'
              }}
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 px-6 py-3 rounded-xl font-medium transition-all duration-300"
              style={{
                background: 'rgba(185, 28, 28, 0.15)',
                border: '1px solid rgba(185, 28, 28, 0.5)',
                color: '#991b1b'
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
