
import express from "express";
import db from "../config/database.js";
import { authenticate } from "../middleware/auth.js";
import { isMember } from "./groups.js";
import { calculateSettlements } from "../services/settlementEngine.js";

const router = express.Router();

router.use(authenticate);

router.get("/:groupId/suggestions", (req, res) => {
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

    try {
        const suggestions = calculateSettlements(balances);

        res.json({ suggestions });
    } catch {
        res.status(500).json({
            error: "Could not calculate settlements"
        });
    }
});

router.post("/", (req, res) => {
    const { groupId, receiverId, amount } = req.body;

    if (!Number.isSafeInteger(groupId) || groupId <= 0 ||
        !Number.isSafeInteger(receiverId) || receiverId <= 0 ||
        !Number.isSafeInteger(amount) || amount <= 0 ||
        receiverId === req.user.id) {
        return res.status(400).json({
            error: "Invalid settlement details"
        });
    }

    if (!isMember(groupId, req.user.id) ||
        !isMember(groupId, receiverId)) {
        return res.status(404).json({
            error: "Group or member not found"
        });
    }


    const balances = db.prepare(`
  SELECT
    u.id AS user_id,
    u.name,
    COALESCE(p.total, 0)
      + COALESCE(sent.total, 0)
      - COALESCE(o.total, 0)
      - COALESCE(received.total, 0) AS balance
  FROM group_members gm
  JOIN users u ON u.id = gm.user_id

  LEFT JOIN (
    SELECT paid_by, SUM(total_amount) AS total
    FROM expenses WHERE group_id = ?
    GROUP BY paid_by
  ) p ON p.paid_by = u.id

  LEFT JOIN (
    SELECT es.user_id, SUM(es.amount_owed) AS total
    FROM expense_splits es
    JOIN expenses e ON e.id = es.expense_id
    WHERE e.group_id = ?
    GROUP BY es.user_id
  ) o ON o.user_id = u.id

  LEFT JOIN (
    SELECT sender_id, SUM(amount) AS total
    FROM settlements
    WHERE group_id = ? AND status = 'confirmed'
    GROUP BY sender_id
  ) sent ON sent.sender_id = u.id

  LEFT JOIN (
    SELECT receiver_id, SUM(amount) AS total
    FROM settlements
    WHERE group_id = ? AND status = 'confirmed'
    GROUP BY receiver_id
  ) received ON received.receiver_id = u.id

  WHERE gm.group_id = ?
`).all(groupId, groupId, groupId, groupId, groupId);

    const suggested = calculateSettlements(balances);

    const debt = suggested.find(
        item => item.from === req.user.id &&
            item.to === receiverId
    );

    const pending = db.prepare(`
  SELECT COALESCE(SUM(amount), 0) AS total
  FROM settlements
  WHERE group_id = ?
    AND sender_id = ?
    AND receiver_id = ?
    AND status = 'pending'
`).get(groupId, req.user.id, receiverId).total;

    if (!debt || amount + pending > debt.amount) {
        return res.status(400).json({
            error: "Settlement exceeds the outstanding suggested amount"
        });
    }


    const result = db.prepare(`
    INSERT INTO settlements
      (group_id, sender_id, receiver_id, amount, status)
    VALUES (?, ?, ?, ?, 'pending')
  `).run(groupId, req.user.id, receiverId, amount);

    res.status(201).json({
        settlementId: Number(result.lastInsertRowid),
        status: "pending"
    });
});

router.post("/:id/confirm", (req, res) => {
    const id = Number(req.params.id);

    if (!Number.isSafeInteger(id) || id <= 0) {
        return res.status(400).json({
            error: "Invalid settlement ID"
        });
    }

    const settlement = db.prepare(`
    SELECT * FROM settlements WHERE id = ?
  `).get(id);

    if (!settlement || settlement.receiver_id !== req.user.id) {
        return res.status(404).json({
            error: "Settlement not found"
        });
    }

    if (settlement.status !== "pending") {
        return res.status(409).json({
            error: "Settlement is no longer pending"
        });
    }

    const update = db.prepare(`
    UPDATE settlements
    SET status = 'confirmed'
    WHERE id = ? AND status = 'pending'
  `).run(id);

    if (update.changes !== 1) {
        return res.status(409).json({
            error: "Settlement was already updated"
        });
    }

    res.json({
        message: "Payment confirmed",
        status: "confirmed"
    });
});


router.get("/history/:groupId", (req, res) => {
    const groupId = Number(req.params.groupId);

    if (!Number.isSafeInteger(groupId) ||
        groupId <= 0 ||
        !isMember(groupId, req.user.id)) {
        return res.status(404).json({
            error: "Group not found"
        });
    }

    const settlements = db.prepare(`
    SELECT
      s.*,
      sender.name AS sender_name,
      receiver.name AS receiver_name
    FROM settlements s
    JOIN users sender ON sender.id = s.sender_id
    JOIN users receiver ON receiver.id = s.receiver_id
    WHERE s.group_id = ?
    ORDER BY s.created_at DESC
  `).all(groupId);

    res.json({ settlements });
});

export default router;
