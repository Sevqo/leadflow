import { test, expect } from '@playwright/test'

for (const width of [1440, 1280, 1024, 768, 430, 390]) {
  test(`complete responsive journey at ${width}px`, async ({ page }, info) => {
    const errors: string[] = []
    page.on('pageerror', e => errors.push(e.message))
    page.on('console', e => { if (e.type() === 'error') errors.push(e.text()) })
    await page.setViewportSize({ width, height: 1000 })
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Turn conversations into customers.' })).toBeVisible()
    await page.screenshot({ path: info.outputPath('hero.png'), animations: 'disabled' })
    // Walk the whole page, including below-fold pricing, before capturing long sections.
    // A full-page screenshot alone does not activate IntersectionObserver reveals.
    for (const reveal of await page.locator('[data-enter]').all()) {
      await reveal.scrollIntoViewIfNeeded()
      await expect(reveal).toHaveClass(/lf-visible/)
    }
    for (const id of ['product', 'ai-assistant', 'crm', 'pipeline', 'automations', 'inbox', 'analytics', 'how-it-works', 'solutions', 'integrations', 'security', 'pricing', 'resources']) {
      await page.locator(`#${id}`).scrollIntoViewIfNeeded()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy()
      if (['crm', 'pipeline', 'automations', 'pricing'].includes(id)) {
        await page.locator(`#${id}`).screenshot({ path: info.outputPath(`${id}.png`), animations: 'disabled', style: '.lf-nav,.lf-skip{visibility:hidden!important}' })
      }
    }
    await page.screenshot({ path: info.outputPath('full-page.png'), fullPage: true })
    const brokenLinks = await page.locator('.lf-site a[href^="#"]').evaluateAll(links => links.filter(link => !document.getElementById(link.getAttribute('href')!.slice(1))).map(link => link.getAttribute('href')))
    expect(brokenLinks).toEqual([])
    await page.getByRole('button', { name: 'Try the actual analytics tools' }).click()
    await expect(page.locator('.lf-live-report')).toContainText('Understand your opportunities.')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy()
    await page.locator('.lf-live-report').screenshot({ path: info.outputPath('analytics.png'), animations: 'disabled', style: '.lf-nav,.lf-skip{visibility:hidden!important}' })
    const clipped = await page.locator('.lf-demo,.lf-section-heading,.lf-hero h1,.lf-price,.lf-live-report').evaluateAll(elements => elements.filter(el => {
      const box = el.getBoundingClientRect()
      return box.width > 0 && (box.left < -1 || box.right > innerWidth + 1)
    }).map(el => el.className))
    expect(clipped).toEqual([])
    expect(errors).toEqual([])
  })
}

