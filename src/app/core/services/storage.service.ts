import { Injectable, inject } from '@angular/core';
import {
  Storage,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
  UploadResult
} from '@angular/fire/storage';
import { Observable, from } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

/**
 * Servicio para gestión de archivos en Firebase Storage
 */
@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private storage = inject(Storage);

  /**
   * Sube un archivo a Firebase Storage
   * @param file Archivo a subir
   * @param path Ruta donde se guardará el archivo
   * @returns URL de descarga del archivo
   */
  uploadFile(file: File, path: string): Observable<string> {
    const storageRef = ref(this.storage, path);
    return from(uploadBytes(storageRef, file)).pipe(
      map(async (result: UploadResult) => {
        return await getDownloadURL(result.ref);
      }),
      switchMap(promise => from(promise))
    );
  }

  /**
   * Sube múltiples archivos
   * @param files Archivos a subir
   * @param basePath Ruta base donde se guardarán
   * @returns Array de URLs de descarga
   */
  uploadMultipleFiles(files: File[], basePath: string): Observable<string[]> {
    const uploadPromises = files.map((file, index) => {
      const fileName = `${Date.now()}_${index}_${file.name}`;
      const filePath = `${basePath}/${fileName}`;
      return this.uploadFile(file, filePath).toPromise();
    });

    return from(Promise.all(uploadPromises)).pipe(
      map(urls => urls.filter(url => url !== undefined) as string[])
    );
  }

  /**
   * Elimina un archivo de Storage
   * @param url URL completa del archivo
   */
  deleteFile(url: string): Observable<void> {
    const fileRef = ref(this.storage, url);
    return from(deleteObject(fileRef));
  }

  /**
   * Elimina múltiples archivos
   * @param urls Array de URLs de archivos a eliminar
   */
  deleteMultipleFiles(urls: string[]): Observable<void[]> {
    const deletePromises = urls.map(url => this.deleteFile(url).toPromise());
    return from(Promise.all(deletePromises)) as Observable<void[]>;
  }

  /**
   * Obtiene la URL de descarga de un archivo
   * @param path Ruta del archivo en Storage
   */
  getDownloadURL(path: string): Observable<string> {
    const fileRef = ref(this.storage, path);
    return from(getDownloadURL(fileRef));
  }
}
