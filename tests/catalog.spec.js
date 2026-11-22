import {test,expect} from '@playwright/test';

async function openCatalog(page) {
  await page.goto('/');
  await page.getByRole('button',{name:'Services',exact:true}).click();
}

test('catalog combines search and category filters with a useful empty state',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await openCatalog(page);
  await expect(page.locator('.service-card')).toHaveCount(48);
  await page.getByRole('button',{name:'Reimagine a thrift find',exact:true}).click();
  await expect(page.locator('.service-card')).toHaveCount(8);
  await page.getByLabel('Find a service or an idea').fill('scarf');
  await expect(page.locator('.service-card')).toHaveCount(1);
  await expect(page.locator('.service-card')).toContainText('Scarf-to-garment project');
  await page.getByLabel('Find a service or an idea').fill('<img src=x onerror=alert(1)>');
  await expect(page.locator('#catalog-count')).toContainText('0 of 48');
  await expect(page.locator('#catalog-results img')).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Your idea can still start here.'})).toBeVisible();
  await page.locator('#catalog-empty-idea').click();
  await expect(page.locator('#idea-service')).toHaveValue('');
  await page.getByRole('button',{name:'Close service idea'}).click();
  await page.getByRole('button',{name:'Clear filters',exact:true}).click();
  await expect(page.locator('.service-card')).toHaveCount(48);
  expect(errors).toEqual([]);
});

test('service idea can be reviewed, edited, saved and reopened with legacy requests intact',async({page})=>{
  await page.goto('/');
  await page.evaluate(()=>localStorage.setItem('cnd-requests',JSON.stringify([{id:'old',customer:{name:'Old Demo',email:'old@example.com'},createdAt:'2026-11-01T12:00:00Z',change:'Shorten to knee length',notes:'Keep this older request',status:'Demo — awaiting fitting'}])));
  // Seed once; subsequent reloads must use the data saved by the app.
  await openCatalog(page);
  await page.getByRole('button',{name:'Describe my idea: Oversized shirt redesign',exact:true}).click();
  await expect(page.locator('#idea-service')).toHaveValue('thrift-3');
  await page.getByLabel('Describe your garment or starting material').fill('Striped thrift-store shirt');
  await page.getByLabel('What would you like done?').fill('Tie-front top <script>window.bad=true</script>');
  await page.locator('.idea-details summary').click();
  await page.getByLabel('What should we preserve?').fill('Original collar and buttons');
  await page.getByLabel('Budget range').fill('$40–$70');
  await page.getByLabel('Requested date').fill('2027-02-01');
  await page.getByLabel('Leftover fabric preference').selectOption('Explore a matching accessory');
  await page.getByRole('button',{name:'Review my idea',exact:true}).click();
  await expect(page.locator('#request-content')).toContainText('Oversized shirt redesign');
  await page.getByRole('button',{name:'Edit my idea',exact:true}).click();
  await expect(page.getByLabel('What should we preserve?')).toHaveValue('Original collar and buttons');
  await page.getByLabel('What would you like done?').fill('Tie-front top, relaxed fit');
  await page.getByRole('button',{name:'Review my idea',exact:true}).click();
  await page.getByRole('button',{name:'Save demo request',exact:false}).click();
  await page.getByRole('button',{name:'View my requests',exact:false}).click();
  await expect(page.locator('#requests-list')).toContainText('Original collar and buttons');
  await expect(page.locator('#requests-list')).toContainText('Keep this older request');
  await page.reload();
  await page.locator('nav [data-page="requests"]').click();
  await expect(page.locator('#requests-list .request-card')).toHaveCount(2);
  await expect(page.locator('#requests-list')).toContainText('Tie-front top, relaxed fit');
  await expect(page.locator('#requests-list')).toContainText('Explore a matching accessory');
  await page.locator('#requests-list .request-card').first().getByRole('button',{name:'Remove demo request'}).click();
  await expect(page.locator('#requests-list')).toContainText('Keep this older request');
});

test('custom idea validates whitespace, escapes text and reports failed storage',async({page})=>{
  await openCatalog(page);
  await page.locator('#catalog-unsure').click();
  await page.getByLabel('Describe your garment or starting material').fill('   ');
  await page.getByLabel('What would you like done?').fill('A custom idea');
  await page.getByRole('button',{name:'Review my idea',exact:true}).click();
  await expect(page.locator('#catalog-idea-dialog')).toBeVisible();
  await page.getByLabel('Describe your garment or starting material').fill('<img src=x onerror=alert(1)>');
  await page.getByRole('button',{name:'Review my idea',exact:true}).click();
  await expect(page.locator('#request-content')).toContainText('<img src=x onerror=alert(1)>');
  await expect(page.locator('#request-content img')).toHaveCount(0);
  await page.evaluate(()=>{Storage.prototype.setItem=()=>{throw new Error('quota');};});
  await page.getByRole('button',{name:'Save demo request',exact:false}).click();
  await expect(page.locator('#toast')).toContainText('Your changes were not saved');
  await expect(page.locator('#request-count')).toHaveText('0');
  await expect(page.getByRole('button',{name:'Edit my idea',exact:true})).toBeVisible();
});

test('catalog and idea form fit phone and tablet widths and draft survives browsing',async({page})=>{
  await openCatalog(page);
  for(const width of [390,768,1280]) {
    await page.setViewportSize({width,height:900});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.locator('#catalog-unsure').click();
    await page.getByLabel('Describe your garment or starting material').fill('A vintage jacket');
    await page.locator('.idea-details summary').evaluate(el=>el.parentElement.open=true);
    const bounds=await page.locator('#catalog-idea-dialog').evaluate(el=>({scroll:el.scrollWidth,width:el.clientWidth}));
    expect(bounds.scroll).toBeLessThanOrEqual(bounds.width);
    await page.getByRole('button',{name:'Close service idea'}).click();
  }
  await page.getByRole('button',{name:'My wardrobe',exact:true}).click();
  await expect(page.locator('#wardrobe-page')).toBeVisible();
  await page.getByRole('button',{name:'Services',exact:true}).click();
  await page.locator('#catalog-unsure').click();
  await expect(page.getByLabel('Describe your garment or starting material')).toHaveValue('A vintage jacket');
});
