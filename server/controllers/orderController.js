const { validationResult } = require('express-validator');
const pool = require('../config/db');
const { deductStockForOrder } = require('../services/inventoryService');
const { ensureDbReady } = require('../utils/dbBootstrap');

/**
 * Helper: format JS Date to MySQL DATETIME string
 */
const toMysqlDateTime = (ts) => {
  try {
    return new Date(ts).toISOString().slice(0, 19).replace('T', ' ');
  } catch {
    return new Date().toISOString().slice(0, 19).replace('T', ' ');
  }
};

/**
 * GET /api/orders
 * Get all completed orders with their items
 */
const getAllOrders = async (req, res, next) => {
  try {
    const { from, to, cashier, payment_method, limit = 100, offset = 0 } = req.query;

    let query = 'SELECT * FROM `orders`';
    const params = [];
    const conditions = [];

    if (from) { conditions.push('`timestamp` >= ?'); params.push(from); }
    if (to) { conditions.push('`timestamp` <= ?'); params.push(to); }
    if (cashier) { conditions.push('`cashier` = ?'); params.push(cashier); }
    if (payment_method) { conditions.push('`payment_method` = ?'); params.push(payment_method); }

    if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY `timestamp` DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [orders] = await pool.query(query, params);

    // Fetch order items for all returned orders
    if (orders.length > 0) {
      const orderIds = orders.map((o) => o.id);
      const [items] = await pool.query(
        'SELECT * FROM `order_items` WHERE `order_id` IN (?)',
        [orderIds]
      );

      // Attach items to their parent order
      const itemsByOrder = {};
      items.forEach((item) => {
        if (!itemsByOrder[item.order_id]) itemsByOrder[item.order_id] = [];
        itemsByOrder[item.order_id].push(item);
      });

      orders.forEach((order) => {
        order.items = itemsByOrder[order.id] || [];
      });
    }

    res.status(200).json({ success: true, count: orders.length, orders });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/orders/:id
 * Get a single order by ID with its items
 */
const getOrderById = async (req, res, next) => {
  try {
    const [orders] = await pool.query('SELECT * FROM `orders` WHERE `id` = ?', [req.params.id]);
    if (orders.length === 0) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    const [items] = await pool.query('SELECT * FROM `order_items` WHERE `order_id` = ?', [req.params.id]);
    orders[0].items = items;

    res.status(200).json({ success: true, order: orders[0] });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/orders
 * Create or sync a completed order (with items in a transaction)
 */
const createOrder = async (req, res, next) => {
  try {
    await ensureDbReady();
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const {
      id, timestamp, subtotal, tax, discount, total, paymentMethod, serviceMode,
      cashier, items, tableId, splitGroupId, splitLabel,
    } = req.body;

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const formattedDate = toMysqlDateTime(timestamp);

      // Upsert the order record
      await conn.query(
        `INSERT INTO \`orders\`
         (\`id\`, \`timestamp\`, \`subtotal\`, \`tax\`, \`discount\`, \`total\`,
          \`payment_method\`, \`service_mode\`, \`cashier\`, \`table_id\`, \`split_group_id\`, \`split_label\`)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           \`timestamp\` = VALUES(\`timestamp\`), \`subtotal\` = VALUES(\`subtotal\`),
           \`tax\` = VALUES(\`tax\`), \`discount\` = VALUES(\`discount\`),
           \`total\` = VALUES(\`total\`), \`payment_method\` = VALUES(\`payment_method\`),
           \`service_mode\` = VALUES(\`service_mode\`), \`cashier\` = VALUES(\`cashier\`),
           \`table_id\` = VALUES(\`table_id\`), \`split_group_id\` = VALUES(\`split_group_id\`),
           \`split_label\` = VALUES(\`split_label\`)`,
        [
          id, formattedDate, subtotal, tax, discount || 0, total,
          paymentMethod, serviceMode, cashier || req.user?.username || 'System',
          tableId || null, splitGroupId || null, splitLabel || null,
        ]
      );

      // Replace order items
      await conn.query('DELETE FROM `order_items` WHERE `order_id` = ?', [id]);

      if (Array.isArray(items) && items.length > 0) {
        const itemValues = items.map((line) => {
          const item = line.menuItem || line;
          return [
            id,
            item.id || line.item_id,
            item.name || line.item_name,
            item.category || line.item_category || 'General',
            item.price || line.item_price,
            line.quantity,
            line.notes || '',
          ];
        });

        await conn.query(
          'INSERT INTO `order_items` (`order_id`, `item_id`, `item_name`, `item_category`, `item_price`, `quantity`, `notes`) VALUES ?',
          [itemValues]
        );

        await deductStockForOrder(items, id, conn);
      }

      if (tableId) {
        await conn.query(
          `UPDATE \`dining_tables\`
           SET \`status\` = 'available', \`active_session_id\` = NULL
           WHERE \`id\` = ?`,
          [tableId]
        );
      }

      await conn.commit();
      res.status(201).json({ success: true, message: `Order '${id}' saved successfully.` });
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
 * DELETE /api/orders/:id
 * Delete an order and its items (CASCADE handles items)
 */
const deleteOrder = async (req, res, next) => {
  try {
    const [result] = await pool.query('DELETE FROM `orders` WHERE `id` = ?', [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }
    res.status(200).json({ success: true, message: 'Order deleted.' });
  } catch (err) {
    next(err);
  }
};

/* ===== HELD ORDERS ===== */

/**
 * GET /api/orders/held
 * Get all held/draft orders
 */
const getHeldOrders = async (req, res, next) => {
  try {
    const [orders] = await pool.query('SELECT * FROM `held_orders` ORDER BY `timestamp` DESC');

    if (orders.length > 0) {
      const ids = orders.map((o) => o.id);
      const [items] = await pool.query('SELECT * FROM `held_order_items` WHERE `held_order_id` IN (?)', [ids]);

      const itemsByOrder = {};
      items.forEach((item) => {
        if (!itemsByOrder[item.held_order_id]) itemsByOrder[item.held_order_id] = [];
        itemsByOrder[item.held_order_id].push(item);
      });

      orders.forEach((o) => { o.items = itemsByOrder[o.id] || []; });
    }

    res.status(200).json({ success: true, count: orders.length, heldOrders: orders });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/orders/held
 * Create or update a held order
 */
const saveHeldOrder = async (req, res, next) => {
  try {
    const { id, customerName, timestamp, serviceMode, notes, items, tableId } = req.body;

    if (!id) {
      return res.status(400).json({ success: false, message: 'Held order ID is required.' });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const formattedDate = toMysqlDateTime(timestamp);

      await conn.query(
        `INSERT INTO \`held_orders\` (\`id\`, \`customer_name\`, \`timestamp\`, \`service_mode\`, \`notes\`, \`table_id\`)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           \`customer_name\` = VALUES(\`customer_name\`), \`timestamp\` = VALUES(\`timestamp\`),
           \`service_mode\` = VALUES(\`service_mode\`), \`notes\` = VALUES(\`notes\`),
           \`table_id\` = VALUES(\`table_id\`)`,
        [id, customerName || 'Customer', formattedDate, serviceMode || 'Takeaway', notes || '', tableId || null]
      );

      if (tableId) {
        await conn.query(
          `UPDATE \`dining_tables\` SET \`status\` = 'occupied', \`active_session_id\` = ? WHERE \`id\` = ?`,
          [id, tableId]
        );
      }

      await conn.query('DELETE FROM `held_order_items` WHERE `held_order_id` = ?', [id]);

      if (Array.isArray(items) && items.length > 0) {
        const lineValues = items.map((line) => {
          const item = line.menuItem || line;
          return [id, item.id || line.item_id, item.name || line.item_name, item.category || 'General', item.price || line.item_price, line.quantity, line.notes || ''];
        });

        await conn.query(
          'INSERT INTO `held_order_items` (`held_order_id`, `item_id`, `item_name`, `item_category`, `item_price`, `quantity`, `notes`) VALUES ?',
          [lineValues]
        );
      }

      await conn.commit();
      res.status(201).json({ success: true, message: `Held order '${id}' saved.` });
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
 * DELETE /api/orders/held/:id
 * Delete a held order
 */
const deleteHeldOrder = async (req, res, next) => {
  try {
    const [result] = await pool.query('DELETE FROM `held_orders` WHERE `id` = ?', [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Held order not found.' });
    }
    res.status(200).json({ success: true, message: 'Held order deleted.' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getAllOrders, getOrderById, createOrder, deleteOrder, getHeldOrders, saveHeldOrder, deleteHeldOrder };
