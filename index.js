const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();


const app = express();
app.use(cors());
app.use(express.json());

const MONGO_URI = process.env.MONGO_URI;
const JWT_SECRET = process.env.JWT_SECRET;
const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

mongoose.connect(MONGO_URI)
  .then(() => console.log("MongoDB connected successfully!"))
  .catch((error) => console.log("MongoDB connection error:", error.message));

// Schema
const userSchema = new mongoose.Schema({
  name: String,
  age: Number,
  city: String,
  email: String,
  password: String
});

// Model
const User = mongoose.model("User", userSchema);

// GET — saare users
app.get("/users", async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET — ek specific user
app.get("/users/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST — naya user add karo
app.post("/users", async (req, res) => {
  try {
    const newUser = new User({
      name: req.body.name,
      age: req.body.age,
      city: req.body.city
    });
    await newUser.save();
    res.json(newUser);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT — user update karo
app.put("/users/:id", async (req, res) => {
  try {
    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json(updatedUser);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE — user hatao
app.delete("/users/:id", async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: "User deleted" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// User route
app.post("/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Check karo email already exist to nahi karta
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: "Email already registered" });
    }

    // Password hash karo
    const hashedPassword = await bcrypt.hash(password, 10);

    // Naya user banao (hashed password ke saath)
    const newUser = new User({
      name,
      email,
      password: hashedPassword
    });

    await newUser.save();
    res.json({ message: "Signup successful", user: { name, email } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Login route
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // User dhoondo email se
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: "User not found" });
    }

    // Password compare karo (jo user ne diya vs jo hashed store hai)
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: "Incorrect password" });
    }
    const token = jwt.sign(
      { userId: user._id, email: user.email },   // payload — token ke andar kya store hoga
      JWT_SECRET,                            // secret key — isse token sign hota hai
      { expiresIn: "1h" }                          // token 1 ghante mein expire ho jayega
    );

    res.json({ 
      message: "Login successful", 
      token: token,
      user: { name: user.name, email: user.email } 
    });

    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// after login profile route

// Ask ai route
app.post("/ask-ai", async (req, res) => {
  try {
    const userQuestion = req.body.question;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b",
        messages: [{ role: "user", content: userQuestion }]
      })
    });

    const data = await response.json();
    console.log("Full Groq response:", JSON.stringify(data));   // ✅ NAYA — print karo

    res.json(data);   // ✅ TEMPORARILY — poora data bhejो, .choices[0] hataओ

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Middleware — token verify karne ke liye
function verifyToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  if (!authHeader) {
    return res.status(401).json({ error: "No token provided" });
  }

  const token = authHeader.split(" ")[1];   // "Bearer <token>" mein se sirf token nikalo

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: "Invalid or expired token" });
    }
    req.user = decoded;   // decoded data (userId, email) request mein daal diya
    next();                // aage badho
  });
}

// Protected route — isko sirf valid token wale access kar sakte hain
app.get("/profile", verifyToken, (req, res) => {
  res.json({ message: "This is protected data", user: req.user });
});

// async function testBcrypt() {
//   const hashed = await bcrypt.hash("1234", 10);
//   console.log("Hashed password:", hashed);

//   const isMatch = await bcrypt.compare("1234", hashed);
//   console.log("Correct password match:", isMatch);

//   const isWrongMatch = await bcrypt.compare("wrongpassword", hashed);
//   console.log("Wrong password match:", isWrongMatch);
// }
// testBcrypt();

// app.listen(3000, () => {
//   console.log("Server is running on port 3000");
// });

console.log("Gemini Key:", GEMINI_API_KEY);
console.log("Groq Key:", GROQ_API_KEY);
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});