require("dotenv").config();

const express = require("express");
const path = require("path");
const bcrypt = require("bcrypt");
const session = require("express-session");

const db = require("./database");

const app = express();
const PORT = 3000;

// =========================
// SECURITY
// =========================

app.disable("x-powered-by");


// =========================
// ADMIN MIDDLEWARE
// =========================

function requireAdmin(req, res, next) {

    if (!req.session.user) {
        return res.status(401).json({
            message: "Please login first."
        });
    }

    if (req.session.user.role !== "admin") {
        return res.status(403).json({
            message: "Admin access required."
        });
    }

    next();
}


// =========================
// MIDDLEWARE
// =========================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// =========================
// SESSIONS
// =========================

if (!process.env.SESSION_SECRET) {
    console.error("ERROR: SESSION_SECRET is not set in .env");
    process.exit(1);
}

app.use(
    session({
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,

        cookie: {
            httpOnly: true,
            sameSite: "lax",
            secure: false,
            maxAge: 24 * 60 * 60 * 1000
        }
    })
);


// =========================
// REGISTER
// =========================

app.post("/api/register", async (req, res) => {

    try {

        const {
            name,
            email,
            password
        } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                message: "Please fill in all fields."
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                message:
                    "Password must be at least 8 characters."
            });
        }

        const normalizedEmail =
            email.toLowerCase().trim();

        const hashedPassword =
            await bcrypt.hash(password, 12);

        db.run(
            `INSERT INTO users
            (name, email, password)
            VALUES (?, ?, ?)`,
            [
                name.trim(),
                normalizedEmail,
                hashedPassword
            ],
            function (err) {

                if (err) {

                    if (err.message.includes("UNIQUE")) {
                        return res.status(409).json({
                            message:
                                "An account with this email already exists."
                        });
                    }

                    console.error(err);

                    return res.status(500).json({
                        message:
                            "Could not create account."
                    });
                }

                res.status(201).json({
                    success: true,
                    message:
                        "Account created successfully."
                });

            }
        );

    } catch (error) {

        console.error(error);

        res.status(500).json({
            message: "Server error."
        });

    }

});


// =========================
// LOGIN
// =========================

app.post("/api/login", (req, res) => {

    const {
        email,
        password
    } = req.body;

    if (!email || !password) {
        return res.status(400).json({
            message:
                "Please enter your email and password."
        });
    }

    const normalizedEmail =
        email.toLowerCase().trim();

    db.get(
        `SELECT
            id,
            name,
            email,
            password,
            role
         FROM users
         WHERE email = ?`,
        [normalizedEmail],
        async (err, user) => {

            if (err) {

                console.error(err);

                return res.status(500).json({
                    message: "Server error."
                });
            }

            if (!user) {

                return res.status(401).json({
                    message:
                        "Invalid email or password."
                });
            }

            try {

                const passwordCorrect =
                    await bcrypt.compare(
                        password,
                        user.password
                    );

                if (!passwordCorrect) {

                    return res.status(401).json({
                        message:
                            "Invalid email or password."
                    });
                }

                // Regenerate session after successful login
                // to help prevent session fixation.
                req.session.regenerate((sessionError) => {

                    if (sessionError) {

                        console.error(
                            "Session regeneration error:",
                            sessionError
                        );

                        return res.status(500).json({
                            message:
                                "Could not create login session."
                        });
                    }

                    req.session.user = {
                        id: user.id,
                        name: user.name,
                        email: user.email,
                        role: user.role
                    };

                    res.json({
                        success: true,
                        message:
                            "Login successful."
                    });

                });

            } catch (passwordError) {

                console.error(passwordError);

                return res.status(500).json({
                    message:
                        "Server error."
                });

            }

        }
    );

});


// =========================
// CURRENT USER
// =========================

app.get("/api/me", (req, res) => {

    if (!req.session.user) {

        return res.status(401).json({
            message: "Not logged in."
        });
    }

    res.json({
        success: true,
        user: req.session.user
    });

});


// =========================
// LOGOUT
// =========================

app.post("/api/logout", (req, res) => {

    req.session.destroy((err) => {

        if (err) {

            console.error(err);

            return res.status(500).json({
                message:
                    "Could not log out."
            });
        }

        res.clearCookie("connect.sid");

        res.json({
            success: true,
            message:
                "Logged out successfully."
        });

    });

});


