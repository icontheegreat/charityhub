const express = require("express");
const path = require("path");
const { MongoClient, ObjectId } = require("mongodb");
const app = express();
const cloudinary = require("cloudinary").v2;
const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "dos7dadyo",
  api_key: process.env.CLOUDINARY_API_KEY || "296326773566931",
  api_secret:
    process.env.CLOUDINARY_API_SECRET || "5LSWq4s0aT7ix3b0LIMQRQ7WaC4",
});

// Configure Multer with Cloudinary storage
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "charityhub/proofs",
    allowed_formats: ["jpg", "png", "jpeg"],
  },
});
const upload = multer({ storage: storage });
// MongoDB connection setup
const uri =
  process.env.MONGO_URI ||
  "mongodb+srv://charityhub-new:myUche12@charityhub.gseth8e.mongodb.net/charityhub?retryWrites=true&w=majority&appName=CharityHub"; // Updated with username, password, and database name
const client = new MongoClient(uri);

// Connect to MongoDB
async function connectToMongo() {
  try {
    await client.connect();
    console.log("Connected to MongoDB");
  } catch (error) {
    console.error("MongoDB connection error:", error.message);
  }
}
connectToMongo();

// Set the view engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Serve static files (like CSS, images, JS)
app.use(express.static(path.join(__dirname, "public")));

// Middleware to parse form data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// List of organizations
const organizations = [
  { name: "Helping Hands", slug: "helping-hands" },
  { name: "Beacon of Hope", slug: "beacon-of-hope" },
  { name: "Baobab Foundation", slug: "baobab" },
];

// Home route
app.get("/", async (req, res) => {
  try {
    const db = client.db("charityhub");
    const totalDonations = await db.collection("donations").countDocuments();

    res.render("index", { organizations, totalDonations });
  } catch (err) {
    console.error("Error loading homepage:", err.message);
    res.render("index", { organizations, totalDonations: 0 });
  }
});

// Donate page (GET)
app.get("/donate/:org?", (req, res) => {
  const orgSlug = req.params.org || req.query.org || "";
  const org = organizations.find((o) => o.slug === orgSlug) || null;
  const formattedOrg = org
    ? org.name
    : orgSlug
    ? orgSlug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : "";
  console.log("Donate route - orgSlug:", orgSlug, "org:", org);
  res.render("donate", { org, formattedOrg, organizations });
});
console.log("Donation saved to MongoDB:", result.insertedId);
res.redirect(`/donate-crypto?donationId=${result.insertedId}`);

// Handle donation form submission (POST)
app.post("/donate", async (req, res) => {
  const { org, name, email, amount, crypto } = req.body;
  if (!org || !name || !email || !amount || !crypto) {
    console.error("Missing form data:", req.body);
    return res
      .status(400)
      .render("error", { message: "All fields are required" });
  }
  const donation = {
    org,
    name,
    email,
    amount: parseFloat(amount),
    crypto,
    status: "Pending",
    createdAt: new Date(),
  };
  try {
    const db = client.db("charityhub");
    const result = await db.collection("donations").insertOne(donation);
    console.log("Donation saved to MongoDB:", result.insertedId);
    res.redirect(`/donate-crypto?donationId=${result.insertedId}`);
  } catch (error) {
    console.error("Error saving donation:", error.message);
    res.status(500).render("error", { message: "Error saving donation" });
  }
});

