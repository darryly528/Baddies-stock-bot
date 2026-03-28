const fs = require('fs');
const path = require('path');

const folder = path.join(__dirname, 'images');
if (!fs.existsSync(folder)) fs.mkdirSync(folder);

async function updateCatalog() {
    let allItems = [];
    for (let page = 1; page <= 55; page++) {
        console.log(`Fetching page ${page}...`);
        try {
            const res = await fetch(`https://bloxtsar.com/api/baddies/catalog?page=${page}&limit=40&sort=value_desc`);
            if (!res.ok) {
                console.log(`⚠️ Page ${page} returned HTTP ${res.status}`);
                continue;
            }
            const data = await res.json();

            let items = [];
            if (Array.isArray(data)) items = data;
            else if (Array.isArray(data.data)) items = data.data;
            else if (Array.isArray(data.items)) items = data.items;
            else if (typeof data === 'object' && data !== null) items = [data];

            allItems.push(...items);
        } catch (err) {
            console.log(`❌ Error fetching page ${page}: ${err.message}`);
        }
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    fs.writeFileSync('catalog.json', JSON.stringify(allItems, null, 2));
    console.log(`✅ Catalog saved with ${allItems.length} items`);

    // Download images
    for (const item of allItems) {
        if (!item.imageUrl) continue;
        const safeName = item.name.replace(/[^a-z0-9]/gi, '_');
        const ext = path.extname(item.imageUrl).split('?')[0] || '.png';
        const filePath = path.join(folder, `${item.itemId}_${safeName}${ext}`);
        if (fs.existsSync(filePath)) continue;
        try {
            const res = await fetch(item.imageUrl);
            if (!res.ok) {
                console.log(`⚠️ Failed to fetch image for ${item.name}, HTTP ${res.status}`);
                continue;
            }
            const buffer = await res.arrayBuffer();
            fs.writeFileSync(filePath, Buffer.from(buffer));
            console.log(`Downloaded: ${item.itemId}_${safeName}${ext}`);
        } catch (err) {
            console.log(`❌ Failed to download ${item.name}: ${err.message}`);
        }
    }
}

module.exports = { updateCatalog };
