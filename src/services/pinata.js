const PINATA_API_KEY = import.meta.env.VITE_PINATA_API_KEY;
const PINATA_SECRET_API_KEY = import.meta.env.VITE_PINATA_SECRET_API_KEY;
const PINATA_JWT = import.meta.env.VITE_PINATA_JWT;

// Use JWT if available, otherwise fallback to API keys
const getAuthHeaders = () => {
  if (PINATA_JWT) {
    return {
      'Authorization': `Bearer ${PINATA_JWT}`
    };
  } else if (PINATA_API_KEY && PINATA_SECRET_API_KEY) {
    return {
      'pinata_api_key': PINATA_API_KEY,
      'pinata_secret_api_key': PINATA_SECRET_API_KEY
    };
  } else {
    throw new Error('Pinata credentials not configured');
  }
};

export const uploadImageToPinata = async (file) => {
  try {
    // Validate file
    if (!file) {
      throw new Error('No file provided');
    }

    // Check file type
    if (!file.type.startsWith('image/')) {
      throw new Error('File must be an image');
    }

    // Check file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      throw new Error('Image must be smaller than 10MB');
    }

    // Compress image if it's too large
    const compressedFile = await compressImage(file);

    // Create form data
    const formData = new FormData();
    formData.append('file', compressedFile);

    // Add metadata
    const metadata = JSON.stringify({
      name: `portal-event-${Date.now()}`,
      keyvalues: {
        uploadedBy: 'portal-app',
        timestamp: new Date().toISOString(),
        originalName: file.name
      }
    });
    formData.append('pinataMetadata', metadata);

    // Upload options
    const options = JSON.stringify({
      cidVersion: 1,
      wrapWithDirectory: false
    });
    formData.append('pinataOptions', options);

    // Make the upload request
    const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.error?.details || `Upload failed: ${response.status}`);
    }

    const result = await response.json();
    
    return {
      ipfsHash: result.IpfsHash,
      url: `https://gateway.pinata.cloud/ipfs/${result.IpfsHash}`,
      size: compressedFile.size,
      timestamp: result.Timestamp
    };

  } catch (error) {
    console.error('Pinata upload error:', error);
    throw new Error(`Failed to upload image: ${error.message}`);
  }
};

// Image compression utility
const compressImage = async (file, maxWidth = 1200, quality = 0.8) => {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      // Calculate new dimensions
      let { width, height } = img;
      
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }

      // Set canvas size
      canvas.width = width;
      canvas.height = height;

      // Draw and compress
      ctx.drawImage(img, 0, 0, width, height);
      
      canvas.toBlob(
        (blob) => {
          const compressedFile = new File([blob], file.name, {
            type: file.type,
            lastModified: Date.now()
          });
          resolve(compressedFile);
        },
        file.type,
        quality
      );
    };

    img.src = URL.createObjectURL(file);
  });
};

// Test connection to Pinata
export const testPinataConnection = async () => {
  try {
    const response = await fetch('https://api.pinata.cloud/data/testAuthentication', {
      method: 'GET',
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error(`Authentication failed: ${response.status}`);
    }

    const result = await response.json();
    return { success: true, message: result.message };
  } catch (error) {
    console.error('Pinata connection test failed:', error);
    return { success: false, error: error.message };
  }
};

// Get file info from IPFS hash
export const getFileInfo = async (ipfsHash) => {
  try {
    const response = await fetch(`https://gateway.pinata.cloud/ipfs/${ipfsHash}`, {
      method: 'HEAD'
    });

    return {
      exists: response.ok,
      size: response.headers.get('content-length'),
      type: response.headers.get('content-type')
    };
  } catch (error) {
    console.error('Error checking file info:', error);
    return { exists: false };
  }
};