
import { Message } from '../types';
import { supabase } from './supabase';

export interface PatientSummary {
  id: string;
  user_id: string;
  timestamp: string;
  summary: string;
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

export const savePatientSummary = async (userId: string, summary: string) => {
  if (!userId) return;
  try {
    const { error } = await supabase.from('summaries').insert({
      user_id: userId,
      summary: summary,
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
      .map(s => `[Session ${new Date(s.timestamp).toLocaleDateString()}]: ${s.summary}`)
      .join('\n');
  } catch (e) {
    console.error('Failed to load patient context from Supabase', e);
    return '';
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