// =========================
// SERVE WEBSITE
// =========================

app.use(
    express.static(
        path.join(__dirname, "..", "public")
    )
);

app.get("/", (req, res) => {

    res.sendFile(
        path.join(
            __dirname,
            "..",
            "public",
            "index.html"
        )
    );

});


// =========================
// STATUS
// =========================

app.get("/api/status", (req, res) => {

    res.json({
        success: true,
        message:
            "StudyHub NG backend is working!"
    });

});


// =========================
// EXAMS
// =========================

app.get("/api/exams", (req, res) => {

    const sql = `
        SELECT DISTINCT exam
        FROM questions
        WHERE exam IS NOT NULL
        AND exam != ''
        ORDER BY exam ASC
    `;

    db.all(sql, [], (err, rows) => {

        if (err) {

            console.error(
                "Exam loading error:",
                err
            );

            return res.status(500).json({
                message:
                    "Unable to load exams."
            });
        }

        res.json({
            success: true,
            exams:
                rows.map(row => row.exam)
        });

    });

});


// =========================
// SUBJECTS
// =========================

app.get("/api/subjects", (req, res) => {

    const exam =
        String(req.query.exam || "").trim();

    if (!exam) {

        return res.status(400).json({
            message:
                "Exam is required."
        });
    }

    const sql = `
        SELECT DISTINCT subject
        FROM questions
        WHERE exam = ?
        AND subject IS NOT NULL
        AND subject != ''
        ORDER BY subject ASC
    `;

    db.all(
        sql,
        [exam],
        (err, rows) => {

            if (err) {

                console.error(
                    "Subject loading error:",
                    err
                );

                return res.status(500).json({
                    message:
                        "Unable to load subjects."
                });
            }

            res.json({
                success: true,
                subjects:
                    rows.map(row => row.subject)
            });

        }
    );

});


// =========================
// TOPICS
// =========================

app.get("/api/topics", (req, res) => {

    const exam =
        String(req.query.exam || "").trim();

    const subject =
        String(req.query.subject || "").trim();

    if (!exam || !subject) {

        return res.status(400).json({
            message:
                "Exam and subject are required."
        });
    }

    const sql = `
        SELECT DISTINCT topic
        FROM questions
        WHERE exam = ?
        AND subject = ?
        AND topic IS NOT NULL
        AND topic != ''
        ORDER BY topic ASC
    `;

    db.all(
        sql,
        [exam, subject],
        (err, rows) => {

            if (err) {

                console.error(
                    "Topic loading error:",
                    err
                );

                return res.status(500).json({
                    message:
                        "Unable to load topics."
                });
            }

            res.json({
                topics:
                    rows.map(row => row.topic)
            });

        }
    );

});


// =========================
// QUESTIONS
// =========================

app.get("/api/questions", (req, res) => {

    const exam =
        String(req.query.exam || "").trim();

    const subject =
        String(req.query.subject || "").trim();

    const topic =
        String(req.query.topic || "").trim();

    const difficulty =
        String(req.query.difficulty || "").trim();

    let limit =
        parseInt(req.query.limit, 10);

    if (!exam || !subject) {

        return res.status(400).json({
            message:
                "Exam and subject are required."
        });
    }

    const allowedLimits = [
        10,
        20,
        30,
        50,
        100
    ];

    if (!allowedLimits.includes(limit)) {
        limit = 10;
    }

    let sql = `
        SELECT
            id,
            exam,
            subject,
            topic,
            difficulty,
            question,
            option_a,
            option_b,
            option_c,
            option_d,
            correct_answer
        FROM questions
        WHERE exam = ?
        AND subject = ?
    `;

    const params = [
        exam,
        subject
    ];

    if (topic) {

        sql += `
            AND topic = ?
        `;

        params.push(topic);
    }

    if (difficulty) {

        sql += `
            AND difficulty = ?
        `;

        params.push(difficulty);
    }

    sql += `
        ORDER BY RANDOM()
        LIMIT ?
    `;

    params.push(limit);

    db.all(
        sql,
        params,
        (err, rows) => {

            if (err) {

                console.error(
                    "Question loading error:",
                    err
                );

                return res.status(500).json({
                    message:
                        "Unable to load questions."
                });
            }

            res.json({
                questions: rows,
                count: rows.length
            });

        }
    );

});


// =========================
// SUBMIT QUIZ
// =========================

