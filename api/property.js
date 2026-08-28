import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { propertyname } = req.query;

    if (!propertyname) {
        return res.status(400).send('<!DOCTYPE html><html><head><title>400 Bad Request</title></head><body><h1>400 Bad Request</h1><p>Missing propertyname parameter</p></body></html>');
    }

    try {
        const scriptUrl = "https://script.google.com/macros/s/AKfycbxkBu-BIS1bzOKV-lDDeZNtXm3B8wfHHUNzgw6LJ-8QoyttAckjs2-mDYyz5zGOMKFDgQ/exec";
        const url = `${scriptUrl}?action=getProperties&t=${Date.now()}`;
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        let properties = await response.json();
        if (properties && properties.error) {
            throw new Error(properties.error);
        }

        // 1. Slug Matching
        const matchedProperty = properties.find(p => {
            if (!p.title) return false;
            const slug = p.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
            return slug === propertyname || String(p.id) === propertyname;
        });

        if (!matchedProperty) {
            return res.status(404).send('<!DOCTYPE html><html><head><title>404 Not Found</title></head><body><div style="padding: 100px 20px; text-align: center; width: 100%; font-family: sans-serif;"><h1>404 - Property Not Found</h1><a href="/search.html">Back to Search</a></div></body></html>');
        }

        // 2. SEO Variables Generation
        const escapeHtml = (unsafe) => {
            if (unsafe == null) return '';
            return String(unsafe)
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
        };

        const cleanSlug = matchedProperty.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
        const canonicalUrl = `https://properaindia.com/property-detail.html?propertyname=${cleanSlug}`;
        
        const titleText = `${matchedProperty.title} - Property Details | Propera India`;
        let rawDesc = "";
        if (Array.isArray(matchedProperty.description)) {
            rawDesc = matchedProperty.description.join(' ');
        } else if (matchedProperty.description) {
            rawDesc = String(matchedProperty.description);
        } else {
            rawDesc = `View details for ${matchedProperty.title} located in ${matchedProperty.location}.`;
        }
        const descText = rawDesc.substring(0, 160);

        let imgUrl = 'https://properaindia.com/assets/Logo.jpeg';
        if (matchedProperty.images && matchedProperty.images.length > 0) {
            const vImg = matchedProperty.images.find(img => img && typeof img === 'string' && img.startsWith('http') && !img.startsWith('video:'));
            if (vImg) imgUrl = vImg;
        }

        // 3. Server-Side JSON-LD Generation (Identical to SEO-003)
        let schemaType = "Accommodation";
        const typeStr = (matchedProperty.specs && matchedProperty.specs.type) ? String(matchedProperty.specs.type).toLowerCase() : '';
        if (typeStr.includes('apartment') || typeStr.includes('flat')) {
            schemaType = "Apartment";
        } else if (typeStr.includes('villa') || typeStr.includes('house')) {
            schemaType = "SingleFamilyResidence";
        }

        const propEntity = {
            "@type": schemaType,
            "@id": `${canonicalUrl}#property`,
            "name": matchedProperty.title,
            "description": rawDesc || undefined,
            "url": canonicalUrl,
            "image": imgUrl !== 'https://properaindia.com/assets/Logo.jpeg' ? [imgUrl] : undefined
        };

        if (matchedProperty.location) {
            propEntity.address = {
                "@type": "PostalAddress",
                "addressLocality": matchedProperty.location
            };
        }

        if (matchedProperty.specs && matchedProperty.specs.size) {
            const match = String(matchedProperty.specs.size).match(/(\d+(?:\.\d+)?)\s*sqft/i);
            if (match && match[1]) {
                propEntity.floorSize = {
                    "@type": "QuantitativeValue",
                    "value": parseFloat(match[1]),
                    "unitCode": "FTK"
                };
            }
        }

        if (matchedProperty.specs && matchedProperty.specs.configuration) {
            const configStr = String(matchedProperty.specs.configuration).toLowerCase();
            const match = configStr.match(/^([1-9])\s*bhk/i);
            if (match && match[1] && !configStr.includes('+')) {
                propEntity.numberOfBedrooms = parseInt(match[1], 10);
            }
        }

        let offerEntity = null;
        if (matchedProperty.priceRange && !String(matchedProperty.priceRange).toLowerCase().includes('request')) {
            const priceStr = String(matchedProperty.priceRange).toLowerCase();
            const numMatch = priceStr.match(/[\d\.]+/);
            if (numMatch) {
                let numericPrice = null;
                let basePrice = parseFloat(numMatch[0]);
                if (priceStr.includes('cr')) {
                    numericPrice = basePrice * 10000000;
                } else if (priceStr.includes('lakh') || priceStr.includes('lac')) {
                    numericPrice = basePrice * 100000;
                } else if (priceStr.includes('k')) {
                    numericPrice = basePrice * 1000;
                } else {
                    const rawNum = parseFloat(priceStr.replace(/[^\d\.]/g, ''));
                    if (!isNaN(rawNum) && rawNum > 0) numericPrice = rawNum;
                }
                
                if (numericPrice) {
                    offerEntity = {
                        "@type": "Offer",
                        "@id": `${canonicalUrl}#offer`,
                        "price": numericPrice,
                        "priceCurrency": "INR",
                        "itemOffered": { "@id": `${canonicalUrl}#property` }
                    };
                    if (matchedProperty.specs && matchedProperty.specs.intent) {
                        const intent = String(matchedProperty.specs.intent).toLowerCase();
                        if (intent === 'buy') offerEntity.businessFunction = "http://purl.org/goodrelations/v1#Sell";
                        else if (intent === 'rent') offerEntity.businessFunction = "http://purl.org/goodrelations/v1#LeaseOut";
                    }
                }
            }
        }

        const graph = {
            "@context": "https://schema.org",
            "@graph": [
                {
                    "@type": "WebPage",
                    "@id": `${canonicalUrl}#webpage`,
                    "url": canonicalUrl,
                    "name": matchedProperty.title,
                    "description": rawDesc || undefined,
                    "mainEntity": { "@id": `${canonicalUrl}#property` },
                    "breadcrumb": { "@id": `${canonicalUrl}#breadcrumb` },
                    "publisher": { "@id": "https://properaindia.com/#organization" }
                },
                propEntity,
                {
                    "@type": "BreadcrumbList",
                    "@id": `${canonicalUrl}#breadcrumb`,
                    "itemListElement": [
                        { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://properaindia.com/" },
                        { "@type": "ListItem", "position": 2, "name": "Search Properties", "item": "https://properaindia.com/search.html" },
                        { "@type": "ListItem", "position": 3, "name": matchedProperty.title, "item": canonicalUrl }
                    ]
                }
            ]
        };
        if (offerEntity) {
            graph["@graph"].push(offerEntity);
        }

        const safeJsonLd = JSON.stringify(graph).replace(/<\/script/gi, '<\\/script');

        // 4. Read HTML Shell
        const htmlPath = path.join(process.cwd(), 'property-detail.html');
        let htmlStr = fs.readFileSync(htmlPath, 'utf8');

        // 5. Inject Head SEO
        htmlStr = htmlStr.replace(/<title>.*?<\/title>/i, `<title>${escapeHtml(titleText)}</title>`);
        htmlStr = htmlStr.replace(/<meta name="description" content="[^"]*">/i, `<meta name="description" content="${escapeHtml(descText)}">`);

        // 5b. Inject Social OG & Twitter Metadata
        htmlStr = htmlStr.replace(/<meta property="og:title" content="[^"]*">/i, `<meta property="og:title" content="${escapeHtml(titleText)}">`);
        htmlStr = htmlStr.replace(/<meta property="og:description" content="[^"]*">/i, `<meta property="og:description" content="${escapeHtml(descText)}">`);
        htmlStr = htmlStr.replace(/<meta name="twitter:title" content="[^"]*">/i, `<meta name="twitter:title" content="${escapeHtml(titleText)}">`);
        htmlStr = htmlStr.replace(/<meta name="twitter:description" content="[^"]*">/i, `<meta name="twitter:description" content="${escapeHtml(descText)}">`);

        let socialInjection = `\n    <meta property="og:url" content="${escapeHtml(canonicalUrl)}">`;
        if (imgUrl !== 'https://properaindia.com/assets/Logo.jpeg') {
            socialInjection += `\n    <meta property="og:image" content="${escapeHtml(imgUrl)}">`;
            socialInjection += `\n    <meta property="og:image:alt" content="${escapeHtml(matchedProperty.title)}">`;
            socialInjection += `\n    <meta name="twitter:image" content="${escapeHtml(imgUrl)}">`;
            socialInjection += `\n    <meta name="twitter:image:alt" content="${escapeHtml(matchedProperty.title)}">`;
        }
        
        // Insert og:url and images right after the og:type tag
        htmlStr = htmlStr.replace(/(<meta property="og:type" content="website">)/i, `$1${socialInjection}`);
        
        const headInjection = `
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}">
    <script id="property-json-ld" type="application/ld+json">${safeJsonLd}</script>
`;
        htmlStr = htmlStr.replace('</head>', `${headInjection}</head>`);

        // 6. Inject visible crawler content into the UI wrappers
        htmlStr = htmlStr.replace(
            /<h1 class="prop-title text-h1"[^>]*>Loading\.\.\.<\/h1>/i, 
            `<h1 class="prop-title text-h1" style="font-size: 1.5rem; line-height: 1.2; margin-bottom: 0.15rem;">${escapeHtml(matchedProperty.title)}</h1>`
        );
        htmlStr = htmlStr.replace(
            /<p class="prop-subtitle text-muted"[^>]*>Loading details\.\.\.<\/p>/i, 
            `<p class="prop-subtitle text-muted" style="font-size: 0.85rem; margin-bottom: 0;">${escapeHtml(matchedProperty.location)}</p>`
        );
        htmlStr = htmlStr.replace(
            /<div class="prop-price text-h2"[^>]*>₹ --<\/div>/i, 
            `<div class="prop-price text-h2" style="color: var(--color-3); font-weight: 700; font-size: 1.3rem; margin-bottom: 0.15rem;">${escapeHtml(matchedProperty.priceRange || 'Price on Request')}</div>`
        );
        
        // Only inject image if it exists to avoid broken img tags
        if (imgUrl !== 'https://properaindia.com/assets/Logo.jpeg') {
            htmlStr = htmlStr.replace(
                /<img id="main-prop-image" src="assets\/Logo\.jpeg" alt="Loading Image"/i, 
                `<img id="main-prop-image" src="${escapeHtml(imgUrl)}" alt="${escapeHtml(matchedProperty.title)}"`
            );
        }

        htmlStr = htmlStr.replace(
            /<p>Loading property description\.\.\.<\/p>/i, 
            `<p>${escapeHtml(rawDesc)}</p>`
        );

        // 7. Return modified HTML
        res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=3600');
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.status(200).send(htmlStr);

    } catch (error) {
        console.error("Serverless rendering error:", error);
        return res.status(500).send('<!DOCTYPE html><html><head><title>500 Internal Error</title></head><body><h1>500 Internal Server Error</h1><p>Failed to render property.</p></body></html>');
    }
}
