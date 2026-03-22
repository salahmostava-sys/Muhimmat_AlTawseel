/**
 * payrollService — platform-based salary calculation engine.
 *
 * This is a PARALLEL system alongside the existing salary_schemes logic.
 * It does NOT read or write salary_records, salary_schemes, or salary_scheme_tiers.
 * It is purely additive and safe to use alongside the existing system.
 */

import { supabase } from '@/integrations/supabase/client';

// ── Types ──────────────────────────────────────────────────────────────

export type PricingRuleType = 'per_order' | 'fixed' | 'hybrid';

export interface PricingRule {
  id: string;
  platform_id: string;
  min_orders: number;
  max_orders: number | null;
  type: PricingRuleType;
  rate_per_order: number | null;
  fixed_salary: number | null;
  notes: string | null;
  is_active: boolean;
}

export interface PlatformOrderSummary {
  platformId: string;
  platformName: string;
  totalOrders: number;
}

export interface PlatformSalaryBreakdown {
  platformId: string;
  platformName: string;
  totalOrders: number;
  ruleApplied: PricingRule | null;
  salary: number;
  /** Human-readable explanation of how salary was computed */
  breakdown: string;
  /** true when no active pricing_rule covers this order count */
  noRuleFound: boolean;
}

export interface SalaryCalculationResult {
  driverId: string;
  monthYear: string;
  platforms: PlatformSalaryBreakdown[];
  /** Sum of salary across all platforms */
  totalSalary: number;
  /** false when at least one platform had no matching rule */
  hasRulesForAllPlatforms: boolean;
  calculatedAt: string;
}

// ── Helpers ────────────────────────────────────────────────────────────

/** Apply a single pricing rule to an order count and return the salary amount. */
function applyRule(rule: PricingRule, orders: number): number {
  switch (rule.type) {
    case 'per_order':
      return orders * (rule.rate_per_order ?? 0);

    case 'fixed':
      return rule.fixed_salary ?? 0;

    case 'hybrid':
      return (rule.fixed_salary ?? 0) + orders * (rule.rate_per_order ?? 0);

    default:
      return 0;
  }
}

/** Build a human-readable breakdown string for a rule application. */
function buildBreakdown(rule: PricingRule, orders: number, salary: number): string {
  const fmt = (n: number) => n.toLocaleString('ar-SA', { minimumFractionDigits: 2 });

  switch (rule.type) {
    case 'per_order':
      return `${orders} طلب × ${fmt(rule.rate_per_order ?? 0)} = ${fmt(salary)} ر.س`;

    case 'fixed':
      return `راتب ثابت = ${fmt(salary)} ر.س`;

    case 'hybrid':
      return (
        `راتب ثابت ${fmt(rule.fixed_salary ?? 0)} + (${orders} طلب × ${fmt(rule.rate_per_order ?? 0)}) = ${fmt(salary)} ر.س`
      );

    default:
      return `—`;
  }
}

/** Find the best matching active rule for an order count on a platform. */
function matchRule(rules: PricingRule[], orders: number): PricingRule | null {
  const active = rules.filter(r => r.is_active);
  // Sort by min_orders descending so the highest applicable tier wins
  const sorted = [...active].sort((a, b) => b.min_orders - a.min_orders);

  for (const rule of sorted) {
    const aboveMin = orders >= rule.min_orders;
    const belowMax = rule.max_orders === null || orders <= rule.max_orders;
    if (aboveMin && belowMax) return rule;
  }
  return null;
}

// ── Service ────────────────────────────────────────────────────────────

