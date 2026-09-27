const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const databasePath = process.env.DB_PATH || path.join(__dirname, "..", "data", "studyhub.db");
const db = new sqlite3.Database(databasePath, (err) => {
    if (err) {
        console.error("Database connection failed:", err.message);
    } else {
        console.log("Database connected successfully.");
    }
});

db.serialize(() => {

    // =========================
    // USERS
    // =========================
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT DEFAULT 'student',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // =========================
    // QUESTIONS
    // =========================
    db.run(`
        CREATE TABLE IF NOT EXISTS questions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            exam TEXT NOT NULL,
            subject TEXT NOT NULL,
            topic TEXT DEFAULT '',
            difficulty TEXT DEFAULT 'medium',
            question TEXT NOT NULL,
            option_a TEXT NOT NULL,
            option_b TEXT NOT NULL,
            option_c TEXT NOT NULL,
            option_d TEXT NOT NULL,
            correct_answer TEXT NOT NULL,
            explanation TEXT DEFAULT '',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // =========================
    // RESULTS
    // =========================
    db.run(`
        CREATE TABLE IF NOT EXISTS results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            exam TEXT NOT NULL,
            subject TEXT NOT NULL,
            total_questions INTEGER NOT NULL,
            correct_answers INTEGER NOT NULL,
            percentage INTEGER NOT NULL,
            score INTEGER NOT NULL DEFAULT 0,
            total INTEGER NOT NULL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `);

    // =========================
    // RESULTS MIGRATION
    // =========================
    db.all(`PRAGMA table_info(results)`, (err, columns) => {

        if (err) {
            console.error(
                "Could not check results table:",
                err.message
            );
            return;
        }

        const columnNames = columns.map(column => column.name);

        // Add score if old database does not have it
        if (!columnNames.includes("score")) {

            db.run(`
                ALTER TABLE results
                ADD COLUMN score INTEGER NOT NULL DEFAULT 0
            `, (error) => {

                if (error) {
                    console.error(
                        "Could not add score column:",
                        error.message
                    );
                } else {
                    console.log(
                        "Results score column added."
                    );
                }

            });
        }

        // Add total if old database does not have it
        if (!columnNames.includes("total")) {

            db.run(`
                ALTER TABLE results
                ADD COLUMN total INTEGER NOT NULL DEFAULT 0
            `, (error) => {

                if (error) {
                    console.error(
                        "Could not add total column:",
                        error.message
                    );
                } else {
                    console.log(
                        "Results total column added."
                    );
                }

            });
        }

    });

    // =========================
    // REMOVE DUPLICATE QUESTIONS
    // =========================
    db.run(`
        DELETE FROM questions
        WHERE id NOT IN (
            SELECT MIN(id)
            FROM questions
            GROUP BY exam, subject, question
        )
    `, (err) => {

        if (err) {

            console.error(
                "Duplicate question cleanup error:",
                err.message
            );

        } else {

            console.log(
                "Duplicate questions cleaned successfully."
            );

        }

    });

    // =========================
    // PREVENT FUTURE DUPLICATES
    // =========================
    db.run(`
        CREATE UNIQUE INDEX IF NOT EXISTS unique_question
        ON questions (exam, subject, question)
    `, (err) => {

        if (err) {

            console.error(
                "Question unique index error:",
                err.message
            );

        } else {

            console.log(
                "Question duplicate protection enabled."
            );

        }

    });

    // =========================
    // QUIZ ANSWERS
    // =========================
    db.run(`
        CREATE TABLE IF NOT EXISTS quiz_answers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            result_id INTEGER NOT NULL,
            question_id INTEGER NOT NULL,
            selected_answer TEXT NOT NULL,
            correct_answer TEXT NOT NULL,
            is_correct INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (result_id) REFERENCES results(id),
            FOREIGN KEY (question_id) REFERENCES questions(id)
        )
    `);

    console.log(
        "Users, questions, results and quiz answers tables ready."
    );

});

module.exports = db;