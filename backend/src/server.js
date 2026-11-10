
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import authRoutes from "./routes/auth.js";
import groupRoutes from "./routes/groups.js";
import expenseRoutes from "./routes/expenses.js";
import settlementRoutes from "./routes/settlements.js";

const app = express();

if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is required");
}

// Security and middleware
app.use(helmet());

app.use(cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173"
}));

app.use(express.json({ limit: "100kb" }));

app.use("/api/auth", rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false
}));

// Health-check routes
app.get("/", (req, res) => {
    res.status(200).json({
        success: true,
        message: "SplitSmart API is running!"
    });
});

app.get("/api/health", (req, res) => {
    res.status(200).json({
        status: "healthy",
        application: "SplitSmart API"
    });
});

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/groups", groupRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/settlements", settlementRoutes);

// 404 handler MUST be last
app.use((req, res) => {
    res.status(404).json({
        error: "Endpoint not found"
    });
});

// Error handler MUST be after routes
app.use((err, req, res, next) => {
    console.error(err);

    res.status(500).json({
        error: "Internal server error"
    });
});

const PORT = process.env.PORT || 5000;

if (process.env.NODE_ENV !== "test") {
    app.listen(PORT, () => {
        console.log(`SplitSmart API running on port ${PORT}`);
    });
}

export default app;
