const Database = require("better-sqlite3");

const db = new Database("./allinone.db");

function getYouTubeId(url) {
    const match = url.match(
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([^&?/]+)/
    );

    return match ? match[1] : null;
}

const videos = [

    // ==========================================
    // INTERMEDIATE / +2 - HEC
    // ==========================================

    {
        title: "Intermediate HEC - Civics",
        description: "Intermediate 1st Year HEC Civics class",
        category: "Educational",
        class_number: null,
        subject: "HEC",
        youtube_url: "https://www.youtube.com/watch?v=5gIHpOBz2ik"
    },

    // ==========================================
    // INTERMEDIATE / +2 - OTHER COURSES
    // ==========================================

    {
        title: "Other Courses After 10th Class",
        description: "Intermediate, Polytechnic, ITI, RGUKT, Para Medical, CA, NDA and other career courses",
        category: "Educational",
        class_number: null,
        subject: "Other Courses",
        youtube_url: "https://www.youtube.com/watch?v=JhY70So2_Aw"
    }

];


// ======================================================
// GET USER
// ======================================================

const user = db.prepare(
    "SELECT id FROM users ORDER BY id LIMIT 1"
).get();

if (!user) {
    console.log("❌ No user found in database.");
    db.close();
    process.exit();
}


// ======================================================
// INSERT VIDEOS
// ======================================================

for (const video of videos) {

    const youtubeId = getYouTubeId(video.youtube_url);

    if (!youtubeId) {
        console.log(`❌ Invalid YouTube URL: ${video.title}`);
        continue;
    }

    const existing = db
        .prepare("SELECT id FROM videos WHERE youtube_url = ?")
        .get(video.youtube_url);

    if (existing) {
        console.log(
            `⚠️ Already exists: ${video.title} | ID: ${existing.id}`
        );
        continue;
    }

    const thumbnail =
        `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`;

    const result = db.prepare(`
        INSERT INTO videos (
            title,
            description,
            category,
            class_number,
            subject,
            filename,
            thumbnail,
            uploaded_by,
            source_type,
            youtube_url,
            created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
        video.title,
        video.description,
        video.category,
        video.class_number,
        video.subject,
        null,
        thumbnail,
        user.id,
        "youtube",
        video.youtube_url
    );

    console.log(
        `✅ Added: ${video.subject} | ID: ${result.lastInsertRowid}`
    );
}


// ======================================================
// INTERMEDIATE STATUS
// ======================================================

console.log("");
console.log("======================================");
console.log("INTERMEDIATE / +2 STATUS");
console.log("======================================");

const intermediate = db.prepare(`
    SELECT id, subject, title
    FROM videos
    WHERE subject IN (
        'MPC',
        'BiPC',
        'CEC',
        'MEC',
        'HEC',
        'Other Courses'
    )
    ORDER BY id
`).all();

for (const video of intermediate) {
    console.log(
        `✅ ${video.subject} | ID: ${video.id} | ${video.title}`
    );
}

console.log("");
console.log(
    `Intermediate videos currently: ${intermediate.length}/6`
);


// ======================================================
// TOTAL YOUTUBE VIDEOS
// ======================================================

const count = db.prepare(`
    SELECT COUNT(*) AS total
    FROM videos
    WHERE source_type = 'youtube'
`).get();

console.log(`Total YouTube videos: ${count.total}`);

console.log("======================================");

db.close();