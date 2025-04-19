const express = require("express");
const fs = require("fs");
const path = require("path");
const app = express();

// Set the view engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Serve static files (like CSS, images, JS)
app.use(express.static(path.join(__dirname, "public")));

// Middleware to parse form data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Function to initialize donations.json if it doesn't exist
const initializeDonationsFile = () => {
  const filePath = path.join(__dirname, "donations.json");
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify([], null, 2));
  }
};

// Call the function to ensure donations.json exists
initializeDonationsFile();

// Load donations into memory
let donations = [];
if (fs.existsSync("donations.json")) {
  try {
    donations = JSON.parse(fs.readFileSync("donations.json"));
    if (!Array.isArray(donations)) {
      console.error("donations.json is not an array, resetting to empty array");
      donations = [];
    }
  } catch (error) {
    console.error("Error reading donations.json:", error.message);
    donations = [];
  }
}

// List of organizations
const organizations = [
  { name: "Helping Hands", slug: "helping-hands" },
  { name: "Beacon of Hope", slug: "beacon-of-hope" },
  { name: "Baobab Foundation", slug: "baobab" },
];

// Home route
app.get("/", (req, res) => {
  console.log("Organizations in / route:", organizations);
  res.render("index", { organizations });
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

// Handle donation form submission (POST)
app.post("/donate", (req, res) => {
  const { org, name, email, amount, crypto } = req.body;
  if (!org || !name || !email || !amount || !crypto) {
    console.error("Missing form data:", req.body);
    return res
      .status(400)
      .render("error", { message: "All fields are required" });
  }
  const donation = {
    id: donations.length + 1,
    org,
    name,
    email,
    amount: parseFloat(amount),
    crypto,
    status: "Pending",
  };
  try {
    donations.push(donation);
    fs.writeFileSync("donations.json", JSON.stringify(donations, null, 2));
    console.log("Donation saved:", donation);
    res.redirect(`/donate-crypto?donationId=${donation.id}`);
  } catch (error) {
    console.error("Error saving donation:", error.message);
    res.status(500).render("error", { message: "Error saving donation" });
  }
});

// Donation confirmation page
app.get("/donate-crypto", (req, res) => {
  const donationId = parseInt(req.query.donationId);
  const donation = donations.find((d) => d.id === donationId);
  if (!donation) {
    return res.status(404).render("error", { message: "Donation not found" });
  }
  const cryptoAddresses = {
    bitcoin: "your-bitcoin-address-here",
    solana: "your-solana-address-here",
    usdt: "your-usdt-address-here",
    ethereum: "your-ethereum-address-here",
  };
  const address = cryptoAddresses[donation.crypto] || "Address not available";
  res.render("donate-crypto", { donation, address });
});

// Confirm donation
app.post("/confirm-donation", (req, res) => {
  const donationId = parseInt(req.body.donationId);
  const donation = donations.find((d) => d.id === donationId);
  if (donation) {
    donation.status = "Pending Approval";
    try {
      fs.writeFileSync("donations.json", JSON.stringify(donations, null, 2));
      res.redirect(`/success-crypto?donationId=${donation.id}`);
    } catch (error) {
      console.error("Error saving donation status:", error.message);
      res.status(500).render("error", { message: "Error confirming donation" });
    }
  } else {
    res.status(404).render("error", { message: "Donation not found" });
  }
});

// Success page
app.get("/success-crypto", (req, res) => {
  const donationId = parseInt(req.query.donationId);
  const donation = donations.find((d) => d.id === donationId);
  if (!donation) {
    return res.status(404).render("error", { message: "Donation not found" });
  }
  res.render("success-crypto", {
    amount: donation.amount,
    org: donation.org,
    crypto: donation.crypto,
    name: donation.name,
    email: donation.email,
  });
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
app.get("/org-dashboard", (req, res) => {
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
  res.render("org-dashboard", { donations });
});

// Update donation status route
app.post("/update-donation-status", (req, res) => {
  const { id, status } = req.body;
  const donation = donations.find((d) => d.id === parseInt(id));
  if (donation) {
    donation.status = status;
    try {
      fs.writeFileSync("donations.json", JSON.stringify(donations, null, 2));
      res.redirect("/org-dashboard");
    } catch (error) {
      console.error("Error saving donation status:", error.message);
      res
        .status(500)
        .render("error", { message: "Error updating donation status" });
    }
  } else {
    res.status(404).render("error", { message: "Donation not found" });
  }
});

// Catch-all route
app.use((req, res) => {
  res.status(404).render("error", { message: "Page not found" });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
