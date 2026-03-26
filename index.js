import dotenv from "dotenv";
dotenv.config();

const WEBHOOK = process.env.DISCORD_WEBHOOK_URL;
const URL = process.env.TARGET_URL;
const INTERVAL = Number(process.env.CHECK_INTERVAL_MS || 60000);

let lastSeen = new Set();

if (!WEBHOOK) {
  console.error("Missing DISCORD_WEBHOOK_URL");
  process.exit(1);
}

if (!URL) {
  console.error("Missing TARGET_URL");
  process.exit(1);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchPage() {
  console.log(`[${new Date().toISOString()}] Fetching page: ${URL}`);

  const res = await fetch(URL, {
    headers: {
      "User-Agent": "Mozilla/5.0"
    }
  });

  console.log(`[${new Date().toISOString()}] Response status: ${res.status}`);

  const text = await res.text();
  console.log(`[${new Date().toISOString()}] HTML length: ${text.length}`);

  return text;
}

function extractProducts(html) {
  const matches = [...html.matchAll(/href="(\/product\/[^"]+)"/g)];
  const products = new Set(matches.map((m) => "https://www.pokemoncenter.com" + m[1]));

  console.log(
    `[${new Date().toISOString()}] Extracted ${products.size} product links`
  );

  return products;
}

async function sendDiscord(message) {
  console.log(`[${new Date().toISOString()}] Sending Discord message...`);

  const response = await fetch(WEBHOOK, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ content: message })
  });

  console.log(
    `[${new Date().toISOString()}] Discord response status: ${response.status}`
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Discord webhook failed: ${response.status} ${body}`);
  }
}

async function run() {
  console.log("Bot started...");
  console.log(`Target URL: ${URL}`);
  console.log(`Check interval: ${INTERVAL}ms`);

  while (true) {
    try {
      console.log(`[${new Date().toISOString()}] Checking page...`);

      const html = await fetchPage();
      const products = extractProducts(html);

      if (lastSeen.size === 0) {
        console.log(
          `[${new Date().toISOString()}] First run detected. Saving ${products.size} items without alerting.`
        );
        lastSeen = products;
      } else {
        let newCount = 0;

        for (const link of products) {
          if (!lastSeen.has(link)) {
            newCount += 1;
            console.log(`[${new Date().toISOString()}] NEW ITEM DETECTED: ${link}`);
            await sendDiscord(`🟢 New TCG item detected:\n${link}`);
          }
        }

        console.log(
          `[${new Date().toISOString()}] Check complete. New items found: ${newCount}`
        );

        lastSeen = products;
      }
    } catch (err) {
      console.error(`[${new Date().toISOString()}] Error: ${err.message}`);
    }

    console.log(
      `[${new Date().toISOString()}] Sleeping for ${INTERVAL}ms...`
    );
    await sleep(INTERVAL);
  }
}

run();