test('product demos respond to choices without changing workspace data', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.getByRole('button', { name: 'How much does this cost?', exact: true }).click()
  await expect(page.locator('.lf-answer')).toContainText('I don’t have a verified price')
  const crm = page.locator('#crm')
  await crm.getByRole('button', { name: 'Qualified only' }).click()
  await expect(crm.locator('tbody tr')).toHaveCount(1)
  await crm.getByRole('button', { name: 'Assign to Sarah' }).click()
  await expect(crm.getByRole('button', { name: 'Sarah ✓' })).toBeVisible()
  await crm.getByRole('button', { name: '+ Add sample lead' }).click()
  await expect(crm.locator('tbody tr')).toHaveCount(2)
  const pipeline = page.locator('#pipeline')
  await pipeline.getByRole('button', { name: 'Replay' }).click()
  await pipeline.getByRole('button', { name: 'Next scene' }).click()
  await expect(pipeline.locator('.lf-moving-deal .lf-badge')).toHaveText('Qualified')
  await pipeline.getByRole('button', { name: 'Next scene' }).click()
  await expect(pipeline.locator('.lf-moving-deal .lf-badge')).toHaveText('Meeting')
  await pipeline.getByRole('button', { name: 'Replay' }).click()
  await expect(pipeline.locator('.lf-moving-deal .lf-badge')).toHaveText('New')
  const inbox = page.locator('#inbox')
  await inbox.getByRole('button', { name: 'Website' }).click()
  await expect(inbox.locator('.lf-inbox-context')).toContainText('Aisha Njeri')
  await inbox.getByRole('button', { name: 'Take over conversation' }).click()
  await expect(inbox.locator('.lf-inbox-context')).toContainText('Sarah is handling this')
  await inbox.getByRole('button', { name: 'Email' }).click()
  await expect(inbox.locator('.lf-inbox-context')).toContainText('Brian Otieno')
  await expect(inbox.getByRole('button', { name: 'Take over conversation' })).toBeVisible()
  await page.getByRole('button', { name: 'Logistics', exact: false }).click()
  await expect(page.locator('.lf-industry-preview')).toContainText('Cargo')
  await page.getByRole('button', { name: 'Before LeadFlow', exact: true }).click()
  await expect(page.locator('.lf-comparison-list')).toContainText('Scattered messages')
  await page.getByRole('button', { name: 'With LeadFlow', exact: true }).click()
  await expect(page.locator('.lf-comparison-list')).toContainText('Unified inbox')
  await page.getByRole('button', { name: 'Try the actual analytics tools' }).click()
  await expect(page.locator('.lf-live-report')).toContainText('Understand your opportunities.')
  const report = page.locator('.lf-live-report')
  await report.getByRole('combobox', { name: 'Source' }).selectOption('Website')
  await expect(report.locator('tbody tr')).toHaveCount(1)
  await expect(report.locator('tbody')).toContainText('James Mwangi')
  const downloadEvent = page.waitForEvent('download')
  await report.getByRole('button', { name: 'Export filtered CSV' }).click()
  expect((await downloadEvent).suggestedFilename()).toBe('leadflow-demo-analytics.csv')
  await report.getByRole('button', { name: 'Reset filters' }).click()
  await expect(report.locator('tbody tr')).toHaveCount(4)
  await page.getByRole('button', { name: 'Close interactive report' }).click()
  await expect(page.locator('.lf-live-report')).toHaveCount(0)
})

test('system architecture explains each connected stage', async ({ page }, info) => {
  await page.goto('/')
  const system = page.locator('#technology')
  await expect(system.getByRole('heading', { name: 'From first signal to forward motion.' })).toBeVisible()
  for (const [stage, result] of [
    ['UNDERSTAND', 'LEAD QUALIFIED'],
    ['ORCHESTRATE', 'FOLLOW-UP QUEUED'],
    ['LEARN', 'OUTCOME RECORDED'],
    ['CAPTURE', 'SOURCE ATTRIBUTED'],
  ]) {
    await system.getByRole('tab', { name: new RegExp(stage) }).click()
    await expect(system.getByRole('tabpanel')).toContainText(result)
  }
  await system.screenshot({ path: info.outputPath('technology.png'), animations: 'disabled' })
})

test('public website explains the complete professional workspace', async ({ page }) => {
  await page.goto('/')
  await page.locator('#workspace').scrollIntoViewIfNeeded()
  await expect(page.getByRole('heading',{name:'Customer growth and delivery. One professional operating system.'})).toBeVisible()
  for(const tab of ['Acquire','Deliver','Automate','Operate'])await page.getByRole('tab',{name:new RegExp(tab)}).click()
  await expect(page.getByText('Team chat',{exact:true})).toBeVisible()
  await expect(page.getByText('Costs & billing',{exact:true})).toBeVisible()
  await page.getByRole('tab',{name:/Deliver/}).click()
  await expect(page.getByText('Client portal',{exact:true})).toBeVisible()
  await expect(page.getByText('Systems',{exact:true})).toBeVisible()
})

test('FAQ, separate legal pages and keyboard controls', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  const questions = page.locator('.lf-accordion h3 button')
  await expect(questions).toHaveCount(15)
  for (const question of await questions.all()) {
    await question.click()
    await expect(question).toHaveAttribute('aria-expanded', 'true')
    const answer = page.locator('#' + await question.getAttribute('aria-controls'))
    await expect(answer).toBeVisible()
    await question.click()
    await expect(answer).toBeHidden()
  }
  const privacy = page.locator('footer').getByRole('link', { name: 'Privacy', exact: true })
  await privacy.click()
  await expect(page).toHaveURL(/\/privacy$/)
  await expect(page.getByRole('heading',{name:'Privacy notice'})).toBeVisible()
  await page.goto('/')
  const stage = page.locator('.lf-journey-stages button').nth(2)
  await stage.focus()
  await expect(stage).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.lf-journey-detail')).toContainText('AI qualification')
})

