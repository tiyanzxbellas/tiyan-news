import { parse, HTMLElement } from "node-html-parser";

export const fetchUrl = async (url: string, retry = 0): Promise<string | false> => {
  const maxRetries = 3;
  const userAgents = [
    'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
    'Googlebot/2.1 (+http://www.google.com/bot.html)'
  ];

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': userAgents[Math.floor(Math.random() * userAgents.length)],
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'id-ID,id;q=0.9',
        'Cache-Control': 'no-cache'
      }
    });
    if (response.ok) {
      return await response.text();
    }
  } catch (e) {}

  if (retry < maxRetries) {
    await new Promise(r => setTimeout(r, 100 + Math.random() * 100));
    return fetchUrl(url, retry + 1);
  }
  return false;
};

export const fetchSearchUrl = async (url: string, query: string, retry = 0): Promise<string | false> => {
  const maxRetries = 3;
  const userAgents = [
    'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
  ];

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': userAgents[Math.floor(Math.random() * userAgents.length)],
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'id-ID,id;q=0.9',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': 'https://www.inews.id/find?q=' + encodeURIComponent(query),
        'Cache-Control': 'no-cache'
      }
    });
    if (response.ok) {
      return await response.text();
    }
  } catch (e) {}

  if (retry < maxRetries) {
    await new Promise(r => setTimeout(r, 100 + Math.random() * 100));
    return fetchSearchUrl(url, query, retry + 1);
  }
  return false;
};

export const parseArticleNode = (node: HTMLElement): any => {
  let url = node.getAttribute('href');
  if (!url || url === '#') return null;
  if (!url.startsWith('http')) {
    if (url.startsWith('//')) url = 'https:' + url;
    else url = 'https://www.inews.id' + url;
  }

  let title = '';
  const titleSelectors = [".headline-title", ".article-title", ".title-artikel", ".title-hot", ".widget-v-video-title", ".title-news", ".cardTitle"];
  for (const sel of titleSelectors) {
    const tNode = node.querySelector(sel);
    if (tNode) { title = tNode.textContent?.trim() || ''; if (title) break; }
  }
  if (!title) {
    const h1 = node.querySelector("h1");
    if (h1) title = h1.textContent?.trim() || '';
    else {
      const h2 = node.querySelector("h2");
      if (h2) title = h2.textContent?.trim() || '';
    }
  }
  if (!title) {
    title = node.textContent?.replace(/\s+/g, ' ').trim() || '';
    if (title.length > 200) title = title.substring(0, 200) + '...';
  }

  let category = '';
  const catSelectors = [".cat", "span", ".widget-v-video-kanal", ".kanal"];
  for (const sel of catSelectors) {
    const catNodes = node.querySelectorAll(sel);
    for (const catNode of Array.from(catNodes)) {
      const catText = catNode.textContent?.trim() || '';
      if (catText && catText.length < 30 && !/^\d+/.test(catText)) {
        category = catText; break;
      }
    }
    if (category) break;
  }

  let image = '';
  const imgNode = node.querySelector("img");
  if (imgNode) {
    image = imgNode.getAttribute('src') || imgNode.getAttribute('data-src') || '';
  }

  let time = '';
  const timeNode = node.querySelector(".time");
  if (timeNode) {
    time = timeNode.textContent?.trim() || '';
  } else {
    const onclick = node.getAttribute('onclick');
    if (onclick) {
      const m = onclick.match(/'(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})'/);
      if (m) time = m[1];
    }
  }

  let articleId = '';
  const match = url.match(/\/(\d{6,})(?:\/|\?|$)/);
  if (match) articleId = match[1];

  return { article_id: articleId, title, url, category, image, time };
};

export const getLocalLink = (originalUrl: string) => {
  try {
    const urlObj = new URL(originalUrl);
    if (urlObj.hostname.includes('inews.id')) {
      let slug = urlObj.pathname.substring(1);
      if (urlObj.hostname !== 'www.inews.id') {
        slug = `${urlObj.hostname}/${slug}`;
      }
      return `/read/${slug}`;
    }
    return originalUrl;
  } catch {
    return originalUrl;
  }
};

export const toFileProxy = (img: string) => (img && img.startsWith('http')) ? `/file/${img}` : img;

export const parsePageHtml = (pageHtml: string) => {
  const cleanHtml = pageHtml.replace(/<script[^>]*>.*?<\/script>/gis, '')
    .replace(/<style[^>]*>.*?<\/style>/gis, '')
    .replace(/<noscript[^>]*>.*?<\/noscript>/gis, '')
    .replace(/<iframe[^>]*>.*?<\/iframe>/gis, '');
  const doc = parse(cleanHtml);

  const data: any = { paragraphs: [], title: '', image: '', publishedTime: '', author: '' };

  const ogTitle = doc.querySelector('meta[property="og:title"]');
  if (ogTitle) data.title = ogTitle.getAttribute("content") || '';

  const ogImage = doc.querySelector('meta[property="og:image"]');
  if (ogImage) data.image = ogImage.getAttribute("content") || '';

  const pubTime = doc.querySelector('meta[property="article:published_time"]');
  if (pubTime) data.publishedTime = pubTime.getAttribute("content") || '';
  else {
    const mPub = pageHtml.match(/'publish_date'\s*:\s*'([^']+)'/);
    if (mPub) data.publishedTime = mPub[1];
  }

  if (!data.publishedTime) {
    const time = doc.querySelector('time');
    if (time) data.publishedTime = time.textContent?.trim() || '';
  }

  let contentDivs = doc.querySelectorAll(".detail-artikel p");
  if (contentDivs.length === 0) contentDivs = doc.querySelectorAll(".bodyText p");
  if (contentDivs.length === 0) contentDivs = doc.querySelectorAll("article p");
  if (contentDivs.length === 0) contentDivs = doc.querySelectorAll(".pc-desc-artikel p");

  contentDivs.forEach(p => {
    const text = p.textContent?.trim() || '';
    if (text.length < 40) return;

    const blacklist = [
      /^(Baca Juga|Advertisement|SCROLL|ikuti WhatsApp|Editor|Tag:|Tags:)/i,
      /^(function |var |let |const |window\.|document\.|googletag)/i,
      /^(if \(|for \(|while \(|<\/?)/i,
      /\.push\(|\.cmd|dataLayer|localStorage|cookie|\.display\(/i
    ];

    let skip = false;
    for (const rx of blacklist) {
      if (rx.test(text)) { skip = true; break; }
    }
    if (!skip && !data.paragraphs.includes(text)) {
      data.paragraphs.push(text);
    }
  });

  return data;
};

export const jsonResponse = (statusCode: number, body: unknown) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body)
});
