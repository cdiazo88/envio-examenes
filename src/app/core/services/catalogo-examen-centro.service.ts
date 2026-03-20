import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
  CollectionReference
} from '@angular/fire/firestore';
import { Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';
import { CatalogoExamenCentro } from '@core/models';

@Injectable({
  providedIn: 'root'
})
export class CatalogoExamenCentroService {
  private firestore = inject(Firestore);

  private catalogoCollection = collection(
    this.firestore,
    'catalogoExamenesCentro'
  ) as CollectionReference<CatalogoExamenCentro>;

  getByCentro(centroSaludId: string): Observable<CatalogoExamenCentro[]> {
    const q = query(
      this.catalogoCollection,
      where('centroSaludId', '==', centroSaludId)
    );

    return from(getDocs(q)).pipe(
      map(snapshot => {
        const items = snapshot.docs.map(docSnap => ({ ...docSnap.data(), id: docSnap.id }));
        return items.sort((a, b) => a.nombre.localeCompare(b.nombre));
      })
    );
  }

  create(centroSaludId: string, nombre: string): Observable<CatalogoExamenCentro> {
    const payload: Omit<CatalogoExamenCentro, 'id'> = {
      centroSaludId,
      nombre: nombre.trim(),
      activo: true,
      fechaCreacion: new Date(),
      fechaActualizacion: new Date()
    };

    return from(addDoc(this.catalogoCollection, payload as any)).pipe(
      map(ref => ({ id: ref.id, ...payload }))
    );
  }

  update(id: string, data: Partial<CatalogoExamenCentro>): Observable<void> {
    const ref = doc(this.firestore, `catalogoExamenesCentro/${id}`);
    return from(updateDoc(ref, { ...data, fechaActualizacion: new Date() } as any));
  }

  delete(id: string): Observable<void> {
    const ref = doc(this.firestore, `catalogoExamenesCentro/${id}`);
    return from(deleteDoc(ref));
  }
}
