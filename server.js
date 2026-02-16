const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");
const session = require("express-session");
const path = require("path");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

const app = express();

/* ---------------- CLOUDINARY CONFIG ---------------- */

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "gym_clients",
    allowed_formats: ["jpg", "png", "jpeg"]
  }
});

const upload = multer({ storage });

/* ---------------- MIDDLEWARE ---------------- */

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

app.use(session({
  secret: "gymSecretKey",
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));

app.use(express.static(path.join(__dirname, "public")));

/* ---------------- DATABASE ---------------- */

mongoose.connect(process.env.MONGO_URI)
.then(() => console.log("MongoDB Connected"))
.catch(err => console.log(err));

/* ---------------- OWNER LOGIN ---------------- */

let OWNER = {
  username: "admin",
  password: "1234"
};

/* ---------------- SCHEMA ---------------- */

const clientSchema = new mongoose.Schema({
  name: String,
  phone: String,
  photo: String,
  joinDate: String,
  expiryDate: String,
  lastVisit: String,
  feeStatus: { type: String, default: "Unpaid" }
});

const Client = mongoose.model("Client", clientSchema);

/* ---------------- AUTH ---------------- */

function isAuthenticated(req, res, next) {
  if (!req.session.user) {
    return res.redirect("/");
  }
  next();
}

/* ---------------- ROUTES ---------------- */

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.get("/dashboard", isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

/* ---------------- LOGIN ---------------- */

app.post("/login", (req, res) => {
  const { username, password } = req.body;

  if (username === OWNER.username && password === OWNER.password) {
    req.session.user = username;
    return res.json({ success: true });
  }

  res.json({ success: false });
});

/* ---------------- LOGOUT ---------------- */

app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
});

/* ---------------- ADD CLIENT ---------------- */

app.post("/add-client", upload.single("photo"), async (req, res) => {
  try {
    const newClient = new Client({
      name: req.body.name,
      phone: req.body.phone,
      joinDate: req.body.joinDate,
      expiryDate: req.body.expiryDate,
      photo: req.file ? req.file.path : ""
    });

    await newClient.save();
    res.status(201).json({ success: true });

  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Failed to add client" });
  }
});

/* ---------------- GET CLIENTS ---------------- */

app.get("/clients", isAuthenticated, async (req, res) => {
  const clients = await Client.find().sort({ joinDate: -1 });
  res.json(clients);
});

/* ---------------- START SERVER ---------------- */

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log("Server running");
});
