export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]
export type MemberRole = 'OWNER' | 'ADMIN' | 'MANAGER' | 'AGENT'
export type DatabaseLeadStage = 'NEW' | 'QUALIFIED' | 'CONTACTED' | 'MEETING' | 'NEGOTIATION' | 'WON' | 'LOST'

type Organization = { id:string; name:string; industry:string|null; website:string|null; phone:string|null; country:string|null; timezone:string|null; logo_url:string|null; onboarding_step:number; onboarding_completed_at:string|null; created_at:string; updated_at:string }
type Profile = { id:string; full_name:string|null; username:string|null; avatar_url:string|null; created_at:string; updated_at:string }
type Membership = { organization_id:string; user_id:string; role:MemberRole; created_at:string }
type Contact = { id:string; organization_id:string; name:string; email:string|null; phone:string|null; company:string|null; tags:string[]; created_at:string; updated_at:string }
type Lead = { id:string; organization_id:string; contact_id:string|null; owner_id:string|null; interest:string|null; source:string|null; stage:DatabaseLeadStage; score:number; estimated_value:number|null; qualification:Json; next_action:string|null; archived_at:string|null; created_at:string; updated_at:string }
type LeadActivity = { id:string; organization_id:string; lead_id:string; actor_id:string|null; activity_type:'CREATED'|'NOTE'|'STAGE_CHANGED'|'ASSIGNED'|'FOLLOW_UP'|'AUTOMATION'|'MESSAGE'|'ARCHIVED'; body:string|null; metadata:Json; created_at:string }
type Task = { id:string; organization_id:string; lead_id:string|null; project_id:string|null; assigned_to:string|null; created_by:string|null; title:string; description:string|null; priority:'LOW'|'NORMAL'|'HIGH'|'URGENT'; status:'OPEN'|'COMPLETED'|'CANCELLED'; due_at:string|null; completed_at:string|null; created_at:string; updated_at:string }
type Invitation = { id:string; organization_id:string; email:string; role:MemberRole; token_hash:string; invited_by:string; expires_at:string; accepted_at:string|null; created_at:string }
type Automation = { id:string; organization_id:string; name:string; status:'DRAFT'|'ACTIVE'|'PAUSED'|'ERROR'; trigger_type:string; created_by:string|null; created_at:string; updated_at:string }
type AutomationStep = { id:string; automation_id:string; organization_id:string; step_type:'CONDITION'|'ACTION'; position:number; config:Json; created_at:string }
type AutomationRun = { id:string; organization_id:string; automation_id:string; lead_id:string|null; status:'RUNNING'|'SUCCEEDED'|'FAILED'|'SKIPPED'; trigger_event:string; input:Json; output:Json; error_code:string|null; attempt:number; max_attempts:number; next_retry_at:string|null; retry_of:string|null; started_at:string; finished_at:string|null }
type Notification = { id:string; organization_id:string; user_id:string; kind:string; title:string; body:string|null; read_at:string|null; created_at:string }
type Subscription = { id:string; organization_id:string; plan:'STARTER'|'GROWTH'|'PRO'; status:'TRIALING'|'ACTIVE'|'PAST_DUE'|'CANCELLED'|'INCOMPLETE'; billing_interval:'MONTHLY'|'YEARLY'; provider:string|null; provider_customer_id:string|null; provider_subscription_id:string|null; trial_ends_at:string|null; current_period_ends_at:string|null; created_at:string; updated_at:string }
type Conversation = { id:string; organization_id:string; contact_id:string|null; channel:'WEBSITE'|'WHATSAPP'|'EMAIL'|'PHONE'|'SMS'|'INSTAGRAM'|'FACEBOOK'|'MESSENGER'|'LINKEDIN'|'TIKTOK'|'TELEGRAM'|'MARKETPLACE'|'API'|'OTHER'; status:'OPEN'|'CLOSED'|'SNOOZED'; handling_mode:'AI'|'HUMAN'|'PAUSED'; assigned_to:string|null; last_message_at:string|null; created_at:string; updated_at:string }
type Message = { id:string; organization_id:string; conversation_id:string; sender_type:'CUSTOMER'|'AI'|'HUMAN'|'SYSTEM'; sender_id:string|null; body:string; external_id:string|null; is_internal_note:boolean; created_at:string }
type ConversationRead = { organization_id:string; conversation_id:string; user_id:string; last_read_at:string }
type KnowledgeItem = { id:string; organization_id:string; title:string; item_type:'FAQ'|'PRODUCT'|'SERVICE'|'POLICY'|'GENERAL'|'DOCUMENT'; content:string; status:'ACTIVE'|'DRAFT'|'ARCHIVED'; metadata:Json; created_at:string; updated_at:string }
type AiConfig = { id:string; organization_id:string; assistant_name:string; role_description:string; welcome_message:string|null; tone:'PROFESSIONAL'|'FRIENDLY'|'CONCISE'|'CUSTOM'; custom_instructions:string|null; qualification_fields:string[]; escalation_rules:Json; business_hours:Json; enabled:boolean; created_at:string; updated_at:string }
type Integration = { id:string; organization_id:string; provider:'WHATSAPP'|'WEBSITE'|'EMAIL'|'WEBHOOK'; status:'SETUP_REQUIRED'|'CONNECTED'|'ERROR'|'DISABLED'; public_config:Json; secret_reference:string|null; last_error_code:string|null; connected_at:string|null; created_at:string; updated_at:string }
type WebhookEndpoint = { id:string; organization_id:string; url:string; events:string[]; enabled:boolean; created_by:string|null; created_at:string; updated_at:string }
type WebhookDelivery = { id:string; organization_id:string; endpoint_id:string; event_type:string; event_id:string; status:'PENDING'|'SUCCEEDED'|'FAILED'; response_status:number|null; attempt:number; error_code:string|null; created_at:string; delivered_at:string|null }
type WidgetConfig = { organization_id:string; public_key:string; enabled:boolean; brand_name:string; welcome_message:string; primary_color:string; allowed_origins:string[]; updated_at:string }
type NotificationPreference = { organization_id:string; user_id:string; in_app:boolean; email_qualified_lead:boolean; email_assignment:boolean; email_follow_up:boolean; email_automation_failure:boolean; email_integration_failure:boolean; updated_at:string }
type PlanLimit = { plan:'STARTER'|'GROWTH'|'PRO'; members:number; monthly_leads:number; active_automations:number; knowledge_items:number }
type LeadSource = { id:string; organization_id:string; name:string; platform:string; status:'ACTIVE'|'PAUSED'; secret_hash:string; created_by:string|null; last_received_at:string|null; created_at:string; updated_at:string }
type TeamMessage = { id:string; organization_id:string; room_id:string|null; sender_id:string|null; sender_name:string; body:string; reply_to:string|null; edited_at:string|null; deleted_at:string|null; pinned_at:string|null; created_at:string }
type TeamChatRead = { organization_id:string; user_id:string; last_read_at:string }
type AuditEvent = {id:string;organization_id:string;actor_id:string|null;event_type:string;entity_type:string|null;entity_id:string|null;metadata:Json;created_at:string}
type TeamRoom = { id:string; organization_id:string; kind:'CHANNEL'|'DIRECT'; name:string; topic:string; created_by:string|null; created_at:string }
type TeamRoomMember = { organization_id:string; room_id:string; user_id:string; last_read_at:string|null; muted:boolean; joined_at:string }
type AgencyClient = { id:string; organization_id:string; name:string; status:'PROSPECT'|'ONBOARDING'|'ACTIVE'|'PAUSED'|'ARCHIVED'; industry:string|null; contact_name:string|null; contact_email:string|null; website:string|null; internal_notes:string|null; created_by:string|null; created_at:string; updated_at:string }
type AgencyProject = { id:string; organization_id:string; client_id:string; name:string; description:string|null; status:'PLANNED'|'ACTIVE'|'BLOCKED'|'COMPLETE'|'ARCHIVED'; owner_id:string|null; due_at:string|null; created_at:string; updated_at:string }
type ProjectMilestone = { id:string; organization_id:string; project_id:string; title:string; due_at:string|null; completed_at:string|null; created_at:string }
type ClientSystem = { id:string; organization_id:string; client_id:string; project_id:string|null; name:string; kind:string; status:'SETUP_REQUIRED'|'ACTIVE'|'PAUSED'|'ERROR'|'RETIRED'; environment:string; version:string|null; description:string|null; last_checked_at:string|null; last_error:string|null; created_at:string; updated_at:string }
type AgencyAiAgent = { id:string; organization_id:string; client_id:string|null; name:string; purpose:string; status:'DRAFT'|'ACTIVE'|'PAUSED'; instructions:string; guardrails:string; human_approval_required:boolean; created_at:string; updated_at:string }
type AgencyApprovalRequest = { id:string; organization_id:string; client_id:string|null; action_type:string; summary:string; status:'PENDING'|'APPROVED'|'REJECTED'|'CANCELLED'; requested_by:string|null; decided_by:string|null; decided_at:string|null; created_at:string }
type AgencyCostEntry = { id:string; organization_id:string; client_id:string|null; category:string; description:string; amount:number; currency:string; occurred_on:string; source:'MANUAL'|'METERED'; created_by:string|null; created_at:string }
type ClientPortalUpdate = { id:string; organization_id:string; client_id:string; title:string; body:string; published_at:string; created_by:string|null }
type OutboundCampaign = { id:string; organization_id:string; name:string; website_url:string|null; offer_summary:string; value_proposition:string; target_industries:string[]; target_regions:string[]; target_company_sizes:string[]; target_titles:string[]; tone:'PROFESSIONAL'|'FRIENDLY'|'CONCISE'|'CUSTOM'; booking_url:string|null; daily_send_limit:number; status:'DRAFT'|'READY'|'ACTIVE'|'PAUSED'|'COMPLETE'; created_by:string|null; created_at:string; updated_at:string }
type OutboundSequenceStep = { id:string; organization_id:string; campaign_id:string; position:number; delay_days:number; subject_template:string; body_template:string; created_at:string; updated_at:string }
type OutboundProspect = { id:string; organization_id:string; campaign_id:string; name:string; email:string|null; title:string|null; company:string; website:string|null; country:string|null; industry:string|null; fit_score:number; research_notes:string|null; personalized_subject:string|null; personalized_body:string|null; status:'SOURCED'|'REVIEW'|'APPROVED'|'CONTACTED'|'REPLIED'|'INTERESTED'|'MEETING'|'DISQUALIFIED'|'BOUNCED'|'OPTED_OUT'; lead_id:string|null; last_contacted_at:string|null; replied_at:string|null; meeting_at:string|null; created_at:string; updated_at:string }

