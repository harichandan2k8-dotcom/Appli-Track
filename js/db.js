/** AppliTrack persistence: Supabase Auth keeps users signed in and RLS owns data. */
import { APP_CONFIG } from './config.js';
const cache = { appliances: [], services: [], family: [], pendingInvites: [], currentUser: null };
let client = null;
const api = () => {
  if (client) return client;
  if (!window.supabase || !APP_CONFIG.supabaseUrl || !APP_CONFIG.supabaseAnonKey) return null;
  client = window.supabase.createClient(APP_CONFIG.supabaseUrl, APP_CONFIG.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  return client;
};
const dbToApp = x => ({ id:x.id,name:x.name,brand:x.brand,model:x.model,serialNumber:x.serial_number||'',purchaseDate:x.purchase_date,purchasePrice:Number(x.purchase_price),warrantyMonths:Number(x.warranty_months),lifespanYears:Number(x.lifespan_years),room:x.room,status:x.status,imageUrl:x.image_url||'',notes:x.notes||'' });
const appToDB = x => ({ id:x.id,name:x.name,brand:x.brand,model:x.model,serial_number:x.serialNumber||null,purchase_date:x.purchaseDate,purchase_price:x.purchasePrice,warranty_months:x.warrantyMonths,lifespan_years:x.lifespanYears,room:x.room,status:x.status,image_url:x.imageUrl||null,notes:x.notes||null });
const dbToService = x => ({ id:x.id,applianceId:x.appliance_id,date:x.date,type:x.type,cost:Number(x.cost),technician:x.technician||'',phone:x.phone||'',description:x.description });
const serviceToDB = x => ({ id:x.id,appliance_id:x.applianceId,date:x.date,type:x.type,cost:x.cost,technician:x.technician||null,phone:x.phone||null,description:x.description });
const dbToProfile = x => ({ id:x.id,name:x.full_name||x.email,email:x.email,role:'Owner',profilePic:x.profile_pic||'' });
export const dbConfig = { isConnected:()=>Boolean(api()), getSupabaseUrl:()=>APP_CONFIG.supabaseUrl, getSupabaseKey:()=>'', setCredentials:()=>{throw new Error('Configure js/config.js before publishing.');} };
export const db = {
  async init(){ if (!api()) return; const {data:{session}}=await api().auth.getSession(); if(session) await this.sync(); },
  isConfigured:()=>Boolean(api()), isAuthenticated:()=>Boolean(cache.currentUser),
  async signUp({name,email,password}) { if(!api()) throw new Error('This site has not been connected to Supabase yet.'); const {error}=await api().auth.signUp({email,password,options:{data:{full_name:name}}}); if(error) throw error; },
  async signIn({email,password}) { if(!api()) throw new Error('This site has not been connected to Supabase yet.'); const {error}=await api().auth.signInWithPassword({email,password}); if(error) throw error; await this.sync(); },
  async signOut(){ if(api()) await api().auth.signOut(); cache.appliances=[];cache.services=[];cache.family=[];cache.pendingInvites=[];cache.currentUser=null; },
  async sync(){
    if(!api()) return;
    const {data:{user}}=await api().auth.getUser();
    if(!user){cache.currentUser=null;return;}
    const [p,a,s]=await Promise.all([api().from('profiles').select('*').eq('id',user.id).single(),api().from('appliances').select('*').order('created_at',{ascending:false}),api().from('services').select('*').order('date',{ascending:false})]);
    if(p.error||a.error||s.error) throw p.error||a.error||s.error;
    cache.currentUser=dbToProfile(p.data);
    cache.appliances=a.data.map(dbToApp);
    cache.services=s.data.map(dbToService);
    // Load household members from Supabase function
    try {
      const {data:members,error:me}=await api().rpc('get_household_members');
      const {data:invites,error:ie}=await api().rpc('get_household_invites');
      if(!me&&members) cache.family=members.map(x=>({id:x.id,name:x.full_name||x.email,email:x.email,role:x.role,profilePic:x.profile_pic||''}));
      else cache.family=[cache.currentUser];
      if(!ie&&invites) cache.pendingInvites=invites;
      else cache.pendingInvites=[];
    } catch(e){ cache.family=[cache.currentUser]; cache.pendingInvites=[]; }
  },
  getAppliances:()=>cache.appliances,getApplianceById:id=>cache.appliances.find(x=>x.id===id),
  async saveAppliance(x){const i=cache.appliances.findIndex(a=>a.id===x.id);if(i<0)cache.appliances.unshift(x);else cache.appliances[i]=x;const {error}=await api().from('appliances').upsert(appToDB(x));if(error)throw error;return x;},
  async deleteAppliance(id){const {error}=await api().from('appliances').delete().eq('id',id);if(error)throw error;cache.appliances=cache.appliances.filter(x=>x.id!==id);cache.services=cache.services.filter(x=>x.applianceId!==id);},
  getServices:()=>cache.services,getServicesForAppliance:id=>cache.services.filter(x=>x.applianceId===id),
  async saveService(x){const i=cache.services.findIndex(s=>s.id===x.id);if(i<0)cache.services.unshift(x);else cache.services[i]=x;const {error}=await api().from('services').upsert(serviceToDB(x));if(error)throw error;return x;},
  async deleteService(id){const {error}=await api().from('services').delete().eq('id',id);if(error)throw error;cache.services=cache.services.filter(x=>x.id!==id);},
  getFamilyMembers:()=>cache.family,
  getPendingInvites:()=>cache.pendingInvites,
  async inviteHouseholdMember(name,email){
    if(api()){
      const {error}=await api().rpc('invite_household_member',{invitee_name:name,invitee_email:email});
      if(error) throw error;
      await this.sync();
    } else {
      // Local simulation mode
      const existing=cache.family.find(m=>m.email.toLowerCase()===email.toLowerCase());
      if(!existing){ cache.pendingInvites.push({name,email}); }
    }
  },
  async removeFamilyMember(id){
    if(api()){
      const {error}=await api().from('household_members').delete().eq('user_id',id);
      if(error) throw error;
    }
    cache.family=cache.family.filter(x=>x.id!==id);
  },
  async cancelInvite(email){
    if(api()){
      const cu=cache.currentUser;
      // Find household ID via household_members table
      const {data:hm}=await api().from('household_members').select('household_id').eq('user_id',cu.id).single();
      if(hm){ await api().from('household_invites').delete().eq('household_id',hm.household_id).eq('email',email.toLowerCase()); }
    }
    cache.pendingInvites=cache.pendingInvites.filter(x=>x.email.toLowerCase()!==email.toLowerCase());
  },
  async saveFamilyMember(x){const {error}=await api().from('profiles').update({full_name:x.name,profile_pic:x.profilePic||null}).eq('id',x.id);if(error)throw error;cache.currentUser=x;cache.family=cache.family.map(m=>m.id===x.id?x:m);},
  getCurrentUser:()=>cache.currentUser,setCurrentUser:x=>(cache.currentUser=x),canModify:()=>Boolean(cache.currentUser),isAdmin:()=>Boolean(cache.currentUser)
};

