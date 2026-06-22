import fs from 'fs';

let content = fs.readFileSync('server.ts', 'utf-8');

// 1. Remove the entire emulated table block
const startPattern = `// Handle emulated tables locally\n      if (table === 'tickets' || table === 'advertisements') {`;
const endPattern = `              return res.json({ data: resultedItem });\n          }\n      }`;

const startIdx = content.indexOf(startPattern);
const endIdx = content.indexOf(endPattern) + endPattern.length;

if (startIdx !== -1 && endIdx !== -1) {
    const replacement = `// removed emulated tables
      if (table === 'advertisements') {
          const normalizeAdForBackend = (a: any) => {
              if (!a || typeof a !== 'object') return a;
              const n: any = { ...a };
              if ('userId' in a) { n.user_id = a.userId; delete n.userId; }
              if ('userSerial' in a) { n.user_serial = a.userSerial; delete n.userSerial; }
              if ('durationDays' in a) { n.duration_days = a.durationDays; delete n.durationDays; }
              if ('transactionId' in a) { n.transaction_id = a.transactionId; delete n.transactionId; }
              if ('createdAt' in a) { n.created_at = a.createdAt; delete n.createdAt; }
              if ('expiresAt' in a) { n.expires_at = a.expiresAt; delete n.expiresAt; }
              if ('approvedAt' in a) { n.approved_at = a.approvedAt; delete n.approvedAt; }
              if ('rejectedAt' in a) { n.rejected_at = a.rejectedAt; delete n.rejectedAt; }
              return n;
          };
          if (method === 'insert' && args?.[0]) args[0] = Array.isArray(args[0]) ? args[0].map(normalizeAdForBackend) : normalizeAdForBackend(args[0]);
          if ((method === 'update' || method === 'upsert') && args?.[0]) args[0] = normalizeAdForBackend(args[0]);
          if (dbEq && dbEq[0] === 'userId') dbEq[0] = 'user_id';
          if (dbEqs) dbEqs.forEach((r:any) => { if (r && r[0] === 'userId') r[0] = 'user_id'; });
      }

      if (table === 'tickets') {
          const normalizeTicketForBackend = (t: any) => {
              if (!t || typeof t !== 'object') return t;
              const n: any = { ...t };
              if ('userId' in t) { n.user_id = t.userId; delete n.userId; }
              if ('userSerial' in t) { n.user_serial = t.userSerial; delete n.userSerial; }
              if ('adminReply' in t) { n.admin_reply = t.adminReply; delete n.adminReply; }
              if ('createdAt' in t) { n.created_at = t.createdAt; delete n.createdAt; }
              if ('resolvedAt' in t) { n.resolved_at = t.resolvedAt; delete n.resolvedAt; }
              return n;
          };
          if (method === 'insert' && args?.[0]) args[0] = Array.isArray(args[0]) ? args[0].map(normalizeTicketForBackend) : normalizeTicketForBackend(args[0]);
          if ((method === 'update' || method === 'upsert') && args?.[0]) args[0] = normalizeTicketForBackend(args[0]);
          if (dbEq && dbEq[0] === 'userId') dbEq[0] = 'user_id';
          if (dbEqs) dbEqs.forEach((r:any) => { if (r && r[0] === 'userId') r[0] = 'user_id'; });
      }
`;
    content = content.substring(0, startIdx) + replacement + content.substring(endIdx);
}

// 2. Add output mapping
const outStart = `// Map backend-to-frontend transaction types to keep the frontend completely happy
      let modifiedData = data;`;

