import {expect,test} from '@playwright/test'
import {readFile} from 'node:fs/promises'
import {resolve} from 'node:path'

test.beforeEach(async({page})=>{
  await page.goto('/#app')
  await page.evaluate(()=>{sessionStorage.setItem('nexara-demo-mode','true');localStorage.removeItem('leadflow-demo-team-chat-v1')})
  await page.reload()
})

test('workspace members have a separate persistent team conversation',async({page})=>{
  await page.locator('.sidebar nav').getByRole('button',{name:'Team Chat'}).click()
  await expect(page.getByRole('heading',{name:'Team Chat'})).toBeVisible()
  await expect(page.locator('.team-chat-scroll')).toContainText('Sarah Njeri')
  await page.getByLabel('Message your team').fill('Please review the campaign handoff.')
  await page.getByRole('button',{name:'Send message'}).click()
  await expect(page.locator('.team-chat-scroll')).toContainText('Please review the campaign handoff.')
  await page.reload()
  await page.locator('.sidebar nav').getByRole('button',{name:'Team Chat'}).click()
  await expect(page.locator('.team-chat-scroll')).toContainText('Please review the campaign handoff.')
  await page.getByLabel('Search team messages').fill('handoff')
  await expect(page.locator('.team-chat-message')).toHaveCount(1)
})

test('team chat remains usable on a phone',async({page})=>{
  await page.setViewportSize({width:390,height:620})
  await page.getByRole('button',{name:'Open navigation'}).click()
  await page.locator('.sidebar nav').getByRole('button',{name:'Team Chat'}).click()
  await expect(page.getByLabel('Message your team')).toBeVisible()
  await page.getByLabel('Message your team').fill('Mobile update')
  await page.getByLabel('Message your team').press('Enter')
  await expect(page.locator('.team-chat-scroll')).toContainText('Mobile update')
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
})

test('team chat migration requires membership and keeps writes server controlled',async()=>{
  const root=resolve(import.meta.dirname,'..')
  const sql=await readFile(resolve(root,'supabase/migrations/0020_team_chat.sql'),'utf8')
  expect(sql).toContain('alter table public.team_messages enable row level security')
  expect(sql).toContain('alter table public.team_chat_reads enable row level security')
  expect(sql).toContain('using (public.is_org_member(organization_id))')
  expect(sql).toContain('if auth.uid() is null or not public.is_org_member(target_org)')
  expect(sql).toContain('revoke all on public.team_messages, public.team_chat_reads from anon, authenticated')
  expect(sql).toContain('grant select on public.team_messages to authenticated')
  expect(sql).toContain('grant execute on function public.send_team_message(uuid, text) to authenticated')
})
