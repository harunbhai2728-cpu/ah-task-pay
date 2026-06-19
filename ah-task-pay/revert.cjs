const fs = require('fs');

function replaceFile(path, replacer) {
  let text = fs.readFileSync(path, 'utf8');
  text = replacer(text);
  fs.writeFileSync(path, text);
}

replaceFile('src/pages/PostJob.tsx', t => t.replace(/pendingDepositBalance/g, 'heldBalance'));
replaceFile('src/pages/ManageJobs.tsx', t => t.replace(/pendingDepositBalance/g, 'heldBalance'));
replaceFile('src/pages/SubmittedJobs.tsx', t => t.replace(/pendingDepositBalance: increment\(-sub\.reward\)/g, 'heldBalance: increment(-sub.reward)'));
replaceFile('src/pages/JobDetails.tsx', t => {
   return t.replace(/pendingDepositBalance: increment\(-reward\)/g, 'heldBalance: increment(-reward)');
});
replaceFile('src/pages/AdminPanel.tsx', t => {
   let res = t;
   res = res.replace(/pendingDepositBalance: increment\(-sub\.reward\)/g, 'heldBalance: increment(-sub.reward)');
   res = res.replace(/pendingDepositBalance: increment\(-refundAmount\)/g, 'heldBalance: increment(-refundAmount)');
   res = res.replace(/totalHeld = users\.reduce\(\(acc, u\) => acc \+ \(u\.pendingDepositBalance \|\| 0\), 0\)/g, 'totalHeld = users.reduce((acc, u) => acc + (u.heldBalance || 0), 0)');
   return res;
});

replaceFile('src/lib/firebase.ts', t => t.replace(/pendingDepositBalance: 0/g, 'pendingDepositBalance: 0,\n        heldBalance: 0'));

console.log('Reverted heldBalance stuff');
