import { Message, ClinicalReport } from '../types';
import { supabase } from './supabase';

export interface PatientSummary {
  id: string;
  user_id: string;
  timestamp: string;
  summary: string | ClinicalReport;
}

export const saveChatHistory = async (userId: string, messages: Message[]) => {
  if (!userId) return;
  try {
    const { error } = await supabase.from('chats').insert({
      user_id: userId,
      messages: messages,
      created_at: new Date().toISOString()
    });
    if (error) throw error;
  } catch (e) {
    console.error('Failed to save chat history to Supabase', e);
  }
};

export const savePatientSummary = async (userId: string, summary: string | ClinicalReport) => {
  if (!userId) return;
  try {
    const { error } = await supabase.from('summaries').insert({
      user_id: userId,
      summary: typeof summary === 'string' ? summary : JSON.stringify(summary),
      timestamp: new Date().toISOString()
    });
    if (error) throw error;
  } catch (e) {
    console.error('Failed to save patient summary to Supabase', e);
  }
};

export const getPatientContext = async (userId: string): Promise<string> => {
  if (!userId) return '';
  try {
    const { data, error } = await supabase
      .from('summaries')
      .select('summary, timestamp')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false })
      .limit(5);

    if (error) throw error;
    if (!data || data.length === 0) return '';

    return data
      .map(s => {
        let text = s.summary;
        try {
          const parsed = JSON.parse(s.summary);
          if (parsed && typeof parsed === 'object' && parsed.summary) {
            text = parsed.summary;
          }
        } catch (e) {
          // Not JSON, use as is
        }
        return `[Session ${new Date(s.timestamp).toLocaleDateString()}]: ${text}`;
      })
      .join('\n');
  } catch (e) {
    console.error('Failed to load patient context from Supabase', e);
    return '';
  }
};

export const getLatestReport = async (userId: string): Promise<ClinicalReport | null> => {
  if (!userId) return null;
  try {
    const { data, error } = await supabase
      .from('summaries')
      .select('summary')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) return null;

    try {
      return JSON.parse(data.summary) as ClinicalReport;
    } catch (e) {
      return null;
    }
  } catch (e) {
    return null;
  }
};

export interface ClinicalReportRecord {
  id: string;
  timestamp: string;
  report: ClinicalReport;
}

export const getAllReports = async (userId: string): Promise<ClinicalReportRecord[]> => {
  if (!userId) return [];
  try {
    const { data, error } = await supabase
      .from('summaries')
      .select('id, summary, timestamp')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false });

    if (error || !data) return [];

    return data
      .map(d => {
        try {
          const report = JSON.parse(d.summary);
          if (report && typeof report === 'object' && report.summary) {
            return {
              id: d.id,
              timestamp: d.timestamp,
              report: report as ClinicalReport
            };
          }
        } catch (e) {
          // Skip non-JSON summaries
        }
        return null;
      })
      .filter((r): r is ClinicalReportRecord => r !== null);
  } catch (e) {
    console.error('Failed to get all reports', e);
    return [];
  }
};

export const clearAllMemory = async (userId: string) => {
  if (!userId) return;
  try {
    const { error: error1 } = await supabase.from('summaries').delete().eq('user_id', userId);
    const { error: error2 } = await supabase.from('chats').delete().eq('user_id', userId);
    if (error1 || error2) throw error1 || error2;
  } catch (e) {
    console.error('Failed to clear memory from Supabase', e);
  }
};
