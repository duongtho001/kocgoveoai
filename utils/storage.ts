
export const stripBase64 = (obj: any): any => {
  if (!obj) return obj;
  if (typeof obj === 'string') {
    // If it's a base64 image or video and larger than 100KB, strip it
    if ((obj.startsWith('data:image/') || obj.startsWith('data:video/') || obj.startsWith('data:audio/')) && obj.length > 102400) {
      return "";
    }
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(stripBase64);
  }
  if (typeof obj === 'object') {
    const newObj: any = {};
    for (const key in obj) {
      newObj[key] = stripBase64(obj[key]);
    }
    return newObj;
  }
  return obj;
};

export const safeSaveToLocalStorage = (key: string, data: any) => {
  try {
    const strippedData = stripBase64(data);
    localStorage.setItem(key, JSON.stringify(strippedData));
  } catch (e) {
    console.error(`Failed to save to localStorage for key: ${key}`, e);
    // If it still fails, try to clear everything and save only essential metadata
    try {
        // Fallback: remove all URLs if quota still exceeded
        const ultraStripped = JSON.parse(JSON.stringify(data, (k, v) => {
            if (typeof v === 'string' && (v.startsWith('data:image/') || v.startsWith('data:video/') || v.startsWith('data:audio/'))) return "";
            return v;
        }));
        localStorage.setItem(key, JSON.stringify(ultraStripped));
    } catch (innerE) {
        console.error("Critical failure saving to localStorage", innerE);
    }
  }
};
