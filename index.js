import dotenv from "dotenv";
dotenv.config();

const WEBHOOK = process.env.DISCORD_WEBHOOK_URL;
const URL = process.env.TARGET_URL;
const INTERVAL = Number(process.env.CHECK_INTERVAL_MS || 60000);

let lastSeen = new Set();

async function fetchPage() {
  const res = await fetch(URL, {
    headers: {
      "User-Agent": "Mozilla/5.0"
    }
  });

  return await res.text();
}

function extractProducts(html) {
  const matches = [...html.matchAll(/href="(\/product\/[^"]+)"/g)];
  return new Set(matches.map(m => "https://www.pokemoncenter.com" + m[1]));
}

async function sendDiscord(message) {
  await fetch(WEBHOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: message })
  });
}

async function run() {
  console.log("Bot started...");

  while (true) {
    try {
      const html = await fetchPage();
      const products = extractProducts(html);

      for (const link of products) {
        if (!lastSeen.has(link)) {
          console.log("NEW ITEM:", link);

          await sendDiscord(`🟢 New TCG item detected:\n${link}`);
        }
      }

      lastSeen = products;

    } catch (err) {
      console.error("Error:", err.message);
    }

    await new Promise(r => setTimeout(r, INTERVAL));
  }
}

run();