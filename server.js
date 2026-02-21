const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");
const session = require("express-session");
const path = require("path");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const bcrypt = require("bcryptjs");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const MongoStore = require("connect-mongo");
require("dotenv").config();

const app = express();

// Express app create karne ke baad, immediately yeh add karo:
app.set('trust proxy', 1);

/* ---------------- SECURITY MIDDLEWARE ---------------- */

// Helmet for security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"], // ✅ Fonts add karo
      scriptSrc: ["'self'", "'unsafe-inline'"],  // ✅ Inline scripts allow karo
      imgSrc: ["'self'", "data:", "https:", "http:", "blob:"],  // ✅ blob: add karo
      fontSrc: ["'self'", "https://fonts.gstatic.com"],  // ✅ Fonts
    },
  },
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later."
});
app.use("/api/", limiter);

// Stricter rate limit for login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: "Too many login attempts, please try again after 15 minutes."
});

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
    allowed_formats: ["jpg", "png", "jpeg"],
    transformation: [{ width: 500, height: 500, crop: "limit" }]
  }
});

const upload = multer({ 
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

/* ---------------- MIDDLEWARE ---------------- */

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true
}));

// Session configuration with MongoDB store
app.use(session({
  secret: process.env.SESSION_SECRET || "fallback_secret_change_this",
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URI  // MongoDB mein session store karo
  }),
  cookie: { 
    secure: process.env.NODE_ENV === 'production' && req.secure, // ✅ Better check
    httpOnly: true,
    sameSite: 'lax',  // ✅ Add this
    maxAge: 24 * 60 * 60 * 1000
  }
}));
app.use(express.static(path.join(__dirname, "public")));

/* ---------------- DATABASE CONNECTION ---------------- */

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
};

connectDB();

connectDB();

/* ---------------- OWNER LOGIN (SECURE) ---------------- */

// In production, store hashed password in database
let OWNER = {
  username: process.env.ADMIN_USERNAME || "admin",
  password: process.env.ADMIN_PASSWORD || "1234"
};
// Hash password function for initial setup
const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
};

/* ---------------- SCHEMAS WITH VALIDATION ---------------- */

const clientSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Name is required"],
    trim: true,
    maxlength: [100, "Name cannot be more than 100 characters"]
  },
  phone: {
    type: String,
    required: [true, "Phone is required"],
    trim: true,
    match: [/^[0-9]{10}$/, "Please enter valid 10-digit phone number"]
  },
  photo: {
    type: String,
    default: ""
  },
  joinDate: {
    type: Date,
    required: [true, "Join date is required"],
    default: Date.now
  },
  expiryDate: {
    type: Date,
    required: [true, "Expiry date is required"]
  },
  lastVisit: {
    type: Date,
    default: null
  },
  feeStatus: {
    type: String,
    enum: ["Paid", "Unpaid", "Pending"],
    default: "Unpaid"
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Index for faster queries
clientSchema.index({ name: 'text', phone: 'text' });
clientSchema.index({ expiryDate: 1 });

const Client = mongoose.model("Client", clientSchema);

/* ---------------- AUTH MIDDLEWARE ---------------- */

const isAuthenticated = (req, res, next) => {
  if (!req.session.user) {
    return res.status(401).json({ success: false, message: "Unauthorized access" });
  }
  next();
};

/* ---------------- ROUTES ---------------- */

// Health check
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "OK", 
    timestamp: new Date().toISOString(),
    dbStatus: mongoose.connection.readyState === 1 ? "Connected" : "Disconnected"
  });
});

// Login page
app.get("/", (req, res) => {
  if (req.session.user) {
    return res.redirect("/dashboard");
  }
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

// Dashboard
app.get("/dashboard", isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

/* ---------------- AUTHENTICATION ---------------- */

app.post("/api/login", loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validation
    if (!username || !password) {
      return res.status(400).json({ 
        success: false, 
        message: "Please provide username and password" 
      });
    }

    // Check credentials
    if (username !== OWNER.username) {
      return res.status(401).json({ 
        success: false, 
        message: "Invalid credentials" 
      });
    }

    // Compare password (use bcrypt in production)
    const isMatch = await bcrypt.compare(password, OWNER.password);
    
    // For demo without bcrypt
    const isMatchDemo = password === "1234"; // Remove this in production

    if (isMatch || isMatchDemo) {
      req.session.user = username;
      return res.json({ 
        success: true, 
        message: "Login successful" 
      });
    }

    res.status(401).json({ 
      success: false, 
      message: "Invalid credentials" 
    });

  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ 
      success: false, 
      message: "Server error during login" 
    });
  }
});

