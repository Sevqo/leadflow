import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { demoLeads, heroSteps, qualification } from './content'
import { useSequence, useReducedMotion } from './motion'

export function DemoShell({title,children,className=''}:{title:string;children:ReactNode;className?:string}) {
  return <div className={'lf-demo '+className}><div className="lf-demo-bar"><span className="lf-dot-logo" aria-hidden="true">↗</span><strong>{title}</strong><span className="lf-demo-label">SIMULATED DEMO</span></div>{children}</div>
}
export function LeadCardDemo({stage='Qualified',compact=false}:{stage?:string;compact?:boolean}) {
  return <article className={'lf-lead-card '+(compact?'lf-compact':'')}><div className="lf-lead-identity"><span className="lf-avatar">JM</span><div><strong>James Mwangi</strong><small>Website enquiry · Summit Software</small></div><span className="lf-score">86</span></div><h4>CRM for a 25-person team</h4><p>This quarter · KSh 1.2M</p><div className="lf-lead-bottom"><span className="lf-badge">{stage}</span><span>Sarah · next: book demo</span></div></article>
}
function SequenceControls({step,count,choose,replay,playing,toggle,reduced}:{step:number;count:number;choose:(n:number)=>void;replay:()=>void;playing:boolean;toggle:()=>void;reduced:boolean}) {
  return <div className="lf-playback"><button onClick={() => choose(Math.max(0,step-1))} disabled={step===0} aria-label="Previous scene">←</button><span>{String(step+1).padStart(2,'0')} / {String(count).padStart(2,'0')}</span><button onClick={() => choose(Math.min(count-1,step+1))} disabled={step===count-1} aria-label="Next scene">→</button>{!reduced && step<count-1 && <button onClick={toggle}>{playing?'Pause':'Play'}</button>}<button onClick={replay}>Replay</button></div>
}
export function HeroDemo() {
  const scene = useSequence(7,1800)
  const wrap = useRef<HTMLDivElement>(null)
  const frame = useRef(0)
  const pointer = (e:React.PointerEvent<HTMLDivElement>) => {
    if (scene.reduced || e.pointerType!=='mouse' || !matchMedia('(min-width: 900px)').matches) return
    const el=wrap.current; if(!el)return
    const box=el.getBoundingClientRect(), x=(e.clientX-box.left)/box.width-.5,y=(e.clientY-box.top)/box.height-.5
    cancelAnimationFrame(frame.current)
    frame.current=requestAnimationFrame(()=>{el.style.setProperty('--rx',`${-y*3}deg`);el.style.setProperty('--ry',`${x*4}deg`)})
  }
  const reset=()=>{cancelAnimationFrame(frame.current);wrap.current?.style.setProperty('--rx','0deg');wrap.current?.style.setProperty('--ry','0deg')}
  useEffect(()=>()=>cancelAnimationFrame(frame.current),[])
  return <div ref={scene.ref} className="lf-hero-scene"><div ref={wrap} className="lf-perspective" onPointerMove={pointer} onPointerLeave={reset}><DemoShell title="Sevqo Demo / Multi-industry workspace"><div className="lf-hero-demo-grid">
    <section className="lf-conversation-preview"><div className="lf-pane-title"><span className="lf-channel-dot"/>Website / omnichannel scenario <span>10:32</span></div><div className="lf-bubble customer"><small>James Mwangi</small>We need a CRM for our 25-person sales team.</div>
    <div className={'lf-bubble assistant '+(scene.step<1?'lf-concealed':'')}><small>✦ LeadFlow assistant</small>What budget are you considering, and when would you like to move?</div>
    <div className={'lf-bubble customer '+(scene.step<2?'lf-concealed':'')}>KSh 18–22M. In about three months.</div><div className={'lf-handoff '+(scene.step<6?'lf-concealed':'')}>✓ High-intent lead assigned to Sarah.<small>Conversation and qualification included.</small></div></section>
    <section className="lf-record-preview"><div className="lf-pane-title">Opportunity record <span>↗</span></div><div className="lf-qualification-fields">{qualification.slice(0,4).map(([label,value],i)=><div key={label} className={scene.step>=2?'is-filled':''} style={{'--i':i} as CSSProperties}><small>{label}</small><strong>{scene.step>=2?value:'Awaiting answer'}</strong><span aria-hidden="true">{scene.step>=2?'✓':'·'}</span></div>)}</div><div className={'lf-formed-lead '+(scene.step<3?'lf-concealed':'')}><LeadCardDemo stage={scene.step>=4?'Qualified':'New'} compact/></div><div className={'lf-mini-stages '+(scene.step<5?'lf-concealed':'')}><span>New</span><span className="is-current">Qualified · James</span><span>Viewing</span></div></section>
  </div></DemoShell></div><div className="lf-scene-caption"><span key={scene.step}>{heroSteps[scene.step]}</span><SequenceControls step={scene.step} count={7} choose={scene.choose} replay={scene.replay} playing={scene.playing} toggle={()=>scene.setPlaying(!scene.playing)} reduced={scene.reduced}/></div><p className="lf-fine">A fictional SaaS scenario. Scripted responses; no messages are sent.</p></div>
}

