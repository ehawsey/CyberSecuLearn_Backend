const { MongoClient } = require('mongodb');

// Define the user schema inline
const userSchema = {
    username: { type: String, required: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['learner', 'educator'], required: true },
    course_detail: {
        level: { type: Number },
        courses: [{ type: String }] // Assuming course IDs are strings
    }
};

module.exports = {
    userSchema
};
