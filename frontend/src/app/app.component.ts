import { Component, AfterViewInit, ElementRef, ViewChild, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DataService, Project } from './data.service';
import '../report/core.js';
import '../report/charts.js';
import { mountReport } from '../report/view.js';
@Component({selector:'power-insights',standalone:true,imports:[FormsModule],templateUrl:'./app.component.html'})
export class AppComponent implements AfterViewInit {
  store=inject(DataService); error=signal(''); notice=signal(''); loading=signal(true); saving=signal(false);
  draft=signal<Project|null>(null); creating=signal(false); editSection=signal('Project'); editError=signal(''); history=signal<any[]>([]);
  state={}; sections=['Project','General Specs','Components','Additional details','Locations & sources'];
  topFields=['name','owner','award_date','completion_target','confidence','notes'];
  jsonFields=['locations','source_ids','specs_sources','specs_scope']; jsonDraft:Record<string,string>={};
  @ViewChild('editor') editor?:ElementRef<HTMLDialogElement>;
  get statuses(){return this.draft()?.['technology_category']==='HVDC'?['In Operation','Under Installation','Awarded','Tendering','Planned / Announced']:['Awarded','Delivered','Planned','Tendering','Planned / Announced'];}
  get sourceList():any[]{const d=this.draft();return (d?.['source_ids']||[]).map((id:string)=>({id,...this.store.data()?.sources[id]}));}
  isUrl(value:string){return /^https?:\/\//i.test(value||'');}
  label(key:string){return key.replace(/_/g,' ').replace(/\bkv\b/gi,'kV').replace(/\bmvar\b/gi,'MVAr').replace(/\busd\b/gi,'USD').replace(/^./,c=>c.toUpperCase());}
  fields(group:string){return Object.keys(this.draft()?.[group]||{}).filter(k=>!['cost','Cost estimation basis'].includes(k)).sort();}
  async ngAfterViewInit(){await this.reload();}
  async reload(){this.error.set('');this.loading.set(true);try {await this.store.load();this.render();}catch{this.error.set('Could not connect to PowerInsights API. Check the server and retry.');}finally{this.loading.set(false);}}
  render(){mountReport(this.store.data(),(id:string)=>this.openEditor(id),(technology:string)=>this.openNew(technology),this.state);}
  blankFields(group:string,technology:string){
    const keys=new Set<string>();
    for(const project of this.store.data()?.projects||[])if(project['technology_category']===technology)for(const key of Object.keys(project[group]||{}))keys.add(key);
    return Object.fromEntries([...keys].sort().map(key=>[key,'']));
  }
  newDraft(technology:string):Project{
    const specs=this.blankFields('specs',technology);
    return {id:'New',revision:0,technology_category:technology,name:'',owner:'',award_date:'',completion_target:'',confidence:'Medium',notes:'',
      status:technology==='HVDC'?'Planned / Announced':'Planned',specs,components:this.blankFields('components',technology),
      specs_extra:this.blankFields('specs_extra',technology),locations:[],source_ids:[],specs_sources:Object.fromEntries(Object.keys(specs).map(key=>[key,[]])),
      specs_scope:[],recorded_cost_usd:null,equivalent_mvar:null};
  }
  prepareDraft(copy:Project,section:string){
    copy.specs||={};copy.specs_extra||={};copy.components||={};copy.locations||=[];copy.source_ids||=[];copy.specs_sources||={};copy.specs_scope||=[];
    this.draft.set(copy);this.editSection.set(section);this.editError.set('');this.history.set([]);
    for(const key of this.jsonFields)this.jsonDraft[key]=JSON.stringify(copy[key],null,2);
    setTimeout(()=>{const dialog=this.editor?.nativeElement;if(dialog&&!dialog.open)dialog.showModal();});
  }
  openNew(technology:string){this.creating.set(true);this.prepareDraft(this.newDraft(technology),'Project');}
  changeNewTechnology(technology:string){
    const current=this.draft();if(!current||!this.creating()||current['technology_category']===technology)return;
    const next=this.newDraft(technology);for(const key of this.topFields)next[key]=current[key];
    this.prepareDraft(next,'Project');
  }
  async openEditor(id:string){
    const project=this.store.data().projects.find((p:Project)=>p['id']===id);if(!project)return;
    const copy=structuredClone(project);copy.status=copy.stage_override||copy.status;
    this.creating.set(false);this.prepareDraft(copy,'Project');
    try{const h=await this.store.history(id);if(this.draft()?.['id']===id)this.history.set(h);}catch{}
  }
  close(){if(this.saving())return;this.editor?.nativeElement.close();this.draft.set(null);this.creating.set(false);}
  onCancel(event:Event){event.preventDefault();this.close();}
  async save(){
    const d=this.draft();if(!d)return;this.editError.set('');this.saving.set(true);
    try{
      for(const key of this.jsonFields)d[key]=JSON.parse(this.jsonDraft[key]);
      for(const key of ['recorded_cost_usd','equivalent_mvar'])if(d[key]==='')d[key]=null;
      const isNew=this.creating();await (isNew?this.store.create(d):this.store.save(d));this.saving.set(false);this.close();this.render();
      this.notice.set(isNew?'Project added. All tabs, charts and exports now include it.':'Saved. All tabs, charts and exports now use the updated data.');
    }catch(e:any){this.editError.set(e.error?.message||e.message||'Save failed. Your changes are still in the editor.');}finally{this.saving.set(false);}
  }
  print(){window.print();}
}
