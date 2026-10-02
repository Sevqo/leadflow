import {corsHeaders,errorResponse,json} from '../_shared/http.ts'
import {adminClient,requireSecret} from '../_shared/supabase.ts'
import {signedAdapterRequest,type Capability} from '../_shared/outbound.ts'

type Job={id:string;organization_id:string;campaign_id:string;prospect_id:string;capability:Capability;job_type:string;attempt:number;max_attempts:number;input:Record<string,unknown>}
const retryAt=(attempt:number)=>new Date(Date.now()+Math.min(60,2**Math.max(0,attempt-1))*60_000).toISOString()

Deno.serve(async request=>{
  if(request.method==='OPTIONS')return new Response(null,{headers:corsHeaders})
  if(request.method!=='POST')return json({error:'Method not allowed.'},405)
  try{
    if(request.headers.get('x-outbound-secret')!==requireSecret('OUTBOUND_CRON_SECRET'))return json({error:'Unauthorized.'},401)
    const admin=adminClient(),{data:claimed,error}=await admin.rpc('claim_outbound_jobs',{batch_size:20})
    if(error)throw error
    const results=[]
    for(const job of (claimed??[]) as Job[]){
      try{
        const [{data:prospect},{data:campaign},{data:steps}]=await Promise.all([
          admin.from('outbound_prospects').select('*').eq('id',job.prospect_id).single(),
          admin.from('outbound_campaigns').select('*').eq('id',job.campaign_id).single(),
          admin.from('outbound_sequence_steps').select('*').eq('campaign_id',job.campaign_id).order('position'),
        ])
        if(!prospect||!campaign)throw new Error('Outbound record is unavailable.')
        await admin.from('outbound_prospects').update({...(job.capability==='RESEARCH'?{research_status:'RUNNING'}:{}),...(job.capability==='ENRICHMENT'?{enrichment_status:'RUNNING'}:{}),...(job.capability==='EMAIL_VALIDATION'?{email_validation_status:'RUNNING'}:{})}).eq('id',prospect.id)
        const output=await signedAdapterRequest(job.capability,'/execute',{jobId:job.id,type:job.job_type,workspaceId:job.organization_id,campaign:{id:campaign.id,name:campaign.name,offer:campaign.offer_summary,valueProposition:campaign.value_proposition,bookingUrl:campaign.booking_url},prospect:{id:prospect.id,name:prospect.name,email:prospect.email,title:prospect.title,company:prospect.company,website:prospect.website,country:prospect.country,industry:prospect.industry},sequence:steps??[],input:job.input})
        if(job.job_type==='RESEARCH_PROSPECT')await admin.from('outbound_prospects').update({research_status:'COMPLETE',research_notes:String(output.researchNotes??prospect.research_notes??'').slice(0,10000)}).eq('id',prospect.id)
        if(job.job_type==='ENRICH_PROSPECT')await admin.from('outbound_prospects').update({enrichment_status:'COMPLETE',enrichment:output.data??output,provider_contact_id:typeof output.contactId==='string'?output.contactId:null}).eq('id',prospect.id)
        if(job.job_type==='VALIDATE_EMAIL'){const verdict=String(output.verdict??'RISKY').toUpperCase();await admin.from('outbound_prospects').update({email_validation_status:['VALID','RISKY','INVALID'].includes(verdict)?verdict:'RISKY',email_validation_reason:String(output.reason??'').slice(0,500)}).eq('id',prospect.id)}
        if(job.job_type==='SEND_SEQUENCE_STEP'){
          const stepId=typeof job.input.sequence_step_id==='string'?job.input.sequence_step_id:null
          await admin.from('outbound_message_deliveries').insert({organization_id:job.organization_id,campaign_id:job.campaign_id,prospect_id:job.prospect_id,sequence_step_id:stepId,provider_message_id:typeof output.messageId==='string'?output.messageId:null,status:'SENT',subject:typeof output.subject==='string'?output.subject:null,sent_at:new Date().toISOString()})
          await admin.from('outbound_prospects').update({status:'CONTACTED',last_contacted_at:new Date().toISOString()}).eq('id',prospect.id)
        }
        await admin.from('outbound_jobs').update({status:'SUCCEEDED',output,completed_at:new Date().toISOString(),last_error:null}).eq('id',job.id)
        results.push({id:job.id,status:'SUCCEEDED'})
      }catch(reason){
        const message=reason instanceof Error?reason.message:'Provider execution failed.',setup=/setup is required/i.test(message),terminal=setup||job.attempt>=job.max_attempts
        await admin.from('outbound_jobs').update({status:setup?'BLOCKED':terminal?'FAILED':'FAILED',available_at:terminal?new Date().toISOString():retryAt(job.attempt),last_error:message.slice(0,1000),locked_at:null}).eq('id',job.id)
        await admin.from('outbound_prospects').update({...(job.capability==='RESEARCH'?{research_status:setup?'BLOCKED':'FAILED'}:{}),...(job.capability==='ENRICHMENT'?{enrichment_status:setup?'BLOCKED':'FAILED'}:{}),...(job.capability==='EMAIL_VALIDATION'?{email_validation_status:setup?'BLOCKED':'FAILED'}:{})}).eq('id',job.prospect_id)
        results.push({id:job.id,status:setup?'BLOCKED':'FAILED'})
      }
    }
    return json({processed:results.length,results})
  }catch(reason){return errorResponse(reason,'Unable to process outbound jobs.')}
})