app.post(
    "/api/submit-quiz",
    (req, res) => {

        if (!req.session.user) {

            return res.status(401).json({
                message:
                    "Please login first."
            });
        }

        const userId =
            req.session.user.id;

        const {
            exam,
            subject,
            questionIds,
            answers
        } = req.body;

        if (
            !exam ||
            !subject ||
            !Array.isArray(questionIds) ||
            !Array.isArray(answers)
        ) {

            return res.status(400).json({
                message:
                    "Invalid quiz submission."
            });
        }

        if (
            questionIds.length === 0 ||
            questionIds.length !== answers.length
        ) {

            return res.status(400).json({
                message:
                    "Questions and answers do not match."
            });
        }

        const placeholders =
            questionIds
                .map(() => "?")
                .join(",");

        const sql = `
            SELECT
                id,
                correct_answer
            FROM questions
            WHERE id IN (${placeholders})
            AND exam = ?
            AND subject = ?
        `;

        db.all(
            sql,
            [
                ...questionIds,
                exam,
                subject
            ],
            (err, questions) => {

                if (err) {

                    console.error(err);

                    return res.status(500).json({
                        message:
                            "Unable to check answers."
                    });
                }

                if (
                    questions.length !==
                    questionIds.length
                ) {

                    return res.status(400).json({
                        message:
                            "Some questions are invalid."
                    });
                }

                const answerMap = {};

                questions.forEach(
                    question => {

                        answerMap[
                            question.id
                        ] =
                            question.correct_answer;

                    }
                );

                let correctAnswers = 0;

                questionIds.forEach(
                    (questionId, index) => {

                        const selectedAnswer =
                            String(
                                answers[index] || ""
                            )
                            .trim()
                            .toUpperCase();

                        const correctAnswer =
                            String(
                                answerMap[
                                    questionId
                                ]
                            )
                            .trim()
                            .toUpperCase();

                        if (
                            selectedAnswer ===
                            correctAnswer
                        ) {

                            correctAnswers++;

                        }

                    }
                );

                const totalQuestions =
                    questionIds.length;

                const percentage =
                    Math.round(
                        (
                            correctAnswers /
                            totalQuestions
                        ) * 100
                    );

                db.run(
                    `
                    INSERT INTO results
                    (
                        user_id,
                        exam,
                        subject,
                        total_questions,
                        correct_answers,
                        percentage
                    )
                    VALUES (?, ?, ?, ?, ?, ?)
                    `,
                    [
                        userId,
                        exam,
                        subject,
                        totalQuestions,
                        correctAnswers,
                        percentage
                    ],
                    function (resultError) {

                        if (resultError) {

                            console.error(
                                resultError
                            );

                            return res.status(500).json({
                                message:
                                    "Unable to save result."
                            });
                        }

                        const resultId =
                            this.lastID;

                        const insertAnswer =
                            db.prepare(`
                                INSERT INTO quiz_answers
                                (
                                    result_id,
                                    question_id,
                                    selected_answer,
                                    correct_answer,
                                    is_correct
                                )
                                VALUES (?, ?, ?, ?, ?)
                            `);

                        questionIds.forEach(
                            (questionId, index) => {

                                const selectedAnswer =
                                    String(
                                        answers[index] ||
                                        ""
                                    )
                                    .trim()
                                    .toUpperCase();

                                const correctAnswer =
                                    String(
                                        answerMap[
                                            questionId
                                        ]
                                    )
                                    .trim()
                                    .toUpperCase();

                                const isCorrect =
                                    selectedAnswer ===
                                    correctAnswer
                                        ? 1
                                        : 0;

                                insertAnswer.run(
                                    resultId,
                                    questionId,
                                    selectedAnswer,
                                    correctAnswer,
                                    isCorrect
                                );

                            }
                        );

                        insertAnswer.finalize(
                            (finalizeError) => {

                                if (finalizeError) {

                                    console.error(
                                        finalizeError
                                    );

                                    return res.status(500).json({
                                        message:
                                            "Quiz answers could not be saved."
                                    });
                                }

                                res.json({
                                    message:
                                        "Quiz submitted successfully.",
                                    resultId,
                                    totalQuestions,
                                    correctAnswers,
                                    percentage
                                });

                            }
                        );

                    }
                );

            }
        );

    }
);


// =========================
// STUDENT RESULT
// =========================

