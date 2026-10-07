
const Database = require("better-sqlite3");
const path = require("path");

const DB_PATH = path.join(__dirname, "allinone.db");

const db = new Database(DB_PATH);

console.log("======================================");
console.log("ADDING REASONING VIDEOS");
console.log("======================================");

const videos = [
    {
        title: "Syllogism Explained in Telugu - Reasoning",
        description:
            "Syllogism reasoning concepts and tricks in Telugu for competitive exams.",
        youtube_url:
            "https://www.youtube.com/watch?v=t9k6dpopGsM"
    },
    {
        title: "Syllogism Part-2 - Reasoning in Telugu",
        description:
            "Syllogism Part-2 reasoning practice for competitive exams.",
        youtube_url:
            "https://www.youtube.com/watch?v=oaD617YE3Tk"
    }
];

try {

    // Check table columns
    const columns = db
        .prepare("PRAGMA table_info(videos)")
        .all();

    const columnNames = columns.map(function (column) {
        return column.name;
    });

    console.log("Videos table columns:");
    console.log(columnNames);

    // Find a user to use as uploader
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

        // Prevent duplicate YouTube videos
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
                video.title
            );

            continue;
        }

        const values = {};

        function setIfExists(column, value) {

            if (columnNames.includes(column)) {
                values[column] = value;
            }

        }

        setIfExists(
            "title",
            video.title
        );

        setIfExists(
            "description",
            video.description
        );

        setIfExists(
            "category",
            "Competitive Exams"
        );

        setIfExists(
            "subject",
            "Reasoning"
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
            "class_name",
            null
        );

        setIfExists(
            "status",
            "approved"
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

        const result = db
            .prepare(sql)
            .run(
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
    console.log("REASONING VIDEOS ADDED");
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

