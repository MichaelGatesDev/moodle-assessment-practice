const fs = require("fs");
const path = require("path");
const parser = require('node-html-parser');


const args = process.argv.slice(2);
const files = args.filter((arg) => !arg.startsWith("--"));
const parameters = args.filter((arg) => arg.startsWith("--"));
if (files.length < 1) {
    console.error("You must pass a file");
    return;
}

let output = false;
if (parameters.includes("--output")) output = true;

let print = false;
if (parameters.includes("--print")) print = true;

const convertMoodleQuizToJSON = (filePath) => {
    const data = fs.readFileSync(filePath, "utf8");
    const root = parser.parse(data);

    const quizTitle = root.querySelectorAll("ul.breadcrumb li span a span").pop().text;

    const quiz = {
        title: quizTitle,
        questions: {
            matching: [],
            multichoice: [],
        }
    }

    // MATCHING
    const matchNodes = root.querySelectorAll(".que.match");
    for (const qnode of matchNodes) {
        let questions = [];
        let choices = [];

        const block = qnode.querySelector('.ablock');
        const rows = block.querySelectorAll('tr');
        for (const row of rows) {
            const question = row.querySelector('td.text').text;
            questions.push(question);
            let choiceNodes = row.querySelectorAll('td.control select option');
            choiceNodes = choiceNodes.splice(1, choiceNodes.length);
            choices = choiceNodes.map((choice) => choice.text);
        }

        //TODO implement correct answer
        quiz.questions.matching.push({
            questions,
            choices,
        });
    }

    // MULTIPLE CHOICE
    const multichoiceNodes = root.querySelectorAll(".que.multichoice");
    for (const qnode of multichoiceNodes) {
        const correct = qnode.querySelector('.state').text;
        const qtext = qnode.querySelector(".qtext").text;
        const answerNode = qnode.querySelector('.answer');
        const choiceNodes = answerNode.querySelectorAll('div');
        const correctChoiceNodes = answerNode.querySelectorAll('div.correct');

        quiz.questions.multichoice.push({
            title: qtext,
            choices: choiceNodes.map((node) => node.querySelector('label').text.replace(/[[A-Za-z]{1}\./gi, "").trim()),
            answers: correctChoiceNodes.map((node) => node.querySelector('label').text.replace(/[[A-Za-z]{1}\./gi, "").trim()),
        });
    }

    return quiz;
};


for (let i = 0; i < files.length; i++) {
    const fileName = files[i];

    const exists = fs.existsSync(fileName);
    if (!exists) {
        console.error("Error: file does not exist! (" + fileName + ")");
        continue;
    }

    const quizzes = [];

    const fileStats = fs.lstatSync(fileName);
    if (fileStats.isDirectory()) {
        const files = fs.readdirSync(fileName);
        for (const file of files) {
            const converted = convertMoodleQuizToJSON(path.join(fileName, file));
            quizzes.push(converted);
        }
    }
    else {
        const converted = convertMoodleQuizToJSON(file);
        quizzes.push(converted);
    }


    // PRINT RESULTS
    if (print) {
        for (const quiz of quizzes) {
            console.log(`==== ${quiz.title} ====`);

            const multichoice = quiz.questions.multichoice;
            for (let i = 0; i < multichoice.length; i++) {
                const question = multichoice[i];
                console.log(`${i}. ${question.title}`);
                for (const choice of question.choices) {
                    console.log(`* ${choice}`);
                }
                console.log("\n");
            }
        }
    }

    // WRITE RESULTS
    if (output) {
        if (!fs.existsSync("_output")) fs.mkdirSync("_output");
        fs.writeFileSync(path.resolve("_output/exam.json"), JSON.stringify(quizzes, null, 4));
        console.log("Exam written to exam.json");
    }
}

