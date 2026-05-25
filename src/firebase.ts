import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  updateProfile, 
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider
} from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore";

// Your web app's Firebase configuration requested by the user
export const firebaseConfig = {
  apiKey: "AIzaSyCMfan_fLvAzBlQDoWoW4Sg8kb_CfHoaoE",
  authDomain: "musify-001.firebaseapp.com",
  projectId: "musify-001",
  storageBucket: "musify-001.firebasestorage.app",
  messagingSenderId: "286896273558",
  appId: "1:286896273558:web:fba0c34ce3952a3d6baab7",
  measurementId: "G-KY7P1403FS"
};

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Firestore and Auth
export const db = getFirestore(app);
export const auth = getAuth(app);

// Precise error logger conformant with FirestoreErrorInfo interface from SKILL.md
export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null,
      isAnonymous: auth.currentUser?.isAnonymous || null,
      tenantId: auth.currentUser?.tenantId || null,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  
  console.error("Firestore Permission/Access Error Detailed Payload:", JSON.stringify(errInfo, null, 2));
  throw new Error(JSON.stringify(errInfo));
}

// compatible User Interface used in components
export interface AppUserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: "acc" | "publisher acc";
  createdAt?: string;
  isSandbox?: boolean;
}

const CACHE_KEYS = {
  USERS: "musify_fb_users",
  SESSION: "musify_fb_session"
};

function getBackupArray<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveBackupArray<T>(key: string, data: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    console.error("Local storage allocation error:", err);
  }
}

// Sign up user via Firebase Auth and register profile inside Firestore
export async function signUpUser(
  email: string,
  password: string,
  displayName: string,
  role: "acc" | "publisher acc"
): Promise<{ user: AppUserProfile | null; error: Error | null }> {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    await updateProfile(user, { displayName });
    
    const profile: AppUserProfile = {
      uid: user.uid,
      email: user.email || email,
      displayName,
      role,
      createdAt: new Date().toISOString()
    };
    
    // Write profile asynchronously block to Firestore users table (if configured/ready)
    try {
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        email: user.email || email,
        displayName,
        role,
        createdAt: profile.createdAt
      });
    } catch (e: any) {
      console.warn("Firestore user profile save bypassed (local memory active):", e.message);
    }
    
    // Backup local
    const usersBackup = getBackupArray<AppUserProfile>(CACHE_KEYS.USERS);
    if (!usersBackup.some(u => u.uid === user.uid)) {
      usersBackup.push(profile);
      saveBackupArray(CACHE_KEYS.USERS, usersBackup);
    }
    
    localStorage.setItem(CACHE_KEYS.SESSION, JSON.stringify(profile));
    return { user: profile, error: null };
  } catch (err: any) {
    return { user: null, error: err };
  }
}

// Sign in user via Firebase Auth and read profile inside Firestore
export async function signInUser(
  email: string,
  password: string
): Promise<{ user: AppUserProfile | null; error: Error | null }> {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    let role: "acc" | "publisher acc" = "acc";
    let displayName = user.displayName || user.email?.split("@")[0] || "Musify Artist";
    
    // Attempt Firestore profile load
    try {
      const docSnap = await getDoc(doc(db, "users", user.uid));
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.role) role = data.role as "acc" | "publisher acc";
        if (data.displayName) displayName = data.displayName;
      }
    } catch (e: any) {
      console.warn("Firestore user profile fetch bypassed (local fallback active):", e.message);
    }
    
    const profile: AppUserProfile = {
      uid: user.uid,
      email: user.email || email,
      displayName,
      role,
      createdAt: new Date().toISOString()
    };
    
    localStorage.setItem(CACHE_KEYS.SESSION, JSON.stringify(profile));
    return { user: profile, error: null };
  } catch (err: any) {
    return { user: null, error: err };
  }
}

