// functions/category/[slug].js
//
// Halaman kategori BENERAN: bacoltv.com/category/nama-kategori-{fld_id}
// Bedanya dengan pola client-side rendering biasa: daftar video di dalam
// kategori dirender jadi <a href="/watch/..."> LANGSUNG di HTML dari server
// (lihat renderVideoCards di bawah) — supaya Googlebot bisa lihat & ikuti
// link video tanpa perlu eksekusi JS dulu. JS di category.html cuma
// nambahin polish (lazy-load gambar, dll), bukan sumber utama link-nya.
//
// CARA PASANG:
// 1. Taruh file ini di: functions/category/[slug].js
// 2. Taruh category.html di root project, sejajar index.html & watch.html
// 3. (Disarankan) Set API_KEY sebagai Pages env var

import { extractIdFromSlug, buildCategorySlug, buildWatchSlug, slugify } from '../_lib/slug.js';

const API = 'https://vidoy-x.zalpro.workers.dev';
const SITE_URL = 'https://bacoltv.pages.dev'; // ganti ke domain asli kamu
const DEFAULT_IMAGE = 'https://i.ibb.co.com/5xvnqQjj/1000165671.png';
const THUMB_HOST = 'https://xpvid.cc';

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function resolveThumb(thumb) {
  if (!thumb) return DEFAULT_IMAGE;
  return thumb.startsWith('/') ? THUMB_HOST + thumb : thumb;
}

// Judul kategori dipakai buat <title>/meta. Kalau API tidak balikin field
// judul folder secara eksplisit, turunkan dari bagian judul di slug URL
// (mis. "film-aksi-terbaru-xyz123" -> "film aksi terbaru").
function titleFromSlugFallback(slug, id) {
  var body = slug.slice(0, slug.length - id.length).replace(/-$/, '');
  var words = body.split('-').filter(Boolean);
  return words.map(function(w) { return w.charAt(0).toUpperCase() + w.slice(1); }).join(' ') || 'Kategori';
}

function renderVideoCards(videos) {
  return videos.map(function(v) {
    var title = escapeHtml(v.title || 'Untitled');
    var thumb = escapeHtml(resolveThumb(v.thumbnail));
    var watchSlug = buildWatchSlug(v.title, v.id);
    var href = '/watch/' + watchSlug;
    return (
      '<a class="poster" href="' + href + '">' +
        '<div class="poster-thumb">' +
          '<div class="pbg" style="background-image:url(\'' + thumb + '\')"></div>' +
          '<img src="' + thumb + '" alt="' + title + '" loading="lazy" decoding="async">' +
        '</div>' +
        '<div class="poster-title">' + title + '</div>' +
      '</a>'
    );
  }).join('');
}

function renderSubfolderChips(subfolders) {
  if (!subfolders || !subfolders.length) return '';
  return '<div class="subcat-row">' + subfolders.map(function(f) {
    var slug = buildCategorySlug(f.title, f.id);
    return '<a class="subcat-chip" href="/category/' + slug + '">' + escapeHtml(f.title || 'Kategori') + '</a>';
  }).join('') + '</div>';
}

export async function onRequest(context) {
  try {
    return await handle(context);
  } catch (err) {
    return new Response('CATEGORY FUNCTION ERROR: ' + (err && err.stack ? err.stack : String(err)), {
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

  let data = null;
  try {
    const res = await fetch(API + '/folder/' + id, { headers: { 'X-API-Key': API_KEY } });
    const json = await res.json();
    if (json.status === 'success') data = json.data;
  } catch (e) {
    data = null;
  }

  if (!data) return Response.redirect(SITE_URL, 302);

  const videos = data.videos || [];
  const subfolders = data.subfolders || [];
  const categoryTitle = (data.title || data.name || titleFromSlugFallback(slug, id)).trim();

  // 301 ke slug kanonik kalau bagian judul di URL tidak sesuai judul asli
  const canonicalSlug = buildCategorySlug(categoryTitle, id);
  if (slug !== canonicalSlug) {
    return Response.redirect(SITE_URL + '/category/' + canonicalSlug, 301);
  }

  const assetUrl = new URL('/category.html', request.url);
  const originalResponse = await env.ASSETS.fetch(new Request(assetUrl, request));

  const pageTitle = categoryTitle + ' - Nonton Streaming | BACOLTV';
  const description = 'Kumpulan video ' + categoryTitle + ' streaming online gratis di BACOLTV. ' + videos.length + ' video tersedia, kualitas HD.';
  const image = videos.length ? resolveThumb(videos[0].thumbnail) : DEFAULT_IMAGE;
  const canonicalUrl = SITE_URL + '/category/' + canonicalSlug;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: categoryTitle,
    description: description,
    url: canonicalUrl
  };

  const gridHtml = renderSubfolderChips(subfolders) + renderVideoCards(videos);

  class HeadRewriter {
    element(el) {
      el.append(
        '<meta property="og:title" content="' + escapeHtml(pageTitle) + '" />' +
        '<meta property="og:description" content="' + escapeHtml(description) + '" />' +
        '<meta property="og:image" content="' + escapeHtml(image) + '" />' +
        '<meta property="og:url" content="' + escapeHtml(canonicalUrl) + '" />' +
        '<meta property="og:type" content="website" />' +
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
    element(el) { el.setInnerContent(pageTitle); }
  }
  class DescRewriter {
    element(el) { el.setAttribute('content', description); }
  }
  class HeadingRewriter {
    element(el) { el.setInnerContent(categoryTitle); }
  }
  class GridRewriter {
    element(el) {
      if (videos.length || subfolders.length) {
        el.setInnerContent(gridHtml, { html: true });
      } else {
        el.setInnerContent('<div class="cat-empty">Belum ada video di kategori ini</div>', { html: true });
      }
    }
  }

  return new HTMLRewriter()
    .on('head', new HeadRewriter())
    .on('title', new TitleRewriter())
    .on('meta[name="description"]', new DescRewriter())
    .on('#cat-heading', new HeadingRewriter())
    .on('#cat-grid', new GridRewriter())
    .transform(originalResponse);
                }
            
