-- ==============================================================================
-- FRIEND OS — WEB PUSH NOTIFICATIONS SQL MIGRATION
-- Run this in your Supabase Dashboard: SQL Editor -> New Query -> Run
-- ==============================================================================

-- 1. Create push_subscriptions Table
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_endpoint UNIQUE (user_id, endpoint)
);

-- 2. Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint ON public.push_subscriptions(endpoint);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- 4. Strict RLS Policies (Users can only access their own device subscriptions)
DROP POLICY IF EXISTS "Users can view their own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can view their own push subscriptions" 
ON public.push_subscriptions FOR SELECT 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can insert their own push subscriptions" 
ON public.push_subscriptions FOR INSERT 
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can update their own push subscriptions" 
ON public.push_subscriptions FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can delete their own push subscriptions" 
ON public.push_subscriptions FOR DELETE 
USING (auth.uid() = user_id);

-- 5. Trigger for updated_at
CREATE OR REPLACE FUNCTION update_push_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_push_subscriptions_updated_at ON public.push_subscriptions;
CREATE TRIGGER tr_push_subscriptions_updated_at
BEFORE UPDATE ON public.push_subscriptions
FOR EACH ROW EXECUTE FUNCTION update_push_subscriptions_updated_at();

-- 6. Verify setup
SELECT count(*) as total_subscriptions FROM public.push_subscriptions;
