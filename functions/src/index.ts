import { initializeApp } from 'firebase-admin/app';
import { getAuth, UserRecord } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import JSZip from 'jszip';

initializeApp();

const callableCorsOrigins = [
  'http://localhost:4200',
  'https://envio-examenes.web.app',
  'https://envio-examenes.firebaseapp.com'
];

export const deleteRecipientAuth = onCall({ cors: callableCorsOrigins }, async (request) => {
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

type GenerateExamenZipResponse = {
  success: boolean;
  downloadUrl: string;
  fileName: string;
  failedFiles: string[];
};

function sanitizeFileName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}

function parseDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  if (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof (value as { toDate: unknown }).toDate === 'function'
  ) {
    const parsed = (value as { toDate: () => Date }).toDate();
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

function formatDateForFileName(value: unknown): string {
  const date = parseDate(value);
  if (!date) return 'sin_fecha';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function buildZipEntryName(originalName: string, index: number): string {
  const dotIndex = originalName.lastIndexOf('.');
  const extension = dotIndex >= 0 ? originalName.slice(dotIndex) : '';
  const baseName = dotIndex >= 0 ? originalName.slice(0, dotIndex) : originalName;
  const safeName = sanitizeFileName(baseName) || `archivo_${index + 1}`;
  return `${String(index + 1).padStart(2, '0')}_${safeName}${extension}`;
}

export const generateExamenZip = onCall({ cors: callableCorsOrigins }, async (request): Promise<GenerateExamenZipResponse> => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Debes iniciar sesión para descargar el examen.');
  }

  const examenId = (request.data?.examenId as string | undefined)?.trim();
  if (!examenId) {
    throw new HttpsError('invalid-argument', 'El id del examen es requerido.');
  }

  const db = getFirestore();

  const callerSnap = await db.collection('users').doc(request.auth.uid).get();
  if (!callerSnap.exists) {
    throw new HttpsError('permission-denied', 'No se encontró el perfil del usuario actual.');
  }

  const callerData = callerSnap.data() as { role?: string; centroSaludId?: string; email?: string };
  const callerRole = callerData.role || null;
  const callerCentro = callerData.centroSaludId || null;
  const callerEmail = ((request.auth.token.email as string | undefined) || callerData.email || '').toLowerCase();

  const examenRef = db.collection('examenes').doc(examenId);
  const examenSnap = await examenRef.get();
  if (!examenSnap.exists) {
    throw new HttpsError('not-found', 'No se encontró el examen solicitado.');
  }

  const examen = examenSnap.data() as {
    centroSaludId?: string;
    destinatarioNombre?: string;
    fechaRealizacion?: unknown;
    fechaCreacion?: unknown;
    fechaActualizacion?: unknown;
    tipoExamen?: string;
    estado?: string;
    descripcion?: string;
    observaciones?: string;
    destinatarioDocumento?: string;
    accessEmails?: string[];
    archivos?: Array<{ nombre?: string; url?: string; tipo?: string }>;
  };

  const accessEmails = (examen.accessEmails || []).map(email => email.toLowerCase());
  const canRead =
    callerRole === 'super_admin' ||
    (callerRole === 'admin_centro' && !!callerCentro && callerCentro === examen.centroSaludId) ||
    (!!callerEmail && accessEmails.includes(callerEmail));

  if (!canRead) {
    throw new HttpsError('permission-denied', 'No tienes permisos para descargar este examen.');
  }

  const archivos = (examen.archivos || []).filter(archivo => !!archivo?.url);
  if (archivos.length === 0) {
    throw new HttpsError('failed-precondition', 'El examen no tiene archivos para descargar.');
  }

  const zip = new JSZip();
  const filesFolder = zip.folder('archivos');
  const failedFiles: string[] = [];
  let downloadedFiles = 0;

  for (let index = 0; index < archivos.length; index += 1) {
    const archivo = archivos[index];
    const fileUrl = archivo.url as string;
    const fileName = archivo.nombre || `archivo_${index + 1}`;

    try {
      const response = await fetch(fileUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const fileBuffer = Buffer.from(await response.arrayBuffer());
      filesFolder?.file(buildZipEntryName(fileName, index), fileBuffer);
      downloadedFiles += 1;
    } catch (error) {
      console.error(`No se pudo incluir ${fileName} en ZIP`, error);
      failedFiles.push(`${fileName} -> ${fileUrl}`);
    }
  }

  zip.file(
    'resumen.txt',
    [
      'Resumen de Examen',
      '=================',
      `Paciente/Entidad: ${examen.destinatarioNombre || 'No disponible'}`,
      `Documento: ${examen.destinatarioDocumento || 'No disponible'}`,
      `Tipo de examen: ${examen.tipoExamen || 'No disponible'}`,
      `Fecha de realización: ${parseDate(examen.fechaRealizacion)?.toISOString() || 'No disponible'}`,
      `Estado: ${examen.estado || 'No disponible'}`,
      `Descripción: ${examen.descripcion || 'Sin descripción'}`,
      `Observaciones: ${examen.observaciones || 'Sin observaciones'}`,
      '',
      'Archivos incluidos:',
      ...archivos.map((archivo, index) => `- ${String(index + 1).padStart(2, '0')} ${archivo.nombre || 'archivo'}`)
    ].join('\n')
  );

  if (failedFiles.length > 0) {
    zip.file(
      'errores_descarga.txt',
      [
        'No se pudieron descargar algunos archivos del examen:',
        ...failedFiles.map(item => `- ${item}`)
      ].join('\n')
    );
  }

  if (downloadedFiles === 0) {
    throw new HttpsError('failed-precondition', 'No se pudo descargar ninguno de los archivos del examen.');
  }

  const destinatario = sanitizeFileName(examen.destinatarioNombre || 'destinatario');
  const fecha = formatDateForFileName(examen.fechaRealizacion || examen.fechaCreacion || examen.fechaActualizacion);
  const zipFileName = `${destinatario}_${fecha}.zip`;

  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
  const storage = getStorage();
  const bucket = storage.bucket();
  const objectPath = `exports/examenes/${examenId}/${Date.now()}_${zipFileName}`;
  const zipFile = bucket.file(objectPath);

  await zipFile.save(zipBuffer, {
    contentType: 'application/zip',
    metadata: {
      cacheControl: 'private, max-age=300'
    }
  });

  const [downloadUrl] = await zipFile.getSignedUrl({
    action: 'read',
    expires: Date.now() + 15 * 60 * 1000
  });

  return {
    success: true,
    downloadUrl,
    fileName: zipFileName,
    failedFiles
  };
});
