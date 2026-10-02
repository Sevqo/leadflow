import {expect,test} from '@playwright/test'

test.beforeEach(async({page})=>{await page.goto('/#app');await page.evaluate(()=>{sessionStorage.setItem('nexara-demo-mode','true');localStorage.removeItem('nexara-demo-modules-v1');localStorage.removeItem('nexara-demo-widget');localStorage.removeItem('nexara-setup-dismissed:demo')});await page.reload()})

test('setup checklist and quick actions lead to real workflows',async({page})=>{
  await expect(page.getByRole('heading',{name:'Finish your workspace'})).toBeVisible()
  await page.getByRole('button',{name:'New',exact:true}).click()
  await page.getByRole('dialog',{name:'Quick actions'}).getByRole('button',{name:/New lead/}).click()
  await expect(page.getByRole('dialog',{name:/Add a lead/})).toBeVisible()
})

test('lead scoring explains and applies a calculated score',async({page})=>{
  await page.locator('.sidebar nav').getByRole('button',{name:'Leads'}).click()
  await page.getByRole('button',{name:/James Mwangi/}).first().click()
  await expect(page.getByRole('heading',{name:'Why this score?'})).toBeVisible()
  await expect(page.locator('.score-factor')).toHaveCount(7)
})

test('widget builder saves branding, origins and exposes an embed snippet',async({page})=>{
  await page.locator('.sidebar nav').getByRole('button',{name:'Integrations'}).click()
  await page.getByLabel('Assistant name').fill('Acacia Concierge')
  await page.getByPlaceholder('https://yourbusiness.com').fill('https://acacia.example')
  await page.getByRole('button',{name:'Add',exact:true}).click()
  await page.getByRole('button',{name:'Save widget'}).click()
  await expect(page.getByText('https://acacia.example ×')).toBeVisible()
  await expect(page.getByLabel('Install snippet')).toContainText('data-widget-key')
})

test('automations support event triggers and workflow duplication',async({page})=>{
  await page.locator('.sidebar nav').getByRole('button',{name:'Automations'}).click()
  await page.getByLabel('Workflow trigger').selectOption('STAGE_CHANGED')
  await page.getByRole('button',{name:'Save and activate'}).click()
  await expect(page.locator('.automation-catalog')).toContainText('Pipeline stage changed')
  await page.getByRole('button',{name:'Duplicate'}).click()
  await expect(page.locator('.automation-catalog')).toContainText('High intent follow-up copy')
})

test('advanced analytics provides date filtering',async({page})=>{
  await page.locator('.sidebar nav').getByRole('button',{name:'Analytics'}).click()
  await page.getByLabel('Analytics date range').selectOption('3650')
  await expect(page.getByText('Average score')).toBeVisible()
})
