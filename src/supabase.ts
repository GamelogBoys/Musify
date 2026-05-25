import { createClient, User as SupabaseUser } from "@supabase/supabase-js";

// Robust fallback credentials in case Environment Variables take time to propagate 
const FALLBACK_URL = "https://nnnbsnlbzqusengsyyeg.supabase.co";
const FALLBACK_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ubmJzbmxienF1c2VuZ3N5eWVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2ODk1MjYsImV4cCI6MjA5NTI2NTUyNn0.3UYWsIWq17WoefGRLAeDHUcq9Y9FUTNF7Y3rLT3HAUE";

const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || FALLBACK_URL;
const supabaseKey = (import.meta as any).env?.VITE_SUPABASE_KEY || FALLBACK_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

// Define compatible User Interface used in components
export interface AppUserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: "acc" | "publisher acc";
  createdAt?: string;
  isSandbox?: boolean;
}

// In-Memory/Local Storage Backup layer for ultimate resiliency
const CACHE_KEYS = {
  USERS: "musify_sb_users",
  PLAYS: "musify_sb_plays",
  TRACKS: "musify_sb_tracks",
  SESSION: "musify_sb_session"
};

// Helper to get local storage fallback cache
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

// Multi-cast listeners to reactively refresh components on local sandbox authentication actions
const authListeners = new Set<(user: AppUserProfile | null) => void>();

export function emitAuthChange(user: AppUserProfile | null) {
  authListeners.forEach(cb => {
    try {
      cb(user);
    } catch (err) {
      console.error("Local Auth notification failed:", err);
    }
  });
}

/**
 * 1. USER AUTHENTICATION & PROFILES
 */

// Sign up
export async function signUpUser(
  email: string,
  password: string,
  displayName: string,
  role: "acc" | "publisher acc"
): Promise<{ user: AppUserProfile | null; error: Error | null }> {
  try {
    // Attempt signup in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName,
          role: role
        }
      }
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error("Could not create user reference.");

    const uid = authData.user.id;
    const profile: AppUserProfile = {
      uid,
      email,
      displayName,
      role,
      createdAt: new Date().toISOString()
    };

    // Attempt to write user schema in remote DB table 'users'
    try {
      const { error: dbError } = await supabase
        .from("users")
        .insert([{
          id: uid,
          email,
          display_name: displayName,
          role,
          created_at: profile.createdAt
        }]);

      if (dbError) {
        console.warn("DB 'users' table write bypassed. Storing locally. Table maybe non-existent.", dbError.message);
      }
    } catch (e) {
      // Table doesn't exist fallbacks
    }

    // Keep profile in Local cache
    const usersBackup = getBackupArray<AppUserProfile>(CACHE_KEYS.USERS);
    if (!usersBackup.some(u => u.uid === uid)) {
      usersBackup.push(profile);
      saveBackupArray(CACHE_KEYS.USERS, usersBackup);
    }

    // Save active session
    localStorage.setItem(CACHE_KEYS.SESSION, JSON.stringify(profile));
    emitAuthChange(profile);

    return { user: profile, error: null };
  } catch (err: any) {
    return { user: null, error: err };
  }
}

// Sandbox Local Fallback Signup
export async function signUpSandboxUser(
  email: string,
  password: string,
  displayName: string,
  role: "acc" | "publisher acc"
): Promise<{ user: AppUserProfile | null; error: Error | null }> {
  try {
    const uid = `sandbox-usr-${Date.now()}`;
    const profile: AppUserProfile = {
      uid,
      email,
      displayName,
      role,
      createdAt: new Date().toISOString(),
      isSandbox: true
    };

    const usersBackup = getBackupArray<AppUserProfile>(CACHE_KEYS.USERS);
    if (usersBackup.some(u => u.email.toLowerCase() === email.toLowerCase())) {
      throw new Error("This email is already registered inside Musify local database.");
    }

    usersBackup.push(profile);
    saveBackupArray(CACHE_KEYS.USERS, usersBackup);

    localStorage.setItem(CACHE_KEYS.SESSION, JSON.stringify(profile));
    emitAuthChange(profile);

    return { user: profile, error: null };
  } catch (err: any) {
    return { user: null, error: err };
  }
}

// Sign in
export async function signInUser(
  email: string,
  password: string
): Promise<{ user: AppUserProfile | null; error: Error | null }> {
  try {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error("Could not log in session.");

    const uid = authData.user.id;
    let profile: AppUserProfile | null = null;

    // Fetch remote DB profile
    try {
      const { data: remoteProfile, error: dbError } = await supabase
        .from("users")
        .select("*")
        .eq("id", uid)
        .single();

      if (!dbError && remoteProfile) {
        profile = {
          uid,
          email: remoteProfile.email || authData.user.email || email,
          displayName: remoteProfile.display_name || authData.user.user_metadata?.display_name || "Musify Artist",
          role: (remoteProfile.role as "acc" | "publisher acc") || "acc",
          createdAt: remoteProfile.created_at
        };
      }
    } catch {
      // Bypassed if table is missing
    }

    if (!profile) {
      // Fallback to local profile checklist
      const usersBackup = getBackupArray<AppUserProfile>(CACHE_KEYS.USERS);
      const matched = usersBackup.find(u => u.uid === uid || u.email.toLowerCase() === email.toLowerCase());
      if (matched) {
        profile = matched;
      } else {
        // Create dynamic user profile based on credentials metadata
        profile = {
          uid,
          email: authData.user.email || email,
          displayName: authData.user.user_metadata?.display_name || email.split("@")[0],
          role: authData.user.user_metadata?.role || "acc",
          createdAt: new Date().toISOString()
        };
      }
    }

    // Save active session
    localStorage.setItem(CACHE_KEYS.SESSION, JSON.stringify(profile));
    emitAuthChange(profile);

    return { user: profile, error: null };
  } catch (err: any) {
    return { user: null, error: err };
  }
}

