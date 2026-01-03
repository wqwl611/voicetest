import { Memo } from './types';

const DB_NAME = 'VoiceMemosDB';
const STORE_NAME = 'memos';
const DB_VERSION = 1;
const CACHE_NAME = 'voice-memos-audio-v1';

// Check if Cache API is supported (Available in secure contexts)
const hasCacheApi = 'caches' in self;

export const initDB = async (): Promise<void> => {
  // Try to request persistent storage
  if (navigator.storage && navigator.storage.persist) {
    try {
      const isPersisted = await navigator.storage.persisted();
      if (!isPersisted) {
        await navigator.storage.persist();
      }
    } catch (e) {
      console.warn("Failed to request persistent storage", e);
    }
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
};

export const saveMemoToDB = async (memo: Memo): Promise<void> => {
  // 1. Try to save the heavy Audio Blob to Cache API
  // This is often more stable on iOS than large blobs in IndexedDB
  let savedToCache = false;
  if (hasCacheApi) {
    try {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(
        `/memo/${memo.id}`, 
        new Response(memo.blob, { headers: { 'Content-Type': memo.blob.type } })
      );
      savedToCache = true;
    } catch (e) {
      console.warn("Cache API save failed, falling back to IDB", e);
    }
  }

  // 2. Prepare Metadata for IndexedDB
  const dbItem: any = {
    id: memo.id,
    title: memo.title,
    duration: memo.duration,
    createdAt: memo.createdAt,
    mimeType: memo.blob.type
  };

  // Fallback: If Cache API failed or isn't available, store data in IDB
  if (!savedToCache) {
    // Convert to ArrayBuffer for IDB stability
    dbItem.audioData = await memo.blob.arrayBuffer();
  }

  // 3. Save Metadata to IDB
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      
      const putRequest = store.put(dbItem);
      
      putRequest.onerror = () => reject(putRequest.error);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    };
    request.onerror = () => reject(request.error);
  });
};

export const getMemosFromDB = async (): Promise<Memo[]> => {
  // 1. Get all metadata from IndexedDB
  const items: any[] = await new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const getAllRequest = store.getAll();

      getAllRequest.onsuccess = () => resolve(getAllRequest.result);
      getAllRequest.onerror = () => reject(getAllRequest.error);
    };
    request.onerror = () => reject(request.error);
  });

  // 2. Hydrate blobs from Cache API or IDB fallback
  const memos: Memo[] = [];
  let cache: Cache | null = null;
  
  if (hasCacheApi) {
    try {
        cache = await caches.open(CACHE_NAME);
    } catch(e) { console.warn("Could not open cache", e); }
  }

  for (const item of items) {
    let blob: Blob | null = null;

    // A. Try Cache API
    if (cache) {
        try {
            const response = await cache.match(`/memo/${item.id}`);
            if (response) {
                blob = await response.blob();
            }
        } catch (e) { console.warn("Cache match error", e); }
    }

    // B. Try IDB ArrayBuffer (Fallback / Legacy data)
    if (!blob && item.audioData) {
        blob = new Blob([item.audioData], { type: item.mimeType || 'audio/webm' });
    }
    
    // C. Try IDB Direct Blob (Very old legacy data)
    if (!blob && item.blob) {
        blob = item.blob;
    }

    // Only add if we successfully recovered the audio
    if (blob) {
      memos.push({
        id: item.id,
        title: item.title,
        duration: item.duration,
        createdAt: item.createdAt,
        url: URL.createObjectURL(blob),
        blob: blob
      });
    }
  }

  // Sort by newest first
  memos.sort((a, b) => b.createdAt - a.createdAt);
  return memos;
};

export const deleteMemoFromDB = async (id: string): Promise<void> => {
  // 1. Delete from Cache API
  if (hasCacheApi) {
    try {
      const cache = await caches.open(CACHE_NAME);
      await cache.delete(`/memo/${id}`);
    } catch (e) {
      console.warn("Failed to delete from cache", e);
    }
  }

  // 2. Delete from IndexedDB
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    };
    request.onerror = () => reject(request.error);
  });
};
