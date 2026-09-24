const bcrypt = require("bcrypt");
const db = require("./database");

// CHANGE THESE
const ADMIN_NAME = "StudyHub Admin";
const ADMIN_EMAIL = "admin@studyhub.ng";
const ADMIN_PASSWORD = "Admin@12345";

async function createAdmin() {

    try {

        const hashedPassword =
            await bcrypt.hash(ADMIN_PASSWORD, 12);

        db.run(
            `INSERT INTO users
            (name, email, password, role)
            VALUES (?, ?, ?, 'admin')`,
            [
                ADMIN_NAME,
                ADMIN_EMAIL,
                hashedPassword
            ],
            function (err) {

                if (err) {

                    if (err.message.includes("UNIQUE")) {

                        console.log(
                            "This admin email already exists."
                        );

                    } else {

                        console.error(err);

                    }

                    return;
                }

                console.log(
                    "Admin account created successfully!"
                );

                console.log(
                    "Email:",
                    ADMIN_EMAIL
                );

                console.log(
                    "Password:",
                    ADMIN_PASSWORD
                );

            }
        );

    } catch (error) {

        console.error(error);

    }

}

createAdmin();
