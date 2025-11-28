/**
 * Live Camera Feed Component
 * Displays webcam stream with real-time face detection boxes
 */

import React, { useRef, useEffect, useState } from 'react';
import Webcam from 'react-webcam';
import { FiCamera, FiAlertCircle } from 'react-icons/fi';

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
    <div className="relative bg-gray-900 rounded-lg overflow-hidden shadow-lg">
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
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
            <div className="text-center text-white">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4"></div>
              <p className="text-lg">Initializing camera...</p>
            </div>
          </div>
        )}

        {/* Error overlay */}
        {cameraError && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
            <div className="text-center text-white max-w-md mx-4">
              <FiAlertCircle size={48} className="mx-auto mb-4 text-red-500" />
              <p className="text-lg mb-2">Camera Access Error</p>
              <p className="text-sm text-gray-400">{cameraError}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Processing indicator */}
        {isProcessing && (
          <div className="absolute top-4 left-4 bg-blue-600 text-white px-3 py-1 rounded-full text-sm flex items-center space-x-2">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
            <span>Processing...</span>
          </div>
        )}

        {/* Detection count */}
        <div className="absolute top-4 right-4 bg-black bg-opacity-70 text-white px-3 py-1 rounded-full text-sm">
          <FiCamera className="inline mr-1" />
          {detections.length} face{detections.length !== 1 ? 's' : ''} detected
        </div>

        {/* Status indicator */}
        <div className="absolute bottom-4 left-4 flex items-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${cameraReady ? 'bg-green-500' : 'bg-red-500'} animate-pulse`}></div>
          <span className="text-white text-sm font-medium">
            {cameraReady ? 'LIVE' : 'OFFLINE'}
          </span>
        </div>
      </div>

      {/* Camera info */}
      <div className="bg-gray-800 px-4 py-2 text-sm text-gray-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div 
              className="w-2 h-2 rounded-full" 
              style={{ backgroundColor: cameraColors[cameraType] || '#10B981' }}
            ></div>
            <span className="font-medium">{cameraLabel}</span>
            <span className="text-xs text-gray-400">({cameraType})</span>
          </div>
          <span className="text-xs">640 x 480 @ 30fps</span>
        </div>
      </div>
    </div>
  );
};

export default LiveCameraFeed;
