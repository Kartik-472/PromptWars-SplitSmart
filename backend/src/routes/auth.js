
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import db from "../config/database.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

const registerSchema = z.object({
    name: z.string().trim().min(2).max(60),
    email: z.string().trim().email().max(150),
    password: z.string().min(8).max(128)
});

const loginSchema = z.object({
    email: z.string().trim().email(),
    password: z.string().min(1)
});

function createToken(user) {
    return jwt.sign(
        { id: user.id },
        process.env.JWT_SECRET,
        { expiresIn: "2h" }
    );
}

router.post("/register", async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);

    if (!parsed.success) {
        return res.status(400).json({
            error: "Invalid registration details"
        });
    }

    const { name, email, password } = parsed.data;
    const normalizedEmail = email.toLowerCase();

    try {
        const passwordHash = await bcrypt.hash(password, 12);

        const result = db.prepare(`
      INSERT INTO users (name, email, password_hash)
      VALUES (?, ?, ?)
    `).run(name, normalizedEmail, passwordHash);

        const user = {
            id: Number(result.lastInsertRowid),
            name,
            email: normalizedEmail
        };

        return res.status(201).json({
            token: createToken(user),
            user
        });
    } catch (error) {
        if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
            return res.status(409).json({
                error: "Email already registered"
            });
        }

        return res.status(500).json({
            error: "Registration failed"
        });
    }
});

router.post("/login", async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);

    if (!parsed.success) {
        return res.status(400).json({
            error: "Invalid login details"
        });
    }

    const email = parsed.data.email.toLowerCase();

    const user = db.prepare(`
    SELECT * FROM users WHERE email = ?
  `).get(email);

    if (!user) {
        return res.status(401).json({
            error: "Invalid email or password"
        });
    }

    const valid = await bcrypt.compare(
        parsed.data.password,
        user.password_hash
    );

    if (!valid) {
        return res.status(401).json({
            error: "Invalid email or password"
        });
    }

    return res.json({
        token: createToken(user),
        user: {
            id: user.id,
            name: user.name,
            email: user.email
        }
    });
});

router.get("/me", authenticate, (req, res) => {
    const user = db.prepare(`
    SELECT id, name, email FROM users WHERE id = ?
  `).get(req.user.id);

    if (!user) {
        return res.status(404).json({
            error: "User not found"
        });
    }

    res.json({ user });
});

export default router;
