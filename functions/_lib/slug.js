// functions/_lib/slug.js
//
// Helper kecil buat pola URL /watch/judul-video-{id}.
// Dipakai oleh functions/watch/[slug].js (dan nanti oleh index.html saat
// kartu video diubah jadi link <a href="/watch/..."> beneran).

export function slugify(title) {
  return String(title || 'video')
    .toLowerCase()
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '') // buang aksen
    .replace(/[^a-z0-9\s-]/g, '')  // buang simbol/tanda baca
    .trim()
    .replace(/\s+/g, '-')          // spasi -> strip
    .replace(/-+/g, '-')           // rapikan strip dobel
    .replace(/^-|-$/g, '')         // buang strip di ujung
    .slice(0, 70);                 // jaga URL tetap wajar panjangnya
}

// Video id dari Worker API (file code Lulustream/Doodstream) selalu
// alfanumerik tanpa strip, jadi id selalu jadi segmen TERAKHIR setelah
// strip paling akhir di slug "judul-video-{id}".
export function extractIdFromSlug(slug) {
  if (!slug) return null;
  var parts = String(slug).split('-');
  return parts.length ? parts[parts.length - 1] : null;
}

// Dipakai untuk video ("judul-video-{id}") maupun kategori ("nama-kategori-{fld_id}") —
// pola & aturan ekstraksi id-nya sama persis, cuma beda konteks pemakaian.
export function buildSlug(title, id) {
  var base = slugify(title);
  return (base ? base + '-' : '') + id;
}

export function buildWatchSlug(title, id) {
  return buildSlug(title, id);
}

export function buildCategorySlug(title, id) {
  return buildSlug(title, id);
      }
