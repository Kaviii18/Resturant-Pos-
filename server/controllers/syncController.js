const pool = require('../config/db');

/**
 * POST /api/sync
 * Bulk sync all state from the frontend to MySQL in a single transaction.
 * Mirrors the original /api/mysql/sync-all endpoint from server.ts.
 */
const syncAll = async (req, res, next) => {
  const { config, menuItems, orders, heldOrders, users } = req.body;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    let itemsSynced = 0;
    let ordersSynced = 0;
    let holdsSynced = 0;
    let usersSynced = 0;

    const toMysqlDate = (ts) => {
      try { return new Date(ts).toISOString().slice(0, 19).replace('T', ' '); }
      catch { return new Date().toISOString().slice(0, 19).replace('T', ' '); }
    };

    // A. Config
    if (config) {
      await conn.query(
        `INSERT INTO \`restaurant_config\` (\`id\`, \`name\`, \`address\`, \`phone\`, \`tax_rate\`, \`currency\`, \`currency_symbol\`)
         VALUES ('default', ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE \`name\`=VALUES(\`name\`), \`address\`=VALUES(\`address\`),
           \`phone\`=VALUES(\`phone\`), \`tax_rate\`=VALUES(\`tax_rate\`),
           \`currency\`=VALUES(\`currency\`), \`currency_symbol\`=VALUES(\`currency_symbol\`)`,
        [config.name || 'Restaurant', config.address || '', config.phone || '',
         config.taxRate ?? 0.10, config.currency || 'LKR', config.currencySymbol || 'Rs.']
      );
    }

    // B. Menu items
    if (Array.isArray(menuItems)) {
      for (const item of menuItems) {
        await conn.query(
          `INSERT INTO \`menu_items\` (\`id\`, \`name\`, \`category\`, \`price\`, \`is_available\`, \`description\`, \`image_url\`)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE \`name\`=VALUES(\`name\`), \`category\`=VALUES(\`category\`),
             \`price\`=VALUES(\`price\`), \`is_available\`=VALUES(\`is_available\`),
             \`description\`=VALUES(\`description\`), \`image_url\`=VALUES(\`image_url\`)`,
          [item.id, item.name, item.category || 'General', item.price,
           item.isAvailable ? 1 : 0, item.description || '', item.imageUrl || '']
        );
        itemsSynced++;
      }
    }

    // C. Users
    if (Array.isArray(users)) {
      for (const u of users) {
        await conn.query(
          `INSERT INTO \`users\` (\`username\`, \`full_name\`, \`password\`, \`role\`)
           VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE \`full_name\`=VALUES(\`full_name\`),
             \`password\`=VALUES(\`password\`), \`role\`=VALUES(\`role\`)`,
          [u.username, u.fullName || u.full_name, u.password || null, u.role || 'Cashier']
        );
        usersSynced++;
      }
    }

    // D. Orders & order items
    if (Array.isArray(orders)) {
      for (const o of orders) {
        await conn.query(
          `INSERT INTO \`orders\` (\`id\`, \`timestamp\`, \`subtotal\`, \`tax\`, \`discount\`, \`total\`, \`payment_method\`, \`service_mode\`, \`cashier\`)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE \`timestamp\`=VALUES(\`timestamp\`), \`subtotal\`=VALUES(\`subtotal\`),
             \`tax\`=VALUES(\`tax\`), \`discount\`=VALUES(\`discount\`), \`total\`=VALUES(\`total\`),
             \`payment_method\`=VALUES(\`payment_method\`), \`service_mode\`=VALUES(\`service_mode\`), \`cashier\`=VALUES(\`cashier\`)`,
          [o.id, toMysqlDate(o.timestamp), o.subtotal, o.tax, o.discount || 0, o.total,
           o.paymentMethod, o.serviceMode, o.cashier || 'System']
        );

        await conn.query('DELETE FROM `order_items` WHERE `order_id` = ?', [o.id]);

        if (Array.isArray(o.items)) {
          for (const wrapper of o.items) {
            const m = wrapper.menuItem || wrapper;
            await conn.query(
              'INSERT INTO `order_items` (`order_id`, `item_id`, `item_name`, `item_category`, `item_price`, `quantity`, `notes`) VALUES (?, ?, ?, ?, ?, ?, ?)',
              [o.id, m.id || wrapper.item_id, m.name || wrapper.item_name,
               m.category || wrapper.item_category || 'General',
               m.price || wrapper.item_price, wrapper.quantity, wrapper.notes || '']
            );
          }
        }
        ordersSynced++;
      }
    }

    // E. Held orders
    if (Array.isArray(heldOrders)) {
      for (const h of heldOrders) {
        await conn.query(
          `INSERT INTO \`held_orders\` (\`id\`, \`customer_name\`, \`timestamp\`, \`service_mode\`, \`notes\`)
           VALUES (?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE \`customer_name\`=VALUES(\`customer_name\`), \`timestamp\`=VALUES(\`timestamp\`),
             \`service_mode\`=VALUES(\`service_mode\`), \`notes\`=VALUES(\`notes\`)`,
          [h.id, h.customerName || 'Customer', toMysqlDate(h.timestamp), h.serviceMode || 'Takeaway', h.notes || '']
        );

        await conn.query('DELETE FROM `held_order_items` WHERE `held_order_id` = ?', [h.id]);

        if (Array.isArray(h.items)) {
          for (const line of h.items) {
            const m = line.menuItem || line;
            await conn.query(
              'INSERT INTO `held_order_items` (`held_order_id`, `item_id`, `item_name`, `item_category`, `item_price`, `quantity`, `notes`) VALUES (?, ?, ?, ?, ?, ?, ?)',
              [h.id, m.id || line.item_id, m.name || line.item_name,
               m.category || line.item_category || 'General',
               m.price || line.item_price, line.quantity, line.notes || '']
            );
          }
        }
        holdsSynced++;
      }
    }

    await conn.commit();

    res.status(200).json({
      success: true,
      message: 'All data synced to MySQL successfully!',
      details: { menuItems: itemsSynced, orders: ordersSynced, heldOrders: holdsSynced, users: usersSynced },
    });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};

module.exports = { syncAll };
