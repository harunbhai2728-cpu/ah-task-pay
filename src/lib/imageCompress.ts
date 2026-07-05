export const compressImage = (file: File, maxWidth = 1080): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        
        // Define a strict minimum width of 1080px for screenshots to ensure text readability.
        // We take the max of 1080 and the requested maxWidth parameter.
        const targetWidth = Math.max(1080, maxWidth);
        
        let width = img.width;
        let height = img.height;
        
        // If the original width is larger than the target width, downscale to the target width
        // while preserving the original aspect ratio. If it is smaller, keep the original size
        // to prevent blurry upscaling.
        if (img.width > targetWidth) {
          const ratio = targetWidth / img.width;
          width = targetWidth;
          height = img.height * ratio;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(event.target?.result as string);
        
        // Configure high-quality image smoothing for canvas scaling to preserve text sharpness
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        // Convert to high-quality WebP format.
        // A quality threshold of 0.88 (88%) ensures text remains perfectly sharp and readable 
        // while delivering 30-50% smaller file sizes compared to PNG/uncompressed formats.
        const dataUrl = canvas.toDataURL('image/webp', 0.88);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error("Failed to load image. Please use a valid image file (JPG, PNG)."));
      img.src = event.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Failed to read file. Please try again."));
  });
};