const story = [
  ['The problem is what happens next.','A question in WhatsApp. A quote request in email. A form submission nobody has assigned. Each one could be your next customer.'],
  ['Bring every opportunity into one place.','A shared inbox gives every conversation a home, with a source and the context your team needs.'],
  ["Know who’s serious before your team calls.",'Ask for interest, budget, location and timing. Turn the answers into fields your team can act on. Qualification criteria should match how your business sells.'],
  ['A clear next step. A clear owner.','James becomes a qualified opportunity. Sarah receives the conversation, the requirements and a product demo to arrange.'],
]
function TransformScene({step}:{step:number}) {
  return <DemoShell title="From conversation to opportunity" className={'lf-transform-scene lf-transform-'+step}><div className="lf-scattered">
    {["Is this still available?","Can I book a viewing?","I need a quote.","Do you deliver to Nakuru?"].map((text,i)=><div className="lf-message-slip" key={text} style={{'--i':i} as CSSProperties}><small>{['WhatsApp','Website','Email','Instagram'][i]}</small><strong>{text}</strong></div>)}
  </div>{step===1 && <div className="lf-unified-label">4 enquiries → one shared inbox<small>Channels shown conceptually; production connections pending.</small></div>}
  {step>=2 && <div className="lf-transform-record" key={step}>{step===2?<><blockquote>“We use spreadsheets today and want the team live this quarter.”</blockquote><div className="lf-qualification-fields">{qualification.map(([label,value])=><div className="is-filled" key={label}><small>{label}</small><strong>{value}</strong><span>✓</span></div>)}</div></>:<><LeadCardDemo/><div className="lf-handoff">✓ Assigned to Sarah<small>Next action: book product demo.</small></div><p className="lf-fine">Score 86 is illustrative, based on this demo’s completed fields and stated intent. It is not a prediction of purchase.</p></>}</div>}</DemoShell>
}
export function TransformationStory() {
  const [active,setActive]=useState(0)
  const root=useRef<HTMLDivElement>(null)
  const reduced=useReducedMotion()
  useEffect(()=>{
    if(reduced)return
    const desktop=matchMedia('(min-width: 901px)')
    const observer=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting)setActive(Number((e.target as HTMLElement).dataset.step))}),{rootMargin:'-35% 0px -40% 0px',threshold:0})
    const update=()=>{observer.disconnect();if(desktop.matches)root.current?.querySelectorAll('[data-step]').forEach(el=>observer.observe(el))}
    update();desktop.addEventListener('change',update)
    return()=>{observer.disconnect();desktop.removeEventListener('change',update)}
  },[reduced])
  return <section id="product" className="lf-section lf-story-section"><div className="lf-section-heading" data-enter><p className="lf-kicker">01 / The opportunity hiding in your inbox</p><h2>Your customers are<br/>already talking to you.</h2></div><div ref={root} className="lf-sticky-story"><div>{story.map(([title,copy],i)=><article className="lf-story-chapter" data-step={i} id={'chapter-'+i} key={title}><span className="lf-chapter-number">0{i+1}</span><h3>{title}</h3><p>{copy}</p><div className="lf-mobile-scene"><TransformScene step={i}/></div></article>)}</div><aside className="lf-sticky-visual"><div className="lf-story-dots" aria-label="Story chapters">{story.map(([title],i)=><a key={title} href={'#chapter-'+i} aria-current={active===i?'step':undefined} onClick={()=>setActive(i)} aria-label={title}>0{i+1}</a>)}</div><TransformScene step={active}/></aside></div></section>
}

