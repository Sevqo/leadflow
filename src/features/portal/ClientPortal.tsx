import {useEffect,useState} from 'react'
import {requireSupabase} from '../../services/api'
import {signIn,signOut} from '../../services/auth'

type PortalAccount={client_id:string;client_name:string}
type PortalUpdate={update_id:string;client_id:string;title:string;body:string;published_at:string}

export function ClientPortal({userId,loading}:{userId?:string;loading:boolean}){
  const [email,setEmail]=useState(''),[password,setPassword]=useState('')
  const [busy,setBusy]=useState(false),[loadingUpdates,setLoadingUpdates]=useState(false),[error,setError]=useState('')
  const [accounts,setAccounts]=useState<PortalAccount[]>([]),[updates,setUpdates]=useState<PortalUpdate[]>([]),[selected,setSelected]=useState('')

  useEffect(()=>{
    if(!userId){setAccounts([]);setSelected('');setUpdates([]);return}
    let cancelled=false
    const load=async()=>{
      setBusy(true);setError('')
      try{
        const {data,error:loadError}=await requireSupabase().rpc('list_my_client_portal_accounts',{})
        if(loadError)throw loadError
        if(!cancelled){const next=data??[];setAccounts(next);setSelected(current=>next.some(item=>item.client_id===current)?current:next[0]?.client_id??'')}
      }catch(reason){if(!cancelled)setError(reason instanceof Error?reason.message:'Unable to load client accounts.')}
      finally{if(!cancelled)setBusy(false)}
    }
    void load()
    return()=>{cancelled=true}
  },[userId])

  useEffect(()=>{
    if(!userId||!selected){setUpdates([]);return}
    let cancelled=false
    const load=async()=>{
      setLoadingUpdates(true);setUpdates([]);setError('')
      try{
        const {data,error:loadError}=await requireSupabase().rpc('list_my_client_portal_updates',{target_client:selected})
        if(loadError)throw loadError
        if(!cancelled)setUpdates(data??[])
      }catch(reason){if(!cancelled)setError(reason instanceof Error?reason.message:'Unable to load published updates.')}
      finally{if(!cancelled)setLoadingUpdates(false)}
    }
    void load()
    return()=>{cancelled=true}
  },[userId,selected])

  if(loading)return <div className="session-gate"><h1>Opening client portal</h1><p>Checking your session…</p></div>
  return <div className="portal-page">
    <header><a href="/">Sevqo <span>Client portal</span></a>{userId&&<button className="btn secondary" onClick={()=>void signOut()}>Sign out</button>}</header>
    <main className="portal-main">
      <p className="eyebrow">Client access</p><h1>Your project updates, in one place.</h1>
      <p>Only updates deliberately published to your client account appear here. Internal notes, costs, team chat, and other clients are never shared.</p>
      {error&&<p role="alert" className="agency-error">{error}</p>}
      {!userId?<form className="card portal-login" onSubmit={event=>{event.preventDefault();setBusy(true);setError('');void signIn(email,password).then(result=>{if(!result.ok)setError(result.message)}).finally(()=>setBusy(false))}}>
        <h2>Sign in</h2><label>Email<input type="email" autoComplete="email" value={email} onChange={event=>setEmail(event.target.value)} required/></label>
        <label>Password<input type="password" autoComplete="current-password" value={password} onChange={event=>setPassword(event.target.value)} required/></label>
        <button className="btn primary" disabled={busy}>{busy?'Signing in…':'Sign in'}</button>
      </form>:busy?<p role="status">Loading your accounts…</p>:accounts.length?<>
        <label className="portal-select">Client account<select value={selected} onChange={event=>setSelected(event.target.value)}>{accounts.map(item=><option key={item.client_id} value={item.client_id}>{item.client_name}</option>)}</select></label>
        <div className="portal-updates">{loadingUpdates?<p role="status">Loading published updates…</p>:<>{updates.map(item=><article className="card" key={item.update_id}><small>{new Date(item.published_at).toLocaleDateString()}</small><h2>{item.title}</h2><p>{item.body}</p></article>)}{!updates.length&&!error&&<div className="card portal-empty">No updates have been published to this account yet.</div>}</>}</div>
      </>:<div className="card portal-empty">Your account does not have client-portal access yet. Ask your Sevqo account manager to grant access.</div>}
    </main>
  </div>
}
