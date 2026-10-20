import { plural } from '../speak';

/**
 * A form's endings — what people see once they send it, the first whose condition holds — and the button beside a
 * box of words that puts an answer in them (`{name}`).
 */
export const endings = {
  heading: 'Once it is sent',
  hint: 'What people see once they send their answers: the first ending whose condition holds, else the one shown otherwise. {name} shows an answer as people read it; {id} the reference your app gives the response.',
  ending: (n: number) => `Ending ${n}`,
  otherwise: 'Shown otherwise',
  lead: 'Shown',
  conditionFor: (n: number) => `When ending ${n} is shown`,
  title: 'Title',
  titleFor: (n: number) => `Title of ending ${n}`,
  text: 'Words',
  textFor: (n: number) => `Words of ending ${n}`,
  textHint: 'A line of its own is a paragraph; [words](https://…) is a link.',
  again: 'Button to start again',
  againFor: (n: number) => `Button of ending ${n}`,
  againHint: 'Empty: “Submit another response”.',
  noAgain: 'No button',
  noAgainFor: (n: number) => `No button on ending ${n}`,
  add: 'Add an ending',
  addNeedsQuestion: 'Another ending needs a question to choose it by: a choice, or a yes or no.',
  remove: (n: number) => `Remove ending ${n}`,
  moveUp: (n: number) => `Move ending ${n} up`,
  moveDown: (n: number) => `Move ending ${n} down`,
  newTitle: 'Thank you',
  plainThanks: 'Without one, people see “Thank you. Your answers were sent.”',
  forResponses: 'Endings are for a form that collects responses: a record’s screen stays on its record after a save',
  changed: (n: number) => (n ? `What it says once sent changed: ${plural('en', n, { one: '# ending', other: '# endings' })}` : 'It says the plain thanks once sent'),
  // The button that puts an answer in words.
  insertAnswer: 'Put an answer in',
  insertAnswerIn: (box: string) => `Put an answer in: ${box}`,
  answersTitle: 'Put in the answer to',
  reference: 'The reference your app gives it',
  noAnswers: 'No question gives an answer to put in yet.',
  whenEmpty: 'When empty',
  whenEmptyHint: 'Optional: words while it is unanswered, “this branch”',
};
