import type {LeadDraft,WorkspaceLead} from './types'

export type ScoreFactor={label:string;points:number;reason:string}
export function scoreLead(lead:Partial<LeadDraft|WorkspaceLead>){
  const factors:ScoreFactor[]=[]
  const add=(label:string,points:number,reason:string)=>factors.push({label,points,reason})
  if(lead.email||lead.phone)add('Contactability',15,'Email or phone is available')
  if(lead.interest?.trim())add('Stated interest',20,'A specific need has been recorded')
  if(lead.value&&lead.value!=='Not set')add('Budget/value',20,'A budget or opportunity value is known')
  const fields=lead.customFields??{}
  if(Object.keys(fields).length)add('Qualification',Math.min(20,Object.keys(fields).length*7),'Qualification details are complete')
  if(lead.nextAction&&lead.nextAction!=='Make first contact')add('Next step',10,'A concrete next action is planned')
  if(lead.source&&lead.source!=='Manual')add('Inbound intent',10,`The lead arrived from ${lead.source}`)
  if(lead.owner&&lead.owner!=='Unassigned')add('Ownership',5,'A team member owns the follow-up')
  return {score:Math.min(100,factors.reduce((sum,factor)=>sum+factor.points,0)),factors}
}

export function buildLeadBrief(lead:WorkspaceLead){
  const risks:string[]=[]
  if(!lead.email&&!lead.phone)risks.push('No direct contact method is recorded')
  if(!lead.ownerId||lead.owner==='Unassigned')risks.push('No teammate owns the opportunity')
  if(!lead.value||lead.value==='Not set')risks.push('Opportunity value is still unknown')
  if(!lead.nextAction||lead.nextAction==='Make first contact')risks.push('The next step needs to be made specific')
  const readiness=lead.score>=75?'High intent':lead.score>=50?'Developing':'Early stage'
  const recommended=lead.stage==='Won'?'Begin customer handoff and onboarding':lead.stage==='Lost'?'Record the loss reason and schedule future nurture':!lead.ownerId||lead.owner==='Unassigned'?'Assign an owner before the next touch':!lead.email&&!lead.phone?'Capture a verified email address or phone number':lead.nextAction||'Schedule the next customer action'
  return {readiness,risks,recommended,summary:`${lead.name} is a ${readiness.toLowerCase()} ${lead.interest.toLowerCase()} opportunity from ${lead.source}. The record is currently in ${lead.stage.toLowerCase()} with a score of ${lead.score}/100.`}
}
