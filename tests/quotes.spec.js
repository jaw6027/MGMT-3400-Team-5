import { test, expect } from '@playwright/test';

async function openCalculator(page) {
  await page.goto('/');
  await page.getByRole('button', {name:'Service quotes',exact:true}).click();
}
async function enter(page, values) {
  for (const [key,value] of Object.entries(values)) await page.locator(`#quote-${key}`).fill(String(value));
}

test('cost and margin pricing use labor, materials, overhead and fitting', async ({page}) => {
  await openCalculator(page);
  // $40 cost / .70, rounded up to a customer price of $57.15.
  await expect(page.locator('#result-cost')).toHaveText('$40.00');
  await expect(page.locator('#result-suggested')).toHaveText('$57.15');
  await expect(page.locator('#result-profit')).toHaveText('$17.15');
  await enter(page,{materials:10,hours:2,rate:20,overhead:10,fitting:30,margin:20});
  await expect(page.locator('#result-cost')).toHaveText('$70.00');
  await expect(page.locator('#result-suggested')).toHaveText('$87.50');
  await expect(page.locator('#result-profit')).toHaveText('$17.50');
  await expect(page.locator('#result-margin')).toHaveText('20.00%');
  await enter(page,{materials:0,hours:0,rate:0,overhead:0,fitting:0,margin:0,price:0});
  await expect(page.locator('#result-cost')).toHaveText('$0.00');
  await expect(page.locator('#result-suggested')).toHaveText('$0.00');
  await expect(page.locator('#result-fixed-margin')).toHaveText('Undefined (zero price)');
  await enter(page,{materials:100,margin:99.99});
  await expect(page.locator('#result-suggested')).toHaveText('$1,000,000.00');
});

test('fixed quote remains fixed as fitting consumes profit and creates a loss', async ({page}) => {
  await openCalculator(page);
  await expect(page.locator('#result-before')).toHaveText('$20.00');
  await enter(page,{fitting:30});
  await expect(page.locator('#result-fixed')).toHaveText('$60.00');
  await expect(page.locator('#result-fitting')).toHaveText('$12.50');
  await expect(page.locator('#result-fixed-profit')).toHaveText('$7.50');
  await expect(page.locator('#result-fixed-margin')).toHaveText('12.50%');
  await enter(page,{fitting:60});
  await expect(page.locator('#result-fixed-profit')).toHaveText('-$5.00');
  await expect(page.locator('#quote-loss')).toContainText('loss');
  await page.getByRole('button',{name:'Use suggested price as fixed quote'}).click();
  await expect(page.locator('#quote-price')).toHaveValue('92.86');
  await expect(page.locator('#result-fixed-profit')).toHaveText('$27.86');
});

test('invalid inputs hide estimates and cannot be saved', async ({page}) => {
  await openCalculator(page);
  for (const [key,value] of [['materials','-1'],['hours','-1'],['rate','-1'],['overhead','-1'],['fitting','-1'],['margin','100'],['margin','-1'],['price','-1'],['hours',''],['fitting','0.5']]) {
    const field=page.locator(`#quote-${key}`), previous=await field.inputValue();
    await field.fill(value);
    await expect(page.locator('#result-cost')).toHaveText('—');
    await expect(page.locator('#confirm-quote')).toBeDisabled();
    await page.getByRole('button',{name:'Save draft quote',exact:true}).click();
    await expect(page.locator('#quote-list article')).toHaveCount(0);
    await field.fill(previous);
  }
  await page.locator('#quote-service').fill('   ');
  await page.getByRole('button',{name:'Save draft quote',exact:true}).click();
  await expect(page.locator('#quote-list article')).toHaveCount(0);
});

test('drafts persist, approval is required, and edits require fresh approval', async ({page}) => {
  await openCalculator(page);
  await page.locator('#quote-service').fill('Repair jacket lining');
  await enter(page,{materials:12,fitting:15});
  await page.getByRole('button',{name:'Save draft quote',exact:true}).click();
  await expect(page.locator('#quote-list')).toContainText('Draft · awaiting approval');
  await page.reload();
  await page.getByRole('button',{name:'Service quotes',exact:true}).click();
  await page.getByRole('button',{name:'Open quote',exact:true}).click();
  await expect(page.locator('#quote-service')).toHaveValue('Repair jacket lining');
  await expect(page.locator('#quote-materials')).toHaveValue('12');
  await expect(page.locator('#confirm-quote')).toBeDisabled();
  await page.locator('#quote-approved').check();
  await expect(page.locator('#confirm-quote')).toBeDisabled();
  await page.locator('#quote-tailor').fill('Taylor Demo');
  await page.getByRole('button',{name:'Confirm approved quote',exact:true}).click();
  await expect(page.locator('#quote-list')).toContainText('Approved by Taylor Demo');
  await enter(page,{fitting:30});
  await expect(page.locator('#quote-approved')).not.toBeChecked();
  await expect(page.locator('#confirm-quote')).toBeDisabled();
  await page.getByRole('button',{name:'Save draft quote',exact:true}).click();
  await expect(page.locator('#quote-list article')).toHaveCount(1);
  await expect(page.locator('#quote-list')).not.toContainText('Approved by');
  await page.getByRole('button',{name:'Delete quote',exact:true}).click();
  await expect(page.locator('#quote-list article')).toHaveCount(0);
});

test('calculator and existing navigation fit phone and desktop screens', async ({page}) => {
  await openCalculator(page);
  for (const width of [390,768,1024,1440]) {
    await page.setViewportSize({width,height:844});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
    await expect(page.locator('#quote-form')).toBeVisible();
  }
  await page.getByRole('button',{name:'Design studio',exact:true}).click();
  await expect(page.locator('#quotes-page')).toBeHidden();
  await expect(page.locator('#design-page')).toBeVisible();
});
