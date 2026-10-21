import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import app, { auth } from './firebase';
import { RelatorioArquivoItem } from '../types';

export type ReportFileAttachment = RelatorioArquivoItem;

/**
 * Local (IndexedDB) lookup key for an attachment. The unique storage path is used whenever available;
 * the bare file name is only a fallback for legacy items, because different fiscalizações may
 * attach files with the same name.
 */
const getLocalBlobKey = (fileItem: { nome: string; storagePath?: string }): string =>
  fileItem.storagePath || fileItem.nome;

// IndexedDB Helper for local offline caching of binary blobs
const DB_NAME = 'tcepr_demands_storage';
const STORE_NAME = 'report_blobs';

function openBlobDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB não suportado'));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveBlobToIndexedDB(key: string, blob: Blob): Promise<void> {
  try {
    const db = await openBlobDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(blob, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Erro ao salvar no IndexedDB:', err);
  }
}

export async function getBlobFromIndexedDB(key: string): Promise<Blob | null> {
  try {
    const db = await openBlobDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

/**
 * Converts a File to Base64 Data URL (useful for fallback storage if file is <= 800KB)
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * Uploads report file to Firebase Storage (and caches in IndexedDB).
 * If Firebase Storage is not configured or unavailable, seamlessly falls back to Base64/IndexedDB.
 */
export async function uploadReportFile(
  file: File,
  demandIdentifier: string = 'geral'
): Promise<{
  url?: string;
  storagePath?: string;
  base64Data?: string;
  tamanho: number;
  tipo: string;
  dataUpload: string;
}> {
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `relatorios/${demandIdentifier}/${timestamp}_${safeName}`;
  const nowStr = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  // Always cache blob locally in IndexedDB under the unique path (never by bare file name, which collides)
  saveBlobToIndexedDB(path, file).catch(() => {});

  let uploadedUrl: string | undefined;
  // The path is returned even if the cloud upload fails, because it is also the local cache key
  const storagePath = path;
  let base64Fallback: string | undefined;

  // 1. Try Firebase Storage with a 5s race timeout
  try {
    const storage = getStorage(app);
    const storageRef = ref(storage, path);
    const storageUploadPromise = async () => {
      const uploadResult = await uploadBytes(storageRef, file, {
        contentType: file.type || 'application/octet-stream',
        customMetadata: {
          originalName: file.name,
          uploadedAt: new Date().toISOString(),
          userId: auth.currentUser?.uid || 'anon'
        }
      });
      return await getDownloadURL(uploadResult.ref);
    };

    const timeoutPromise = new Promise<string>((_, reject) => {
      setTimeout(() => reject(new Error('Firebase Storage timeout (5s)')), 5000);
    });

    uploadedUrl = await Promise.race([storageUploadPromise(), timeoutPromise]);
  } catch (storageError) {
    console.warn('Firebase Storage indisponível ou demorou, usando cache IndexedDB e Base64:', storageError);
  }

  // 2. If storage upload didn't succeed and file is small enough (<= 800KB), generate Base64
  if (!uploadedUrl && file.size <= 800 * 1024) {
    try {
      base64Fallback = await fileToBase64(file);
    } catch (b64Err) {
      console.warn('Falha ao gerar Base64:', b64Err);
    }
  }

  return {
    url: uploadedUrl,
    storagePath,
    base64Data: base64Fallback,
    tamanho: file.size,
    tipo: file.type || 'application/octet-stream',
    dataUpload: nowStr
  };
}

/**
 * Triggers a native browser download for a Blob
 */
export function triggerBlobDownload(blob: Blob, fileName: string): void {
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 1500);
}

/**
 * Checks if the original binary file is stored (in Firebase Storage, Base64, or IndexedDB)
 */
export async function checkHasOriginalFile(fileItem: {
  nome: string;
  url?: string;
  storagePath?: string;
  base64Data?: string;
}): Promise<boolean> {
  if (fileItem.url && fileItem.url.trim().length > 0) return true;
  if (fileItem.base64Data && fileItem.base64Data.trim().length > 0) return true;
  try {
    const localBlob = await getBlobFromIndexedDB(getLocalBlobKey(fileItem));
    if (localBlob) return true;
  } catch {
    // ignore
  }
  return false;
}

/**
 * Universal downloader for the original attached report file (PDF, DOCX, TXT):
 * 1. If Firebase Storage URL exists -> fetches and downloads original file
 * 2. If Base64 Data exists -> decodes and downloads original file
 * 3. If IndexedDB cached blob exists -> downloads original file
 * (Does NOT generate or download extracted text .txt files)
 */
export async function downloadReportAttachment(fileItem: {
  nome: string;
  texto?: string;
  url?: string;
  storagePath?: string;
  base64Data?: string;
  tipo?: string;
}): Promise<void> {
  // 1. Try download via direct URL
  if (fileItem.url && fileItem.url.trim().length > 0) {
    try {
      const res = await fetch(fileItem.url);
      if (res.ok) {
        const blob = await res.blob();
        triggerBlobDownload(blob, fileItem.nome);
        return;
      }
    } catch (e) {
      console.warn('Fetch direto falhou, tentando abertura por tag <a>:', e);
      const a = document.createElement('a');
      a.href = fileItem.url;
      a.download = fileItem.nome;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }
  }

  // 2. Try Base64 Data URL
  if (fileItem.base64Data && fileItem.base64Data.trim().length > 0) {
    try {
      const res = await fetch(fileItem.base64Data);
      const blob = await res.blob();
      triggerBlobDownload(blob, fileItem.nome);
      return;
    } catch (err) {
      console.warn('Erro ao decodificar Base64:', err);
    }
  }

  // 3. Try IndexedDB Local Cache (saved during this or previous session on this browser)
  try {
    const localBlob = await getBlobFromIndexedDB(getLocalBlobKey(fileItem));
    if (localBlob) {
      triggerBlobDownload(localBlob, fileItem.nome);
      return;
    }
  } catch (err) {
    console.warn('Erro ao buscar do IndexedDB:', err);
  }

  throw new Error(`O arquivo principal "${fileItem.nome}" ainda não foi anexado ao sistema. Anexe o arquivo original nos detalhes.`);
}

/**
 * Format bytes to readable size (e.g., 2.4 MB, 450 KB)
 */
export function formatBytes(bytes?: number): string {
  if (!bytes || bytes === 0) return '';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
