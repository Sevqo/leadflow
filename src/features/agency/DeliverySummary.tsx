import type {AgencyApprovalRequestRow,AgencyClientRow,AgencyProjectRow,ClientSystemRow} from '../../types/database'

type SummaryData={clients:AgencyClientRow[];projects:AgencyProjectRow[];systems:ClientSystemRow[];approvals:AgencyApprovalRequestRow[]}
export function DeliverySummary({area,data}:{area:'Clients'|'Projects'|'Systems'|'Approvals';data:SummaryData}){
  const cards=area==='Clients'?
    [['Active clients',data.clients.filter(item=>item.status==='ACTIVE').length],['Onboarding',data.clients.filter(item=>item.status==='ONBOARDING').length],['Paused',data.clients.filter(item=>item.status==='PAUSED').length]]:
    area==='Projects'?
    [['Active projects',data.projects.filter(item=>item.status==='ACTIVE').length],['Blocked',data.projects.filter(item=>item.status==='BLOCKED').length],['Overdue or due in 7 days',data.projects.filter(item=>item.status!=='COMPLETE'&&item.status!=='ARCHIVED'&&item.due_at&&new Date(item.due_at).getTime()<=Date.now()+7*86400000).length]]:
    area==='Systems'?
    [['Active systems',data.systems.filter(item=>item.status==='ACTIVE').length],['Setup required',data.systems.filter(item=>item.status==='SETUP_REQUIRED').length],['Error',data.systems.filter(item=>item.status==='ERROR').length]]:
    [['Pending review',data.approvals.filter(item=>item.status==='PENDING').length],['Approved',data.approvals.filter(item=>item.status==='APPROVED').length],['Rejected',data.approvals.filter(item=>item.status==='REJECTED').length]]
  return <div className="agency-summary" aria-label={`${area} summary`}>{cards.map(([label,value])=><div className="card" key={label}><small>{label}</small><strong>{value}</strong></div>)}</div>
}
