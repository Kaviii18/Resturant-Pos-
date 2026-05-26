'use strict';

const pool = require('../config/db');
const { ensureDbReady } = require('../utils/dbBootstrap');

const formatTable = (row) => {
  const sessionId = row.active_session_id || null;
  const kotStatus = row.kot_status || null;
  const hasActiveKot = Boolean(sessionId && kotStatus && !['served', 'cancelled'].includes(kotStatus));

  return {
    id: row.id,
    name: row.name,
    zone: row.zone,
    capacity: row.capacity,
    status: row.status,
    activeSessionId: sessionId,
    activeKotId: hasActiveKot ? sessionId : null,
    activeKotStatus: hasActiveKot ? kotStatus : null,
    hasActiveOrders: hasActiveKot,
    kitchenLabel: hasActiveKot
      ? `KOT ${kotStatus}`
      : row.status === 'available'
        ? 'Empty Table'
        : 'No Active Orders',
    updatedAt: row.updated_at,
  };
};

/**
 * GET /api/tables
 */
const getAllTables = async (req, res, next) => {
  try {
    await ensureDbReady();
    const [rows] = await pool.query(
      `SELECT dt.*,
              kt.id AS kot_id,
              kt.status AS kot_status
       FROM \`dining_tables\` dt
       LEFT JOIN \`kitchen_tickets\` kt
         ON kt.id = dt.active_session_id
        AND kt.status NOT IN ('served', 'cancelled')
       ORDER BY dt.\`zone\` ASC, dt.\`name\` ASC`
    );
    res.status(200).json({ success: true, count: rows.length, data: rows.map(formatTable) });
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') {
      return res.status(503).json({
        success: false,
        message: 'Table `dining_tables` not found. Restart the backend to auto-create it, or run migrations/002_production_features.sql.',
        code: err.code,
      });
    }
    next(err);
  }
};

/**
 * POST /api/tables — Admin
 */
const createTable = async (req, res, next) => {
  try {
    const { id, name, zone, capacity } = req.body;
    if (!id || !name) {
      return res.status(400).json({ success: false, message: 'Table id and name are required.' });
    }

    await pool.query(
      `INSERT INTO \`dining_tables\` (\`id\`, \`name\`, \`zone\`, \`capacity\`, \`status\`)
       VALUES (?, ?, ?, ?, 'available')`,
      [id, name, zone || 'Main Hall', capacity || 4]
    );

    res.status(201).json({ success: true, message: `Table '${name}' created.` });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/tables/:id/status
 * Body: { status, activeSessionId? }
 */
const updateTableStatus = async (req, res, next) => {
  try {
    const { status, activeSessionId } = req.body;
    const allowed = ['available', 'occupied', 'reserved', 'billing'];
    if (!allowed.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Allowed: ${allowed.join(', ')}`,
      });
    }

    const sessionVal = status === 'available' ? null : (activeSessionId || null);

    const [result] = await pool.query(
      `UPDATE \`dining_tables\`
       SET \`status\` = ?, \`active_session_id\` = ?
       WHERE \`id\` = ?`,
      [status, sessionVal, req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Table not found.' });
    }

    res.status(200).json({ success: true, message: 'Table status updated.' });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/tables/:id — Admin
 */
const deleteTable = async (req, res, next) => {
  try {
    const [result] = await pool.query('DELETE FROM `dining_tables` WHERE `id` = ?', [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Table not found.' });
    }
    res.status(200).json({ success: true, message: 'Table removed.' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getAllTables, createTable, updateTableStatus, deleteTable };
