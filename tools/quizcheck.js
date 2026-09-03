#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const questionSource = fs.readFileSync(path.join(root, 'questions.js'), 'utf8');
const appSource = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const htmlSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(questionSource, sandbox);

const questions = sandbox.window.QUESTIONS;
const failures = [];
const expect = (condition, message) => { if (!condition) failures.push(message); };

expect(Array.isArray(questions), 'window.QUESTIONS must be an array');
expect(questions.length === 150, `expected 150 questions, found ${questions.length}`);
expect(new Set(questions.map((question) => question.id)).size === questions.length, 'question IDs must be unique');

for (const question of questions) {
  expect(Number.isInteger(question.id), `question without integer id: ${JSON.stringify(question)}`);
  expect(Boolean(question.unit && question.prompt && question.answer && question.explanation && question.source), `question ${question.id} is missing required text`);
  expect(Array.isArray(question.options) && question.options.length === 4, `question ${question.id} must have four options`);
  expect(new Set(question.options).size === 4, `question ${question.id} has duplicate options`);
  expect(question.options.includes(question.answer), `question ${question.id} answer is not present in options`);
  expect(['בינונית', 'מאתגרת'].includes(question.difficulty), `question ${question.id} has invalid difficulty`);
}

const shortMapMatch = appSource.match(/const SHORT_ANSWERS = new Map\((\[[\s\S]*?\])\);/);
expect(Boolean(shortMapMatch), 'SHORT_ANSWERS map was not found in app.js');
const shortEntries = shortMapMatch ? vm.runInNewContext(shortMapMatch[1]) : [];
const shortIds = new Set(shortEntries.map(([id]) => id));
expect(shortIds.size >= 12, `exam requires at least 12 short-answer questions, found ${shortIds.size}`);
for (const id of shortIds) expect(questions.some((question) => question.id === id), `short-answer id ${id} does not exist`);

const htmlIds = [...htmlSource.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
expect(new Set(htmlIds).size === htmlIds.length, 'index.html contains duplicate element IDs');
for (const requiredId of ['short-answer-form', 'short-answer-input', 'short-answer-submit', 'question-kicker']) {
  expect(htmlIds.includes(requiredId), `index.html is missing #${requiredId}`);
}

function groupByUnit(list) {
  return list.reduce((groups, question) => {
    if (!groups.has(question.unit)) groups.set(question.unit, []);
    groups.get(question.unit).push(question);
    return groups;
  }, new Map());
}

function interleaveByUnit(list) {
  const groups = [...groupByUnit(list).entries()].map(([unit, unitQuestions]) => ({ unit, questions: [...unitQuestions] }));
  const result = [];
  let cursor = 0;
  while (groups.length) {
    const group = groups[cursor];
    result.push(group.questions.shift());
    if (!group.questions.length) {
      groups.splice(cursor, 1);
      if (groups.length) cursor %= groups.length;
    } else {
      cursor = (cursor + 1) % groups.length;
    }
  }
  return result;
}

const fullRun = interleaveByUnit(questions);
const firstFiftyUnits = new Set(fullRun.slice(0, 50).map((question) => question.unit));
expect(firstFiftyUnits.size === new Set(questions.map((question) => question.unit)).size, 'the first 50 questions must represent every unit');
for (let index = 1; index < 50; index += 1) {
  if (fullRun[index].unit === fullRun[index - 1].unit && firstFiftyUnits.size > 1) {
    failures.push(`adjacent same-unit questions in the first 50 at positions ${index} and ${index + 1}`);
    break;
  }
}

expect(appSource.includes('const EXAM_SIZE = 50;'), 'exam size must remain 50');
expect(appSource.includes('const EXAM_SHORT_SIZE = 12;'), 'exam must contain 12 short answers');
expect(appSource.includes('const EXAM_CHALLENGING_SIZE = 20;'), 'exam must contain 20 challenging questions');
expect(appSource.includes('questions.filter((question) => !shortIds.has(question.id) && !isShortQuestion(question))'), 'exam multiple-choice pool must exclude short-answer questions');

if (failures.length) {
  console.error(failures.map((failure) => `FAIL: ${failure}`).join('\n'));
  process.exit(1);
}

const difficulty = questions.reduce((counts, question) => {
  counts[question.difficulty] = (counts[question.difficulty] || 0) + 1;
  return counts;
}, {});

console.log(`OK: ${questions.length} questions, ${shortIds.size} short-answer candidates, ${firstFiftyUnits.size} units in the first 50`);
console.log(`Difficulty: ${difficulty['בינונית']} medium, ${difficulty['מאתגרת']} challenging`);
