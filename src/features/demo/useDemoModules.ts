import {useEffect,useState} from 'react'

export type DemoMessage={id:string;from:'customer'|'ai'|'human'|'note';text:string;at:string}
export type DemoConversation={id:string;contactId:string;channel:string;status:'OPEN'|'CLOSED';humanTakeover:boolean;messages:DemoMessage[]}
export type DemoKnowledge={id:string;title:string;type:'FAQ'|'PRODUCT'|'SERVICE'|'POLICY'|'GENERAL';content:string;status:'ACTIVE'|'DRAFT'}
export type AutomationCondition={type:'score_gte'|'stage_is'|'source_is'|'owner_unassigned';value?:string|number}
export type AutomationAction={type:'notify_owner'|'create_task'|'set_stage'|'advance_stage'|'assign_owner';title?:string;delayHours?:number;stage?:string;ownerId?:string}
export type DemoAutomation={id:string;name:string;status:'ACTIVE'|'PAUSED';trigger:string;conditions:AutomationCondition[];actions:AutomationAction[]}
export type DemoRun={id:string;automationId:string;leadName:string;status:'SUCCEEDED'|'SKIPPED';at:string;detail:string}
export type DemoModulesState={conversations:DemoConversation[];knowledge:DemoKnowledge[];automations:DemoAutomation[];runs:DemoRun[];assistant:{name:string;welcome:string;tone:string;questions:string[];enabled:boolean};settings:{name:string;username:string;industry:string;website:string;phone:string;timezone:string}}

const key='nexara-demo-modules-v1'
const at='2026-09-23T10:45:00.000Z'
const seed:DemoModulesState={
  conversations:[
    {id:'demo-conversation-james',contactId:'contact-lead-james',channel:'Website',status:'OPEN',humanTakeover:false,messages:[{id:'j1',from:'customer',text:'We need a CRM for a 25-person sales team.',at},{id:'j2',from:'ai',text:'Which tools do you use today, and when would you like to roll out?',at},{id:'j3',from:'customer',text:'We use spreadsheets and email and want to launch this quarter.',at}]},
    {id:'demo-conversation-aisha',contactId:'contact-lead-aisha',channel:'WhatsApp',status:'OPEN',humanTakeover:false,messages:[{id:'a1',from:'customer',text:'Can I schedule a viewing?',at}]},
    {id:'demo-conversation-brian',contactId:'contact-lead-brian',channel:'Referral',status:'CLOSED',humanTakeover:true,messages:[{id:'b1',from:'customer',text:'Thanks for the details.',at}]},
  ],
  knowledge:[{id:'k1',title:'Growth CRM package',type:'PRODUCT',content:'Lead capture, shared pipeline, automation and analytics for growing teams.',status:'ACTIVE'},{id:'k2',title:'Implementation FAQ',type:'FAQ',content:'Implementation starts with customer sources, qualification fields and team ownership rules.',status:'ACTIVE'},{id:'k3',title:'About LeadFlow Demo Agency',type:'GENERAL',content:'A fictional multi-industry agency used to demonstrate LeadFlow.',status:'ACTIVE'}],
  automations:[],runs:[],
  assistant:{name:'LeadFlow Concierge',welcome:'Hi there! How can I help you today?',tone:'Friendly',questions:['What are you interested in?','What budget range should we consider?','When do you plan to purchase?'],enabled:false},
  settings:{name:'LeadFlow Demo Agency',username:'cyprian',industry:'Professional Services',website:'https://demo.example.com',phone:'+254 700 000 000',timezone:'Africa/Nairobi'},
}
function read():DemoModulesState{try{const value=JSON.parse(localStorage.getItem(key)??'null') as DemoModulesState|null;return value?.conversations&&value.knowledge&&value.automations&&value.assistant&&value.settings?{...value,settings:{...value.settings,username:value.settings.username??seed.settings.username},automations:value.automations.map(item=>{const legacy=item as DemoAutomation&{minimum?:number;action?:AutomationAction['type'];delayHours?:number};return {...item,trigger:item.trigger??'LEAD_CREATED',conditions:item.conditions??[{type:'score_gte',value:legacy.minimum??70}],actions:item.actions??[{type:legacy.action??'notify_owner',delayHours:legacy.delayHours??24,title:item.name}]}})}:seed}catch{return seed}}
export function useDemoModules(){const [state,setState]=useState<DemoModulesState>(read);useEffect(()=>{localStorage.setItem(key,JSON.stringify(state))},[state]);return {state,update:(change:(current:DemoModulesState)=>DemoModulesState)=>setState(current=>{const next=change(current);localStorage.setItem(key,JSON.stringify(next));return next})}}
export const demoId=()=>crypto.randomUUID()
