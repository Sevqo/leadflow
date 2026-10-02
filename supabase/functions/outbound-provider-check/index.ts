import {errorResponse,json,readJson} from '../_shared/http.ts'
import {adminClient,requireUser} from '../_shared/supabase.ts'
import {signedAdapterRequest,type Capability} from '../_shared/outbound.ts'

type Body={organizationId:string;capability:Capability;providerName:string}
Deno.serve(async request=>{
  if(request.method==='OPTIONS')return new Response(null,{headers:{'Access-Control-Allow-Origin':Deno.env.get('APP_ORIGIN')??'http://localhost:5173','Access-Control-Allow-Headers':'authorization, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'}})
  if(request.method!=='POST')return json({error:'Method not allowed.'},405)
  try{
    const body=await readJson<Body>(request),{client}=await requireUser(request)
    const {data:allowed}=await client.rpc('has_org_role',{target_org:body.organizationId,allowed_roles:['OWNER','ADMIN']})
    if(!allowed)throw new Error('Insufficient permission.')
    const admin=adminClient()
    await admin.from('outbound_provider_connections').upsert({organization_id:body.organizationId,capability:body.capability,provider_name:body.providerName,status:'VERIFYING',last_error:null},{onConflict:'organization_id,capability'})
    try{
      const result=await signedAdapterRequest(body.capability,'/health',{capability:body.capability,workspaceId:body.organizationId})
      await admin.from('outbound_provider_connections').update({status:'CONNECTED',last_checked_at:new Date().toISOString(),last_error:null,public_config:{providerStatus:result.status??'available'}}).eq('organization_id',body.organizationId).eq('capability',body.capability)
      return json({connected:true})
    }catch(reason){
      const message=reason instanceof Error?reason.message:'Provider verification failed.'
      const setup=/setup is required/i.test(message)
      await admin.from('outbound_provider_connections').update({status:setup?'SETUP_REQUIRED':'ERROR',last_checked_at:new Date().toISOString(),last_error:message.slice(0,500)}).eq('organization_id',body.organizationId).eq('capability',body.capability)
      return json({connected:false,error:message},setup?409:502)
    }
  }catch(reason){return errorResponse(reason,'Unable to verify provider.')}
})
