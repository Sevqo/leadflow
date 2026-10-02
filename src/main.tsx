import { StrictMode, Suspense, lazy, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { isSupabaseConfigured } from './lib/supabase'
import { requestPasswordReset, signIn, signOut, signUp } from './services/auth'
import './styles.css'
import './enhancements.css'
import './analytics-professional.css'
import LandingPage from './marketing/LandingPage'
import { PublicPage } from './marketing/PublicPage'
import { ContactsPage, LeadDialog, LeadProfile, LeadsPage, PipelinePage } from './features/crm/CRM'
import { useWorkspaceData } from './features/crm/useWorkspaceData'
import { useSupabaseWorkspaceData } from './features/crm/useSupabaseWorkspaceData'
import { useAuthSession } from './features/auth/useAuthSession'
import { useOrganizations } from './features/organizations/useOrganizations'
import { TasksPage } from './features/tasks/TasksPage'
import { TeamPage } from './features/team/TeamPage'
import { TeamChatPage } from './features/team-chat/TeamChatPage'
import {AgencyWorkspace} from './features/agency/AgencyWorkspace'
import {OutboundWorkspace} from './features/outbound/OutboundWorkspace'
import {searchAgencyRecords} from './services/agency'
import {ClientPortal} from './features/portal/ClientPortal'
import {canViewModule} from './lib/permissions'
import './features/portal/portal.css'
import { useTeamChatUnread } from './features/team-chat/useTeamChatUnread'
import { AutomationWorkspace } from './features/automations/AutomationWorkspace'
import { BillingPage } from './features/billing/BillingPage'
import { LiveInbox } from './features/inbox/LiveInbox'
import { KnowledgePage } from './features/knowledge/KnowledgePage'
import { AiAssistantPage } from './features/ai/AiAssistantPage'
import { IntegrationsPage } from './features/integrations/IntegrationsPage'
import { SettingsPage } from './features/settings/SettingsPage'
import { demoId, useDemoModules } from './features/demo/useDemoModules'
import type {AutomationCondition} from './features/demo/useDemoModules'
import { DemoInbox } from './features/demo/DemoInbox'
import { DemoKnowledge } from './features/demo/DemoKnowledge'
import { DemoAssistant } from './features/demo/DemoAssistant'
import { DemoIntegrations,DemoSettings,DemoTeam } from './features/demo/DemoAdministration'
import { DemoOverview } from './features/demo/DemoOverview'
import { SetupChecklist } from './features/onboarding/SetupChecklist'
import { HelpCenter } from './features/help/HelpCenter'
import { useNotifications } from './features/notifications/useNotifications'
import { acceptInvitation } from './services/team'
import { saveOrganizationSettings } from './services/organizations'
import type { LeadDraft, WorkspaceLead } from './features/crm/types'
import {industryNames} from './config/industries'
import {useUserProfile} from './features/profile/useUserProfile'
import './ui-scale.css'
import './mobile-polish.css'
import './app-shell-polish.css'
import {ErrorBoundary} from './ErrorBoundary'
const AnalyticsWorkbench = lazy(() => import('./Analytics').then(module => ({ default: module.Analytics })))

function exportDemoLeads(leads:WorkspaceLead[]){
  const quote=(value:string|number)=>`"${String(value).replaceAll('"','""')}"`
  const columns=['Name','Email','Phone','Interest','Source','Stage','Score','Value','Owner']
  const rows=leads.map(lead=>[lead.name,lead.email,lead.phone,lead.interest,lead.source,lead.stage,lead.score,lead.value,lead.owner])
  const blob=new Blob([[columns,...rows].map(row=>row.map(quote).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'})
  const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='leadflow-leads.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
}

const navGroups={Command:['Overview','Analytics'],Sales:['Inbox','Leads','Pipeline','Contacts','Outbound'],Clients:['Clients','Projects','Tasks','Systems'],Automation:['Automations','AI Assistant','AI Agents','Approvals','Operations','Knowledge'],Team:['Team','Team Chat'],Manage:['Integrations','Costs','Billing','Activity']} as const
const nav=Object.values(navGroups).flat()

function App() {
  const publicPath=['/about','/contact','/solutions','/privacy','/terms'].includes(window.location.pathname)?window.location.pathname:null
  const [view, setView] = useState(window.location.hash === '#app' ? 'app' : 'marketing')
  const [demoMode,setDemoMode]=useState(()=>!isSupabaseConfigured||sessionStorage.getItem('nexara-demo-mode')==='true')
  const [active, setActive] = useState('Overview')
  const [helpTopic,setHelpTopic]=useState('Overview')
  const [dark, setDark] = useState(() => localStorage.getItem('nexara-theme') === 'dark')
  const demoWorkspace = useWorkspaceData()
  const demoModules = useDemoModules()
  const auth=useAuthSession()
  const liveMode=isSupabaseConfigured&&!demoMode
  const profileState=useUserProfile(auth.user?.id,liveMode&&Boolean(auth.user))
  const organizationState=useOrganizations(auth.user?.id,liveMode&&Boolean(auth.user))
  const liveWorkspace=useSupabaseWorkspaceData(organizationState.activeOrganization?.id,liveMode&&Boolean(organizationState.activeOrganization))
  const liveNotifications=useNotifications(organizationState.activeOrganization?.id,liveMode&&Boolean(auth.user)&&Boolean(organizationState.activeOrganization))
  const teamUnread=useTeamChatUnread(organizationState.activeOrganization?.id,auth.user?.id,liveMode&&Boolean(organizationState.activeOrganization),active==='Team Chat')
  const workspace=demoMode?demoWorkspace:liveWorkspace
  const leads = workspace.leads
  const [showLead, setShowLead] = useState(false)
  const [editLeadId, setEditLeadId] = useState<string | null>(null)
  const [profileId, setProfileId] = useState<string | null>(null)
  const [agencyFocus,setAgencyFocus]=useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [quickOpen,setQuickOpen]=useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [notificationsRead, setNotificationsRead] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [toast, setToast] = useState('')
  const selectedLead = leads.find((lead) => lead.id === profileId)
  const editedLead = leads.find((lead) => lead.id === editLeadId)

  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 2800) }
  const demoMatches=(lead:WorkspaceLead,rules:AutomationCondition[])=>rules.every(rule=>rule.type==='score_gte'?lead.score>=Number(rule.value):rule.type==='stage_is'?lead.stage.toUpperCase()===rule.value:rule.type==='source_is'?lead.source===rule.value:!lead.ownerId||lead.owner==='Unassigned')
  const executeDemoAutomations=(input:WorkspaceLead,trigger:string)=>{
    if(!demoMode)return
    const stageOrder=['New','Qualified','Contacted','Meeting','Negotiation','Won'] as const
    let lead={...input},changed=false
    const newRuns:typeof demoModules.state.runs=[]
    for(const workflow of demoModules.state.automations.filter(item=>item.status==='ACTIVE'&&item.trigger===trigger)){
      const matched=demoMatches(lead,workflow.conditions)
      if(matched)for(const action of workflow.actions){
        if(action.type==='set_stage'&&action.stage){lead={...lead,stage:(action.stage[0]+action.stage.slice(1).toLowerCase()) as WorkspaceLead['stage']};changed=true}
        if(action.type==='advance_stage'){const index=stageOrder.indexOf(lead.stage as typeof stageOrder[number]);if(index>=0&&index<stageOrder.length-1){lead={...lead,stage:stageOrder[index+1]};changed=true}}
        if(action.type==='assign_owner'&&action.ownerId){const owner=workspace.owners.find(item=>item.id===action.ownerId);lead={...lead,ownerId:action.ownerId,owner:owner?.label??'Workspace member'};changed=true}
        if(action.type==='create_task')workspace.createTask({title:action.title??'Automated lead follow-up',description:`Created automatically by “${workflow.name}”.`,dueAt:new Date(Date.now()+Number(action.delayHours??24)*3600000).toISOString(),leadId:lead.id,assigneeId:lead.ownerId??null,priority:'High'})
      }
      const actionSummary=workflow.actions.map(action=>action.type.replaceAll('_',' ')).join(' → ')
      newRuns.push({id:demoId(),automationId:workflow.id,leadName:lead.name,status:matched?'SUCCEEDED':'SKIPPED',at:new Date().toISOString(),detail:matched?`Ran automatically: ${actionSummary}.`:'Conditions did not match.'})
    }
    if(changed)workspace.updateLead(lead.id,{stage:lead.stage,owner:lead.owner,ownerId:lead.ownerId},'Pipeline advanced automatically')
    if(newRuns.length)demoModules.update(current=>({...current,runs:[...newRuns,...current.runs]}))
  }
  const updateLeadWithAutomation=async(leadId:string,changes:Partial<WorkspaceLead>,eventText?:string)=>{const current=leads.find(lead=>lead.id===leadId);await workspace.updateLead(leadId,changes,eventText);if(demoMode&&current)executeDemoAutomations({...current,...changes},changes.stage&&changes.stage!==current.stage?'STAGE_CHANGED':'LEAD_UPDATED')}
  const moveLeadWithAutomation=async(leadId:string,stage:WorkspaceLead['stage'])=>{const current=leads.find(lead=>lead.id===leadId);await workspace.moveLead(leadId,stage);if(demoMode&&current)executeDemoAutomations({...current,stage},'STAGE_CHANGED')}
  const saveLead = async(draft: LeadDraft) => {
    try{
      if (editedLead) await updateLeadWithAutomation(editedLead.id, draft, 'Lead details updated')
      else {const leadId=await workspace.addLead(draft);setProfileId(leadId);executeDemoAutomations({...draft,id:leadId,createdAt:new Date().toISOString(),lastActivity:'Just now',notes:[]},'LEAD_CREATED')}
      setShowLead(false);setEditLeadId(null);notify(editedLead?'Lead updated':'Lead created')
    }catch(reason){notify(reason instanceof Error?reason.message:'Unable to save the lead.');throw reason}
  }
  const openModule = (module: string) => { if(module==='Help')setHelpTopic(active);setAgencyFocus('');setActive(module);setSearchOpen(false);setMobileNavOpen(false) }
  const openLead = (leadId: string) => { setProfileId(leadId); setSearchOpen(false) }
  const enterDemo=()=>{sessionStorage.setItem('nexara-demo-mode','true');setDemoMode(true);window.location.hash='#app';setActive('Overview');setView('app')}
  const authenticated=()=>{sessionStorage.removeItem('nexara-demo-mode');setDemoMode(false);window.location.hash='#app';setView('app')}
  const leaveWorkspace=async()=>{if(liveMode)await signOut();sessionStorage.removeItem('nexara-demo-mode');setDemoMode(false);window.location.hash='';setView('auth')}
  useEffect(() => {
    localStorage.setItem('nexara-theme', dark ? 'dark' : 'light')
    const shortcut = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setSearchOpen(true) } }
    document.addEventListener('keydown', shortcut)
    return () => document.removeEventListener('keydown', shortcut)
  }, [dark])
  useEffect(()=>{
    if(!mobileNavOpen)return
    const previousOverflow=document.body.style.overflow
    document.body.style.overflow='hidden'
    return()=>{document.body.style.overflow=previousOverflow}
  },[mobileNavOpen])
  useEffect(()=>{const token=new URLSearchParams(window.location.search).get('invite');if(!liveMode||!auth.user||!token)return;void acceptInvitation(token).then(()=>{history.replaceState({},'',`${location.pathname}#app`);void organizationState.refresh();notify('Invitation accepted')}).catch(reason=>notify(reason instanceof Error?reason.message:'Unable to accept invitation'))},[auth.user,liveMode,organizationState.refresh])

  if(publicPath)return <PublicPage path={publicPath}/>
  if(window.location.pathname==='/portal')return <ClientPortal userId={auth.user?.id} loading={auth.loading}/>
  if (view === 'marketing') return <LandingPage onDemo={enterDemo} onLaunch={() => setView('auth')} onStart={() => setView('auth')} />
  if (view === 'auth') return <AuthScreen onDemo={enterDemo} onAuthenticated={authenticated} onBack={() => setView('marketing')} />
  if(liveMode&&auth.loading)return <SessionGate title="Securing your session" copy="Checking your Sevqo account…" />
  if(liveMode&&!auth.user)return <AuthScreen onDemo={enterDemo} onAuthenticated={authenticated} onBack={()=>setView('marketing')} />
  if(liveMode&&organizationState.loading)return <SessionGate title="Opening your workspace" copy="Loading your saved organization and permissions…" />
  if(liveMode&&organizationState.error)return <SessionGate title="Workspace unavailable" copy={organizationState.error} action="Try again" onAction={()=>void organizationState.refresh()} />
  if(liveMode&&!organizationState.activeOrganization&&organizationState.organizations.length>0)return <div className={dark?'app dark setup-only':'app setup-only'}><section className="content workspace-picker"><p className="eyebrow">Choose workspace</p><h1>Where would you like to work?</h1><p>Your access follows your workspace membership. You can switch again from the sidebar.</p><div className="workspace-picker-list">{organizationState.organizations.map(item=><button className="card" key={item.id} onClick={()=>organizationState.setActiveId(item.id)}><strong>{item.name}</strong><span>{item.role.toLowerCase()} access →</span></button>)}</div><button className="btn secondary" onClick={()=>void signOut()}>Sign out</button></section></div>
  if(liveMode&&!organizationState.activeOrganization)return <div className={dark?'app dark setup-only':'app setup-only'}><section className="content"><Onboarding onComplete={async details=>{const id=await organizationState.create(details.name);await saveOrganizationSettings(id,{name:details.name,industry:details.industry,website:details.website,phone:details.phone,country:details.country,timezone:details.timezone});await organizationState.refresh();setActive('Overview');notify('Workspace created securely')}}/></section>{toast&&<div className="toast" role="status">✓ {toast}</div>}</div>
  if(liveMode&&liveWorkspace.loading)return <SessionGate title="Loading your CRM" copy="Syncing leads, contacts, activity and workspace members…" />
  if(liveMode&&liveWorkspace.error)return <SessionGate title="CRM unavailable" copy={liveWorkspace.error} action="Try again" onAction={()=>void liveWorkspace.refresh()} />

  const organizationName=demoMode?demoModules.state.settings.name:organizationState.activeOrganization?.name??'Workspace'
  const userName=demoMode?demoModules.state.settings.username:String(profileState.profile?.username??profileState.profile?.full_name??auth.user?.user_metadata.full_name??auth.user?.email??'Account')
  const userInitials=userName.split(/[\s@]/).filter(Boolean).map(part=>part[0]).join('').slice(0,2).toUpperCase()

  return <div className={dark ? 'app dark' : 'app'}>
    {mobileNavOpen && <button className="mobile-nav-backdrop" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} />}
    <aside className={mobileNavOpen ? 'sidebar mobile-open' : 'sidebar'} aria-label="Workspace navigation">
      <div className="brand"><div className="brand-mark">↗</div><div><strong>Sevqo</strong><span>LeadFlow</span></div><button className="mobile-drawer-close" aria-label="Close navigation" onClick={()=>setMobileNavOpen(false)}>×</button></div>
      <div className="workspace"><div className="workspace-avatar">{organizationName[0]}</div><div><strong>{organizationName}</strong><span>{demoMode?'Demo workspace':organizationState.activeOrganization?.role.toLowerCase()}</span></div></div>
      {!demoMode&&organizationState.organizations.length>1&&<select className="workspace-switch" aria-label="Switch workspace" value={organizationState.activeId??''} onChange={event=>{organizationState.setActiveId(event.target.value);setActive('Overview');setMobileNavOpen(false)}}>{organizationState.organizations.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select>}
      <nav>{Object.entries(navGroups).map(([group,items])=><div className="nav-group" key={group}><p className="nav-label">{group}</p>{items.filter(item=>demoMode||canViewModule(organizationState.activeOrganization?.role,item)).map(item=><button aria-label={item} className={active===item?'nav-item active':'nav-item'} onClick={()=>openModule(item)} key={item}><span className="nav-icon" aria-hidden="true">{icon(item)}</span>{item}{item==='Team Chat'&&teamUnread>0&&<span className="team-chat-unread" title={`${teamUnread} unread team messages`}>{teamUnread>99?'99+':teamUnread}</span>}</button>)}</div>)}</nav>
      <div className="sidebar-bottom"><button className="nav-item mobile-quick" aria-label="Quick actions" onClick={()=>{setMobileNavOpen(false);setQuickOpen(true)}}><span className="nav-icon" aria-hidden="true">＋</span>Quick actions</button><button aria-label="Settings" className={active === 'Settings' ? 'nav-item active' : 'nav-item'} onClick={() => openModule('Settings')}><span className="nav-icon" aria-hidden="true">⚙</span>Settings</button><button aria-label="Help" className={active === 'Help' ? 'nav-item active' : 'nav-item'} onClick={() => openModule('Help')}><span className="nav-icon" aria-hidden="true">?</span>Help</button><button className="user" onClick={()=>void leaveWorkspace()} aria-label={demoMode?'Leave demo workspace':'Sign out'}><div className="avatar">{userInitials}</div><div><strong>{userName}</strong><span>{demoMode?'Demo owner':'Sign out'}</span></div></button></div>
    </aside>
    <main className="main">
      <header className="topbar"><div className="mobile-brand"><button className="mobile-nav-toggle" aria-label={mobileNavOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={mobileNavOpen} onClick={() => setMobileNavOpen(!mobileNavOpen)}><AppIcon name="menu"/></button><div className="brand-mark">↗</div><strong>Sevqo</strong></div><div className="breadcrumbs"><span>{organizationName}</span><b>/</b><strong>{active}</strong></div><div className="top-actions"><button className="btn quick-add" onClick={()=>setQuickOpen(true)}><AppIcon name="plus"/> New</button><button className="search" onClick={() => setSearchOpen(true)}><AppIcon name="search"/> <span className="search-label">Search</span> <kbd>Ctrl K</kbd></button><button className="icon-btn" onClick={()=>openModule('Help')} aria-label={`Help with ${active}`} title="Help"><AppIcon name="help"/></button><button className="icon-btn" onClick={() => setDark(!dark)} aria-label="Toggle theme" title="Toggle theme"><AppIcon name={dark?'sun':'moon'}/></button><div className="notification-wrap"><button className="icon-btn" onClick={() => setNotificationsOpen(!notificationsOpen)} aria-expanded={notificationsOpen} aria-label="Notifications" title="Notifications"><AppIcon name="bell"/>{(demoMode?!notificationsRead:liveNotifications.unread>0)&&<i/>}</button>{notificationsOpen&&(demoMode?<div className="notification-popover"><header><strong>Notifications</strong><button onClick={()=>setNotificationsRead(true)}>Mark all read</button></header><button onClick={()=>{openLead('lead-james');setNotificationsOpen(false)}}><span className="notification-dot qualified"/><span><strong>James is ready for a viewing</strong><small>Qualified lead · demo</small></span></button></div>:<div className="notification-popover"><header><strong>Notifications</strong><button onClick={()=>void liveNotifications.readAll()}>Mark all read</button></header>{liveNotifications.items.map(item=><button key={item.id} onClick={()=>void liveNotifications.read(item.id)}><span className={item.read_at?'notification-dot read':'notification-dot qualified'}/><span><strong>{item.title}</strong><small>{item.body??new Date(item.created_at).toLocaleString()}</small></span></button>)}{!liveNotifications.items.length&&<p className="notification-empty">You are all caught up.</p>}</div>)}</div><div className="avatar" title={userName}>{userInitials}</div></div></header>
      <section className="content">
        {(['Clients','Projects','Systems','AI Agents','Approvals','Operations','Costs','Activity'] as string[]).includes(active)?<AgencyWorkspace key={`${active}:${organizationState.activeId??'demo'}`} area={active as 'Clients'|'Projects'|'Systems'|'AI Agents'|'Approvals'|'Operations'|'Costs'|'Activity'} organizationId={organizationState.activeOrganization?.id} role={organizationState.activeOrganization?.role??'OWNER'} isDemo={demoMode} focusId={agencyFocus}/>:active==='Outbound'?<OutboundWorkspace organizationId={organizationState.activeOrganization?.id} isDemo={demoMode} role={organizationState.activeOrganization?.role??'OWNER'} notify={notify}/>:active==='Overview'?<><DemoOverview leads={leads} isDemo={demoMode} userName={userName} onAdd={()=>setShowLead(true)} onNavigate={openModule} onOpenLead={openLead} onExport={()=>exportDemoLeads(leads)}/><SetupChecklist leads={leads} knowledgeCount={demoMode?demoModules.state.knowledge.length:0} automationCount={demoMode?demoModules.state.automations.length:0} assistantReady={demoMode?demoModules.state.assistant.enabled:false} isDemo={demoMode} organizationId={organizationState.activeOrganization?.id} onNavigate={openModule}/></>:active==='Inbox'?(demoMode?<DemoInbox state={demoModules.state} update={demoModules.update} contacts={workspace.contacts} leads={leads} onOpenLead={openLead} onSchedule={demoWorkspace.addFollowUp} notify={notify}/>:<LiveInbox organizationId={organizationState.activeOrganization!.id} contacts={workspace.contacts} leads={leads} onOpenLead={openLead} notify={notify}/>):active==='Leads'?<LeadsPage leads={leads} owners={workspace.owners} isDemo={demoMode} onAdd={()=>setShowLead(true)} onUpdate={updateLeadWithAutomation} onArchive={workspace.archiveLeads} onOpen={openLead} notify={notify}/>:active==='Pipeline'?<PipelinePage leads={leads} isDemo={demoMode} onMove={moveLeadWithAutomation} onOpen={openLead} notify={notify}/>:active==='Tasks'?<TasksPage tasks={workspace.tasks} leads={leads} owners={workspace.owners} onComplete={workspace.completeTask} onCreate={workspace.createTask} onUpdate={workspace.updateTask} onCancel={workspace.cancelTask} onOpenLead={openLead} notify={notify}/>:active==='Contacts'?<ContactsPage contacts={workspace.contacts} leads={leads} onAdd={workspace.addContact} onUpdate={workspace.updateContact} notify={notify}/>:active==='Team'?(demoMode?<DemoTeam/>:<TeamPage organizationId={organizationState.activeOrganization!.id} currentRole={organizationState.activeOrganization!.role} notify={notify}/>):active==='Team Chat'?<TeamChatPage key={demoMode?'demo':organizationState.activeOrganization?.id} organizationId={organizationState.activeOrganization?.id} userId={auth.user?.id} userName={userName} isDemo={demoMode}/>:active==='Automations'?(demoMode?<AutomationWorkspace demo={demoModules} leads={leads} owners={workspace.owners} notify={notify}/>:<AutomationWorkspace organizationId={organizationState.activeOrganization!.id} leads={leads} owners={workspace.owners} notify={notify}/>):active==='AI Assistant'?(demoMode?<DemoAssistant state={demoModules.state} update={demoModules.update} notify={notify}/>:<AiAssistantPage organizationId={organizationState.activeOrganization!.id} canManage={['OWNER','ADMIN'].includes(organizationState.activeOrganization!.role)} notify={notify}/>):active==='Knowledge'?(demoMode?<DemoKnowledge state={demoModules.state} update={demoModules.update} notify={notify}/>:<KnowledgePage organizationId={organizationState.activeOrganization!.id} canManage={['OWNER','ADMIN','MANAGER'].includes(organizationState.activeOrganization!.role)} notify={notify}/>):active==='Analytics'?<Suspense fallback={<p role="status">Loading analytics…</p>}><AnalyticsWorkbench leads={leads} isDemo={demoMode}/></Suspense>:active==='Integrations'?(demoMode?<DemoIntegrations notify={notify}/>:<IntegrationsPage organizationId={organizationState.activeOrganization!.id} canManage={['OWNER','ADMIN'].includes(organizationState.activeOrganization?.role??'')} notify={notify}/>):active==='Billing'?<BillingPage demo={demoMode} organizationId={organizationState.activeOrganization?.id} canManage={demoMode||['OWNER','ADMIN'].includes(organizationState.activeOrganization?.role??'')} notify={notify}/>:active==='Settings'?(demoMode?<DemoSettings state={demoModules.state} update={demoModules.update} notify={notify}/>:<SettingsPage organization={organizationState.activeOrganization!} userId={auth.user!.id} userEmail={auth.user!.email??''} onSaved={organizationState.refresh} onProfileSaved={profileState.refresh} notify={notify}/>):<HelpCenter onNavigate={openModule} isDemo={demoMode} focus={helpTopic}/>}
      </section>
    </main>
    {(showLead || editedLead) && <LeadDialog lead={editedLead} owners={workspace.owners} onClose={() => { setShowLead(false); setEditLeadId(null) }} onSave={saveLead} />}
    {selectedLead && <LeadProfile lead={selectedLead} owners={workspace.owners} onClose={() => setProfileId(null)} onUpdate={updateLeadWithAutomation} onAddNote={workspace.addNote} onSchedule={workspace.addFollowUp} onEdit={() => { setEditLeadId(selectedLead.id); setProfileId(null) }} notify={notify} />}
    {searchOpen && <CommandSearch leads={leads} organizationId={demoMode?undefined:organizationState.activeOrganization?.id} availableModules={nav.filter(item=>demoMode||canViewModule(organizationState.activeOrganization?.role,item))} onClose={() => setSearchOpen(false)} onModule={openModule} onLead={openLead} onAgency={(module,id)=>{setAgencyFocus(id);setActive(module);setSearchOpen(false)}} />}
    {quickOpen&&<QuickActions onClose={()=>setQuickOpen(false)} onLead={()=>{setQuickOpen(false);setShowLead(true)}} onModule={module=>{setQuickOpen(false);openModule(module)}}/>}
    {toast && <div className="toast" role="status">✓ {toast}</div>}
  </div>
}

function CommandSearch({ leads, organizationId, availableModules, onClose, onModule, onLead, onAgency }: { leads: WorkspaceLead[]; organizationId?:string; availableModules:string[]; onClose: () => void; onModule: (module: string) => void; onLead: (id: string) => void; onAgency:(module:string,id:string)=>void }) {
  const [query, setQuery] = useState('')
  const [agencyItems,setAgencyItems]=useState<{id:string;name:string;module:string;detail:string}[]>([])
  useEffect(()=>{if(!organizationId||query.trim().length<2){setAgencyItems([]);return}let cancelled=false;const timer=window.setTimeout(()=>{void searchAgencyRecords(organizationId,query).then(items=>{if(!cancelled)setAgencyItems(items)}).catch(()=>{})},200);return()=>{cancelled=true;window.clearTimeout(timer)}},[organizationId,query])
  useEffect(() => { const close = (event: KeyboardEvent) => event.key === 'Escape' && onClose(); document.addEventListener('keydown', close); return () => document.removeEventListener('keydown', close) }, [onClose])
  const modules = [...availableModules, 'Settings', 'Help'].filter((item) => item.toLowerCase().includes(query.toLowerCase()))
  const matches = leads.filter((lead) => [lead.name, lead.interest, lead.email].join(' ').toLowerCase().includes(query.toLowerCase())).slice(0, 5)
  const agencyMatches=query.trim()?agencyItems.filter(item=>`${item.name} ${item.detail}`.toLowerCase().includes(query.toLowerCase())).slice(0,8):[]
  return <div className="command-backdrop" onClick={onClose}><div className="command-palette" role="dialog" aria-modal="true" aria-label="Search workspace" onClick={(event) => event.stopPropagation()}><label>⌕<input autoFocus aria-label="Search workspace" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search leads, clients, projects, systems, or pages…"/><kbd>Esc</kbd></label><div className="command-results">{modules.length > 0 && <p>GO TO</p>}{modules.map((module) => <button key={module} onClick={() => onModule(module)}><span className="command-icon">{icon(module)}</span><strong>{module}</strong><small>Open page</small></button>)}{matches.length > 0 && <p>LEADS</p>}{matches.map((lead) => <button key={lead.id} onClick={() => onLead(lead.id)}><span className="lead-avatar">{lead.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</span><strong>{lead.name}</strong><small>{lead.stage} · {lead.interest}</small></button>)}{agencyMatches.length>0&&<p>AGENCY RECORDS</p>}{agencyMatches.map(item=><button key={`${item.module}:${item.id}`} onClick={()=>onAgency(item.module,item.id)}><span className="command-icon">{icon(item.module)}</span><strong>{item.name}</strong><small>{item.module} · {item.detail}</small></button>)}{!modules.length && !matches.length && !agencyMatches.length && <div className="command-empty">No result for “{query}”</div>}</div></div></div>
}

function QuickActions({onClose,onLead,onModule}:{onClose:()=>void;onLead:()=>void;onModule:(module:string)=>void}){const actions=[['＋','New lead','Capture a new opportunity',onLead],['◎','New contact','Open the customer directory',()=>onModule('Contacts')],['✎','Add note','Find a lead and record context',()=>onModule('Leads')],['⚡','Create automation','Build a follow-up workflow',()=>onModule('Automations')],['✉','Invite teammate','Open team invitations',()=>onModule('Team')],['☷','Message team','Post an internal workspace update',()=>onModule('Team Chat')]] as const;return <div className="command-backdrop" onClick={onClose}><div className="command-palette quick-palette" role="dialog" aria-modal="true" aria-label="Quick actions" onClick={event=>event.stopPropagation()}><div className="modal-head"><div><p className="eyebrow">Quick create</p><h2>What would you like to do?</h2></div><button className="close" onClick={onClose}>×</button></div><div className="command-results">{actions.map(([iconValue,label,copy,action])=><button key={label} onClick={action}><span className="command-icon">{iconValue}</span><strong>{label}</strong><small>{copy}</small></button>)}</div></div></div>}

function SessionGate({title,copy,action,onAction}:{title:string;copy:string;action?:string;onAction?:()=>void}){
  return <div className="session-gate"><div className="brand-mark">↗</div><span className="session-spinner"/><h1>{title}</h1><p>{copy}</p>{action&&<button className="btn primary" onClick={onAction}>{action}</button>}</div>
}

function AuthScreen({ onDemo, onAuthenticated, onBack }: { onDemo: () => void; onAuthenticated:()=>void; onBack: () => void }) {
  const [mode, setMode] = useState<'signin' | 'signup' | 'reset'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError(''); setNotice(''); setLoading(true)
    const result = mode === 'signin' ? await signIn(email, password) : mode === 'signup' ? await signUp(email, password) : await requestPasswordReset(email)
    setLoading(false)
    if (!result.ok) setError(result.message)
    else if(result.authenticated)onAuthenticated()
    else setNotice(result.message ?? 'Done')
  }
  return <div className="auth-page"><div className="auth-decoration"><div className="auth-orbit orbit-one"></div><div className="auth-orbit orbit-two"></div><div className="auth-quote"><span>✦</span><p>“The calmest way to turn a busy inbox into a clear next step.”</p><small>Sevqo LeadFlow</small></div></div><div className="auth-panel"><button className="auth-back" onClick={onBack}>← Back to Sevqo</button><div className="auth-brand"><div className="brand-mark">↗</div><strong>Sevqo <span>LeadFlow</span></strong></div><div className="auth-content"><p className="eyebrow">{mode === 'signup' ? 'Start your workspace' : mode === 'reset' ? 'Account recovery' : 'Welcome back'}</p><h1>{mode === 'signup' ? 'Build your better pipeline.' : mode === 'reset' ? 'Reset your password.' : 'Good to see you again.'}</h1><p className="auth-sub">{mode === 'signup' ? 'Create a workspace for every conversation that matters.' : mode === 'reset' ? 'Enter your email and we’ll send a secure reset link.' : 'Sign in to continue to your LeadFlow workspace.'}</p>{!isSupabaseConfigured&&<div className="auth-demo-notice"><span>Demo mode</span><p>Supabase Auth is not configured in this environment. Use the demo workspace to explore the product.</p><button onClick={onDemo}>Open demo workspace →</button></div>}<form onSubmit={submit}><label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" required /></label>{mode !== 'reset' && <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" minLength={8} required /></label>}{error && <div className="form-error">! {error}</div>}{notice && <div className="form-success">✓ {notice}</div>}<button className="btn primary auth-submit" disabled={loading}>{loading ? 'Please wait…' : mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset link'} ↗</button></form><div className="auth-links">{mode === 'signin' && <button onClick={() => setMode('reset')}>Forgot password?</button>}{mode === 'reset' && <button onClick={() => setMode('signin')}>Back to sign in</button>}{mode !== 'reset' && <button onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>{mode === 'signin' ? 'Create a new account' : 'Already have an account?'}</button>}</div><button className="auth-demo-link" onClick={onDemo}>Explore the demo instead</button><small className="auth-legal">Authentication and sessions are secured by Supabase. By continuing, you agree to our Terms and Privacy Policy.</small></div></div></div>
}

