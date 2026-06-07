const fs = require('fs');
const files = [
  'src/pages/SubmittedJobs.tsx',
  'src/pages/JobDetails.tsx',
  'src/pages/AdminPanel.tsx',
  'src/pages/PostJob.tsx',
  'src/pages/ManageJobs.tsx',
  'src/pages/Dashboard.tsx',
  'src/lib/firebase.ts'
];
for(const f of files){
  let text = fs.readFileSync(f, 'utf8');
  text = text.replace(/heldBalance/g, 'pendingDepositBalance');
  fs.writeFileSync(f, text);
}
console.log('Replaced successfully');
