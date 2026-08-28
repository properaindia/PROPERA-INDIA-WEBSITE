export default async function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const scriptUrl = "https://script.google.com/macros/s/AKfycbxkBu-BIS1bzOKV-lDDeZNtXm3B8wfHHUNzgw6LJ-8QoyttAckjs2-mDYyz5zGOMKFDgQ/exec";
        const url = `${scriptUrl}?action=getProperties&t=${Date.now()}`;
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const properties = await response.json();
        if (properties && properties.error) {
            throw new Error(properties.error);
        }

        if (!Array.isArray(properties)) {
            throw new Error('Invalid API response format (expected array)');
        }

        const escapeXml = (unsafe) => {
            if (unsafe == null) return '';
            return String(unsafe)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&apos;');
        };

        const seenUrls = new Set();

        const addUrl = (loc, priority = '0.8', changefreq = 'daily') => {
            if (seenUrls.has(loc)) return '';
            seenUrls.add(loc);
            return `  <url>\n    <loc>${escapeXml(loc)}</loc>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>\n`;
        };

        let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

        // Add core static pages (using canonical versions)
        xml += addUrl('https://properaindia.com/', '1.0');
        xml += addUrl('https://properaindia.com/search.html', '0.9');
        xml += addUrl('https://properaindia.com/about-contact.html', '0.8', 'monthly');
        xml += addUrl('https://properaindia.com/post-property.html', '0.8', 'monthly');
        xml += addUrl('https://properaindia.com/premium-services.html', '0.8', 'monthly');

        // Add dynamic properties
        let duplicateSlugsCount = 0;
        let validPropertyCount = 0;

        properties.forEach(p => {
            if (!p.title) return; // Must have a title to generate a valid slug
            
            const slug = String(p.title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
            if (!slug) return;

            const loc = `https://properaindia.com/property-detail.html?propertyname=${slug}`;
            
            if (seenUrls.has(loc)) {
                duplicateSlugsCount++;
                return;
            }

            xml += addUrl(loc, '0.8', 'weekly');
            validPropertyCount++;
        });

        xml += `</urlset>`;

        // Log stats for server observability
        console.log(`Generated sitemap with ${validPropertyCount} properties. Deduplicated ${duplicateSlugsCount} collisions.`);

        // Serve with Vercel edge caching (1 hour max age, 1 day stale-while-revalidate)
        // Since sitemap isn't needed instantly, a 1-hour cache prevents excessive API hits.
        res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
        res.setHeader('Content-Type', 'application/xml; charset=utf-8');
        return res.status(200).send(xml);

    } catch (error) {
        console.error("Sitemap generation error:", error);
        // Do NOT return a 200 with an empty sitemap. Return 500 error.
        return res.status(500).json({ error: 'Failed to generate sitemap' });
    }
}
