import {expect,test} from '@playwright/test'

test.beforeEach(async({page})=>{
  await page.goto('/#app')
  await page.evaluate(()=>{sessionStorage.setItem('nexara-demo-mode','true');localStorage.removeItem('nexara-demo-modules-v1');localStorage.removeItem('nexara-demo-workspace-v2')})
  await page.reload()
})

test('contextual Help gives searchable steps and routes to the module',async({page})=>{
  await page.locator('.sidebar nav').getByRole('button',{name:'Automations'}).click()
  await page.getByRole('button',{name:'Help with Automations'}).click()
  await expect(page.getByRole('heading',{name:'Build and safely launch a workflow'})).toBeVisible()
  await expect(page.getByText('How to know it worked')).toBeVisible()
  await page.getByRole('searchbox',{name:'Search guides'}).fill('forecast')
  await expect(page.locator('.help-topic-list')).toContainText('performance report')
  await page.getByRole('button',{name:/Read a trustworthy performance report/}).click()
  await page.getByRole('button',{name:'Open Analytics'}).click()
  await expect(page.getByRole('heading',{name:'Understand your opportunities.'})).toBeVisible()
})

test('analytics exposes a dated trend, quality filters, and method',async({page})=>{
  await page.locator('.sidebar nav').getByRole('button',{name:'Analytics'}).click()
  await expect(page.getByRole('heading',{name:'Lead acquisition trend'})).toBeVisible()
  await expect(page.getByRole('img',{name:/bar chart.*leads created in the selected period/i})).toBeVisible()
  await page.getByRole('button',{name:'Line',exact:true}).click()
  await expect(page.getByRole('img',{name:/line chart.*leads created in the selected period/i})).toBeVisible()
  await page.getByRole('button',{name:/Missing deal value/}).click()
  await expect(page.getByRole('button',{name:/Missing deal value/})).toHaveAttribute('aria-pressed','true')
  await page.getByText('How these numbers are calculated').click()
  await expect(page.getByText(/Weighted forecast applies a fixed probability/)).toBeVisible()
})

test('mobile analytics keeps all report tabs usable and shows ad attribution',async({page})=>{
  await page.setViewportSize({width:390,height:620})
  await page.locator('.mobile-nav-toggle').click()
  await page.locator('.sidebar nav').getByRole('button',{name:'Analytics'}).click()
  const tabs=page.getByRole('tablist',{name:'Analytics reports'})
  await expect(tabs.getByRole('tab')).toHaveCount(3)
  const fits=await tabs.evaluate(element=>element.scrollWidth<=element.clientWidth+1)
  expect(fits).toBe(true)
  await tabs.getByRole('tab',{name:'Acquisition & funnel'}).click()
  await expect(page.getByRole('heading',{name:'Campaign performance'})).toBeVisible()
  await expect(page.getByRole('heading',{name:'Ad performance'})).toBeVisible()
  await page.getByLabel('Campaign',{exact:true}).selectOption({label:'September homes · WhatsApp · demo-campaign-1'})
  await page.getByLabel('Ad',{exact:true}).selectOption({label:'Lavington homes · WhatsApp · demo-ad-1'})
  await expect(page.locator('.report-table').last()).toContainText('Aisha Njeri')
})

test('lead profile identifies the campaign and ad that supplied a lead',async({page})=>{
  await page.locator('.sidebar nav').getByRole('button',{name:'Leads'}).click()
  await page.getByRole('button',{name:/Aisha Njeri/}).first().click()
  const profile=page.getByRole('dialog',{name:'Aisha Njeri'})
  await expect(profile.getByRole('heading',{name:'Acquisition provenance'})).toBeVisible()
  await expect(profile).toContainText('September homes')
  await expect(profile).toContainText('Lavington homes')
})

test('workflow preflight blocks invalid actions and previews unsaved builder safely',async({page})=>{
  await page.locator('.sidebar nav').getByRole('button',{name:'Automations'}).click()
  await page.getByLabel('Workflow action').selectOption('create_task')
  await page.getByLabel('Task title').fill('')
  await expect(page.getByRole('button',{name:'Save and activate'})).toBeDisabled()
  await expect(page.locator('.preflight-state')).toContainText('provide a task title')
  await page.getByLabel('Task title').fill('Call this lead')
  await page.getByLabel('Test lead').selectOption('lead-james')
  await page.getByRole('button',{name:'Preview builder on selected lead'}).click()
  await expect(page.locator('.automation-side')).toContainText('No customer data changed')
  await expect(page.locator('.automation-catalog')).not.toContainText('High intent follow-up')
})
