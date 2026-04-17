// Firebase is fully replaced by Supabase.
// This file maintains the same exports to prevent breaking any remaining imports.

export const isFirebaseEnabled = false;

export const db: any = null;
export const auth: any = {
  onAuthStateChanged: (callback: any) => {
    // Simulate auth ready for local operation
    setTimeout(() => callback({ uid: 'local-user' }), 0);
    return () => {};
  },
  currentUser: { uid: 'local-user' }
};

export const ensureAnonymousAuth = async () => {
  return;
};
