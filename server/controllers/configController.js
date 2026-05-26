const pool = require('../config/db');

/**
 * GET /api/config
 * Get restaurant configuration
 */
const getConfig = async (req, res, next) => {
  try {
    const [rows] = await pool.query("SELECT * FROM `restaurant_config` WHERE `id` = 'default'");

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Restaurant configuration not found.' });
    }

    const raw = rows[0];
    // Map DB columns to camelCase for frontend compatibility
    const config = {
      name: raw.name,
      address: raw.address,
      phone: raw.phone,
      taxRate: parseFloat(raw.tax_rate),
      currency: raw.currency,
      currencySymbol: raw.currency_symbol,
      updatedAt: raw.updated_at,
    };

    res.status(200).json({ success: true, config });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/config
 * Create or update restaurant configuration
 */
const saveConfig = async (req, res, next) => {
  try {
    const { name, address, phone, taxRate, currency, currencySymbol } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Restaurant name is required.' });
    }

    await pool.query(
      `INSERT INTO \`restaurant_config\` (\`id\`, \`name\`, \`address\`, \`phone\`, \`tax_rate\`, \`currency\`, \`currency_symbol\`)
       VALUES ('default', ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         \`name\` = VALUES(\`name\`), \`address\` = VALUES(\`address\`),
         \`phone\` = VALUES(\`phone\`), \`tax_rate\` = VALUES(\`tax_rate\`),
         \`currency\` = VALUES(\`currency\`), \`currency_symbol\` = VALUES(\`currency_symbol\`)`,
      [name, address || '', phone || '', taxRate ?? 0.10, currency || 'LKR', currencySymbol || 'Rs.']
    );

    res.status(200).json({ success: true, message: 'Restaurant configuration saved.' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getConfig, saveConfig };
