const fs = require("fs");
const path = require("path");
const db = require("./database");

const questionBankPath = path.resolve(__dirname, "..", "question-bank");

let totalImported = 0;
let totalSkipped = 0;
let totalFiles = 0;

function findJsonFiles(folder) {
    let results = [];

    if (!fs.existsSync(folder)) {
        return results;
    }

    const items = fs.readdirSync(folder, { withFileTypes: true });

    for (const item of items) {
        const fullPath = path.join(folder, item.name);

        if (item.isDirectory()) {
            results = results.concat(findJsonFiles(fullPath));
        } else if (
            item.isFile() &&
            path.extname(item.name).toLowerCase() === ".json"
        ) {
            results.push(fullPath);
        }
    }

    return results;
}

function importFile(filePath) {
    return new Promise((resolve) => {
        const relativePath = path.relative(questionBankPath, filePath);

        console.log("");
        console.log("--------------------------------");
        console.log(`Processing: ${relativePath}`);
        console.log("--------------------------------");

        let questions;

        try {
            const content = fs.readFileSync(filePath, "utf8");
            questions = JSON.parse(content);
        } catch (error) {
            console.log(`Could not read ${relativePath}: ${error.message}`);
            resolve();
            return;
        }

        if (!Array.isArray(questions)) {
            console.log(`${relativePath} must contain an array of questions.`);
            resolve();
            return;
        }

        const stmt = db.prepare(`
            INSERT OR IGNORE INTO questions
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
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        let imported = 0;
        let skipped = 0;

        let pending = questions.length;

        if (pending === 0) {
            stmt.finalize(() => {
                console.log(`${relativePath}: 0 questions`);
                resolve();
            });
            return;
        }

        questions.forEach((q, index) => {
            const requiredFields = [
                "exam",
                "subject",
                "question",
                "option_a",
                "option_b",
                "option_c",
                "option_d",
                "correct_answer"
            ];

            const missing = requiredFields.filter(
                field =>
                    !q[field] ||
                    String(q[field]).trim() === ""
            );

            if (missing.length > 0) {
                console.log(
                    `Skipped question ${index + 1}: missing ${missing.join(", ")}`
                );

                skipped++;
                pending--;

                if (pending === 0) {
                    finish();
                }

                return;
            }

            const answer = String(q.correct_answer)
                .trim()
                .toUpperCase();

            if (!["A", "B", "C", "D"].includes(answer)) {
                console.log(
                    `Skipped question ${index + 1}: invalid correct answer`
                );

                skipped++;
                pending--;

                if (pending === 0) {
                    finish();
                }

                return;
            }

            const difficulty = String(
                q.difficulty || "medium"
            )
                .trim()
                .toLowerCase();

            if (!["easy", "medium", "hard"].includes(difficulty)) {
                console.log(
                    `Skipped question ${index + 1}: invalid difficulty`
                );

                skipped++;
                pending--;

                if (pending === 0) {
                    finish();
                }

                return;
            }

            stmt.run(
                String(q.exam).trim(),
                String(q.subject).trim(),
                String(q.topic || "").trim(),
                difficulty,
                String(q.question).trim(),
                String(q.option_a).trim(),
                String(q.option_b).trim(),
                String(q.option_c).trim(),
                String(q.option_d).trim(),
                answer,
                String(q.explanation || "").trim(),
                function (error) {
                    if (error) {
                        console.log(
                            `Question ${index + 1} error: ${error.message}`
                        );
                        skipped++;
                    } else if (this.changes === 1) {
                        imported++;
                    } else {
                        console.log(
                            `Question ${index + 1}: duplicate skipped`
                        );
                        skipped++;
                    }

                    pending--;

                    if (pending === 0) {
                        finish();
                    }
                }
            );
        });

        function finish() {
            stmt.finalize(() => {
                console.log(
                    `${relativePath}: ${imported} imported, ${skipped} skipped`
                );

                totalImported += imported;
                totalSkipped += skipped;

                resolve();
            });
        }
    });
}

async function startImport() {
    console.log("");
    console.log("================================");
    console.log("STUDYHUB NG QUESTION IMPORTER");
    console.log("================================");
    console.log("");

    console.log(`Question bank: ${questionBankPath}`);

    if (!fs.existsSync(questionBankPath)) {
        console.log("Question bank folder does not exist.");
        db.close();
        process.exit(1);
    }

    const files = findJsonFiles(questionBankPath);

    totalFiles = files.length;

    console.log(`Found ${totalFiles} JSON file(s).`);

    if (totalFiles === 0) {
        console.log("No JSON question files found.");
        db.close();
        process.exit(0);
    }

    for (const file of files) {
        await importFile(file);
    }

    console.log("");
    console.log("================================");
    console.log("QUESTION IMPORT COMPLETE");
    console.log("================================");
    console.log(`Files processed: ${totalFiles}`);
    console.log(`Imported: ${totalImported}`);
    console.log(`Skipped: ${totalSkipped}`);
    console.log("================================");
    console.log("");

    db.close();
}

startImport();