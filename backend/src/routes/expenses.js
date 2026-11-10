
import express from "express";
import db from "../config/database.js";
import { authenticate } from "../middleware/auth.js";
import { isMember } from "./groups.js";

const router = express.Router();

router.use(authenticate);

const createExpense = db.transaction((data) => {
    const result = db.prepare(`
    INSERT INTO expenses
      (group_id, description, total_amount, paid_by, category, split_type)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
        data.groupId,
        data.description,
        data.total,
        data.paidBy,
        data.category,
        data.splitType
    );

    const expenseId = Number(result.lastInsertRowid);

    const insertSplit = db.prepare(`
    INSERT INTO expense_splits
      (expense_id, user_id, amount_owed)
    VALUES (?, ?, ?)
  `);

    for (const split of data.splits) {
        insertSplit.run(expenseId, split.userId, split.amount);
    }

    return expenseId;
});

router.post("/", (req, res) => {
    const groupId = Number(req.body.groupId);
    const description = String(req.body.description || "").trim();
    const total = req.body.total;
    const paidBy = Number(req.body.paidBy);
    const category = String(req.body.category || "Other");
    const splitType = req.body.splitType || "equal";
    const rawSplits = req.body.splits;

    if (!Number.isSafeInteger(groupId) || groupId <= 0 ||
        !isMember(groupId, req.user.id)) {
        return res.status(404).json({
            error: "Group not found"
        });
    }

    if (!description || description.length > 120 ||
        !Number.isSafeInteger(total) || total <= 0 ||
        total > 100000000 ||
        !Number.isSafeInteger(paidBy) ||
        !["equal", "custom", "percentage"].includes(splitType) ||
        !Array.isArray(rawSplits) ||
        rawSplits.length === 0 ||
        rawSplits.length > 100) {
        return res.status(400).json({
            error: "Invalid expense details"
        });
    }

    const members = db.prepare(`
    SELECT user_id FROM group_members WHERE group_id = ?
  `).all(groupId).map(m => m.user_id);

    if (!members.includes(paidBy) ||
        !rawSplits.every(s =>
            Number.isSafeInteger(s.userId) &&
            members.includes(s.userId)
        )) {
        return res.status(400).json({
            error: "Invalid payer or participant"
        });
    }

    const uniqueIds = new Set(rawSplits.map(s => s.userId));

    if (uniqueIds.size !== rawSplits.length) {
        return res.status(400).json({
            error: "Duplicate expense participants"
        });
    }

    if (!rawSplits.some(s => s.userId === paidBy)) {
        return res.status(400).json({
            error: "The payer must be included in the expense"
        });
    }

    let splits = [];

    if (splitType === "equal") {
        const base = Math.floor(total / rawSplits.length);
        const remainder = total % rawSplits.length;

        splits = rawSplits.map((s, i) => ({
            userId: s.userId,
            amount: base + (i < remainder ? 1 : 0)
        }));
    }

    if (splitType === "custom") {
        splits = rawSplits.map(s => ({
            userId: s.userId,
            amount: s.amount
        }));

        if (splits.some(s =>
            !Number.isSafeInteger(s.amount) || s.amount < 0
        ) || splits.reduce((a, s) => a + s.amount, 0) !== total) {
            return res.status(400).json({
                error: "Custom shares must add up to the total"
            });
        }
    }

    if (splitType === "percentage") {
        if (rawSplits.some(s =>
            !Number.isSafeInteger(s.percentage) ||
            s.percentage < 0 ||
            s.percentage > 100
        ) || rawSplits.reduce((a, s) => a + s.percentage, 0) !== 100) {
            return res.status(400).json({
                error: "Percentages must total exactly 100"
            });
        }

        let remaining = total;

        splits = rawSplits.map((s, i) => {
            const amount = i === rawSplits.length - 1
                ? remaining
                : Math.floor(total * s.percentage / 100);

            remaining -= amount;

            return {
                userId: s.userId,
                amount
            };
        });
    }

    try {
        const expenseId = createExpense({
            groupId,
            description,
            total,
            paidBy,
            category,
            splitType,
            splits
        });

        res.status(201).json({
            message: "Expense created",
            expenseId,
            splits
        });
    } catch {
        res.status(500).json({
            error: "Could not save expense"
        });
    }
});

router.get("/group/:groupId", (req, res) => {
    const groupId = Number(req.params.groupId);

    if (!Number.isSafeInteger(groupId) ||
        groupId <= 0 || !isMember(groupId, req.user.id)) {
        return res.status(404).json({
            error: "Group not found"
        });
    }

    const expenses = db.prepare(`
    SELECT
      e.*,
      u.name AS payer_name
    FROM expenses e
    JOIN users u ON u.id = e.paid_by
    WHERE e.group_id = ?
    ORDER BY e.created_at DESC
  `).all(groupId);

    const getSplits = db.prepare(`
    SELECT
      es.user_id,
      es.amount_owed,
      u.name
    FROM expense_splits es
    JOIN users u ON u.id = es.user_id
    WHERE es.expense_id = ?
  `);

    const result = expenses.map(e => ({
        ...e,
        splits: getSplits.all(e.id)
    }));

    res.json({ expenses: result });
});

router.get("/group/:groupId/balances", (req, res) => {
    const groupId = Number(req.params.groupId);

    if (!Number.isSafeInteger(groupId) ||
        groupId <= 0 || !isMember(groupId, req.user.id)) {
        return res.status(404).json({
            error: "Group not found"
        });
    }


    const balances = db.prepare(`
  SELECT
    u.id AS user_id,
    u.name,

    COALESCE(p.total_paid, 0)
    + COALESCE(sent.total_sent, 0)
    - COALESCE(o.total_owed, 0)
    - COALESCE(received.total_received, 0)
    AS balance

  FROM group_members gm
  JOIN users u ON u.id = gm.user_id

  LEFT JOIN (
    SELECT paid_by, SUM(total_amount) AS total_paid
    FROM expenses
    WHERE group_id = ?
    GROUP BY paid_by
  ) p ON p.paid_by = u.id

  LEFT JOIN (
    SELECT user_id, SUM(amount_owed) AS total_owed
    FROM expense_splits es
    JOIN expenses e ON e.id = es.expense_id
    WHERE e.group_id = ?
    GROUP BY user_id
  ) o ON o.user_id = u.id

  LEFT JOIN (
    SELECT sender_id, SUM(amount) AS total_sent
    FROM settlements
    WHERE group_id = ? AND status = 'confirmed'
    GROUP BY sender_id
  ) sent ON sent.sender_id = u.id

  LEFT JOIN (
    SELECT receiver_id, SUM(amount) AS total_received
    FROM settlements
    WHERE group_id = ? AND status = 'confirmed'
    GROUP BY receiver_id
  ) received ON received.receiver_id = u.id

  WHERE gm.group_id = ?
`).all(groupId, groupId, groupId, groupId, groupId);

    res.json({ balances });
});

export default router;
