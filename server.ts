import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

// Load local environment variables
dotenv.config();

const app = express();
const PORT = 3000;

let aiClient: any = null;

function getGeminiClient() {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is missing. Configure in Settings > Secrets.");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        }
      }
    });
  }
  return aiClient;
}

// High limits to support high-fidelity audio uploads via Base64 JSON
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

const uploadsDir = path.join(process.cwd(), "uploads");

// Ensure local uploads folder exists
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const metadataPath = path.join(uploadsDir, "tracks.json");

// Establish Supabase Client
const FALLBACK_URL = "https://nnnbsnlbzqusengsyyeg.supabase.co";
const FALLBACK_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ubmJzbmxienF1c2VuZ3N5eWVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2ODk1MjYsImV4cCI6MjA5NTI2NTUyNn0.3UYWsIWq17WoefGRLAeDHUcq9Y9FUTNF7Y3rLT3HAUE";

const supabaseUrl = process.env.SUPABASE_URL || FALLBACK_URL;
const supabaseKey = process.env.SUPABASE_KEY || FALLBACK_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

// Try to auto-create "musify" public bucket on boot to avoid RLS/config headaches
async function initializeSupabaseBucket() {
  try {
    const { data: buckets } = await supabase.storage.listBuckets();
    if (buckets && !buckets.some(b => b.name === "musify")) {
      await supabase.storage.createBucket("musify", { public: true });
      console.log("Supabase storage bucket 'musify' created successfully.");
    }
  } catch (err: any) {
    console.warn("Supabase bucket initialization bypassed (might already exist or permission restricted):", err.message);
  }
}
initializeSupabaseBucket();

// Helper to get tracks list from local disk
function getLocalTracks() {
  if (!fs.existsSync(metadataPath)) {
    fs.writeFileSync(metadataPath, JSON.stringify([], null, 2));
    return [];
  }

  try {
    const raw = fs.readFileSync(metadataPath, "utf-8");
    return JSON.parse(raw);
  } catch (error) {
    console.error("Failed to parse local tracks catalog:", error);
    return [];
  }
}

// REST API: Get Tracks list combining Supabase database and local backups
app.get("/api/tracks", async (req, res) => {
  try {
    const { data: dbTracks, error } = await supabase
      .from("tracks")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && dbTracks && Array.isArray(dbTracks)) {
      const mapped = dbTracks.map((t: any) => ({
        id: t.id,
        title: t.title,
        artist: t.artist,
        genre: t.genre || "Independent Audio",
        url: t.url,
        sampleRate: Number(t.sample_rate || 96),
        bitDepth: Number(t.bit_depth || 24),
        bitrate: Number(t.bitrate || 1411),
        duration: Number(t.duration || 210),
        coverUrl: t.cover_url || "https://images.unsplash.com/photo-1487058792275-0ad4aaf24ca7?w=500&auto=format&fit=crop&q=80",
        description: t.description || "",
        isLocal: true,
        publisherId: t.publisher_id || "guest",
        createdAt: t.created_at
      }));

      // Merge with local disk files to be double sure no data is lost
      const local = getLocalTracks();
      const merged = [...mapped];
      for (const track of local) {
        if (!merged.some(t => t.id === track.id)) {
          merged.push(track);
        }
      }
      return res.json(merged);
    }
  } catch (dbErr: any) {
    console.warn("Supabase DB connection bypassed. Serving purely from local files. Error detail:", dbErr.message);
  }

  // Fallback to local files if Supabase database tables do not exist yet
  res.json(getLocalTracks());
});

