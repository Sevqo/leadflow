import type {MemberRole} from '../types/database'

export type Capability='view_workspace'|'manage_clients'|'manage_projects'|'manage_systems'|'manage_agents'|'request_approval'|'decide_approval'|'view_costs'|'view_audit'|'manage_team'|'manage_integrations'|'manage_billing'
const roleCapabilities:Record<MemberRole,readonly Capability[]>={
  OWNER:['view_workspace','manage_clients','manage_projects','manage_systems','manage_agents','request_approval','decide_approval','view_costs','view_audit','manage_team','manage_integrations','manage_billing'],
  ADMIN:['view_workspace','manage_clients','manage_projects','manage_systems','manage_agents','request_approval','decide_approval','view_costs','view_audit','manage_team','manage_integrations','manage_billing'],
  MANAGER:['view_workspace','manage_clients','manage_projects','manage_systems','request_approval','view_audit'],
  AGENT:['view_workspace','request_approval'],
}
export function can(role:string|undefined,capability:Capability){return Boolean(role&&role in roleCapabilities&&roleCapabilities[role as MemberRole].includes(capability))}
export function canViewModule(role:string|undefined,module:string){
  if(module==='Costs')return can(role,'view_costs')
  if(module==='Activity')return can(role,'view_audit')
  if(module==='Billing')return can(role,'manage_billing')
  return can(role,'view_workspace')
}