type OnboardingDetails={name:string;industry:string;website:string;phone:string;country:string;timezone:string}
function Onboarding({onComplete}:{onComplete:(details:OnboardingDetails)=>Promise<void>}){
  const [details,setDetails]=useState<OnboardingDetails>({name:'',industry:'',website:'',phone:'',country:'KE',timezone:'Africa/Nairobi'})
  const [saving,setSaving]=useState(false),[error,setError]=useState('')
  const change=(key:keyof OnboardingDetails,value:string)=>setDetails(current=>({...current,[key]:value}))
  const submit=async(event:React.FormEvent<HTMLFormElement>)=>{event.preventDefault();setSaving(true);setError('');try{await onComplete(details)}catch(reason){setError(reason instanceof Error?reason.message:'Unable to create workspace')}finally{setSaving(false)}}
  return <div className="onboarding-wrap"><div className="onboarding-progress"><div><p className="eyebrow">Workspace setup</p><h1>Create your workspace.</h1><p>Start with your business details. Add knowledge, channels and teammates from the workspace after creation.</p></div></div><form className="card onboarding-card" onSubmit={event=>void submit(event)}><div className="setup-icon">⌂</div><h2>Business details</h2><p>These details are saved to your organization.</p><label>Business name<input required minLength={2} value={details.name} onChange={event=>change('name',event.target.value)}/></label><label>Industry<select value={details.industry} onChange={event=>change('industry',event.target.value)} required><option value="">Choose your industry</option>{industryNames.map(industry=><option key={industry}>{industry}</option>)}</select></label><label>Website<input type="url" value={details.website} onChange={event=>change('website',event.target.value)} placeholder="https://example.com"/></label><label>Phone<input value={details.phone} onChange={event=>change('phone',event.target.value)} placeholder="+254…"/></label><label>Country<select value={details.country} onChange={event=>change('country',event.target.value)}><option value="KE">Kenya</option><option value="UG">Uganda</option><option value="TZ">Tanzania</option><option value="OTHER">Other</option></select></label><label>Timezone<select value={details.timezone} onChange={event=>change('timezone',event.target.value)}><option>Africa/Nairobi</option><option>Africa/Kampala</option><option>Africa/Dar_es_Salaam</option><option>UTC</option></select></label>{error&&<div className="form-error" role="alert">{error}</div>}<div className="onboarding-actions"><button className="btn primary" disabled={saving}>{saving?'Creating…':'Create workspace'} ↗</button></div></form></div>
}
type AppIconName='menu'|'search'|'help'|'moon'|'sun'|'bell'|'plus'|'overview'|'analytics'|'inbox'|'leads'|'pipeline'|'contacts'|'outbound'|'clients'|'projects'|'tasks'|'systems'|'automations'|'assistant'|'agents'|'approvals'|'operations'|'knowledge'|'team'|'chat'|'integrations'|'costs'|'billing'|'activity'|'settings'
function AppIcon({name,size=18}:{name:AppIconName;size?:number}){
  const paths:Record<AppIconName,React.ReactNode>={
    menu:<><path d="M4 7h16M4 12h16M4 17h16"/></>,search:<><circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/></>,help:<><circle cx="12" cy="12" r="9"/><path d="M9.8 9a2.3 2.3 0 1 1 3.4 2c-.8.5-1.2 1-1.2 2M12 17h.01"/></>,moon:<path d="M20 15.4A8 8 0 0 1 8.6 4 8.5 8.5 0 1 0 20 15.4Z"/>,sun:<><circle cx="12" cy="12" r="3.5"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></>,bell:<><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 8h18c0-1-3-1-3-8M10 21h4"/></>,plus:<path d="M12 5v14M5 12h14"/>,overview:<><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></>,analytics:<><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></>,inbox:<><path d="M4 5h16v14H4z"/><path d="m4 14 4-4h8l4 4M8 14h8"/></>,leads:<><circle cx="9" cy="8" r="3"/><path d="M3 20c.4-4 2.4-6 6-6s5.6 2 6 6M17 8h4M19 6v4"/></>,pipeline:<><path d="M4 5h5v5H4zM15 14h5v5h-5zM9 7.5h4a4 4 0 0 1 4 4V14"/></>,contacts:<><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2"/><path d="M3 20c.5-4 2.5-6 6-6s5.5 2 6 6M15 15c3 0 5 1.5 5.5 4"/></>,outbound:<><path d="m4 12 16-8-6 16-3-7-7-1Z"/><path d="m11 13 9-9"/></>,clients:<><rect x="3" y="6" width="18" height="14" rx="2"/><path d="M8 6V4h8v2M8 11h8"/></>,projects:<><path d="M3 7h7l2 2h9v10H3z"/><path d="M3 7V5h7l2 2"/></>,tasks:<><path d="M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2"/></>,systems:<><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H3v-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.5V3h4v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.1v4H21a1.7 1.7 0 0 0-1.6 1Z"/></>,automations:<path d="m13 2-9 12h7l-1 8 10-13h-7z"/>,assistant:<><path d="M12 3 13.5 8.5 19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5z"/><path d="m19 16 .6 2.4L22 19l-2.4.6L19 22l-.6-2.4L16 19l2.4-.6z"/></>,agents:<><circle cx="12" cy="8" r="4"/><path d="M5 21v-2a7 7 0 0 1 14 0v2M9 8h.01M15 8h.01"/></>,approvals:<><path d="M12 3 4 6v6c0 5 3.4 8 8 9 4.6-1 8-4 8-9V6z"/><path d="m8.5 12 2.2 2.2 4.8-5"/></>,operations:<><path d="M4 6h16M4 12h16M4 18h16"/><circle cx="8" cy="6" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="10" cy="18" r="2"/></>,knowledge:<><path d="M4 4h12a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3z"/><path d="M7 4v16M10 8h6M10 12h6"/></>,team:<><circle cx="8" cy="9" r="3"/><circle cx="17" cy="10" r="2.5"/><path d="M2.5 20c.5-4 2.3-6 5.5-6s5 2 5.5 6M14 15c3.5 0 5.5 1.7 6 5"/></>,chat:<><path d="M4 5h16v12H9l-5 4z"/><path d="M8 9h8M8 13h5"/></>,integrations:<><path d="M8 3v4M16 3v4M6 7h12v4a6 6 0 0 1-12 0zM12 17v4"/></>,costs:<><circle cx="12" cy="12" r="9"/><path d="M15 8.5c-.7-.6-1.6-1-3-1-1.7 0-3 .8-3 2s1.1 1.8 3 2.2 3 1 3 2.3-1.3 2.5-3 2.5c-1.4 0-2.5-.4-3.3-1.1M12 5v14"/></>,billing:<><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/></>,activity:<><path d="M3 12h4l2-6 4 12 2-6h6"/></>,settings:<><circle cx="12" cy="12" r="3"/><path d="M19 13.5v-3l-2-.7-.5-1.2.9-1.9-2.1-2.1-1.9.9-1.2-.5-.7-2h-3l-.7 2-1.2.5-1.9-.9-2.1 2.1.9 1.9-.5 1.2-2 .7v3l2 .7.5 1.2-.9 1.9 2.1 2.1 1.9-.9 1.2.5.7 2h3l.7-2 1.2-.5 1.9.9 2.1-2.1-.9-1.9.5-1.2z"/></>
  }
  return <svg className="app-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}
function icon(item:string){const map:Record<string,AppIconName>={Overview:'overview',Analytics:'analytics',Inbox:'inbox',Leads:'leads',Pipeline:'pipeline',Contacts:'contacts',Outbound:'outbound',Clients:'clients',Projects:'projects',Tasks:'tasks',Systems:'systems',Automations:'automations','AI Assistant':'assistant','AI Agents':'agents',Approvals:'approvals',Operations:'operations',Knowledge:'knowledge',Team:'team','Team Chat':'chat',Integrations:'integrations',Costs:'costs',Billing:'billing',Activity:'activity',Settings:'settings'};return <AppIcon name={map[item]??'overview'}/>}

createRoot(document.getElementById('root')!).render(<StrictMode><ErrorBoundary><App /></ErrorBoundary></StrictMode>)
