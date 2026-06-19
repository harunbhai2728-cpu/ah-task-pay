const admin = require('firebase-admin');
const fs = require('fs');

if (!process.env.FIREBASE_PROJECT_ID) {
  process.env.FIREBASE_PROJECT_ID = "ais-dev-vqzhol3zvc6gimzgggcln5";
}
// since we don't have certs readily available to node without service account, we can just do this via react component
