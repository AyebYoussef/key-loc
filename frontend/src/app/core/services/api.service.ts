import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Casier, Ebauche, EtatLed, Fabricant, ModeleCle, ScanResultat, StatDashboard } from '../models/models';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private baseUrl = 'http://localhost:8000/api';

  constructor(private http: HttpClient) {}

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

