
const Database = require("better-sqlite3");
const path = require("path");

const DB_PATH = path.join(__dirname, "allinone.db");

const db = new Database(DB_PATH);

console.log("======================================");
console.log("ADDING COMPETITIVE EXAM VIDEOS");
console.log("======================================");

const videos = [
    {
        title: "Indian Economy Complete Marathon - Telugu",
        description:
            "Indian Economy complete competitive exam preparation in Telugu.",
        category: "Competitive Exams",
        subject: "Economy",
        youtube_url:
            "https://www.youtube.com/watch?v=he-CzZCBKf4"
    },

    {
        title: "Indian Polity in Telugu - Competitive Exams",
        description:
            "Indian Polity concepts for UPSC, APPSC, TSPSC and other competitive exams.",
        category: "Competitive Exams",
        subject: "Polity",
        youtube_url:
            "https://www.youtube.com/watch?v=dpGjzcdKtcw"
    },

    {
        title: "Indian History in Telugu - Competitive Exams",
        description:
            "Indian History topics and MCQs for competitive examinations.",
        category: "Competitive Exams",
        subject: "History",
        youtube_url:
            "https://www.youtube.com/watch?v=qMS0cDuDukk"
    },

    {
        title: "GK GS for All Competitive Exams 2026",
        description:
            "General Knowledge and General Studies MCQs in Telugu for competitive exams.",
        category: "Competitive Exams",
        subject: "Other",
        youtube_url:
            "https://www.youtube.com/watch?v=0ANaUr2YUsI"
    }
];

try {

    const columns = db
        .prepare("PRAGMA table_info(videos)")
        .all();

    const columnNames = columns.map(function (column) {
        return column.name;
    });

    console.log("Videos table checked.");

    let uploader = db
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
            video.category
        );

        setIfExists(
            "subject",
            video.subject
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

        setIfExists(
            "views",
            0
        );

        setIfExists(
            "likes",
            0
        );

        setIfExists(
            "filename",
            null
        );

        setIfExists(
            "thumbnail",
            null
        );

        setIfExists(
            "class_number",
            null
        );

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
            video.subject,
            "|",
            video.title,
            "| ID:",
            result.lastInsertRowid
        );
    }

    console.log("");
    console.log("======================================");
    console.log("COMPETITIVE VIDEOS ADDED");
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

