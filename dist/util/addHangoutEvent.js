"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addHangoutEvent = void 0;
const db_1 = require("../db/db");
const generatePlaceHolders_1 = require("./generatePlaceHolders");
async function addHangoutEvent(hangoutId, eventDescription) {
    try {
        await db_1.dbPool.execute(`INSERT INTO hangout_events(
        hangout_id,
        event_description,
        event_timestamp
      )
      VALUES(${(0, generatePlaceHolders_1.generatePlaceHolders)(3)});`, [hangoutId, eventDescription, Date.now()]);
    }
    catch (err) {
        console.log(`HANGOUT EVENT LOGGING ERROR: ${err}`);
    }
    ;
}
exports.addHangoutEvent = addHangoutEvent;
;
