const db = require("./database");

const questions = [
    {
        exam: "WAEC",
        subject: "English",
        question: "Choose the word opposite in meaning to 'ancient'.",
        option_a: "Old",
        option_b: "Modern",
        option_c: "Historic",
        option_d: "Traditional",
        correct_answer: "B"
    },

    {
        exam: "WAEC",
        subject: "English",
        question: "Choose the correctly spelt word.",
        option_a: "Occassion",
        option_b: "Ocassion",
        option_c: "Occasion",
        option_d: "Occassionn",
        correct_answer: "C"
    },

    {
        exam: "WAEC",
        subject: "Mathematics",
        question: "What is 12 × 5?",
        option_a: "50",
        option_b: "60",
        option_c: "70",
        option_d: "80",
        correct_answer: "B"
    },

    {
        exam: "WAEC",
        subject: "Mathematics",
        question: "What is 100 ÷ 4?",
        option_a: "20",
        option_b: "25",
        option_c: "30",
        option_d: "40",
        correct_answer: "B"
    },

    {
        exam: "JAMB",
        subject: "English",
        question: "Select the word nearest in meaning to 'happy'.",
        option_a: "Sad",
        option_b: "Angry",
        option_c: "Joyful",
        option_d: "Tired",
        correct_answer: "C"
    },

    {
        exam: "JAMB",
        subject: "Mathematics",
        question: "What is 15 + 25?",
        option_a: "30",
        option_b: "35",
        option_c: "40",
        option_d: "45",
        correct_answer: "C"
    }
];

db.serialize(() => {

    const stmt = db.prepare(`
        INSERT INTO questions
        (
            exam,
            subject,
            question,
            option_a,
            option_b,
            option_c,
            option_d,
            correct_answer
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const q of questions) {
        stmt.run(
            q.exam,
            q.subject,
            q.question,
            q.option_a,
            q.option_b,
            q.option_c,
            q.option_d,
            q.correct_answer
        );
    }

    stmt.finalize();

    console.log("Sample questions added successfully.");
});
