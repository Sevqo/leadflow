import {useEffect,useState} from 'react'
import {supabase} from '../../lib/supabase'

export function useTeamChatUnread(organizationId:string|undefined,userId:string|undefined,enabled:boolean,viewing:boolean){
  const [unread,setUnread]=useState(0)
  useEffect(()=>{
    if(!enabled||!organizationId||!userId||!supabase){setUnread(0);return}
    if(viewing){setUnread(0);return}
    const client=supabase
    let cancelled=false
    const refresh=async()=>{
      const {data:receipt,error}=await client.from('team_chat_reads').select('last_read_at').eq('organization_id',organizationId).eq('user_id',userId).maybeSingle()
      if(error||cancelled)return
      let query=client.from('team_messages').select('id',{count:'exact',head:true}).eq('organization_id',organizationId).neq('sender_id',userId)
      if(receipt?.last_read_at)query=query.gt('created_at',receipt.last_read_at)
      const result=await query
      if(!cancelled&&!result.error)setUnread(result.count??0)
    }
    void refresh()
    const channel=client.channel(`team-chat-unread:${organizationId}:${userId}`)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'team_messages',filter:`organization_id=eq.${organizationId}`},()=>void refresh()).subscribe()
    return()=>{cancelled=true;void client.removeChannel(channel)}
  },[organizationId,userId,enabled,viewing])
  return unread
}
