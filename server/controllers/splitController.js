'use strict';

const { validationResult } = require('express-validator');
const pool = require('../config/db');
const { deductStockForOrder } = require('../services/inventoryService');

const toMysqlDateTime = (ts) => {
  try {
    return new Date(ts || Date.now()).toISOString().slice(0, 19).replace('T', ' ');
  } catch {
    return new Date().toISOString().slice(0, 19).replace('T', ' ');
  }
};

/**
 * POST /api/splits/settle
 * Settle a split bill as multiple linked orders in one transaction.
 */
const settleSplitBill = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const {
      splitGroupId,
      tableId,
      serviceMode,
      cashier,
      splits,
    } = req.body;

    if (!Array.isArray(splits) || splits.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one split is required.' });
    }

    const groupId = splitGroupId || `SPL-${Date.now()}`;
    const conn = await pool.getConnection();
    const createdOrderIds = [];

    try {
      await conn.beginTransaction();

      for (let i = 0; i < splits.length; i++) {
        const split = splits[i];
        const {
          label,
          items,
          subtotal,
          tax,
          discount,
          total,
          paymentMethod,
          amountReceived,
          changeGiven,
        } = split;

        const orderId =
          split.orderId ||
          `ORD-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-S${i + 1}-${Date.now().toString().slice(-5)}`;

        const formattedDate = toMysqlDateTime(new Date().toISOString());

        await conn.query(
          `INSERT INTO \`orders\`
           (\`id\`, \`timestamp\`, \`subtotal\`, \`tax\`, \`discount\`, \`total\`,
            \`payment_method\`, \`service_mode\`, \`cashier\`, \`table_id\`, \`split_group_id\`, \`split_label\`)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            orderId,
            formattedDate,
            subtotal,
            tax,
            discount || 0,
            total,
            paymentMethod,
            serviceMode || 'Dine-In',
            cashier || req.user?.username || 'System',
            tableId || null,
            groupId,
            label || `Guest ${i + 1}`,
          ]
        );

        if (Array.isArray(items) && items.length > 0) {
          const itemValues = items.map((line) => {
            const item = line.menuItem || line;
            return [
              orderId,
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

          await deductStockForOrder(items, orderId, conn);
        }

        createdOrderIds.push(orderId);
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

      res.status(201).json({
        success: true,
        message: `Split bill settled — ${createdOrderIds.length} orders created.`,
        data: { splitGroupId: groupId, orderIds: createdOrderIds },
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
 * GET /api/splits/:groupId
 */
const getSplitGroup = async (req, res, next) => {
  try {
    const [orders] = await pool.query(
      'SELECT * FROM `orders` WHERE `split_group_id` = ? ORDER BY `timestamp` ASC',
      [req.params.groupId]
    );

    if (orders.length === 0) {
      return res.status(404).json({ success: false, message: 'Split group not found.' });
    }

    const ids = orders.map((o) => o.id);
    const [items] = await pool.query('SELECT * FROM `order_items` WHERE `order_id` IN (?)', [ids]);

    const itemsByOrder = {};
    items.forEach((item) => {
      if (!itemsByOrder[item.order_id]) itemsByOrder[item.order_id] = [];
      itemsByOrder[item.order_id].push(item);
    });

    orders.forEach((o) => {
      o.items = itemsByOrder[o.id] || [];
    });

    res.status(200).json({ success: true, data: orders });
  } catch (err) {
    next(err);
  }
};

module.exports = { settleSplitBill, getSplitGroup };
