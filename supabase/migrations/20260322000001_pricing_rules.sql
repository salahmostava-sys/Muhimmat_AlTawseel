-- ============================================================
-- pricing_rules: per-platform salary calculation rules
-- Parallel system — does NOT touch existing salary_schemes
-- ============================================================

CREATE TABLE IF NOT EXISTS public.pricing_rules (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_id      uuid NOT NULL REFERENCES public.apps(id) ON DELETE CASCADE,
  min_orders       integer NOT NULL DEFAULT 0,
  max_orders       integer,              -- NULL = no upper limit
  type             text NOT NULL CHECK (type IN ('per_order', 'fixed', 'hybrid')),
  rate_per_order   numeric(10, 2),       -- used in per_order + hybrid
  fixed_salary     numeric(10, 2),       -- used in fixed + hybrid
  notes            text,
  is_active        boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),

  -- a driver cannot be in two ranges on the same platform
  CONSTRAINT pricing_rules_range_check CHECK (
    max_orders IS NULL OR max_orders >= min_orders
  ),
  CONSTRAINT pricing_rules_per_order_needs_rate CHECK (
    type != 'per_order' OR rate_per_order IS NOT NULL
  ),
  CONSTRAINT pricing_rules_fixed_needs_amount CHECK (
    type != 'fixed' OR fixed_salary IS NOT NULL
  ),
  CONSTRAINT pricing_rules_hybrid_needs_both CHECK (
    type != 'hybrid' OR (rate_per_order IS NOT NULL AND fixed_salary IS NOT NULL)
  )
);

-- Index for the most common lookup: platform + active + order range
CREATE INDEX IF NOT EXISTS idx_pricing_rules_platform
  ON public.pricing_rules (platform_id, is_active, min_orders);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.pricing_rules_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pricing_rules_updated_at ON public.pricing_rules;
CREATE TRIGGER trg_pricing_rules_updated_at
  BEFORE UPDATE ON public.pricing_rules
  FOR EACH ROW EXECUTE FUNCTION public.pricing_rules_set_updated_at();

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE public.pricing_rules ENABLE ROW LEVEL SECURITY;

-- All authenticated active users can read rules
CREATE POLICY "pricing_rules_select"
  ON public.pricing_rules FOR SELECT
  USING (public.is_active_user(auth.uid()));

-- Only admin / finance can insert
CREATE POLICY "pricing_rules_insert"
  ON public.pricing_rules FOR INSERT
  WITH CHECK (
    public.is_active_user(auth.uid())
    AND public.has_role(auth.uid(), ARRAY['admin','finance'])
  );

-- Only admin / finance can update
CREATE POLICY "pricing_rules_update"
  ON public.pricing_rules FOR UPDATE
  USING (
    public.is_active_user(auth.uid())
    AND public.has_role(auth.uid(), ARRAY['admin','finance'])
  );

-- Only admin can delete
CREATE POLICY "pricing_rules_delete"
  ON public.pricing_rules FOR DELETE
  USING (
    public.is_active_user(auth.uid())
    AND public.has_role(auth.uid(), ARRAY['admin'])
  );

-- ── Seed example rules (disabled by default — enable manually) ──
-- INSERT INTO public.pricing_rules (platform_id, min_orders, max_orders, type, rate_per_order, fixed_salary, notes, is_active)
-- SELECT id, 0, 299, 'per_order', 5.00, NULL, 'Base tier: up to 299 orders', false FROM public.apps WHERE name = 'Keeta' LIMIT 1;
--
-- INSERT INTO public.pricing_rules (platform_id, min_orders, max_orders, type, rate_per_order, fixed_salary, notes, is_active)
-- SELECT id, 300, NULL, 'hybrid', 6.00, 200.00, 'Bonus tier: 300+ orders', false FROM public.apps WHERE name = 'Keeta' LIMIT 1;
