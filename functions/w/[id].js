// functions/w/[id].js
//
// Aktif otomatis saat ada yang buka: bacoltv.com/w/725un6zy824p
// Sisipkan <title>, meta description, Open Graph, Twitter Card, dan
// JSON-LD (VideoObject) sesuai video — sebelum HTML dikirim ke
// browser/Googlebot. Konten & JS di index.html tidak diubah.
//
// CATATAN: sebelumnya kita sempat coba pola [id].js ini juga dan
// kelihatannya gagal terus — ternyata itu BUKAN karena kurung siku/dynamic
// routing-nya, tapi karena baris `env.ASSETS.fetch('/index.html', ...)` yang
// salah (Cloudflare Pages redirect /index.html -> / secara default, jadi
// yang kita kirim balik ke browser malah redirect itu sendiri). Di sini
// sudah diperbaiki jadi fetch '/' saja.
//
// CARA PASANG:
// 1. Hapus functions/watch.js dan functions/assettest.js (sudah tidak kepakai).
// 2. Taruh file ini di: functions/w/[id].js
// 3. Ganti SITE_URL di bawah ke domain asli kamu.
// 4. (Disarankan) Set API_KEY sebagai Pages env var.
// 5. index.html juga perlu diupdate (lihat file terpisah) supaya baca id
//    dari path /w/:id lagi (bukan ?id=).

const API = 'https://vidoy-x.zalpro.workers.dev';
const SITE_URL = 'https://bacoltv.pages.dev'; // ganti sesuai domain asli kamu
const DEFAULT_IMAGE = 'https://i.ibb.co.com/5xvnqQjj/1000165671.png';
const THUMB_HOST = 'https://xpvid.cc';

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

export async function onRequest(context) {
  try {
    return await handle(context);
  } catch (err) {
    return new Response('SEO FUNCTION ERROR: ' + (err && err.stack ? err.stack : String(err)), {
      status: 500,
      headers: { 'content-type': 'text/plain; charset=utf-8' }
    });
  }
}

async function handle(context) {
  const { request, env, params } = context;
  const videoId = params.id;
  const API_KEY = env.API_KEY || 'hQwtIQTI22dJubmGhkKl';

  // FIX: fetch '/' (bukan '/index.html') — Pages redirect index.html -> / secara default
  const assetUrl = new URL('/', request.url);
  const originalResponse = await env.ASSETS.fetch(new Request(assetUrl, request));

  if (!videoId) return originalResponse;

  let video = null;
  try {
    const res = await fetch(API + '/video/' + videoId, {
      headers: { 'X-API-Key': API_KEY }
    });
    const json = await res.json();
    if (json.status === 'success') video = json.data;
  } catch (e) {
    return originalResponse;
  }

  if (!video) return originalResponse;

  const title = (video.title || 'Untitled').trim();
  const pageTitle = title + ' - Nonton Streaming | BACOLTV';
  const description = 'Nonton "' + title + '" streaming online gratis di BACOLTV. Kualitas HD, tanpa buffering.';
  let image = video.thumbnail || DEFAULT_IMAGE;
  if (image.startsWith('/')) image = THUMB_HOST + image;
  const canonicalUrl = SITE_URL + '/w/' + encodeURIComponent(videoId);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: title,
    description: description,
    thumbnailUrl: [image],
    uploadDate: new Date().toISOString(),
    contentUrl: canonicalUrl,
    embedUrl: canonicalUrl
  };

  class HeadRewriter {
    element(el) {
      el.append(
        '<meta property="og:title" content="' + escapeHtml(pageTitle) + '" />' +
        '<meta property="og:description" content="' + escapeHtml(description) + '" />' +
        '<meta property="og:image" content="' + escapeHtml(image) + '" />' +
        '<meta property="og:url" content="' + escapeHtml(canonicalUrl) + '" />' +
        '<meta property="og:type" content="video.other" />' +
        '<meta name="twitter:card" content="summary_large_image" />' +
        '<meta name="twitter:title" content="' + escapeHtml(pageTitle) + '" />' +
        '<meta name="twitter:description" content="' + escapeHtml(description) + '" />' +
        '<meta name="twitter:image" content="' + escapeHtml(image) + '" />' +
        '<link rel="canonical" href="' + escapeHtml(canonicalUrl) + '" />' +
        '<script type="application/ld+json">' + JSON.stringify(jsonLd) + '</script>',
        { html: true }
      );
    }
  }

  class TitleRewriter {
    element(el) {
      el.setInnerContent(pageTitle);
    }
  }

  class DescRewriter {
    element(el) {
      el.setAttribute('content', description);
    }
  }

  return new HTMLRewriter()
    .on('head', new HeadRewriter())
    .on('title', new TitleRewriter())
    .on('meta[name="description"]', new DescRewriter())
    .transform(originalResponse);
}
