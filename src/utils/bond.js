const BOND_MONTHS = { fresher: 18, experienced: 12 };

function addMonthsClamped(isoDate, months) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const monthIndex = month - 1 + months;
  const targetYear = year + Math.floor(monthIndex / 12);
  const targetMonth = ((monthIndex % 12) + 12) % 12; // 0-11
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const targetDay = Math.min(day, lastDay);
  const mm = String(targetMonth + 1).padStart(2, "0");
  const dd = String(targetDay).padStart(2, "0");
  return `${targetYear}-${mm}-${dd}`;
}

function computeBond(employeeType, joinDate) {
  const months = BOND_MONTHS[employeeType];
  if (!months) {
    return { bond_duration_months: null, bond_completion_date: null };
  }
  return {
    bond_duration_months: months,
    bond_completion_date: joinDate ? addMonthsClamped(joinDate, months) : null,
  };
}

module.exports = { BOND_MONTHS, addMonthsClamped, computeBond };
