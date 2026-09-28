import { useEffect, useState } from 'react';
import type { Script } from '@/features/roles/data';
import { supabase } from '@/services/supabase';

/** The scripts a DM can pick from, most recently edited first; fetched while `enabled`. */
export function useScripts(enabled = true): Script[] | null {
  const [scripts, setScripts] = useState<Script[] | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    supabase
      .from('scripts')
      .select('*')
      .order('updated_at', { ascending: false })
      .then(({ data }) => {
        if (live) setScripts(data ?? []);
      });
    return () => {
      live = false;
    };
  }, [enabled]);
  return scripts;
}
