const db = require("better-sqlite3")("./allinone.db");

try {

    db.prepare(`
        ALTER TABLE users
        ADD COLUMN role TEXT NOT NULL DEFAULT 'user'
    `).run();

    db.prepare(`
        UPDATE users
        SET role = 'user'
    `).run();

    console.log("");
    console.log("======================================");
    console.log(" ALL-IN-ONE.COM ADMIN ROLE SETUP");
    console.log("======================================");
    console.log("");

    console.log(
        db.prepare(`
            SELECT
                id,
                name,
                email,
                role
            FROM users
            ORDER BY id
        `).all()
    );

    console.log("");
    console.log("✅ Role column added successfully.");

} catch (error) {

    console.error("");
    console.error("❌ ADMIN ROLE SETUP ERROR:");
    console.error(error.message);

}

db.close();