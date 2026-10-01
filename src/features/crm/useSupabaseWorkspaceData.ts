import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { createContact, listContacts, updateContact as saveContact } from '../../services/contacts'
import { addLeadNote, archiveLead, assignLead, createLead, listLeads, listWorkspaceActivity, moveLead as transitionLead, scheduleFollowUp, updateLeadFields } from '../../services/leads'
import { listOrganizationMembers } from '../../services/organizations'
import { cancelTask as removeTask, completeTask as markTaskComplete, createTask as saveNewTask, listTasks, updateTask as saveTask } from '../../services/tasks'
import { runTriggeredAutomations } from '../../services/automations'
import type { ContactRow, DatabaseLeadStage, LeadActivityRow, LeadRow, TaskRow } from '../../types/database'
import type { ContactDraft, LeadAttribution, LeadDraft, LeadStage, OwnerOption, TaskDraft, TimelineEntry, WorkspaceContact, WorkspaceLead, WorkspaceTask } from './types'

const stageToDatabase:Record<LeadStage,DatabaseLeadStage>={New:'NEW',Qualified:'QUALIFIED',Contacted:'CONTACTED',Meeting:'MEETING',Negotiation:'NEGOTIATION',Won:'WON',Lost:'LOST'}
const stageFromDatabase:Record<DatabaseLeadStage,LeadStage>={NEW:'New',QUALIFIED:'Qualified',CONTACTED:'Contacted',MEETING:'Meeting',NEGOTIATION:'Negotiation',WON:'Won',LOST:'Lost'}
const eventKinds:Record<LeadActivityRow['activity_type'],TimelineEntry['kind']>={CREATED:'created',NOTE:'note',STAGE_CHANGED:'stage',ASSIGNED:'assignment',FOLLOW_UP:'follow-up',AUTOMATION:'note',MESSAGE:'note',ARCHIVED:'note'}

function money(value:number|null){return value===null?'Not set':new Intl.NumberFormat('en-KE',{style:'currency',currency:'KES',maximumFractionDigits:0}).format(value)}
function numericValue(value:string){
  const match=value.replaceAll(',','').match(/[\d.]+/)
  if(!match)return null
  const amount=Number(match[0])
  if(!Number.isFinite(amount))return null
  return /m\b/i.test(value)?amount*1_000_000:/k\b/i.test(value)?amount*1_000:amount
}
function activityLabel(date:string){
  const elapsed=Date.now()-new Date(date).getTime()
  if(elapsed<60_000)return 'Just now'
  if(elapsed<3_600_000)return `${Math.floor(elapsed/60_000)} min ago`
  if(elapsed<86_400_000)return `${Math.floor(elapsed/3_600_000)} hours ago`
  return new Date(date).toLocaleDateString()
}
function customFields(qualification:LeadRow['qualification']){if(!qualification||typeof qualification!=='object'||Array.isArray(qualification))return {};const fields=qualification.custom_fields;if(!fields||typeof fields!=='object'||Array.isArray(fields))return {};return Object.fromEntries(Object.entries(fields).filter((entry):entry is [string,string]=>typeof entry[1]==='string'))}
function attribution(qualification:LeadRow['qualification']):LeadAttribution|undefined{
  if(!qualification||typeof qualification!=='object'||Array.isArray(qualification))return undefined
  const raw=qualification.attribution&&typeof qualification.attribution==='object'&&!Array.isArray(qualification.attribution)?qualification.attribution:{}
  const metadata=qualification.metadata&&typeof qualification.metadata==='object'&&!Array.isArray(qualification.metadata)?qualification.metadata:{}
  const aliases:Record<keyof LeadAttribution,string[]>={platform:['platform'],campaignId:['campaignId','campaign_id'],campaignName:['campaignName','campaign_name','campaign'],adSetId:['adSetId','ad_set_id','adset_id'],adSetName:['adSetName','ad_set_name','adset_name'],adId:['adId','ad_id'],adName:['adName','ad_name'],formId:['formId','form_id'],formName:['formName','form_name'],utmSource:['utmSource','utm_source'],utmMedium:['utmMedium','utm_medium'],utmCampaign:['utmCampaign','utm_campaign'],utmContent:['utmContent','utm_content']}
  const result:LeadAttribution={}
  for(const [field,keys] of Object.entries(aliases) as [keyof LeadAttribution,string[]][]){const value=keys.map(key=>raw[key]??metadata[key]??(field==='platform'?qualification.platform:undefined)).find(value=>typeof value==='string'&&value.trim());if(typeof value==='string')result[field]=value.trim()}
  return Object.keys(result).length?result:undefined
}

