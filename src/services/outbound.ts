import {requireSupabase,throwServiceError} from './api'
import type {OutboundCampaignRow,OutboundDeliveryRow,OutboundJobRow,OutboundProspectRow,OutboundProviderConnectionRow,OutboundSequenceStepRow} from '../types/database'

export async function loadOutbound(organizationId:string){
  const db=requireSupabase()
  const [campaigns,prospects,steps,connections,jobs,deliveries]=await Promise.all([
    db.from('outbound_campaigns').select('*').eq('organization_id',organizationId).order('created_at',{ascending:false}),
    db.from('outbound_prospects').select('*').eq('organization_id',organizationId).order('fit_score',{ascending:false}),
    db.from('outbound_sequence_steps').select('*').eq('organization_id',organizationId).order('position'),
    db.from('outbound_provider_connections').select('*').eq('organization_id',organizationId).order('capability'),
    db.from('outbound_jobs').select('*').eq('organization_id',organizationId).order('created_at',{ascending:false}).limit(50),
    db.from('outbound_message_deliveries').select('*').eq('organization_id',organizationId).order('created_at',{ascending:false}).limit(50),
  ])
  for(const result of [campaigns,prospects,steps,connections,jobs,deliveries])if(result.error)throwServiceError(result.error,'Unable to load outbound campaigns.')
  return {campaigns:campaigns.data??[],prospects:prospects.data??[],steps:steps.data??[],connections:connections.data??[],jobs:jobs.data??[],deliveries:deliveries.data??[]}
}

export async function createOutboundCampaign(organizationId:string,input:Pick<OutboundCampaignRow,'name'|'website_url'|'offer_summary'|'value_proposition'|'target_industries'|'target_regions'|'target_company_sizes'|'target_titles'|'tone'|'booking_url'|'daily_send_limit'>){
  const {data:{user}}=await requireSupabase().auth.getUser()
  const {data,error}=await requireSupabase().from('outbound_campaigns').insert({organization_id:organizationId,...input,created_by:user?.id??null}).select().single()
  if(error)throwServiceError(error,'Unable to create campaign.');return data
}
export async function updateOutboundCampaign(organizationId:string,id:string,changes:Partial<OutboundCampaignRow>){
  const {data,error}=await requireSupabase().from('outbound_campaigns').update(changes).eq('organization_id',organizationId).eq('id',id).select().single()
  if(error)throwServiceError(error,'Unable to update campaign.');return data
}
export async function saveSequenceStep(organizationId:string,campaignId:string,input:Pick<OutboundSequenceStepRow,'position'|'delay_days'|'subject_template'|'body_template'>){
  const {data,error}=await requireSupabase().from('outbound_sequence_steps').upsert({organization_id:organizationId,campaign_id:campaignId,...input},{onConflict:'campaign_id,position'}).select().single()
  if(error)throwServiceError(error,'Unable to save sequence step.');return data
}
export async function addOutboundProspects(organizationId:string,campaignId:string,rows:Array<Pick<OutboundProspectRow,'name'|'email'|'title'|'company'|'website'|'country'|'industry'|'fit_score'|'research_notes'|'personalized_subject'|'personalized_body'>>){
  if(!rows.length)return []
  const {data,error}=await requireSupabase().from('outbound_prospects').upsert(rows.map(row=>({organization_id:organizationId,campaign_id:campaignId,...row})),{onConflict:'campaign_id,email',ignoreDuplicates:false}).select()
  if(error)throwServiceError(error,'Unable to import prospects.');return data??[]
}
export async function updateOutboundProspect(organizationId:string,id:string,changes:Partial<OutboundProspectRow>){
  const stamped={...changes,...(changes.status==='CONTACTED'?{last_contacted_at:new Date().toISOString()}:{}),...(changes.status==='REPLIED'||changes.status==='INTERESTED'?{replied_at:new Date().toISOString()}:{}),...(changes.status==='MEETING'?{meeting_at:new Date().toISOString()}: {})}
  const {data,error}=await requireSupabase().from('outbound_prospects').update(stamped).eq('organization_id',organizationId).eq('id',id).select().single()
  if(error)throwServiceError(error,'Unable to update prospect.');return data
}
export async function promoteOutboundProspect(organizationId:string,prospectId:string){
  const {data,error}=await requireSupabase().rpc('promote_outbound_prospect',{target_org:organizationId,target_prospect:prospectId})
  if(error)throwServiceError(error,'Unable to create CRM lead.');return data
}
export async function configureOutboundProvider(organizationId:string,capability:OutboundProviderConnectionRow['capability'],providerName:string){
  const {data,error}=await requireSupabase().rpc('configure_outbound_provider',{target_org:organizationId,target_capability:capability,target_provider:providerName,config:{}})
  if(error)throwServiceError(error,'Unable to save provider configuration.');return data as OutboundProviderConnectionRow
}
export async function verifyOutboundProvider(organizationId:string,capability:OutboundProviderConnectionRow['capability'],providerName:string){
  const {data,error}=await requireSupabase().functions.invoke('outbound-provider-check',{body:{organizationId,capability,providerName}})
  if(error)throwServiceError(error,'Unable to verify provider.');return data as {connected:boolean;error?:string}
}
export async function enqueueOutboundJob(organizationId:string,prospectId:string,jobType:OutboundJobRow['job_type'],stepId?:string|null){
  const {data,error}=await requireSupabase().rpc('enqueue_outbound_job',{target_org:organizationId,target_prospect:prospectId,target_job_type:jobType,target_step:stepId??null})
  if(error)throwServiceError(error,'Unable to queue provider job.');return data as OutboundJobRow
}
export type OutboundWorkspaceData={campaigns:OutboundCampaignRow[];prospects:OutboundProspectRow[];steps:OutboundSequenceStepRow[];connections:OutboundProviderConnectionRow[];jobs:OutboundJobRow[];deliveries:OutboundDeliveryRow[]}
