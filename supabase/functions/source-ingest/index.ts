import {corsHeaders,errorResponse,json,readJson} from '../_shared/http.ts'
import {adminClient} from '../_shared/supabase.ts'

type Payload={name:string;email?:string;phone?:string;company?:string;interest?:string;estimatedValue?:number;message?:string;externalId?:string;metadata?:Record<string,unknown>}
const hash=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(byte=>byte.toString(16).padStart(2,'0')).join('')

Deno.serve(async request=>{
  if(request.method==='OPTIONS')return new Response(null,{headers:corsHeaders})
  if(request.method!=='POST')return json({error:'Method not allowed.'},405)
  try{
    const token=(request.headers.get('x-leadflow-source-key')??request.headers.get('x-nexara-source-key'))?.trim()??''
    if(token.length<32)throw new Error('A valid source key is required.')
    const body=await readJson<Payload>(request)
    if(!body.name?.trim())throw new Error('Customer name is required.')
    if(!body.email?.trim()&&!body.phone?.trim())throw new Error('An email address or phone number is required.')
    const admin=adminClient()
    const tokenHash=await hash(token)
    const {data:source,error:sourceError}=await admin.from('lead_sources').select('*').eq('secret_hash',tokenHash).eq('status','ACTIVE').maybeSingle()
    if(sourceError||!source)throw new Error('Source credentials are invalid or paused.')
    let contact:null|{id:string}=null
    if(body.email?.trim()){const result=await admin.from('contacts').select('id').eq('organization_id',source.organization_id).ilike('email',body.email.trim()).maybeSingle();contact=result.data}
    if(!contact&&body.phone?.trim()){const result=await admin.from('contacts').select('id').eq('organization_id',source.organization_id).eq('phone',body.phone.trim()).maybeSingle();contact=result.data}
    if(!contact){const result=await admin.from('contacts').insert({organization_id:source.organization_id,name:body.name.trim().slice(0,160),email:body.email?.trim()||null,phone:body.phone?.trim()||null,company:body.company?.trim()||null,tags:[source.platform]}).select('id').single();if(result.error)throw result.error;contact=result.data}
    const {data:lead,error:leadError}=await admin.from('leads').insert({organization_id:source.organization_id,contact_id:contact.id,interest:body.interest?.trim().slice(0,500)||body.message?.trim().slice(0,500)||`Enquiry from ${source.name}`,source:source.name,stage:'NEW',score:35,estimated_value:Number.isFinite(body.estimatedValue)?body.estimatedValue:null,next_action:'Review inbound enquiry',qualification:{platform:source.platform,external_id:body.externalId??null,metadata:body.metadata??{}}}).select('id').single()
    if(leadError)throw leadError
    await Promise.all([admin.from('lead_sources').update({last_received_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',source.id),admin.from('lead_activities').insert({organization_id:source.organization_id,lead_id:lead.id,activity_type:'CREATED',body:`Lead received from ${source.name}`,metadata:{source_id:source.id,platform:source.platform}}),admin.from('analytics_events').insert({organization_id:source.organization_id,event_name:'lead_created',entity_type:'lead',entity_id:lead.id,properties:{source:source.name,platform:source.platform}}),admin.from('audit_events').insert({organization_id:source.organization_id,event_type:'lead_source_ingested',entity_type:'lead',entity_id:lead.id,metadata:{source_id:source.id,platform:source.platform}})])
    const automationSecret=Deno.env.get('AUTOMATION_CRON_SECRET'),supabaseUrl=Deno.env.get('SUPABASE_URL')
    if(automationSecret&&supabaseUrl){const {data:automations}=await admin.from('automations').select('id').eq('organization_id',source.organization_id).eq('status','ACTIVE').eq('trigger_type','LEAD_CREATED');await Promise.allSettled((automations??[]).map(automation=>fetch(`${supabaseUrl}/functions/v1/automation-run`,{method:'POST',headers:{'content-type':'application/json','x-automation-secret':automationSecret},body:JSON.stringify({automationId:automation.id,leadId:lead.id,triggerEvent:'LEAD_CREATED'})})))}
    return json({accepted:true},202)
  }catch(reason){return errorResponse(reason,'Unable to accept this lead source payload.')}
})
