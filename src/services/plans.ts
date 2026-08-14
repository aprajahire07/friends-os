import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { GroupPlan, PlanPoll } from '../types';

function isValidUUID(str?: string | null): boolean {
  if (!str) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

export async function fetchPlansFromSupabase(): Promise<GroupPlan[] | null> {
  if (!isSupabaseConfigured || !supabase) return null;

  try {
    let data: any[] | null = null;
    const { data: primaryData, error: primaryErr } = await supabase
      .from('plans')
      .select('*, plan_participants(*), polls(*, poll_options(*, poll_votes(*))), creator_profile:creator_id(*)')
      .order('plan_date', { ascending: true });

    if (primaryErr || !primaryData) {
      const { data: fallbackData, error: fallbackErr } = await supabase
        .from('plans')
        .select('*, plan_participants(*), polls(*, poll_options(*, poll_votes(*)))')
        .order('plan_date', { ascending: true });

      if (fallbackErr) {
        console.warn('Supabase fetchPlans error:', fallbackErr.message);
        return null;
      }
      data = fallbackData;
    } else {
      data = primaryData;
    }

    return (data || []).map((p: any) => ({
      id: p.id,
      group_id: p.group_id,
      creator_id: p.creator_id,
      title: p.title,
      date: p.plan_date || p.date,
      time: p.start_time || p.time || '18:00',
      location: p.location,
      description: p.description,
      status: (p.status || 'upcoming') as 'upcoming' | 'completed' | 'cancelled',
      participants: (p.plan_participants || []).map((part: any) => ({
        user_id: part.user_id,
        status: (part.status === 'going' ? 'joined' : part.status) as 'joined' | 'declined' | 'maybe'
      })),
      polls: (p.polls || []).map((poll: any) => ({
        id: poll.id,
        plan_id: poll.plan_id,
        question: poll.question,
        allow_multiple: poll.allow_multiple || false,
        options: (poll.poll_options || []).map((opt: any) => ({
          id: opt.id,
          text: opt.option_text || opt.text,
          votes: (opt.poll_votes || []).map((v: any) => v.user_id)
        }))
      })),
      created_at: p.created_at,
      creator_profile: p.creator_profile
    }));
  } catch (err) {
    console.warn('Failed to fetch plans:', err);
    return null;
  }
}

export async function addPlanToSupabase(plan: {
  creator_id: string;
  title: string;
  date: string;
  time?: string;
  location: string;
  description?: string;
  group_id?: string;
}): Promise<GroupPlan | null> {
  if (!isSupabaseConfigured || !supabase || !plan.creator_id) return null;

  try {
    const payload: any = {
      creator_id: plan.creator_id,
      title: plan.title,
      description: plan.description || '',
      location: plan.location,
      plan_date: plan.date,
      start_time: plan.time || '18:00',
      status: 'active'
    };

    if (plan.group_id && isValidUUID(plan.group_id)) {
      payload.group_id = plan.group_id;
    }

    const { data, error } = await supabase
      .from('plans')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error('Error inserting plan:', error.message);
      return null;
    }

    // Add creator as participant
    await supabase.from('plan_participants').insert([{
      plan_id: data.id,
      user_id: plan.creator_id,
      status: 'going'
    }]);

    return {
      id: data.id,
      group_id: data.group_id,
      creator_id: data.creator_id,
      title: data.title,
      date: data.plan_date,
      time: data.start_time,
      location: data.location,
      description: data.description,
      status: 'upcoming',
      participants: [{ user_id: plan.creator_id, status: 'joined' }],
      polls: [],
      created_at: data.created_at
    };
  } catch (err) {
    console.error('Failed to add plan:', err);
    return null;
  }
}

export async function updatePlanRsvpInSupabase(planId: string, userId: string, status: 'joined' | 'declined' | 'maybe'): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase || !planId || !userId) return false;

  try {
    const dbStatus = status === 'joined' ? 'going' : status;
    const { error } = await supabase
      .from('plan_participants')
      .upsert({
        plan_id: planId,
        user_id: userId,
        status: dbStatus,
        updated_at: new Date().toISOString()
      }, { onConflict: 'plan_id,user_id' });

    if (error) {
      console.error('Error updating RSVP in Supabase:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Failed to update RSVP:', err);
    return false;
  }
}

export async function votePollOptionInSupabase(pollId: string, optionId: string, userId: string, remove = false): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase || !pollId || !userId) return false;

  try {
    if (remove) {
      const { error } = await supabase
        .from('poll_votes')
        .delete()
        .eq('poll_id', pollId)
        .eq('option_id', optionId)
        .eq('user_id', userId);

      if (error) {
        console.error('Error removing vote:', error.message);
        return false;
      }
      return true;
    } else {
      const { error } = await supabase
        .from('poll_votes')
        .upsert({
          poll_id: pollId,
          option_id: optionId,
          user_id: userId
        }, { onConflict: 'poll_id,user_id' });

      if (error) {
        console.error('Error voting in poll:', error.message);
        return false;
      }
      return true;
    }
  } catch (err) {
    console.error('Failed to vote in poll:', err);
    return false;
  }
}

export async function addPollToPlanInSupabase(planId: string, question: string, options: string[], allow_multiple = false): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase || !planId) return false;

  try {
    const { data: poll, error: pollErr } = await supabase
      .from('polls')
      .insert([{
        plan_id: planId,
        question,
        allow_multiple
      }])
      .select()
      .single();

    if (pollErr) {
      console.error('Error adding poll to plan:', pollErr.message);
      return false;
    }

    const optRows = options.map(text => ({
      poll_id: poll.id,
      option_text: text
    }));

    const { error: optErr } = await supabase
      .from('poll_options')
      .insert(optRows);

    if (optErr) {
      console.error('Error adding poll options:', optErr.message);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Failed to add poll:', err);
    return false;
  }
}


