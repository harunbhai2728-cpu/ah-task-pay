import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder_anon_key';

export const realSupabase = createClient(supabaseUrl, supabaseAnonKey);

const createProxyBuilder = (table: string) => {
    let chain: any = { method: '', table, args: [], eqs: [] };
    const execute = async () => {
        const { data: { session } } = await realSupabase.auth.getSession();
        const token = session?.access_token;
        if (!token) return { data: null, error: new Error('No auth token') };

        const res = await fetch('/api/proxy', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
           body: JSON.stringify(chain)
        });
        const json = await res.json();
        if (!res.ok || (json && json.error)) {
            return { data: null, error: new Error((json && json.error) ? json.error : 'Request failed') };
        }
        return { data: json.data, error: null };
    };

    const builder: any = {
        select: (...args: any[]) => { chain.method = 'select'; chain.args = args; return builder; },
        update: (...args: any[]) => { chain.method = 'update'; chain.args = args; return builder; },
        insert: (...args: any[]) => { chain.method = 'insert'; chain.args = args; return builder; },
        delete: () => { chain.method = 'delete'; return builder; },
        upsert: (...args: any[]) => { chain.method = 'upsert'; chain.args = args; return builder; },
        eq: (...args: any[]) => { 
            chain.eq = args; 
            chain.eqs = [...(chain.eqs || []), args]; 
            return builder; 
        },
        match: (...args: any[]) => { chain.match = args[0]; return builder; },
        in: (...args: any[]) => { chain.in = args; return builder; },
        or: (...args: any[]) => { chain.or = args[0]; return builder; },
        order: (...args: any[]) => { chain.order = args; return builder; },
        limit: (...args: any[]) => { chain.limit = args[0]; return builder; },
        single: () => { chain.single = true; return builder; },
        maybeSingle: () => { chain.maybeSingle = true; return builder; },
        then: (resolve: any, reject: any) => execute().then(resolve, reject),
    };
    return builder;
};

// Global interceptor for relations experiencing infinite recursion due to RLS bugs or schema differences
export const supabase = {
    ...realSupabase,
    from: (table: string) => {
        if (table === 'profiles' || table === 'transactions' || table === 'system_config' || table === 'tickets' || table === 'advertisements' || table === 'jobs' || table === 'submissions') {
             return createProxyBuilder(table);
        }
        return realSupabase.from(table);
    }
};
