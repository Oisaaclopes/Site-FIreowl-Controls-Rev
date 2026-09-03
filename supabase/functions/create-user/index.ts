import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { strongPassword } from '../_shared/password.ts';
const ROLES = ['ADMINISTRATIVO', 'TECNICO', 'GESTOR', 'FINANCEIRO'];
const STATUSES = ['ATIVO', 'INATIVO', 'DESLIGADO'];
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
function corsFor(req: Request) { const allowed=(Deno.env.get('ALLOWED_ORIGINS')||'').split(',').map(s=>s.trim()).filter(Boolean); const origin=req.headers.get('Origin')||''; return {'Access-Control-Allow-Origin':allowed.length?(allowed.includes(origin)?origin:allowed[0]):'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'}; }
function json(status:number, body:unknown, cors:Record<string,string>) { return new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}}); }

Deno.serve(async (req: Request) => {
  const cors=corsFor(req); if(req.method==='OPTIONS') return new Response('ok',{headers:cors});
  if(req.method!=='POST') return json(405,{error:'method_not_allowed'},cors);
  const url=Deno.env.get('SUPABASE_URL')!, header=req.headers.get('Authorization')||'';
  if(!header.startsWith('Bearer ')) return json(401,{error:'unauthorized'},cors);
  const requester=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:header}},auth:{persistSession:false}});
  const {data:identity,error:identityError}=await requester.auth.getUser();
  if(identityError||!identity.user) return json(401,{error:'unauthorized'},cors);
  const admin=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
  const {data:actor}=await admin.from('profiles').select('role,status,name').eq('id',identity.user.id).single();
  if(!actor||actor.role!=='ADMINISTRATIVO'||actor.status!=='ATIVO') return json(403,{error:'forbidden'},cors);
  let body:Record<string,unknown>; try{body=await req.json();}catch{return json(400,{error:'invalid_json'},cors);}
  const email=String(body.email||'').trim().toLowerCase(), name=String(body.name||'').trim();
  const role=String(body.role||''), status=String(body.status||'ATIVO'), temporaryPassword=String(body.temporaryPassword||'');
  if(!EMAIL.test(email)) return json(422,{error:'invalid_email'},cors);
  if(!name) return json(422,{error:'invalid_name'},cors);
  if(!ROLES.includes(role)) return json(422,{error:'invalid_role'},cors);
  if(!STATUSES.includes(status)) return json(422,{error:'invalid_status'},cors);
  if(!strongPassword(temporaryPassword)) return json(422,{error:'weak_password'},cors);
  const {data:created,error:createError}=await admin.auth.admin.createUser({email,password:temporaryPassword,email_confirm:true,user_metadata:{name}});
  if(createError||!created.user){const message=(createError?.message||'').toLowerCase();const exists=message.includes('already')||message.includes('registered');return json(exists?409:400,{error:exists?'email_exists':'create_failed'},cors);}
  const id=created.user.id;
  const {error:profileError}=await admin.from('profiles').upsert({id,name,email,role,status,cargo:body.cargo??null,full_name:body.fullName??null,cpf:body.cpf??null,birth_date:body.birthDate??null,phone:body.phone??null,schedule:body.schedule??null,courses:body.courses??null,uses_time_clock:body.usesTimeClock!==false,first_access_completed:false,first_access_completed_at:null},{onConflict:'id'});
  if(profileError){await admin.auth.admin.deleteUser(id).catch(()=>{});return json(500,{error:'profile_update_failed'},cors);}
  await admin.from('audit_logs').insert({user_id:identity.user.id,user_name:actor.name,user_role:actor.role,action:'USER_CREATED',module:'usuarios',details:`target_user_id=${id} target_role=${role}`});
  return json(200,{ok:true,id},cors);
});
