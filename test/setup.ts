// Every test file compares the engine with the prototype, so the engine behaves exactly as the prototype does,
// quirks included. test/fixes.test.ts switches this off to test the real game's better behaviour.
import { compat } from '../src/compat';

compat.prototype = true;