const answers = [
  ["We need software for our sales team.","How large is the team, which tools do you use today, and when do you plan to implement?","Collect use case, team size and timeline"],
  ['How much does this cost?',"I don’t have a verified price for that scope yet. I can capture your requirements and ask the right specialist to prepare one.","Ask for clarification; never invent a price"],
  ['Can I speak to someone?',"Of course. I’ll pass your enquiry and the details you’ve shared to a member of the team.","Escalate to a person"],
]
export function AssistantDemo() {
  const [selected,setSelected]=useState(0)
  return <DemoShell title="AI Assistant / Test playground"><div className="lf-assistant-grid"><aside><p className="lf-pane-title">Business knowledge</p>{['Products & services','Approved FAQs','Industry qualification','Business hours','Tone & handoff rules'].map(text=><div className="lf-knowledge-row" key={text}><span>✓</span>{text}</div>)}<p className="lf-fine">Any business model<br/>Professional, helpful, concise.</p></aside><div className="lf-assistant-chat"><p className="lf-fine">Choose a question · scripted demonstration</p><div className="lf-question-options">{answers.map(([q],i)=><button key={q} aria-pressed={selected===i} onClick={()=>setSelected(i)}>{q}</button>)}</div><div key={selected} className="lf-answer"><div className="lf-bubble customer">{answers[selected][0]}</div><div className="lf-bubble assistant"><small>✦ LeadFlow assistant</small>{answers[selected][1]}</div><p className="lf-next-action">→ {answers[selected][2]}</p></div></div></div></DemoShell>
}

export function CRMDemo() {
  const [filter,setFilter]=useState(false),[assigned,setAssigned]=useState(false),[added,setAdded]=useState(false)
  const records=demoLeads.filter(l=>!filter||l.stage==='Qualified')
  return <DemoShell title="Leads / Multi-industry workspace"><div className="lf-demo-toolbar"><button className={filter?'is-selected':''} aria-pressed={filter} onClick={()=>setFilter(!filter)}>Qualified only {filter?'✓':'↓'}</button><button disabled={added} onClick={()=>setAdded(true)}>{added?'Sample lead added ✓':'+ Add sample lead'}</button><span>Try filtering and assigning</span></div><div className="lf-crm-table"><table><caption className="lf-sr-only">Fictional multi-industry leads</caption><thead><tr>{['Lead','Interest','Source','Status','Owner','Score'].map(v=><th key={v}>{v}</th>)}</tr></thead><tbody>{added&&<tr className="lf-new-row"><td>Demo enquiry</td><td>Healthcare appointment</td><td>Instagram</td><td><span className="lf-badge">Qualified</span></td><td>Sarah</td><td>80</td></tr>}{records.map((l,i)=><tr key={l.name}><td><strong>{l.name}</strong></td><td>{l.interest}</td><td>{l.source}</td><td><span className="lf-badge">{l.stage}</span></td><td>{i===0?<button onClick={()=>setAssigned(!assigned)}>{assigned?'Sarah ✓':'Assign to Sarah'}</button>:l.owner}</td><td>{l.score}</td></tr>)}</tbody></table></div><div className="lf-demo-footnote">Local demo only · changes do not enter your workspace.</div></DemoShell>
}

