import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { ResourceTransaction } from '../types';

export async function logTransaction(
  userId: string,
  type: ResourceTransaction['type'],
  amount: number,
  description: string,
  fanzId?: string
) {
  if (amount === 0) return;

  try {
    const transaction: Omit<ResourceTransaction, 'id'> = {
      userId,
      type,
      amount,
      description,
      createdAt: new Date().toISOString(),
    };

    if (fanzId) {
      transaction.fanzId = fanzId;
    }

    await addDoc(collection(db, 'transactions'), transaction);
  } catch (error) {
    console.error('Error logging transaction:', error);
  }
}