// Google Sign-In via Firebase Popup
export async function signInWithGoogle(): Promise<{ user: AppUserProfile | null; error: Error | null }> {
  try {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    
    let role: "acc" | "publisher acc" = "publisher acc"; // Default to publisher roles for easier testing
    let displayName = user.displayName || user.email?.split("@")[0] || "Google Artist";
    
    try {
      const docSnap = await getDoc(doc(db, "users", user.uid));
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.role) role = data.role as "acc" | "publisher acc";
        if (data.displayName) displayName = data.displayName;
      } else {
        await setDoc(doc(db, "users", user.uid), {
          uid: user.uid,
          email: user.email || "",
          displayName,
          role,
          createdAt: new Date().toISOString()
        });
      }
    } catch (e: any) {
      console.warn("Firestore Google profile sync bypassed:", e.message);
    }
    
    const profile: AppUserProfile = {
      uid: user.uid,
      email: user.email || "",
      displayName,
      role,
      createdAt: new Date().toISOString()
    };
    
    localStorage.setItem(CACHE_KEYS.SESSION, JSON.stringify(profile));
    return { user: profile, error: null };
  } catch (err: any) {
    return { user: null, error: err };
  }
}

// Sandbox Fallbacks
export async function signUpSandboxUser(
  email: string,
  password: string,
  displayName: string,
  role: "acc" | "publisher acc"
): Promise<{ user: AppUserProfile | null; error: Error | null }> {
  const uid = `sandbox-usr-${Date.now()}`;
  const profile: AppUserProfile = {
    uid,
    email,
    displayName,
    role,
    createdAt: new Date().toISOString(),
    isSandbox: true
  };
  localStorage.setItem(CACHE_KEYS.SESSION, JSON.stringify(profile));
  return { user: profile, error: null };
}

export async function signInSandboxUser(
  email: string,
  password: string
): Promise<{ user: AppUserProfile | null; error: Error | null }> {
  const uid = `sandbox-usr-${Date.now()}`;
  const profile: AppUserProfile = {
    uid,
    email: email,
    displayName: email.split("@")[0],
    role: "publisher acc",
    createdAt: new Date().toISOString(),
    isSandbox: true
  };
  localStorage.setItem(CACHE_KEYS.SESSION, JSON.stringify(profile));
  return { user: profile, error: null };
}

// Log out user
export async function logoutUser(): Promise<void> {
  try {
    await signOut(auth);
  } catch {
    // ignore
  }
  localStorage.removeItem(CACHE_KEYS.SESSION);
}

// Listen to Auth State changes reactively
export function onAuthChangeState(callback: (user: AppUserProfile | null) => void): () => void {
  // Read immediate cached session for responsiveness
  const cached = localStorage.getItem(CACHE_KEYS.SESSION);
  if (cached) {
    try {
      callback(JSON.parse(cached));
    } catch {
      // ignore
    }
  }

  const unsubscribe = onAuthStateChanged(auth, async (user) => {
    if (user) {
      let role: "acc" | "publisher acc" = "acc";
      let displayName = user.displayName || user.email?.split("@")[0] || "Musify Artist";
      
      try {
        const docSnap = await getDoc(doc(db, "users", user.uid));
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.role) role = data.role as "acc" | "publisher acc";
          if (data.displayName) displayName = data.displayName;
        }
      } catch (e) {
        // use default role/displayName
      }
      
      const profile: AppUserProfile = {
        uid: user.uid,
        email: user.email || "",
        displayName,
        role,
        createdAt: new Date().toISOString()
      };
      
      localStorage.setItem(CACHE_KEYS.SESSION, JSON.stringify(profile));
      callback(profile);
    } else {
      // Check if sandbox session active
      const sess = localStorage.getItem(CACHE_KEYS.SESSION);
      if (sess) {
        try {
          const parsed = JSON.parse(sess);
          if (parsed && parsed.isSandbox) {
            callback(parsed);
            return;
          }
        } catch {
          // ignore
        }
      }
      localStorage.removeItem(CACHE_KEYS.SESSION);
      callback(null);
    }
  });

  return () => unsubscribe();
}