const pipelineStages=['New','Qualified','Contacted','Meeting','Negotiation','Won']
export function PipelineDemo(){
  const s=useSequence(3,2400),stage=[0,1,3][s.step]
  return <div ref={s.ref}><DemoShell title="Pipeline / Every industry, one workflow"><div className="lf-pipeline"><div className="lf-pipeline-heads">{pipelineStages.map((name,i)=><div key={name} className={stage===i?'is-current':''}><span/> {name}</div>)}</div><div className="lf-pipeline-track"><div className="lf-moving-deal" style={{'--column':stage} as CSSProperties}><span className="lf-avatar">JM</span><strong>James Mwangi</strong><p>SaaS · CRM rollout</p><span className="lf-badge">{pipelineStages[stage]}</span><small>Sarah · book demo</small></div><div className="lf-static-deal" style={{'--column':2} as CSSProperties}><span className="lf-avatar">AN</span><strong>Aisha Njeri</strong><p>Insurance · fleet cover</p><span className="lf-badge">Contacted</span><small>Sarah · collect vehicle list</small></div><div className="lf-static-deal" style={{'--column':5} as CSSProperties}><span className="lf-avatar">BO</span><strong>Brian Otieno</strong><p>Logistics · regional route</p><span className="lf-badge">Won</span><small>David · complete handover</small></div></div></div><div className="lf-pipeline-mobile"><LeadCardDemo stage={pipelineStages[stage]}/></div></DemoShell><div className="lf-scene-caption"><span>Different businesses, the same accountable next step.</span><SequenceControls step={s.step} count={3} choose={s.choose} replay={s.replay} playing={s.playing} toggle={()=>s.setPlaying(!s.playing)} reduced={s.reduced}/></div></div>
}
const automationNodes=['New lead','Qualified','Wait 2 hours','No response?','Send follow-up','Notify sales rep']
const times=['10:32','10:33','10:34','12:34','12:35','12:36']
const events=['Customer enquires','AI qualifies the customer','Lead assigned to Sarah','No salesperson response detected','Follow-up sent in this scenario','Customer replies; Sarah notified']
export function AutomationDemo(){
  const s=useSequence(6,1800)
  return <div ref={s.ref} className="lf-automation-demo"><DemoShell title="Automations / Follow-up rule"><ol className="lf-automation-path">{automationNodes.map((node,i)=><li key={node} className={s.step>=i?'is-active':''}><span>{s.step>i?'✓':String(i+1).padStart(2,'0')}</span><strong>{node}</strong>{i===3&&<small>Yes → continue</small>}</li>)}</ol></DemoShell><div className="lf-timeline" aria-label="Illustrative follow-up timeline">{events.map((event,i)=><div key={event} className={s.step>=i?'is-active':''}><time>{times[i]}</time><span/><p>{event}</p></div>)}</div><div className="lf-scene-caption"><span>Simulated times · no messages sent.</span><SequenceControls step={s.step} count={6} choose={s.choose} replay={s.replay} playing={s.playing} toggle={()=>s.setPlaying(!s.playing)} reduced={s.reduced}/></div></div>
}

const inboxExamples = {
  WhatsApp:{name:'James Mwangi',message:'Can your CRM support our 25-person sales team?',answer:'Yes. Which tools do you use today, and when would you like to launch?',context:'SaaS · implementation this quarter'},
  Website:{name:'Aisha Njeri',message:'We need cover for a 12-vehicle fleet.',answer:'When does the current cover renew, and which vehicle classes are included?',context:'Insurance · fleet renewal'},
  Email:{name:'Brian Otieno',message:'Can you quote a weekly Nairobi–Kampala route?',answer:'What cargo, shipment volume and service level should the team price?',context:'Logistics · regional contract'},
}
export function InboxDemo(){
  const [channel,setChannel]=useState<keyof typeof inboxExamples>('WhatsApp'),[human,setHuman]=useState(false)
  const item=inboxExamples[channel]
  return <DemoShell title="Inbox / All conversations"><div className="lf-inbox-demo"><aside aria-label="Demo channels">{(Object.keys(inboxExamples) as (keyof typeof inboxExamples)[]).map(c=><button key={c} aria-pressed={channel===c} onClick={()=>{setChannel(c);setHuman(false)}}><span className="lf-channel-dot"/>{c}<small>{inboxExamples[c].name}</small></button>)}</aside><section><div className="lf-pane-title">{item.name}<span>{channel}</span></div><div className="lf-bubble customer">{item.message}</div><div className="lf-bubble assistant"><small>{human?'Sarah · Human agent':'✦ LeadFlow assistant'}</small>{human?'Thanks for the context. I’ll help you with the next step personally.':item.answer}</div><button className="lf-button lf-small" onClick={()=>setHuman(!human)}>{human?'Return to AI demo':'Take over conversation'}</button></section><div className="lf-inbox-context"><p className="lf-kicker">Lead context</p><strong>{item.name}</strong><p>{item.context}</p><span className="lf-badge">{human?'Sarah is handling this':'AI qualification'}</span><p className="lf-fine">The handoff keeps conversation history and qualification together.</p></div></div></DemoShell>
}
