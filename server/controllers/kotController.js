'use strict';

const pool = require('../config/db');
const { ensureDbReady } = require('../utils/dbBootstrap');

const toMysqlDateTime = (ts) => {
  try {
    return new Date(ts || Date.now()).toISOString().slice(0, 19).replace('T', ' ');
  } catch {
    return new Date().toISOString().slice(0, 19).replace('T', ' ');
  }
};

const formatTicket = (row) => ({
  id: row.id,
  tableId: row.table_id,
  tableName: row.table_name,
  serviceMode: row.service_mode,
  status: row.status,
  notes: row.notes,
  cashier: row.cashier,
  firedAt: row.fired_at,
  preparedAt: row.prepared_at,
  items: row.items || [],
});

const formatTicketItem = (row) => ({
  id: row.id,
  ticketId: row.ticket_id,
  itemId: row.item_id,
  itemName: row.item_name,
  itemCategory: row.item_category,
  quantity: row.quantity,
  notes: row.notes,
  status: row.status,
});

/**
 * GET /api/kot?status=pending,preparing
 */
const getKitchenTickets = async (req, res, next) => {
  try {
    await ensureDbReady();
    const { status } = req.query;
    let query = `SELECT * FROM \`kitchen_tickets\`
                 WHERE \`status\` NOT IN ('served', 'cancelled')`;
    const params = [];

    if (status) {
      const statuses = status.split(',').map((s) => s.trim());
      query = `SELECT * FROM \`kitchen_tickets\` WHERE \`status\` IN (${statuses.map(() => '?').join(',')})`;
      params.push(...statuses);
    }

    query += ' ORDER BY `fired_at` ASC';

    const [tickets] = await pool.query(query, params);

    if (tickets.length > 0) {
      const ids = tickets.map((t) => t.id);
      const [items] = await pool.query(
        'SELECT * FROM `kitchen_ticket_items` WHERE `ticket_id` IN (?) ORDER BY `id` ASC',
        [ids]
      );
      const byTicket = {};
      items.forEach((item) => {
        if (!byTicket[item.ticket_id]) byTicket[item.ticket_id] = [];
        byTicket[item.ticket_id].push(formatTicketItem(item));
      });
      tickets.forEach((t) => {
        t.items = byTicket[t.id] || [];
      });
    }

    const formatted = tickets.map(formatTicket).map((t) => ({
      ...t,
      items: Array.isArray(t.items) ? t.items : [],
    }));

    res.status(200).json({
      success: true,
      count: formatted.length,
      data: formatted,
      message: formatted.length === 0 ? 'No active kitchen orders' : undefined,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/kot/fire
 */
const fireKitchenTicket = async (req, res, next) => {
  try {
    await ensureDbReady();
    const { tableId, tableName, serviceMode, notes, items, cashier } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one item is required to fire a KOT.' });
    }

    const ticketId = `KOT-${Date.now()}`;
    const firedAt = toMysqlDateTime();

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      await conn.query(
        `INSERT INTO \`kitchen_tickets\`
         (\`id\`, \`table_id\`, \`table_name\`, \`service_mode\`, \`status\`, \`notes\`, \`cashier\`, \`fired_at\`)
         VALUES (?, ?, ?, ?, 'pending', ?, ?, ?)`,
        [
          ticketId,
          tableId || null,
          tableName || null,
          serviceMode || 'Dine-In',
          notes || '',
          cashier || req.user?.username || 'System',
          firedAt,
        ]
      );

      const lineValues = items.map((line) => {
        const item = line.menuItem || line;
        return [
          ticketId,
          item.id || line.item_id,
          item.name || line.item_name,
          item.category || line.item_category || 'General',
          line.quantity,
          line.notes || '',
          'pending',
        ];
      });

      await conn.query(
        `INSERT INTO \`kitchen_ticket_items\`
         (\`ticket_id\`, \`item_id\`, \`item_name\`, \`item_category\`, \`quantity\`, \`notes\`, \`status\`)
         VALUES ?`,
        [lineValues]
      );

      if (tableId) {
        await conn.query(
          `UPDATE \`dining_tables\`
           SET \`status\` = 'occupied', \`active_session_id\` = ?
           WHERE \`id\` = ?`,
          [ticketId, tableId]
        );
      }

      await conn.commit();
      res.status(201).json({
        success: true,
        message: 'Kitchen ticket fired.',
        data: { id: ticketId },
      });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/kot/:id/status
 */
const updateTicketStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const allowed = ['pending', 'preparing', 'ready', 'served', 'cancelled'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid ticket status.' });
    }

    const preparedAt = status === 'ready' ? toMysqlDateTime() : null;

    const [result] = await pool.query(
      `UPDATE \`kitchen_tickets\`
       SET \`status\` = ?, \`prepared_at\` = COALESCE(?, \`prepared_at\`)
       WHERE \`id\` = ?`,
      [status, preparedAt, req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Kitchen ticket not found.' });
    }

    if (status === 'preparing' || status === 'ready' || status === 'served') {
      const itemStatus = status === 'served' ? 'served' : status;
      await pool.query(
        'UPDATE `kitchen_ticket_items` SET `status` = ? WHERE `ticket_id` = ? AND `status` != \'served\'',
        [itemStatus, req.params.id]
      );
    }

    res.status(200).json({ success: true, message: 'Ticket status updated.' });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/kot/:ticketId/items/:itemId/status
 */
const updateTicketItemStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const allowed = ['pending', 'preparing', 'ready', 'served'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid item status.' });
    }

    const [result] = await pool.query(
      'UPDATE `kitchen_ticket_items` SET `status` = ? WHERE `id` = ? AND `ticket_id` = ?',
      [status, req.params.itemId, req.params.ticketId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Ticket item not found.' });
    }

    const [pending] = await pool.query(
      `SELECT COUNT(*) AS cnt FROM \`kitchen_ticket_items\`
       WHERE \`ticket_id\` = ? AND \`status\` NOT IN ('ready', 'served')`,
      [req.params.ticketId]
    );

    if (Number(pending[0].cnt) === 0) {
      await pool.query(
        `UPDATE \`kitchen_tickets\` SET \`status\` = 'ready', \`prepared_at\` = COALESCE(\`prepared_at\`, NOW())
         WHERE \`id\` = ?`,
        [req.params.ticketId]
      );
    } else {
      await pool.query(
        `UPDATE \`kitchen_tickets\` SET \`status\` = 'preparing' WHERE \`id\` = ? AND \`status\` = 'pending'`,
        [req.params.ticketId]
      );
    }

    res.status(200).json({ success: true, message: 'Item status updated.' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getKitchenTickets,
  fireKitchenTicket,
  updateTicketStatus,
  updateTicketItemStatus,
};
