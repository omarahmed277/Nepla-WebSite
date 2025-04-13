// server.js
require("dotenv").config();
const express = require("express");
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const cors = require("cors");
const bodyParser = require("body-parser");

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use("/uploads", express.static("uploads"));

// Database connection
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Authentication middleware
const authenticate = async (req, res, next) => {
  const token = req.header("Authorization")?.replace("Bearer ", "");
  if (!token) return res.status(401).send("Access denied. No token provided.");

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const [users] = await pool.query("SELECT * FROM users WHERE id = ?", [
      decoded.id,
    ]);
    if (!users.length) throw new Error();

    req.user = users[0];
    next();
  } catch (ex) {
    res.status(400).send("Invalid token.");
  }
};

// Image upload setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});
const upload = multer({ storage });

// Routes
app.post("/api/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await pool.query(
      "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
      [username, email, hashedPassword]
    );

    // Check if registered via referral
    if (req.body.referralCode) {
      const [referrers] = await pool.query(
        "SELECT id FROM users WHERE username = ?",
        [req.body.referralCode]
      );
      if (referrers.length) {
        await pool.query(
          "INSERT INTO referrals (referrer_id, referred_email) VALUES (?, ?)",
          [referrers[0].id, email]
        );
      }
    }

    res.status(201).send({ id: result.insertId });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      res.status(400).send("Username or email already exists.");
    } else {
      res.status(500).send("Error registering user.");
    }
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const [users] = await pool.query("SELECT * FROM users WHERE email = ?", [
      email,
    ]);

    if (
      users.length === 0 ||
      !(await bcrypt.compare(password, users[0].password_hash))
    ) {
      return res.status(400).send("Invalid email or password.");
    }

    const token = jwt.sign({ id: users[0].id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });
    res.send({
      token,
      user: {
        id: users[0].id,
        username: users[0].username,
        coins: users[0].coins,
      },
    });
  } catch (err) {
    res.status(500).send("Error logging in.");
  }
});

// Product routes
app.post(
  "/api/products",
  authenticate,
  upload.array("images", 5),
  async (req, res) => {
    try {
      const { title, description, category, size, condition, coins_value } =
        req.body;

      // Insert product
      const [productResult] = await pool.query(
        "INSERT INTO products (user_id, title, description, category, size, condition, coins_value) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
          req.user.id,
          title,
          description,
          category,
          size,
          condition,
          coins_value,
        ]
      );

      // Insert images
      if (req.files && req.files.length) {
        const imageValues = req.files.map((file, index) => [
          productResult.insertId,
          file.filename,
          index === 0, // First image is primary
        ]);

        await pool.query(
          "INSERT INTO product_images (product_id, image_url, is_primary) VALUES ?",
          [imageValues]
        );
      }

      // Award coins for listing
      await pool.query(
        "UPDATE users SET coins = coins + ? WHERE id = ?",
        [Math.floor(coins_value * 0.1), req.user.id] // 10% of product value as coins
      );

      res.status(201).send({ id: productResult.insertId });
    } catch (err) {
      res.status(500).send("Error creating product.");
    }
  }
);

app.get("/api/products", async (req, res) => {
  try {
    let query = `
            SELECT p.*, u.username as seller_username, 
                   (SELECT image_url FROM product_images WHERE product_id = p.id AND is_primary = 1 LIMIT 1) as primary_image
            FROM products p
            JOIN users u ON p.user_id = u.id
            WHERE p.status = 'available'
        `;

    // Add filters if provided
    const filters = [];
    const params = [];

    if (req.query.category) {
      filters.push("p.category = ?");
      params.push(req.query.category);
    }

    if (req.query.size) {
      filters.push("p.size = ?");
      params.push(req.query.size);
    }

    if (filters.length) {
      query += " AND " + filters.join(" AND ");
    }

    query += " ORDER BY p.created_at DESC";

    const [products] = await pool.query(query, params);
    res.send(products);
  } catch (err) {
    res.status(500).send("Error fetching products.");
  }
});

// Transaction routes
app.post("/api/transactions", authenticate, async (req, res) => {
  try {
    const { product_id, transaction_type, exchanged_product_id } = req.body;

    // Get product details
    const [products] = await pool.query("SELECT * FROM products WHERE id = ?", [
      product_id,
    ]);
    if (products.length === 0)
      return res.status(404).send("Product not found.");

    const product = products[0];

    // Check if buyer has enough coins for purchase
    if (transaction_type === "purchase") {
      const [buyers] = await pool.query(
        "SELECT coins FROM users WHERE id = ?",
        [req.user.id]
      );
      if (buyers[0].coins < product.coins_value) {
        return res.status(400).send("Not enough coins for this purchase.");
      }
    }

    // Check if exchanged product belongs to buyer and is available
    if (transaction_type === "exchange" && exchanged_product_id) {
      const [exchangedProducts] = await pool.query(
        'SELECT * FROM products WHERE id = ? AND user_id = ? AND status = "available"',
        [exchanged_product_id, req.user.id]
      );
      if (exchangedProducts.length === 0) {
        return res
          .status(400)
          .send("Exchanged product not available or does not belong to you.");
      }
    }

    // Create transaction
    const [transactionResult] = await pool.query(
      'INSERT INTO transactions (buyer_id, seller_id, product_id, transaction_type, exchanged_product_id, coins_amount, status) VALUES (?, ?, ?, ?, ?, ?, "pending")',
      [
        req.user.id,
        product.user_id,
        product_id,
        transaction_type,
        exchanged_product_id || null,
        product.coins_value,
      ]
    );

    // Mark products as pending
    await pool.query('UPDATE products SET status = "pending" WHERE id IN (?)', [
      [product_id, exchanged_product_id].filter(Boolean),
    ]);

    res.status(201).send({ id: transactionResult.insertId });
  } catch (err) {
    res.status(500).send("Error creating transaction.");
  }
});

// Referral routes
app.post("/api/referrals/generate-code", authenticate, async (req, res) => {
  try {
    // In our case, the referral code is just the username
    res.send({ code: req.user.username });
  } catch (err) {
    res.status(500).send("Error generating referral code.");
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
