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

async function fetchPage() {
  console.log(`[${new Date().toISOString()}] Fetching page...`);

  const res = await fetch(URL, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
      "Accept":
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });

  console.log(`Status: ${res.status}`);

  const html = await res.text();
  console.log(`HTML length: ${html.length}`);

  return html;
}

// 🔥 FIXED extractor (works with Pokémon site)
function extractProducts(html) {
  const matches = [...html.matchAll(/"url":"(\/product\/[^"]+)"/g)];

  const products = new Set(
    matches.map((m) =>
      "https://www.pokemoncenter.com" + m[1].replace(/\\\//g, "/")
    )
  );

  console.log(`Extracted ${products.size} product links`);

  return products;
}

async function sendDiscord(message) {
  await fetch(WEBHOOK, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      content: message,
    }),
  });

  console.log("Sent Discord alert");
}

async function run() {
  console.log("Bot started...");
  console.log(`Target: ${URL}`);
  console.log(`Interval: ${INTERVAL}ms`);

  while (true) {
    try {
      console.log("Checking page...");

      const html = await fetchPage();
      const products = extractProducts(html);

      if (lastSeen.size === 0) {
        console.log("First run — saving baseline");
        lastSeen = products;
      } else {
        let newItems = 0;

        for (const link of products) {
          if (!lastSeen.has(link)) {
            newItems++;
            console.log("NEW ITEM:", link);

            await sendDiscord(`🟢 NEW TCG ITEM:\n${link}`);
          }
        }

        console.log(`New items found: ${newItems}`);
        lastSeen = products;
      }
    } catch (err) {
      console.error("ERROR:", err.message);
    }

    await sleep(INTERVAL);
  }
}

run();