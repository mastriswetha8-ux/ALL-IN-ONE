
const Database = require("better-sqlite3");
const path = require("path");

const DB_FILE = path.join(
    __dirname,
    "allinone.db"
);

const db = new Database(DB_FILE);

console.log("");
console.log("======================================");
console.log(" ALL-IN-ONE.COM CREATOR PAYOUT SETUP");
console.log("======================================");
console.log("");

try {

    /*
     * Creator earnings
     *
     * One row for each creator.
     */
    db.exec(`
        CREATE TABLE IF NOT EXISTS creator_earnings (

            id INTEGER PRIMARY KEY AUTOINCREMENT,

            user_id INTEGER NOT NULL UNIQUE,

            total_earnings REAL NOT NULL DEFAULT 0,

            available_balance REAL NOT NULL DEFAULT 0,

            pending_payout REAL NOT NULL DEFAULT 0,

            paid_amount REAL NOT NULL DEFAULT 0,

            updated_at DATETIME
                DEFAULT CURRENT_TIMESTAMP,

            FOREIGN KEY (user_id)
                REFERENCES users(id)
        );
    `);


    /*
     * Creator payout requests
     *
     * status:
     * pending
     * approved
     * rejected
     * paid
     */
    db.exec(`
        CREATE TABLE IF NOT EXISTS creator_payouts (

            id INTEGER PRIMARY KEY AUTOINCREMENT,

            user_id INTEGER NOT NULL,

            amount REAL NOT NULL,

            status TEXT NOT NULL
                DEFAULT 'pending',

            requested_at DATETIME
                DEFAULT CURRENT_TIMESTAMP,

            approved_at DATETIME,

            paid_at DATETIME,

            admin_note TEXT,

            FOREIGN KEY (user_id)
                REFERENCES users(id)
        );
    `);


    /*
     * Earnings history
     *
     * This keeps individual earning records.
     */
    db.exec(`
        CREATE TABLE IF NOT EXISTS creator_earnings_history (

            id INTEGER PRIMARY KEY AUTOINCREMENT,

            user_id INTEGER NOT NULL,

            video_id INTEGER,

            amount REAL NOT NULL,

            earning_type TEXT
                DEFAULT 'video',

            description TEXT,

            created_at DATETIME
                DEFAULT CURRENT_TIMESTAMP,

            FOREIGN KEY (user_id)
                REFERENCES users(id),

            FOREIGN KEY (video_id)
                REFERENCES videos(id)
        );
    `);


    /*
     * Create earnings rows for existing users.
     *
     * Existing users are NOT changed.
     */
    const users =
        db.prepare(`
            SELECT id
            FROM users
            ORDER BY id
        `).all();


    const insertCreator =
        db.prepare(`
            INSERT OR IGNORE INTO
            creator_earnings (
                user_id,
                total_earnings,
                available_balance,
                pending_payout,
                paid_amount
            )
            VALUES (?, 0, 0, 0, 0)
        `);


    const createCreatorRows =
        db.transaction(() => {

            for (const user of users) {

                insertCreator.run(
                    user.id
                );

            }

        });


    createCreatorRows();


    /*
     * Show database verification.
     */
    const earningsCount =
        db.prepare(`
            SELECT COUNT(*) AS count
            FROM creator_earnings
        `).get();


    const payoutsCount =
        db.prepare(`
            SELECT COUNT(*) AS count
            FROM creator_payouts
        `).get();


    const historyCount =
        db.prepare(`
            SELECT COUNT(*) AS count
            FROM creator_earnings_history
        `).get();


    console.log(
        "✅ creator_earnings table ready."
    );

    console.log(
        "✅ creator_payouts table ready."
    );

    console.log(
        "✅ creator_earnings_history table ready."
    );

    console.log("");

    console.log(
        "👤 Creator earnings rows:",
        earningsCount.count
    );

    console.log(
        "💰 Payout records:",
        payoutsCount.count
    );

    console.log(
        "📜 Earnings history records:",
        historyCount.count
    );

    console.log("");

    console.log(
        "✅ Creator Payout Database Setup Complete!"
    );

}
catch (error) {

    console.error("");

    console.error(
        "❌ CREATOR PAYOUT SETUP ERROR:"
    );

    console.error(
        error.message
    );

    console.error("");

}
finally {

    db.close();

}

