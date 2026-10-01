import {useCallback,useEffect,useRef,useState} from 'react'
import {supabase} from '../../lib/supabase'
import {listTeamMessages,markTeamChatRead,sendTeamMessage} from '../../services/teamChat'
import type {TeamMessageRow} from '../../types/database'
import './team-chat.css'

const demoKey='leadflow-demo-team-chat-v1'
const demoSeed:TeamMessageRow[]=[
  {id:'demo-chat-1',organization_id:'demo',sender_id:'demo-sarah',sender_name:'Sarah Njeri',body:'Morning team! I’m reviewing the new enquiries and will share the qualified ones here.',created_at:'2026-09-30T07:45:00.000Z'},
  {id:'demo-chat-2',organization_id:'demo',sender_id:'demo-david',sender_name:'David Otieno',body:'Thanks, Sarah. I can take the logistics follow-ups this afternoon.',created_at:'2026-09-30T08:10:00.000Z'},
]
function storedDemo():TeamMessageRow[]{try{const value=JSON.parse(localStorage.getItem(demoKey)??'null');return Array.isArray(value)?value:demoSeed}catch{return demoSeed}}
function appendUnique(current:TeamMessageRow[],next:TeamMessageRow){return current.some(item=>item.id===next.id)?current:[...current,next].sort((a,b)=>a.created_at.localeCompare(b.created_at)||a.id.localeCompare(b.id))}

export function TeamChatPage({organizationId,userId,userName,isDemo}:{organizationId?:string;userId?:string;userName:string;isDemo:boolean}){
  const [messages,setMessages]=useState<TeamMessageRow[]>(isDemo?storedDemo:[])
  const [draft,setDraft]=useState(''),[search,setSearch]=useState(''),[loading,setLoading]=useState(!isDemo),[sending,setSending]=useState(false),[older,setOlder]=useState(false),[hasOlder,setHasOlder]=useState(false),[error,setError]=useState('')
  const scrollRef=useRef<HTMLDivElement>(null)
  const latestRef=useRef<string|undefined>(undefined)
  const load=useCallback(async()=>{
    if(isDemo||!organizationId)return
    setLoading(true);setError('')
    try{const latest=await listTeamMessages(organizationId);setMessages(latest);setHasOlder(latest.length===50);if(userId)void markTeamChatRead(organizationId,userId).catch(()=>{})}
    catch(reason){setError(reason instanceof Error?reason.message:'Unable to load team chat.')}
    finally{setLoading(false)}
  },[isDemo,organizationId,userId])
  useEffect(()=>{void load()},[load])
  useEffect(()=>{
    if(isDemo||!organizationId||!supabase)return
    const client=supabase
    const channel=client.channel(`team-chat:${organizationId}`)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'team_messages',filter:`organization_id=eq.${organizationId}`},payload=>{
        setMessages(current=>appendUnique(current,payload.new as TeamMessageRow))
        if(userId)void markTeamChatRead(organizationId,userId).catch(()=>{})
      }).subscribe()
    return()=>{void client.removeChannel(channel)}
  },[isDemo,organizationId,userId])
  const newestId=messages.at(-1)?.id
  useEffect(()=>{if(newestId!==latestRef.current&&!search&&scrollRef.current)scrollRef.current.scrollTop=scrollRef.current.scrollHeight;latestRef.current=newestId},[newestId,search])
  const loadOlder=async()=>{
    if(!organizationId||!messages.length||older)return
    setOlder(true);setError('')
    try{const scroll=scrollRef.current,previousHeight=scroll?.scrollHeight??0,previousTop=scroll?.scrollTop??0;const page=await listTeamMessages(organizationId,messages[0].created_at);setMessages(current=>[...page.filter(item=>!current.some(existing=>existing.id===item.id)),...current]);setHasOlder(page.length===50);requestAnimationFrame(()=>{if(scroll)scroll.scrollTop=previousTop+scroll.scrollHeight-previousHeight})}
    catch(reason){setError(reason instanceof Error?reason.message:'Unable to load older messages.')}
    finally{setOlder(false)}
  }
  const send=async()=>{
    const body=draft.trim()
    if(!body||body.length>2000||sending)return
    setSending(true);setError('')
    try{
      if(isDemo){const item:TeamMessageRow={id:crypto.randomUUID(),organization_id:'demo',sender_id:'demo-me',sender_name:userName,body,created_at:new Date().toISOString()};setMessages(current=>{const next=appendUnique(current,item);localStorage.setItem(demoKey,JSON.stringify(next));return next})}
      else if(organizationId){const item=await sendTeamMessage(organizationId,body);setMessages(current=>appendUnique(current,item));if(userId)void markTeamChatRead(organizationId,userId).catch(()=>{})}
      setDraft('')
    }catch(reason){setError(reason instanceof Error?reason.message:'Message was not sent. Please try again.')}
    finally{setSending(false)}
  }
  const visible=search.trim()?messages.filter(item=>[item.body,item.sender_name].join(' ').toLowerCase().includes(search.trim().toLowerCase())):messages
  return <div className="team-chat-page"><div className="page-heading"><div><p className="eyebrow">Private workspace collaboration</p><h1>Team Chat</h1><p className="subheading">Coordinate with everyone in this workspace. Customer messages stay in the Inbox.</p></div><span className="team-chat-member-count">All workspace members</span></div>
    <section className="card team-chat-shell" aria-label="Team chat"><header className="team-chat-header"><div><strong># General</strong><span>{isDemo?'Demo messages are saved in this browser':'Only signed-in members of this workspace can read and post'}</span></div><label className="team-chat-search">⌕ <input aria-label="Search team messages" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Search loaded messages"/></label></header>
      <div ref={scrollRef} className="team-chat-scroll" role="log" aria-live="polite" aria-relevant="additions text">{hasOlder&&!search&&<button className="team-chat-older" disabled={older} onClick={()=>void loadOlder()}>{older?'Loading…':'Load older messages'}</button>}{loading&&<p className="team-chat-state">Loading messages…</p>}{!loading&&!visible.length&&<div className="team-chat-empty"><strong>{search?'No matching messages':'Start the conversation'}</strong><p>{search?'Try another name or phrase.':'Share an update, ask for help, or coordinate a handoff with your team.'}</p></div>}{visible.map(item=><article className={`team-chat-message ${item.sender_id===(isDemo?'demo-me':userId)?'mine':''}`} key={item.id}><span className="team-chat-avatar" aria-hidden="true">{item.sender_name.split(' ').map(part=>part[0]).join('').slice(0,2).toUpperCase()}</span><div><div className="team-chat-byline"><strong>{item.sender_name}</strong><time dateTime={item.created_at}>{new Date(item.created_at).toLocaleString()}</time></div><p>{item.body}</p></div></article>)}</div>
      {error&&<div className="team-chat-error" role="alert">{error} {loading===false&&messages.length===0&&<button onClick={()=>void load()}>Retry</button>}</div>}
      <form className="team-chat-compose" onSubmit={event=>{event.preventDefault();void send()}}><label htmlFor="team-chat-draft">Message your team</label><div><textarea id="team-chat-draft" value={draft} onChange={event=>setDraft(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.nativeEvent.isComposing){event.preventDefault();void send()}}} maxLength={2000} placeholder="Write an update… Enter to send, Shift+Enter for a new line" rows={2}/><button className="btn primary" disabled={sending||!draft.trim()}>{sending?'Sending…':'Send message'}</button></div><small>{draft.length}/2000 · Keep customer-sensitive details in the lead record, not general chat.</small></form>
    </section></div>
}
