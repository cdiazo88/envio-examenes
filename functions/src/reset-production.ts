import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

type CliArgs = {
  confirm?: string;
  email: string;
  password: string;
  nombre: string;
  apellido: string;
  telefono?: string;
  dryRun: boolean;
};

initializeApp();

function parseArgs(argv: string[]): CliArgs {
  const parsed: Record<string, string> = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (!token.startsWith('--')) {
      continue;
    }

    const withoutPrefix = token.slice(2);
    const equalsIndex = withoutPrefix.indexOf('=');

    if (equalsIndex >= 0) {
      const key = withoutPrefix.slice(0, equalsIndex);
      const value = withoutPrefix.slice(equalsIndex + 1);
      parsed[key] = value;
      continue;
    }

    const nextToken = argv[index + 1];
    if (nextToken && !nextToken.startsWith('--')) {
      parsed[withoutPrefix] = nextToken;
      index += 1;
    } else {
      parsed[withoutPrefix] = 'true';
    }
  }

  const missing: string[] = [];
  const requiredKeys = ['email', 'password', 'nombre', 'apellido'] as const;
  for (const key of requiredKeys) {
    if (!parsed[key]) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    throw new Error(`Faltan argumentos requeridos: ${missing.join(', ')}`);
  }

  return {
    confirm: parsed.confirm,
    email: parsed.email.trim().toLowerCase(),
    password: parsed.password,
    nombre: parsed.nombre.trim(),
    apellido: parsed.apellido.trim(),
    telefono: parsed.telefono?.trim(),
    dryRun: parsed['dry-run'] === 'true'
  };
}

async function countCollectionDocuments(collectionName: string): Promise<number> {
  const db = getFirestore();
  let total = 0;
  let lastDocId: string | null = null;

  while (true) {
    let queryRef = db.collection(collectionName).orderBy('__name__').limit(1000);

    if (lastDocId) {
      queryRef = queryRef.startAfter(lastDocId);
    }

    const snapshot = await queryRef.get();
    if (snapshot.empty) {
      return total;
    }

    total += snapshot.size;
    lastDocId = snapshot.docs[snapshot.docs.length - 1].id;
  }
}

async function deleteCollection(collectionName: string): Promise<number> {
  const db = getFirestore();
  let deleted = 0;

  while (true) {
    const snapshot = await db.collection(collectionName).limit(500).get();

    if (snapshot.empty) {
      return deleted;
    }

    const batch = db.batch();
    snapshot.docs.forEach((document) => batch.delete(document.ref));
    await batch.commit();

    deleted += snapshot.size;
  }
}

async function deleteAllAuthUsers(): Promise<number> {
  const auth = getAuth();
  let deleted = 0;
  let pageToken: string | undefined;

  while (true) {
    const page = await auth.listUsers(1000, pageToken);
    if (page.users.length === 0) {
      return deleted;
    }

    const uids = page.users.map((user) => user.uid);
    const result = await auth.deleteUsers(uids);
    deleted += result.successCount;

    if (result.failureCount > 0) {
      const failedIndexes = result.errors.map((error) => error.index);
      const failedUids = failedIndexes.map((index) => uids[index]).join(', ');
      throw new Error(`No se pudieron eliminar ${result.failureCount} usuarios de Auth. UIDs: ${failedUids}`);
    }

    if (!page.pageToken) {
      return deleted;
    }

    pageToken = page.pageToken;
  }
}

async function countAllAuthUsers(): Promise<number> {
  const auth = getAuth();
  let total = 0;
  let pageToken: string | undefined;

  while (true) {
    const page = await auth.listUsers(1000, pageToken);
    total += page.users.length;

    if (!page.pageToken) {
      return total;
    }

    pageToken = page.pageToken;
  }
}

function printUsage(): void {
  console.log('Uso: npm --prefix functions run reset:prod -- --confirm RESET_PROD --email <email> --password <password> --nombre <nombre> --apellido <apellido> [--telefono <telefono>] [--dry-run]');
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.dryRun) {
    console.log('Modo simulación activado (--dry-run). No se realizarán cambios.');

    const authUsers = await countAllAuthUsers();
    const usersDocuments = await countCollectionDocuments('users');
    const centrosDocuments = await countCollectionDocuments('centrosSalud');

    console.log('Resumen de simulación:');
    console.log(`- Usuarios de Auth a eliminar: ${authUsers}`);
    console.log(`- Documentos users a eliminar: ${usersDocuments}`);
    console.log(`- Documentos centrosSalud a eliminar: ${centrosDocuments}`);
    console.log(`- Se crearía super_admin con email: ${args.email}`);
    return;
  }

  if (args.confirm !== 'RESET_PROD') {
    throw new Error('Confirmación inválida. Debes usar --confirm RESET_PROD para ejecutar esta operación destructiva.');
  }

  const db = getFirestore();

  console.log('Iniciando limpieza de Auth...');
  const authDeleted = await deleteAllAuthUsers();
  console.log(`Usuarios eliminados en Auth: ${authDeleted}`);

  console.log('Iniciando limpieza de colección users...');
  const usersDeleted = await deleteCollection('users');
  console.log(`Documentos eliminados en users: ${usersDeleted}`);

  console.log('Iniciando limpieza de colección centrosSalud...');
  const centrosDeleted = await deleteCollection('centrosSalud');
  console.log(`Documentos eliminados en centrosSalud: ${centrosDeleted}`);

  console.log('Creando nuevo super_admin en Auth...');
  const createdAuthUser = await getAuth().createUser({
    email: args.email,
    password: args.password,
    displayName: `${args.nombre} ${args.apellido}`.trim()
  });

  console.log(`SuperAdmin creado en Auth con UID: ${createdAuthUser.uid}`);
  console.log('Creando documento en Firestore/users...');

  await db.collection('users').doc(createdAuthUser.uid).set({
    uid: createdAuthUser.uid,
    email: args.email,
    role: 'super_admin',
    nombre: args.nombre,
    apellido: args.apellido,
    telefono: args.telefono ?? null,
    activo: true,
    fechaCreacion: FieldValue.serverTimestamp(),
    fechaActualizacion: FieldValue.serverTimestamp()
  });

  console.log('Reset completado con éxito.');
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Error durante el reset: ${message}`);
  printUsage();
  process.exit(1);
});
