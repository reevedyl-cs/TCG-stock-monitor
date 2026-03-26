import dotenv from "dotenv";
dotenv.config();

const WEBHOOK = process.env.DISCORD_WEBHOOK_URL;
const URL = process.env.TARGET_URL;
const INTERVAL = Number(process.env.CHECK_INTERVAL_MS || 60000);

let lastSeen = new Set();

if (!WEBHOOK || !URL) {
  console.error("Missing env variables");
  process.exit(1);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ✅ PROXY FETCH (fixes 403)
async function fetchPage() {
  const proxyUrl = `https://r.jina.ai/${URL}`;

  console.log(`[${new Date().toISOString()}] Fetching via proxy...`);

  const res = await fetch(proxyUrl);

  console.log(`[${new Date().toISOString()}] Status: ${res.status}`);

  const html = await res.text();

  console.log(`[${new Date().toISOString()}] HTML length: ${html.length}`);

  return html;
}

// ✅ Extract product names (works with proxy output)
function extractProducts(html) {
  const products = new Set();

  const matches = [...html.matchAll(/https:\/\/www\.pokemoncenter\.com\/product\/[^\s"]+/g)];

  for (const match of matches) {
    products.add(match[0]);
  }

  console.log(
    `[${new Date().toISOString()}] Extracted ${products.size} products`
  );

  return products;
}

// ✅ Discord alert
async function sendDiscord(message) {
  const res = await fetch(WEBHOOK, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ content: message }),
  });

  console.log(
    `[${new Date().toISOString()}] Discord status: ${res.status}`
  );
}

async function run() {
  console.log("Bot started...");
  console.log(`Target: ${URL}`);
  console.log(`Interval: ${INTERVAL}ms`);

  while (true) {
    try {
      console.log(`[${new Date().toISOString()}] Checking page...`);

      const html = await fetchPage();
      const products = extractProducts(html);

      if (lastSeen.size === 0) {
        console.log("First run — saving baseline");
        lastSeen = products;
      } else {
        let newCount = 0;

        for (const item of products) {
          if (!lastSeen.has(item)) {
            newCount++;
            console.log("NEW ITEM:", item);

            await sendDiscord(`🟢 NEW TCG ITEM:\n${item}`);
          }
        }

        console.log(
          `[${new Date().toISOString()}] New items found: ${newCount}`
        );

        lastSeen = products;
      }
    } catch (err) {
      console.error("ERROR:", err.message);
    }

    console.log(`Sleeping ${INTERVAL}ms...\n`);
    await sleep(INTERVAL);
  }
}

run();