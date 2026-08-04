import imageCompression from 'browser-image-compression';

export const compressImage = async (file: File, maxWidthOrHeight = 1080, maxSizeMB = 0.03): Promise<string> => {
  try {
    const options = {
      maxSizeMB: maxSizeMB, // 0.03 MB = 30 KB
      maxWidthOrHeight: maxWidthOrHeight,
      useWebWorker: true,
      initialQuality: 0.8,
    };
    
    const compressedFile = await imageCompression(file, options);
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(compressedFile);
      reader.onload = (event) => resolve(event.target?.result as string);
      reader.onerror = () => reject(new Error("Failed to read file. Please try again."));
    });
  } catch (error) {
    console.error('Error during image compression:', error);
    throw new Error("Failed to compress image. Please try again.");
  }
};