type Table<Row, Insert = Partial<Row>, Update = Partial<Insert>> = { Row:Row; Insert:Insert; Update:Update; Relationships:[] }

export interface Database {
  public: {
    Tables: {
      organizations: Table<Organization, Pick<Organization,'name'> & Partial<Organization>>
      profiles: Table<Profile, Pick<Profile,'id'> & Partial<Profile>>
      organization_members: Table<Membership, Membership>
      contacts: Table<Contact, Pick<Contact,'organization_id'|'name'> & Partial<Contact>>
      leads: Table<Lead, Pick<Lead,'organization_id'> & Partial<Lead>>
      lead_activities: Table<LeadActivity, Pick<LeadActivity,'organization_id'|'lead_id'|'activity_type'> & Partial<LeadActivity>>
      tasks: Table<Task, Pick<Task,'organization_id'|'title'> & Partial<Task>>
      invitations: Table<Invitation, Pick<Invitation,'organization_id'|'email'|'token_hash'|'invited_by'|'expires_at'> & Partial<Invitation>>
      automations: Table<Automation, Pick<Automation,'organization_id'|'name'|'trigger_type'> & Partial<Automation>>
      automation_steps: Table<AutomationStep, Pick<AutomationStep,'automation_id'|'organization_id'|'step_type'> & Partial<AutomationStep>>
      automation_runs: Table<AutomationRun, Pick<AutomationRun,'organization_id'|'automation_id'|'status'|'trigger_event'> & Partial<AutomationRun>>
      notifications: Table<Notification, Pick<Notification,'organization_id'|'user_id'|'kind'|'title'> & Partial<Notification>>
      subscriptions: Table<Subscription, Pick<Subscription,'organization_id'> & Partial<Subscription>>
      conversations: Table<Conversation, Pick<Conversation,'organization_id'|'channel'> & Partial<Conversation>>
      messages: Table<Message, Pick<Message,'organization_id'|'conversation_id'|'sender_type'|'body'> & Partial<Message>>
      conversation_reads: Table<ConversationRead, ConversationRead>
      knowledge_items: Table<KnowledgeItem, Pick<KnowledgeItem,'organization_id'|'title'|'item_type'|'content'> & Partial<KnowledgeItem>>
      ai_configs: Table<AiConfig, Pick<AiConfig,'organization_id'> & Partial<AiConfig>>
      integrations: Table<Integration, Pick<Integration,'organization_id'|'provider'> & Partial<Integration>>
      webhook_endpoints: Table<WebhookEndpoint, Pick<WebhookEndpoint,'organization_id'|'url'> & Partial<WebhookEndpoint>>
      webhook_deliveries: Table<WebhookDelivery, Pick<WebhookDelivery,'organization_id'|'endpoint_id'|'event_type'|'status'> & Partial<WebhookDelivery>>
      widget_configs: Table<WidgetConfig, Pick<WidgetConfig,'organization_id'> & Partial<WidgetConfig>>
      notification_preferences: Table<NotificationPreference, Pick<NotificationPreference,'organization_id'|'user_id'> & Partial<NotificationPreference>>
      plan_limits: Table<PlanLimit,PlanLimit>
      lead_sources: Table<LeadSource,Pick<LeadSource,'organization_id'|'name'|'platform'|'secret_hash'> & Partial<LeadSource>>
      team_messages: Table<TeamMessage,Pick<TeamMessage,'organization_id'|'sender_name'|'body'> & Partial<TeamMessage>>
      team_chat_reads: Table<TeamChatRead,TeamChatRead>
      audit_events: Table<AuditEvent>
      team_rooms: Table<TeamRoom,Pick<TeamRoom,'organization_id'|'kind'|'name'|'created_by'> & Partial<TeamRoom>>
      team_room_members: Table<TeamRoomMember,Pick<TeamRoomMember,'organization_id'|'room_id'|'user_id'> & Partial<TeamRoomMember>>
      agency_clients: Table<AgencyClient,Pick<AgencyClient,'organization_id'|'name'> & Partial<AgencyClient>>
      agency_projects: Table<AgencyProject,Pick<AgencyProject,'organization_id'|'client_id'|'name'> & Partial<AgencyProject>>
      project_milestones: Table<ProjectMilestone,Pick<ProjectMilestone,'organization_id'|'project_id'|'title'> & Partial<ProjectMilestone>>
      client_systems: Table<ClientSystem,Pick<ClientSystem,'organization_id'|'client_id'|'name'> & Partial<ClientSystem>>
      agency_ai_agents: Table<AgencyAiAgent,Pick<AgencyAiAgent,'organization_id'|'name'|'purpose'> & Partial<AgencyAiAgent>>
      agency_approval_requests: Table<AgencyApprovalRequest,Pick<AgencyApprovalRequest,'organization_id'|'action_type'|'summary'> & Partial<AgencyApprovalRequest>>
      agency_cost_entries: Table<AgencyCostEntry,Pick<AgencyCostEntry,'organization_id'|'category'|'description'|'amount'|'currency'|'occurred_on'> & Partial<AgencyCostEntry>>
      client_portal_members: Table<{organization_id:string;client_id:string;user_id:string;created_at:string}>
      client_portal_updates: Table<ClientPortalUpdate>
      outbound_campaigns: Table<OutboundCampaign, Pick<OutboundCampaign,'organization_id'|'name'> & Partial<OutboundCampaign>>
      outbound_sequence_steps: Table<OutboundSequenceStep, Pick<OutboundSequenceStep,'organization_id'|'campaign_id'|'position'> & Partial<OutboundSequenceStep>>
      outbound_prospects: Table<OutboundProspect, Pick<OutboundProspect,'organization_id'|'campaign_id'|'name'|'company'> & Partial<OutboundProspect>>
    }
    Views: Record<string, never>
    Functions: {
      create_organization: { Args:{ org_name:string }; Returns:string }
      create_lead_with_contact: { Args:{ target_org:string; contact_name:string; contact_email?:string|null; contact_phone?:string|null; contact_company?:string|null; lead_interest?:string|null; lead_source?:string|null; lead_stage?:DatabaseLeadStage; lead_score?:number; lead_value?:number|null; lead_owner?:string|null; lead_next_action?:string|null; lead_tags?:string[]; lead_qualification?:Json }; Returns:Lead }
      transition_lead: { Args:{ target_lead:string; target_org:string; next_stage:DatabaseLeadStage }; Returns:Lead }
      assign_lead: { Args:{ target_lead:string; target_org:string; next_owner:string|null }; Returns:Lead }
      add_lead_note: { Args:{ target_lead:string; target_org:string; note_body:string }; Returns:LeadActivity }
      schedule_lead_follow_up: { Args:{ target_lead:string; target_org:string; task_title:string; task_due_at:string; task_assignee?:string|null }; Returns:Task }
      archive_lead: { Args:{ target_lead:string; target_org:string }; Returns:Lead }
      accept_invitation: { Args:{ invite_token:string }; Returns:string }
      upsert_contact: { Args:{ target_org:string; contact_name:string; contact_email?:string|null; contact_phone?:string|null; contact_company?:string|null; contact_tags?:string[] }; Returns:Contact }
      update_contact: { Args:{ target_contact:string; target_org:string; contact_name:string; contact_email?:string|null; contact_phone?:string|null; contact_company?:string|null; contact_tags?:string[] }; Returns:Contact }
      create_conversation: { Args:{ target_org:string; target_contact:string|null; conversation_channel?:string }; Returns:Conversation }
      send_conversation_message: { Args:{ target_org:string; target_conversation:string; message_body:string }; Returns:Message }
      mark_conversation_read: { Args:{ target_org:string; target_conversation:string }; Returns:string }
      update_organization_settings: { Args:{ target_org:string; organization_name:string; organization_industry:string; organization_website:string; organization_phone:string; organization_country:string; organization_timezone:string }; Returns:Organization }
      create_automation_workflow: { Args:{ target_org:string; workflow_name:string; minimum_score:number; action_type:string; delay_hours:number }; Returns:Automation }
      create_automation_workflow_v2: { Args:{ target_org:string; workflow_name:string; workflow_trigger:string; minimum_score:number; action_type:string; delay_hours:number }; Returns:Automation }
      create_automation_workflow_v3: { Args:{ target_org:string; workflow_name:string; workflow_trigger:string; workflow_conditions:Json; workflow_actions:Json }; Returns:Automation }
      delete_automation_workflow: { Args:{ target_org:string; target_automation:string }; Returns:undefined }
      delete_organization: { Args:{ target_org:string; confirmation:string }; Returns:undefined }
      create_lead_source: { Args:{ target_org:string; source_name:string; source_platform:string }; Returns:Json }
      rotate_lead_source_key: { Args:{ target_org:string; target_source:string }; Returns:string }
      update_current_profile: { Args:{ profile_full_name:string; profile_username:string }; Returns:Profile }
      send_team_message: { Args:{ target_org:string; message_body:string }; Returns:TeamMessage }
      send_team_room_message: { Args:{ target_org:string; target_room:string; message_body:string; target_reply?:string|null }; Returns:TeamMessage }
      open_team_direct: { Args:{ target_org:string; target_user:string }; Returns:TeamRoom }
      edit_team_message: { Args:{ target_org:string; target_message:string; next_body:string }; Returns:TeamMessage }
      delete_team_message: { Args:{ target_org:string; target_message:string }; Returns:TeamMessage }
      decide_agency_approval: { Args:{ target_org:string; target_request:string; next_status:string }; Returns:AgencyApprovalRequest }
      grant_client_portal_access: { Args:{ target_org:string; target_client:string; target_email:string }; Returns:string }
      list_client_portal_access: { Args:{target_org:string;target_client:string}; Returns:{member_user_id:string;member_email:string;granted_at:string}[] }
      list_my_client_portal_accounts: { Args:Record<string,never>; Returns:{client_id:string;client_name:string}[] }
      list_my_client_portal_updates: { Args:{target_client:string}; Returns:{update_id:string;client_id:string;title:string;body:string;published_at:string}[] }
      revoke_client_portal_access: { Args:{target_org:string;target_client:string;target_user:string}; Returns:undefined }
      list_organization_roster: { Args:{ target_org:string }; Returns:{member_user_id:string;member_role:MemberRole;display_name:string;member_email:string;joined_at:string}[] }
      team_room_unread_counts: { Args:{target_org:string}; Returns:{room_id:string;unread_count:number}[] }
      set_conversation_handling: { Args:{ target_org:string;target_conversation:string;next_mode:string }; Returns:Conversation }
      add_conversation_note: { Args:{target_org:string;target_conversation:string;note_body:string}; Returns:Message }
      promote_outbound_prospect: { Args:{target_org:string;target_prospect:string}; Returns:string }
    }
    Enums: { member_role:MemberRole; lead_stage:DatabaseLeadStage }
    CompositeTypes: Record<string, never>
  }
}

