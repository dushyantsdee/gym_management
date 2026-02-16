const express = require("express")
const mongoose = require("mongoose")
const cors = require("cors")
const multer = require("multer")
const session = require("express-session")
const path = require("path")
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");



const app = express()


cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET
});

const storageS = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "gym_clients",
    allowed_formats: ["jpg", "png", "jpeg"]
  }
});

const uploadS = multer({ storage: storage });

/* ---------------- MIDDLEWARE ---------------- */

app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(cors())

app.use(session({
  secret: "gymSecretKey",
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}))

app.use("/uploads", express.static("uploads"))


/* ---------------- DATABASE ---------------- */

mongoose.connect(process.env.MONGO_URI)
.then(() => console.log("MongoDB Connected"))
.catch(err => console.log(err));

/* ---------------- OWNER LOGIN ---------------- */

let OWNER = {
  username: "admin",
  password: "1234"
}

/* ---------------- SCHEMA ---------------- */

const clientSchema = new mongoose.Schema({
  name: String,
  phone: String,
  photo: String,
  joinDate: String,
  expiryDate: String,
  lastVisit: String,
  feeStatus: { type: String, default: "Unpaid" }
})

const Client = mongoose.model("Client", clientSchema)

/* ---------------- MULTER ---------------- */

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/")
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname)
  }
})

const upload = multer({ storage })

/* ---------------- AUTH MIDDLEWARE ---------------- */

function isAuthenticated(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ message: "Unauthorized" })
  }
  next()
}

/* ---------------- LOGIN ---------------- */

app.post("/login", (req, res) => {
  const { username, password } = req.body

  if (username === OWNER.username && password === OWNER.password) {
    req.session.user = username
    return res.json({ success: true })
  }

  res.json({ success: false })
})

/* ---------------- LOGOUT ---------------- */

app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/")
  })
})

/* ---------------- ADD CLIENT ---------------- */
app.post("/add-client", upload.single("photo"), async (req, res) => {
  try {
    const newClient = new Client({
      name: req.body.name,
      phone: req.body.phone,
      joinDate: req.body.joinDate,
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
  try {
    const clients = await Client.find().sort({ joinDate: -1 })
    res.json(clients)
  } catch (error) {
    res.status(500).json({ message: "Error Fetching Clients" })
  }
})

/* ---------------- UPDATE VISIT ---------------- */

app.put("/update-visit/:id", isAuthenticated, async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0]

    await Client.findByIdAndUpdate(req.params.id, {
      lastVisit: today
    })

    res.json({ message: "Visit Updated" })
  } catch (error) {
    res.status(500).json({ message: "Error Updating Visit" })
  }
})

/* ---------------- TOGGLE FEE ---------------- */

app.put("/toggle-fee/:id", isAuthenticated, async (req, res) => {
  try {
    const client = await Client.findById(req.params.id)

    const newStatus = client.feeStatus === "Paid" ? "Unpaid" : "Paid"

    await Client.findByIdAndUpdate(req.params.id, {
      feeStatus: newStatus
    })

    res.json({ message: "Fee Status Updated" })
  } catch (error) {
    res.status(500).json({ message: "Error Updating Fee Status" })
  }
})

/* ---------------- RENEW MEMBERSHIP ---------------- */

app.put("/renew/:id", isAuthenticated, async (req, res) => {
  try {
    const client = await Client.findById(req.params.id)

    const today = new Date()
    let baseDate = new Date(client.expiryDate)

    if (baseDate < today) {
      baseDate = today
    }

    baseDate.setMonth(baseDate.getMonth() + 1)

    await Client.findByIdAndUpdate(req.params.id, {
      expiryDate: baseDate.toISOString().split("T")[0],
      feeStatus: "Paid"
    })

    res.json({ message: "Membership Renewed" })

  } catch (error) {
    res.status(500).json({ message: "Error Renewing Membership" })
  }
})

/* ---------------- CHANGE PASSWORD ---------------- */

app.post("/change-password", isAuthenticated, (req, res) => {
  const { oldPassword, newPassword } = req.body

  if (oldPassword !== OWNER.password) {
    return res.json({ success: false, message: "Old password incorrect" })
  }

  OWNER.password = newPassword
  res.json({ success: true })
})

/* ---------------- HOME ROUTE ---------------- */

app.get("/", (req, res) => {
  if (!req.session.user) {
    res.sendFile(path.join(__dirname, "public/login.html"))
  } else {
    res.sendFile(path.join(__dirname, "public/index.html"))
  }
})

app.delete("/delete-client/:id", isAuthenticated, async (req, res) => {
  try {
    await Client.findByIdAndDelete(req.params.id)
    res.json({ message: "Client Deleted" })
  } catch (error) {
    res.status(500).json({ message: "Error Deleting Client" })
  }
})

app.use(express.static("public"))

/* ---------------- START SERVER ---------------- */

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log("Server running");
});