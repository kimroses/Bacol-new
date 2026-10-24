// functions/watch/[slug].js
//
// Halaman video BENERAN (bukan SPA pushState lagi): bacoltv.com/watch/judul-video-{id}
// Menggantikan pola lama /w/:id yang cuma menyuntik meta tag ke atas index.html
// SPA — di sini tiap video punya HTML page sendiri (watch.html) yang di-render
// server-side dengan meta SEO + JSON-LD lengkap, supaya:
//   1. Google/Googlebot & share sosmed dapat halaman video yang genuinely berbeda
//      per URL (bukan homepage yang sama untuk semua video).
//   2. Tiap buka video = real page navigation (bukan history.pushState) — penting
//      buat compliance beberapa jaringan iklan yang menganggap SPA sebagai 1x pageview.
//
// CARA PASANG:
// 1. Taruh file ini di: functions/watch/[slug].js
// 2. Taruh functions/_lib/slug.js (helper slugify/extractIdFromSlug/buildWatchSlug)
// 3. Taruh watch.html di root project, sejajar index.html
// 4. (Disarankan) Set API_KEY sebagai Pages env var, bukan cuma fallback hardcode di kode
// 5. SITE_URL di bawah WAJIB diganti ke domain asli begitu sudah pindah dari *.pages.dev

import { extractIdFromSlug, buildWatchSlug } from '../_lib/slug.js';

const API = 'https://onlyflix-api.sugiono.workers.dev';
const SITE_URL = 'https://onlyflix.pages.dev'; // ganti ke domain asli kamu
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
    return new Response('WATCH FUNCTION ERROR: ' + (err && err.stack ? err.stack : String(err)), {
      status: 500,
      headers: { 'content-type': 'text/plain; charset=utf-8' }
    });
  }
}

async function handle(context) {
  const { request, env, params } = context;
  const slug = params.slug;
  const API_KEY = env.API_KEY || 'hQwtIQTI22dJubmGhkKl';

  const id = extractIdFromSlug(slug);
  if (!id) return Response.redirect(SITE_URL, 302);

  let video = null;
  try {
    const res = await fetch(API + '/video/' + id, { headers: { 'X-API-Key': API_KEY } });
    const json = await res.json();
    if (json.status === 'success') video = json.data;
  } catch (e) {
    video = null;
  }

  // Id salah / video sudah dihapus dari database -> balik ke home, bukan 500/blank page.
  if (!video) return Response.redirect(SITE_URL, 302);

  // 301 ke slug kanonik kalau bagian judul di URL beda dari hasil slugify judul asli
  // (mis. orang share link versi lama / edit manual) -> cegah duplicate content di Google.
  const canonicalSlug = buildWatchSlug(video.title, id);
  if (slug !== canonicalSlug) {
    return Response.redirect(SITE_URL + '/watch/' + canonicalSlug, 301);
  }

  const assetUrl = new URL('/watch', request.url);
  const originalResponse = await env.ASSETS.fetch(new Request(assetUrl, request));

  const title = (video.title || 'Untitled').trim();
  const pageTitle = title + ' - Nonton Streaming | BACOLTV';
  const description = 'Nonton "' + title + '" streaming online gratis di BACOLTV. Kualitas HD, tanpa buffering.';
  let image = video.thumbnail || DEFAULT_IMAGE;
  if (image.startsWith('/')) image = THUMB_HOST + image;
  const canonicalUrl = SITE_URL + '/watch/' + canonicalSlug;

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

  // Data awal disuntik langsung ke halaman supaya watch.html TIDAK perlu fetch
  // /video/:id lagi di client (Function ini sudah fetch di atas) -> player mulai
  // loading lebih cepat, dan konsisten sama data yang dipakai untuk meta tag.
  const initialData = { id: id, title: title, thumbnail: image };

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
        '<script type="application/ld+json">' + JSON.stringify(jsonLd) + '</script>' +
        '<script>window.__VIDEO_INITIAL__ = ' + JSON.stringify(initialData) + ';</script>',
        { html: true }
      );
    }
  }

  class TitleRewriter {
    element(el) { el.setInnerContent(pageTitle); }
  }

  class DescRewriter {
    element(el) { el.setAttribute('content', description); }
  }

  return new HTMLRewriter()
    .on('head', new HeadRewriter())
    .on('title', new TitleRewriter())
    .on('meta[name="description"]', new DescRewriter())
    .transform(originalResponse);
}
