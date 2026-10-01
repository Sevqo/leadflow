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
import {ErrorBoundary} from './ErrorBoundary'
const AnalyticsWorkbench = lazy(() => import('./Analytics').then(module => ({ default: module.Analytics })))

function exportDemoLeads(leads:WorkspaceLead[]){
  const quote=(value:string|number)=>`"${String(value).replaceAll('"','""')}"`
  const columns=['Name','Email','Phone','Interest','Source','Stage','Score','Value','Owner']
  const rows=leads.map(lead=>[lead.name,lead.email,lead.phone,lead.interest,lead.source,lead.stage,lead.score,lead.value,lead.owner])
  const blob=new Blob([[columns,...rows].map(row=>row.map(quote).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'})
  const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='leadflow-leads.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
}

const nav = ['Overview', 'Inbox', 'Leads', 'Pipeline', 'Tasks', 'Contacts', 'Team', 'Automations', 'AI Assistant', 'Knowledge', 'Analytics', 'Integrations', 'Billing']

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
  const workspace=demoMode?demoWorkspace:liveWorkspace
  const leads = workspace.leads
  const [showLead, setShowLead] = useState(false)
  const [editLeadId, setEditLeadId] = useState<string | null>(null)
  const [profileId, setProfileId] = useState<string | null>(null)
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
  const openModule = (module: string) => { if(module==='Help')setHelpTopic(active);setActive(module);setSearchOpen(false);setMobileNavOpen(false) }
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
  if (view === 'marketing') return <LandingPage onDemo={enterDemo} onLaunch={() => setView('auth')} onStart={() => setView('auth')} />
  if (view === 'auth') return <AuthScreen onDemo={enterDemo} onAuthenticated={authenticated} onBack={() => setView('marketing')} />
  if(liveMode&&auth.loading)return <SessionGate title="Securing your session" copy="Checking your Sevqo account…" />
  if(liveMode&&!auth.user)return <AuthScreen onDemo={enterDemo} onAuthenticated={authenticated} onBack={()=>setView('marketing')} />
  if(liveMode&&organizationState.loading)return <SessionGate title="Opening your workspace" copy="Loading your saved organization and permissions…" />
  if(liveMode&&organizationState.error)return <SessionGate title="Workspace unavailable" copy={organizationState.error} action="Try again" onAction={()=>void organizationState.refresh()} />
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
      <p className="nav-label">Workspace</p>
      <nav>{nav.map((item) => <button className={active === item ? 'nav-item active' : 'nav-item'} onClick={() => openModule(item)} key={item}><span className="nav-icon">{icon(item)}</span>{item}</button>)}</nav>
      <div className="sidebar-bottom"><button className="nav-item mobile-quick" onClick={()=>{setMobileNavOpen(false);setQuickOpen(true)}}><span className="nav-icon">＋</span>Quick actions</button><button className={active === 'Settings' ? 'nav-item active' : 'nav-item'} onClick={() => openModule('Settings')}><span className="nav-icon">⚙</span>Settings</button><button className={active === 'Help' ? 'nav-item active' : 'nav-item'} onClick={() => openModule('Help')}><span className="nav-icon">?</span>Help</button><button className="user" onClick={()=>void leaveWorkspace()} aria-label={demoMode?'Leave demo workspace':'Sign out'}><div className="avatar">{userInitials}</div><div><strong>{userName}</strong><span>{demoMode?'Demo owner':'Sign out'}</span></div></button></div>
    </aside>
    <main className="main">
      <header className="topbar"><div className="mobile-brand"><button className="mobile-nav-toggle" aria-label={mobileNavOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={mobileNavOpen} onClick={() => setMobileNavOpen(!mobileNavOpen)}>☰</button><div className="brand-mark">↗</div><strong>Sevqo</strong></div><div className="breadcrumbs"><span>{organizationName}</span><b>/</b><strong>{active}</strong></div><div className="top-actions"><button className="btn quick-add" onClick={()=>setQuickOpen(true)}>＋ New</button><button className="search" onClick={() => setSearchOpen(true)}><span>⌕</span> Search <kbd>Ctrl K</kbd></button><button className="icon-btn" onClick={()=>openModule('Help')} aria-label={`Help with ${active}`}>?</button><button className="icon-btn" onClick={() => setDark(!dark)} aria-label="Toggle theme">{dark ? '☼' : '☾'}</button><div className="notification-wrap"><button className="icon-btn" onClick={() => setNotificationsOpen(!notificationsOpen)} aria-expanded={notificationsOpen} aria-label="Notifications">♢{(demoMode?!notificationsRead:liveNotifications.unread>0)&&<i/>}</button>{notificationsOpen&&(demoMode?<div className="notification-popover"><header><strong>Notifications</strong><button onClick={()=>setNotificationsRead(true)}>Mark all read</button></header><button onClick={()=>{openLead('lead-james');setNotificationsOpen(false)}}><span className="notification-dot qualified"/><span><strong>James is ready for a viewing</strong><small>Qualified lead · demo</small></span></button></div>:<div className="notification-popover"><header><strong>Notifications</strong><button onClick={()=>void liveNotifications.readAll()}>Mark all read</button></header>{liveNotifications.items.map(item=><button key={item.id} onClick={()=>void liveNotifications.read(item.id)}><span className={item.read_at?'notification-dot read':'notification-dot qualified'}/><span><strong>{item.title}</strong><small>{item.body??new Date(item.created_at).toLocaleString()}</small></span></button>)}{!liveNotifications.items.length&&<p className="notification-empty">You are all caught up.</p>}</div>)}</div><div className="avatar">{userInitials}</div></div></header>
      <section className="content">
        {active==='Overview'?<><DemoOverview leads={leads} isDemo={demoMode} userName={userName} onAdd={()=>setShowLead(true)} onNavigate={openModule} onOpenLead={openLead} onExport={()=>exportDemoLeads(leads)}/><SetupChecklist leads={leads} knowledgeCount={demoMode?demoModules.state.knowledge.length:0} automationCount={demoMode?demoModules.state.automations.length:0} assistantReady={demoMode?demoModules.state.assistant.enabled:false} isDemo={demoMode} organizationId={organizationState.activeOrganization?.id} onNavigate={openModule}/></>:active==='Inbox'?(demoMode?<DemoInbox state={demoModules.state} update={demoModules.update} contacts={workspace.contacts} leads={leads} onOpenLead={openLead} onSchedule={demoWorkspace.addFollowUp} notify={notify}/>:<LiveInbox organizationId={organizationState.activeOrganization!.id} contacts={workspace.contacts} leads={leads} onOpenLead={openLead} notify={notify}/>):active==='Leads'?<LeadsPage leads={leads} owners={workspace.owners} isDemo={demoMode} onAdd={()=>setShowLead(true)} onUpdate={updateLeadWithAutomation} onArchive={workspace.archiveLeads} onOpen={openLead} notify={notify}/>:active==='Pipeline'?<PipelinePage leads={leads} isDemo={demoMode} onMove={moveLeadWithAutomation} onOpen={openLead} notify={notify}/>:active==='Tasks'?<TasksPage tasks={workspace.tasks} leads={leads} owners={workspace.owners} onComplete={workspace.completeTask} onCreate={workspace.createTask} onUpdate={workspace.updateTask} onCancel={workspace.cancelTask} onOpenLead={openLead} notify={notify}/>:active==='Contacts'?<ContactsPage contacts={workspace.contacts} leads={leads} onAdd={workspace.addContact} onUpdate={workspace.updateContact} notify={notify}/>:active==='Team'?(demoMode?<DemoTeam/>:<TeamPage organizationId={organizationState.activeOrganization!.id} currentRole={organizationState.activeOrganization!.role} notify={notify}/>):active==='Automations'?(demoMode?<AutomationWorkspace demo={demoModules} leads={leads} owners={workspace.owners} notify={notify}/>:<AutomationWorkspace organizationId={organizationState.activeOrganization!.id} leads={leads} owners={workspace.owners} notify={notify}/>):active==='AI Assistant'?(demoMode?<DemoAssistant state={demoModules.state} update={demoModules.update} notify={notify}/>:<AiAssistantPage organizationId={organizationState.activeOrganization!.id} canManage={['OWNER','ADMIN'].includes(organizationState.activeOrganization!.role)} notify={notify}/>):active==='Knowledge'?(demoMode?<DemoKnowledge state={demoModules.state} update={demoModules.update} notify={notify}/>:<KnowledgePage organizationId={organizationState.activeOrganization!.id} canManage={['OWNER','ADMIN','MANAGER'].includes(organizationState.activeOrganization!.role)} notify={notify}/>):active==='Analytics'?<Suspense fallback={<p role="status">Loading analytics…</p>}><AnalyticsWorkbench leads={leads} isDemo={demoMode}/></Suspense>:active==='Integrations'?(demoMode?<DemoIntegrations notify={notify}/>:<IntegrationsPage organizationId={organizationState.activeOrganization!.id} canManage={['OWNER','ADMIN'].includes(organizationState.activeOrganization!.role)} notify={notify}/>):active==='Billing'?<BillingPage demo={demoMode} organizationId={organizationState.activeOrganization?.id} canManage={demoMode||['OWNER','ADMIN'].includes(organizationState.activeOrganization?.role??'')} notify={notify}/>:active==='Settings'?(demoMode?<DemoSettings state={demoModules.state} update={demoModules.update} notify={notify}/>:<SettingsPage organization={organizationState.activeOrganization!} userId={auth.user!.id} userEmail={auth.user!.email??''} onSaved={organizationState.refresh} onProfileSaved={profileState.refresh} notify={notify}/>):<HelpCenter onNavigate={openModule} isDemo={demoMode} focus={helpTopic}/>}
      </section>
    </main>
    {(showLead || editedLead) && <LeadDialog lead={editedLead} owners={workspace.owners} onClose={() => { setShowLead(false); setEditLeadId(null) }} onSave={saveLead} />}
    {selectedLead && <LeadProfile lead={selectedLead} owners={workspace.owners} onClose={() => setProfileId(null)} onUpdate={updateLeadWithAutomation} onAddNote={workspace.addNote} onSchedule={workspace.addFollowUp} onEdit={() => { setEditLeadId(selectedLead.id); setProfileId(null) }} notify={notify} />}
    {searchOpen && <CommandSearch leads={leads} onClose={() => setSearchOpen(false)} onModule={openModule} onLead={openLead} />}
    {quickOpen&&<QuickActions onClose={()=>setQuickOpen(false)} onLead={()=>{setQuickOpen(false);setShowLead(true)}} onModule={module=>{setQuickOpen(false);openModule(module)}}/>}
    {toast && <div className="toast" role="status">✓ {toast}</div>}
  </div>
}

function CommandSearch({ leads, onClose, onModule, onLead }: { leads: WorkspaceLead[]; onClose: () => void; onModule: (module: string) => void; onLead: (id: string) => void }) {
  const [query, setQuery] = useState('')
  useEffect(() => { const close = (event: KeyboardEvent) => event.key === 'Escape' && onClose(); document.addEventListener('keydown', close); return () => document.removeEventListener('keydown', close) }, [onClose])
  const modules = [...nav, 'Settings', 'Help'].filter((item) => item.toLowerCase().includes(query.toLowerCase()))
  const matches = leads.filter((lead) => [lead.name, lead.interest, lead.email].join(' ').toLowerCase().includes(query.toLowerCase())).slice(0, 5)
  return <div className="command-backdrop" onClick={onClose}><div className="command-palette" role="dialog" aria-modal="true" aria-label="Search workspace" onClick={(event) => event.stopPropagation()}><label>⌕<input autoFocus aria-label="Search workspace" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search leads or open a page…"/><kbd>Esc</kbd></label><div className="command-results">{modules.length > 0 && <p>GO TO</p>}{modules.map((module) => <button key={module} onClick={() => onModule(module)}><span className="command-icon">{icon(module)}</span><strong>{module}</strong><small>Open page</small></button>)}{matches.length > 0 && <p>LEADS</p>}{matches.map((lead) => <button key={lead.id} onClick={() => onLead(lead.id)}><span className="lead-avatar">{lead.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</span><strong>{lead.name}</strong><small>{lead.stage} · {lead.interest}</small></button>)}{!modules.length && !matches.length && <div className="command-empty">No result for “{query}”</div>}</div></div></div>
}

function QuickActions({onClose,onLead,onModule}:{onClose:()=>void;onLead:()=>void;onModule:(module:string)=>void}){const actions=[['＋','New lead','Capture a new opportunity',onLead],['◎','New contact','Open the customer directory',()=>onModule('Contacts')],['✎','Add note','Find a lead and record context',()=>onModule('Leads')],['⚡','Create automation','Build a follow-up workflow',()=>onModule('Automations')],['✉','Invite teammate','Open team invitations',()=>onModule('Team')]] as const;return <div className="command-backdrop" onClick={onClose}><div className="command-palette quick-palette" role="dialog" aria-modal="true" aria-label="Quick actions" onClick={event=>event.stopPropagation()}><div className="modal-head"><div><p className="eyebrow">Quick create</p><h2>What would you like to do?</h2></div><button className="close" onClick={onClose}>×</button></div><div className="command-results">{actions.map(([iconValue,label,copy,action])=><button key={label} onClick={action}><span className="command-icon">{iconValue}</span><strong>{label}</strong><small>{copy}</small></button>)}</div></div></div>}

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
function icon(item: string) { const map: Record<string, string> = { Overview:'⌂', Inbox:'▱', Leads:'♙', Pipeline:'⌁', Tasks:'✓', Contacts:'♧', Team:'♙', Automations:'◇', 'AI Assistant':'✦', Knowledge:'▤', Analytics:'▥', Integrations:'⌘', Billing:'¤' }; return map[item] ?? '·' }

createRoot(document.getElementById('root')!).render(<StrictMode><ErrorBoundary><App /></ErrorBoundary></StrictMode>)
