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
      const {data,error}=await client.rpc('team_room_unread_counts',{target_org:organizationId})
      if(!cancelled&&!error)setUnread((data??[]).reduce((sum,item)=>sum+Number(item.unread_count),0))
    }
    void refresh()
    const channel=client.channel(`team-chat-unread:${organizationId}:${userId}`)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'team_messages',filter:`organization_id=eq.${organizationId}`},()=>void refresh()).subscribe()
    return()=>{cancelled=true;void client.removeChannel(channel)}
  },[organizationId,userId,enabled,viewing])
  return unread
}
