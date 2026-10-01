export const leadStages = ['New', 'Qualified', 'Contacted', 'Meeting', 'Negotiation', 'Won', 'Lost'] as const
export type LeadStage = typeof leadStages[number]

export type TimelineEntry = {
  id: string
  kind: 'created' | 'stage' | 'assignment' | 'note' | 'follow-up'
  text: string
  at: string
}

export type WorkspaceLead = {
  id: string
  contactId?: string | null
  name: string
  email: string
  phone: string
  company: string
  interest: string
  source: string
  attribution?: LeadAttribution
  stage: LeadStage
  score: number
  value: string
  owner: string
  ownerId?: string | null
  tags: string[]
  createdAt: string
  lastActivity: string
  nextAction: string
  notes: TimelineEntry[]
  customFields: Record<string,string>
  archived?: boolean
}

export type LeadAttribution = {
  platform?: string
  campaignId?: string
  campaignName?: string
  adSetId?: string
  adSetName?: string
  adId?: string
  adName?: string
  formId?: string
  formName?: string
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  utmContent?: string
}

export type OwnerOption = { id: string; label: string }
export type TaskPriority = 'Low'|'Normal'|'High'|'Urgent'
export type WorkspaceTask = { id:string; leadId:string|null; projectId?:string|null; leadName:string; title:string; description:string; dueAt:string|null; status:'Open'|'Completed'|'Cancelled'; assignee:string; assigneeId:string|null; priority:TaskPriority }
export type TaskDraft = Pick<WorkspaceTask,'title'|'description'|'dueAt'|'leadId'|'assigneeId'|'priority'>

export type WorkspaceContact = {
  id: string
  name: string
  email: string
  phone: string
  company: string
  tags: string[]
  type: 'Lead' | 'Prospect' | 'Customer'
  lastActivity: string
}

export type LeadDraft = Pick<WorkspaceLead, 'name' | 'email' | 'phone' | 'company' | 'interest' | 'source' | 'stage' | 'score' | 'value' | 'owner' | 'ownerId' | 'tags' | 'nextAction' | 'customFields'>
export type ContactDraft = Pick<WorkspaceContact, 'name' | 'email' | 'phone' | 'company' | 'tags' | 'type'>
