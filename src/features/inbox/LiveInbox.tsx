import {useCallback,useEffect,useMemo,useRef,useState} from 'react'
import {supabase} from '../../lib/supabase'
import {addConversationNote,createConversation,listConversationMessages,listConversationReads,listConversations,markConversationRead,sendConversationMessage,setConversationHandling,setConversationStatus} from '../../services/inbox'
import {sendWhatsAppMessage} from '../../services/whatsapp'
import type {ConversationReadRow,ConversationRow,MessageRow} from '../../types/database'
import type {WorkspaceContact,WorkspaceLead} from '../crm/types'
import {qualifyConversation,type QualificationResult} from '../../services/ai'
import {runTriggeredAutomations} from '../../services/automations'
import {MessageComposer} from '../messaging/MessageComposer'
import '../messaging/messaging.css'
import './live-inbox.css'

const initials=(name:string)=>name.split(' ').map(part=>part[0]).join('').slice(0,2).toUpperCase()
const channels:ConversationRow['channel'][]=['WEBSITE','WHATSAPP','EMAIL','PHONE','SMS','INSTAGRAM','FACEBOOK','MESSENGER','LINKEDIN','TIKTOK','TELEGRAM','MARKETPLACE','API','OTHER']

export function LiveInbox({organizationId,contacts,leads,onOpenLead,notify}:{organizationId:string;contacts:WorkspaceContact[];leads:WorkspaceLead[];onOpenLead:(id:string)=>void;notify:(message:string)=>void}){
  const [items,setItems]=useState<ConversationRow[]>([])
  const [reads,setReads]=useState<ConversationReadRow[]>([])
  const [messages,setMessages]=useState<MessageRow[]>([])
  const [selectedId,setSelectedId]=useState('')
  const [messageLimit,setMessageLimit]=useState(50)
  const [drafts,setDrafts]=useState<Record<string,string>>({})
  const [noteMode,setNoteMode]=useState(false)
  const [query,setQuery]=useState('')
  const [creating,setCreating]=useState(false)
  const [qualifying,setQualifying]=useState(false)
  const [qualification,setQualification]=useState<QualificationResult|null>(null)
  const [mobileThread,setMobileThread]=useState(false)
  const [mobileDetails,setMobileDetails]=useState(false)
  const [sending,setSending]=useState(false)
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const historyRef=useRef<HTMLDivElement>(null)
  const selected=items.find(item=>item.id===selectedId)
  const contact=contacts.find(item=>item.id===selected?.contact_id)
  const lead=leads.find(item=>item.contactId===selected?.contact_id)
  const draftKey=`${selectedId}:${noteMode?'note':'reply'}`
  const draft=drafts[draftKey]??''
  const setDraft=(value:string)=>setDrafts(current=>({...current,[draftKey]:value}))

  const refresh=useCallback(async()=>{
    setError('')
    try{
      const [conversations,nextReads]=await Promise.all([listConversations(organizationId),listConversationReads(organizationId)])
      setItems(conversations);setReads(nextReads)
      setSelectedId(current=>current&&conversations.some(item=>item.id===current)?current:conversations[0]?.id??'')
    }catch(reason){setError(reason instanceof Error?reason.message:'Unable to load Inbox.')}
    finally{setLoading(false)}
  },[organizationId])
  const refreshMessages=useCallback(async()=>{
    if(!selectedId){setMessages([]);return}
    try{setMessages(await listConversationMessages(organizationId,selectedId,messageLimit))}
    catch(reason){setError(reason instanceof Error?reason.message:'Unable to load messages.')}
  },[organizationId,selectedId,messageLimit])
  useEffect(()=>{void refresh()},[refresh])
  useEffect(()=>{void refreshMessages();if(selectedId)void markConversationRead(organizationId,selectedId).then(()=>refresh()).catch(()=>{})},[organizationId,refresh,refreshMessages,selectedId])
  useEffect(()=>{
    if(!supabase)return
    const client=supabase
    const channel=client.channel(`inbox:${organizationId}`)
      .on('postgres_changes',{event:'*',schema:'public',table:'conversations',filter:`organization_id=eq.${organizationId}`},()=>void refresh())
      .on('postgres_changes',{event:'*',schema:'public',table:'messages',filter:`organization_id=eq.${organizationId}`},()=>{void refresh();void refreshMessages()})
      .subscribe()
    return()=>{void client.removeChannel(channel)}
  },[organizationId,refresh,refreshMessages])
  useEffect(()=>{const onBack=()=>{setMobileThread(false);setMobileDetails(false)};window.addEventListener('popstate',onBack);return()=>window.removeEventListener('popstate',onBack)},[])
  useEffect(()=>{if(historyRef.current)historyRef.current.scrollTop=historyRef.current.scrollHeight},[selectedId,messages.length])

  const filtered=useMemo(()=>items.filter(item=>{
    const person=contacts.find(value=>value.id===item.contact_id)
    return `${person?.name??'Unknown'} ${item.channel}`.toLowerCase().includes(query.toLowerCase())
  }),[items,contacts,query])
  const unread=(item:ConversationRow)=>{
    const read=reads.find(value=>value.conversation_id===item.id)?.last_read_at
    return Boolean(item.last_message_at&&(!read||item.last_message_at>read))
  }
  const open=(id:string)=>{setSelectedId(id);setMessageLimit(50);setQualification(null);setNoteMode(false);setMobileThread(true);history.pushState({inbox:id},'','#app')}
  const changeStatus=async(status:ConversationRow['status'])=>{
    if(!selected)return
    try{await setConversationStatus(organizationId,selected.id,status);await refresh()}catch(reason){setError(reason instanceof Error?reason.message:'Unable to update status.')}
  }
  const changeHandling=async(mode:ConversationRow['handling_mode'])=>{
    if(!selected)return
    try{await setConversationHandling(organizationId,selected.id,mode);await refresh();notify(`Conversation is now ${mode.toLowerCase()}-handled`)}catch(reason){setError(reason instanceof Error?reason.message:'Unable to change handling.')}
  }
  const send=async()=>{
    if(!selected||!draft.trim()||sending)return
    const body=draft.trim()
    setSending(true);setError('')
    try{
      if(noteMode)await addConversationNote(organizationId,selected.id,body)
      else{
        if(selected.handling_mode!=='HUMAN')await setConversationHandling(organizationId,selected.id,'HUMAN')
        if(selected.channel==='WHATSAPP')await sendWhatsAppMessage(selected.id,body)
        else await sendConversationMessage(organizationId,selected.id,body)
      }
      setDraft('');await Promise.all([refresh(),refreshMessages()])
      notify(noteMode?'Internal note added':selected.channel==='WHATSAPP'?'Reply sent via WhatsApp':'Internal conversation record saved; no external delivery was attempted')
    }catch(reason){setError(reason instanceof Error?reason.message:'Unable to save message.')}
    finally{setSending(false)}
  }
  const qualify=async()=>{
    if(!selected)return
    setQualifying(true)
    try{setQualification(await qualifyConversation(selected.id));notify('Conversation qualified and lead score updated')}
    catch(reason){setError(reason instanceof Error?reason.message:'Unable to qualify conversation.')}
    finally{setQualifying(false)}
  }

  return <>
    <div className="page-heading"><div><p className="eyebrow">Persistent conversations</p><h1>Inbox</h1><p className="subheading">Customer conversations, notes, and ownership in one workspace.</p></div><button className="btn primary" onClick={()=>setCreating(true)}>＋ New conversation</button></div>
    {error&&<div className="live-inbox-error" role="alert">{error} <button onClick={()=>{void refresh();void refreshMessages()}}>Retry</button></div>}
    <div className={`inbox-layout card live-inbox ${mobileThread?'inbox-thread-open':''} ${mobileDetails?'inbox-details-open':''}`}>
      <div className="conversation-list">
        <div className="inbox-list-head"><strong>Conversations</strong><span>{items.length}</span></div>
        <div className="inbox-search">⌕ <input aria-label="Search inbox" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search people or channels"/></div>
        {loading&&<p className="inbox-empty">Loading conversations…</p>}
        {filtered.map(item=>{
          const person=contacts.find(value=>value.id===item.contact_id)
          return <button className={selectedId===item.id?'conversation selected':'conversation'} key={item.id} onClick={()=>open(item.id)}>
            <div className="conversation-avatar">{initials(person?.name??'?')}</div>
            <div><strong>{person?.name??'Unknown contact'}</strong><small>{item.status.toLowerCase()} · {item.handling_mode.toLowerCase()} handling</small><em>{item.channel}</em></div>
            <span className="conversation-time">{item.last_message_at?new Date(item.last_message_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):'New'}{unread(item)&&<i/>}</span>
          </button>
        })}
        {!loading&&!filtered.length&&<p className="inbox-empty">No conversations found.</p>}
      </div>
      {selected?<div className="conversation-main">
        <div className="conversation-head">
          <button className="inbox-mobile-back" aria-label="Back to conversations" onClick={()=>{setMobileThread(false);setMobileDetails(false)}}>←</button>
          <div className="lead-cell"><div className="lead-avatar">{initials(contact?.name??'?')}</div><div><strong>{contact?.name??'Unknown contact'}</strong><small>{selected.channel} · {selected.status.toLowerCase()}</small></div></div>
          <button className="inbox-mobile-details" onClick={()=>setMobileDetails(true)}>Details</button>
          <div className="live-inbox-header-controls"><select aria-label="Handling mode" value={selected.handling_mode} onChange={event=>void changeHandling(event.target.value as ConversationRow['handling_mode'])}><option value="HUMAN">Human handling</option><option value="AI">AI handling</option><option value="PAUSED">Paused</option></select><select aria-label="Conversation status" value={selected.status} onChange={event=>void changeStatus(event.target.value as ConversationRow['status'])}><option>OPEN</option><option>SNOOZED</option><option>CLOSED</option></select></div>
        </div>
        <div className="message-history" ref={historyRef} role="log" aria-label="Conversation history">
          {messages.length===messageLimit&&<button className="load-older" onClick={()=>setMessageLimit(value=>value+50)}>Load older messages</button>}
          {messages.map((message,index)=><div key={message.id}>
            {(index===0||new Date(message.created_at).toDateString()!==new Date(messages[index-1].created_at).toDateString())&&<div className="live-inbox-date">{new Date(message.created_at).toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'})}</div>}
            <div className={`message ${message.is_internal_note?'internal-note':message.sender_type.toLowerCase()}`}><div className="message-label">{message.is_internal_note?'Internal note':message.sender_type==='AI'?'LeadFlow AI':message.sender_type==='HUMAN'?'Your team':message.sender_type==='SYSTEM'?'System':contact?.name??'Customer'}<span>{new Date(message.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span></div><p>{message.body}</p></div>
          </div>)}
          {!messages.length&&<div className="inbox-empty">Start the conversation below.</div>}
        </div>
        <div className="composer"><div className="live-inbox-modes"><button className={!noteMode?'active':''} onClick={()=>setNoteMode(false)}>Reply</button><button className={noteMode?'active':''} onClick={()=>setNoteMode(true)}>Internal note</button></div><p className="live-inbox-delivery">{noteMode?'Only teammates can see this note. Nothing is sent to the customer.':selected.channel==='WHATSAPP'?'Reply will use the connected WhatsApp channel.':'Internal record only — this channel has no outbound delivery configured.'}</p><MessageComposer id="live-inbox-draft" label={noteMode?'Internal note':'Reply'} value={draft} onChange={setDraft} onSend={()=>void send()} busy={sending} disabled={selected.status==='CLOSED'} action={noteMode?'Add note':selected.channel==='WHATSAPP'?'Send':'Record'} maxLength={noteMode?5000:2000} placeholder={noteMode?'Add context for your team…':'Write a reply…'}/></div>
      </div>:<div className="conversation-main inbox-empty-state"><strong>Select a conversation</strong><p>Choose an existing thread or start a new one.</p></div>}
      <aside className="conversation-context"><div className="context-head"><p className="eyebrow">Customer context</p><button className="inbox-mobile-details-close" onClick={()=>setMobileDetails(false)} aria-label="Close details">×</button></div>{contact?<><div className="context-profile"><div className="large-avatar">{initials(contact.name)}</div><h2>{contact.name}</h2><span>{contact.company||contact.email||'Contact'}</span></div>{lead&&<><div className="context-section"><small>INTEREST</small><strong>{lead.interest}</strong><span>{lead.stage} · {lead.score} score</span></div><div className="context-section"><small>SOURCE</small><strong>{lead.source||'Not recorded'}</strong></div><div className="context-section"><small>NEXT ACTION</small><strong>{lead.nextAction}</strong></div><button className="btn primary context-button" disabled={qualifying||!messages.length} onClick={()=>void qualify()}>{qualifying?'Qualifying…':'Qualify with AI'}</button>{qualification&&<div className="qualification-result"><strong>{qualification.score}/100 · {qualification.nextAction.replaceAll('_',' ')}</strong><p>{qualification.summary}</p><ul>{qualification.scoreReasons.map(reason=><li key={reason}>{reason}</li>)}</ul></div>}<button className="btn secondary context-button" onClick={()=>onOpenLead(lead.id)}>Open full profile →</button></>}</>:<p className="inbox-empty">No contact linked.</p>}</aside>
    </div>
    {creating&&<NewConversation contacts={contacts} onClose={()=>setCreating(false)} onCreate={async(contactId,channel)=>{const created=await createConversation(organizationId,contactId,channel);const linkedLead=leads.find(item=>item.contactId===contactId);if(linkedLead)await runTriggeredAutomations(organizationId,linkedLead.id,'CONVERSATION_STARTED');setCreating(false);await refresh();open(created.id);notify('Conversation created')}}/>}
  </>
}

function NewConversation({contacts,onClose,onCreate}:{contacts:WorkspaceContact[];onClose:()=>void;onCreate:(contactId:string,channel:ConversationRow['channel'])=>Promise<void>}){
  const [contactId,setContactId]=useState(contacts[0]?.id??'')
  const [channel,setChannel]=useState<ConversationRow['channel']>('WEBSITE')
  const [busy,setBusy]=useState(false),[error,setError]=useState('')
  return <dialog ref={element=>{if(element&&!element.open)element.showModal()}} className="crm-dialog compact" aria-labelledby="new-conversation-title" onCancel={onClose}><form onSubmit={event=>{event.preventDefault();setBusy(true);setError('');void onCreate(contactId,channel).catch(reason=>setError(reason instanceof Error?reason.message:'Unable to create conversation.')).finally(()=>setBusy(false))}}><div className="modal-head"><div><p className="eyebrow">Shared inbox</p><h2 id="new-conversation-title">New conversation</h2></div><button type="button" className="close" onClick={onClose}>×</button></div><div className="crm-form-grid"><label>Contact<select value={contactId} onChange={event=>setContactId(event.target.value)} required>{contacts.map(contact=><option key={contact.id} value={contact.id}>{contact.name}</option>)}</select></label><label>Channel<select value={channel} onChange={event=>setChannel(event.target.value as ConversationRow['channel'])}>{channels.map(value=><option key={value}>{value}</option>)}</select></label></div><p className="live-inbox-delivery">Creating a conversation does not connect an external provider. Configure Integrations for outbound delivery.</p>{error&&<p role="alert" className="live-inbox-error">{error}</p>}<div className="modal-actions"><button type="button" className="btn secondary" onClick={onClose}>Cancel</button><button className="btn primary" disabled={!contactId||busy}>{busy?'Creating…':'Create conversation'}</button></div></form></dialog>
}
