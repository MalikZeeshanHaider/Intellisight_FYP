/**
 * Live Camera Feed Component
 * Displays webcam stream with real-time face detection boxes
 */

import React, { useRef, useEffect, useState } from 'react';
import Webcam from 'react-webcam';
import { FiCamera, FiAlertCircle } from 'react-icons/fi';
import { motion } from 'framer-motion';

const LiveCameraFeed = ({ 
  webcamRef,
  cameraLabel = "Zone 1 - Live Camera Feed",
  cameraType = "Entry",
  onFaceDetection, 
  isProcessing, 
  detections = [],
  matches = []
}) => {
  const localWebcamRef = useRef(null);
  const canvasRef = useRef(null);
  const [cameraError, setCameraError] = useState(null);
  const [cameraReady, setCameraReady] = useState(false);
  
  // Use provided ref or local ref
  const activeWebcamRef = localWebcamRef;

  // If webcamRef is a function, call it when webcam is ready
  useEffect(() => {
    if (typeof webcamRef === 'function' && localWebcamRef.current) {
      webcamRef(localWebcamRef.current);
    }
  }, [webcamRef, cameraReady]);

  // Video constraints
  const videoConstraints = {
    width: 640,
    height: 480,
    facingMode: "user"
  };

  // Camera type colors
  const cameraColors = {
    'Entry': '#10B981', // Green
    'Exit': '#F97316'   // Orange
  };

  useEffect(() => {
    // Draw face boxes on canvas
    console.log('🎨 Drawing detections:', detections.length);
    
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      // Always clear canvas first
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      if (detections.length > 0) {
        console.log('🖼️ Canvas dimensions:', canvas.width, 'x', canvas.height);

        // Draw each detection
        detections.forEach((detection, index) => {
          try {
            const box = detection.detection.box;
            const match = matches[index];

            console.log(`📦 Drawing box ${index}:`, box, 'Match:', match?.name || 'Unknown');

            // Draw bounding box
            ctx.strokeStyle = match ? '#10B981' : '#EF4444'; // Green = recognized, Red = unknown
            ctx.lineWidth = 4;
            ctx.strokeRect(box.x, box.y, box.width, box.height);

            // Draw label background
            const label = match ? `${match.name} (${(match.confidence * 100).toFixed(0)}%)` : 'Unknown Person';
            const labelHeight = 30;
            const labelPadding = 8;

            ctx.fillStyle = match ? '#10B981' : '#EF4444';
            ctx.fillRect(box.x, box.y - labelHeight, box.width, labelHeight);

            // Draw label text
            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 16px Arial';
            ctx.fillText(label, box.x + labelPadding, box.y - 8);

            // Draw type badge for matches
            if (match) {
              ctx.font = 'bold 12px Arial';
              ctx.fillText(match.type, box.x + labelPadding, box.y + box.height - 8);
            }
          } catch (error) {
            console.error('Error drawing detection:', error);
          }
        });
      }
    }
  }, [detections, matches]);

  const handleCameraReady = () => {
    console.log('📷 Camera ready');
    setCameraReady(true);
    setCameraError(null);
  };

  const handleCameraError = (error) => {
    console.error('Camera error:', error);
    setCameraError('Failed to access camera. Please check permissions.');
    setCameraReady(false);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative bg-gradient-to-br from-gray-900 via-black to-gray-900 rounded-xl overflow-hidden shadow-2xl border-2 border-cyan-500/30 dark:border-cyan-400/40"
    >
      {/* Animated Border Glow */}
      <div className="absolute inset-0 rounded-xl pointer-events-none">
        <div className="absolute inset-0 rounded-xl border-2 border-cyan-500/50 dark:border-cyan-400/60 animate-pulse"></div>
      </div>

      {/* Scan Line Effect */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-10 rounded-xl">
        <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/10 via-transparent to-transparent animate-scan"></div>
      </div>

      {/* Camera Feed */}
      <div className="relative" style={{ width: '640px', height: '480px' }}>
        <Webcam
          ref={activeWebcamRef}
          audio={false}
          screenshotFormat="image/jpeg"
          videoConstraints={videoConstraints}
          onUserMedia={handleCameraReady}
          onUserMediaError={handleCameraError}
          mirrored={false}
          className="absolute top-0 left-0 w-full h-full object-cover"
        />

        {/* Canvas overlay for face boxes */}
        <canvas
          ref={canvasRef}
          width={640}
          height={480}
          className="absolute top-0 left-0 w-full h-full pointer-events-none"
        />

        {/* Loading overlay */}
        {!cameraReady && !cameraError && (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-900 via-black to-gray-900 backdrop-blur-sm z-20">
            <div className="text-center text-white">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 shadow-lg shadow-cyan-500/50 mb-4"></div>
              <p className="text-lg font-semibold bg-gradient-to-r from-cyan-300 to-blue-400 bg-clip-text text-transparent">Initializing camera...</p>
            </div>
          </div>
        )}

        {/* Error overlay */}
        {cameraError && (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-900 via-black to-gray-900 backdrop-blur-sm z-20">
            <div className="text-center text-white max-w-md mx-4">
              <FiAlertCircle size={48} className="mx-auto mb-4 text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.5)]" />
              <p className="text-lg mb-2 font-semibold">Camera Access Error</p>
              <p className="text-sm text-gray-400">{cameraError}</p>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => window.location.reload()}
                className="mt-4 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-lg shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 transition-shadow"
              >
                Retry
              </motion.button>
            </div>
          </div>
        )}

        {/* Processing indicator */}
        {isProcessing && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute top-4 left-4 bg-cyan-500/20 backdrop-blur-md border border-cyan-500/40 text-cyan-100 px-3 py-1 rounded-full text-sm flex items-center space-x-2 shadow-lg shadow-cyan-500/30 z-20"
          >
            <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse shadow-lg shadow-cyan-400/50"></div>
            <span>Processing...</span>
          </motion.div>
        )}

        {/* Detection count */}
        <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md border border-purple-500/40 text-white px-3 py-1 rounded-full text-sm shadow-lg shadow-purple-500/20 z-20">
          <FiCamera className="inline mr-1 text-purple-400" />
          <span className="text-purple-100">{detections.length} face{detections.length !== 1 ? 's' : ''} detected</span>
        </div>

        {/* Status indicator */}
        <div className="absolute bottom-4 left-4 flex items-center space-x-2 bg-black/60 backdrop-blur-md border border-green-500/40 px-3 py-1 rounded-full shadow-lg shadow-green-500/20 z-20">
          <div className={`w-3 h-3 rounded-full ${cameraReady ? 'bg-green-500 shadow-lg shadow-green-500/50' : 'bg-red-500 shadow-lg shadow-red-500/50'} animate-pulse`}></div>
          <span className={`text-sm font-bold ${cameraReady ? 'text-green-400' : 'text-red-400'}`}>
            {cameraReady ? 'LIVE' : 'OFFLINE'}
          </span>
        </div>
      </div>

      {/* Camera info */}
      <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 backdrop-blur-xl px-4 py-2 text-sm border-t border-cyan-500/20 relative z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div 
              className="w-2 h-2 rounded-full shadow-lg" 
              style={{ 
                backgroundColor: cameraColors[cameraType] || '#10B981',
                boxShadow: `0 0 10px ${cameraColors[cameraType] || '#10B981'}50`
              }}
            ></div>
            <span className="font-medium text-gray-200">{cameraLabel}</span>
            <span className="text-xs px-2 py-0.5 rounded-full border" style={{
              color: cameraColors[cameraType] || '#10B981',
              borderColor: `${cameraColors[cameraType] || '#10B981'}40`,
              backgroundColor: `${cameraColors[cameraType] || '#10B981'}10`
            }}>({cameraType})</span>
          </div>
          <span className="text-xs text-cyan-400">640 x 480 @ 30fps</span>
        </div>
      </div>
    </motion.div>
  );
};

export default LiveCameraFeed;
