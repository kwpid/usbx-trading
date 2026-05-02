const cheerio = require('cheerio');

async function test() {
  const url = 'https://beta.untitled-sandbox.com/marketplace/119';
  const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const html = await response.text();
  const $ = cheerio.load(html);
  
  const scriptContent = $('script').filter((i, el) => {
    return $(el).html().includes('Wizard Beard');
  }).html();
  
  if (scriptContent) {
    const match = scriptContent.match(/data:\s*(\[\{type:"data".*?\])/);
    if (match) {
        let jsonStr = match[1];
        // Svelte output isn't strictly JSON (e.g. new Date(...), void 0).
        // Let's just regex search for "Wizard Beard" in the script and surrounding keys
        const itemMatch = scriptContent.match(/item:\{(.*?)\}/);
        if (itemMatch) {
            console.log("Found Item Object:", itemMatch[0]);
        }
        const storeItemMatch = scriptContent.match(/storeItem:\{(.*?)\}/);
        if (storeItemMatch) {
            console.log("Found Store Item Object:", storeItemMatch[0]);
        }
    }
  }

  // Fallback DOM parsing
  const soldText = $('div, span, p').filter((i, el) => $(el).text().includes('Sold:')).first().text();
  const listedText = $('div, span, p').filter((i, el) => $(el).text().includes('Listed:')).first().text();
  const creatorText = $('div, span, p').filter((i, el) => $(el).text().trim().startsWith('By')).first().text();
  
  console.log("DOM Parse:");
  console.log("Sold text:", soldText);
  console.log("Listed text:", listedText);
  console.log("Creator text:", creatorText);
  
  // Find images starting with https://assets.unsbx.org/items
  const images = $('img').map((i, el) => $(el).attr('src')).get();
  console.log("Images found:", images.filter(img => img && img.includes('assets.unsbx.org')));
  
  // Name
  const nameText = $('h1').first().text(); // actually h1 was Resellers
  // Let's look at the breadcrumb
  const breadcrumb = $('div').filter((i, el) => $(el).text().includes('Marketplace »')).last().text();
  console.log("Breadcrumb text:", breadcrumb);
}

test();
