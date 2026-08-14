import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { DateAttendanceRecord, GroupCancellationReport } from '../types';

export async function fetchDateAttendanceFromSupabase(userId: string, collegeId: string): Promise<DateAttendanceRecord[] | null> {
  if (!isSupabaseConfigured) return null;

  try {
    const { data, error } = await supabase
      .from('attendance')
      .select('*')
      .eq('user_id', userId)
      .eq('college_id', collegeId);

    if (error) {
      console.warn('Supabase fetchDateAttendance error:', error.message);
      return null;
    }

    return (data || []).map((a: any) => ({
      id: a.id,
      user_id: a.user_id,
      college_id: a.college_id,
      date: a.attendance_date || a.date,
      slot_time: a.slot_time,
      subject_code: a.subject_code,
      subject_name: a.subject_name,
      status: a.status as 'attended' | 'absent' | 'cancelled',
      updated_at: a.updated_at || a.created_at
    }));
  } catch (err) {
    console.warn('Failed to fetch attendance:', err);
    return null;
  }
}

export async function markDateAttendanceInSupabase(rec: Partial<DateAttendanceRecord>): Promise<boolean> {
  if (!isSupabaseConfigured) return false;

  try {
    const payload = {
      user_id: rec.user_id,
      college_id: rec.college_id,
      attendance_date: rec.date,
      slot_time: rec.slot_time,
      subject_code: rec.subject_code,
      subject_name: rec.subject_name,
      status: rec.status,
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('attendance')
      .upsert(payload, { onConflict: 'user_id,attendance_date,slot_time' });

    if (error) {
      console.error('Error marking attendance in Supabase:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Failed to mark attendance:', err);
    return false;
  }
}

export async function fetchClassReportsFromSupabase(collegeId: string): Promise<GroupCancellationReport[] | null> {
  if (!isSupabaseConfigured) return null;

  try {
    const { data, error } = await supabase
      .from('class_reports')
      .select('*')
      .eq('college_id', collegeId)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Supabase fetchClassReports error:', error.message);
      return null;
    }

    return (data || []).map((r: any) => ({
      id: r.id,
      college_id: r.college_id,
      date: r.date,
      slot_time: r.slot_time,
      subject_code: r.subject_code,
      subject_name: r.subject_name,
      reported_by_user_id: r.reported_by_user_id,
      reported_by_name: r.reported_by_name,
      confirmed_by_user_ids: r.confirmed_by_user_ids || [],
      created_at: r.created_at
    }));
  } catch (err) {
    console.warn('Failed to fetch class reports:', err);
    return null;
  }
}

export async function reportClassCancellationInSupabase(rep: Partial<GroupCancellationReport>): Promise<GroupCancellationReport | null> {
  if (!isSupabaseConfigured) return null;

  try {
    const { data, error } = await supabase
      .from('class_reports')
      .insert([{
        college_id: rep.college_id,
        date: rep.date,
        slot_time: rep.slot_time,
        subject_code: rep.subject_code,
        subject_name: rep.subject_name,
        reported_by_user_id: rep.reported_by_user_id,
        reported_by_name: rep.reported_by_name,
        confirmed_by_user_ids: [rep.reported_by_user_id]
      }])
      .select()
      .single();

    if (error) {
      console.error('Error reporting class cancellation:', error.message);
      return null;
    }

    return {
      id: data.id,
      college_id: data.college_id,
      date: data.date,
      slot_time: data.slot_time,
      subject_code: data.subject_code,
      subject_name: data.subject_name,
      reported_by_user_id: data.reported_by_user_id,
      reported_by_name: data.reported_by_name,
      confirmed_by_user_ids: data.confirmed_by_user_ids || [],
      created_at: data.created_at
    };
  } catch (err) {
    console.error('Failed to report cancellation:', err);
    return null;
  }
}

export async function confirmClassCancellationInSupabase(reportId: string, userId: string, currentConfirmations: string[]): Promise<boolean> {
  if (!isSupabaseConfigured) return false;

  try {
    const updated = Array.from(new Set([...currentConfirmations, userId]));
    const { error } = await supabase
      .from('class_reports')
      .update({
        confirmed_by_user_ids: updated,
        status: updated.length >= 2 ? 'confirmed' : 'reported'
      })
      .eq('id', reportId);

    if (error) {
      console.error('Error confirming class cancellation:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Failed to confirm cancellation:', err);
    return false;
  }
}
