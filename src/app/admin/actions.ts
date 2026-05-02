'use server'

import * as cheerio from 'cheerio';
import { supabase } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';

export async function fetchPreviewAction(url: string) {
  if (!url) {
    return { error: 'URL is required', success: false };
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    });

    if (!response.ok) {
      return { error: `Failed to fetch URL: ${response.statusText}`, success: false };
    }

    const html = await response.text();
    const $ = cheerio.load(html);



    // DOM Extraction based on specific HTML structure
    const domName = $('div.mb-1.text-2xl.font-semibold').first().text().trim();
    const domImageUrl = $('img[src*="renders/items"]').first().attr('src');
    const domDescription = $('p.mb-3.text-sm.text-neutral-300').first().text().trim();
    
    // For creator, look for links that might represent a user or just text after 'By'
    let domCreator = 'USBX'; // Default to USBX
    $('div, span, p, a').each((i, el) => {
      const text = $(el).text().trim();
      if (text.startsWith('By') && text.length < 30) {
        const potentialCreator = text.replace('By', '').trim();
        if (potentialCreator) domCreator = potentialCreator;
      }
    });

    let domSold = 0;
    $('div, span, p').each((i, el) => {
      const text = $(el).text().trim();
      if (text.startsWith('Sold:')) {
        const numMatch = text.match(/Sold:\s*(\d+)/);
        if (numMatch) domSold = parseInt(numMatch[1], 10);
      }
    });

    // Count copies/owners by looking at the highest serial number
    let maxSerial = 0;
    $('span[class*="serial-inline"]').each((i, el) => {
      const text = $(el).text().replace('#', '').trim();
      const num = parseInt(text, 10);
      if (!isNaN(num) && num > maxSerial) {
        maxSerial = num;
      }
    });
    
    // If no serials found, rely on domSold
    const domCopies = maxSerial > 0 ? maxSerial : domSold;

    // RAP Calculation from Recent Sales
    // Look through sales rows (rounded border containers)
    let validResalePrices: number[] = [];
    $('.rounded.border.border-neutral-800').each((i, el) => {
      const text = $(el).text();
      // Check if it's a sale row
      if (text.includes('Buyer:') && text.includes('Seller:')) {
        const sellerMatch = text.match(/Seller:\s*([^\s<]+)/);
        if (sellerMatch && sellerMatch[1] !== 'Store') {
          // It's a resell, extract price
          const priceText = $(el).find('.currency-chip').text().replace(/,/g, '').trim();
          const price = parseInt(priceText, 10);
          if (!isNaN(price)) {
            validResalePrices.push(price);
          }
        }
      }
    });

    let rap = 0;
    if (validResalePrices.length > 0) {
      const sum = validResalePrices.reduce((a, b) => a + b, 0);
      rap = Math.floor(sum / validResalePrices.length);
    }

    // Extract from SvelteKit data as a backup
    let itemDataString = '';
    $('script').each((i, el) => {
      const content = $(el).html() || '';
      if (content.includes('storeItem:') || content.includes('item:{')) {
        itemDataString += content;
      }
    });

    let svelteName = '';
    const nameMatches = [...itemDataString.matchAll(/name:"([^"]+)"/g)];
    for (const match of nameMatches) {
      if (match[1] !== 'USBX Store' && match[1] !== 'Scrips') {
        svelteName = match[1];
        break;
      }
    }

    const creatorMatch = itemDataString.match(/username:"([^"]+)"/);
    const imageUrlMatch = itemDataString.match(/imageUrl:"(renders\/items\/[^"]+)"/);
    const isLimitedMatch = itemDataString.match(/isLimited:(true|false)/);
    const isWearableMatch = itemDataString.match(/isWearable:(true|false)/);
    const priceMatch = itemDataString.match(/price:(\d+)/);

    // Combine DOM and Svelte data, prioritizing DOM if it's explicitly found
    const name = domName || svelteName || 'Unknown Item';
    const creator = domCreator || (creatorMatch ? creatorMatch[1] : 'Unknown Creator');
    const item_image_url = domImageUrl || (imageUrlMatch ? `https://assets.unsbx.org/${imageUrlMatch[1]}` : '');
    const description = domDescription || '';
    
    // Check wearable/limited from breadcrumbs or tags
    const domTextHtml = $('body').text();
    const is_limited = domTextHtml.includes('LIMITED') || domTextHtml.includes('Limited') || (isLimitedMatch ? isLimitedMatch[1] === 'true' : false);
    const is_wearable = domTextHtml.includes('Wearable') || domTextHtml.includes('WEARABLE') || (isWearableMatch ? isWearableMatch[1] === 'true' : false);
    
    const price_best_resale = priceMatch ? parseInt(priceMatch[1]) : 0;
    
    // Available owners logic
    const available_owners = domCopies;

    // Create the preview object
    const previewItem = {
      name: name,
      creator: creator,
      description: description,
      item_image_url: item_image_url,
      is_limited: is_limited,
      is_wearable: is_wearable,
      price_best_resale: price_best_resale,
      rap: rap, // Calculated from valid resales
      value: 0, // Explicitly set to 0 as requested
      available_owners: available_owners,
      premium_copies: 0, // Mocked for now
    };

    return { 
      success: true, 
      preview: previewItem
    };

  } catch (err: any) {
    console.error('Scraping error:', err);
    return { error: err.message || 'An unexpected error occurred during scraping', success: false };
  }
}

export async function saveItemAction(item: any) {
  try {
    const { data, error } = await supabase
      .from('items')
      .insert([item])
      .select();

    if (error) {
      console.error("Supabase error:", error);
      return { error: `Database error: ${error.message}. Did you create the table?`, success: false };
    }

    revalidatePath('/');
    revalidatePath('/market');

    return { 
      success: true, 
      message: `Successfully saved ${item.name}!`,
      item: data[0]
    };
  } catch (err: any) {
    console.error('Save error:', err);
    return { error: err.message || 'An unexpected error occurred during saving', success: false };
  }
}
