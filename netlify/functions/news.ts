import type { Handler } from "@netlify/functions";
import { parse } from "node-html-parser";
import { fetchUrl, fetchSearchUrl, parseArticleNode, getLocalLink, toFileProxy, jsonResponse } from "./_shared/inews";

export const handler: Handler = async (event) => {
  try {
    const params = event.queryStringParameters || {};
    const q = params.q;

    if (q) {
      // SEARCH
      const limit = 40;
      const apiUrl = `https://www.inews.id/omni/search?q=${encodeURIComponent(q)}&o=0&l=${limit}&c=channel`;
      const html = await fetchSearchUrl(apiUrl, q);
      if (!html) return jsonResponse(500, { status: "error", message: "Gagal mengambil hasil pencarian" });
      const json = JSON.parse(html);
      if (!json || !json.data) return jsonResponse(500, { status: "error", message: "Format tidak valid" });

      const articles = json.data.map((item: any) => {
        const img = toFileProxy(item.image?.medium || item.image?.small || '');
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

      return jsonResponse(200, { status: "success", data: articles });
    }

    // HOMEPAGE OR CATEGORY
    let url = 'https://www.inews.id/';
    const cat = params.category;
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
        case 'utama': url = 'https://www.inews.id/'; break;
      }
    }

    const html = await fetchUrl(url);
    if (!html) throw new Error("Failed to fetch");

    const cleanHtml = html.replace(/<script[^>]*>.*?<\/script>/gis, '').replace(/<style[^>]*>.*?<\/style>/gis, '');
    const dom = parse(cleanHtml);
    const doc = dom;

    let allArticles: any[] = [];
    const addArticles = (nodes: any[]) => {
      nodes.forEach(node => {
        const article = parseArticleNode(node);
        if (article && !allArticles.find(a => a.url === article.url)) {
          allArticles.push(article);
        }
      });
    };

    addArticles(doc.querySelectorAll(".cardArticle a"));
    addArticles(doc.querySelectorAll("a.headline[href*='/news/']"));
    addArticles(doc.querySelectorAll(".article-wp a.artikel"));
    addArticles(doc.querySelectorAll(".article-wp a.headline"));
    addArticles(doc.querySelectorAll("#list-article a.artikel"));
    addArticles(doc.querySelectorAll("a.widget-v-video-card"));

    const normalized = allArticles.map((item, index) => {
      let img = item.image || "https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=800&q=80";
      img = toFileProxy(img);
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

    return jsonResponse(200, { status: "success", data: normalized });
  } catch (error) {
    console.error("Error fetching news:", error);
    return jsonResponse(500, { status: "error", message: "Failed to fetch news" });
  }
};
