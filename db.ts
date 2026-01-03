import { Memo } from './types';

const DB_NAME = 'VoiceMemosDB';
const STORE_NAME = 'memos';
const DB_VERSION = 1;

// Helper to convert Blob to ArrayBuffer
const blobToArrayBuffer = (blob: Blob): Promise<ArrayBuffer> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (reader.result) {
        resolve(reader.result as ArrayBuffer);
      } else {
        reject(new Error("Failed to convert blob to array buffer"));
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(blob);
  });
};

export const initDB = (): Promise<void> => {
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
  // Convert Blob to ArrayBuffer for better compatibility (especially iOS Safari)
  const arrayBuffer = await blobToArrayBuffer(memo.blob);
  
  // Create a storage object that doesn't contain the raw Blob
  // (though some browsers support it, ArrayBuffer is safer)
  const dbItem = {
    id: memo.id,
    title: memo.title,
    duration: memo.duration,
    createdAt: memo.createdAt,
    audioData: arrayBuffer,
    mimeType: memo.blob.type
  };

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      
      store.put(dbItem);
      
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    };
    request.onerror = () => reject(request.error);
  });
};

export const getMemosFromDB = (): Promise<Memo[]> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const getAllRequest = store.getAll();

      getAllRequest.onsuccess = () => {
        const result = getAllRequest.result;
        
        const hydratedMemos: Memo[] = result.map((item: any) => {
          let blob: Blob;
          
          // Handle new format (ArrayBuffer)
          if (item.audioData) {
            blob = new Blob([item.audioData], { type: item.mimeType || 'audio/webm' });
          } 
          // Handle legacy format (Direct Blob storage)
          else if (item.blob) {
            blob = item.blob;
          } else {
            // Fallback empty blob
            blob = new Blob([], { type: 'audio/webm' });
          }

          return {
            id: item.id,
            title: item.title,
            duration: item.duration,
            createdAt: item.createdAt,
            url: URL.createObjectURL(blob),
            blob: blob
          };
        });

        // Sort by newest first by default
        hydratedMemos.sort((a, b) => b.createdAt - a.createdAt);
        resolve(hydratedMemos);
      };
      getAllRequest.onerror = () => reject(getAllRequest.error);
    };
    request.onerror = () => reject(request.error);
  });
};

export const deleteMemoFromDB = (id: string): Promise<void> => {
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
