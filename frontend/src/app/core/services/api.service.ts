import { Injectable } from '@angular/core';
import { HttpClient, HttpEvent, HttpParams, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  Casier,
  DatasetStatusResponse,
  Ebauche,
  EbauchePhoto,
  EbauchePhotosUploadResponse,
  EtatLed,
  Fabricant,
  ModeleCle,
  ScanResultat,
  StatDashboard,
} from '../models/models';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  get serverOrigin(): string {
    if (typeof window !== 'undefined' && window.location) {
      const hostname = window.location.hostname || 'localhost';
      return `http://${hostname}:8000`;
    }
    return 'http://localhost:8000';
  }

  get baseUrl(): string {
    return `${this.serverOrigin}/api`;
  }

  constructor(private http: HttpClient) {}

  getPhotoUrl(url: string): string {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    return `${this.serverOrigin}${url.startsWith('/') ? '' : '/'}${url}`;
  }

  // Dashboard & Stats
  getDashboardStats(): Observable<StatDashboard> {
    return this.http.get<StatDashboard>(`${this.baseUrl}/stats/dashboard`);
  }

  // Modèles
  getModeles(q?: string, fabricantId?: number): Observable<ModeleCle[]> {
    let params = new HttpParams();
    if (q) params = params.set('q', q);
    if (fabricantId) params = params.set('fabricant_id', fabricantId.toString());
    return this.http.get<ModeleCle[]>(`${this.baseUrl}/modeles/`, { params });
  }

  getModele(id: number): Observable<ModeleCle> {
    return this.http.get<ModeleCle>(`${this.baseUrl}/modeles/${id}`);
  }

  creerModele(payload: { reference: string; libelle: string; fabricant_id: number; description?: string }): Observable<ModeleCle> {
    return this.http.post<ModeleCle>(`${this.baseUrl}/modeles/`, payload);
  }

  // Fabricants
  getFabricants(): Observable<Fabricant[]> {
    return this.http.get<Fabricant[]>(`${this.baseUrl}/fabricants/`);
  }

  // Ébauches & Stock
  getEbauches(statut?: string): Observable<Ebauche[]> {
    let params = new HttpParams();
    if (statut) params = params.set('statut', statut);
    return this.http.get<Ebauche[]>(`${this.baseUrl}/ebauches/`, { params });
  }

  getAlertes(): Observable<Ebauche[]> {
    return this.http.get<Ebauche[]>(`${this.baseUrl}/alertes/`);
  }

  creerEbauche(payload: { modele_id: number; casier_id: number; quantite: number; seuil_alerte?: number; quantite_min?: number }): Observable<Ebauche> {
    return this.http.post<Ebauche>(`${this.baseUrl}/ebauches/`, payload);
  }

  modifierEbauche(id: number, payload: Partial<{ casier_id: number; modele_id: number; quantite: number; seuil_alerte: number; quantite_min: number }>): Observable<Ebauche> {
    return this.http.patch<Ebauche>(`${this.baseUrl}/ebauches/${id}`, payload);
  }

  supprimerEbauche(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/ebauches/${id}`);
  }

  // Photos de référence (Dataset YOLO)
  getEbauchePhotos(ebaucheId: number): Observable<EbauchePhoto[]> {
    return this.http.get<EbauchePhoto[]>(`${this.baseUrl}/ebauches/${ebaucheId}/photos`);
  }

  uploadEbauchePhotos(
    ebaucheId: number,
    files: File[],
    source: 'catalogue' | 'telephone' | 'scan_confirme' = 'catalogue'
  ): Observable<HttpEvent<EbauchePhotosUploadResponse>> {
    const formData = new FormData();
    formData.append('source', source);
    for (const file of files) {
      formData.append('photos', file, file.name);
    }
    return this.http.post<EbauchePhotosUploadResponse>(
      `${this.baseUrl}/ebauches/${ebaucheId}/photos`,
      formData,
      {
        reportProgress: true,
        observe: 'events',
      }
    );
  }

  deleteEbauchePhoto(photoId: number): Observable<{ message: string; id: number }> {
    return this.http.delete<{ message: string; id: number }>(`${this.baseUrl}/ebauches/photos/${photoId}`);
  }

  // Dataset ML & Export YOLO
  getDatasetStatus(seuil?: number): Observable<DatasetStatusResponse> {
    let params = new HttpParams();
    if (seuil !== undefined) params = params.set('seuil', seuil.toString());
    return this.http.get<DatasetStatusResponse>(`${this.baseUrl}/ml/dataset/status`, { params });
  }

  exportDatasetZip(seed: number = 42): Observable<HttpResponse<Blob>> {
    const params = new HttpParams().set('seed', seed.toString());
    return this.http.get(`${this.baseUrl}/ml/dataset/export`, {
      params,
      observe: 'response',
      responseType: 'blob',
    });
  }

  prelever(ebaucheId: number): Observable<Ebauche> {
    return this.http.post<Ebauche>(`${this.baseUrl}/stock/prelever`, { ebauche_id: ebaucheId });
  }

  reapprovisionner(ebaucheId: number, quantite: number): Observable<Ebauche> {
    return this.http.post<Ebauche>(`${this.baseUrl}/stock/reapprovisionner`, { ebauche_id: ebaucheId, quantite });
  }

  // Casiers & LED Virtuelle
  getCasiers(): Observable<Casier[]> {
    return this.http.get<Casier[]>(`${this.baseUrl}/casiers/`);
  }

  getEtatLed(casierId: number): Observable<EtatLed> {
    return this.http.get<EtatLed>(`${this.baseUrl}/casiers/${casierId}/etat`);
  }

  allumerLed(casierId: number, dureeSecondes: number = 15): Observable<EtatLed> {
    return this.http.post<EtatLed>(`${this.baseUrl}/casiers/${casierId}/allumer`, { casier_id: casierId, duree_secondes: dureeSecondes });
  }

  eteindreLed(casierId: number): Observable<EtatLed> {
    return this.http.post<EtatLed>(`${this.baseUrl}/casiers/${casierId}/eteindre`, {});
  }

  // Scan
  scannerCle(formData: FormData): Observable<ScanResultat> {
    return this.http.post<ScanResultat>(`${this.baseUrl}/scans/`, formData);
  }
}
