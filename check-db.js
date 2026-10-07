const Database = require("better-sqlite3");
const path = require("path");

const dbPath = path.join(
    __dirname,
    "allinone.db"
);

console.log("");
console.log("======================================");
console.log("ALL-IN-ONE.COM DATABASE CHECK");
console.log("======================================");
console.log("");
console.log("DATABASE:");
console.log(dbPath);
console.log("");

const db = new Database(dbPath);

// Show tables
const tables = db.prepare(`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table'
    ORDER BY name
`).all();

console.log("TABLES:");
console.log(tables);
console.log("");

// Check users
try {

    const users =
        db.prepare(`
            SELECT COUNT(*) AS total
            FROM users
        `).get();

    console.log(
        "USERS:",
        users.total
    );

} catch (error) {

    console.log(
        "USERS ERROR:",
        error.message
    );
}

// Check videos
try {

    const videos =
        db.prepare(`
            SELECT *
            FROM videos
            ORDER BY id DESC
        `).all();

    console.log("");
    console.log(
        "VIDEO RECORDS:",
        videos.length
    );
    console.log("");

    if (videos.length === 0) {

        console.log(
            ">>> DATABASE LO VIDEOS RECORDS LEVU."
        );

    } else {

        videos.forEach(video => {

            console.log("--------------------------------------");

            console.log(
                "ID:",
                video.id
            );

            console.log(
                "TITLE:",
                video.title
            );

            console.log(
                "DESCRIPTION:",
                video.description
            );

            console.log(
                "FILENAME:",
                video.filename
            );

            console.log(
                "CATEGORY:",
                video.category
            );

            console.log(
                "UPLOADED BY:",
                video.uploaded_by
            );

            console.log(
                "VIEWS:",
                video.views
            );

            console.log(
                "LIKES:",
                video.likes
            );

            console.log(
                "THUMBNAIL:",
                video.thumbnail
            );

        });

        console.log("--------------------------------------");
    }

} catch (error) {

    console.log("");
    console.log(
        "VIDEOS TABLE ERROR:",
        error.message
    );
}

console.log("");
console.log("======================================");
console.log("DATABASE CHECK FINISHED");
console.log("======================================");
console.log("");