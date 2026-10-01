import {useCallback,useEffect,useState} from 'react'
import {requireSupabase,throwServiceError} from '../../services/api'
import type {AuditEventRow} from '../../types/database'
import './audit.css'

async function loadEvents(organizationId:string,from:number){
  const {data,error}=await requireSupabase().from('audit_events').select('*').eq('organization_id',organizationId).order('created_at',{ascending:false}).range(from,from+49)
  if(error)throwServiceError(error,'Unable to load the audit trail.')
  return data??[]
}
export function AuditPage({organizationId,isDemo}:{organizationId?:string;isDemo:boolean}){
  const [events,setEvents]=useState<AuditEventRow[]>([]),[loading,setLoading]=useState(!isDemo),[error,setError]=useState(''),[query,setQuery]=useState(''),[hasMore,setHasMore]=useState(false)
  const refresh=useCallback(async()=>{if(!organizationId||isDemo)return;setLoading(true);setError('');try{const next=await loadEvents(organizationId,0);setEvents(next);setHasMore(next.length===50)}catch(reason){setError(reason instanceof Error?reason.message:'Unable to load audit events.')}finally{setLoading(false)}},[organizationId,isDemo])
  useEffect(()=>{void refresh()},[refresh])
  const more=async()=>{if(!organizationId||loading)return;setLoading(true);try{const next=await loadEvents(organizationId,events.length);setEvents(current=>[...current,...next]);setHasMore(next.length===50)}catch(reason){setError(reason instanceof Error?reason.message:'Unable to load older events.')}finally{setLoading(false)}}
  const visible=events.filter(item=>`${item.event_type} ${item.entity_type??''} ${item.entity_id??''}`.toLowerCase().includes(query.toLowerCase()))
  return <div className="audit-page"><div className="page-heading"><div><p className="eyebrow">Governance</p><h1>Activity</h1><p className="subheading">Server-recorded workspace actions. Only owners, admins, and managers can access this log.</p></div><button className="btn secondary" onClick={()=>void refresh()} disabled={loading||isDemo}>Refresh</button></div>{isDemo?<div className="card audit-empty">Audit events are only recorded for authenticated workspace actions. Demo mode does not fabricate an audit trail.</div>:<div className="card audit-shell"><label>Search loaded events<input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Action, resource, or ID"/></label>{error&&<p role="alert" className="audit-error">{error}</p>}{loading&&!events.length&&<p role="status">Loading audit trail…</p>}{visible.map(item=><article className="audit-event" key={item.id}><div><strong>{item.event_type.replaceAll('_',' ').toLowerCase()}</strong><span>{item.entity_type||'workspace'}{item.entity_id?` · ${item.entity_id.slice(0,8)}`:''}</span></div><time dateTime={item.created_at}>{new Date(item.created_at).toLocaleString()}</time></article>)}{!loading&&!visible.length&&<p className="audit-empty">{query?'No loaded events match your search.':'No audit events recorded yet.'}</p>}{hasMore&&!query&&<button className="btn secondary" disabled={loading} onClick={()=>void more()}>{loading?'Loading…':'Load older events'}</button>}</div>}</div>
}
