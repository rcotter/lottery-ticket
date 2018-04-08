const test = require('ava');
const deepFreeze = require('deep-freeze');
const moment = require('moment');
const td = require('testdouble');
const _ = require('lodash');

const APP_PATH = '../../../app';
const calculateTicketPickPrizes = td.replace(`${APP_PATH}/models/calculate-ticket-pick-prizes`);
const { checkTicket } = require(`${APP_PATH}/controllers`);


const VALID_REQUEST_BODY = deepFreeze({
  picks: [
    {
      whiteBalls: [1, 2, 3, 4, 5],
      powerBall: 1
    },
    {
      whiteBalls: [1, 2, 6, 4, 5],
      powerBall: 1
    }
  ],
  drawDate: '2017-11-09'
});

const PICK_PRIZES = deepFreeze([
  { won: false, prize: null, whiteBalls: null, powerBall: null },
  { won: true, prize: 1000000, whiteBalls: [1, 2, 4, 5], powerBall: 1 }
]);

const EXPECTED_RESPONSE_BODY = deepFreeze({
  picks: [
    {
      whiteBalls: [1, 2, 3, 4, 5],
      powerBall: 1,
      prize: { won: false, amount: null, whiteBalls: null, powerBall: null }
    },
    {
      whiteBalls: [1, 2, 6, 4, 5],
      powerBall: 1,
      prize: { won: true, amount: 1000000, whiteBalls: [1, 2, 4, 5], powerBall: 1 }
    }
  ],
  drawDate: new Date('2017-11-09T00:00:00.000Z'),
  summary: { prizeTotal: 1000000, errors: [] }
});

test('Check Valid Ticket', async t => {
  td.when(calculateTicketPickPrizes(td.matchers.anything())).thenReturn(PICK_PRIZES);
  const res = { status: td.function(), json: td.function() };

  await checkTicket({ body: VALID_REQUEST_BODY }, res);

  t.notThrows(() => {
    td.verify(res.json(EXPECTED_RESPONSE_BODY));
  });
});

/* eslint ava/no-skip-test: 0 */

test.skip('Check Valid Ticket For Unrecognized Draw Date (FIX STATE CONFLICT W/ previous test - NEED testdouble skills)', async t => {
  td.when(calculateTicketPickPrizes(td.matchers.anything())).thenReturn(null);
  const res = { status: td.function(), json: td.function() };

  await checkTicket({ body: VALID_REQUEST_BODY }, res);

  t.notThrows(() => {
    const expectedResponseBody = _.cloneDeep(EXPECTED_RESPONSE_BODY);
    expectedResponseBody.picks.forEach((pick) => delete pick.prize);
    expectedResponseBody.summary = {
      prizeTotal: 0,
      errors: [{ drawDate: 'NOT_FOUND' }]
    };

    td.verify(res.json(expectedResponseBody));
  });
});


////////////////////////////////////////////////////////
// 400 - BAD REQUEST

function request(block) {
  const reqBody = _.cloneDeep(VALID_REQUEST_BODY);
  block(reqBody);
  return { body: reqBody };
}

function expectErrorResponse(t, messageRegex) {
  return {
    json: function (body) {
      t.regex(body.error, messageRegex);
    },
    status: function (s) {
      t.is(400, s);
    }
  };
}

test('400s When Missing Picks', async t => {
  const req = request((body) => delete body.picks);

  await checkTicket(req, expectErrorResponse(t, /"picks" is required/));
});

test('400s When Insufficient Picks', async t => {
  const req = request((body) => body.picks = []);

  await checkTicket(req, expectErrorResponse(t, /"picks" must contain at least 1 items/));
});

test('400s With An Invalid Whiteball', async t => {
  const req = request((body) => body.picks[1].whiteBalls[2] = 'BAD NUMBER');

  await checkTicket(req, expectErrorResponse(t, /must be a number/));
});

test('400s With A Whiteball Below The Allowed Range (1 - 69)', async t => {
  const req = request((body) => body.picks[1].whiteBalls[2] = 0);

  await checkTicket(req, expectErrorResponse(t, /must be larger than or equal to 1/));
});

test('400s With A Whiteball Above The Allowed Range (1 - 69)', async t => {
  const req = request((body) => body.picks[1].whiteBalls[2] = 70);

  await checkTicket(req, expectErrorResponse(t, /must be less than or equal to 69/));
});

test('400s With Too Few Whiteballs', async t => {
  const req = request((body) => body.picks[1].whiteBalls.pop());

  await checkTicket(req, expectErrorResponse(t, /must contain 5 items/));
});

test('400s With Too Many Whiteballs', async t => {
  const req = request((body) => body.picks[1].whiteBalls.push(4));

  await checkTicket(req, expectErrorResponse(t, /must contain 5 items/));
});

test('400s With Missing Whiteballs', async t => {
  const req = request((body) => delete body.picks[1].whiteBalls);

  await checkTicket(req, expectErrorResponse(t, /"whiteBalls" is required/));
});

test('400s With Any Duplicate Whiteballs', async t => {
  const req = request((body) => body.picks[1].whiteBalls[0] = body.picks[1].whiteBalls[1]);

  await checkTicket(req, expectErrorResponse(t, /"picks" at position 1 fails because \[child "whiteBalls" fails because \["whiteBalls" position 1 contains a duplicate value/));
});

test('400s With A Powerball Below The Allowed Range (1 - 26)', async t => {
  const req = request((body) => body.picks[1].powerBall = 0);

  await checkTicket(req, expectErrorResponse(t, /must be larger than or equal to 1/));
});

test('400s With A Powerball Above The Allowed Range (1 - 26)', async t => {
  const req = request((body) => body.picks[1].powerBall = 27);

  await checkTicket(req, expectErrorResponse(t, /must be less than or equal to 26/));
});

test('400s An Invalid Powerball', async t => {
  const req = request((body) => body.picks[1].powerBall = 'BAD NUMBER');

  await checkTicket(req, expectErrorResponse(t, /must be a number/));
});

test('400s When Missing Powerball', async t => {
  const req = request((body) => delete body.picks[1].powerBall);

  await checkTicket(req, expectErrorResponse(t, /"powerBall" is required/));
});

test('400s When Missing Draw Date', async t => {
  const req = request((body) => delete body.drawDate);

  await checkTicket(req, expectErrorResponse(t, /"drawDate" is required/));
});

test('400s When Draw Date Is Invalid', async t => {
  const req = request((body) => body.drawDate = 'SOME BAD DATE');

  await checkTicket(req, expectErrorResponse(t, /"drawDate" must be a valid ISO 8601 date/));
});

test('400s When Draw Date Is In The Future', async t => {
  const req = request((body) => body.drawDate = moment().add(1, 'days').toDate());

  await checkTicket(req, expectErrorResponse(t, /"drawDate" must be less than or equal to/));
});

