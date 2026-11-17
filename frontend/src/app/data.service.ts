import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
export type Project = Record<string, any>;
@Injectable({providedIn:'root'})
export class DataService {
  private http=inject(HttpClient);
  data=signal<any>(null);
  async load(){const data=await firstValueFrom(this.http.get('/api/data'));this.data.set(data);}
  async save(project:Project){const saved=await firstValueFrom(this.http.put<Project>('/api/projects/'+encodeURIComponent(project['id']),project));await this.load();return saved;}
  async create(project:Project){const saved=await firstValueFrom(this.http.post<Project>('/api/projects',project));await this.load();return saved;}
  history(id:string){return firstValueFrom(this.http.get<any[]>('/api/projects/'+encodeURIComponent(id)+'/history'));}
}