const outReplacement = outStart + `
      if (table === 'advertisements' && data) {
          const mapOut = (a: any) => {
              if (!a || typeof a !== 'object') return a;
              return {
                  ...a,
                  userId: a.user_id || a.userId,
                  userSerial: a.user_serial || a.userSerial,
                  durationDays: a.duration_days || a.durationDays,
                  transactionId: a.transaction_id || a.transactionId,
                  createdAt: a.created_at || a.createdAt,
                  expiresAt: a.expires_at || a.expiresAt,
                  approvedAt: a.approved_at || a.approvedAt,
                  rejectedAt: a.rejected_at || a.rejectedAt
              };
          };
          modifiedData = Array.isArray(data) ? data.map(mapOut) : mapOut(data);
          data = modifiedData;
      }
      if (table === 'tickets' && data) {
          const mapOut = (t: any) => {
              if (!t || typeof t !== 'object') return t;
              return {
                  ...t,
                  userId: t.user_id || t.userId,
                  userSerial: t.user_serial || t.userSerial,
                  adminReply: t.admin_reply || t.adminReply,
                  createdAt: t.created_at || t.createdAt,
                  resolvedAt: t.resolved_at || t.resolvedAt
              };
          };
          modifiedData = Array.isArray(data) ? data.map(mapOut) : mapOut(data);
          data = modifiedData;
      }
`;
content = content.replace(outStart, outReplacement);

// 3. /api/admin/data changes
const promiseAllOld = `        const [txsSnap, usersSnap, jobsSnap, subSnap] = await Promise.all([
            supabase.from('transactions').select('*').order('created_at', { ascending: false }).limit(1000),
            supabase.from('profiles').select('*').order('createdAt', { ascending: false }).limit(1000),
            supabase.from('jobs').select('*').order('created_at', { ascending: false }).limit(1000),
            supabase.from('submissions').select('*').order('created_at', { ascending: false }).limit(1000)
        ]);`;

const promiseAllNew = `        const [txsSnap, usersSnap, jobsSnap, subSnap, ticketsSnap, adsSnap] = await Promise.all([
            supabase.from('transactions').select('*').order('created_at', { ascending: false }).limit(1000),
            supabase.from('profiles').select('*').order('createdAt', { ascending: false }).limit(1000),
            supabase.from('jobs').select('*').order('created_at', { ascending: false }).limit(1000),
            supabase.from('submissions').select('*').order('created_at', { ascending: false }).limit(1000),
            supabase.from('tickets').select('*').order('created_at', { ascending: false }).limit(1000),
            supabase.from('advertisements').select('*').order('created_at', { ascending: false }).limit(1000)
        ]);`;

content = content.replace(promiseAllOld, promiseAllNew);

const returnsOld = `            submissions: mappedSubs,
            tickets: store.tickets || [],
            ads: store.advertisements || [],
            supabaseServiceRoleReady: isServiceRoleKeyReady`;

const returnsNew = `            submissions: mappedSubs,
            tickets: ticketsSnap.data ? ticketsSnap.data.map(t => {
                const mapOut = (t: any) => ({
                  ...t,
                  userId: t.user_id || t.userId,
                  userSerial: t.user_serial || t.userSerial,
                  adminReply: t.admin_reply || t.adminReply,
                  createdAt: t.created_at || t.createdAt,
                  resolvedAt: t.resolved_at || t.resolvedAt
                });
                return mapOut(t);
            }) : [],
            ads: adsSnap.data ? adsSnap.data.map(a => {
                const mapOut = (a: any) => ({
                  ...a,
                  userId: a.user_id || a.userId,
                  userSerial: a.user_serial || a.userSerial,
                  durationDays: a.duration_days || a.durationDays,
                  transactionId: a.transaction_id || a.transactionId,
                  createdAt: a.created_at || a.createdAt,
                  expiresAt: a.expires_at || a.expiresAt,
                  approvedAt: a.approved_at || a.approvedAt,
                  rejectedAt: a.rejected_at || a.rejectedAt
                });
                return mapOut(a);
            }) : [],
            supabaseServiceRoleReady: isServiceRoleKeyReady`;

content = content.replace(returnsOld, returnsNew);

fs.writeFileSync('server.ts', content, 'utf-8');
console.log('Fixed server.ts');
