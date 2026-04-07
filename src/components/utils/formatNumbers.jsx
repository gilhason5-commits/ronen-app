/**
 * Format a number with comma separators for thousands.
 * @param {number} num - Number to format
 * @param {number} decimals - Max decimal places (default 2)
 * @returns {string} Formatted number string
 */
export const fmtNum = (num, decimals = 2) => {
  if (!num && num !== 0) return '0';
  if (num === 0) return '0';
  const fixed = Number(Number(num).toFixed(decimals));
  const parts = fixed.toString().split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return parts.join('.');
};

/**
 * Format a currency value with ₪ sign and comma separators.
 * @param {number} num - Amount in shekels
 * @param {number} decimals - Decimal places (default 2)
 * @returns {string} Formatted currency string
 */
export const fmtCurrency = (num, decimals = 2) => {
  return `₪${fmtNum(num, decimals)}`;
};