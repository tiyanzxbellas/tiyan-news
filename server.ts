import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { JSDOM } from "jsdom";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Local proxy equivalent for development
  app.get("/file/*", async (req, res) => {
    let targetUrl = req.params[0]; // Gets the splat part
    
    if (!targetUrl) return res.status(400).send("Missing url parameter");
    
    if (targetUrl.startsWith('http:/') && !targetUrl.startsWith('http://')) {
        targetUrl = targetUrl.replace('http:/', 'http://');
    } else if (targetUrl.startsWith('https:/') && !targetUrl.startsWith('https://')) {
        targetUrl = targetUrl.replace('https:/', 'https://');
    } else if (!targetUrl.startsWith('http')) {
        targetUrl = 'https://' + targetUrl; // Default to https
    }

    try {
      const response = await fetch(targetUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "*/*"
        }
      });
      
      response.headers.forEach((value, key) => {
        if (!['x-frame-options', 'content-security-policy', 'set-cookie'].includes(key.toLowerCase())) {
          res.setHeader(key, value);
        }
      });
      
      const buffer = await response.arrayBuffer();
      res.status(response.status).send(Buffer.from(buffer));
    } catch (error) {
      res.status(500).json({ error: "Proxy error", details: String(error) });
    }
  });

  // Helper for fetching
  const fetchUrl = async (url: string, retry = 0): Promise<string | false> => {
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

  const fetchSearchUrl = async (url: string, query: string, retry = 0): Promise<string | false> => {
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
      } catch(e) {}

      if (retry < maxRetries) {
        await new Promise(r => setTimeout(r, 100 + Math.random() * 100));
        return fetchSearchUrl(url, query, retry + 1);
      }
      return false;
  };

  const parseArticleNode = (node: Element): any => {
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

  const getLocalLink = (originalUrl: string) => {
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

  // API Route to fetch news (Homepage iNews or Search)
  app.get("/api/news", async (req, res) => {
    try {
      const q = req.query.q as string;
      if (q) {
          // SEARCH
          const limit = 40;
          const apiUrl = `https://www.inews.id/omni/search?q=${encodeURIComponent(q)}&o=0&l=${limit}&c=channel`;
          const html = await fetchSearchUrl(apiUrl, q);
          if (!html) return res.status(500).json({ status: "error", message: "Gagal mengambil hasil pencarian" });
          const json = JSON.parse(html);
          if (!json || !json.data) return res.status(500).json({ status: "error", message: "Format tidak valid" });
          
          const articles = json.data.map((item: any) => {
              let img = item.image?.medium || item.image?.small || '';
              if (img && img.startsWith('http')) img = `/file/${img}`;
              return {
                  id: item.id || `search-${Date.now()}-${Math.random()}`,
                  title: item.title || '',
                  link: getLocalLink(item.url || ''),
                  category: item.name || 'Berita',
                  image: img,
                  time: item.diff_date || '',
                  source: 'inews.id',
                  publishedAt: item.diff_date || ''
              };
          });
          
          return res.json({ status: "success", data: articles });
      }

      // HOMEPAGE OR CATEGORY
      let url = 'https://www.inews.id/';
      const cat = req.query.category as string;
      if (cat) {
          switch (cat.toLowerCase()) {
              case 'berita': url = 'https://www.inews.id/news'; break;
              case 'daerah': url = 'https://www.inews.id/regional'; break;
              case 'keuangan': url = 'https://www.inews.id/finance'; break;
              case 'sport': url = 'https://www.inews.id/sport'; break;
              case 'lifestyle': url = 'https://www.inews.id/lifestyle'; break;
              case 'travel': url = 'https://www.inews.id/travel'; break;
              case 'otomotif': url = 'https://www.inews.id/otomotif'; break;
              case 'techno': url = 'https://www.inews.id/techno'; break;
              case 'multimedia': url = 'https://www.inews.id/multimedia'; break;
              case 'utama': url = 'https://www.inews.id/'; break; // indeks / utama
          }
      }

      const html = await fetchUrl(url);
      if (!html) throw new Error("Failed to fetch");

      const cleanHtml = html.replace(/<script[^>]*>.*?<\/script>/gis, '').replace(/<style[^>]*>.*?<\/style>/gis, '');
      const dom = new JSDOM(cleanHtml);
      const doc = dom.window.document;
      
      let allArticles: any[] = [];
      const addArticles = (nodes: NodeListOf<Element>) => {
          nodes.forEach(node => {
              const article = parseArticleNode(node);
              if (article && !allArticles.find(a => a.url === article.url)) {
                  allArticles.push(article);
              }
          });
      };

      // Extract all links that look like articles
      addArticles(doc.querySelectorAll(".cardArticle a"));
      addArticles(doc.querySelectorAll("a.headline[href*='/news/']"));
      addArticles(doc.querySelectorAll(".article-wp a.artikel"));
      addArticles(doc.querySelectorAll(".article-wp a.headline"));
      addArticles(doc.querySelectorAll("#list-article a.artikel"));
      addArticles(doc.querySelectorAll("a.widget-v-video-card"));

      const normalized = allArticles.map((item, index) => {
          let img = item.image || "https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=800&q=80";
          if (img && img.startsWith('http')) img = `/file/${img}`;
          return {
              id: item.article_id || `inews-${index}`,
              title: item.title,
              link: getLocalLink(item.url),
              image: img,
              category: item.category || 'Berita',
              source: 'inews.id',
              publishedAt: item.time || null,
              description: ''
          };
      });

      res.json({ status: "success", data: normalized });
    } catch (error) {
      console.error("Error fetching news:", error);
      res.status(500).json({ status: "error", message: "Failed to fetch news" });
    }
  });

  // API Route to fetch and scrape news detail (iNews Detail)
  app.get("/api/news/detail", async (req, res) => {
    try {
      let url = req.query.url as string;
      if (!url) return res.status(400).json({ status: "error", message: "URL is required" });
      
      url = url.replace(/\/$/, '');
      let html = await fetchUrl(url);
      if (!html) throw new Error("Failed to fetch detail");

      // Check if this page wraps content in an iframe (e.g., mpi.inews.id)
      const domForIframe = new JSDOM(html);
      const iframeList = domForIframe.window.document.querySelector('iframe#iframeList');
      if (iframeList) {
          const iframeSrc = iframeList.getAttribute('src');
          if (iframeSrc) {
              url = iframeSrc.startsWith('//') ? 'https:' + iframeSrc : iframeSrc;
              html = await fetchUrl(url);
              if (!html) throw new Error("Failed to fetch iframe detail");
          }
      }

      // Deteksi total page (from PHP)
      let totalPages = 1;
      const mPage = html.match(/'total_page'\s*:\s*'(\d+)'/);
      if (mPage) totalPages = parseInt(mPage[1]);
      
      if (totalPages <= 1) {
          const dom = new JSDOM(html);
          const btnPages = dom.window.document.querySelectorAll(".page-numbers .btn-page");
          if (btnPages.length > 0) totalPages = btnPages.length;
      }

      const parsePageHtml = (pageHtml: string, pageUrl: string) => {
          const cleanHtml = pageHtml.replace(/<script[^>]*>.*?<\/script>/gis, '')
                                   .replace(/<style[^>]*>.*?<\/style>/gis, '')
                                   .replace(/<noscript[^>]*>.*?<\/noscript>/gis, '')
                                   .replace(/<iframe[^>]*>.*?<\/iframe>/gis, '');
          const dom = new JSDOM(cleanHtml);
          const doc = dom.window.document;
          
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

      const baseData = parsePageHtml(html, url);
      let allParagraphs = [...baseData.paragraphs];
      
      for (let page = 2; page <= totalPages; page++) {
          const pageUrl = `${url}/${page}`;
          const pageHtml = await fetchUrl(pageUrl);
          if (pageHtml) {
              const pData = parsePageHtml(pageHtml, pageUrl);
              pData.paragraphs.forEach((p: string) => {
                  if (!allParagraphs.includes(p)) allParagraphs.push(p);
              });
          }
      }
      
      const contentHtml = allParagraphs.map(p => `<p>${p}</p>`).join("");
      
      let finalImg = baseData.image;
      if (finalImg && finalImg.startsWith('http')) finalImg = `/file/${finalImg}`;

      res.json({
          status: "success",
          data: {
              title: baseData.title,
              content: contentHtml,
              image: finalImg,
              publishedTime: baseData.publishedTime,
              author: baseData.author
          }
      });
      
    } catch (error) {
      console.error("Error scraping news detail:", error);
      res.status(500).json({ status: "error", message: "Failed to fetch article details" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

