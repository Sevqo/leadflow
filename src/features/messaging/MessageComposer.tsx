import type {KeyboardEvent} from 'react'

export function MessageComposer({id,label,value,onChange,onSend,disabled=false,busy=false,placeholder='Write a message…',action='Send',maxLength=2000}:{id:string;label:string;value:string;onChange:(value:string)=>void;onSend:()=>void;disabled?:boolean;busy?:boolean;placeholder?:string;action?:string;maxLength?:number}){
  const onKeyDown=(event:KeyboardEvent<HTMLTextAreaElement>)=>{
    if(event.key==='Enter'&&!event.shiftKey&&!event.nativeEvent.isComposing){event.preventDefault();if(!disabled&&!busy&&value.trim())onSend()}
  }
  return <div className="shared-message-composer"><label htmlFor={id}>{label}</label><div><textarea id={id} value={value} onChange={event=>onChange(event.target.value)} onKeyDown={onKeyDown} disabled={disabled||busy} maxLength={maxLength} rows={2} placeholder={placeholder}/><button type="button" disabled={disabled||busy||!value.trim()} onClick={onSend} aria-label={action==='Send'?'Send message':action}>{busy?'Sending…':action}</button></div></div>
}