export const payrollService = {
  /**
   * Fetch all pricing rules for a specific platform.
   * Returns all rules (active and inactive) so callers can decide what to use.
   */
  getPlatformRules: async (platformId: string): Promise<{ data: PricingRule[]; error: unknown }> => {
    const { data, error } = await supabase
      .from('pricing_rules' as any)
      .select('*')
      .eq('platform_id', platformId)
      .order('min_orders', { ascending: true });
    return { data: (data ?? []) as PricingRule[], error };
  },

  /** Fetch all active pricing rules across all platforms (for UI listing). */
  getAllRules: async (): Promise<{ data: PricingRule[]; error: unknown }> => {
    const { data, error } = await supabase
      .from('pricing_rules' as any)
      .select('*, apps(id, name, brand_color)')
      .eq('is_active', true)
      .order('min_orders', { ascending: true });
    return { data: (data ?? []) as PricingRule[], error };
  },

  /** Create a new pricing rule. */
  createRule: async (payload: Omit<PricingRule, 'id' | 'is_active'> & { is_active?: boolean }) => {
    const { data, error } = await supabase
      .from('pricing_rules' as any)
      .insert(payload)
      .select()
      .single();
    return { data, error };
  },

  /** Update an existing rule. */
  updateRule: async (id: string, payload: Partial<Omit<PricingRule, 'id'>>) => {
    const { data, error } = await supabase
      .from('pricing_rules' as any)
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    return { data, error };
  },

  /** Soft-disable a rule (preferred over deletion). */
  deactivateRule: async (id: string) => {
    const { error } = await supabase
      .from('pricing_rules' as any)
      .update({ is_active: false })
      .eq('id', id);
    return { error };
  },

  /** Permanently delete a rule (use deactivateRule for safety). */
  deleteRule: async (id: string) => {
    const { error } = await supabase
      .from('pricing_rules' as any)
      .delete()
      .eq('id', id);
    return { error };
  },

  /**
   * Core method — calculate salary for a single driver for a given month.
   *
   * Steps:
   *  1. Fetch daily_orders for this driver in the month → group by platform
   *  2. Fetch pricing_rules for each platform that has orders
   *  3. Match rule by order range
   *  4. Apply rule type formula
   *  5. Return full breakdown + total
   *
   * This is READ-ONLY — it never writes to salary_records.
   * Callers may compare the result against the existing scheme-based salary.
   */
  calculateSalary: async (
    driverId: string,
    monthYear: string,
  ): Promise<{ result: SalaryCalculationResult | null; error: unknown }> => {
    const [year, month] = monthYear.split('-');
    const fromDate = `${year}-${month}-01`;
    const toDate = new Date(Number(year), Number(month), 0).toISOString().split('T')[0];

    // ── Step 1: Fetch orders for this driver this month ──────────────
    const { data: orderRows, error: orderError } = await supabase
      .from('daily_orders')
      .select('app_id, orders_count, apps(id, name)')
      .eq('employee_id', driverId)
      .gte('date', fromDate)
      .lte('date', toDate);

    if (orderError) return { result: null, error: orderError };

    // Group orders by platform
    const platformTotals: Record<string, PlatformOrderSummary> = {};
    for (const row of orderRows ?? []) {
      const appId: string = (row as any).app_id;
      const appName: string = (row as any).apps?.name ?? appId;
      if (!platformTotals[appId]) {
        platformTotals[appId] = { platformId: appId, platformName: appName, totalOrders: 0 };
      }
      platformTotals[appId].totalOrders += (row as any).orders_count ?? 0;
    }

    const platformList = Object.values(platformTotals);

    if (platformList.length === 0) {
      // Driver had no orders this month
      return {
        result: {
          driverId,
          monthYear,
          platforms: [],
          totalSalary: 0,
          hasRulesForAllPlatforms: true,
          calculatedAt: new Date().toISOString(),
        },
        error: null,
      };
    }

    // ── Step 2 & 3: For each platform, fetch rules and match ─────────
    const platformBreakdowns: PlatformSalaryBreakdown[] = [];
    let totalSalary = 0;
    let hasRulesForAllPlatforms = true;

    for (const platform of platformList) {
      const { data: rules, error: rulesError } = await supabase
        .from('pricing_rules' as any)
        .select('*')
        .eq('platform_id', platform.platformId)
        .eq('is_active', true)
        .order('min_orders', { ascending: true });

      if (rulesError) return { result: null, error: rulesError };

      const matchedRule = matchRule((rules ?? []) as PricingRule[], platform.totalOrders);

      let salary = 0;
      let breakdown = 'لا توجد قاعدة تسعير مطابقة';
      let noRuleFound = true;

      if (matchedRule) {
        // ── Step 4: Apply formula ──────────────────────────────────
        salary = applyRule(matchedRule, platform.totalOrders);
        breakdown = buildBreakdown(matchedRule, platform.totalOrders, salary);
        noRuleFound = false;
      } else {
        hasRulesForAllPlatforms = false;
      }

      totalSalary += salary;
      platformBreakdowns.push({
        platformId: platform.platformId,
        platformName: platform.platformName,
        totalOrders: platform.totalOrders,
        ruleApplied: matchedRule,
        salary,
        breakdown,
        noRuleFound,
      });
    }

    return {
      result: {
        driverId,
        monthYear,
        platforms: platformBreakdowns,
        totalSalary,
        hasRulesForAllPlatforms,
        calculatedAt: new Date().toISOString(),
      },
      error: null,
    };
  },

  /**
   * Calculate salary for ALL active drivers in a month.
   * Returns an array of results — one per driver.
   * Useful for bulk payroll preview or comparison reporting.
   */
  calculateBulkSalary: async (
    monthYear: string,
  ): Promise<{ results: SalaryCalculationResult[]; error: unknown }> => {
    // Fetch all active driver IDs
    const { data: employees, error: empError } = await supabase
      .from('employees')
      .select('id')
      .eq('status', 'active');

    if (empError) return { results: [], error: empError };

    const results: SalaryCalculationResult[] = [];

    for (const emp of employees ?? []) {
      const { result, error } = await payrollService.calculateSalary(emp.id, monthYear);
      if (error) return { results: [], error };
      if (result) results.push(result);
    }

    return { results, error: null };
  },

  /**
   * Compare new pricing_rules salary vs existing scheme salary for a driver.
   * Returns both values side-by-side for auditing/validation.
   * Does NOT modify any data.
   */
  compareWithSchemeSalary: async (
    driverId: string,
    monthYear: string,
  ): Promise<{
    pricingRulesSalary: number | null;
    existingSchemeSalary: number | null;
    difference: number | null;
    error: unknown;
  }> => {
    // New system calculation
    const { result, error: calcError } = await payrollService.calculateSalary(driverId, monthYear);
    if (calcError) return { pricingRulesSalary: null, existingSchemeSalary: null, difference: null, error: calcError };

    // Existing system: read approved salary_records
    const { data: salaryRecord, error: schemeError } = await supabase
      .from('salary_records')
      .select('net_salary')
      .eq('employee_id', driverId)
      .eq('month_year', monthYear)
      .maybeSingle();

    if (schemeError) return { pricingRulesSalary: null, existingSchemeSalary: null, difference: null, error: schemeError };

    const pricingRulesSalary = result?.totalSalary ?? null;
    const existingSchemeSalary = (salaryRecord as any)?.net_salary ?? null;
    const difference =
      pricingRulesSalary !== null && existingSchemeSalary !== null
        ? pricingRulesSalary - existingSchemeSalary
        : null;

    return { pricingRulesSalary, existingSchemeSalary, difference, error: null };
  },
};
