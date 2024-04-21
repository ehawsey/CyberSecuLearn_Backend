require("dotenv").config();
const express = require("express");
const { MongoClient } = require('mongodb');
const cors = require('cors');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000; //so in my heroku app it will be it's port number from process.env instead of 3000
app.use(express.json());
const client = new MongoClient(process.env.MONGO_URI);
app.use(cors({
    origin: 'https://cyberseculearn.vercel.app'
}));
// Connect to MongoDB when the application starts
client.connect()
    .then(() => {
        // Start the server after connecting to MongoDB
        app.listen(PORT, () => {
            console.log("Server is running on port " + PORT);
        });
    })
    .catch(err => {
        console.error("Failed to connect to MongoDB:", err);
        process.exit(1); // Exit the application if unable to connect to MongoDB
    });


// Get a reference to the "Users" collection
const usersCollection = client.db().collection('Users');
const coursesCollection = client.db().collection('Courses');



// All routes

//fetch all users
app.get("/users", async (req, res) => {
    try {
        const users = await usersCollection.find().toArray();
        res.status(200).json(users);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch users" });
    }
});

//fetch all courses
app.get("/courses", async (req, res) => {
    try {
        const users = await coursesCollection.find().toArray();
        res.status(200).json(users);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch users" });
    }
});

// Get course details by course name
app.get("/courses/:courseName", async (req, res) => {
    try {
        let { courseName } = req.params;
        courseName = decodeURIComponent(courseName);

        // Find the course in the database by course name
        const course = await coursesCollection.findOne({ coursename: courseName });

        // If course is not found
        if (!course) {
            return res.status(404).json({ error: "Course not found" });
        }

        res.status(200).json(course);
    } catch (err) {
        console.error("Failed to fetch course details:", err);
        res.status(500).json({ error: "Failed to fetch course details" });
    }
});

//register a new learner from homepage
app.post("/register", async (req, res) => {
    try {
        const { fullName, email, username, password, confirmPassword } = req.body;
        const name = fullName
        // Check if the username already exists
        const existingUser = await usersCollection.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ error: "Username already exists" });
        }
        if (password != confirmPassword) {
            return res.status(400).json({ error: "Password mismatch" });
        }
        const existingEmail = await usersCollection.findOne({ email });
        if (existingEmail) {
            return res.status(400).json({ error: "Email already exists" });
        }

        // Create a new user with the role of a learner and an empty course_detail array
        await usersCollection.insertOne({
            username,
            name,
            email,
            password,
            role: "learner",
            course_detail: []
        });

        res.status(201).json({ message: "User registered successfully" });
    } catch (err) {
        console.error("Failed to register user:", err);
        res.status(500).json({ error: "Failed to register user" });
    }
});

// Verify username and password
app.post("/login", async (req, res) => {
    try {
        const { usernameOrEmail, password } = req.body;

        // Find the user in the database by username or email
        const user = await usersCollection.findOne({
            $or: [
                { username: usernameOrEmail },
                { email: usernameOrEmail }
            ],
            password: password
        });
        // If user is not found or password is incorrect
        if (!user) {
            return res.status(401).json({ error: "Invalid username/email or password" });
        }

        // Remove the password from the user object
        delete user.password;

        res.status(200).json({ message: "Login successful", user });
    } catch (err) {
        console.error("Failed to login:", err);
        res.status(500).json({ error: "Failed to login" });
    }
});


// Get data about a specific user except for the password
app.get("/users/:usernameOrEmail", async (req, res) => {
    try {
        const { usernameOrEmail } = req.params;

        // Find the user in the database by username or email
        const user = await usersCollection.findOne({
            $or: [
                { username: usernameOrEmail },
                { email: usernameOrEmail }
            ]
        });

        // If user is not found
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        // Remove the password from the user object
        delete user.password;
        delete user._id

        res.status(200).json(user);
    } catch (err) {
        console.error("Failed to fetch user data:", err);
        res.status(500).json({ error: "Failed to fetch user data" });
    }
});


