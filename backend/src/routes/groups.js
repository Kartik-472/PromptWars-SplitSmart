
import express from "express";
import crypto from "node:crypto";
import db from "../config/database.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

router.use(authenticate);

function isMember(groupId, userId) {
    return !!db.prepare(`
    SELECT 1 FROM group_members
    WHERE group_id = ? AND user_id = ?
  `).get(groupId, userId);
}

router.get("/", (req, res) => {
    const groups = db.prepare(`
    SELECT
      g.id,
      g.name,
      g.invite_code,
      g.created_at,
      COUNT(gm.user_id) AS member_count
    FROM groups g
    JOIN group_members gm ON gm.group_id = g.id
    WHERE g.id IN (
      SELECT group_id FROM group_members WHERE user_id = ?
    )
    GROUP BY g.id
    ORDER BY g.created_at DESC
  `).all(req.user.id);

    res.json({ groups });
});

router.post("/", (req, res) => {
    const name = String(req.body.name || "").trim();

    if (name.length < 2 || name.length > 60) {
        return res.status(400).json({
            error: "Group name must be 2–60 characters"
        });
    }

    const inviteCode = crypto.randomBytes(5).toString("hex").toUpperCase();

    const createGroup = db.transaction(() => {
        const result = db.prepare(`
      INSERT INTO groups (name, invite_code, created_by)
      VALUES (?, ?, ?)
    `).run(name, inviteCode, req.user.id);

        const groupId = Number(result.lastInsertRowid);

        db.prepare(`
      INSERT INTO group_members (group_id, user_id)
      VALUES (?, ?)
    `).run(groupId, req.user.id);

        return groupId;
    });

    const groupId = createGroup();

    res.status(201).json({
        group: {
            id: groupId,
            name,
            invite_code: inviteCode
        }
    });
});

router.post("/join", (req, res) => {
    const code = String(req.body.inviteCode || "")
        .trim()
        .toUpperCase();

    const group = db.prepare(`
    SELECT id, name FROM groups WHERE invite_code = ?
  `).get(code);

    if (!group) {
        return res.status(404).json({
            error: "Invalid invitation code"
        });
    }

    try {
        db.prepare(`
      INSERT INTO group_members (group_id, user_id)
      VALUES (?, ?)
    `).run(group.id, req.user.id);

        return res.json({
            message: "Successfully joined group",
            group
        });
    } catch {
        return res.status(409).json({
            error: "You are already a member"
        });
    }
});

router.get("/:id", (req, res) => {
    const groupId = Number(req.params.id);

    if (!Number.isSafeInteger(groupId) ||
        groupId <= 0 || !isMember(groupId, req.user.id)) {
        return res.status(404).json({
            error: "Group not found"
        });
    }

    const group = db.prepare(`
    SELECT id, name, invite_code, created_at
    FROM groups WHERE id = ?
  `).get(groupId);

    const members = db.prepare(`
    SELECT u.id, u.name, u.email
    FROM users u
    JOIN group_members gm ON gm.user_id = u.id
    WHERE gm.group_id = ?
  `).all(groupId);

    res.json({ group, members });
});

export { isMember };
export default router;
