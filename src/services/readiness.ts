import {requireSupabase,throwServiceError} from './api'

export type WorkspaceReadiness={business:boolean;knowledge:number;automations:number;assistant:boolean;source:boolean;team:boolean}

export async function getWorkspaceReadiness(organizationId:string):Promise<WorkspaceReadiness>{
  const client=requireSupabase()
  const results=await Promise.all([
    client.from('organizations').select('name,industry,website,phone').eq('id',organizationId).single(),
    client.from('knowledge_items').select('id',{count:'exact',head:true}).eq('organization_id',organizationId).eq('status','ACTIVE'),
    client.from('automations').select('id',{count:'exact',head:true}).eq('organization_id',organizationId).eq('status','ACTIVE'),
    client.from('ai_configs').select('enabled').eq('organization_id',organizationId).maybeSingle(),
    client.from('integrations').select('id',{count:'exact',head:true}).eq('organization_id',organizationId).eq('status','CONNECTED'),
    client.from('lead_sources').select('id',{count:'exact',head:true}).eq('organization_id',organizationId).eq('status','ACTIVE'),
    client.from('widget_configs').select('enabled').eq('organization_id',organizationId).maybeSingle(),
    client.from('organization_members').select('user_id',{count:'exact',head:true}).eq('organization_id',organizationId),
  ])
  const failed=results.find(result=>result.error)
  if(failed?.error)throwServiceError(failed.error,'Unable to verify workspace launch readiness.')
  const [organization,knowledge,automations,assistant,integrations,sources,widget,team]=results
  const details=organization.data
  return {business:Boolean(details?.name&&details.industry&&(details.website||details.phone)),knowledge:knowledge.count??0,automations:automations.count??0,assistant:Boolean(assistant.data?.enabled),source:(integrations.count??0)>0||(sources.count??0)>0||Boolean(widget.data?.enabled),team:(team.count??0)>1}
}