// Update course details for a specific user
app.patch("/users/:usernameOrEmail/course_detail", async (req, res) => {
    try {
        const { usernameOrEmail } = req.params;
        const { coursename, level, status, start_date, end_date, grade } = req.body.course_detail[0]; // Extract course details from the request body

        // Check if a course with the same coursename exists for the user
        const user = await usersCollection.findOne({
            $or: [{ username: usernameOrEmail }, { email: usernameOrEmail }],
            "course_detail.coursename": coursename
        });

        if (user) {
            // Update existing course detail
            const updateFields = { "course_detail.$.level": level, "course_detail.$.status": status };
            if (start_date) {
                updateFields["course_detail.$.start_date"] = start_date;
            }
            if (end_date) {
                updateFields["course_detail.$.end_date"] = end_date;
            }
            if(grade){
                updateFields["course_detail.$.grade"] = grade;
            }

            await usersCollection.updateOne(
                { $or: [{ username: usernameOrEmail }, { email: usernameOrEmail }], "course_detail.coursename": coursename },
                { $set: updateFields }
            );
        } else {
            // Add new course detail
            const newCourseDetail = { coursename, level, status };
            if (start_date) {
                newCourseDetail.start_date = start_date;
            }
            if (end_date) {
                newCourseDetail.end_date = end_date;
            }

            await usersCollection.updateOne(
                { $or: [{ username: usernameOrEmail }, { email: usernameOrEmail }] },
                { $addToSet: { course_detail: newCourseDetail } }
            );
        }

        res.status(200).json({ message: "Course details updated successfully" });
    } catch (err) {
        console.error("Failed to update course details:", err);
        res.status(500).json({ error: "Failed to update course details" });
    }
});

// Grant certificate when that VIEW button is clicked after course completion
app.post('/certificate', async (req, res) => {
    const { name, courseName, grade, start_date, end_date } = req.body;

    // Load the certificate template PDF
    const pdfPath = path.join(__dirname, 'assets', 'template.pdf');
    const existingPdfBytes = fs.readFileSync(pdfPath);
    const pdfDoc = await PDFDocument.load(existingPdfBytes)
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.TimesRoman) //Lazy to refactor all changes to TimesRoman hence const name not changed, not sure if I will go back to helvetica

    const pages = pdfDoc.getPages()
    const firstPage = pages[0]
    const { width, height } = firstPage.getSize()

    const lines = [
        `This certificate is awarded to ${name}`,
        `upon successful completion of ${courseName}.`,
        '',
        `We congratulate you for securing ${grade} and`,
        `hope your skills will make a difference.`,
        '',
        `Start date: ${start_date}`,
        `End date: ${end_date}`
    ];

    const startY = height - 300;

    lines.forEach((line, index) => {
        const textWidth = helveticaFont.widthOfTextAtSize(line, 20);
        firstPage.drawText(line, {
            x: width / 2 - textWidth / 2,
            y: startY - index * 20,
            size: 20,
            font: helveticaFont,
            color: rgb(0, 0, 0),
        });
    });

    const pdfBytes = await pdfDoc.save()

    // Save the final PDF as "finalcertificate.pdf"
    const outputPath = path.join(__dirname, 'assets', 'finalcertificate.pdf');
    fs.writeFileSync(outputPath, pdfBytes);

    // Send final pdf as certificate after the PDF is fully saved
    fs.promises.writeFile(outputPath, pdfBytes).then(() => {
        res.setHeader('Content-Type', 'application/pdf');
        res.sendFile(outputPath);
    }).catch((error) => {
        console.error('Error saving PDF:', error);
        res.status(500).send('Internal Server Error');
    });
});

// Close the MongoDB connection when the application is shutting down
process.on('SIGINT', () => {
    client.close().then(() => {
        console.log('MongoDB connection closed');
        process.exit(0);
    });
});
