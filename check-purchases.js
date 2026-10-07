const db = require("better-sqlite3")("./allinone.db");

const rows = db.prepare(`
    SELECT *
    FROM purchases
`).all();

console.log("PURCHASES:");
console.log(rows);

db.close();