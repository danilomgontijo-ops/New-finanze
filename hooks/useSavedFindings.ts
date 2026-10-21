import { useEffect, useState } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { SavedFinding } from '../types';
import { getCreatedAtMillis } from '../utils/helpers';

/**
 * Real-time list of the user's saved audit-finding drafts (users/{uid}/saved_findings) plus CRUD helpers.
 * Shared by the AI consulting modal and the saved-findings modal. The onSnapshot listener is the single
 * source of truth for the list, so the helpers don't touch local state; they throw on failure so the
 * caller can show its own message.
 */
export const useSavedFindings = (db: any, currentUser: any) => {
  const [findings, setFindings] = useState<SavedFinding[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const uid: string | undefined = currentUser?.uid;
  const collectionPath = uid ? `users/${uid}/saved_findings` : '';

  useEffect(() => {
    if (!db || !uid) {
      setFindings([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const unsubscribe = onSnapshot(collection(db, `users/${uid}/saved_findings`), (snapshot) => {
      const list = snapshot.docs
        .map(docSnap => ({ ...docSnap.data(), id: docSnap.id } as SavedFinding))
        .sort((a, b) => {
          const timeA = getCreatedAtMillis((a as any).createdAtDoc);
          const timeB = getCreatedAtMillis((b as any).createdAtDoc);
          if (timeA && timeB) return timeB - timeA;
          return (b.createdAt || '').localeCompare(a.createdAt || '');
        });
      setFindings(list);
      setIsLoading(false);
    }, (err) => {
      console.error('Error fetching user saved findings from database:', err);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [db, uid]);

  const requirePath = (): string => {
    if (!db || !collectionPath) throw new Error('Usuário não autenticado.');
    return collectionPath;
  };

  const createFinding = async (data: Omit<SavedFinding, 'id'>): Promise<string> => {
    // Firestore rejects undefined values, so optional fields are only sent when present
    const payload: Record<string, unknown> = { ...data, createdAtDoc: new Date() };
    Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key]);
    const docRef = await addDoc(collection(db, requirePath()), payload);
    return docRef.id;
  };

  const updateFindingTitle = async (id: string, titulo: string): Promise<void> => {
    await updateDoc(doc(db, requirePath(), id), { titulo: titulo.trim() });
  };

  const deleteFinding = async (id: string): Promise<void> => {
    await deleteDoc(doc(db, requirePath(), id));
  };

  return { findings, isLoading, createFinding, updateFindingTitle, deleteFinding };
};
