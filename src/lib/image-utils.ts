/**
 * Resizes a base64 image to a maximum width/height while maintaining aspect ratio.
 * This is crucial for mobile uploads to stay under Firestore's 1MB limit.
 */
export async function resizeImage(base64Str: string, maxWidth = 800, maxHeight = 800): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height *= maxWidth / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width *= maxHeight / height;
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      // Use jpeg with 0.7 quality to significantly reduce file size
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = (e) => reject(e);
  });
}