app.post("/api/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ 
        success: false, 
        message: "Could not log out" 
      });
    }
    res.json({ success: true, message: "Logged out successfully" });
  });
});

app.get("/api/check-auth", (req, res) => {
  if (req.session.user) {
    res.json({ authenticated: true, user: req.session.user });
  } else {
    res.json({ authenticated: false });
  }
});

/* ---------------- CLIENT MANAGEMENT ---------------- */

// Add client
app.post("/api/clients", isAuthenticated, upload.single("photo"), async (req, res) => {
  try {
    const { name, phone, joinDate, expiryDate, feeStatus } = req.body;

    // Validation
    if (!name || !phone || !joinDate || !expiryDate) {
      // Delete uploaded file if validation fails
      if (req.file) {
        await cloudinary.uploader.destroy(req.file.filename);
      }
      return res.status(400).json({ 
        success: false, 
        message: "Please provide all required fields" 
      });
    }

    // Check for duplicate phone
    const existingClient = await Client.findOne({ phone });
    if (existingClient) {
      if (req.file) {
        await cloudinary.uploader.destroy(req.file.filename);
      }
      return res.status(409).json({ 
        success: false, 
        message: "Client with this phone number already exists" 
      });
    }

    const newClient = new Client({
      name: name.trim(),
      phone: phone.trim(),
      joinDate: new Date(joinDate),
      expiryDate: new Date(expiryDate),
      photo: req.file ? req.file.path : "",
      feeStatus: feeStatus || "Unpaid"
    });

    await newClient.save();
    
    res.status(201).json({ 
      success: true, 
      message: "Client added successfully",
      client: newClient
    });

  } catch (err) {
    console.error("Add client error:", err);
    if (req.file) {
      await cloudinary.uploader.destroy(req.file.filename);
    }
    res.status(500).json({ 
      success: false, 
      message: err.message || "Failed to add client" 
    });
  }
});

// Get all clients with pagination and search
app.get("/api/clients", isAuthenticated, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search = "",
      feeStatus,
      sortBy = "joinDate",
      order = "desc"
    } = req.query;

    const query = {};
    
    // Search functionality
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    // Filter by fee status
    if (feeStatus) {
      query.feeStatus = feeStatus;
    }

    // Sorting
    const sortOptions = {};
    sortOptions[sortBy] = order === 'desc' ? -1 : 1;

    const clients = await Client.find(query)
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await Client.countDocuments(query);

    res.json({
      success: true,
      clients,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      total: count
    });

  } catch (err) {
    console.error("Get clients error:", err);
    res.status(500).json({ 
      success: false, 
      message: "Failed to fetch clients" 
    });
  }
});

// Get single client
app.get("/api/clients/:id", isAuthenticated, async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);
    
    if (!client) {
      return res.status(404).json({ 
        success: false, 
        message: "Client not found" 
      });
    }

    res.json({ success: true, client });

  } catch (err) {
    console.error("Get client error:", err);
    res.status(500).json({ 
      success: false, 
      message: "Failed to fetch client" 
    });
  }
});

// Update client
app.put("/api/clients/:id", isAuthenticated, upload.single("photo"), async (req, res) => {
  try {
    const { name, phone, joinDate, expiryDate, feeStatus, lastVisit } = req.body;
    
    const client = await Client.findById(req.params.id);
    
    if (!client) {
      if (req.file) {
        await cloudinary.uploader.destroy(req.file.filename);
      }
      return res.status(404).json({ 
        success: false, 
        message: "Client not found" 
      });
    }

    // Check phone uniqueness if changed
    if (phone && phone !== client.phone) {
      const existingClient = await Client.findOne({ phone });
      if (existingClient) {
        if (req.file) {
          await cloudinary.uploader.destroy(req.file.filename);
        }
        return res.status(409).json({ 
          success: false, 
          message: "Phone number already in use" 
        });
      }
    }

    // Delete old photo if new one uploaded
    if (req.file && client.photo) {
      const publicId = client.photo.split('/').pop().split('.')[0];
      await cloudinary.uploader.destroy(publicId);
    }

    // Update fields
    if (name) client.name = name.trim();
    if (phone) client.phone = phone.trim();
    if (joinDate) client.joinDate = new Date(joinDate);
    if (expiryDate) client.expiryDate = new Date(expiryDate);
    if (feeStatus) client.feeStatus = feeStatus;
    if (lastVisit) client.lastVisit = new Date(lastVisit);
    if (req.file) client.photo = req.file.path;

    await client.save();

    res.json({ 
      success: true, 
      message: "Client updated successfully",
      client 
    });

  } catch (err) {
    console.error("Update client error:", err);
    if (req.file) {
      await cloudinary.uploader.destroy(req.file.filename);
    }
    res.status(500).json({ 
      success: false, 
      message: "Failed to update client" 
    });
  }
});

