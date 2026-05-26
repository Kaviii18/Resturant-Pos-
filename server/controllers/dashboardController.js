const pool = require('../config/db');

/**
 * GET /api/dashboard/stats
 * Return aggregated POS analytics for the dashboard
 */
const getDashboardStats = async (req, res, next) => {
  try {
    const { period = 'today' } = req.query;

    // Determine date range based on period
    let dateCondition = '';
    if (period === 'today') {
      dateCondition = 'DATE(`timestamp`) = CURDATE()';
    } else if (period === 'week') {
      dateCondition = '`timestamp` >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
    } else if (period === 'month') {
      dateCondition = '`timestamp` >= DATE_SUB(NOW(), INTERVAL 30 DAY)';
    } else {
      dateCondition = '1=1'; // all time
    }

    // 1. Total sales & order count
    const [[salesSummary]] = await pool.query(
      `SELECT COUNT(*) AS totalOrders, COALESCE(SUM(\`total\`), 0) AS totalRevenue,
              COALESCE(SUM(\`discount\`), 0) AS totalDiscounts,
              COALESCE(SUM(\`tax\`), 0) AS totalTax
       FROM \`orders\` WHERE ${dateCondition}`
    );

    // 2. Revenue by payment method
    const [paymentBreakdown] = await pool.query(
      `SELECT \`payment_method\`, COUNT(*) AS count, COALESCE(SUM(\`total\`), 0) AS revenue
       FROM \`orders\` WHERE ${dateCondition}
       GROUP BY \`payment_method\` ORDER BY revenue DESC`
    );

    // 3. Revenue by service mode
    const [serviceModeBreakdown] = await pool.query(
      `SELECT \`service_mode\`, COUNT(*) AS count, COALESCE(SUM(\`total\`), 0) AS revenue
       FROM \`orders\` WHERE ${dateCondition}
       GROUP BY \`service_mode\``
    );

    // 4. Top selling items
    const [topItems] = await pool.query(
      `SELECT oi.\`item_name\`, oi.\`item_category\`, 
              SUM(oi.\`quantity\`) AS totalQty,
              SUM(oi.\`quantity\` * oi.\`item_price\`) AS totalRevenue
       FROM \`order_items\` oi
       JOIN \`orders\` o ON oi.\`order_id\` = o.\`id\`
       WHERE ${dateCondition.replace(/\`timestamp\`/g, 'o.`timestamp`').replace('CURDATE()', 'CURDATE()').replace('DATE(', 'DATE(o.')}
       GROUP BY oi.\`item_id\`, oi.\`item_name\`, oi.\`item_category\`
       ORDER BY totalQty DESC LIMIT 10`
    );

    // 5. Sales per cashier
    const [cashierStats] = await pool.query(
      `SELECT \`cashier\`, COUNT(*) AS orders, COALESCE(SUM(\`total\`), 0) AS revenue
       FROM \`orders\` WHERE ${dateCondition}
       GROUP BY \`cashier\` ORDER BY revenue DESC`
    );

    // 6. Hourly sales breakdown (for today/week only)
    let hourlySales = [];
    if (period === 'today' || period === 'week') {
      const [hourly] = await pool.query(
        `SELECT HOUR(\`timestamp\`) AS hour, COUNT(*) AS orders, COALESCE(SUM(\`total\`), 0) AS revenue
         FROM \`orders\` WHERE ${dateCondition}
         GROUP BY HOUR(\`timestamp\`) ORDER BY hour`
      );
      hourlySales = hourly;
    }

    // 7. Total menu items and users
    const [[menuCount]] = await pool.query('SELECT COUNT(*) AS total FROM `menu_items`');
    const [[userCount]] = await pool.query('SELECT COUNT(*) AS total FROM `users`');
    const [[heldCount]] = await pool.query('SELECT COUNT(*) AS total FROM `held_orders`');

    res.status(200).json({
      success: true,
      period,
      stats: {
        totalOrders: salesSummary.totalOrders,
        totalRevenue: parseFloat(salesSummary.totalRevenue),
        totalDiscounts: parseFloat(salesSummary.totalDiscounts),
        totalTax: parseFloat(salesSummary.totalTax),
        totalMenuItems: menuCount.total,
        totalUsers: userCount.total,
        heldOrders: heldCount.total,
        averageOrderValue:
          salesSummary.totalOrders > 0
            ? parseFloat((salesSummary.totalRevenue / salesSummary.totalOrders).toFixed(2))
            : 0,
      },
      paymentBreakdown,
      serviceModeBreakdown,
      topItems,
      cashierStats,
      hourlySales,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getDashboardStats };
