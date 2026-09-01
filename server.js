/**
 * KaamSaathi backend
 * ---------------------------------------------------------------
 * A small, real Express API. Data is stored in JSON files on disk
 * (data/workers.json, data/messages.json) so it survives page
 * refreshes and works across every visitor, not just one browser.
 *
 * This is a genuine, working backend suitable for a small directory
 * app. If you outgrow it later (thousands of workers, many admins,
 * concurrent heavy writes), the natural next step is swapping the
 * file storage for a real database like PostgreSQL — the API routes
 * below would stay almost identical.
 *
 * Run locally:   npm install && npm start
 * Deploy:        see README.md
 * ---------------------------------------------------------------
 */

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 4000;
const ADMIN_KEY = process.env.ADMIN_KEY || "change-me"; // set a real one in .env

const WORKERS_FILE = path.join(__dirname, "data", "workers.json");
const MESSAGES_FILE = path.join(__dirname, "data", "messages.json");

app.use(cors());
app.use(express.json());

/* ---------------------------------------------------------------
   Tiny file-based data helpers
   --------------------------------------------------------------- */
function readJSON(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch (err) {
    console.error(`Failed to read ${file}:`, err.message);
    return fallback;
  }
}
function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf-8");
}
function getWorkers() {
  return readJSON(WORKERS_FILE, []);
}
function saveWorkers(workers) {
  writeJSON(WORKERS_FILE, workers);
}
function getMessages() {
  return readJSON(MESSAGES_FILE, []);
}
function saveMessages(messages) {
  writeJSON(MESSAGES_FILE, messages);
}
function avgRating(worker) {
  if (!worker.reviews.length) return 0;
  return worker.reviews.reduce((s, r) => s + r.rating, 0) / worker.reviews.length;
}
function requireAdmin(req, res, next) {
  if (req.headers["x-admin-key"] !== ADMIN_KEY) {
    return res.status(401).json({ error: "Unauthorized. Missing or incorrect admin key." });
  }
  next();
}

/* ---------------------------------------------------------------
   Public routes
   --------------------------------------------------------------- */

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// List workers, with optional filtering/sorting via query params
// e.g. /api/workers?trade=plumber&area=Jamalpur&search=ra&sort=top
app.get("/api/workers", (req, res) => {
  let workers = getWorkers();
  const { trade, area, search, sort } = req.query;

  if (trade) workers = workers.filter((w) => w.trade === trade);
  if (area) workers = workers.filter((w) => w.area === area);
  if (search) {
    const q = search.toLowerCase();
    workers = workers.filter(
      (w) => w.name.toLowerCase().includes(q) || w.trade.toLowerCase().includes(q)
    );
  }

  const withRatings = workers.map((w) => ({
    ...w,
    rating: avgRating(w),
    reviewCount: w.reviews.length,
  }));

  if (sort === "reviews") withRatings.sort((a, b) => b.reviewCount - a.reviewCount);
  else if (sort === "az") withRatings.sort((a, b) => a.name.localeCompare(b.name));
  else withRatings.sort((a, b) => (b.premium - a.premium) || (b.rating - a.rating)); // "top" default

  res.json(withRatings);
});

app.get("/api/workers/:id", (req, res) => {
  const workers = getWorkers();
  const worker = workers.find((w) => w.id === req.params.id);
  if (!worker) return res.status(404).json({ error: "Worker not found" });
  res.json({ ...worker, rating: avgRating(worker), reviewCount: worker.reviews.length });
});

// Submit a review — this is the "data actually saves" part.
app.post("/api/workers/:id/reviews", (req, res) => {
  const { name, rating, comment } = req.body || {};

  if (!name || !comment || !rating) {
    return res.status(400).json({ error: "name, rating and comment are all required." });
  }
  const numRating = Number(rating);
  if (!Number.isInteger(numRating) || numRating < 1 || numRating > 5) {
    return res.status(400).json({ error: "rating must be a whole number from 1 to 5." });
  }

  const workers = getWorkers();
  const worker = workers.find((w) => w.id === req.params.id);
  if (!worker) return res.status(404).json({ error: "Worker not found" });

  worker.reviews.push({
    name: String(name).slice(0, 80),
    rating: numRating,
    comment: String(comment).slice(0, 500),
    date: new Date().toISOString().slice(0, 10),
  });

  saveWorkers(workers);
  res.status(201).json({ ...worker, rating: avgRating(worker), reviewCount: worker.reviews.length });
});

// Contact form submissions — saved so you can read them later.
app.post("/api/contact", (req, res) => {
  const { name, email, message } = req.body || {};
  if (!name || !email || !message) {
    return res.status(400).json({ error: "name, email and message are all required." });
  }
  const messages = getMessages();
  messages.push({
    name: String(name).slice(0, 100),
    email: String(email).slice(0, 150),
    message: String(message).slice(0, 1000),
    date: new Date().toISOString(),
  });
  saveMessages(messages);
  res.status(201).json({ success: true });
});

/* ---------------------------------------------------------------
   Admin routes — require header:  x-admin-key: <ADMIN_KEY>
   Use these (via a tool like Postman, or a future admin page) to
   manage listings without editing JSON by hand.
   --------------------------------------------------------------- */

// Add a new worker
app.post("/api/workers", requireAdmin, (req, res) => {
  const { id, name, trade, area, phone, bio } = req.body || {};
  if (!id || !name || !trade || !area || !phone) {
    return res.status(400).json({ error: "id, name, trade, area and phone are required." });
  }
  const workers = getWorkers();
  if (workers.some((w) => w.id === id)) {
    return res.status(409).json({ error: "A worker with this id already exists." });
  }
  const newWorker = {
    id, name, trade, area, phone, bio: bio || "",
    verified: !!req.body.verified,
    premium: !!req.body.premium,
    isNew: true,
    reviews: [],
  };
  workers.push(newWorker);
  saveWorkers(workers);
  res.status(201).json(newWorker);
});

// Update a worker (e.g. toggle verified/premium badges)
app.patch("/api/workers/:id", requireAdmin, (req, res) => {
  const workers = getWorkers();
  const worker = workers.find((w) => w.id === req.params.id);
  if (!worker) return res.status(404).json({ error: "Worker not found" });

  const editable = ["name", "trade", "area", "phone", "bio", "verified", "premium", "isNew"];
  editable.forEach((field) => {
    if (req.body[field] !== undefined) worker[field] = req.body[field];
  });

  saveWorkers(workers);
  res.json(worker);
});

// Delete a worker
app.delete("/api/workers/:id", requireAdmin, (req, res) => {
  let workers = getWorkers();
  const exists = workers.some((w) => w.id === req.params.id);
  if (!exists) return res.status(404).json({ error: "Worker not found" });
  workers = workers.filter((w) => w.id !== req.params.id);
  saveWorkers(workers);
  res.json({ success: true });
});

// Read contact form submissions
app.get("/api/messages", requireAdmin, (req, res) => {
  res.json(getMessages());
});

app.listen(PORT, () => {
  console.log(`KaamSaathi backend running on http://localhost:${PORT}`);
});