app.get(
    "/api/results/:id",
    (req, res) => {

        if (!req.session.user) {

            return res.status(401).json({
                message:
                    "Please login first."
            });
        }

        const resultId =
            parseInt(
                req.params.id,
                10
            );

        if (!Number.isInteger(resultId)) {

            return res.status(400).json({
                message:
                    "Invalid result ID."
            });
        }

        const resultSql = `
            SELECT
                id,
                exam,
                subject,
                total_questions,
                correct_answers,
                percentage,
                created_at
            FROM results
            WHERE id = ?
            AND user_id = ?
        `;

        db.get(
            resultSql,
            [
                resultId,
                req.session.user.id
            ],
            (err, result) => {

                if (err) {

                    console.error(err);

                    return res.status(500).json({
                        message:
                            "Unable to load result."
                    });
                }

                if (!result) {

                    return res.status(404).json({
                        message:
                            "Result not found."
                    });
                }

                const answerSql = `
                    SELECT
                        qa.question_id,
                        qa.selected_answer,
                        qa.correct_answer,
                        qa.is_correct,
                        q.question,
                        q.option_a,
                        q.option_b,
                        q.option_c,
                        q.option_d,
                        q.explanation,
                        q.topic,
                        q.difficulty
                    FROM quiz_answers qa
                    JOIN questions q
                        ON q.id = qa.question_id
                    WHERE qa.result_id = ?
                    ORDER BY qa.id ASC
                `;

                db.all(
                    answerSql,
                    [resultId],
                    (answerError, answers) => {

                        if (answerError) {

                            console.error(
                                answerError
                            );

                            return res.status(500).json({
                                message:
                                    "Unable to load answer review."
                            });
                        }

                        res.json({
                            result,
                            answers
                        });

                    }
                );

            }
        );

    }
);


// =========================
// ALL STUDENT RESULTS
// =========================

app.get("/api/results", (req, res) => {

    if (!req.session.user) {

        return res.status(401).json({
            message:
                "Please login first."
        });
    }

    db.all(
        `SELECT
            id,
            exam,
            subject,
            total_questions,
            correct_answers,
            percentage,
            created_at
         FROM results
         WHERE user_id = ?
         ORDER BY created_at DESC`,
        [req.session.user.id],
        (err, results) => {

            if (err) {

                console.error(err);

                return res.status(500).json({
                    message:
                        "Could not load results."
                });
            }

            res.json({
                success: true,
                results
            });

        }
    );

});


// =========================
// PROGRESS
// =========================

app.get("/api/progress", (req, res) => {

    if (!req.session.user) {

        return res.status(401).json({
            message:
                "Please login first."
        });
    }

    const userId =
        req.session.user.id;

    const statsSql = `
        SELECT
            COUNT(*) AS totalQuizzes,
            COALESCE(
                SUM(total_questions),
                0
            ) AS totalQuestions,
            COALESCE(
                SUM(correct_answers),
                0
            ) AS totalCorrect,
            COALESCE(
                ROUND(AVG(percentage)),
                0
            ) AS averageScore,
            COALESCE(
                MAX(percentage),
                0
            ) AS bestScore
        FROM results
        WHERE user_id = ?
    `;

    const subjectSql = `
        SELECT
            subject,
            COUNT(*) AS quizzes,
            COALESCE(
                SUM(total_questions),
                0
            ) AS totalQuestions,
            COALESCE(
                SUM(correct_answers),
                0
            ) AS totalCorrect,
            COALESCE(
                ROUND(AVG(percentage)),
                0
            ) AS averageScore,
            COALESCE(
                MAX(percentage),
                0
            ) AS bestScore
        FROM results
        WHERE user_id = ?
        GROUP BY subject
        ORDER BY averageScore DESC
    `;

    db.get(
        statsSql,
        [userId],
        (err, stats) => {

            if (err) {

                console.error(
                    "Progress stats error:",
                    err
                );

                return res.status(500).json({
                    message:
                        "Unable to load progress."
                });
            }

            db.all(
                subjectSql,
                [userId],
                (subjectError, subjects) => {

                    if (subjectError) {

                        console.error(
                            "Subject progress error:",
                            subjectError
                        );

                        return res.status(500).json({
                            message:
                                "Unable to load subject progress."
                        });
                    }

                    res.json({
                        stats,
                        subjects
                    });

                }
            );

        }
    );

});


// =========================
// ADMIN - ADD QUESTION
// =========================

