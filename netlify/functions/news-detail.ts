import type { Handler } from "@netlify/functions";
import { parse } from "node-html-parser";
import { fetchUrl, parsePageHtml, toFileProxy, jsonResponse } from "./_shared/inews";

export const handler: Handler = async (event) => {
  try {
    let url = event.queryStringParameters?.url;
    if (!url) return jsonResponse(400, { status: "error", message: "URL is required" });

    url = url.replace(/\/$/, '');
    let html = await fetchUrl(url);
    if (!html) throw new Error("Failed to fetch detail");

    // Check if this page wraps content in an iframe (e.g., mpi.inews.id)
    const domForIframe = parse(html);
    const iframeList = domForIframe.querySelector('iframe#iframeList');
    if (iframeList) {
      const iframeSrc = iframeList.getAttribute('src');
      if (iframeSrc) {
        url = iframeSrc.startsWith('//') ? 'https:' + iframeSrc : iframeSrc;
        const iframeHtml = await fetchUrl(url);
        if (!iframeHtml) throw new Error("Failed to fetch iframe detail");
        html = iframeHtml;
      }
    }

    // Deteksi total page (from PHP)
    let totalPages = 1;
    const mPage = html.match(/'total_page'\s*:\s*'(\d+)'/);
    if (mPage) totalPages = parseInt(mPage[1]);

    if (totalPages <= 1) {
      const dom = parse(html);
      const btnPages = dom.querySelectorAll(".page-numbers .btn-page");
      if (btnPages.length > 0) totalPages = btnPages.length;
    }

    const baseData = parsePageHtml(html);
    let allParagraphs = [...baseData.paragraphs];

    for (let page = 2; page <= totalPages; page++) {
      const pageUrl = `${url}/${page}`;
      const pageHtml = await fetchUrl(pageUrl);
      if (pageHtml) {
        const pData = parsePageHtml(pageHtml);
        pData.paragraphs.forEach((p: string) => {
          if (!allParagraphs.includes(p)) allParagraphs.push(p);
        });
      }
    }

    const contentHtml = allParagraphs.map(p => `<p>${p}</p>`).join("");

    const finalImg = toFileProxy(baseData.image);

    return jsonResponse(200, {
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
    return jsonResponse(500, { status: "error", message: "Failed to fetch article details" });
  }
};
