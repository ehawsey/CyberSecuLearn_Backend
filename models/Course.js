const { MongoClient } = require('mongodb');

// Define the course schema inline
const courseSchema = {
    coursename: { type: String, required: true },
    levels: { type: Number, required: true },
    host: { type: String, required: true },
    status: { type: String, enum: ['draft', 'released'], required: true },
    qna: {
        type: Map,
        of: String
    },
    quiz: {
        type: Map,
        of: [String]
    },
    lessons: {
        size: { type: Number, required: true },
        video_content: [{ type: String, required: true }],
        document_content: [{ type: String, required: true }]
    }
};

module.exports = {
    courseSchema
};