test('public company, solutions and contact pages are functional',async({page})=>{
  await page.goto('/about');await expect(page.getByRole('heading',{name:/A clearer path/})).toBeVisible()
  await page.goto('/solutions');await expect(page.getByRole('heading',{name:/One sales workflow/})).toBeVisible();await expect(page.locator('.solution-cards article')).toHaveCount(7)
  await page.route('**/functions/v1/public-inquiry',route=>route.fulfill({status:201,contentType:'application/json',body:'{"received":true}'}))
  await page.goto('/contact?type=demo')
  await page.getByLabel('Full name').fill('Test User');await page.getByLabel('Work email').fill('test@example.com');await page.getByLabel('How can we help?').fill('We need a product walkthrough.')
  await page.getByRole('button',{name:/Request demo/}).click();await expect(page.getByRole('status')).toContainText('Request received')
  await page.goto('/terms');await expect(page.getByRole('heading',{name:'Service terms'})).toBeVisible()
})

test('mobile navigation opens, closes and preserves accessible focus', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Open menu' }).click()
  await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Open menu' })).toBeFocused()
  await page.getByRole('button', { name: 'Open menu' }).click()
  await page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('link', { name: 'Pricing' }).click()
  await expect(page).toHaveURL(/#pricing$/)
  await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toBeHidden()
})

test('mobile website header stays available and pricing mirrors workspace packages', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  const header = page.locator('.lf-nav')
  await expect(header).toBeVisible()
  await page.locator('#pricing').scrollIntoViewIfNeeded()
  await expect(header).toBeVisible()
  await expect.poll(async () => Math.round((await header.boundingBox())?.y ?? -1)).toBe(0)
  await expect(page.getByRole('heading', { name: 'What each package covers' })).toBeVisible()
  await expect(page.locator('#pricing')).toContainText('25 knowledge items')
  await expect(page.locator('#pricing')).toContainText('AI agents and operational run centre')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy()
})

test('reduced motion keeps scenes stable but manually explorable', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  const hero = page.locator('.lf-hero-scene')
  await hero.scrollIntoViewIfNeeded()
  await page.waitForTimeout(2100)
  await expect(hero.locator('.lf-playback')).toContainText('07 / 07')
  await hero.getByRole('button', { name: 'Replay' }).click()
  await hero.getByRole('button', { name: 'Next scene' }).click()
  await expect(hero.locator('.lf-playback')).toContainText('02 / 07')
  await expect(hero.getByRole('button', { name: 'Pause' })).toHaveCount(0)
  await expect(page.locator('.lf-mobile-scene').first()).toBeVisible()
  await expect(page.locator('.lf-sticky-visual')).toBeHidden()
})

test('motion progresses only on screen and hover depth resets', async ({ page }) => {
  await page.goto('/')
  const hero = page.locator('.lf-hero-scene')
  await hero.scrollIntoViewIfNeeded()
  await expect(hero.locator('.lf-playback')).toContainText('02 / 07', { timeout: 5000 })
  await hero.getByRole('button', { name: 'Pause' }).click()
  const paused = await hero.locator('.lf-playback').textContent()
  await page.waitForTimeout(2000)
  expect(await hero.locator('.lf-playback').textContent()).toBe(paused)
  await page.locator('.lf-perspective').hover({ position: { x: 70, y: 80 } })
  await expect.poll(() => page.locator('.lf-perspective').evaluate(el => el.style.getPropertyValue('--ry'))).not.toBe('0deg')
  await page.mouse.move(0, 0)
  await expect.poll(() => page.locator('.lf-perspective').evaluate(el => el.style.getPropertyValue('--ry'))).toBe('0deg')
  await hero.getByRole('button', { name: 'Replay' }).click()
  await page.locator('footer').scrollIntoViewIfNeeded()
  await page.waitForTimeout(2100)
  await expect(hero.locator('.lf-playback')).toContainText('01 / 07')
})

test('existing workspace and account entry points still work', async ({ page }) => {
  await page.goto('/')
  await page.locator('footer').getByRole('button', { name: 'Open demo workspace' }).click()
  await expect(page).toHaveURL(/#app$/)
  await expect(page.locator('.app')).toBeVisible()
  await page.goto('/')
  await page.getByRole('button', { name: 'Sign in', exact: true }).first().click()
  await expect(page.locator('.auth-layout, .auth-page')).toBeVisible()
})
