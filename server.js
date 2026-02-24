const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
app.use(cors());

// ✅ Serve all static files in your repo (index.html, mode1.html, mode2.html, /image, /vrm, etc.)
app.use(express.static(__dirname));

// ✅ Home page
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

// TikTok profile API (keep your code)
app.get("/api/tiktok/profile/:username", async (req, res) => {
  const raw = req.params.username || "";
  const username = raw.trim().replace(/^@+/, "").toLowerCase();

  if (!username) return res.status(400).json({ error: "missing username" });

  try {
    const url = `https://www.tiktok.com/@${encodeURIComponent(username)}`;

    const r = await fetch(url, {
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
        Referer: "https://www.tiktok.com/",
      },
    });

    const status = r.status;
    const html = await r.text();

    const looksBlocked =
      status === 403 ||
      status === 429 ||
      /verify|captcha|blocked|Access Denied|enable javascript/i.test(html);

    // SIGI_STATE
    const sigi = html.match(
      /<script[^>]*id="SIGI_STATE"[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/
    );
    if (sigi) {
      const data = JSON.parse(sigi[1]);
      const users = data?.UserModule?.users;
      const firstUser = users ? Object.values(users)[0] : null;

      if (firstUser?.nickname) {
        return res.json({
          data: {
            username,
            nickname: firstUser.nickname,
            avatar: firstUser.avatarLarger || firstUser.avatarThumb || "",
          },
        });
      }
    }

    // UNIVERSAL_DATA
    const uni = html.match(
      /<script[^>]*id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/
    );
    if (uni) {
      const u = JSON.parse(uni[1]);
      const user =
        u?.__DEFAULT_SCOPE__?.["webapp.user-detail"]?.userInfo?.user ||
        u?.__DEFAULT_SCOPE__?.["webapp.user-detail"]?.user ||
        null;

      if (user?.nickname || user?.uniqueId) {
        return res.json({
          data: {
            username: user.uniqueId || username,
            nickname: user.nickname || user.uniqueId || username,
            avatar: user.avatarLarger || user.avatarThumb || "",
          },
        });
      }
    }

    return res.status(404).json({
      error: "profile not found",
      debug: {
        status,
        blocked: looksBlocked,
        hint: looksBlocked
          ? "TikTok likely blocked the request from your IP/server. Use Apify/RapidAPI for reliable results."
          : "TikTok returned HTML without embedded user JSON (format changed or restricted).",
      },
    });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

// ✅ IMPORTANT for Render:
const PORT = process.env.PORT || 8787;
app.listen(PORT, () => console.log("✅ Running on port", PORT));
