export const compressImage = (file: File, maxWidth = 300): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ratio = Math.min(1, maxWidth / img.width);
        canvas.width = img.width * ratio;
        canvas.height = img.height * ratio;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(event.target?.result as string);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.5)); // 50% quality JPEG
      };
      img.onerror = () => reject(new Error("Failed to load image. Please use a valid image file (JPG, PNG)."));
      img.src = event.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Failed to read file. Please try again."));
  });
};
