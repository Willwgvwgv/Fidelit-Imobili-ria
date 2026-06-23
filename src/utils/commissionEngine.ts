/**
 * Commission engine with standard financial calculation formulas
 */

/**
 * Rounds a number to 2 decimal places for financial calculations.
 */
export function roundFinancial(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Calculates total commission from VGV and commission percentage.
 */
export function calcTotalCommission(vgv: number, commissionPercentage: number): number {
  return roundFinancial((vgv * commissionPercentage) / 100);
}

/**
 * Calculates the value of a split given total commission and split percentage.
 */
export function calcSplitValue(totalCommission: number, splitPercentage: number): number {
  return roundFinancial((totalCommission * splitPercentage) / 100);
}

/**
 * Validates if the sum of all split percentages is exactly 100%.
 */
export function validateSplitsSum(splits: { percentage: number }[]): boolean {
  const sum = splits.reduce((acc, s) => acc + s.percentage, 0);
  return Math.abs(sum - 100) < 0.01;
}