// REST API: Gemini-based assistant for high-fidelity track publishing analysis and copywriting
app.post("/api/gemini/publisher-tools", async (req, res) => {
  try {
    const { option, title, genre, description, customPrompt } = req.body;

    if (!title || !genre) {
      return res.status(400).json({ error: "Missing required track properties: title, genre." });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(400).json({
        error: "Missing GEMINI_API_KEY. Please configure your API key in settings.",
        isConfigError: true
      });
    }

    const ai = getGeminiClient();

    let systemPrompt = "";
    if (option === "marketing") {
      systemPrompt = `You are an elite music marketing director. Analyze this track details to write high-fidelity promotional material:
Title: "${title}"
Genre: "${genre}"
Description: "${description || "A captivating sonic experience designed for listeners of premium high-fidelity music."}"

Provide:
1. **Title/Tagline Options**: Suggest 3 gripping, professional taglines.
2. **Social Media Kit**: Write 2 engaging Instagram/TikTok captions with aesthetic hashtags tailored to the "${genre}" community.
3. **Audience Persona**: Profile the prime listener type.`;
    } else if (option === "critic") {
      systemPrompt = `You are a legendary, constructively sharp audio engineer and record producer from Sound on Sound magazine. Perform a "Virtual Mixing Lounge Critique" for:
Title: "${title}"
Genre: "${genre}"
Description: "${description || "An experimental high-fidelity track."}"

Assume high-resolution formats are used. Provide:
1. **Dynamic range & Frequency spectrum advice**: Discuss typical bass shelf, mid range presence, and high transient brilliance for "${genre}" mixes.
2. **Acoustic feedback**: Detail mixing or recording guidelines to optimize spatial clarity.
3. **Hi-Fi Specs Check**: Note how sample rate or bit depths should be configured.`;
    } else if (option === "press") {
      systemPrompt = `You are a renowned music publicist writing a professional publication-ready, dramatic Press Release article for:
Title: "${title}"
Genre: "${genre}"
Description: "${description || "An immersive indie sonic wave."}"

Provide:
1. **Captivating Headline**: Write an editorial release headline.
2. **Press Copy**: Two short, elite-tier paragraphs highlighting the emotional layers, dynamic spectrum, and artistic depth of this track.
3. **Artist Bio Statement**: A short inspiring quote.`;
    } else if (option === "pitch") {
      systemPrompt = `You are a highly successful artist manager drafting a pitch for editorial playlist curators:
Title: "${title}"
Genre: "${genre}"
Description: "${description || "A high-fidelity track with pristine depth."}"

Write a compelling, respectful 120-word curator pitch. Outline the core mood, dynamic instruments, and why this deserves a featured spot on global high-resolution streaming playlists. Greatly focus on track uniqueness.`;
    } else {
      systemPrompt = customPrompt || `Review the following track concept: Title: "${title}", Genre: "${genre}", Description: "${description}".`;
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: systemPrompt,
      config: {
        temperature: 0.7,
      }
    });

    res.json({ text: response.text });
  } catch (err: any) {
    console.error("Gemini publisher tools error:", err.message);
    res.status(500).json({ error: err.message || "Unable to retrieve content from Gemini." });
  }
});

