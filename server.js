const express = require("express");
const session = require("express-session");
const SqliteStore = require("better-sqlite3-session-store")(session);
const helmet = require("helmet");
const multer = require("multer");
const bcrypt = require("bcryptjs");
const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const Razorpay = require("razorpay");

const app = express();

const PORT = 3000;
const ROOT = __dirname;


/* =========================================================
   ENVIRONMENT CONFIGURATION
========================================================= */



/* =========================================================
   SESSION SECURITY CONFIGURATION
========================================================= */

const SESSION_SECRET =
    process.env.SESSION_SECRET;

if (!SESSION_SECRET) {
    console.error("================================================");
    console.error("ERROR: SESSION_SECRET is missing.");
    console.error("Please create a .env file in:");
    console.error(ROOT);
    console.error("and add:");
    console.error("SESSION_SECRET=your-long-random-secret");
    console.error("================================================");
    process.exit(1);
}

const IS_PRODUCTION =
    String(
        process.env.NODE_ENV || "development"
    ).toLowerCase() === "production";


const VIDEO_FOLDER =
    "C:\\ALL-IN-ONE-VIDEOS";

const THUMBNAIL_FOLDER =
    path.join(ROOT, "thumbnails");

const DB_FILE =
    path.join(ROOT, "allinone.db");

const CREATOR_VIEW_RATE =
    0.01;


/* =========================================================
   RAZORPAY CONFIGURATION
========================================================= */

const RAZORPAY_KEY_ID =
    process.env.RAZORPAY_KEY_ID;

const RAZORPAY_KEY_SECRET =
    process.env.RAZORPAY_KEY_SECRET;

if (
    !RAZORPAY_KEY_ID ||
    !RAZORPAY_KEY_SECRET
) {
    console.error("================================================");
    console.error("ERROR: Razorpay API keys are missing.");
    console.error("Please check the .env file.");
    console.error("Required:");
    console.error("RAZORPAY_KEY_ID=...");
    console.error("RAZORPAY_KEY_SECRET=...");
    console.error("================================================");
    process.exit(1);
}

const razorpay =
    new Razorpay({
        key_id:
            RAZORPAY_KEY_ID,

        key_secret:
            RAZORPAY_KEY_SECRET
    });

console.log(
    "RAZORPAY: TEST MODE KEY LOADED"
);


/* =========================================================
   SECURITY HEADERS - HELMET
========================================================= */

app.use(
    helmet({
        strictTransportSecurity:
            IS_PRODUCTION
                ? undefined
                : false,

        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],

                scriptSrc: [
                    "'self'",
                    "'unsafe-inline'",
                    "https://checkout.razorpay.com"
                ],

                styleSrc: [
                    "'self'",
                    "'unsafe-inline'"
                ],

                imgSrc: [
                    "'self'",
                    "data:",
                    "https:"
                ],

                mediaSrc: [
                    "'self'",
                    "https:"
                ],

                frameSrc: [
                    "'self'",
                    "https://www.youtube.com",
                    "https://www.youtube-nocookie.com",
                    "https://api.razorpay.com",
                    "https://checkout.razorpay.com"
                ],

                connectSrc: [
                    "'self'",
                    "https:"
                ],

                fontSrc: [
                    "'self'",
                    "data:",
                    "https:"
                ],

                objectSrc: [
                    "'none'"
                ],

                baseUri: [
                    "'self'"
                ],

                formAction: [
                    "'self'",
                    "https://api.razorpay.com",
                    "https://checkout.razorpay.com"
                ],

                frameAncestors: [
                    "'self'"
                ]
            }
        }
    })
);

app.disable("x-powered-by");


/* =========================================================
   FOLDERS
========================================================= */

if (!fs.existsSync(VIDEO_FOLDER)) {
    fs.mkdirSync(
        VIDEO_FOLDER,
        {
            recursive: true
        }
    );
}

if (!fs.existsSync(THUMBNAIL_FOLDER)) {
    fs.mkdirSync(
        THUMBNAIL_FOLDER,
        {
            recursive: true
        }
    );
}


/* =========================================================
   DATABASE
========================================================= */

const db =
    new Database(DB_FILE);

db.pragma(
    "journal_mode = WAL"
);

db.pragma(
    "foreign_keys = ON"
);


/* =========================================================
   DATABASE TABLES
========================================================= */

