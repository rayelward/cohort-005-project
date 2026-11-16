import * as schema from "../../app/db/schema";
import { QuestionType } from "../../app/db/schema";
import { type SeedDb, type CountRows, type QuizOptionIds } from "./helpers";

type QuizQuestionSpec = {
  text: string;
  type: QuestionType;
  options: { text: string; correct: boolean }[];
};

const quiz1Questions: QuizQuestionSpec[] = [
  {
    text: "What does TypeScript compile to?",
    type: QuestionType.MultipleChoice,
    options: [
      { text: "JavaScript", correct: true },
      { text: "WebAssembly", correct: false },
      { text: "Java bytecode", correct: false },
      { text: "Machine code", correct: false },
    ],
  },
  {
    text: "TypeScript is a superset of JavaScript.",
    type: QuestionType.TrueFalse,
    options: [
      { text: "True", correct: true },
      { text: "False", correct: false },
    ],
  },
  {
    text: "Which file configures the TypeScript compiler?",
    type: QuestionType.MultipleChoice,
    options: [
      { text: "tsconfig.json", correct: true },
      { text: "package.json", correct: false },
      { text: "typescript.config.js", correct: false },
      { text: ".tsrc", correct: false },
    ],
  },
];

const quiz2Questions: QuizQuestionSpec[] = [
  {
    text: "What is the primary benefit of generics?",
    type: QuestionType.MultipleChoice,
    options: [
      { text: "Code reusability with type safety", correct: true },
      { text: "Faster execution speed", correct: false },
      { text: "Smaller bundle size", correct: false },
      { text: "Better error messages", correct: false },
    ],
  },
  {
    text: "Generic type parameters can be constrained using the 'extends' keyword.",
    type: QuestionType.TrueFalse,
    options: [
      { text: "True", correct: true },
      { text: "False", correct: false },
    ],
  },
];

const quiz3Questions: QuizQuestionSpec[] = [
  {
    text: "Which HTTP method is used to create a new resource?",
    type: QuestionType.MultipleChoice,
    options: [
      { text: "POST", correct: true },
      { text: "GET", correct: false },
      { text: "PUT", correct: false },
      { text: "PATCH", correct: false },
    ],
  },
  {
    text: "A 404 status code means the server encountered an internal error.",
    type: QuestionType.TrueFalse,
    options: [
      { text: "True", correct: false },
      { text: "False", correct: true },
    ],
  },
  {
    text: "Which status code indicates successful resource creation?",
    type: QuestionType.MultipleChoice,
    options: [
      { text: "201 Created", correct: true },
      { text: "200 OK", correct: false },
      { text: "204 No Content", correct: false },
      { text: "202 Accepted", correct: false },
    ],
  },
];

function insertQuestion(
  db: SeedDb,
  question: QuizQuestionSpec & { quizId: number; position: number }
): QuizOptionIds {
  const [row] = db
    .insert(schema.quizQuestions)
    .values({
      quizId: question.quizId,
      questionText: question.text,
      questionType: question.type,
      position: question.position,
    })
    .returning()
    .all();

  return question.options.map((opt) => {
    const [option] = db
      .insert(schema.quizOptions)
      .values({
        questionId: row.id,
        optionText: opt.text,
        isCorrect: opt.correct,
      })
      .returning()
      .all();
    return { questionId: row.id, optionId: option.id, correct: opt.correct };
  });
}

function insertQuiz(
  db: SeedDb,
  quiz: typeof schema.quizzes.$inferInsert & { questions: QuizQuestionSpec[] }
) {
  const { questions, ...values } = quiz;
  const [row] = db.insert(schema.quizzes).values(values).returning().all();
  const optionIds = questions.flatMap((question, qi) =>
    insertQuestion(db, { ...question, quizId: row.id, position: qi + 1 })
  );
  return { quiz: row, optionIds };
}

export function seedQuizzes({
  countRows,
  course1LessonIds,
  course2LessonIds,
  db,
}: {
  countRows: CountRows;
  course1LessonIds: number[];
  course2LessonIds: number[];
  db: SeedDb;
}) {
  // ─── Quizzes ───
  // Add quizzes to some lessons in both courses

  // Quiz 1: TypeScript Basics Quiz (attached to "Your First TypeScript Program", lesson 3 of course 1)
  const { quiz: quiz1, optionIds: quiz1OptionIds } = insertQuiz(db, {
    lessonId: course1LessonIds[2], // "Your First TypeScript Program"
    title: "TypeScript Basics Quiz",
    passingScore: 0.7,
    questions: quiz1Questions,
  });

  // Quiz 2: Generics Quiz (attached to "Generics Basics", lesson index 5 in course 1)
  const { quiz: quiz2, optionIds: quiz2OptionIds } = insertQuiz(db, {
    lessonId: course1LessonIds[7], // "Generics Basics" (module 3, lesson 2)
    title: "Generics Knowledge Check",
    passingScore: 0.6,
    questions: quiz2Questions,
  });

  // Quiz 3: REST API Basics (attached to "HTTP Methods and Status Codes", lesson index 2 in course 2)
  const { quiz: quiz3, optionIds: quiz3OptionIds } = insertQuiz(db, {
    lessonId: course2LessonIds[2], // "HTTP Methods and Status Codes"
    title: "HTTP Methods Quiz",
    passingScore: 0.7,
    questions: quiz3Questions,
  });

  console.log(
    `Created ${countRows(schema.quizzes)} quizzes with ${countRows(schema.quizQuestions)} questions and ${countRows(schema.quizOptions)} options.`
  );

  return {
    quiz1,
    quiz1OptionIds,
    quiz2,
    quiz2OptionIds,
    quiz3,
    quiz3OptionIds,
  };
}