// REST API: Handle Track Audio, Cover Art Upload and Catalog Insertion
app.post("/api/upload", async (req, res) => {
  try {
    const { title, artist, genre, audioData, audioFileName, sampleRate, bitDepth, bitrate, coverUrl, description, publisherId } = req.body;

    if (!title || !artist || !audioData || !audioFileName) {
      return res.status(400).json({ error: "Missing required parameters (title, artist, audioData, audioFileName)" });
    }

    // Parse audio Extension and Base64 source
    const matchType = audioData.match(/^data:audio\/(.*?);base64,/);
    let extension = "mp3";
    let pureBase64 = audioData;

    if (matchType) {
      extension = matchType[1];
      pureBase64 = audioData.replace(/^data:audio\/.*?;base64,/, "");
    } else {
      const splitFilename = audioFileName.split(".");
      if (splitFilename.length > 1) extension = splitFilename[splitFilename.length - 1];
    }

    const audioBuffer = Buffer.from(pureBase64, "base64");
    const trackId = `track-${Date.now()}`;
    const safeAudioName = `${trackId}.${extension}`;
    const localFilePath = path.join(uploadsDir, safeAudioName);

    // Save locally for fallback purposes
    fs.writeFileSync(localFilePath, audioBuffer);

    let finalAudioUrl = `/uploads/${safeAudioName}`;
    let finalCoverUrl = coverUrl || "https://images.unsplash.com/photo-1487058792275-0ad4aaf24ca7?w=500&auto=format&fit=crop&q=80";

    // 1. UPLOAD AUDIO SOURCE FILE TO SUPABASE STORAGE
    try {
      const { data: uploadInfo, error: storageErr } = await supabase.storage
        .from("musify")
        .upload(`audio/${safeAudioName}`, audioBuffer, {
          contentType: `audio/${extension}`,
          upsert: true
        });

      if (!storageErr && uploadInfo) {
        const { data: urlData } = supabase.storage
          .from("musify")
          .getPublicUrl(`audio/${safeAudioName}`);
        
        if (urlData?.publicUrl) {
          finalAudioUrl = urlData.publicUrl;
          console.log("Audio file successfully broadcasted on Supabase Storage:", finalAudioUrl);
        }
      } else {
        console.warn("Storage upload bypassed (using local file fallback):", storageErr?.message);
      }
    } catch (e: any) {
      console.warn("Supabase Storage audio exception:", e.message);
    }

    // 2. PROCESS AND UPLOAD COVER ARTWORK TO SUPABASE STORAGE
    if (coverUrl && coverUrl.startsWith("data:image/")) {
      const imgMatch = coverUrl.match(/^data:image\/(.*?);base64,/);
      let imgExt = "jpg";
      let imgBase64 = coverUrl;
      
      if (imgMatch) {
         imgExt = imgMatch[1];
         imgBase64 = coverUrl.replace(/^data:image\/.*?;base64,/, "");
      }
      
      const imgBuffer = Buffer.from(imgBase64, "base64");
      const coverFileName = `${trackId}-cover.${imgExt}`;
      const localCoverPath = path.join(uploadsDir, coverFileName);
      
      // Save locally
      fs.writeFileSync(localCoverPath, imgBuffer);
      finalCoverUrl = `/uploads/${coverFileName}`;

      try {
        const { data: coverRes, error: coverStorageErr } = await supabase.storage
          .from("musify")
          .upload(`covers/${coverFileName}`, imgBuffer, {
            contentType: `image/${imgExt}`,
            upsert: true
          });

        if (!coverStorageErr && coverRes) {
          const { data: urlData } = supabase.storage
            .from("musify")
            .getPublicUrl(`covers/${coverFileName}`);
          
          if (urlData?.publicUrl) {
            finalCoverUrl = urlData.publicUrl;
            console.log("Cover artwork hot-linked on Supabase CDN:", finalCoverUrl);
          }
        }
      } catch (e: any) {
        console.warn("Supabase Storage image exception:", e.message);
      }
    }

    // Core track model properties
    const newTrack = {
      id: trackId,
      title,
      artist,
      genre: genre || "Independent Hi-Fi",
      url: finalAudioUrl,
      sampleRate: Number(sampleRate) || 96,
      bitDepth: Number(bitDepth) || 24,
      bitrate: Number(bitrate) || 1411,
      duration: 210, // approximate duration, frontend extracts real values on-play
      coverUrl: finalCoverUrl,
      description: description || "Studio-master upload by an independent high-fidelity sound artist.",
      isLocal: true,
      publisherId: publisherId || "guest",
      createdAt: new Date().toISOString()
    };

    // Save to local tracks JSON catalog
    const localTracks = getLocalTracks();
    localTracks.push(newTrack);
    fs.writeFileSync(metadataPath, JSON.stringify(localTracks, null, 2));

    // 3. CATALOG TRACK METADATA INTO SUPABASE DATABASE
    try {
      const { error: dbInsertErr } = await supabase
        .from("tracks")
        .insert([{
          id: trackId,
          title,
          artist,
          genre: genre || "Independent Hi-Fi",
          url: finalAudioUrl,
          sample_rate: Number(sampleRate) || 96,
          bit_depth: Number(bitDepth) || 24,
          bitrate: Number(bitrate) || 1411,
          duration: 210,
          cover_url: finalCoverUrl,
          description: description || "",
          publisher_id: publisherId || "guest",
          created_at: newTrack.createdAt
        }]);

      if (dbInsertErr) {
        console.warn("DB track write bypassed (table 'tracks' may not exist yet):", dbInsertErr.message);
      } else {
        console.log("Track metadata cataloged into Supabase database successfully!");
      }
    } catch (e: any) {
      console.warn("Supabase Database tracks insertion skipped:", e.message);
    }

    res.json({ success: true, track: newTrack });
  } catch (error: any) {
    console.error("Upload process crash:", error);
    res.status(500).json({ error: error.message || "Internal server error during upload." });
  }
});

// Serve uploaded tracks locally (as fallback)
app.use("/uploads", express.static(uploadsDir));

// Vite middleware setup
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
