import { initializeApp } from 'firebase-admin/app';
import { getAuth, UserRecord } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

initializeApp();

export const deleteRecipientAuth = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Debes iniciar sesión para ejecutar esta acción.');
  }

  const email = (request.data?.email as string | undefined)?.trim().toLowerCase();
  if (!email) {
    throw new HttpsError('invalid-argument', 'El email es requerido.');
  }

  const db = getFirestore();
  const auth = getAuth();

  const callerRef = db.collection('users').doc(request.auth.uid);
  const callerSnap = await callerRef.get();
  const callerRole = callerSnap.exists ? callerSnap.data()?.role : null;

  if (callerRole !== 'super_admin' && callerRole !== 'admin_centro') {
    throw new HttpsError('permission-denied', 'No tienes permisos para eliminar autenticaciones.');
  }

  const usersSnap = await db.collection('users').where('email', '==', email).get();

  let authDeleted = false;
  let uidDeleted: string | null = null;

  try {
    const authUser: UserRecord = await auth.getUserByEmail(email);
    await auth.deleteUser(authUser.uid);
    authDeleted = true;
    uidDeleted = authUser.uid;
  } catch (error: any) {
    if (error?.code !== 'auth/user-not-found') {
      throw new HttpsError('internal', 'No se pudo eliminar el usuario en Firebase Auth.');
    }
  }

  const batch = db.batch();
  usersSnap.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();

  return {
    success: true,
    authDeleted,
    uidDeleted,
    firestoreUsersDeleted: usersSnap.size
  };
});
