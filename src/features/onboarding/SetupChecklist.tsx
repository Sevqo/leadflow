import {useCallback,useEffect,useState} from 'react'
import type {WorkspaceLead} from '../crm/types'
import {getWorkspaceReadiness,type WorkspaceReadiness} from '../../services/readiness'

type Props={leads:WorkspaceLead[];knowledgeCount:number;automationCount:number;assistantReady:boolean;isDemo:boolean;organizationId?:string;onNavigate:(page:string)=>void}
export function SetupChecklist({leads,knowledgeCount,automationCount,assistantReady,isDemo,organizationId,onNavigate}:Props){
  const demo:WorkspaceReadiness={business:isDemo,knowledge:knowledgeCount,automations:automationCount,assistant:assistantReady,source:isDemo,team:isDemo}
  const [live,setLive]=useState<WorkspaceReadiness>(demo),[loading,setLoading]=useState(!isDemo),[error,setError]=useState('')
  const storageKey=`nexara-setup-dismissed:${organizationId??'demo'}`
  const [hidden,setHidden]=useState(()=>localStorage.getItem(storageKey)==='true')
  const refresh=useCallback(async()=>{
    if(isDemo||!organizationId){setLive(demo);setLoading(false);return}
    setLoading(true);setError('')
    try{setLive(await getWorkspaceReadiness(organizationId))}catch(reason){setError(reason instanceof Error?reason.message:'Unable to verify launch readiness.')}finally{setLoading(false)}
  },[assistantReady,automationCount,isDemo,knowledgeCount,organizationId])
  useEffect(()=>{void refresh()},[refresh])
  if(hidden)return null
  const items=[
    {label:'Add business information',done:live.business,page:'Settings'},
    {label:'Configure AI assistant',done:live.assistant,page:'AI Assistant'},
    {label:'Add active knowledge',done:live.knowledge>0,page:'Knowledge'},
    {label:'Connect a lead source',done:live.source,page:'Integrations'},
    {label:'Add your first lead',done:leads.length>0,page:'Leads'},
    {label:'Activate an automation',done:live.automations>0,page:'Automations'},
    {label:'Invite a teammate',done:live.team,page:'Team'},
  ]
  const complete=items.filter(item=>item.done).length
  return <section className="card setup-checklist" aria-busy={loading}><div className="card-head"><div><p className="eyebrow">Launch readiness</p><h2>{complete===items.length?'Workspace ready':'Finish your workspace'}</h2><p>{loading?'Verifying live configuration…':`${complete} of ${items.length} launch checks complete`}</p></div><div className="setup-actions">{!isDemo&&<button className="text-btn" disabled={loading} onClick={()=>void refresh()}>↻ Recheck</button>}<button className="text-btn" onClick={()=>{localStorage.setItem(storageKey,'true');setHidden(true)}}>Hide</button></div></div>{error&&<div className="setup-error" role="alert"><span>{error}</span><button onClick={()=>void refresh()}>Try again</button></div>}<div className="setup-progress" aria-label={`${complete} of ${items.length} launch checks complete`}><i style={{width:`${complete/items.length*100}%`}}/></div><div className="setup-items">{items.map(item=><button key={item.label} className={item.done?'done':''} onClick={()=>onNavigate(item.page)}><span>{item.done?'✓':'○'}</span>{item.label}<b>{item.done?'Ready':'→'}</b></button>)}</div></section>
}