export function useSupabaseWorkspaceData(organizationId:string|undefined,enabled:boolean){
  const [rows,setRows]=useState<LeadRow[]>([])
  const [contactRows,setContactRows]=useState<ContactRow[]>([])
  const [activityRows,setActivityRows]=useState<LeadActivityRow[]>([])
  const [taskRows,setTaskRows]=useState<TaskRow[]>([])
  const [owners,setOwners]=useState<OwnerOption[]>([])
  const [loading,setLoading]=useState(false)
  const [error,setError]=useState('')

  const refresh=useCallback(async()=>{
    if(!enabled||!organizationId){setRows([]);setContactRows([]);setActivityRows([]);setTaskRows([]);setOwners([]);setError('');return}
    setLoading(true);setError('')
    try{
      const [nextLeads,nextContacts,nextActivity,nextTasks,members]=await Promise.all([listLeads(organizationId,true),listContacts(organizationId),listWorkspaceActivity(organizationId),listTasks(organizationId),listOrganizationMembers(organizationId)])
      setRows(nextLeads);setContactRows(nextContacts);setActivityRows(nextActivity);setTaskRows(nextTasks);setOwners(members.map(member=>({id:member.userId,label:member.name})))
    }catch(reason){setError(reason instanceof Error?reason.message:'Unable to load workspace data.')}
    finally{setLoading(false)}
  },[enabled,organizationId])

  useEffect(()=>{void refresh()},[refresh])
  useEffect(()=>{
    if(!enabled||!organizationId||!supabase)return
    const client=supabase
    let timer:number|undefined
    const queueRefresh=()=>{window.clearTimeout(timer);timer=window.setTimeout(()=>void refresh(),180)}
    const channel=client.channel(`workspace:${organizationId}`)
      .on('postgres_changes',{event:'*',schema:'public',table:'leads',filter:`organization_id=eq.${organizationId}`},queueRefresh)
      .on('postgres_changes',{event:'*',schema:'public',table:'contacts',filter:`organization_id=eq.${organizationId}`},queueRefresh)
      .on('postgres_changes',{event:'*',schema:'public',table:'lead_activities',filter:`organization_id=eq.${organizationId}`},queueRefresh)
      .on('postgres_changes',{event:'*',schema:'public',table:'tasks',filter:`organization_id=eq.${organizationId}`},queueRefresh)
      .on('postgres_changes',{event:'*',schema:'public',table:'organization_members',filter:`organization_id=eq.${organizationId}`},queueRefresh)
      .subscribe()
    return()=>{window.clearTimeout(timer);void client.removeChannel(channel)}
  },[enabled,organizationId,refresh])

  const contactsById=useMemo(()=>new Map(contactRows.map(contact=>[contact.id,contact])),[contactRows])
  const ownerNames=useMemo(()=>new Map(owners.map(owner=>[owner.id,owner.label])),[owners])
  const activitiesByLead=useMemo(()=>{
    const grouped=new Map<string,TimelineEntry[]>()
    for(const activity of activityRows){
      const current=grouped.get(activity.lead_id)??[]
      current.push({id:activity.id,kind:eventKinds[activity.activity_type],text:activity.body??activity.activity_type.replaceAll('_',' ').toLowerCase(),at:activity.created_at})
      grouped.set(activity.lead_id,current)
    }
    return grouped
  },[activityRows])

  const mappedLeads=useMemo<WorkspaceLead[]>(()=>rows.map(lead=>{
    const contact=lead.contact_id?contactsById.get(lead.contact_id):undefined
    return {id:lead.id,contactId:lead.contact_id,name:contact?.name??'Unnamed lead',email:contact?.email??'',phone:contact?.phone??'',company:contact?.company??'',interest:lead.interest??'No interest recorded',source:lead.source??'Manual',attribution:attribution(lead.qualification),stage:stageFromDatabase[lead.stage],score:lead.score,value:money(lead.estimated_value),owner:lead.owner_id?ownerNames.get(lead.owner_id)??'Workspace member':'Unassigned',ownerId:lead.owner_id,tags:contact?.tags??[],customFields:customFields(lead.qualification),createdAt:lead.created_at,lastActivity:activityLabel(lead.updated_at),nextAction:lead.next_action??'Make first contact',notes:activitiesByLead.get(lead.id)??[],archived:Boolean(lead.archived_at)}
  }),[activitiesByLead,contactsById,ownerNames,rows])
  const leads=useMemo(()=>mappedLeads.filter(lead=>!lead.archived),[mappedLeads])
  const contacts=useMemo<WorkspaceContact[]>(()=>contactRows.map(contact=>{
    const related=rows.filter(lead=>lead.contact_id===contact.id&&!lead.archived_at)
    return {id:contact.id,name:contact.name,email:contact.email??'',phone:contact.phone??'',company:contact.company??'',tags:contact.tags,type:related.some(lead=>lead.stage==='WON')?'Customer':related.length?'Lead':'Prospect',lastActivity:activityLabel(contact.updated_at)}
  }),[contactRows,rows])
  const tasks=useMemo<WorkspaceTask[]>(()=>taskRows.map(task=>({id:task.id,leadId:task.lead_id,projectId:task.project_id,leadName:task.lead_id?mappedLeads.find(lead=>lead.id===task.lead_id)?.name??'Lead':'General task',title:task.title,description:task.description??'',dueAt:task.due_at,status:task.status==='OPEN'?'Open':task.status==='COMPLETED'?'Completed':'Cancelled',assignee:task.assigned_to?ownerNames.get(task.assigned_to)??'Workspace member':'Unassigned',assigneeId:task.assigned_to,priority:task.priority==='LOW'?'Low':task.priority==='HIGH'?'High':task.priority==='URGENT'?'Urgent':'Normal'})),[mappedLeads,ownerNames,taskRows])

  const run=async<T,>(operation:()=>Promise<T>)=>{setError('');try{const result=await operation();await refresh();return result}catch(reason){const message=reason instanceof Error?reason.message:'The workspace update failed.';setError(message);throw reason}}
  const addLead=(draft:LeadDraft)=>run(async()=>{const created=await createLead({organizationId:organizationId!,name:draft.name,email:draft.email,phone:draft.phone,company:draft.company,interest:draft.interest,source:draft.source,stage:stageToDatabase[draft.stage],score:draft.score,estimatedValue:numericValue(draft.value),ownerId:draft.ownerId||null,nextAction:draft.nextAction,tags:draft.tags,qualification:{custom_fields:draft.customFields}});await runTriggeredAutomations(organizationId!,created.id,'LEAD_CREATED');return created.id})
  const updateLead=async(leadId:string,changes:Partial<WorkspaceLead>)=>run(async()=>{
    const current=mappedLeads.find(lead=>lead.id===leadId)
    if(!current)throw new Error('Lead not found.')
    if(changes.stage!==undefined&&changes.stage!==current.stage)await transitionLead(leadId,organizationId!,stageToDatabase[changes.stage])
    if((changes.ownerId!==undefined?changes.ownerId:null)!==current.ownerId&&(changes.ownerId!==undefined||changes.owner!==undefined))await assignLead(leadId,organizationId!,changes.ownerId||null)
    if(changes.interest!==undefined||changes.source!==undefined||changes.score!==undefined||changes.value!==undefined||changes.nextAction!==undefined||changes.customFields!==undefined){const raw=rows.find(lead=>lead.id===leadId)?.qualification;const base=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};await updateLeadFields(leadId,organizationId!,{interest:changes.interest,source:changes.source,score:changes.score,estimatedValue:changes.value===undefined?undefined:numericValue(changes.value),nextAction:changes.nextAction,qualification:changes.customFields===undefined?undefined:{...base,custom_fields:changes.customFields}})}
    if(current.contactId&&(changes.name!==undefined||changes.email!==undefined||changes.phone!==undefined||changes.company!==undefined||changes.tags!==undefined))await saveContact(current.contactId,organizationId!,{name:changes.name??current.name,email:changes.email??current.email,phone:changes.phone??current.phone,company:changes.company??current.company,tags:changes.tags??current.tags})
    await runTriggeredAutomations(organizationId!,leadId,changes.stage!==undefined&&changes.stage!==current.stage?'STAGE_CHANGED':'LEAD_UPDATED')
  })
  const moveLead=(leadId:string,stage:LeadStage)=>run(async()=>{const result=await transitionLead(leadId,organizationId!,stageToDatabase[stage]);await runTriggeredAutomations(organizationId!,leadId,'STAGE_CHANGED');return result})
  const addNote=(leadId:string,text:string)=>run(()=>addLeadNote(leadId,organizationId!,text))
  const addFollowUp=(leadId:string,dueAt:string)=>run(()=>scheduleFollowUp(leadId,organizationId!,'Lead follow-up',dueAt))
  const archiveLeads=(leadIds:string[])=>run(()=>Promise.all(leadIds.map(leadId=>archiveLead(leadId,organizationId!))))
  const addContact=(draft:ContactDraft)=>run(()=>createContact(organizationId!,draft))
  const updateContact=(contactId:string,changes:Partial<WorkspaceContact>)=>run(()=>{const current=contacts.find(contact=>contact.id===contactId);if(!current)throw new Error('Contact not found.');return saveContact(contactId,organizationId!,{name:changes.name??current.name,email:changes.email??current.email,phone:changes.phone??current.phone,company:changes.company??current.company,tags:changes.tags??current.tags})})
  const completeTask=(taskId:string)=>run(()=>markTaskComplete(taskId,organizationId!))
  const taskInput=(draft:TaskDraft)=>({title:draft.title,description:draft.description,priority:draft.priority.toUpperCase() as 'LOW'|'NORMAL'|'HIGH'|'URGENT',dueAt:draft.dueAt,leadId:draft.leadId,assignedTo:draft.assigneeId})
  const createTask=(draft:TaskDraft)=>run(()=>saveNewTask(organizationId!,taskInput(draft)))
  const updateTask=(taskId:string,draft:TaskDraft)=>run(()=>saveTask(taskId,organizationId!,taskInput(draft)))
  const cancelTask=(taskId:string)=>run(()=>removeTask(taskId,organizationId!))

  return {leads,archivedLeads:mappedLeads.filter(lead=>lead.archived),contacts,tasks,owners,loading,error,refresh,addLead,updateLead,moveLead,addNote,addFollowUp,archiveLeads,addContact,updateContact,completeTask,createTask,updateTask,cancelTask,resetDemo:()=>{}}
}
