
/**
 * Utility for handling "MD5" (obfuscated) and plain API keys.
 * Note: Real MD5 is a hash and cannot be decrypted. 
 * In this context, we implement a reversible obfuscation (Base64) 
 * which is commonly used when users ask for "MD5 encryption" for API keys.
 */

/**
 * Decrypts a key if it's obfuscated.
 * If it's a plain Gemini key (starts with AIza), returns it as is.
 */
export const decryptKey = (key: string): string => {
  const trimmedKey = key.trim();
  
  // If it looks like a plain Gemini key, return it
  if (trimmedKey.startsWith('AIza')) {
    return trimmedKey;
  }

  try {
    // Try to decode as Base64 (often what users mean by "MD5 encryption" in this context)
    const decoded = atob(trimmedKey);
    if (decoded.startsWith('AIza')) {
      return decoded;
    }
  } catch (e) {
    // Not a valid Base64 or doesn't decode to a Gemini key
  }

  // If all else fails, return the original key
  return trimmedKey;
};

/**
 * Simple MD5 implementation for identification/hashing if needed.
 */
export const md5 = (str: string): string => {
  // This is a placeholder for a real MD5 if needed for hashing.
  // For now, we focus on the "decryption" part requested by the user.
  return btoa(str).substring(0, 32); // Mock MD5-like string
};