// Sandbox Local Fallback Signin
export async function signInSandboxUser(
  email: string,
  password: string
): Promise<{ user: AppUserProfile | null; error: Error | null }> {
  try {
    const usersBackup = getBackupArray<AppUserProfile>(CACHE_KEYS.USERS);
    let profile = usersBackup.find(u => u.email.toLowerCase() === email.toLowerCase());

    if (!profile) {
      // Frictionless creation on local login
      const uid = `sandbox-usr-${Date.now()}`;
      profile = {
        uid,
        email,
        displayName: email.split("@")[0].charAt(0).toUpperCase() + email.split("@")[0].slice(1),
        role: "publisher acc",
        createdAt: new Date().toISOString(),
        isSandbox: true
      };
      usersBackup.push(profile);
      saveBackupArray(CACHE_KEYS.USERS, usersBackup);
    }

    localStorage.setItem(CACHE_KEYS.SESSION, JSON.stringify(profile));
    emitAuthChange(profile);

    return { user: profile, error: null };
  } catch (err: any) {
    return { user: null, error: err };
  }
}

// Log out
export async function logoutUser(): Promise<void> {
  try {
    await supabase.auth.signOut();
  } catch {
    // ignore
  }
  localStorage.removeItem(CACHE_KEYS.SESSION);
  emitAuthChange(null);
}

// Monitor Auth Changes
export function onAuthChangeState(callback: (user: AppUserProfile | null) => void): () => void {
  authListeners.add(callback);

  // Read immediate cached session for snappy initial render
  const cached = localStorage.getItem(CACHE_KEYS.SESSION);
  if (cached) {
    try {
      callback(JSON.parse(cached));
    } catch {
      // ignore
    }
  }

  const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
    if (session?.user) {
      const uid = session.user.id;
      let matchedProfile: AppUserProfile | null = null;

      // Try reading database
      try {
        const { data, error } = await supabase
          .from("users")
          .select("*")
          .eq("id", uid)
          .single();
        if (!error && data) {
          matchedProfile = {
            uid,
            email: data.email || session.user.email || "",
            displayName: data.display_name || session.user.user_metadata?.display_name || "Studio Creator",
            role: (data.role as "acc" | "publisher acc") || "acc",
            createdAt: data.created_at
          };
        }
      } catch {
        // Table doesn't exist
      }

      if (!matchedProfile) {
        // Fallback checks
        const usersBackup = getBackupArray<AppUserProfile>(CACHE_KEYS.USERS);
        const fb = usersBackup.find(u => u.uid === uid);
        if (fb) {
          matchedProfile = fb;
        } else {
          matchedProfile = {
            uid,
            email: session.user.email || "",
            displayName: session.user.user_metadata?.display_name || "Studio Creator",
            role: session.user.user_metadata?.role || "acc",
            createdAt: new Date().toISOString()
          };
        }
      }

      localStorage.setItem(CACHE_KEYS.SESSION, JSON.stringify(matchedProfile));
      callback(matchedProfile);
    } else {
      // Only clear non-sandbox active session
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

  return () => {
    authListeners.delete(callback);
    subscription.unsubscribe();
  };
}


/**
 * 2. TELEMETRY PLAY EVENTS
 */

export interface PlayEvent {
  id: string;
  trackId: string;
  trackTitle: string;
  publisherId: string;
  listenerId: string;
  timestamp: string;
}

export async function logPlayEvent(
  trackId: string,
  trackTitle: string,
  publisherId: string,
  listenerId: string
): Promise<void> {
  const playObj = {
    id: `play-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    trackId,
    trackTitle,
    publisherId,
    listenerId,
    timestamp: new Date().toISOString()
  };

  // Try saving remote DB
  try {
    const { error } = await supabase
      .from("plays")
      .insert([{
        id: playObj.id,
        track_id: trackId,
        track_title: trackTitle,
        publisher_id: publisherId,
        listener_id: listenerId,
        timestamp: playObj.timestamp
      }]);
    
    if (error) {
       console.warn("DB 'plays' table write bypassed. Table maybe non-existent.", error.message);
    }
  } catch (e) {
    // ignored table exceptions
  }

  // Backup in local cache
  const playsBackup = getBackupArray<PlayEvent>(CACHE_KEYS.PLAYS);
  playsBackup.push(playObj);
  saveBackupArray(CACHE_KEYS.PLAYS, playsBackup);
}

// Fetch Play events log
export async function getPlayEventsFlow(publisherId: string): Promise<PlayEvent[]> {
  try {
    const { data, error } = await supabase
      .from("plays")
      .select("*")
      .eq("publisher_id", publisherId)
      .order("timestamp", { ascending: false });

    if (!error && data) {
      return data.map((item: any) => ({
        id: item.id,
        trackId: item.track_id,
        trackTitle: item.track_title,
        publisherId: item.publisher_id,
        listenerId: item.listener_id,
        timestamp: item.timestamp
      }));
    }
  } catch (e) {
    // ignored table exceptions
  }

  // Fallback to local storage plays matching publisherId
  const playsBackup = getBackupArray<PlayEvent>(CACHE_KEYS.PLAYS);
  return playsBackup
    .filter(p => p.publisherId === publisherId)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}
