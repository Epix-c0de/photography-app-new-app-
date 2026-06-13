-- Migration: Fix admin_subscriptions table and revenue_pipeline view
-- Task: 1.5 Create migration fixing admin_subscriptions and revenue_pipeline view
-- Requirements: 6.2, 6.3, 6.4, 6.5

-- Add payment_method column to admin_subscriptions table if not exists
ALTER TABLE public.admin_subscriptions
ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'mpesa';

-- Drop the existing revenue_pipeline view if it exists
DROP VIEW IF EXISTS public.revenue_pipeline CASCADE;

-- Recreate revenue_pipeline view.
-- Note: public.payments has no payment_method column, so we use NULL for the
-- commission rows. admin_subscriptions now has payment_method from the ALTER above.
CREATE OR REPLACE VIEW public.revenue_pipeline AS
SELECT
  DATE_TRUNC('month', s.created_at) AS month,
  COALESCE(s.payment_method, 'mpesa') AS payment_method,
  'subscription'                     AS revenue_type,
  SUM(s.amount)                      AS total_revenue,
  COUNT(s.id)                        AS transaction_count,
  AVG(s.amount)                      AS average_transaction
FROM public.admin_subscriptions s
WHERE s.status = 'success'
GROUP BY DATE_TRUNC('month', s.created_at), s.payment_method

UNION ALL

SELECT
  DATE_TRUNC('month', p.created_at) AS month,
  'mpesa'::TEXT                      AS payment_method,  -- payments.payment_method does not exist; default to 'mpesa'
  'commission'                       AS revenue_type,
  SUM(p.amount * 0.10)               AS total_revenue,
  COUNT(p.id)                        AS transaction_count,
  AVG(p.amount * 0.10)               AS average_transaction
FROM public.payments p
WHERE p.status IN ('paid', 'success')   -- payments uses 'paid' not 'success'
GROUP BY DATE_TRUNC('month', p.created_at)

ORDER BY month DESC, revenue_type;

COMMENT ON VIEW public.revenue_pipeline IS
  'Aggregates subscription and commission revenue by month and payment method. '
  'Subscription rows use admin_subscriptions.payment_method; commission rows default to mpesa.';

GRANT SELECT ON public.revenue_pipeline TO authenticated;
