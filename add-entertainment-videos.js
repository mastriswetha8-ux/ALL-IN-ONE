
const Database = require("better-sqlite3");
const path = require("path");

const DB_PATH = path.join(__dirname, "allinone.db");

const db = new Database(DB_PATH);

console.log("======================================");
console.log("ADDING ENTERTAINMENT VIDEOS");
console.log("======================================");

const videos = [
    {
        title: "Prema Katha Chitram Scenes - Telugu Comedy",
        description:
            "Telugu comedy entertainment video.",
        youtube_url:
            "https://www.youtube.com/watch?v=ntTTzUzWNk4"
    },

    {
        title: "Back to Back Comedy Scenes - Telugu",
        description:
            "Telugu comedy entertainment scenes.",
        youtube_url:
            "https://www.youtube.com/watch?v=CEtEsF_hokU"
    },

    {
        title: "Telugu Funny Videos Compilation",
        description:
            "Telugu funny and comedy entertainment compilation.",
        youtube_url:
            "https://www.youtube.com/watch?v=40pDro4PUQE"
    },

    {
        title: "Ento E Prema - Telugu Short Film",
        description:
            "Telugu romantic comedy short film entertainer.",
        youtube_url:
            "https://www.youtube.com/watch?v=3xDdJ77AsT4"
    }
];

try {

    const columns = db
        .prepare("PRAGMA table_info(videos)")
        .all();

    const columnNames = columns.map(function (column) {
        return column.name;
    });

    const uploader = db
        .prepare(`
            SELECT id
            FROM users
            ORDER BY id DESC
            LIMIT 1
        `)
        .get();

    if (!uploader) {
        throw new Error(
            "No user found in users table."
        );
    }

    console.log(
        "Uploader user ID:",
        uploader.id
    );

    for (const video of videos) {

        const existing = db
            .prepare(`
                SELECT id
                FROM videos
                WHERE youtube_url = ?
                LIMIT 1
            `)
            .get(video.youtube_url);

        if (existing) {

            console.log(
                "Already exists:",
                video.title,
                "| ID:",
                existing.id
            );

            continue;
        }

        const values = {};

        function setIfExists(column, value) {

            if (columnNames.includes(column)) {
                values[column] = value;
            }
        }

        setIfExists("title", video.title);

        setIfExists(
            "description",
            video.description
        );

        setIfExists(
            "category",
            "Entertainment"
        );

        setIfExists(
            "subject",
            "Entertainment"
        );

        setIfExists(
            "youtube_url",
            video.youtube_url
        );

        setIfExists(
            "source_type",
            "youtube"
        );

        setIfExists(
            "uploaded_by",
            uploader.id
        );

        setIfExists("views", 0);

        setIfExists("likes", 0);

        setIfExists("filename", null);

        setIfExists("thumbnail", null);

        setIfExists("class_number", null);

        const columnList =
            Object.keys(values);

        const placeholders =
            columnList.map(function () {
                return "?";
            });

        const sql = `
            INSERT INTO videos
            (${columnList.join(", ")})
            VALUES
            (${placeholders.join(", ")})
        `;

        const result =
            db.prepare(sql).run(
                columnList.map(function (column) {
                    return values[column];
                })
            );

        console.log(
            "Added:",
            video.title,
            "| ID:",
            result.lastInsertRowid
        );
    }

    console.log("");
    console.log("======================================");
    console.log("ENTERTAINMENT VIDEOS ADDED");
    console.log("======================================");

} catch (error) {

    console.error("");
    console.error(
        "ERROR:",
        error.message
    );

} finally {

    db.close();

}

