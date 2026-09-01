import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const ROLES = ['ADMINISTRATIVO', 'TECNICO', 'GESTOR', 'FINANCEIRO'];
const STATUSES = ['ATIVO', 'INATIVO', 'DESLIGADO'];
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
function corsFor(req: Request) { const a=(Deno.env.get('ALLOWED_ORIGINS')||'').split(',').map(s=>s.trim()).filter(Boolean); const o=req.headers.get('Origin')||''; return {'Access-Control-Allow-Origin':a.length?(a.includes(o)?o:a[0]):'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'}; }
function json(status:number, body:unknown, cors:Record<string,string>) { return new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}}); }

Deno.serve(async (req: Request) => {
  const cors=corsFor(req); if(req.method==='OPTIONS') return new Response('ok',{headers:cors});
  if(req.method!=='POST') return json(405,{error:'method_not_allowed'},cors);
  const url=Deno.env.get('SUPABASE_URL')!; const header=req.headers.get('Authorization')||'';
  if(!header.startsWith('Bearer ')) return json(401,{error:'unauthorized'},cors);
  const requester=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:header}},auth:{persistSession:false}});
  const {data:ud,error:ue}=await requester.auth.getUser(); if(ue||!ud.user) return json(401,{error:'unauthorized'},cors);
  const admin=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
  const {data:actor}=await admin.from('profiles').select('role,status,name').eq('id',ud.user.id).single();
  if(!actor||actor.role!=='ADMINISTRATIVO'||actor.status!=='ATIVO') return json(403,{error:'forbidden'},cors);
  let b:Record<string,unknown>; try{b=await req.json();}catch{return json(400,{error:'invalid_json'},cors);}
  const appUrl=(Deno.env.get('APP_URL')||'').replace(/\/$/,'');
  if(!/^https:\/\//i.test(appUrl)) return json(500,{error:'redirect_not_configured'},cors);
  const redirectTo=`${appUrl}/funcionarios/primeiro-acesso/`;

  if(String(b.action||'invite')==='resend') {
    const id=String(b.targetUserId||'').trim();
    const {data:t}=await admin.from('profiles').select('id,email,first_access_completed,status').eq('id',id).single();
    if(!t?.email) return json(404,{error:'target_not_found'},cors);
    if(t.first_access_completed) return json(409,{error:'already_activated'},cors);
    if(t.status!=='ATIVO') return json(409,{error:'target_inactive'},cors);
    // Reenvio oficial para usuário Auth existente: recovery preserva UUID/profile.
    const {error}=await admin.auth.resetPasswordForEmail(t.email,{redirectTo});
    if(error) return json(400,{error:'invite_failed'},cors);
    await admin.from('profiles').update({invitation_sent_at:new Date().toISOString()}).eq('id',id);
    await admin.from('audit_logs').insert({user_id:ud.user.id,user_name:actor.name,user_role:actor.role,action:'USER_INVITE_RESENT',module:'usuarios',details:`target_user_id=${id}`});
    return json(200,{ok:true,id},cors);
  }

  const email=String(b.email||'').trim().toLowerCase(), name=String(b.name||'').trim();
  const role=String(b.role||''), status=String(b.status||'ATIVO');
  if(!EMAIL.test(email)) return json(422,{error:'invalid_email'},cors);
  if(!name) return json(422,{error:'invalid_name'},cors);
  if(!ROLES.includes(role)) return json(422,{error:'invalid_role'},cors);
  if(!STATUSES.includes(status)) return json(422,{error:'invalid_status'},cors);
  const {data:inv,error:ie}=await admin.auth.admin.inviteUserByEmail(email,{redirectTo,data:{name}});
  if(ie||!inv.user){const m=(ie?.message||'').toLowerCase(),exists=m.includes('already')||m.includes('registered');return json(exists?409:400,{error:exists?'email_exists':'invite_failed'},cors);}
  const id=inv.user.id;
  const {error:pe}=await admin.from('profiles').upsert({id,name,email,role,status,cargo:b.cargo??null,full_name:b.fullName??null,cpf:b.cpf??null,birth_date:b.birthDate??null,phone:b.phone??null,schedule:b.schedule??null,courses:b.courses??null,first_access_completed:false,first_access_completed_at:null,invitation_sent_at:new Date().toISOString()},{onConflict:'id'});
  if(pe){await admin.auth.admin.deleteUser(id).catch(()=>{});return json(500,{error:'profile_update_failed'},cors);}
  await admin.from('audit_logs').insert({user_id:ud.user.id,user_name:actor.name,user_role:actor.role,action:'USER_INVITED',module:'usuarios',details:`target_user_id=${id} target_role=${role}`});
  return json(200,{ok:true,id},cors);
});
