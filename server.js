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
  "mongodb+srv://charityhub-new:myUche12@charityhub.gseth8e.mongodb.net/charityhub?retryWrites=true&w=majority&appName=CharityHub";
const client = new MongoClient(uri);

// Connect to MongoDB
async function connectToMongo() {
  try {
    await client.connect();
    console.log("Connected to MongoDB");
  } catch (error) {
    console.error("MongoDB connection error:", error.message);
    process.exit(1);
  }
}
connectToMongo();

// Set the view engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Serve static files
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Handle favicon.ico
app.get("/favicon.ico", (req, res) => res.status(204).end());

// Organization list
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
    res.render("index", { organizations }); // No totalDonations here
  } catch (err) {
    res.status(500).send(`Error loading homepage: ${err.message}`);
  }
});

// Donate GET route (direct to the right organization page)
app.get("/donate/:org?", (req, res) => {
  const orgSlug = req.params.org || req.query.org || "";
  const org = organizations.find((o) => o.slug === orgSlug) || null;
  const formattedOrg = org
    ? org.name
    : orgSlug
    ? orgSlug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : "";
  res.render("donate", { org, formattedOrg, organizations });
});

// ✅ Fixed: Donate POST route
app.post("/donate", async (req, res) => {
  const { org, name, email, amount, crypto } = req.body;
  const parsedAmount = parseFloat(amount);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).send("Invalid donation amount.");
  }

  const donation = {
    org,
    name,
    email,
    amount: parsedAmount,
    crypto: crypto.toLowerCase(),
    status: "Pending",
    createdAt: new Date(),
  };

  try {
    const db = client.db("charityhub");
    const result = await db.collection("donations").insertOne(donation);
    res.redirect(`/donate-crypto?donationId=${result.insertedId}`);
  } catch (error) {
    res.status(500).send(`Error saving donation: ${error.message}`);
  }
});

// Donate confirmation
app.get("/donate-crypto", async (req, res) => {
  const donationId = req.query.donationId;
  try {
    const db = client.db("charityhub");
    const donation = await db
      .collection("donations")
      .findOne({ _id: new ObjectId(donationId) });

    if (!donation) {
      return res.status(404).send("Donation not found.");
    }

    const cryptoAddresses = {
      bitcoin: "1MYtXT98J2bu5yGxAv3tMRbigyRT8ZKjE1",
      solana: "FSRnivo8MHvWJgJZ3ymzf54NMJ3cUX12iWojpW3Rehn9",
      usdt: "TUtu3FS3yhcwHT3qdcrVJ1xoBGavsAYViM",
      ethereum: "0x8c169f53938da10fb04606a0ffc05ed2fb2c4a7a",
    };

    const selectedCrypto = (donation.crypto || "").toLowerCase();
    const address = cryptoAddresses[selectedCrypto] || "Address not available";

    res.render("donate-crypto", { donation, address });
  } catch (error) {
    res.status(500).send(`Error fetching donation: ${error.message}`);
  }
});

// Confirm donation (image upload)
app.post("/confirm-donation", upload.single("proofImage"), async (req, res) => {
  const donationId = req.body.donationId;
  try {
    const db = client.db("charityhub");
    const proofImageUrl = req.file ? req.file.path : null;

    if (!proofImageUrl) {
      return res.status(400).send("Proof image is required.");
    }

    const result = await db
      .collection("donations")
      .updateOne(
        { _id: new ObjectId(donationId) },
        { $set: { status: "Pending Approval", proofImageUrl } }
      );

    if (result.matchedCount === 0) {
      return res.status(404).send("Donation not found.");
    }

    res.redirect(`/success-crypto?donationId=${donationId}`);
  } catch (error) {
    res.status(500).send(`Error confirming donation: ${error.message}`);
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
      return res.status(404).send("Donation not found.");
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
    res.status(500).send(`Error loading success page: ${error.message}`);
  }
});

// About + Contact
app.get("/about", (req, res) => res.render("about"));
app.get("/contact", (req, res) => res.render("contact"));
app.post("/contact", (req, res) => {
  console.log("Contact form submitted", req.body);
  res.redirect("/contact");
});

// Org Dashboard
app.get("/org-dashboard", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (
    !authHeader ||
    authHeader !==
      "Basic " + Buffer.from("admin:supersecret").toString("base64")
  ) {
    res.set("WWW-Authenticate", 'Basic realm="Admin Dashboard"');
    return res.status(401).send("Authentication required");
  }

  try {
    const db = client.db("charityhub");
    const donations = await db.collection("donations").find().toArray();
    res.render("org-dashboard", { donations });
  } catch (error) {
    res.status(500).send(`Error loading dashboard: ${error.message}`);
  }
});

// Update donation status
app.post("/update-donation-status", async (req, res) => {
  const { id, status } = req.body;
  try {
    const db = client.db("charityhub");
    const result = await db
      .collection("donations")
      .updateOne({ _id: new ObjectId(id) }, { $set: { status } });

    if (result.matchedCount === 0) {
      return res.status(404).send("Donation not found.");
    }

    res.redirect("/org-dashboard");
  } catch (error) {
    res.status(500).send(`Error updating status: ${error.message}`);
  }
});

// 🔍 Diagnostic route (optional)
app.get("/some-route", async (req, res) => {
  const db = client.db("charityhub");
  const data = await db.listCollections().toArray();
  res.send(data);
});

// Catch-all
app.use((req, res) => {
  res.status(404).send("Page not found.");
});

// Error handler
app.use((err, req, res, next) => {
  console.error("Global error:", err.stack);
  res.status(500).send(`Something went wrong: ${err.message}`);
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});

module.exports = app;