app.post(
    "/api/admin/questions",
    requireAdmin,
    (req, res) => {

        const {
            exam,
            subject,
            topic,
            difficulty,
            question,
            option_a,
            option_b,
            option_c,
            option_d,
            correct_answer,
            explanation
        } = req.body;

        if (
            !exam ||
            !subject ||
            !question ||
            !option_a ||
            !option_b ||
            !option_c ||
            !option_d ||
            !correct_answer
        ) {

            return res.status(400).json({
                message:
                    "Please fill in all required fields."
            });
        }

        const normalizedAnswer =
            String(correct_answer)
                .trim()
                .toUpperCase();

        if (
            !["A", "B", "C", "D"]
                .includes(normalizedAnswer)
        ) {

            return res.status(400).json({
                message:
                    "Correct answer must be A, B, C or D."
            });
        }

        db.run(
            `INSERT INTO questions
            (
                exam,
                subject,
                topic,
                difficulty,
                question,
                option_a,
                option_b,
                option_c,
                option_d,
                correct_answer,
                explanation
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                String(exam).trim(),
                String(subject).trim(),
                topic ? String(topic).trim() : "",
                difficulty ? String(difficulty).trim() : "",
                String(question).trim(),
                String(option_a).trim(),
                String(option_b).trim(),
                String(option_c).trim(),
                String(option_d).trim(),
                normalizedAnswer,
                explanation ? String(explanation).trim() : ""
            ],
            function (err) {

                if (err) {

                    console.error(err);

                    return res.status(500).json({
                        message:
                            "Could not add question."
                    });
                }

                res.status(201).json({
                    success: true,
                    message:
                        "Question added successfully.",
                    id: this.lastID
                });

            }
        );

    }
);


// =========================
// ADMIN - VIEW QUESTIONS
// =========================

app.get(
    "/api/admin/questions",
    requireAdmin,
    (req, res) => {

        const search =
            String(
                req.query.search || ""
            ).trim();

        const exam =
            String(
                req.query.exam || ""
            ).trim();

        const subject =
            String(
                req.query.subject || ""
            ).trim();

        const difficulty =
            String(
                req.query.difficulty || ""
            ).trim();

        let sql = `
            SELECT
                id,
                exam,
                subject,
                topic,
                difficulty,
                question,
                option_a,
                option_b,
                option_c,
                option_d,
                correct_answer,
                explanation,
                created_at
            FROM questions
            WHERE 1 = 1
        `;

        const params = [];

        if (search) {

            sql += `
                AND (
                    question LIKE ?
                    OR topic LIKE ?
                )
            `;

            const searchValue =
                `%${search}%`;

            params.push(
                searchValue,
                searchValue
            );

        }

        if (exam) {

            sql += ` AND exam = ?`;

            params.push(exam);

        }

        if (subject) {

            sql += ` AND subject = ?`;

            params.push(subject);

        }

        if (difficulty) {

            sql += ` AND difficulty = ?`;

            params.push(difficulty);

        }

        sql += `
            ORDER BY id DESC
            LIMIT 500
        `;

        db.all(
            sql,
            params,
            (err, rows) => {

                if (err) {

                    console.error(
                        "Admin question search error:",
                        err
                    );

                    return res.status(500).json({
                        message:
                            "Unable to load questions."
                    });
                }

                res.json({
                    questions: rows,
                    count: rows.length
                });

            }
        );

    }
);


// =========================
// ADMIN - DELETE QUESTION
// =========================

app.delete(
    "/api/admin/questions/:id",
    requireAdmin,
    (req, res) => {

        const id =
            parseInt(req.params.id, 10);

        if (!Number.isInteger(id)) {

            return res.status(400).json({
                message:
                    "Invalid question ID."
            });
        }

        db.run(
            `DELETE FROM questions WHERE id = ?`,
            [id],
            function (err) {

                if (err) {

                    console.error(err);

                    return res.status(500).json({
                        message:
                            "Could not delete question."
                    });
                }

                if (this.changes === 0) {

                    return res.status(404).json({
                        message:
                            "Question not found."
                    });
                }

                res.json({
                    success: true,
                    message:
                        "Question deleted successfully."
                });

            }
        );

    }
);


// =========================
// START SERVER
// =========================

app.listen(PORT, () => {

    console.log(
        `StudyHub NG running at http://localhost:${PORT}`
    );

});