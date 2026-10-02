import {requireSupabase,throwServiceError} from './api'
import type {OutboundCampaignRow,OutboundProspectRow,OutboundSequenceStepRow} from '../types/database'

export async function loadOutbound(organizationId:string){
  const db=requireSupabase()
  const [campaigns,prospects,steps]=await Promise.all([
    db.from('outbound_campaigns').select('*').eq('organization_id',organizationId).order('created_at',{ascending:false}),
    db.from('outbound_prospects').select('*').eq('organization_id',organizationId).order('fit_score',{ascending:false}),
    db.from('outbound_sequence_steps').select('*').eq('organization_id',organizationId).order('position'),
  ])
  for(const result of [campaigns,prospects,steps])if(result.error)throwServiceError(result.error,'Unable to load outbound campaigns.')
  return {campaigns:campaigns.data??[],prospects:prospects.data??[],steps:steps.data??[]}
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
