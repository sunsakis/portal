import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { uploadImageToPinata } from '../services/pinata';

const ImageUpload = ({ onImageUploaded, currentImage, className = "" }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileSelect = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setError(null);
    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      const result = await uploadImageToPinata(file);
      
      clearInterval(progressInterval);
      setUploadProgress(100);

      // Call parent callback with image data
      onImageUploaded({
        url: result.url,
        ipfsHash: result.ipfsHash,
        size: result.size,
        originalName: file.name
      });

      // Clear progress after a brief success display
      setTimeout(() => {
        setUploadProgress(0);
        setIsUploading(false);
      }, 1000);

    } catch (err) {
      console.error('Image upload failed:', err);
      setError(err.message);
      setIsUploading(false);
      setUploadProgress(0);
    }

    // Clear file input
    event.target.value = '';
  };

  const handleButtonClick = () => {
    if (isUploading) return;
    fileInputRef.current?.click();
  };

  const handleRemoveImage = () => {
    onImageUploaded(null);
    setError(null);
  };

  return (
    <div className={`relative ${className}`}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />
      
      <button
        type="button"
        onClick={handleButtonClick}
        disabled={isUploading}
        className="h-[42px] w-12 bg-gray-700 border border-gray-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors hover:bg-gray-600 flex items-center justify-center relative overflow-hidden"
        title={currentImage ? "Change image" : "Add image"}
      >
        {/* Upload progress overlay */}
        <AnimatePresence>
          {isUploading && (
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${uploadProgress}%` }}
              exit={{ width: 0 }}
              className="absolute left-0 top-0 h-full bg-blue-600/30"
            />
          )}
        </AnimatePresence>

        {isUploading ? (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="text-blue-400"
          >
            ⟳
          </motion.div>
        ) : currentImage ? (
          <span className="text-green-400 text-lg">🖼️</span>
        ) : (
          <span className="text-gray-400 text-lg">📷</span>
        )}
      </button>
      
      {/* Error display */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full left-0 mt-1 bg-red-900/90 text-red-300 text-xs p-2 rounded-lg shadow-lg z-50 max-w-xs"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Upload success feedback */}
      <AnimatePresence>
        {uploadProgress === 100 && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center"
          >
            <span className="text-white text-xs">✓</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ImageUpload;