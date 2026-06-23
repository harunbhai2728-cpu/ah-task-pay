-- 1. Create a table to store Push Subscriptions (supports multiple devices per user)
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    subscription JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    UNIQUE(user_id, subscription)
);

-- 2. Trigger for Submissions
CREATE OR REPLACE FUNCTION handle_submission_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_job_title TEXT;
  new_notification JSONB;
BEGIN
  IF (NEW.status = 'approved' AND OLD.status != 'approved') OR (NEW.status = 'rejected' AND OLD.status != 'rejected') THEN
    SELECT title INTO v_job_title FROM public.jobs WHERE id = NEW.job_id;
    
    IF NEW.status = 'approved' THEN
      new_notification := jsonb_build_object(
        'id', gen_random_uuid(),
        'message', 'Congratulations! Your task "' || v_job_title || '" has been approved.',
        'isRead', false,
        'createdAt', (now() at time zone 'utc')::text
      );
    ELSIF NEW.status = 'rejected' THEN
      new_notification := jsonb_build_object(
        'id', gen_random_uuid(),
        'message', 'Your task "' || v_job_title || '" was rejected.',
        'isRead', false,
        'createdAt', (now() at time zone 'utc')::text
      );
    END IF;

    UPDATE public.profiles
    SET notifications = COALESCE(notifications, '[]'::jsonb) || jsonb_build_array(new_notification)
    WHERE id = NEW.worker_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS submission_status_trigger ON public.submissions;
CREATE TRIGGER submission_status_trigger
AFTER UPDATE OF status ON public.submissions
FOR EACH ROW
EXECUTE FUNCTION handle_submission_status_change();

-- 3. Trigger for Withdrawals
CREATE OR REPLACE FUNCTION handle_withdrawal_status_change()
RETURNS TRIGGER AS $$
DECLARE
  new_notification JSONB;
BEGIN
  IF NEW.type = 'withdraw' AND NEW.status = 'approved' AND OLD.status != 'approved' THEN
    new_notification := jsonb_build_object(
      'id', gen_random_uuid(),
      'message', 'Success! Your withdrawal of ' || NEW.amount || ' BDT has been processed.',
      'isRead', false,
      'createdAt', (now() at time zone 'utc')::text
    );

    UPDATE public.profiles
    SET notifications = COALESCE(notifications, '[]'::jsonb) || jsonb_build_array(new_notification)
    WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS withdrawal_status_trigger ON public.transactions;
CREATE TRIGGER withdrawal_status_trigger
AFTER UPDATE OF status ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION handle_withdrawal_status_change();