// Donation confirmation page
app.get("/donate-crypto", async (req, res) => {
  const donationId = req.query.donationId;
  const donation = await db
    .collection("donations")
    .findOne({ _id: new ObjectId(donationId) });
  console.log("Donate-crypto - Found donation:", donation);
  if (!donation) {
    return res.status(404).render("error", { message: "Donation not found" });
  }
  try {
    const db = client.db("charityhub");
    const donation = await db
      .collection("donations")
      .findOne({ _id: new ObjectId(donationId) });
    if (!donation) {
      return res.status(404).render("error", { message: "Donation not found" });
    }
    const cryptoAddresses = {
      bitcoin: "1MYtXT98J2bu5yGxAv3tMRbigyRT8ZKjE1",
      solana: "FSRnivo8MHvWJgJZ3ymzf54NMJ3cUX12iWojpW3Rehn9",
      usdt: "TUtu3FS3yhcwHT3qdcrVJ1xoBGavsAYViM",
      ethereum: "0x8c169f53938da10fb04606a0ffc05ed2fb2c4a7a",
    };

    const selectedCrypto = (donation.crypto || "").toLowerCase();
    const address = cryptoAddresses[selectedCrypto] || "Address not available";
    console.log("Selected Crypto:", selectedCrypto);
    console.log("Resolved Address:", address);

    res.render("donate-crypto", { donation, address });
  } catch (error) {
    console.error("Error fetching donation:", error.message);
    res.status(500).render("error", { message: "Error fetching donation" });
  }
});

// Confirm donation with image upload
app.post("/confirm-donation", upload.single("proofImage"), async (req, res) => {
  const donationId = req.body.donationId;
  console.log("Confirm donation - donationId:", donationId);
  try {
    const db = client.db("charityhub");
    const proofImageUrl = req.file ? req.file.path : null;
    if (!proofImageUrl) {
      return res
        .status(400)
        .render("error", { message: "Proof of payment image is required" });
    }
    const result = await db
      .collection("donations")
      .updateOne(
        { _id: new ObjectId(donationId) },
        { $set: { status: "Pending Approval", proofImageUrl } }
      );
    if (result.matchedCount === 0) {
      return res.status(404).render("error", { message: "Donation not found" });
    }
    res.redirect(`/success-crypto?donationId=${donationId}`);
  } catch (error) {
    console.error("Error confirming donation:", error.message);
    res.status(500).render("error", { message: "Error confirming donation" });
  }
});

// Success page
app.get("/success-crypto", async (req, res) => {
  const donationId = req.query.donationId;
  try {
    const db = client.db("charityhub");
    const donation = await db
      .collection("donations")
      .findOne({ _id: new ObjectId(donationId) });
    if (!donation) {
      return res.status(404).render("error", { message: "Donation not found" });
    }
    res.render("success-crypto", {
      amount: donation.amount,
      org: donation.org,
      crypto: donation.crypto,
      name: donation.name,
      email: donation.email,
      txid: donation.txid || "",
    });
  } catch (error) {
    console.error("Error fetching donation for success page:", error.message);
    res.status(500).render("error", { message: "Error loading success page" });
  }
});

// About Us route
app.get("/about", (req, res) => {
  res.render("about");
});

// Contact Us route (GET)
app.get("/contact", (req, res) => {
  console.log("Contact route accessed");
  res.render("contact");
});

// Contact Us form submission (POST)
app.post("/contact", (req, res) => {
  console.log("Contact form submitted");
  console.log("Form data:", req.body);
  res.redirect("/contact");
});

// Org dashboard route
app.get("/org-dashboard", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (
    !authHeader ||
    authHeader !==
      "Basic " + Buffer.from("admin:supersecret").toString("base64")
  ) {
    res.set("WWW-Authenticate", 'Basic realm="Admin Dashboard"');
    res.status(401).send("Authentication required");
    return;
  }
  try {
    const db = client.db("charityhub");
    const donations = await db.collection("donations").find().toArray();
    res.render("org-dashboard", { donations });
  } catch (error) {
    console.error("Error fetching donations for dashboard:", error.message);
    res.status(500).render("error", { message: "Error loading dashboard" });
  }
});

// Update donation status route
app.post("/update-donation-status", async (req, res) => {
  const { id, status } = req.body;
  try {
    const db = client.db("charityhub");
    const result = await db
      .collection("donations")
      .updateOne({ _id: new ObjectId(id) }, { $set: { status } });
    if (result.matchedCount === 0) {
      return res.status(404).render("error", { message: "Donation not found" });
    }
    res.redirect("/org-dashboard");
  } catch (error) {
    console.error("Error updating donation status:", error.message);
    res
      .status(500)
      .render("error", { message: "Error updating donation status" });
  }
});

// Catch-all route
app.use((req, res) => {
  res.status(404).render("error", { message: "Page not found" });
});

// Start the server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