// Delete client
app.delete("/api/clients/:id", isAuthenticated, async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);
    
    if (!client) {
      return res.status(404).json({ 
        success: false, 
        message: "Client not found" 
      });
    }

    // Delete photo from Cloudinary
    if (client.photo) {
      const publicId = client.photo.split('/').pop().split('.')[0];
      await cloudinary.uploader.destroy(publicId);
    }

    await Client.findByIdAndDelete(req.params.id);

    res.json({ 
      success: true, 
      message: "Client deleted successfully" 
    });

  } catch (err) {
    console.error("Delete client error:", err);
    res.status(500).json({ 
      success: false, 
      message: "Failed to delete client" 
    });
  }
});


/* ---------------- TOGGLE FEE STATUS ---------------- */

app.put("/api/clients/:id/toggle-fee", isAuthenticated, async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);
    
    if (!client) {
      return res.status(404).json({ 
        success: false, 
        message: "Client not found" 
      });
    }
    
    // Toggle fee status
    client.feeStatus = client.feeStatus === "Paid" ? "Unpaid" : "Paid";
    await client.save();
    
    res.json({ 
      success: true, 
      message: "Fee status updated",
      client 
    });

  } catch (err) {
    console.error("Toggle fee error:", err);
    res.status(500).json({ 
      success: false, 
      message: "Failed to update fee status" 
    });
  }
});

/* ---------------- RENEW MEMBERSHIP ---------------- */

app.put("/api/clients/:id/renew", isAuthenticated, async (req, res) => {
  try {
    const { months } = req.body;
    
    if (!months || isNaN(months)) {
      return res.status(400).json({ 
        success: false, 
        message: "Please provide valid months" 
      });
    }

    const client = await Client.findById(req.params.id);
    
    if (!client) {
      return res.status(404).json({ 
        success: false, 
        message: "Client not found" 
      });
    }
    
    // Calculate new expiry date
    const currentExpiry = new Date(client.expiryDate);
    const today = new Date();
    
    // If already expired, start from today, else extend from current expiry
    const baseDate = currentExpiry > today ? currentExpiry : today;
    const newExpiry = new Date(baseDate);
    newExpiry.setMonth(newExpiry.getMonth() + parseInt(months));
    
    // Update client
    client.expiryDate = newExpiry;
    client.feeStatus = "Paid";
    await client.save();
    
    res.json({ 
      success: true, 
      message: "Membership renewed successfully",
      client 
    });

  } catch (err) {
    console.error("Renew error:", err);
    res.status(500).json({ 
      success: false, 
      message: "Failed to renew membership" 
    });
  }
});
// Get dashboard stats
app.get("/api/stats", isAuthenticated, async (req, res) => {
  try {
    const totalClients = await Client.countDocuments();
    const activeClients = await Client.countDocuments({ 
      expiryDate: { $gte: new Date() } 
    });
    const expiredClients = await Client.countDocuments({ 
      expiryDate: { $lt: new Date() } 
    });
    const unpaidClients = await Client.countDocuments({ feeStatus: "Unpaid" });

    // Clients expiring this week
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const expiringThisWeek = await Client.countDocuments({
      expiryDate: { $gte: new Date(), $lte: nextWeek }
    });

    res.json({
      success: true,
      stats: {
        totalClients,
        activeClients,
        expiredClients,
        unpaidClients,
        expiringThisWeek
      }
    });

  } catch (err) {
    console.error("Stats error:", err);
    res.status(500).json({ 
      success: false, 
      message: "Failed to fetch stats" 
    });
  }
});

/* ---------------- ERROR HANDLING ---------------- */

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("Global error:", err);
  
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ 
        success: false, 
        message: "File size too large. Max 5MB allowed." 
      });
    }
  }
  
  res.status(500).json({ 
    success: false, 
    message: err.message || "Internal server error" 
  });
});

/* ---------------- SERVER START ---------------- */

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error("Unhandled Rejection:", err.message);
  // Close server & exit process
  // server.close(() => process.exit(1));
});