db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS videos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        category TEXT,
        class_number INTEGER,
        subject TEXT,
        filename TEXT,
        thumbnail TEXT,
        uploaded_by INTEGER,
        views INTEGER DEFAULT 0,
        likes INTEGER DEFAULT 0,
        source_type TEXT DEFAULT 'upload',
        youtube_url TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        video_id INTEGER,
        user_id INTEGER,
        comment TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS likes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        video_id INTEGER,
        user_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(video_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS purchases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        course_id TEXT,
        course_name TEXT,
        amount REAL,
        status TEXT DEFAULT 'paid',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS course_videos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        course_id TEXT,
        title TEXT,
        description TEXT,
        youtube_url TEXT,
        category TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS homepage_comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        user_name TEXT,
        comment TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS creator_earnings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        total_earnings REAL NOT NULL DEFAULT 0,
        available_balance REAL NOT NULL DEFAULT 0,
        pending_payout REAL NOT NULL DEFAULT 0,
        paid_amount REAL NOT NULL DEFAULT 0,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS creator_payouts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        approved_at DATETIME,
        paid_at DATETIME,
        admin_note TEXT
    );

    CREATE TABLE IF NOT EXISTS creator_earnings_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        video_id INTEGER,
        amount REAL NOT NULL,
        earning_type TEXT DEFAULT 'video',
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
`);


/* =========================================================
   SAFE MIGRATIONS
========================================================= */

function columnExists(
    tableName,
    columnName
) {
    const columns =
        db.prepare(
            `PRAGMA table_info(${tableName})`
        ).all();

    return columns.some(
        column =>
            column.name === columnName
    );
}


function addColumnIfMissing(
    tableName,
    columnName,
    definition
) {
    if (
        !columnExists(
            tableName,
            columnName
        )
    ) {
        db.exec(
            `ALTER TABLE ${tableName}
             ADD COLUMN ${columnName} ${definition}`
        );

        console.log(
            `Added column ${tableName}.${columnName}`
        );
    }
}


/* =========================================================
   USER / VIDEO MIGRATIONS
========================================================= */

addColumnIfMissing(
    "users",
    "role",
    "TEXT NOT NULL DEFAULT 'user'"
);

addColumnIfMissing(
    "videos",
    "class_number",
    "INTEGER"
);

addColumnIfMissing(
    "videos",
    "subject",
    "TEXT"
);

addColumnIfMissing(
    "videos",
    "thumbnail",
    "TEXT"
);

addColumnIfMissing(
    "videos",
    "source_type",
    "TEXT DEFAULT 'upload'"
);

addColumnIfMissing(
    "videos",
    "youtube_url",
    "TEXT"
);

addColumnIfMissing(
    "videos",
    "views",
    "INTEGER DEFAULT 0"
);

addColumnIfMissing(
    "videos",
    "likes",
    "INTEGER DEFAULT 0"
);


/* =========================================================
   RAZORPAY PURCHASE MIGRATIONS
========================================================= */

addColumnIfMissing(
    "purchases",
    "razorpay_order_id",
    "TEXT"
);

addColumnIfMissing(
    "purchases",
    "razorpay_payment_id",
    "TEXT"
);

addColumnIfMissing(
    "purchases",
    "razorpay_signature",
    "TEXT"
);


/* =========================================================
   CREATOR EARNINGS ACCOUNT
========================================================= */

function ensureCreatorEarningsRows() {
    const users =
        db.prepare(`
            SELECT id
            FROM users
        `).all();

    const insert =
        db.prepare(`
            INSERT OR IGNORE INTO creator_earnings
            (
                user_id,
                total_earnings,
                available_balance,
                pending_payout,
                paid_amount
            )
            VALUES (?, 0, 0, 0, 0)
        `);

    const transaction =
        db.transaction(() => {
            for (const user of users) {
                insert.run(user.id);
            }
        });

    transaction();
}


ensureCreatorEarningsRows();


/* =========================================================
   SYNC EXISTING VIDEO VIEWS
========================================================= */

function syncExistingViewEarnings() {
    ensureCreatorEarningsRows();

    const videos =
        db.prepare(`
            SELECT
                id,
                uploaded_by,
                views
            FROM videos
            WHERE uploaded_by IS NOT NULL
              AND views > 0
        `).all();

    const checkHistory =
        db.prepare(`
            SELECT id
            FROM creator_earnings_history
            WHERE video_id = ?
              AND earning_type = 'initial_view_sync'
            LIMIT 1
        `);

    const insertHistory =
        db.prepare(`
            INSERT INTO creator_earnings_history
            (
                user_id,
                video_id,
                amount,
                earning_type,
                description
            )
            VALUES (?, ?, ?, ?, ?)
        `);

    const updateEarnings =
        db.prepare(`
            UPDATE creator_earnings
            SET
                total_earnings =
                    total_earnings + ?,

                available_balance =
                    available_balance + ?,

                updated_at =
                    CURRENT_TIMESTAMP

            WHERE user_id = ?
        `);

    const transaction =
        db.transaction(() => {
            for (const video of videos) {
                const alreadySynced =
                    checkHistory.get(video.id);

                if (alreadySynced) {
                    continue;
                }

                const views =
                    Number(video.views || 0);

                if (views <= 0) {
                    continue;
                }

                const amount =
                    Number(
                        (
                            views *
                            CREATOR_VIEW_RATE
                        ).toFixed(2)
                    );

                if (amount <= 0) {
                    continue;
                }

                insertHistory.run(
                    video.uploaded_by,
                    video.id,
                    amount,
                    "initial_view_sync",
                    `${views} existing video view(s) synchronized`
                );

                updateEarnings.run(
                    amount,
                    amount,
                    video.uploaded_by
                );
            }
        });

    transaction();
}


syncExistingViewEarnings();


/* =========================================================
   EXPRESS MIDDLEWARE
========================================================= */

app.use(
    express.json({
        limit: "10mb"
    })
);

app.use(
    express.urlencoded({
        extended: true,
        limit: "10mb"
    })
);


/* =========================================================
   SQLITE PERSISTENT SESSION STORE
========================================================= */

const sessionStore =
    new SqliteStore({
        client: db,
        expired: {
            clear: true,
            intervalMs:
                15 * 60 * 1000
        }
    });


/* =========================================================
   SECURE SESSION
========================================================= */

if (IS_PRODUCTION) {
    app.set(
        "trust proxy",
        1
    );
}


app.use(
    session({
        store:
            sessionStore,

        secret:
            SESSION_SECRET,

        resave:
            false,

        saveUninitialized:
            false,

        name:
            "aio_session",

        cookie: {
            maxAge:
                1000 *
                60 *
                60 *
                24 *
                7,

            httpOnly:
                true,

            sameSite:
                "lax",

            secure:
                IS_PRODUCTION
        }
    })
);


/* =========================================================
   AUTH MIDDLEWARE
========================================================= */

function requireLogin(
    req,
    res,
    next
) {
    if (!req.session.user) {
        return res.status(401).json({
            success: false,
            message:
                "Please login before continuing."
        });
    }

    next();
}


/* =========================================================
   ADMIN SECURITY MIDDLEWARE
========================================================= */

function requireAdmin(
    req,
    res,
    next
) {
    if (!req.session.user) {
        return res.status(401).json({
            success: false,
            message:
                "Please login before accessing admin features."
        });
    }

    try {
        const user =
            db.prepare(`
                SELECT
                    id,
                    name,
                    email,
                    role
                FROM users
                WHERE id = ?
            `).get(
                req.session.user.id
            );

        if (!user) {
            return res.status(401).json({
                success: false,
                message:
                    "User account not found."
            });
        }

        if (
            String(
                user.role || ""
            ).toLowerCase() !== "admin"
        ) {
            return res.status(403).json({
                success: false,
                message:
                    "Admin access required."
            });
        }

        req.adminUser =
            user;

        next();

    } catch (error) {
        console.error(
            "ADMIN AUTH ERROR:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to verify admin access."
        });
    }
}


/* =========================================================
   ADMIN HTML PAGE SECURITY
========================================================= */

app.get(
    "/admin.html",
    requireAdmin,
    (req, res) => {
        res.sendFile(
            path.join(
                ROOT,
                "admin.html"
            )
        );
    }
);


/* =========================================================
   STATIC FILES
========================================================= */

app.use(
    express.static(ROOT)
);

app.use(
    "/videos",
    express.static(
        VIDEO_FOLDER
    )
);

app.use(
    "/thumbnails",
    express.static(
        THUMBNAIL_FOLDER
    )
);


/* =========================================================
   MULTER
========================================================= */

const storage =
    multer.diskStorage({
        destination:
            function (
                req,
                file,
                cb
            ) {
                if (
                    file.fieldname ===
                    "thumbnail"
                ) {
                    cb(
                        null,
                        THUMBNAIL_FOLDER
                    );
                } else {
                    cb(
                        null,
                        VIDEO_FOLDER
                    );
                }
            },

        filename:
            function (
                req,
                file,
                cb
            ) {
                const extension =
                    path.extname(
                        file.originalname
                    );

                const base =
                    path.basename(
                        file.originalname,
                        extension
                    ).replace(
                        /[^a-zA-Z0-9_-]/g,
                        "_"
                    );

                const filename =
                    Date.now() +
                    "_" +
                    base +
                    extension;

                cb(
                    null,
                    filename
                );
            }
    });


const upload =
    multer({
        storage:
            storage,

        limits: {
            fileSize:
                1024 *
                1024 *
                500
        }
    });


/* =========================================================
   PROTECT ALL ADMIN API ROUTES
========================================================= */

app.use(
    "/api/admin",
    requireAdmin
);


/* =========================================================
   COURSES
========================================================= */

const COURSES = {
    upsc: {
        id:
            "upsc",

        name:
            "UPSC Complete Course",

        amount:
            999
    },

    competitive: {
        id:
            "competitive",

        name:
            "Competitive Exams",

        amount:
            799
    },

    degree: {
        id:
            "degree",

        name:
            "Degree Classes",

        amount:
            599
    }
};


/* =========================================================
   YOUTUBE ID
========================================================= */

function getYouTubeId(
    url
) {
    if (!url) {
        return null;
    }

    try {
        const parsed =
            new URL(url);

        if (
            parsed.hostname.includes(
                "youtu.be"
            )
        ) {
            return parsed.pathname
                .replace("/", "");
        }

        if (
            parsed.hostname.includes(
                "youtube.com"
            )
        ) {
            const watchId =
                parsed.searchParams.get(
                    "v"
                );

            if (watchId) {
                return watchId;
            }

            const parts =
                parsed.pathname.split("/");

            const embedIndex =
                parts.indexOf("embed");

            if (
                embedIndex !== -1 &&
                parts[
                    embedIndex + 1
                ]
            ) {
                return parts[
                    embedIndex + 1
                ];
            }

            const shortsIndex =
                parts.indexOf("shorts");

            if (
                shortsIndex !== -1 &&
                parts[
                    shortsIndex + 1
                ]
            ) {
                return parts[
                    shortsIndex + 1
                ];
            }
        }

    } catch (error) {
        console.log(
            "YouTube URL error:",
            error.message
        );
    }

    return null;
}


/* =========================================================
   COURSE VIDEO SEED DATA
========================================================= */

function seedCourseVideos() {
    const count =
        db.prepare(`
            SELECT COUNT(*) AS count
            FROM course_videos
        `).get().count;

    if (count > 0) {
        return;
    }

    const insert =
        db.prepare(`
            INSERT INTO course_videos
            (
                course_id,
                title,
                description,
                youtube_url,
                category
            )
            VALUES (?, ?, ?, ?, ?)
        `);

    const seed =
        db.transaction(() => {
            insert.run(
                "upsc",
                "UPSC Complete Course",
                "UPSC preparation video",
                "https://www.youtube.com/watch?v=ytNGRwwjeLQ",
                "UPSC"
            );

            insert.run(
                "competitive",
                "Competitive Exams Complete Course",
                "Competitive examination preparation",
                "https://www.youtube.com/watch?v=T8bsmtcEDyU",
                "Competitive Exams"
            );

            insert.run(
                "degree",
                "Degree Classes",
                "Degree education video",
                "https://www.youtube.com/watch?v=XRcndqG8U2A",
                "Degree"
            );
        });

    seed();
}


seedCourseVideos();


/* =========================================================
   HOME
========================================================= */

app.get(
    "/",
    (req, res) => {
        res.sendFile(
            path.join(
                ROOT,
                "index.html"
            )
        );
    }
);


/* =========================================================
   SIGNUP
========================================================= */

app.post(
    "/api/signup",
    async (req, res) => {
        try {
            const name =
                String(
                    req.body.name || ""
                ).trim();

            const email =
                String(
                    req.body.email || ""
                )
                .trim()
                .toLowerCase();

            const password =
                String(
                    req.body.password || ""
                );

            if (
                !name ||
                !email ||
                !password
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Name, email and password are required."
                });
            }

            const existing =
                db.prepare(`
                    SELECT id
                    FROM users
                    WHERE email = ?
                `).get(email);

            if (existing) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Email already registered."
                });
            }

            const hashed =
                await bcrypt.hash(
                    password,
                    10
                );

            const result =
                db.prepare(`
                    INSERT INTO users
                    (
                        name,
                        email,
                        password
                    )
                    VALUES (?, ?, ?)
                `).run(
                    name,
                    email,
                    hashed
                );

            db.prepare(`
                INSERT OR IGNORE INTO creator_earnings
                (
                    user_id
                )
                VALUES (?)
            `).run(
                result.lastInsertRowid
            );

            res.json({
                success: true,
                message:
                    "Account created successfully.",
                userId:
                    result.lastInsertRowid
            });

        } catch (error) {
            console.error(
                "SIGNUP ERROR:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Unable to create account."
            });
        }
    }
);


/* =========================================================
   LOGIN
========================================================= */

app.post(
    "/api/login",
    async (req, res) => {
        try {
            const email =
                String(
                    req.body.email || ""
                )
                .trim()
                .toLowerCase();

            const password =
                String(
                    req.body.password || ""
                );

            const user =
                db.prepare(`
                    SELECT *
                    FROM users
                    WHERE email = ?
                `).get(email);

            if (!user) {
                return res.status(401).json({
                    success: false,
                    message:
                        "Invalid email or password."
                });
            }

            const valid =
                await bcrypt.compare(
                    password,
                    user.password
                );

            if (!valid) {
                return res.status(401).json({
                    success: false,
                    message:
                        "Invalid email or password."
                });
            }

            req.session.regenerate(
                (sessionError) => {
                    if (sessionError) {
                        console.error(
                            "SESSION REGENERATE ERROR:",
                            sessionError
                        );

                        return res.status(500).json({
                            success: false,
                            message:
                                "Unable to create secure login session."
                        });
                    }

                    req.session.user = {
                        id:
                            user.id,

                        name:
                            user.name,

                        email:
                            user.email,

                        role:
                            user.role ||
                            "user"
                    };

                    db.prepare(`
                        INSERT OR IGNORE INTO creator_earnings
                        (
                            user_id
                        )
                        VALUES (?)
                    `).run(
                        user.id
                    );

                    req.session.save(
                        (saveError) => {
                            if (saveError) {
                                console.error(
                                    "SESSION SAVE ERROR:",
                                    saveError
                                );

                                return res.status(500).json({
                                    success: false,
                                    message:
                                        "Unable to save secure login session."
                                });
                            }

                            res.json({
                                success: true,
                                message:
                                    "Login successful.",
                                user:
                                    req.session.user
                            });
                        }
                    );
                }
            );

        } catch (error) {
            console.error(
                "LOGIN ERROR:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Unable to login."
            });
        }
    }
);


/* =========================================================
   LOGOUT
========================================================= */

app.post(
    "/api/logout",
    (req, res) => {
        req.session.destroy(
            (error) => {
                if (error) {
                    console.error(
                        "LOGOUT ERROR:",
                        error
                    );

                    return res.status(500).json({
                        success: false,
                        message:
                            "Unable to logout."
                    });
                }

                res.clearCookie(
                    "aio_session"
                );

                res.json({
                    success: true,
                    message:
                        "Logged out successfully."
                });
            }
        );
    }
);


/* =========================================================
   CURRENT USER
========================================================= */

app.get(
    "/api/me",
    (req, res) => {
        if (!req.session.user) {
            return res.json({
                success: true,
                loggedIn: false,
                user: null
            });
        }

        const user =
            db.prepare(`
                SELECT
                    id,
                    name,
                    email,
                    role
                FROM users
                WHERE id = ?
            `).get(
                req.session.user.id
            );

        if (!user) {
            return res.json({
                success: true,
                loggedIn: false,
                user: null
            });
        }

        req.session.user = {
            id:
                user.id,

            name:
                user.name,

            email:
                user.email,

            role:
                user.role ||
                "user"
        };

        res.json({
            success: true,
            loggedIn: true,
            user:
                req.session.user
        });
    }
);


/* =========================================================
   VIDEO UPLOAD
========================================================= */

app.post(
    "/api/upload",
    requireLogin,

    upload.fields([
        {
            name:
                "video",
            maxCount:
                1
        },
        {
            name:
                "thumbnail",
            maxCount:
                1
        }
    ]),

    (req, res) => {
        try {
            const title =
                String(
                    req.body.title || ""
                ).trim();

            const category =
                String(
                    req.body.category || ""
                ).trim();

            const description =
                String(
                    req.body.description || ""
                ).trim();

            const youtubeUrl =
                String(
                    req.body.youtube_url ||
                    req.body.youtubeUrl ||
                    ""
                ).trim();

            const classNumber =
                req.body.class_number
                    ? Number(
                        req.body.class_number
                    )
                    : null;

            const subject =
                req.body.subject ||
                null;

            if (!title) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Video title is required."
                });
            }

            if (!category) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Video category is required."
                });
            }

            const isYouTube =
                Boolean(youtubeUrl);

            const files =
                req.files || {};

            const videoFile =
                files.video &&
                files.video[0]
                    ? files.video[0]
                    : null;

            const thumbnailFile =
                files.thumbnail &&
                files.thumbnail[0]
                    ? files.thumbnail[0]
                    : null;

            if (
                !isYouTube &&
                !videoFile
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Please upload a video file or enter a YouTube URL."
                });
            }

            if (
                category.toLowerCase() ===
                "educational"
            ) {
                if (
                    classNumber !== null &&
                    (
                        classNumber < 1 ||
                        classNumber > 10
                    )
                ) {
                    return res.status(400).json({
                        success: false,
                        message:
                            "Class number must be between 1 and 10."
                    });
                }
            }

            const sourceType =
                isYouTube
                    ? "youtube"
                    : "upload";

            const filename =
                videoFile
                    ? videoFile.filename
                    : null;

            const thumbnail =
                thumbnailFile
                    ? thumbnailFile.filename
                    : null;

            const result =
                db.prepare(`
                    INSERT INTO videos
                    (
                        title,
                        description,
                        category,
                        class_number,
                        subject,
                        filename,
                        thumbnail,
                        uploaded_by,
                        views,
                        likes,
                        source_type,
                        youtube_url
                    )
                    VALUES
                    (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)
                `).run(
                    title,
                    description,
                    category,
                    classNumber,
                    subject,
                    filename,
                    thumbnail,
                    req.session.user.id,
                    sourceType,
                    isYouTube
                        ? youtubeUrl
                        : null
                );

            db.prepare(`
                INSERT OR IGNORE INTO creator_earnings
                (
                    user_id
                )
                VALUES (?)
            `).run(
                req.session.user.id
            );

            res.json({
                success: true,
                message:
                    "Video uploaded successfully!",
                videoId:
                    result.lastInsertRowid
            });

        } catch (error) {
            console.error(
                "UPLOAD ERROR:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Unable to upload video."
            });
        }
    }
);


/* =========================================================
   ALL VIDEOS
========================================================= */

app.get(
    "/api/videos",
    (req, res) => {
        try {
            const search =
                String(
                    req.query.search || ""
                ).trim();

            let videos;

            if (search) {
                const value =
                    `%${search}%`;

                videos =
                    db.prepare(`
                        SELECT
                            v.*,
                            u.name AS creator
                        FROM videos v
                        LEFT JOIN users u
                            ON u.id = v.uploaded_by
                        WHERE
                            v.title LIKE ?
                            OR v.description LIKE ?
                            OR v.category LIKE ?
                            OR v.subject LIKE ?
                        ORDER BY v.id DESC
                    `).all(
                        value,
                        value,
                        value,
                        value
                    );

            } else {
                videos =
                    db.prepare(`
                        SELECT
                            v.*,
                            u.name AS creator
                        FROM videos v
                        LEFT JOIN users u
                            ON u.id = v.uploaded_by
                        ORDER BY v.id DESC
                    `).all();
            }

            res.json({
                success: true,
                videos
            });

        } catch (error) {
            console.error(
                "VIDEOS ERROR:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Unable to load videos.",
                videos: []
            });
        }
    }
);


/* =========================================================
   MY VIDEOS
========================================================= */

app.get(
    "/api/my-videos",
    requireLogin,
    (req, res) => {
        try {
            const videos =
                db.prepare(`
                    SELECT *
                    FROM videos
                    WHERE uploaded_by = ?
                    ORDER BY id DESC
                `).all(
                    req.session.user.id
                );

            res.json({
                success: true,
                videos
            });

        } catch (error) {
            console.error(
                "MY VIDEOS ERROR:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Unable to load your videos.",
                videos: []
            });
        }
    }
);


/* =========================================================
   SINGLE VIDEO
========================================================= */

app.get(
    "/api/videos/:id",
    (req, res) => {
        try {
            const id =
                Number(
                    req.params.id
                );

            const video =
                db.prepare(`
                    SELECT
                        v.*,
                        u.name AS creator
                    FROM videos v
                    LEFT JOIN users u
                        ON u.id = v.uploaded_by
                    WHERE v.id = ?
                `).get(id);

            if (!video) {
                return res.status(404).json({
                    success: false,
                    message:
                        "Video not found."
                });
            }

            res.json({
                success: true,
                video
            });

        } catch (error) {
            console.error(
                "SINGLE VIDEO ERROR:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Unable to load video."
            });
        }
    }
);


/* =========================================================
   VIEW + CREATOR EARNING
========================================================= */

app.post(
    "/api/videos/:id/view",
    (req, res) => {
        try {
            const videoId =
                Number(
                    req.params.id
                );

            const video =
                db.prepare(`
                    SELECT
                        id,
                        uploaded_by,
                        views
                    FROM videos
                    WHERE id = ?
                `).get(videoId);

            if (!video) {
                return res.status(404).json({
                    success: false,
                    message:
                        "Video not found."
                });
            }

            const transaction =
                db.transaction(() => {
                    db.prepare(`
                        UPDATE videos
                        SET views =
                            COALESCE(views, 0) + 1
                        WHERE id = ?
                    `).run(videoId);

                    if (video.uploaded_by) {
                        db.prepare(`
                            INSERT OR IGNORE INTO creator_earnings
                            (
                                user_id
                            )
                            VALUES (?)
                        `).run(
                            video.uploaded_by
                        );

                        db.prepare(`
                            INSERT INTO creator_earnings_history
                            (
                                user_id,
                                video_id,
                                amount,
                                earning_type,
                                description
                            )
                            VALUES (?, ?, ?, ?, ?)
                        `).run(
                            video.uploaded_by,
                            videoId,
                            CREATOR_VIEW_RATE,
                            "video",
                            "Video view earning"
                        );

                        db.prepare(`
                            UPDATE creator_earnings
                            SET
                                total_earnings =
                                    total_earnings + ?,

                                available_balance =
                                    available_balance + ?,

                                updated_at =
                                    CURRENT_TIMESTAMP

                            WHERE user_id = ?
                        `).run(
                            CREATOR_VIEW_RATE,
                            CREATOR_VIEW_RATE,
                            video.uploaded_by
                        );
                    }
                });

            transaction();

            const updated =
                db.prepare(`
                    SELECT views
                    FROM videos
                    WHERE id = ?
                `).get(videoId);

            res.json({
                success: true,
                views:
                    updated.views,

                earning:
                    video.uploaded_by
                        ? CREATOR_VIEW_RATE
                        : 0
            });

        } catch (error) {
            console.error(
                "VIEW ERROR:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Unable to count video view."
            });
        }
    }
);


/* =========================================================
   COMMENTS
========================================================= */

app.get(
    "/api/videos/:id/comments",
    (req, res) => {
        try {
            const videoId =
                Number(
                    req.params.id
                );

            const comments =
                db.prepare(`
                    SELECT
                        c.id,
                        c.video_id,
                        c.user_id,
                        c.comment,
                        c.created_at,
                        u.name AS user_name
                    FROM comments c
                    LEFT JOIN users u
                        ON u.id = c.user_id
                    WHERE c.video_id = ?
                    ORDER BY c.id ASC
                `).all(videoId);

            res.json({
                success: true,
                comments
            });

        } catch (error) {
            console.error(
                "COMMENTS LOAD ERROR:",
                error
            );

            res.status(500).json({
                success: false,
                comments: []
            });
        }
    }
);


app.post(
    "/api/videos/:id/comments",
    requireLogin,
    (req, res) => {
        try {
            const videoId =
                Number(
                    req.params.id
                );

            const comment =
                String(
                    req.body.comment || ""
                ).trim();

            if (!comment) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Please enter a comment."
                });
            }

            db.prepare(`
                INSERT INTO comments
                (
                    video_id,
                    user_id,
                    comment
                )
                VALUES (?, ?, ?)
            `).run(
                videoId,
                req.session.user.id,
                comment
            );

            res.json({
                success: true,
                message:
                    "Comment posted successfully."
            });

        } catch (error) {
            console.error(
                "COMMENT POST ERROR:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Unable to post comment."
            });
        }
    }
);


/* =========================================================
   LIKE - FIXED TOGGLE LIKE / UNLIKE
========================================================= */

app.post(
    "/api/videos/:id/like",
    requireLogin,
    (req, res) => {

        try {

            const videoId =
                Number(req.params.id);

            const userId =
                Number(req.session.user.id);


            /* -------------------------------------------------
               VALIDATE VIDEO ID
            ------------------------------------------------- */

            if (
                !Number.isInteger(videoId) ||
                videoId <= 0
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Invalid video ID."
                });
            }


            /* -------------------------------------------------
               CHECK VIDEO
            ------------------------------------------------- */

            const video =
                db.prepare(`
                    SELECT
                        id,
                        likes
                    FROM videos
                    WHERE id = ?
                `).get(videoId);


            if (!video) {
                return res.status(404).json({
                    success: false,
                    message:
                        "Video not found."
                });
            }


            /* -------------------------------------------------
               CHECK EXISTING LIKE
            ------------------------------------------------- */

            const existing =
                db.prepare(`
                    SELECT id
                    FROM likes
                    WHERE video_id = ?
                      AND user_id = ?
                    LIMIT 1
                `).get(
                    videoId,
                    userId
                );


            /* =================================================
               ALREADY LIKED → REMOVE LIKE
            ================================================= */

            if (existing) {

                const transaction =
                    db.transaction(() => {

                        db.prepare(`
                            DELETE FROM likes
                            WHERE video_id = ?
                              AND user_id = ?
                        `).run(
                            videoId,
                            userId
                        );


                        db.prepare(`
                            UPDATE videos
                            SET likes =
                                MAX(
                                    0,
                                    COALESCE(likes, 0) - 1
                                )
                            WHERE id = ?
                        `).run(
                            videoId
                        );

                    });


                transaction();


                const updated =
                    db.prepare(`
                        SELECT likes
                        FROM videos
                        WHERE id = ?
                    `).get(videoId);


                console.log(
                    "VIDEO UNLIKED:",
                    videoId,
                    "USER:",
                    userId
                );


                return res.json({
                    success: true,

                    liked: false,

                    likes:
                        updated
                            ? Number(
                                updated.likes || 0
                            )
                            : 0,

                    message:
                        "Like removed."
                });
            }


            /* =================================================
               ADD LIKE
            ================================================= */

            const transaction =
                db.transaction(() => {

                    db.prepare(`
                        INSERT INTO likes
                        (
                            video_id,
                            user_id
                        )
                        VALUES (?, ?)
                    `).run(
                        videoId,
                        userId
                    );


                    db.prepare(`
                        UPDATE videos
                        SET likes =
                            COALESCE(likes, 0) + 1
                        WHERE id = ?
                    `).run(
                        videoId
                    );

                });


            transaction();


            const updated =
                db.prepare(`
                    SELECT likes
                    FROM videos
                    WHERE id = ?
                `).get(videoId);


            console.log(
                "VIDEO LIKED:",
                videoId,
                "USER:",
                userId
            );


            return res.json({
                success: true,

                liked: true,

                likes:
                    updated
                        ? Number(
                            updated.likes || 0
                        )
                        : 0,

                message:
                    "Video liked successfully."
            });


        } catch (error) {

            console.error(
                "LIKE ERROR:",
                error
            );


            return res.status(500).json({
                success: false,
                message:
                    "Unable to like video."
            });

        }
    }
);


/* =========================================================
   RAZORPAY - CREATE ORDER
========================================================= */

app.post(
    "/api/create-order",
    requireLogin,
    async (req, res) => {
        try {
            const courseId =
                String(
                    req.body.course_id ||
                    req.body.courseId ||
                    ""
                ).trim();

            const course =
                COURSES[courseId];

            if (!course) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Invalid course."
                });
            }

            const userId =
                Number(
                    req.session.user.id
                );

            const existing =
                db.prepare(`
                    SELECT id
                    FROM purchases
                    WHERE user_id = ?
                      AND course_id = ?
                      AND status = 'paid'
                    LIMIT 1
                `).get(
                    userId,
                    courseId
                );

            if (existing) {
                return res.json({
                    success: true,
                    alreadyPurchased:
                        true,
                    message:
                        "Course already purchased.",
                    purchaseId:
                        existing.id,
                    course
                });
            }

            const amountInPaise =
                Math.round(
                    Number(course.amount) *
                    100
                );

            const receipt =
                `aio_${userId}_${course.id}_${Date.now()}`;

            const order =
                await razorpay.orders.create({
                    amount:
                        amountInPaise,

                    currency:
                        "INR",

                    receipt:
                        receipt,

                    notes: {
                        user_id:
                            String(userId),

                        course_id:
                            course.id
                    }
                });

            console.log(
                "RAZORPAY ORDER CREATED:",
                order.id
            );

            res.json({
                success: true,

                alreadyPurchased:
                    false,

                key:
                    RAZORPAY_KEY_ID,

                order: {
                    id:
                        order.id,

                    amount:
                        order.amount,

                    currency:
                        order.currency
                },

                course
            });

        } catch (error) {
            console.error(
                "RAZORPAY CREATE ORDER ERROR:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Unable to create payment order."
            });
        }
    }
);


/* =========================================================
   RAZORPAY - VERIFY PAYMENT
========================================================= */

app.post(
    "/api/verify-payment",
    requireLogin,
    async (req, res) => {
        try {
            const orderId =
                String(
                    req.body.razorpay_order_id ||
                    ""
                ).trim();

            const paymentId =
                String(
                    req.body.razorpay_payment_id ||
                    ""
                ).trim();

            const signature =
                String(
                    req.body.razorpay_signature ||
                    ""
                ).trim();

            const courseId =
                String(
                    req.body.course_id ||
                    req.body.courseId ||
                    ""
                ).trim();

            if (
                !orderId ||
                !paymentId ||
                !signature ||
                !courseId
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Payment verification details are incomplete."
                });
            }

            const course =
                COURSES[courseId];

            if (!course) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Invalid course."
                });
            }

            const userId =
                Number(
                    req.session.user.id
                );

            let razorpayOrder;

            try {
                razorpayOrder =
                    await razorpay.orders.fetch(
                        orderId
                    );
            } catch (orderError) {
                console.error(
                    "RAZORPAY ORDER FETCH ERROR:",
                    orderError
                );

                return res.status(400).json({
                    success: false,
                    message:
                        "Unable to verify Razorpay order."
                });
            }

            const expectedAmount =
                Math.round(
                    Number(course.amount) *
                    100
                );

            if (
                !razorpayOrder ||
                razorpayOrder.id !== orderId
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Invalid Razorpay order."
                });
            }

            if (
                Number(
                    razorpayOrder.amount
                ) !== expectedAmount
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Payment amount does not match the course price."
                });
            }

            if (
                String(
                    razorpayOrder.currency
                ).toUpperCase() !== "INR"
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Invalid payment currency."
                });
            }

            if (
                razorpayOrder.notes &&
                razorpayOrder.notes.user_id &&
                String(
                    razorpayOrder.notes.user_id
                ) !== String(userId)
            ) {
                return res.status(403).json({
                    success: false,
                    message:
                        "Payment order does not belong to this account."
                });
            }

            if (
                razorpayOrder.notes &&
                razorpayOrder.notes.course_id &&
                String(
                    razorpayOrder.notes.course_id
                ) !== courseId
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Payment order does not match this course."
                });
            }

            const body =
                orderId +
                "|" +
                paymentId;

            const expectedSignature =
                crypto
                    .createHmac(
                        "sha256",
                        RAZORPAY_KEY_SECRET
                    )
                    .update(body)
                    .digest("hex");

            const expectedBuffer =
                Buffer.from(
                    expectedSignature,
                    "utf8"
                );

            const receivedBuffer =
                Buffer.from(
                    signature,
                    "utf8"
                );

            if (
                expectedBuffer.length !==
                receivedBuffer.length
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Invalid payment signature."
                });
            }

            const signatureValid =
                crypto.timingSafeEqual(
                    expectedBuffer,
                    receivedBuffer
                );

            if (!signatureValid) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Payment signature verification failed."
                });
            }

            const duplicatePayment =
                db.prepare(`
                    SELECT id
                    FROM purchases
                    WHERE razorpay_payment_id = ?
                    LIMIT 1
                `).get(
                    paymentId
                );

            if (duplicatePayment) {
                return res.json({
                    success: true,
                    message:
                        "Payment already verified.",
                    purchaseId:
                        duplicatePayment.id,
                    course
                });
            }

            const existingPaid =
                db.prepare(`
                    SELECT id
                    FROM purchases
                    WHERE user_id = ?
                      AND course_id = ?
                      AND status = 'paid'
                    LIMIT 1
                `).get(
                    userId,
                    courseId
                );

            if (existingPaid) {
                return res.json({
                    success: true,
                    message:
                        "Course already purchased.",
                    purchaseId:
                        existingPaid.id,
                    course
                });
            }

            const result =
                db.prepare(`
                    INSERT INTO purchases
                    (
                        user_id,
                        course_id,
                        course_name,
                        amount,
                        status,
                        razorpay_order_id,
                        razorpay_payment_id,
                        razorpay_signature
                    )
                    VALUES
                    (?, ?, ?, ?, 'paid', ?, ?, ?)
                `).run(
                    userId,
                    course.id,
                    course.name,
                    course.amount,
                    orderId,
                    paymentId,
                    signature
                );

            console.log(
                "RAZORPAY PAYMENT VERIFIED:",
                paymentId
            );

            res.json({
                success: true,
                message:
                    "Payment successful. Course access granted!",
                purchaseId:
                    result.lastInsertRowid,
                course
            });

        } catch (error) {
            console.error(
                "RAZORPAY VERIFY PAYMENT ERROR:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Unable to verify payment."
            });
        }
    }
);


/* =========================================================
   OLD DIRECT PURCHASE API DISABLED
========================================================= */

app.post(
    "/api/purchase",
    requireLogin,
    (req, res) => {
        return res.status(410).json({
            success: false,
            message:
                "Direct course purchase is disabled. Please use Razorpay payment."
        });
    }
);


/* =========================================================
   MY PURCHASES
========================================================= */

app.get(
    "/api/my-purchases",
    requireLogin,
    (req, res) => {
        try {
            const purchases =
                db.prepare(`
                    SELECT *
                    FROM purchases
                    WHERE user_id = ?
                    ORDER BY id DESC
                `).all(
                    req.session.user.id
                );

            res.json({
                success: true,
                purchases
            });

        } catch (error) {
            console.error(
                "MY PURCHASES ERROR:",
                error
            );

            res.status(500).json({
                success: false,
                purchases: []
            });
        }
    }
);


/* =========================================================
   COURSE ACCESS
========================================================= */

app.get(
    "/api/course-access/:courseId",
    requireLogin,
    (req, res) => {
        try {
            const courseId =
                String(
                    req.params.courseId
                );

            const purchase =
                db.prepare(`
                    SELECT *
                    FROM purchases
                    WHERE user_id = ?
                      AND course_id = ?
                      AND status = 'paid'
                    ORDER BY id DESC
                    LIMIT 1
                `).get(
                    req.session.user.id,
                    courseId
                );

            res.json({
                success: true,
                access:
                    Boolean(purchase),
                purchase:
                    purchase || null
            });

        } catch (error) {
            console.error(
                "COURSE ACCESS ERROR:",
                error
            );

            res.status(500).json({
                success: false,
                access: false
            });
        }
    }
);


/* =========================================================
   COURSE VIDEOS
========================================================= */

app.get(
    "/api/course-videos/:courseId",
    requireLogin,
    (req, res) => {
        try {
            const courseId =
                String(
                    req.params.courseId
                );

            const purchase =
                db.prepare(`
                    SELECT id
                    FROM purchases
                    WHERE user_id = ?
                      AND course_id = ?
                      AND status = 'paid'
                    LIMIT 1
                `).get(
                    req.session.user.id,
                    courseId
                );

            if (!purchase) {
                return res.status(403).json({
                    success: false,
                    message:
                        "Course access required.",
                    videos: []
                });
            }

            const videos =
                db.prepare(`
                    SELECT *
                    FROM course_videos
                    WHERE course_id = ?
                    ORDER BY id ASC
                `).all(courseId);

            res.json({
                success: true,
                videos
            });

        } catch (error) {
            console.error(
                "COURSE VIDEOS ERROR:",
                error
            );

            res.status(500).json({
                success: false,
                videos: []
            });
        }
    }
);


/* =========================================================
   HOMEPAGE COMMENTS
========================================================= */

app.get(
    "/api/home-comments",
    (req, res) => {
        try {
            const comments =
                db.prepare(`
                    SELECT *
                    FROM homepage_comments
                    ORDER BY id DESC
                `).all();

            res.json({
                success: true,
                comments
            });

        } catch (error) {
            console.error(
                "HOME COMMENTS ERROR:",
                error
            );

            res.status(500).json({
                success: false,
                comments: []
            });
        }
    }
);


app.post(
    "/api/home-comments",
    (req, res) => {
        try {
            const comment =
                String(
                    req.body.comment || ""
                ).trim();

            if (!comment) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Please enter a comment."
                });
            }

            const user =
                req.session.user ||
                null;

            db.prepare(`
                INSERT INTO homepage_comments
                (
                    user_id,
                    user_name,
                    comment
                )
                VALUES (?, ?, ?)
            `).run(
                user
                    ? user.id
                    : null,

                user
                    ? user.name
                    : "Guest",

                comment
            );

            res.json({
                success: true,
                message:
                    "Comment added successfully."
            });

        } catch (error) {
            console.error(
                "HOME COMMENT POST ERROR:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Unable to add comment."
            });
        }
    }
);


/* =========================================================
   ACCOUNT
========================================================= */

app.get(
    "/api/account",
    requireLogin,
    (req, res) => {
        try {
            const user =
                db.prepare(`
                    SELECT
                        id,
                        name,
                        email,
                        created_at
                    FROM users
                    WHERE id = ?
                `).get(
                    req.session.user.id
                );

            const videos =
                db.prepare(`
                    SELECT COUNT(*) AS count
                    FROM videos
                    WHERE uploaded_by = ?
                `).get(
                    req.session.user.id
                );

            const views =
                db.prepare(`
                    SELECT
                        COALESCE(
                            SUM(views),
                            0
                        ) AS count
                    FROM videos
                    WHERE uploaded_by = ?
                `).get(
                    req.session.user.id
                );

            const likes =
                db.prepare(`
                    SELECT
                        COALESCE(
                            SUM(likes),
                            0
                        ) AS count
                    FROM videos
                    WHERE uploaded_by = ?
                `).get(
                    req.session.user.id
                );

            const comments =
                db.prepare(`
                    SELECT
                        COUNT(*) AS count
                    FROM comments c
                    INNER JOIN videos v
                        ON v.id = c.video_id
                    WHERE v.uploaded_by = ?
                `).get(
                    req.session.user.id
                );

            res.json({
                success: true,
                user,

                stats: {
                    videos:
                        videos.count || 0,

                    views:
                        views.count || 0,

                    likes:
                        likes.count || 0,

                    comments:
                        comments.count || 0
                }
            });

        } catch (error) {
            console.error(
                "ACCOUNT ERROR:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Unable to load account."
            });
        }
    }
);


/* =========================================================
   CREATOR EARNINGS
========================================================= */

app.get(
    "/api/creator/earnings",
    requireLogin,
    (req, res) => {
        try {
            const userId =
                Number(
                    req.session.user.id
                );

            ensureCreatorEarningsRows();

            let earnings =
                db.prepare(`
                    SELECT *
                    FROM creator_earnings
                    WHERE user_id = ?
                    LIMIT 1
                `).get(userId);

            const videoStats =
                db.prepare(`
                    SELECT
                        COUNT(*) AS video_count,

                        COALESCE(
                            SUM(views),
                            0
                        ) AS total_views,

                        COALESCE(
                            SUM(likes),
                            0
                        ) AS total_likes

                    FROM videos
                    WHERE uploaded_by = ?
                `).get(userId);

            if (!earnings) {
                db.prepare(`
                    INSERT OR IGNORE INTO creator_earnings
                    (
                        user_id,
                        total_earnings,
                        available_balance,
                        pending_payout,
                        paid_amount
                    )
                    VALUES (?, 0, 0, 0, 0)
                `).run(userId);

                earnings =
                    db.prepare(`
                        SELECT *
                        FROM creator_earnings
                        WHERE user_id = ?
                        LIMIT 1
                    `).get(userId);
            }

            const history =
                db.prepare(`
                    SELECT
                        h.*,
                        v.title AS video_title
                    FROM creator_earnings_history h
                    LEFT JOIN videos v
                        ON v.id = h.video_id
                    WHERE h.user_id = ?
                    ORDER BY h.id DESC
                `).all(userId);

            res.json({
                success: true,

                earnings: {
                    user_id:
                        userId,

                    video_count:
                        Number(
                            videoStats.video_count || 0
                        ),

                    total_views:
                        Number(
                            videoStats.total_views || 0
                        ),

                    total_likes:
                        Number(
                            videoStats.total_likes || 0
                        ),

                    total_earnings:
                        Number(
                            Number(
                                earnings.total_earnings || 0
                            ).toFixed(2)
                        ),

                    available_balance:
                        Number(
                            Number(
                                earnings.available_balance || 0
                            ).toFixed(2)
                        ),

                    pending_payout:
                        Number(
                            Number(
                                earnings.pending_payout || 0
                            ).toFixed(2)
                        ),

                    paid_amount:
                        Number(
                            Number(
                                earnings.paid_amount || 0
                            ).toFixed(2)
                        ),

                    updated_at:
                        earnings.updated_at ||
                        null
                },

                history
            });

        } catch (error) {
            console.error(
                "CREATOR EARNINGS ERROR:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Unable to load creator earnings.",
                history: []
            });
        }
    }
);


/* =========================================================
   CREATOR PAYOUT HISTORY
========================================================= */

app.get(
    "/api/creator/payouts",
    requireLogin,
    (req, res) => {
        try {
            const payouts =
                db.prepare(`
                    SELECT *
                    FROM creator_payouts
                    WHERE user_id = ?
                    ORDER BY id DESC
                `).all(
                    req.session.user.id
                );

            res.json({
                success: true,
                payouts
            });

        } catch (error) {
            console.error(
                "CREATOR PAYOUT HISTORY ERROR:",
                error
            );

            res.status(500).json({
                success: false,
                payouts: []
            });
        }
    }
);


/* =========================================================
   CREATOR REQUEST PAYOUT
========================================================= */

app.post(
    "/api/creator/payouts",
    requireLogin,
    (req, res) => {
        try {
            const amount =
                Number(
                    req.body.amount
                );

            if (
                !Number.isFinite(amount) ||
                amount <= 0
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Enter a valid payout amount."
                });
            }

            const roundedAmount =
                Number(
                    amount.toFixed(2)
                );

            ensureCreatorEarningsRows();

            const transaction =
                db.transaction(() => {
                    const earnings =
                        db.prepare(`
                            SELECT *
                            FROM creator_earnings
                            WHERE user_id = ?
                        `).get(
                            req.session.user.id
                        );

                    if (!earnings) {
                        throw new Error(
                            "Creator earnings account not found."
                        );
                    }

                    if (
                        roundedAmount >
                        Number(
                            earnings.available_balance
                        )
                    ) {
                        throw new Error(
                            "Requested amount is greater than your available balance."
                        );
                    }

                    const existingPending =
                        db.prepare(`
                            SELECT id
                            FROM creator_payouts
                            WHERE user_id = ?
                              AND status IN ('pending', 'approved')
                            LIMIT 1
                        `).get(
                            req.session.user.id
                        );

                    if (existingPending) {
                        throw new Error(
                            "You already have a pending payout request."
                        );
                    }

                    const payout =
                        db.prepare(`
                            INSERT INTO creator_payouts
                            (
                                user_id,
                                amount,
                                status
                            )
                            VALUES (?, ?, 'pending')
                        `).run(
                            req.session.user.id,
                            roundedAmount
                        );

                    db.prepare(`
                        UPDATE creator_earnings
                        SET
                            available_balance =
                                available_balance - ?,

                            pending_payout =
                                pending_payout + ?,

                            updated_at =
                                CURRENT_TIMESTAMP

                        WHERE user_id = ?
                    `).run(
                        roundedAmount,
                        roundedAmount,
                        req.session.user.id
                    );

                    return payout.lastInsertRowid;
                });

            const payoutId =
                transaction();

            res.json({
                success: true,
                message:
                    "Payout request submitted successfully.",
                payoutId
            });

        } catch (error) {
            console.error(
                "CREATOR PAYOUT REQUEST ERROR:",
                error
            );

            res.status(400).json({
                success: false,
                message:
                    error.message ||
                    "Unable to create payout request."
            });
        }
    }
);


/* =========================================================
   ADMIN USERS
========================================================= */

app.get(
    "/api/admin/users",
    (req, res) => {
        try {
            const users =
                db.prepare(`
                    SELECT
                        id,
                        name,
                        email,
                        role,
                        created_at
                    FROM users
                    ORDER BY id DESC
                `).all();

            res.json({
                success: true,
                users
            });

        } catch (error) {
            console.error(
                "ADMIN USERS ERROR:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Unable to load users."
            });
        }
    }
);


/* =========================================================
   ADMIN VIDEOS
========================================================= */

app.get(
    "/api/admin/videos",
    (req, res) => {
        try {
            const videos =
                db.prepare(`
                    SELECT
                        v.id,
                        v.title,
                        v.category,
                        v.views,
                        v.likes,
                        v.filename,
                        v.source_type,
                        v.youtube_url,
                        v.created_at,
                        u.name AS creator
                    FROM videos v
                    LEFT JOIN users u
                        ON u.id = v.uploaded_by
                    ORDER BY v.id DESC
                `).all();

            res.json({
                success: true,
                videos
            });

        } catch (error) {
            console.error(
                "ADMIN VIDEOS ERROR:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Unable to load videos."
            });
        }
    }
);


/* =========================================================
   ADMIN COMMENTS
========================================================= */

app.get(
    "/api/admin/comments",
    (req, res) => {
        try {
            const videoComments =
                db.prepare(`
                    SELECT
                        c.id,
                        c.video_id,
                        c.user_id,
                        c.comment,
                        c.created_at,
                        u.name AS user_name,
                        v.title AS video_title
                    FROM comments c
                    LEFT JOIN users u
                        ON u.id = c.user_id
                    LEFT JOIN videos v
                        ON v.id = c.video_id
                    ORDER BY c.id DESC
                `).all();

            const homepageComments =
                db.prepare(`
                    SELECT
                        id,
                        user_id,
                        comment,
                        created_at,
                        user_name
                    FROM homepage_comments
                    ORDER BY id DESC
                `).all();

            const comments = [
                ...videoComments.map(
                    comment => ({
                        ...comment,
                        comment_type:
                            "Video Comment"
                    })
                ),

                ...homepageComments.map(
                    comment => ({
                        ...comment,

                        video_id:
                            null,

                        video_title:
                            "Homepage",

                        comment_type:
                            "Homepage Comment"
                    })
                )
            ];

            comments.sort(
                (a, b) => {
                    const dateA =
                        new Date(
                            a.created_at || 0
                        ).getTime();

                    const dateB =
                        new Date(
                            b.created_at || 0
                        ).getTime();

                    return dateB - dateA;
                }
            );

            res.json({
                success: true,
                comments
            });

        } catch (error) {
            console.error(
                "ADMIN COMMENTS ERROR:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Unable to load comments.",
                comments: []
            });
        }
    }
);


/* =========================================================
   ADMIN CREATOR INCOME
========================================================= */

app.get(
    "/api/admin/creator-income",
    (req, res) => {
        try {
            ensureCreatorEarningsRows();

            const creators =
                db.prepare(`
                    SELECT
                        u.id AS creator_id,
                        u.name AS creator_name,
                        u.email AS creator_email,

                        COUNT(v.id) AS video_count,

                        COALESCE(
                            SUM(v.views),
                            0
                        ) AS total_views,

                        COALESCE(
                            SUM(v.likes),
                            0
                        ) AS total_likes,

                        COALESCE(
                            ce.total_earnings,
                            0
                        ) AS total_earnings,

                        COALESCE(
                            ce.available_balance,
                            0
                        ) AS available_balance,

                        COALESCE(
                            ce.pending_payout,
                            0
                        ) AS pending_payout,

                        COALESCE(
                            ce.paid_amount,
                            0
                        ) AS paid_amount

                    FROM users u

                    LEFT JOIN videos v
                        ON v.uploaded_by = u.id

                    LEFT JOIN creator_earnings ce
                        ON ce.user_id = u.id

                    GROUP BY
                        u.id,
                        u.name,
                        u.email,
                        ce.total_earnings,
                        ce.available_balance,
                        ce.pending_payout,
                        ce.paid_amount

                    ORDER BY total_views DESC
                `).all();

            const income =
                creators.map(
                    creator => {
                        const totalEarnings =
                            Number(
                                creator.total_earnings || 0
                            );

                        return {
                            creator_id:
                                creator.creator_id,

                            creator_name:
                                creator.creator_name,

                            creator_email:
                                creator.creator_email,

                            video_count:
                                Number(
                                    creator.video_count || 0
                                ),

                            total_views:
                                Number(
                                    creator.total_views || 0
                                ),

                            total_likes:
                                Number(
                                    creator.total_likes || 0
                                ),

                            total_earnings:
                                Number(
                                    totalEarnings.toFixed(2)
                                ),

                            estimated_income:
                                Number(
                                    totalEarnings.toFixed(2)
                                ),

                            available_balance:
                                Number(
                                    Number(
                                        creator.available_balance || 0
                                    ).toFixed(2)
                                ),

                            pending_payout:
                                Number(
                                    Number(
                                        creator.pending_payout || 0
                                    ).toFixed(2)
                                ),

                            paid_amount:
                                Number(
                                    Number(
                                        creator.paid_amount || 0
                                    ).toFixed(2)
                                )
                        };
                    }
                );

            res.json({
                success: true,
                creators:
                    income
            });

        } catch (error) {
            console.error(
                "ADMIN CREATOR INCOME ERROR:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Unable to load creator income.",
                creators: []
            });
        }
    }
);


/* =========================================================
   ADMIN PAYMENTS
========================================================= */

app.get(
    "/api/admin/payments",
    (req, res) => {
        try {
            const payments =
                db.prepare(`
                    SELECT
                        p.id,
                        p.user_id,
                        u.name AS user_name,
                        u.email AS user_email,
                        p.course_id,
                        p.course_name,
                        p.amount,
                        p.status,
                        p.razorpay_order_id,
                        p.razorpay_payment_id,
                        p.created_at
                    FROM purchases p
                    LEFT JOIN users u
                        ON u.id = p.user_id
                    ORDER BY p.id DESC
                `).all();

            res.json({
                success: true,
                payments
            });

        } catch (error) {
            console.error(
                "ADMIN PAYMENTS ERROR:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Unable to load payments.",
                payments: []
            });
        }
    }
);


/* =========================================================
   ADMIN PAYOUTS
========================================================= */

app.get(
    "/api/admin/payouts",
    (req, res) => {
        try {
            const payouts =
                db.prepare(`
                    SELECT
                        p.id,
                        p.user_id,
                        u.name AS user_name,
                        u.email AS user_email,
                        p.amount,
                        p.status,
                        p.requested_at,
                        p.approved_at,
                        p.paid_at,
                        p.admin_note
                    FROM creator_payouts p
                    LEFT JOIN users u
                        ON u.id = p.user_id
                    ORDER BY p.id DESC
                `).all();

            res.json({
                success: true,
                payouts
            });

        } catch (error) {
            console.error(
                "ADMIN PAYOUTS ERROR:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Unable to load payouts.",
                payouts: []
            });
        }
    }
);


/* =========================================================
   ADMIN PAYOUT STATUS
========================================================= */

app.post(
    "/api/admin/payouts/:id/status",
    (req, res) => {

        try {

            const payoutId =
                Number(req.params.id);

            const newStatus =
                String(
                    req.body?.status || ""
                )
                .trim()
                .toLowerCase();

            const adminNote =
                String(
                    req.body?.admin_note ||
                    req.body?.adminNote ||
                    ""
                )
                .trim();


            if (
                !Number.isInteger(payoutId) ||
                payoutId <= 0
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Invalid payout ID."
                });

            }


            const allowedStatuses = [
                "approved",
                "rejected",
                "paid"
            ];

            if (
                !allowedStatuses.includes(
                    newStatus
                )
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Invalid payout status."
                });

            }


            const transaction =
                db.transaction(() => {

                    const payout =
                        db.prepare(`
                            SELECT *
                            FROM creator_payouts
                            WHERE id = ?
                        `).get(
                            payoutId
                        );


                    if (!payout) {

                        throw new Error(
                            "Payout record not found."
                        );

                    }


                    const currentStatus =
                        String(
                            payout.status || ""
                        )
                        .trim()
                        .toLowerCase();


                    if (
                        currentStatus ===
                        "paid"
                    ) {

                        throw new Error(
                            "A paid payout cannot be changed."
                        );

                    }


                    if (
                        currentStatus ===
                        "rejected"
                    ) {

                        throw new Error(
                            "A rejected payout cannot be changed."
                        );

                    }


                    /* =================================================
                       APPROVE
                    ================================================= */

                    if (
                        newStatus ===
                        "approved"
                    ) {

                        if (
                            currentStatus !==
                            "pending"
                        ) {

                            throw new Error(
                                "Only pending payouts can be approved."
                            );

                        }


                        db.prepare(`
                            UPDATE creator_payouts
                            SET
                                status = 'approved',
                                approved_at =
                                    CURRENT_TIMESTAMP,
                                admin_note = ?
                            WHERE id = ?
                        `).run(
                            adminNote,
                            payoutId
                        );


                        return;

                    }


                    /* =================================================
                       REJECT
                    ================================================= */

                    if (
                        newStatus ===
                        "rejected"
                    ) {

                        if (
                            currentStatus !==
                            "pending" &&
                            currentStatus !==
                            "approved"
                        ) {

                            throw new Error(
                                "This payout cannot be rejected."
                            );

                        }


                        db.prepare(`
                            UPDATE creator_earnings
                            SET
                                available_balance =
                                    available_balance + ?,

                                pending_payout =
                                    MAX(
                                        0,
                                        pending_payout - ?
                                    ),

                                updated_at =
                                    CURRENT_TIMESTAMP

                            WHERE user_id = ?
                        `).run(
                            Number(
                                payout.amount
                            ),
                            Number(
                                payout.amount
                            ),
                            payout.user_id
                        );


                        db.prepare(`
                            UPDATE creator_payouts
                            SET
                                status = 'rejected',
                                admin_note = ?
                            WHERE id = ?
                        `).run(
                            adminNote,
                            payoutId
                        );


                        return;

                    }


                    /* =================================================
                       PAID
                    ================================================= */

                    if (
                        newStatus ===
                        "paid"
                    ) {

                        if (
                            currentStatus !==
                            "approved"
                        ) {

                            throw new Error(
                                "Only approved payouts can be marked as paid."
                            );

                        }


                        db.prepare(`
                            UPDATE creator_earnings
                            SET

                                pending_payout =
                                    MAX(
                                        0,
                                        pending_payout - ?
                                    ),

                                paid_amount =
                                    paid_amount + ?,

                                updated_at =
                                    CURRENT_TIMESTAMP

                            WHERE user_id = ?
                        `).run(
                            Number(
                                payout.amount
                            ),
                            Number(
                                payout.amount
                            ),
                            payout.user_id
                        );


                        db.prepare(`
                            UPDATE creator_payouts
                            SET
                                status = 'paid',
                                paid_at =
                                    CURRENT_TIMESTAMP,
                                admin_note = ?
                            WHERE id = ?
                        `).run(
                            adminNote,
                            payoutId
                        );


                        return;

                    }

                });


            transaction();


            return res.json({

                success: true,

                message:
                    "Payout #" +
                    payoutId +
                    " status changed to " +
                    newStatus +
                    "."

            });


        } catch (error) {

            console.error(
                "ADMIN PAYOUT STATUS ERROR:",
                error
            );


            return res.status(400).json({

                success: false,

                message:
                    error.message ||
                    "Unable to update payout."

            });

        }

    }
);


/* =========================================================
   ADMIN STATISTICS
========================================================= */

app.get(
    "/api/admin/statistics",
    (req, res) => {
        try {
            const users =
                db.prepare(`
                    SELECT COUNT(*) AS count
                    FROM users
                `).get();

            const videos =
                db.prepare(`
                    SELECT COUNT(*) AS count
                    FROM videos
                `).get();

            const comments =
                db.prepare(`
                    SELECT COUNT(*) AS count
                    FROM comments
                `).get();

            const homepageComments =
                db.prepare(`
                    SELECT COUNT(*) AS count
                    FROM homepage_comments
                `).get();

            const likes =
                db.prepare(`
                    SELECT COUNT(*) AS count
                    FROM likes
                `).get();

            const totalViews =
                db.prepare(`
                    SELECT
                        COALESCE(
                            SUM(views),
                            0
                        ) AS count
                    FROM videos
                `).get();

            res.json({
                success: true,

                statistics: {
                    users:
                        users.count || 0,

                    videos:
                        videos.count || 0,

                    comments:
                        (
                            comments.count || 0
                        ) +
                        (
                            homepageComments.count || 0
                        ),

                    likes:
                        likes.count || 0,

                    views:
                        totalViews.count || 0
                }
            });

        } catch (error) {
            console.error(
                "ADMIN STATISTICS ERROR:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Unable to load admin statistics."
            });
        }
    }
);


/* =========================================================
   API 404
========================================================= */

app.use(
    "/api",
    (req, res) => {
        res.status(404).json({
            success: false,
            message:
                "API endpoint not found."
        });
    }
);


/* =========================================================
   ERROR HANDLER
========================================================= */

app.use(
    (
        error,
        req,
        res,
        next
    ) => {

        console.error(
            "SERVER ERROR:",
            error
        );

        if (
            error instanceof
            multer.MulterError
        ) {
            return res.status(400).json({
                success: false,
                message:
                    error.message
            });
        }

        res.status(500).json({
            success: false,
            message:
                "Internal server error."
        });
    }
);


/* =========================================================
   START SERVER
========================================================= */

app.listen(
    PORT,
    () => {

        console.log(
            "======================================"
        );

        console.log(
            "ALL-IN-ONE.COM SERVER STARTED"
        );

        console.log(
            "======================================"
        );

        console.log(
            "Website : http://localhost:3000"
        );

        console.log(
            "Login   : http://localhost:3000/login.html"
        );

        console.log(
            "Upload  : http://localhost:3000/video-upload.html"
        );

        console.log(
            "Videos  : http://localhost:3000/videos.html"
        );

        console.log(
            "Account : http://localhost:3000/account.html"
        );

        console.log(
            "Admin   : http://localhost:3000/admin.html"
        );

        console.log(
            "======================================"
        );

        console.log(
            "VIDEO FOLDER:",
            VIDEO_FOLDER
        );

        console.log(
            "DATABASE:",
            DB_FILE
        );

        console.log(
            "THUMBNAIL FOLDER:",
            THUMBNAIL_FOLDER
        );

        console.log(
            "SESSION MODE:",
            IS_PRODUCTION
                ? "PRODUCTION / HTTPS"
                : "DEVELOPMENT / HTTP"
        );

        console.log(
            "SESSION STORE: SQLITE / PERSISTENT"
        );

        console.log(
            "SECURITY: HELMET ENABLED"
        );

        console.log(
            "RAZORPAY: ENABLED / TEST MODE"
        );

        console.log(
            "======================================"
        );
    }
);