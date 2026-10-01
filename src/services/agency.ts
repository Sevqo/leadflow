import {requireSupabase,throwServiceError} from './api'
import type {AgencyClientRow,AgencyProjectRow,ClientSystemRow,AgencyAiAgentRow,AgencyApprovalRequestRow,AgencyCostEntryRow,ProjectMilestoneRow} from '../types/database'

const client=requireSupabase
export async function loadAgency(organizationId:string){
  const db=client()
  const [clients,projects,systems,agents,approvals,milestones]=await Promise.all([
    db.from('agency_clients').select('*').eq('organization_id',organizationId).order('name'),
    db.from('agency_projects').select('*').eq('organization_id',organizationId).order('created_at',{ascending:false}),
    db.from('client_systems').select('*').eq('organization_id',organizationId).order('created_at',{ascending:false}),
    db.from('agency_ai_agents').select('*').eq('organization_id',organizationId).order('created_at',{ascending:false}),
    db.from('agency_approval_requests').select('*').eq('organization_id',organizationId).order('created_at',{ascending:false}),
    db.from('project_milestones').select('*').eq('organization_id',organizationId).order('created_at'),
  ])
  for(const result of [clients,projects,systems,agents,approvals,milestones])if(result.error)throwServiceError(result.error,'Unable to load agency records.')
  return {clients:clients.data??[],projects:projects.data??[],systems:systems.data??[],agents:agents.data??[],approvals:approvals.data??[],milestones:milestones.data??[]}
}
export async function searchAgencyRecords(organizationId:string,search:string){
  const term=search.trim().slice(0,100)
  if(term.length<2)return [] as {id:string;name:string;module:string;detail:string}[]
  const db=client(),pattern=`%${term.replaceAll('%','\\%').replaceAll('_','\\_')}%`
  const [clients,projects,systems]=await Promise.all([
    db.from('agency_clients').select('id,name,industry').eq('organization_id',organizationId).ilike('name',pattern).limit(8),
    db.from('agency_projects').select('id,name,status').eq('organization_id',organizationId).ilike('name',pattern).limit(8),
    db.from('client_systems').select('id,name,status').eq('organization_id',organizationId).ilike('name',pattern).limit(8),
  ])
  for(const result of [clients,projects,systems])if(result.error)throwServiceError(result.error,'Unable to search agency records.')
  return [...(clients.data??[]).map(item=>({id:item.id,name:item.name,module:'Clients',detail:item.industry||'Client'})),...(projects.data??[]).map(item=>({id:item.id,name:item.name,module:'Projects',detail:item.status})),...(systems.data??[]).map(item=>({id:item.id,name:item.name,module:'Systems',detail:item.status}))]
}
export async function loadCosts(organizationId:string):Promise<AgencyCostEntryRow[]>{
  const rows:AgencyCostEntryRow[]=[]
  const pageSize=500
  for(let offset=0;;offset+=pageSize){
    const {data,error}=await client().from('agency_cost_entries').select('*').eq('organization_id',organizationId).order('occurred_on',{ascending:false}).order('id').range(offset,offset+pageSize-1)
    if(error)throwServiceError(error,'Unable to load internal costs.')
    rows.push(...(data??[]))
    if(!data||data.length<pageSize)return rows
  }
}
export async function createAgencyClient(organizationId:string,input:Pick<AgencyClientRow,'name'|'industry'|'contact_name'|'contact_email'|'website'>){
  const {data:{user}}=await client().auth.getUser()
  const {data,error}=await client().from('agency_clients').insert({organization_id:organizationId,...input,created_by:user?.id??null}).select().single()
  if(error)throwServiceError(error,'Unable to create client.');return data
}
export async function updateAgencyClient(organizationId:string,id:string,changes:Partial<Pick<AgencyClientRow,'name'|'status'|'industry'|'contact_name'|'contact_email'|'website'|'internal_notes'>>){
  const {data,error}=await client().from('agency_clients').update(changes).eq('organization_id',organizationId).eq('id',id).select().single()
  if(error)throwServiceError(error,'Unable to update client.');return data
}
export async function createAgencyProject(organizationId:string,clientId:string,name:string,description:string){
  const {data,error}=await client().from('agency_projects').insert({organization_id:organizationId,client_id:clientId,name,description}).select().single()
  if(error)throwServiceError(error,'Unable to create project.');return data
}
export async function updateAgencyProject(organizationId:string,id:string,changes:Partial<Pick<AgencyProjectRow,'status'|'description'|'due_at'|'owner_id'>>){
  const {data,error}=await client().from('agency_projects').update(changes).eq('organization_id',organizationId).eq('id',id).select().single()
  if(error)throwServiceError(error,'Unable to update project.');return data
}
export async function createMilestone(organizationId:string,projectId:string,title:string,dueAt:string|null){
  const {data,error}=await client().from('project_milestones').insert({organization_id:organizationId,project_id:projectId,title,due_at:dueAt}).select().single()
  if(error)throwServiceError(error,'Unable to create milestone.');return data
}
export async function completeMilestone(organizationId:string,id:string,complete:boolean):Promise<ProjectMilestoneRow>{
  const {data,error}=await client().from('project_milestones').update({completed_at:complete?new Date().toISOString():null}).eq('organization_id',organizationId).eq('id',id).select().single()
  if(error)throwServiceError(error,'Unable to update milestone.');return data
}
export async function createClientSystem(organizationId:string,clientId:string,name:string,kind:string,description:string){
  const {data,error}=await client().from('client_systems').insert({organization_id:organizationId,client_id:clientId,name,kind,description}).select().single()
  if(error)throwServiceError(error,'Unable to register system.');return data
}
export async function updateClientSystem(organizationId:string,id:string,changes:Partial<Pick<ClientSystemRow,'status'|'version'|'description'|'last_error'>>){
  const {data,error}=await client().from('client_systems').update(changes).eq('organization_id',organizationId).eq('id',id).select().single()
  if(error)throwServiceError(error,'Unable to update system.');return data
}
export async function createAgencyAgent(organizationId:string,input:Pick<AgencyAiAgentRow,'name'|'purpose'|'client_id'|'instructions'|'guardrails'>){
  const {data,error}=await client().from('agency_ai_agents').insert({organization_id:organizationId,...input}).select().single()
  if(error)throwServiceError(error,'Unable to create agent configuration.');return data
}
export async function updateAgencyAgent(organizationId:string,id:string,changes:Partial<Pick<AgencyAiAgentRow,'status'|'instructions'|'guardrails'|'human_approval_required'>>){
  const {data,error}=await client().from('agency_ai_agents').update(changes).eq('organization_id',organizationId).eq('id',id).select().single()
  if(error)throwServiceError(error,'Unable to update agent.');return data
}
export async function requestApproval(organizationId:string,clientId:string|null,actionType:string,summary:string){
  const {data:{user}}=await client().auth.getUser()
  const {data,error}=await client().from('agency_approval_requests').insert({organization_id:organizationId,client_id:clientId,action_type:actionType,summary,requested_by:user?.id??null}).select().single()
  if(error)throwServiceError(error,'Unable to request approval.');return data
}
export async function decideApproval(organizationId:string,id:string,decision:'APPROVED'|'REJECTED'):Promise<AgencyApprovalRequestRow>{
  const {data,error}=await client().rpc('decide_agency_approval',{target_org:organizationId,target_request:id,next_status:decision})
  if(error)throwServiceError(error,'Unable to decide approval.');return data
}
export async function createCostEntry(organizationId:string,input:Pick<AgencyCostEntryRow,'client_id'|'category'|'description'|'amount'|'currency'|'occurred_on'>){
  const {data:{user}}=await client().auth.getUser()
  const {data,error}=await client().from('agency_cost_entries').insert({organization_id:organizationId,...input,created_by:user?.id??null}).select().single()
  if(error)throwServiceError(error,'Unable to record cost.');return data
}
export async function grantPortalAccess(organizationId:string,clientId:string,email:string){
  const {error}=await client().rpc('grant_client_portal_access',{target_org:organizationId,target_client:clientId,target_email:email})
  if(error)throwServiceError(error,'Unable to grant client portal access.')
}
export async function publishPortalUpdate(organizationId:string,clientId:string,title:string,body:string){
  const {data:{user}}=await client().auth.getUser()
  const {error}=await client().from('client_portal_updates').insert({organization_id:organizationId,client_id:clientId,title,body,created_by:user?.id??null})
  if(error)throwServiceError(error,'Unable to publish update.')
}
export async function listPortalAccess(organizationId:string,clientId:string){
  const {data,error}=await client().rpc('list_client_portal_access',{target_org:organizationId,target_client:clientId})
  if(error)throwServiceError(error,'Unable to load portal access.');return data??[]
}
export async function revokePortalAccess(organizationId:string,clientId:string,userId:string){
  const {error}=await client().rpc('revoke_client_portal_access',{target_org:organizationId,target_client:clientId,target_user:userId})
  if(error)throwServiceError(error,'Unable to revoke portal access.')
}
export async function listPortalUpdates(organizationId:string,clientId:string){
  const {data,error}=await client().from('client_portal_updates').select('*').eq('organization_id',organizationId).eq('client_id',clientId).order('published_at',{ascending:false})
  if(error)throwServiceError(error,'Unable to load published updates.');return data??[]
}