export type OrganizationRow = Organization
export type ProfileRow = Profile
export type ContactRow = Contact
export type LeadRow = Lead
export type LeadActivityRow = LeadActivity
export type TaskRow = Task
export type InvitationRow = Invitation
export type AutomationRow = Automation
export type AutomationStepRow = AutomationStep
export type AutomationRunRow = AutomationRun
export type NotificationRow = Notification
export type SubscriptionRow = Subscription
export type ConversationRow = Conversation
export type MessageRow = Message
export type ConversationReadRow = ConversationRead
export type KnowledgeItemRow = KnowledgeItem
export type AiConfigRow = AiConfig
export type IntegrationRow = Integration
export type WebhookEndpointRow = WebhookEndpoint
export type WebhookDeliveryRow = WebhookDelivery
export type WidgetConfigRow = WidgetConfig
export type LeadSourceRow = Omit<LeadSource,'secret_hash'>
export type NotificationPreferenceRow = NotificationPreference
export type PlanLimitRow = PlanLimit
export type TeamMessageRow = TeamMessage
export type TeamChatReadRow = TeamChatRead
export type TeamRoomRow = TeamRoom
export type TeamRoomMemberRow = TeamRoomMember
export type AgencyClientRow = AgencyClient
export type AgencyProjectRow = AgencyProject
export type ProjectMilestoneRow = ProjectMilestone
export type ClientSystemRow = ClientSystem
export type AgencyAiAgentRow = AgencyAiAgent
export type AgencyApprovalRequestRow = AgencyApprovalRequest
export type AgencyCostEntryRow = AgencyCostEntry
export type ClientPortalUpdateRow = ClientPortalUpdate
export type OutboundCampaignRow = OutboundCampaign
export type OutboundSequenceStepRow = OutboundSequenceStep
export type OutboundProspectRow = OutboundProspect
export type AuditEventRow = AuditEvent
